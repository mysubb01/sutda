import { supabase } from '../supabaseClient';
import { handleDatabaseError, handleGameError, handleResourceNotFoundError, ErrorType } from '../utils/errorHandlers';
import { createShuffledDeck } from './deckApi';
import { logGameStart, logGameEnd, logSystemError } from '../logService';
import { GameState } from '@/types/game';
import { getNextPlayerTurn } from './gameActionApi';
import { evaluateCards, determineWinner } from '@/utils/gameLogic';

/**
 * 디버그 모드용 게임 시작 함수 - 플레이어 수 제한을 무시하고 게임을 시작합니다.
 */
export async function startDebugGame(gameId: string): Promise<void> {
  try {
    console.log(`[INFO] [game] 디버그 게임 시작 요청: ${gameId}`);
    
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      console.error(`[ERROR] [game] 게임 정보 조회 실패:`, gameError);
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    console.log(`[INFO] [game] 게임 상태 확인 - 현재: ${gameData.status}`);
    if (gameData.status === 'playing') {
      console.log(`[INFO] [game] 이미 진행 중인 게임입니다`);
      return; // 이미 게임이 진행 중인 경우 조기 종료
    }

    const roomData = gameData.rooms;
    const gameMode = roomData.mode;
    const baseBet = gameData.base_bet || 1000; // 기본 베팅액

    // 참여 플레이어 조회
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId);

    if (playersError) {
      console.error(`[ERROR] [game] 플레이어 정보 조회 실패:`, playersError);
      throw handleDatabaseError(playersError, 'startDebugGame:players');
    }
    
    // 타입을 명시적으로 지정하여 린트 오류 방지
    const playerCount = playersData ? playersData.length : 0;
    console.log(`[INFO] [game] 디버그 게임 시작: ${playerCount}명 참가, ${gameMode === 'triple' ? 3 : 2}장 모드`);

    // 디버그 모드에서는 플레이어 수 제한을 검사하지 않음
    // 덱 생성 및 카드 분배
    const deck = createShuffledDeck();
    
    // 각 플레이어에게 카드 분배 (모드에 따라 2장 또는 3장)
    const cardCount = gameMode === 'triple' ? 3 : 2;
    
    for (const player of playersData) {
      // 각 플레이어에게 카드 분배
      const playerCards = [];
      for (let i = 0; i < cardCount; i++) {
        playerCards.push(deck.pop()!);
      }
      
      // 카드 저장
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({ 
          cards: playerCards,
          is_die: false,
          is_ready: false,
          current_bet: baseBet,
          has_acted: false,
          balance: player.balance - baseBet,
          updated_at: new Date().toISOString()
        })
        .eq('id', player.id);
        
      if (updatePlayerError) {
        console.error(`[ERROR] [game] 플레이어 ${player.id} 카드 업데이트 실패:`, updatePlayerError);
      }
    }

    // 시작 플레이어 랜덤 결정
    const startPlayerIndex = Math.floor(Math.random() * playersData.length);
    const startPlayerId = playersData[startPlayerIndex].id;
    
    // 게임 상태 업데이트 (여기서 명시적으로 'playing'으로 설정)
    console.log(`[INFO] [game] 게임 상태 'playing'으로 업데이트 시작`);
    const initialBettingEndTime = new Date();
    initialBettingEndTime.setSeconds(initialBettingEndTime.getSeconds() + 30); // 초기 타이머 30초 설정
    
    const { data: updateData, error: updateGameError } = await supabase
      .from('games')
      .update({
        status: 'playing', // 중요: 게임 상태를 'playing'으로 명시적 설정
        current_turn: startPlayerId,
        show_cards: false,
        current_bet_amount: baseBet,
        pot: baseBet * playersData.length,
        updated_at: new Date().toISOString(),
        round: 1,
        betting_end_time: initialBettingEndTime.toISOString() // 초기 betting_end_time 설정
      })
      .eq('id', gameId)
      .select();
      
    if (updateGameError) {
      console.error(`[ERROR] [game] 게임 상태 업데이트 실패:`, updateGameError);
      throw handleDatabaseError(updateGameError, 'startDebugGame:game update');
    }
    
    console.log(`[INFO] [game] 게임 상태 업데이트 성공: ${JSON.stringify({ gameId, status: 'playing' })}`);
    
    // 업데이트 확인
    const { data: verifyData, error: verifyError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
      
    if (verifyError) {
      console.error(`[ERROR] [game] 게임 상태 확인 실패:`, verifyError);
    } else {
      console.log(`[INFO] [game] 게임 상태 확인 결과: ${verifyData.status}`);
      if (verifyData.status !== 'playing') {
        console.error(`[ERROR] [game] 게임 상태가 'playing'으로 업데이트되지 않았습니다: ${verifyData.status}`);
      }
    }

    // 게임 시작 로그 기록
    await logGameStart(gameId, playersData.map(p => p.id), {
      type: 'debug',
      playerCount,
      gameMode: cardCount
    });
    
  } catch (error) {
    console.error(`[ERROR] [game] 디버그 게임 시작 중 오류:`, error);
    await logSystemError(gameId, 'startDebugGame', error);
    throw handleGameError(error, ErrorType.INVALID_STATE, 'startDebugGame');
  }
}

