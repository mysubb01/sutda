import { supabase } from '../supabaseClient';
import { CreateGameResponse, JoinGameResponse } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';
import { handleDatabaseError, handleGameError, handleResourceNotFoundError, ErrorType } from '../utils/errorHandlers';
import { logInfo, logSystemError } from '../logService';
import { findEmptySeat, isSeatOccupied } from './seatApi';

/**
 * 새로운 게임 생성
 */
export async function createGame(username: string): Promise<CreateGameResponse> {
  try {
    const gameId = uuidv4();
    const playerId = uuidv4();
    const timestamp = new Date().toISOString();

    // 게임 생성
    const { error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        status: 'waiting',
        current_turn: null,
        winner: null,
        created_at: timestamp,
        updated_at: timestamp,
        show_cards: false,
        betting_value: 0,
        total_pot: 0,
        base_bet: 10,
        game_mode: 2,  // 기본 2장 모드
        betting_round: 1 // 기본 1라운드
      });

    if (gameError) {
      throw handleDatabaseError(gameError, 'createGame');
    }

    // 플레이어 생성
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        game_id: gameId,
        user_id: uuidv4(), // 임시 사용자 ID 생성
        username: username,
        balance: 1000,  // 기본 잔액
        created_at: timestamp,
        updated_at: timestamp,
        seat_index: 0 // 기본 좌석 인덱스 0
      });

    if (playerError) {
      throw handleDatabaseError(playerError, 'createGame player');
    }

    // 게임 생성 로그 기록
    await logInfo(
      gameId,
      'game',
      `게임 생성: ${username}(이)가 생성함`,
      playerId,
      { username }
    );

    return {
      gameId,
      playerId
    };
  } catch (error: any) { 
    console.error('게임 생성 중 오류:', error);
    // gameId가 정의되지 않은 경우 빈 문자열 사용
    await logSystemError('', 'createGame', error);
    throw handleGameError(error, ErrorType.DB_ERROR, '게임 생성 중 오류');
  }
}

/**
 * 기존 게임에 참가
 */
export async function joinGame(
  gameId: string, 
  username: string, 
  seatIndex?: number
): Promise<JoinGameResponse> {
  console.log(`[joinGame] Joining game ${gameId} as ${username}, requested seat: ${seatIndex ?? 'auto'}`);
  
  try {
    // 게임 상태 체크
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      console.error(`[joinGame] Game not found: ${gameId}`);
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 게임이 대기 상태인지 확인
    if (gameData.status !== 'waiting') {
      console.error(`[joinGame] Game not in waiting state: ${gameId}, status: ${gameData.status}`);
      throw handleGameError(
        new Error(`게임이 대기 상태가 아닙니다: ${gameData.status}`),
        ErrorType.INVALID_STATE,
        '진행 중이거나 종료된 게임에는 참가할 수 없습니다'
      );
    }

    // 현재 게임의 플레이어 수 확인
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('id, seat_index')
      .eq('game_id', gameId);

    if (playersError) {
      throw handleDatabaseError(playersError, 'joinGame: players check');
    }

    if (playersData.length >= 5) {
      throw handleGameError(
        new Error('게임 참가자가 이미 가득 찼습니다'),
        ErrorType.GAME_FULL,
        '게임 참가자가 이미 가득 찼습니다'
      );
    }

    // 좌석 확인 및 배정
    let finalSeatIndex: number;
    if (seatIndex !== undefined) {
      // 요청 좌석 유효성 검사
      if (seatIndex < 0 || seatIndex > 4) {
        throw handleGameError(
          new Error(`유효하지 않은 좌석 인덱스: ${seatIndex}`),
          ErrorType.VALIDATION_ERROR,
          '좌석 번호는 0부터 4까지만 가능합니다'
        );
      }
      
      // 요청 좌석 점유 확인
      const isOccupied = await isSeatOccupied(seatIndex, '', gameId);
      if (isOccupied) {
        throw handleGameError(
          new Error(`좌석 ${seatIndex}은 이미 점유되어 있습니다`),
          ErrorType.INVALID_STATE,
          '이미 다른 플레이어가 사용 중인 좌석입니다'
        );
      }
      
      finalSeatIndex = seatIndex;
    } else {
      // 자동 좌석 배정
      const emptySeatIndex = await findEmptySeat(gameId);
      if (emptySeatIndex === null) {
        throw handleGameError(
          new Error('빈 좌석이 없습니다'),
          ErrorType.GAME_FULL,
          '게임에 빈 좌석이 없습니다'
        );
      }
      finalSeatIndex = emptySeatIndex;
    }

    // 신규 플레이어 생성
    const playerId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const { error: insertError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        game_id: gameId,
        user_id: uuidv4(),
        username: username,
        balance: 1000,
        created_at: timestamp,
        updated_at: timestamp,
        seat_index: finalSeatIndex,
        is_ready: false
      });

    if (insertError) {
      throw handleDatabaseError(insertError, 'joinGame: player creation');
    }

    // 게임 참가 로그 기록
    await logInfo(
      gameId,
      'game',
      `${username}님이 게임에 참가했습니다 (좌석: ${finalSeatIndex})`,
      playerId,
      { username, seatIndex: finalSeatIndex }
    );

    return {
      gameId,
      playerId,
      seatIndex: finalSeatIndex
    };
  } catch (error: any) {
    console.error(`[joinGame] Error joining game: ${gameId}`, error);
    await logSystemError(gameId, 'joinGame', error);
    
    // 이미 적절한 오류 타입이 설정된 경우 그대로 전달
    if (error.name === 'GameError') {
      throw error;
    }
    
    throw handleGameError(error, ErrorType.DB_ERROR, '게임 참가 중 오류가 발생했습니다');
  }
}

