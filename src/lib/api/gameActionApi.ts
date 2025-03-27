import { supabase } from '../supabaseClient';
import { handleDatabaseError, handleGameError, ErrorType } from '../utils/errorHandlers';
import { GameState, Player, GameMode } from '@/types/game';
import { createShuffledDeck, dealCards } from './deckApi';

/**
 * 게임 상태 타입
 */
export enum GameStatus {
  WAITING = 'waiting',
  STARTING = 'starting',
  PLAYING = 'playing',
  FINISHED = 'finished'
}

/**
 * 게임 시작 처리
 * @param gameId 게임 ID
 * @param playerId 시작 요청 플레이어 ID
 * @returns 성공 여부 및 업데이트된 게임 상태
 */
export async function startGame(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
  try {
    console.log(`[startGame] Starting game ${gameId} by player ${playerId}`);
    
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, room:rooms(*)')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, '게임 정보 조회 실패');
    }
    
    if (!game) {
      throw handleGameError(new Error('게임을 찾을 수 없습니다'), ErrorType.NOT_FOUND, '게임을 찾을 수 없습니다');
    }
    
    // 게임이 이미 시작되었는지 확인
    if (game.status === GameStatus.PLAYING) {
      throw handleGameError(new Error('게임이 이미 시작되었습니다'), ErrorType.INVALID_STATE, '게임이 이미 시작되었습니다');
    }
    
    // 플레이어가 방장인지 확인
    const isOwner = await isRoomOwner(gameId, playerId);
    if (!isOwner) {
      throw handleGameError(new Error('방장만 게임을 시작할 수 있습니다'), ErrorType.UNAUTHORIZED, '방장만 게임을 시작할 수 있습니다');
    }
    
    // 시작 가능 여부 확인
    const startResult = await canStartGame(gameId);
    if (!startResult.canStart) {
      throw handleGameError(
        new Error(`게임을 시작할 수 없습니다. ${startResult.message}`), 
        ErrorType.INVALID_STATE, 
        `게임을 시작할 수 없습니다. ${startResult.message}`
      );
    }
    
    // 카드 덱 생성 및 셔플
    const deck = createShuffledDeck();
    
    // 준비된 플레이어 목록 조회
    const { data: readyPlayers, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .eq('is_ready', true);
    
    if (playersError) {
      throw handleDatabaseError(playersError, '플레이어 정보 조회 실패');
    }
    
    // 각 플레이어에게 카드 2장씩 분배
    const playerCards = dealCards(deck, readyPlayers.length);
    
    // 각 플레이어 상태 업데이트
    for (let i = 0; i < readyPlayers.length; i++) {
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({
          cards: playerCards[i],
          is_playing: true,
          is_ready: false,
          balance: 1000, // 초기 칩 지급 (chips -> balance)
          current_bet: 0,
          is_die: false, // folded -> is_die
          last_heartbeat: new Date().toISOString(), // 추가된 필드
          has_acted: false // 추가된 필드
        })
        .eq('id', readyPlayers[i].id);
      
      if (updatePlayerError) {
        console.error(`[startGame] Error updating player ${readyPlayers[i].id}:`, updatePlayerError);
      }
    }
    
    // 첫 번째 플레이어를 현재 플레이어로 설정
    const firstPlayerId = readyPlayers.length > 0 ? readyPlayers[0].id : null;
    
    // 게임 상태 업데이트
    // 베팅 종료 시간 설정
    const bettingEndTime = new Date();
    bettingEndTime.setSeconds(bettingEndTime.getSeconds() + 30); // 30초 제한시간
    
    const { data: updatedGame, error: updateGameError } = await supabase
      .from('games')
      .update({
        status: GameStatus.PLAYING,
        current_player_id: firstPlayerId, // 프론트엔드의 실제 사용에 맞춰 current_player_id 사용
        current_bet_amount: 0,
        pot: 0, // 프론트엔드와 호환성 위해 pot 사용
        round: 1, // 프론트엔드와 호환성 위해 round 사용 
        deck: deck,
        last_action: '게임이 시작되었습니다',
        updated_at: new Date().toISOString(),
        betting_end_time: bettingEndTime.toISOString(), // 추가된 필드 유지
        mode: game.room?.mode || 2 // 프론트엔드와 호환성 위해 mode 사용
      })
      .eq('id', gameId)
      .select('*, room:rooms(*)')
      .single();
    
    if (updateGameError) {
      throw handleDatabaseError(updateGameError, '게임 상태 업데이트 실패');
    }
    
    // 시작 메시지 기록
    await sendGameMessage(gameId, 'system', '게임이 시작되었습니다');
    
    return {
      success: true,
      gameState: transformGameState(updatedGame)
    };
    
  } catch (error: any) {
    console.error('[startGame] Error:', error);
    return {
      success: false,
      error: error.message || '게임 시작 중 오류가 발생했습니다'
    };
  }
}