/**
 * 일반 게임 시작 함수
 * @param gameId 게임 ID
 * @param playerId 요청한 플레이어 ID (선택 사항)
 * @returns 성공 또는 실패 정보를 포함한 결과 객체
 */
export async function startGame(gameId: string, playerId?: string): Promise<{ success: boolean, error?: string }> {
  try {
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    const roomData = gameData.rooms;
    const gameMode = roomData.mode;
    const baseBet = gameData.base_bet || 1000; // 기본 베팅액

    // 참여 플레이어 조회
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_ready', true) // 준비 상태인 플레이어만 필터링
      .is('is_die', false);

    if (playersError) {
      throw handleDatabaseError(playersError, 'startGame');
    }

    // 최소 2명 이상 참여 확인
    if (playersData.length < 2) {
      throw handleGameError(
        new Error('플레이어가 부족합니다'), 
        ErrorType.INVALID_STATE, 
        '게임을 시작하려면 최소 2명의 플레이어가 필요합니다'
      );
    }

    // 카드 덱 생성 및 셔플
    const deck = createShuffledDeck();
    
    // 2장 모드와 3장 모드에 따라 다르게 처리
    const cardCount = gameMode === 3 ? 3 : 2;
    console.log(`[startGame] 카드 배분 시작: ${playersData.length}명, ${cardCount}장 모드`);

    // 각 플레이어에게 카드 분배
    for (let i = 0; i < playersData.length; i++) {
      // deck에서 필요한 수만큼 카드 가져오기
      const playerCards = [];
      for (let j = 0; j < cardCount; j++) {
        const card = deck.pop();
        // deck이 비어있는 경우 방어 코드
        if (card === undefined) {
          console.error(`[startGame] 덱이 비어있습니다. 플레이어: ${i}, 카드: ${j}`);
          throw handleGameError(
            new Error('카드 덱이 비어있습니다.'),
            ErrorType.INVALID_STATE,
            '게임 시작 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          );
        }
        playerCards.push(card);
      }
      
      console.log(`[startGame] 플레이어 ${playersData[i].id}에게 카드 할당: ${JSON.stringify(playerCards)}`);
      
      // 플레이어 카드 업데이트
      try {
        const { error } = await supabase
          .from('players')
          .update({
            cards: playerCards,
            is_die: false  // 플레이어 활성 상태 설정
          })
          .eq('id', playersData[i].id);
          
        if (error) {
          console.error(`[startGame] 플레이어 ${playersData[i].id} 카드 업데이트 오류:`, error);
          throw handleDatabaseError(error, `startGame: 플레이어 ${playersData[i].id} 카드 업데이트`);
        }
      } catch (error) {
        console.error(`[startGame] 카드 업데이트 중 예외 발생:`, error);
        throw error;
      }
    }
    
    // 시작 플레이어 랜덤 결정
    const startPlayerIndex = Math.floor(Math.random() * playersData.length);
    const startPlayerId = playersData[startPlayerIndex].id;
    
    // 게임 상태 업데이트 - 실제 DB 스키마에 존재하는 필드만 사용
    console.log(`[startGame] 게임 상태 업데이트: ${gameId}, 상태 'playing'으로 변경`);
    const initialBettingEndTime = new Date();
    initialBettingEndTime.setSeconds(initialBettingEndTime.getSeconds() + 30); // 초기 타이머 30초 설정

    const { data: updateData, error: updateGameError } = await supabase
      .from('games')
      .update({
        status: 'playing',
        current_turn: startPlayerId, // 통합된 필드 사용
        betting_value: baseBet, // 베팅값 필드
        total_pot: baseBet * playersData.length, // 총 팟
        pot: baseBet * playersData.length, // 총 팟 (total_pot과 동일하지만 호환성 위해)
        updated_at: new Date().toISOString(),
        betting_round: 1, // betting_round 필드
        round: 1, // 호환성을 위한 round 필드
        betting_end_time: initialBettingEndTime.toISOString() // 초기 betting_end_time 설정
      })
      .eq('id', gameId)
      .select();
      
    if (updateGameError) {
      throw handleDatabaseError(updateGameError, 'startGame: game update');
    }
    
    // 모든 플레이어 초기 상태 설정 및 기본 베팅
    console.log(`[startGame] 플레이어 상태 업데이트 (${playersData.length}명)`);
    for (const player of playersData) {
      try {
        const { error } = await supabase
          .from('players')
          .update({
            is_ready: false,
            is_die: false,
            // is_die 필드만 사용
            current_bet: baseBet,
            has_acted: false,
            balance: player.balance - baseBet,
            updated_at: new Date().toISOString()
          })
          .eq('id', player.id);
          
        if (error) {
          console.error(`[startGame] 플레이어 ${player.id} 상태 업데이트 오류:`, error);
          throw handleDatabaseError(error, `startGame: 플레이어 ${player.id} 상태 업데이트`);
        }
      } catch (error) {
        console.error(`[startGame] 플레이어 상태 업데이트 중 예외 발생:`, error);
        throw error;
      }
    }
    
    // 게임 상태 확인
    const { data: verifyData, error: verifyError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
      
    if (verifyError) {
      console.error(`[startGame] 게임 상태 확인 실패:`, verifyError);
    } else {
      console.log(`[startGame] 게임 상태 확인 결과: ${verifyData.status}`);
      if (verifyData.status !== 'playing') {
        console.error(`[startGame] 게임 상태가 'playing'으로 업데이트되지 않았습니다: ${verifyData.status}`);
      }
    }
    
    // 게임 시작 로그 기록
    await logGameStart(gameId, playersData.length, gameMode === 3 ? 3 : 2);
    
    // 성공 결과 반환
    return { success: true };
    
  } catch (error: any) {
    console.error('게임 시작 중 오류:', error);
    await logSystemError(gameId || '', 'startGame', error);
    
    // 실패 결과 반환 - 예외를 상위로 전파하는 대신 결과 객체 반환
    return { 
      success: false, 
      error: error?.message || '게임 시작 처리 중 오류가 발생했습니다.' 
    };
  }
}

/**
 * 게임 종료 시 승자 판정 및 상태 업데이트
 */
export async function finishGame(gameId: string): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    // 활성 플레이어 조회 (폴드하지 않은 플레이어)
    const { data: activePlayers, error: playerError } = await supabase
      .from('players')
      .select('id, username, cards, is_die, balance, current_bet, reserved_card')
      .eq('game_id', gameId)
      .eq('is_die', false);

    if (playerError) {
      throw handleDatabaseError(playerError, 'finishGame: players');
    }

    if (activePlayers.length === 0) {
      throw handleGameError(
        new Error('활성화된 플레이어가 없습니다'),
        ErrorType.INVALID_STATE, 
        '게임 종료를 처리할 수 없습니다: 활성화된 플레이어가 없습니다'
      );
    }

    // 한 명만 남은 경우 자동 승리
    let winnerInfo;
    if (activePlayers.length === 1) {
      winnerInfo = {
        id: activePlayers[0].id,
        username: activePlayers[0].username,
        combination: null,
        value: 0
      };
    } else {
      // 카드 조합 평가 및 승자 결정
      const playerResults = activePlayers.map(player => {
        // 3장 모드이고 예약 카드가 있으면 포함
        let cards = [...player.cards];
        if (gameData.game_mode === 3 && player.reserved_card) {
          cards.push(player.reserved_card);
        }
        
        const result = evaluateCards(cards);
        return {
          id: player.id,
          username: player.username,
          cards,
          combination: result.rank,
          value: result.value
        };
      });
      
      // 승자 결정
      const winner = determineWinner(playerResults.map(p => ({ id: p.id, cards: p.cards, is_die: false })));
      winnerInfo = {
        id: winner.winnerId || activePlayers[0].id,
        username: activePlayers.find(p => p.id === (winner.winnerId || activePlayers[0].id))?.username || '',
        combination: null,
        value: 0
      };
    }

    // 게임 업데이트: 승자 정보 및 카드 공개
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        status: 'finished',
        winner: winnerInfo.id,
        show_cards: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    if (updateGameError) {
      throw handleDatabaseError(updateGameError, 'finishGame: game update');
    }

    // 승자에게 상금 지급
    const { error: updateWinnerError } = await supabase
      .from('players')
      .update({
        balance: activePlayers.find(p => p.id === winnerInfo.id)!.balance + gameData.pot,
        updated_at: new Date().toISOString()
      })
      .eq('id', winnerInfo.id);

    if (updateWinnerError) {
      throw handleDatabaseError(updateWinnerError, 'finishGame: winner update');
    }

    // 게임 결과 로그 기록
    await logGameEnd(gameId, winnerInfo.id, winnerInfo.combination || '', gameData.pot);

  } catch (error: any) {
    console.error('게임 종료 처리 중 오류:', error);
    await logSystemError(gameId, 'finishGame', error);
    throw error;
  }
}