/**
 * 플레이어 준비 상태 토글
 */
export async function toggleReady(
  gameId: string,
  playerId: string,
  targetState?: boolean
): Promise<{ success: boolean; isReady?: boolean; error?: string }> {
  try {
    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, 'toggleReady: game check');
    }
    
    if (!game) {
      throw handleGameError(
        new Error('게임을 찾을 수 없습니다'), 
        ErrorType.NOT_FOUND, 
        '게임을 찾을 수 없습니다'
      );
    }
    
    // 게임이 이미 시작되었으면 준비 불가
    if (game.status === 'playing') {
      throw handleGameError(
        new Error('게임이 이미 시작되었습니다'), 
        ErrorType.INVALID_STATE, 
        '게임이 이미 시작되었습니다'
      );
    }
    
    // 플레이어 정보 확인
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('is_ready')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();
    
    if (playerError) {
      throw handleDatabaseError(playerError, 'toggleReady: player check');
    }
    
    if (!player) {
      throw handleGameError(
        new Error('플레이어를 찾을 수 없습니다'), 
        ErrorType.NOT_FOUND, 
        '플레이어를 찾을 수 없습니다'
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
      throw handleDatabaseError(updateError, 'toggleReady: player update');
    }
    
    return {
      success: true,
      isReady: newReadyState
    };
  } catch (error: any) {
    console.error(`[toggleReady] Error for player ${playerId} in game ${gameId}:`, error);
    if (error.name === 'GameError') {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: false,
      error: '플레이어 준비 상태 변경 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 게임 방장 여부 확인
 */
export async function isRoomOwner(gameId: string, playerId: string): Promise<boolean> {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    // 가장 먼저 생성된 플레이어가 방장
    return players.length > 0 && players[0].id === playerId;
  } catch (error) {
    console.error('방장 여부 확인 중 오류:', error);
    return false;
  }
}

/**
 * 게임 시작 가능 여부 확인
 */
export async function canStartGame(gameId: string): Promise<{ canStart: boolean; message: string }> {
  try {
    // 게임 정보 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      return { canStart: false, message: '게임 정보를 조회할 수 없습니다.' };
    }
    
    if (game.status !== 'waiting') {
      return { canStart: false, message: '게임이 이미 시작되었거나 종료되었습니다.' };
    }
    
    // 플레이어 정보 확인
    const { data: players, error: playerError } = await supabase
      .from('players')
      .select('id, is_ready')
      .eq('game_id', gameId);
    
    if (playerError) {
      return { canStart: false, message: '플레이어 정보를 조회할 수 없습니다.' };
    }
    
    // 플레이어 수 확인 (최소 2명)
    if (players.length < 2) {
      return { canStart: false, message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' };
    }
    
    // 모든 플레이어 준비 상태 확인 (방장 제외)
    const readyPlayers = players.filter(p => p.is_ready).length;
    const ownerCount = 1; // 방장은 준비 상태가 아니어도 됨
    
    if (readyPlayers < players.length - ownerCount) {
      return { canStart: false, message: '모든 플레이어가 준비 상태가 아닙니다.' };
    }
    
    return { canStart: true, message: '게임을 시작할 수 있습니다.' };
  } catch (error) {
    console.error('게임 시작 가능 여부 확인 중 오류:', error);
    return { canStart: false, message: '게임 시작 가능 여부 확인 중 오류가 발생했습니다.' };
  }
}