/**
 * 플레이어의 준비 상태 토글
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @param targetState 변경할 준비 상태. 설정하지 않으면 현재 상태의 반대로 설정.
 * @returns 성공 여부 및 준비 상태
 */
export async function toggleReady(
  gameId: string,
  playerId: string,
  targetState?: boolean
): Promise<{ success: boolean; isReady?: boolean; error?: string }> {
  try {
    console.log(`[toggleReady] Toggling ready state for player ${playerId} in game ${gameId}`);
    
    // 현재 플레이어 상태 조회
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('is_ready')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();
    
    if (playerError) {
      throw handleDatabaseError(playerError, '플레이어 정보 조회 실패');
    }
    
    if (!player) {
      throw handleGameError(
        new Error('플레이어를 찾을 수 없습니다'), 
        ErrorType.NOT_FOUND, 
        '플레이어를 찾을 수 없습니다'
      );
    }
    
    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, '게임 정보 조회 실패');
    }
    
    if (!game) {
      throw handleGameError(new Error('게임을 찾을 수 없습니다'), ErrorType.NOT_FOUND, '게임을 찾을 수 없습니다');
    }
    
    // 게임이 이미 시작되었으면 준비 불가
    if (game.status === GameStatus.PLAYING) {
      throw handleGameError(
        new Error('게임이 이미 시작되었습니다'), 
        ErrorType.INVALID_STATE, 
        '게임이 이미 시작되었습니다'
      );
    }
    
    // 준비 상태 설정 (매개변수로 주어진 값 또는 현재 값의 반대)
    const newReadyState = targetState !== undefined ? targetState : !player.is_ready;
    
    const { error: updateError } = await supabase
      .from('players')
      .update({ is_ready: newReadyState })
      .eq('id', playerId)
      .eq('game_id', gameId);
    
    if (updateError) {
      throw handleDatabaseError(updateError, '플레이어 상태 업데이트 실패');
    }
    
    return {
      success: true,
      isReady: newReadyState
    };
    
  } catch (error: any) {
    console.error('[toggleReady] Error:', error);
    return {
      success: false,
      error: error.message || '준비 상태 변경 중 오류가 발생했습니다'
    };
  }
}

/**
 * 게임 종료 처리
 * @param gameId 게임 ID
 * @returns 성공 여부 및 결과 메시지
 */
export async function endGame(
  gameId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log(`[endGame] Ending game ${gameId}`);
    
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, '게임 정보 조회 실패');
    }
    
    if (!game) {
      throw handleGameError(new Error('게임을 찾을 수 없습니다'), ErrorType.NOT_FOUND, '게임을 찾을 수 없습니다');
    }
    
    // 게임이 이미 종료되었는지 확인
    if (game.status === GameStatus.FINISHED) {
      return {
        success: true,
        message: '게임이 이미 종료되었습니다'
      };
    }
    
    // 게임 결과 계산 (승자, 칩 배당 등)
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, username, chips')
      .eq('game_id', gameId)
      .eq('is_playing', true)
      .order('chips', { ascending: false });
    
    if (playersError) {
      throw handleDatabaseError(playersError, '플레이어 정보 조회 실패');
    }
    
    // 게임 종료 상태 업데이트
    const { error: updateError } = await supabase
      .from('games')
      .update({
        status: GameStatus.FINISHED,
        last_action: '게임이 종료되었습니다',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);
    
    if (updateError) {
      throw handleDatabaseError(updateError, '게임 상태 업데이트 실패');
    }
    
    // 종료 메시지 및 결과 기록
    let resultMessage = '게임이 종료되었습니다.\n';
    
    if (players && players.length > 0) {
      resultMessage += '\n최종 순위:\n';
      players.forEach((player, index) => {
        resultMessage += `${index + 1}위: ${player.username} (${player.chips} 칩)\n`;
      });
    }
    
    await sendGameMessage(gameId, 'system', resultMessage);
    
    return {
      success: true,
      message: resultMessage
    };
    
  } catch (error: any) {
    console.error('[endGame] Error:', error);
    return {
      success: false,
      error: error.message || '게임 종료 중 오류가 발생했습니다'
    };
  }
}