/**
 * 재경기 처리 함수
 */
export async function handleRegame(gameId: string): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    // 모든 플레이어 조회
    const { data: players, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId);

    if (playerError) {
      throw handleDatabaseError(playerError, 'handleRegame: players');
    }

    // 게임 상태 초기화
    const { error: resetGameError } = await supabase
      .from('games')
      .update({
        status: 'waiting',
        current_turn: null,
        show_cards: false,
        current_bet_amount: 0, // betting_value -> current_bet_amount
        pot: 0, // total_pot -> pot
        updated_at: new Date().toISOString(),
        round: 1 // betting_round -> round
      })
      .eq('id', gameId);

    if (resetGameError) {
      throw handleDatabaseError(resetGameError, 'handleRegame: reset game');
    }

    // 모든 플레이어 상태 초기화
    for (const player of players) {
      await supabase
        .from('players')
        .update({
          is_ready: false,
          current_bet: 0,
          has_acted: false,
          cards: [],
          reserved_card: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', player.id);
    }

    // 재경기 로그 기록
    await logGameStart(gameId, players.map(p => p.id), {
      type: 'restart',
      playerCount: players.length,
      gameMode: gameData.game_mode
    });

  } catch (error: any) {
    console.error('재경기 처리 중 오류:', error);
    await logSystemError(gameId, 'handleRegame', error);
    throw handleGameError(
      error, 
      ErrorType.SERVER_ERROR, 
      '재경기 처리 중 오류가 발생했습니다'
    );
  }
}

/**
 * 게임 종료 후 처리
 */
export async function cleanupAfterGameFinish(gameId: string): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('status, updated_at')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      console.log(`게임 정보를 찾을 수 없어 정리 작업을 중단합니다: ${gameId}`);
      return;
    }

    // 게임이 종료되지 않은 경우 스킵
    if (gameData.status !== 'finished') {
      return;
    }

    // 게임 종료 후 일정 시간이 지났는지 확인 (2분)
    const gameUpdatedAt = new Date(gameData.updated_at);
    const currentTime = new Date();
    const timeDifference = currentTime.getTime() - gameUpdatedAt.getTime();
    const twoMinutesInMs = 2 * 60 * 1000;

    if (timeDifference < twoMinutesInMs) {
      return; // 아직 2분이 지나지 않았으면 스킵
    }

    // 게임 상태 대기 중으로 변경
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        status: 'waiting',
        current_turn: null,
        winner: null,
        show_cards: false,
        betting_value: 0,
        total_pot: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    if (updateGameError) {
      throw handleDatabaseError(updateGameError, 'cleanupAfterGameFinish: reset game');
    }

    // 플레이어 정보 초기화
    const { error: resetPlayersError } = await supabase
      .from('players')
      .update({
        is_ready: false,
        current_bet: 0,
        has_acted: false,
        cards: [],
        reserved_card: null,
        updated_at: new Date().toISOString()
      })
      .eq('game_id', gameId);

    if (resetPlayersError) {
      throw handleDatabaseError(resetPlayersError, 'cleanupAfterGameFinish: reset players');
    }

    console.log(`게임 ${gameId} 자동 정리 완료`);
  } catch (error: any) {
    console.error('게임 종료 후 정리 작업 중 오류:', error);
    await logSystemError(gameId, 'cleanupAfterGameFinish', error);
  }
}

/**
 * 게임 상태 조회
 */
export async function getGameState(gameId: string): Promise<GameState> {
  try {
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, 'getGameState: game');
    }

    if (!game) {
      throw handleResourceNotFoundError('game', gameId);
    }

    // 플레이어 정보 조회
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId);

    if (playersError) {
      throw handleDatabaseError(playersError, 'getGameState: players');
    }

    // 메시지 정보 조회
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(50);  // 최근 50개 메시지만 조회

    if (messagesError) {
      throw handleDatabaseError(messagesError, 'getGameState: messages');
    }

    // GameState 타입에 맞게 반환 형식 변경
    return {
      ...game,
      players: players || [],
      messages: messages || [] 
    } as GameState;
  } catch (error: any) {
    console.error('게임 상태 조회 중 오류:', error);
    await logSystemError(gameId, 'getGameState', error);
    throw error;
  }
}