/**
 * 타이머가 만료되었을 때 자동 폴드 처리
 * @param gameId 게임 ID
 * @param playerId 시간 초과된 플레이어 ID (선택적)
 * @returns 처리 결과
 */
export async function handleBettingTimeout(
  gameId: string,
  playerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[handleBettingTimeout] Timeout for player ${playerId || 'unknown'} in game ${gameId}`);
    
    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status, current_player_id')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, '게임 정보 조회 실패');
    }
    
    if (!game) {
      throw handleGameError(new Error('게임을 찾을 수 없습니다'), ErrorType.NOT_FOUND, '게임을 찾을 수 없습니다');
    }
    
    // playerId가 제공되지 않은 경우 현재 플레이어 ID 사용
    const currentPlayerId = playerId || game.current_player_id;
    if (!currentPlayerId) {
      throw handleGameError(
        new Error('현재 플레이어 ID를 찾을 수 없습니다'), 
        ErrorType.NOT_FOUND, 
        '현재 플레이어 ID를 찾을 수 없습니다'
      );
    }
    
    // 게임이 진행 중이 아니면 처리하지 않음
    if (game.status !== GameStatus.PLAYING) {
      return { 
        success: false,
        error: '게임이 진행 중이 아닙니다'
      };
    }
    
    // 현재 턴이 해당 플레이어의 턴인지 확인
    if (game.current_player_id !== playerId) {
      return {
        success: false,
        error: '해당 플레이어의 턴이 아닙니다'
      };
    }
    
    // 플레이어 정보 조회
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('username')
      .eq('id', playerId)
      .single();
    
    if (playerError) {
      throw handleDatabaseError(playerError, '플레이어 정보 조회 실패');
    }
    
    if (!player) {
      throw handleGameError(
        new Error('플레이어를 찾을 수 없습니다'), 
        ErrorType.NOT_FOUND, 
        '플레이어를 찾을 수 없습니다'
      );
    }
    
    // 자동 폴드 처리
    const { error: updatePlayerError } = await supabase
      .from('players')
      .update({
        folded: true,
        last_action: 'fold',
        last_action_time: new Date().toISOString()
      })
      .eq('id', playerId);
    
    if (updatePlayerError) {
      throw handleDatabaseError(updatePlayerError, '플레이어 상태 업데이트 실패');
    }
    
    // 다음 플레이어 결정
    const nextPlayerId = await getNextPlayerTurn(gameId, currentPlayerId);
    
    // 게임 상태 업데이트
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        current_player_id: nextPlayerId,
        last_action: `${player.username} 시간 초과로 폴드`
      })
      .eq('id', gameId);
    
    if (updateGameError) {
      throw handleDatabaseError(updateGameError, '게임 상태 업데이트 실패');
    }
    
    // 알림 메시지 기록
    await sendGameMessage(gameId, 'system', `${player.username}님이 시간 초과로 자동 폴드되었습니다.`);
    
    // 라운드 완료 여부 확인
    await checkRoundCompletion(gameId);
    
    return { success: true };
    
  } catch (error: any) {
    console.error('[handleBettingTimeout] Error:', error);
    return {
      success: false,
      error: error.message || '시간 초과 처리 중 오류가 발생했습니다'
    };
  }
}

/**
 * 플레이어가 방장인지 확인
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @returns 방장 여부
 */
export async function isRoomOwner(gameId: string, playerId: string): Promise<boolean> {
  try {
    // 게임의 플레이어 정보를 시간순으로 조회
    const { data: players, error } = await supabase
      .from('players')
      .select('id, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[isRoomOwner] Error retrieving players:', error);
      return false;
    }
    
    // 가장 먼저 생성된 플레이어가 방장
    return players.length > 0 && players[0].id === playerId;
  } catch (error) {
    console.error('[isRoomOwner] Error:', error);
    return false;
  }
}

/**
 * 게임을 시작할 수 있는지 확인
 * @param gameId 게임 ID
 * @returns 시작 가능 여부 및 메시지
 */
export async function canStartGame(gameId: string): Promise<{ canStart: boolean; message: string }> {
  try {
    // 준비된 플레이어 수 확인
    const { data, error, count } = await supabase
      .from('players')
      .select('id', { count: 'exact' })
      .eq('game_id', gameId)
      .eq('is_ready', true);
    
    if (error) {
      console.error('[canStartGame] Error:', error);
      return { 
        canStart: false, 
        message: '게임 정보를 확인하는 중 오류가 발생했습니다' 
      };
    }
    
    // 최소 2명 이상의 준비된 플레이어가 필요
    const readyPlayerCount = count || 0;
    const canStart = readyPlayerCount >= 2;
    
    return {
      canStart,
      message: canStart 
        ? '게임을 시작할 수 있습니다' 
        : `게임 시작을 위해 최소 2명의 준비된 플레이어가 필요합니다. (현재 ${readyPlayerCount}명)`
    };
  } catch (error) {
    console.error('[canStartGame] Error:', error);
    return { 
      canStart: false, 
      message: '예상치 못한 오류가 발생했습니다' 
    };
  }
}

/**
 * 게임 메시지 전송
 * @param gameId 게임 ID
 * @param sender 발신자
 * @param content 메시지 내용
 * @returns 성공 여부
 */
async function sendGameMessage(
  gameId: string,
  sender: string,
  content: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('messages')
      .insert([{
        game_id: gameId,
        sender: sender,
        content: content,
        created_at: new Date().toISOString()
      }]);
    
    if (error) {
      console.error('[sendGameMessage] Error:', error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('[sendGameMessage] Error:', error);
    return false;
  }
}

/**
 * 게임 데이터를 GameState 타입으로 변환
 * @param gameData 게임 데이터
 * @returns GameState 객체
 */
function transformGameState(gameData: any): GameState {
  if (!gameData) return {} as GameState;
  
  // room은 배열로 오거나 객체로 올 수 있음
  let roomName = '';
  if (gameData.room) {
    if (Array.isArray(gameData.room) && gameData.room.length > 0) {
      roomName = gameData.room[0]?.name || '';
    } else if (typeof gameData.room === 'object') {
      roomName = (gameData.room as any).name || '';
    }
  }
  
  return {
    id: gameData.id,
    room_id: gameData.room_id,
    room_name: roomName,
    status: gameData.status,
    totalPot: gameData.pot || 0, // 프론트엔드와 호환성 위해 pot 사용
    bettingValue: gameData.current_bet_amount || 0,
    currentTurn: gameData.current_player_id || null, // 프론트엔드 호환성 위해 current_player_id 사용
    lastAction: gameData.last_action,
    winner: null,
    players: [], // 플레이어 정보는 별도로 로드
    betting_round: gameData.round || 1, // 프론트엔드와 호환성 위해 round 사용
    game_mode: gameData.mode || 2, // 프론트엔드와 호환성 위해 mode 사용
    betting_end_time: gameData.betting_end_time || null, // 추가된 필드 유지
    cardSelectionTime: gameData.card_selection_time || null // 추가된 필드
  };
}

// 다음 플레이어 턴 참조
/**
 * 현재 플레이어 다음 턴을 가질 플레이어 ID를 반환
 * 
 * @param gameId 게임 ID
 * @param currentPlayerId 현재 플레이어 ID
 * @returns 다음 플레이어 ID 또는 null
 */
export async function getNextPlayerTurn(gameId: string, currentPlayerId: string): Promise<string | null> {
  try {
    // 현재 게임의 활성 플레이어 목록 조회
    const { data: players, error } = await supabase
      .from('players')
      .select('id, seat_index, is_die, balance')
      .eq('game_id', gameId)
      .eq('is_playing', true)
      .order('seat_index', { ascending: true });
    
    if (error || !players || players.length === 0) {
      console.error('[getNextPlayerTurn] Error retrieving players:', error);
      return null;
    }
    
    // 다이하지 않고 잔액이 있는 플레이어만 필터링
    const activePlayers = players.filter(p => !p.is_die && p.balance > 0);
    
    if (activePlayers.length <= 1) {
      return null; // 한 명만 남았으면 다음 플레이어가 없음
    }
    
    // 현재 플레이어의 인덱스 찾기
    const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
    
    if (currentIndex === -1) {
      return activePlayers[0].id; // 현재 플레이어가 목록에 없으면 첫 번째 활성 플레이어
    }
    
    // 다음 플레이어 계산 (순환)
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    return activePlayers[nextIndex].id;
    
  } catch (error) {
    console.error('[getNextPlayerTurn] Error:', error);
    return null; // 오류 발생 시 null 반환
  }
}

async function checkRoundCompletion(gameId: string): Promise<void> {
  // 임시 구현
  console.log(`[checkRoundCompletion] Checking round completion for game ${gameId}`);
}
