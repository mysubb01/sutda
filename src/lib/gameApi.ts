import { supabase } from './supabase';
import { GameState, CreateGameResponse, JoinGameResponse, BetActionType } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';
import { 
  evaluateCards, 
  determineWinner, 
  findBestCombination 
} from '../utils/gameLogic';
import { Player } from '@/types/game';
import { logInfo, logError, logGameStart, logGameEnd, logBettingAction, logCardAction, logTimeout, logSystemError } from './logService';

// 상수 정의 (파일 상단에 추가)
const REGAME_WAIT_TIME_MS = 5000; // 재경기 대기 시간 (5초)
const BETTING_TIME_LIMIT_MS = 30000; // 베팅 제한 시간 (30초)
const CARD_SELECTION_TIME_LIMIT_MS = 20000; // 카드 선택 제한 시간 (20초)

// 오류 타입 상수 정의
const ErrorType = {
  DB_ERROR: 'database_error',
  GAME_NOT_FOUND: 'game_not_found',
  PLAYER_NOT_FOUND: 'player_not_found',
  INVALID_ACTION: 'invalid_action',
  INVALID_STATE: 'invalid_state',
  INVALID_TURN: 'invalid_turn',
  NETWORK_ERROR: 'network_error',
  TIMEOUT_ERROR: 'timeout_error',
  UNKNOWN_ERROR: 'unknown_error',
  GAME_ACTION_ERROR: 'game_action_error',
  GAME_DATA_ERROR: 'game_data_error'
};

/**
 * 게임 API 오류 처리 유틸리티
 * 오류 타입에 따라 일관된 형식의 오류 객체를 생성
 */
function handleGameError(error: any, errorType: string = ErrorType.UNKNOWN_ERROR, context: string = ''): Error {
  // 오류 정보 구조화
  const timestamp = new Date().toISOString();
  const errorId = `error_${Math.random().toString(36).substr(2, 9)}`;
  
  // 오류 로깅
  console.error(`[${timestamp}] [${errorId}] [${errorType}] ${context}:`, error);
  
  // 사용자 친화적 오류 메시지 생성
  let userMessage = '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  
  switch (errorType) {
    case ErrorType.DB_ERROR:
      userMessage = '데이터베이스 연결 중 오류가 발생했습니다.';
      break;
    case ErrorType.GAME_NOT_FOUND:
      userMessage = '게임을 찾을 수 없습니다.';
      break;
    case ErrorType.PLAYER_NOT_FOUND:
      userMessage = '플레이어 정보를 찾을 수 없습니다.';
      break;
    case ErrorType.INVALID_ACTION:
      userMessage = '유효하지 않은 액션입니다.';
      break;
    case ErrorType.INVALID_STATE:
      userMessage = '현재 게임 상태에서는 해당 액션을 수행할 수 없습니다.';
      break;
    case ErrorType.INVALID_TURN:
      userMessage = '현재 당신의 차례가 아닙니다.';
      break;
    case ErrorType.NETWORK_ERROR:
      userMessage = '네트워크 연결에 문제가 발생했습니다. 연결 상태를 확인해주세요.';
      break;
    case ErrorType.TIMEOUT_ERROR:
      userMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      break;
  }
  
  // 개발용 정보 추가한 확장 오류 객체 생성
  const gameError = new Error(userMessage);
  (gameError as any).errorType = errorType;
  (gameError as any).errorId = errorId;
  (gameError as any).timestamp = timestamp;
  (gameError as any).originalError = error;
  
  return gameError;
}

/**
 * 데이터베이스 오류를 처리하는 전용 함수
 */
function handleDatabaseError(error: any, context: string = ''): Error {
  return handleGameError(error, ErrorType.DB_ERROR, `DB 오류 (${context})`);
}

/**
 * 자원 조회 실패(게임, 플레이어 등)를 처리하는 함수
 */
function handleResourceNotFoundError(resourceType: string, resourceId: string, error: any = null): Error {
  const errorType = resourceType === 'game' ? ErrorType.GAME_NOT_FOUND : ErrorType.PLAYER_NOT_FOUND;
  return handleGameError(error, errorType, `${resourceType} ${resourceId} 조회 실패`);
}

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
  try {
    // 게임 상태 체크
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 로컬 스토리지에서 사용자 ID와 플레이어 ID 확인
    const storedUserId = localStorage.getItem(`game_${gameId}_user_id`);
    const storedPlayerId = localStorage.getItem(`game_${gameId}_player_id`);
    
    // 기존 참여자인지 확인
    if (storedUserId && storedPlayerId) {
      // 기존 플레이어 정보 조회
      const { data: existingPlayer, error: existingPlayerError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('id', storedPlayerId)
        .single();
      
      if (!existingPlayerError && existingPlayer) {
        console.log('기존 플레이어로 재접속:', existingPlayer.id);
        
        // 이름 업데이트가 필요한 경우
        if (existingPlayer.username !== username) {
          await supabase
            .from('players')
            .update({ username })
            .eq('id', existingPlayer.id);
        }
        
        // 최신 게임 상태 가져오기
        const gameState = await getGameState(gameId);
        
        return { 
          playerId: existingPlayer.id, 
          gameState,
          rejoined: true
        };
      }
    }
    
    // 새 플레이어 참가 (게임이 대기 중일 때만)
    if (gameData.status !== 'waiting') {
      throw handleGameError(null, ErrorType.INVALID_STATE, 'joinGame');
    }
    
    const playerId = uuidv4();
    // 임시 사용자 ID 생성
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    
    // 플레이어 생성 - 트랜잭션으로 변경하여 일관성 보장
    try {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          id: playerId,
          game_id: gameId,
          user_id: userId,
          username,
          balance: 10000,
          is_die: false,
          seat_index: seatIndex,
          is_ready: false
        })
        .select();
      
      if (playerError) {
        throw handleDatabaseError(playerError, 'joinGame');
      }
      
      console.log('플레이어 참가 성공:', playerId);
      
      // 로컬 스토리지에 사용자 정보 저장
      localStorage.setItem(`game_${gameId}_user_id`, userId);
      localStorage.setItem(`game_${gameId}_player_id`, playerId);
      localStorage.setItem(`game_${gameId}_seat_index`, String(seatIndex));
      
      // 최신 게임 상태 가져오기
      const gameState = await getGameState(gameId);
      
      return { playerId, gameState };
    } catch (insertError) {
      console.error('플레이어 생성 중 오류:', insertError);
      throw handleDatabaseError(insertError, 'joinGame player insert');
    }
  } catch (err) {
    console.error('게임 참가 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 게임 상태 조회
 */
export async function getGameState(gameId: string): Promise<GameState> {
  // 게임 정보 가져오기
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError || !gameData) {
    throw handleResourceNotFoundError('game', gameId, gameError);
  }
  
  // 플레이어 정보 가져오기
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);
  
  if (playersError) {
    throw handleDatabaseError(playersError, 'getGameState');
  }
  
  // 재경기 남은 시간 계산
  let regameRemainingTime: number | undefined = undefined;
  if (gameData.status === 'regame' && gameData.regame_start_time && gameData.regame_wait_time) {
    const startTime = new Date(gameData.regame_start_time).getTime();
    const currentTime = new Date().getTime();
    const elapsedMs = currentTime - startTime;
    const remainingMs = Math.max(0, gameData.regame_wait_time - elapsedMs);
    regameRemainingTime = Math.ceil(remainingMs / 1000);
  }
  
  // 게임 상태 정보 포맷팅
  const gameState: GameState = {
    id: gameData.id,
    status: gameData.status,
    players: playersData.map(player => ({
      id: player.id,
      user_id: player.user_id,
      username: player.username,
      balance: player.balance,
      cards: player.cards || [],
      is_die: player.is_die, // 필드명 통일
      seat_index: player.seat_index
    })),
    currentTurn: gameData.current_turn || '',
    winner: gameData.winner,
    bettingValue: gameData.betting_value,
    regame_remaining_time: regameRemainingTime,
    regame_start_time: gameData.regame_start_time
  };
  
  return gameState;
}

/**
 * 게임 시작
 */
/**
 * 디버그 모드용 게임 시작 함수 - 플레이어 수 제한을 무시하고 게임을 시작합니다.
 */
export async function startDebugGame(gameId: string): Promise<void> {
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

    // 플레이어 조회 (디버그 모드에서는 is_ready 상태 무시)
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .is('is_die', false);

    if (playersError) {
      throw handleDatabaseError(playersError, 'startDebugGame');
    }

    // 디버그 모드에서는 플레이어가 한 명만 있어도 시작 가능
    if (playersData.length === 0) {
      throw handleGameError(null, ErrorType.INVALID_STATE, '플레이어가 한 명도 없습니다.');
    }

    // 고정 카드 배분 (디버그 모드를 위해 미리 정의된 카드 사용)
    const debugDecks = {
      // 플레이어 1: 13(청생) + 3(하생) = 청하 16점
      player1: [13, 3],
      // 플레이어 2: 12(청구) + 2(동두) = 청막태 4점
      player2: [12, 2],
      // 플레이어 3: 1(일삭) + 11(광역) = 역광일삭 11점
      player3: [1, 11],
      // 플레이어 4: 10(십샭) + 8(팔가) = 매 18점
      player4: [10, 8]
    };

    // 일반 카드 덱 생성 (더 많은 플레이어를 위해)
    const deck = createShuffledDeck();

    // 2장 모드와 3장 모드에 따라 다르게 처리
    if (gameMode === 2) {
      // 2장 모드: 플레이어당 2장씩 배분
      for (let i = 0; i < playersData.length; i++) {
        // 고정 카드 배분
        let playerCards;
        if (i === 0 && debugDecks.player1) {
          playerCards = debugDecks.player1;
        } else if (i === 1 && debugDecks.player2) {
          playerCards = debugDecks.player2;
        } else if (i === 2 && debugDecks.player3) {
          playerCards = debugDecks.player3;
        } else if (i === 3 && debugDecks.player4) {
          playerCards = debugDecks.player4;
        } else {
          // 추가 플레이어는 랜덤 카드 배분
          playerCards = [deck.pop()!, deck.pop()!];
        }
        
        await supabase
          .from('players')
          .update({ 
            cards: playerCards,
            is_die: false,
            is_ready: true // 디버그 모드에서는 모든 플레이어를 자동으로 준비상태로 만듦
          })
          .eq('id', playersData[i].id);
      }
    } else if (gameMode === 3) {
      // 3장 모드: 플레이어당 2장씩 먼저 배분 (모두 비공개)
      for (let i = 0; i < playersData.length; i++) {
        // 고정 카드 배분 (2장)
        let playerCards;
        if (i === 0 && debugDecks.player1) {
          playerCards = debugDecks.player1;
        } else if (i === 1 && debugDecks.player2) {
          playerCards = debugDecks.player2;
        } else if (i === 2 && debugDecks.player3) {
          playerCards = debugDecks.player3;
        } else if (i === 3 && debugDecks.player4) {
          playerCards = debugDecks.player4;
        } else {
          // 추가 플레이어는 랜덤 카드 배분
          playerCards = [deck.pop()!, deck.pop()!];
        }
        
        await supabase
          .from('players')
          .update({ 
            cards: playerCards,
            open_card: null, // 초기에는 공개 카드 없음
            selected_cards: null, // 선택한 카드 초기화
            is_die: false,
            is_ready: true // 디버그 모드에서는 모든 플레이어를 자동으로 준비상태로 만듦
          })
          .eq('id', playersData[i].id);
      }
    }

    // 첫 번째 플레이어부터 시작
    const firstPlayerId = playersData[0].id;

    // 게임 상태 업데이트 (디버그 모드에서는 원을 폴에 넣지 않음)
    await supabase
      .from('games')
      .update({
        status: 'playing',
        current_turn: firstPlayerId,
        betting_round: 1,
        base_bet: baseBet,
        betting_value: 0,
        winner: null,
        total_pot: 0, // 디버그 모드에서는 원을 폴에 넣지 않음 (잔고 차감 없음)
        betting_end_time: new Date(Date.now() + BETTING_TIME_LIMIT_MS).toISOString() // 베팅 시간 제한 설정
      })
      .eq('id', gameId);

    // 게임 액션 기록
    await recordGameAction(gameId, 'start', null);

    console.log(`디버그 게임 시작: ${gameId} (${gameMode}장 모드)`);

    // 시간 제한 타이머는 디버그 모드에서는 아예 설정하지 않음
  } catch (error: any) {
    console.error('디버그 게임 시작 오류:', error);
    throw error;
  }
}

/**
 * 일반 게임 시작 함수
 */
export async function startGame(gameId: string): Promise<void> {
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
      throw handleGameError(null, ErrorType.INVALID_STATE, 'startGame');
    }

    // 카드 덱 생성 및 셔플
    const deck = createShuffledDeck();
    
    // 2장 모드와 3장 모드에 따라 다르게 처리
    if (gameMode === 2) {
      // 2장 모드: 플레이어당 2장씩 배분
      for (let i = 0; i < playersData.length; i++) {
        const playerCards = [deck.pop()!, deck.pop()!];
        
        await supabase
          .from('players')
          .update({ 
            cards: playerCards,
            is_die: false 
          })
          .eq('id', playersData[i].id);
      }
    } else if (gameMode === 3) {
      // 3장 모드: 플레이어당 2장씩 먼저 배분 (모두 비공개)
      for (let i = 0; i < playersData.length; i++) {
        const playerCards = [deck.pop()!, deck.pop()!];
        
        await supabase
          .from('players')
          .update({ 
            cards: playerCards,
            open_card: null, // 초기에는 공개 카드 없음
            selected_cards: null, // 선택한 카드 초기화
            is_die: false 
          })
          .eq('id', playersData[i].id);
      }
    }

    // 첫 번째 플레이어부터 시작
    // const firstPlayerId = playersData[0].id; // 주석 처리 (나중에 activePlayers에서 선택)

    // 게임 상태 업데이트
    let totalPot = 0;
    let updatedPlayers = [];
    
    // 참가비를 보유한 플레이어만 실제 게임에 참가
    for (const player of playersData) {
      // 플레이어의 기본 베팅액 차감 및 팟에 추가
      const newBalance = player.balance - baseBet;
      
      // 잔액 부족 확인
      if (newBalance < 0) {
        console.log(`${player.username}의 잔액이 부족합니다. 게임에 참여하지 않습니다.`);
        
        // 준비 상태 제외
        await supabase
          .from('players')
          .update({ is_ready: false })
          .eq('id', player.id);
          
        continue; // 해당 플레이어는 건너뛰기
      }
      
      // 플레이어의 베팅액 차감 및 팟에 추가
      await supabase
        .from('players')
        .update({ balance: newBalance })
        .eq('id', player.id);
      
      totalPot += baseBet;
      updatedPlayers.push(player);
    }
    
    // 업데이트 바른 후의 플레이어 다시 확인
    const { data: activePlayers, error: activePlayersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_ready', true)
      .is('is_die', false);
      
    if (activePlayersError) {
      throw handleDatabaseError(activePlayersError, 'startGame - active players check');
    }
    
    // 최소 2명 이상 참여 확인
    if (activePlayers.length < 2) {
      throw handleGameError(null, ErrorType.INVALID_STATE, '준비 완료된 플레이어가 부족합니다. (최소 2명)');
    }

    // 첫 번째 활성 플레이어부터 시작
    const firstPlayerId = activePlayers[0].id;
    
    // 게임 상태 업데이트
    await supabase
      .from('games')
      .update({
        status: 'playing',
        current_turn: firstPlayerId,
        betting_round: 1,
        base_bet: baseBet, // 
        betting_value: 0,
        winner: null,
        total_pot: totalPot // 
      })
      .eq('id', gameId);

    // 게임 액션 기록
    await recordGameAction(gameId, 'start', null);

    console.log(`게임 시작: ${gameId} (${gameMode}장 모드)`);

    // 게임 시작 후 베팅 시간 타이머 설정
    setTimeout(async () => {
      try {
        // 게임 상태 다시 확인 (중간에 베팅이 완료되었을 수 있음)
        const { data: currentGame, error: currentGameError } = await supabase
          .from('games')
          .select('status, current_turn, betting_end_time, betting_round')
          .eq('id', gameId)
          .single();
        
        if (currentGameError) {
          console.error('게임 상태 확인 중 오류:', currentGameError);
          return;
        }
        
        // 게임이 진행 중이고 첫 번째 플레이어의 차례이며 베팅 시간이 만료된 경우
        if (currentGame && currentGame.status === 'playing' && 
            currentGame.current_turn === firstPlayerId && 
            new Date(currentGame.betting_end_time) <= new Date()) {
          console.log(`게임 ${gameId}: 베팅 타임아웃, 자동 폴드 처리`);
          await handleBettingTimeout(gameId);
        }
      } catch (err) {
        console.error('베팅 타이머 처리 중 오류:', err);
      }
    }, BETTING_TIME_LIMIT_MS);
  } catch (error) {
    console.error('게임 시작 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 베팅
 */
export async function placeBet(
  gameId: string,
  playerId: string,
  actionType: BetActionType,
  amount?: number
): Promise<void> {
  try {
    // betAction 함수를 호출하여 베팅 처리
    await betAction(gameId, playerId, actionType, amount || 0);
  } catch (error) {
    console.error('베팅 중 오류:', error);
    throw error;
  }
}

// 모든 플레이어가 동일한 금액을 배팅했는지 확인
async function checkAllPlayersMatchedBet(gameId: string, players: Player[]): Promise<boolean> {
  const activePlayers = players.filter(p => !p.is_die);
  
  if (activePlayers.length <= 1) {
    return true;
  }
  
  // 게임 시작 이후 각 플레이어별 마지막 베팅 가져오기
  const playerLastBets: Record<string, number> = {};
  
  for (const player of activePlayers) {
    const { data, error } = await supabase
      .from('game_actions')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', player.id)
      .in('action_type', ['bet', 'call', 'raise', 'half', 'check'])
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error || !data || data.length === 0) {
      return false; // 데이터가 없으면 아직 일치하지 않음
    }
    
    playerLastBets[player.id] = data[0].amount || 0;
  }
  
  // 베팅액이 모두 같은지 확인
  const betAmounts = Object.values(playerLastBets);
  return betAmounts.every(amount => amount === betAmounts[0]);
}

// 다음 플레이어 턴 가져오기
function getNextPlayerTurn(players: Player[], currentPlayerId: string): string {
  console.log('getNextPlayerTurn - 현재 플레이어:', currentPlayerId);
  console.log('getNextPlayerTurn - 전체 플레이어 수:', players.length);
  
  // 데이터 유효성 검사
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.error('getNextPlayerTurn - 유효한 플레이어 목록이 없습니다');
    return '';
  }
  
  if (!currentPlayerId) {
    console.error('getNextPlayerTurn - 현재 플레이어 ID가 없습니다');
    // 아무 플레이어나 선택
    const anyActivePlayers = players.filter(p => !p.is_die);
    return anyActivePlayers.length > 0 ? anyActivePlayers[0].id : '';
  }
  
  // 짱객히 검사 - players의 각 요소가 Player 타입인지 확인
  const validPlayers = players.filter(p => p && typeof p === 'object' && p.id);
  console.log('getNextPlayerTurn - 유효한 플레이어 수:', validPlayers.length);
  
  if (validPlayers.length === 0) {
    console.error('getNextPlayerTurn - 유효한 플레이어가 없습니다');
    return '';
  }
  
  // is_die 속성이 확실히 있는지 확인
  const activePlayers = validPlayers.filter(p => {
    if (p.is_die === undefined) {
      console.warn(`getNextPlayerTurn - 플레이어 ${p.id}의 is_die 속성이 정의되지 않았습니다`);
      return true; // 정의되지 않은 경우 살아있다고 간주
    }
    return !p.is_die;
  });
  
  console.log('getNextPlayerTurn - 활성 플레이어 수:', activePlayers.length);
  
  if (activePlayers.length <= 1) {
    console.log('getNextPlayerTurn - 남은 플레이어가 1명 이하입니다');
    return activePlayers.length === 1 ? activePlayers[0].id : '';
  }
  
  const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
  console.log('getNextPlayerTurn - 현재 인덱스:', currentIndex);
  
  // 현재 플레이어를 찾지 못한 경우
  if (currentIndex === -1) {
    console.log('getNextPlayerTurn - 현재 플레이어를 활성 플레이어 목록에서 찾을 수 없음, 첫 번째 플레이어 선택');
    return activePlayers[0].id;
  }
  
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  console.log('getNextPlayerTurn - 다음 인덱스:', nextIndex);
  console.log('getNextPlayerTurn - 다음 플레이어:', activePlayers[nextIndex].id);
  
  return activePlayers[nextIndex].id;
}

/**
 * 메시지 전송
 */
export async function sendMessage(gameId: string, playerId: string, content: string): Promise<void> {
  if (!content.trim()) {
    throw handleGameError(null, ErrorType.INVALID_ACTION, 'sendMessage');
  }
  
  // 플레이어 정보 가져오기
  const { data: playerData, error: playerError } = await supabase
    .from('players')
    .select('username, user_id')
    .eq('id', playerId)
    .single();
  
  if (playerError || !playerData) {
    throw handleResourceNotFoundError('player', playerId, playerError);
  }

  // 메시지 ID 생성
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // 메시지 객체 생성
  const messageData = {
    id: messageId,
    game_id: gameId,
    user_id: playerData.user_id,
    username: playerData.username,
    content: content,
    created_at: timestamp
  };
  
  // 메시지 저장
  const { error: messageError } = await supabase
    .from('messages')
    .insert(messageData);
  
  if (messageError) {
    throw handleDatabaseError(messageError, 'sendMessage');
  }
}

/**
 * 게임 액션 기록
 */
async function recordGameAction(
  gameId: string,
  actionType: BetActionType | 'show' | 'start' | 'regame' | 'draw_card' | 'select_cards',
  playerId: string | null,
  amount?: number,
  bettingRound?: number
): Promise<void> {
  try {
    const id = uuidv4();
    const { error } = await supabase
      .from('game_actions')
      .insert({
        id,
        game_id: gameId,
        action_type: actionType,
        player_id: playerId,
        amount,
        betting_round: bettingRound,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw handleDatabaseError(error, 'Recording game action');
    }
  } catch (error) {
    console.error('Error recording game action:', error);
    throw handleGameError(error, ErrorType.GAME_ACTION_ERROR, 'Failed to record game action');
  }
}

/**
 * 셔플된 카드 덱 생성
 */
function createShuffledDeck(): number[] {
  // 1부터 20까지의 카드 생성 (섯다 카드)
  const deck = Array.from({ length: 20 }, (_, i) => i + 1);
  
  // 덱 셔플 (Fisher-Yates 알고리즘)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

/**
 * 모든 플레이어가 턴을 가졌는지 확인
 */
async function checkAllPlayersHadTurn(gameId: string, players: Player[]): Promise<boolean> {
  const activePlayers = players.filter(p => !p.is_die);
  
  // 게임 시작 이후 각 플레이어별 가장 최근 액션 확인
  const playerLastActions = new Set<string>();
  
  // 게임의 마지막 라운드 시작 시간 찾기 (start 액션 또는 가장 오래된 베팅 액션)
  const { data: startAction, error: startError } = await supabase
    .from('game_actions')
    .select('created_at')
    .eq('game_id', gameId)
    .eq('action_type', 'start')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (startError) {
    console.error('게임 시작 액션 조회 오류:', startError);
    return false;
  }
  
  const roundStartTime = startAction && startAction.length > 0 
    ? startAction[0].created_at 
    : new Date(0).toISOString();
  
  // 각 활성 플레이어별로 마지막 액션 확인
  for (const player of activePlayers) {
    const { data, error } = await supabase
      .from('game_actions')
      .select('player_id')
      .eq('game_id', gameId)
      .eq('player_id', player.id)
      .in('action_type', ['bet', 'call', 'raise', 'half', 'check', 'die'])
      .gt('created_at', roundStartTime)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error || !data || data.length === 0) {
      return false; // 플레이어가 현재 라운드에서 액션을 취하지 않았음
    }
    
    playerLastActions.add(player.id);
  }
  
  // 모든 활성 플레이어가 액션을 취했는지 확인
  return playerLastActions.size === activePlayers.length;
}

/**
 * 게임 종료 시 승자 판정 및 상태 업데이트
 */
export async function finishGame(gameId: string): Promise<void> {
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

    // 방 정보와 게임 모드 확인
    const roomData = gameData.rooms;
    const gameMode = roomData.mode;

    // 생존한 플레이어 정보 조회
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_die', false);

    if (playersError || !playersData || playersData.length === 0) {
      throw handleDatabaseError(playersError, 'finishGame');
    }

    // 생존한 플레이어가 한 명만 있다면 자동 승리
    if (playersData.length === 1) {
      await updateGameResult(gameId, playersData[0].id);
      return;
    }

    // 게임 모드에 따라 승자 결정 로직이 달라짐
    let playerResults: { playerId: string, score: number, rank: string, cards: number[] }[] = [];

    if (gameMode === 2) {
      // 2장 모드: 기본 승자 판정 로직 사용
      playerResults = playersData.map(player => {
        const evaluation = evaluateCards(player.cards);
        return {
          playerId: player.id,
          score: evaluation.value,
          rank: evaluation.rank,
          cards: player.cards
        };
      });
    } else if (gameMode === 3) {
      // 3장 모드: 선택한 카드를 사용하거나, 선택하지 않았다면 최적의 조합 찾기
      playerResults = playersData.map(player => {
        let cardsToEvaluate: number[];
        
        if (player.selected_cards && player.selected_cards.length === 2) {
          // 플레이어가 직접 선택한 카드 사용
          cardsToEvaluate = player.selected_cards;
        } else {
          // 선택하지 않았다면 최적의 조합을 자동으로 찾기
          cardsToEvaluate = findBestCombination(player.cards);
        }
        
        const evaluation = evaluateCards(cardsToEvaluate);
        return {
          playerId: player.id,
          score: evaluation.value,
          rank: evaluation.rank,
          cards: cardsToEvaluate
        };
      });
    }

    // 점수순으로 정렬
    playerResults.sort((a, b) => b.score - a.score);

    // 승자 확인 (동점이면 무승부 처리 필요)
    const winner = playerResults[0];
    const secondPlace = playerResults[1];
    
    // 동점일 경우 당월로 처리
    const isDraw = winner.score === secondPlace.score;
    
    if (isDraw) {
      // 당월시 배팅금액 되돌리고 재게임 준비
      await supabase
        .from('games')
        .update({
          status: 'draw',
          winner: null
        })
        .eq('id', gameId);

      // 게임 액션 기록
      await recordGameAction(gameId, 'regame', null);
      
      console.log(`게임 ${gameId} 동점으로 당월`);
    } else {
      // 승자 업데이트
      const totalPot = gameData.total_pot || 0;
      
      // 승자 잔액 업데이트
      const { data: winnerData, error: winnerQueryError } = await supabase
        .from('players')
        .select('balance')
        .eq('id', winner.playerId)
        .single();
        
      if (winnerQueryError) {
        console.error('승자 정보 조회 오류:', winnerQueryError);
        throw handleDatabaseError(winnerQueryError, 'finishGame');
      }
      
      const { error: balanceError } = await supabase
        .from('players')
        .update({ 
          balance: (winnerData.balance || 0) + totalPot 
        })
        .eq('id', winner.playerId);
      
      if (balanceError) {
        console.error('승자 잔액 업데이트 오류:', balanceError);
        throw handleDatabaseError(balanceError, 'finishGame');
      }
      
      // 게임 상태 업데이트
      await supabase
        .from('games')
        .update({
          status: 'finished',
          winner: winner.playerId,
          winning_cards: winner.cards,
          winning_rank: winner.rank
        })
        .eq('id', gameId);
      
      // 게임 액션 기록
      await recordGameAction(gameId, 'show', winner.playerId);
      
      console.log(`게임 ${gameId} 승자: ${winner.playerId} (${winner.rank})`);
    }

    // 게임이 종료된 후 5초 후에 게임을 초기화하고 플레이어를 제거합니다.
    setTimeout(() => {
      cleanupAfterGameFinish(gameId);
    }, 5000); // 5초 후에 게임을 초기화하고 플레이어를 제거합니다.

  } catch (error) {
    console.error('게임 종료 처리 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 게임 승자 업데이트
 */
async function updateGameResult(gameId: string, winnerId: string): Promise<void> {
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
    
    // 승자 정보 조회
    const { data: winnerData, error: winnerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', winnerId)
      .single();

    if (winnerError || !winnerData) {
      throw handleResourceNotFoundError('player', winnerId, winnerError);
    }
    
    // 승자 카드 평가
    const cardsToEvaluate = gameData.rooms?.mode === 3 && winnerData.selected_cards && winnerData.selected_cards.length === 2 ?
      winnerData.selected_cards : winnerData.cards;
      
    const evaluation = evaluateCards(cardsToEvaluate);
    
    // 총 상금
    const totalPot = gameData.total_pot || 0;
    
    // 승자 잔액 업데이트
    const { data: winnerBalanceData, error: winnerBalanceError } = await supabase
      .from('players')
      .select('balance')
      .eq('id', winnerId)
      .single();
        
    if (winnerBalanceError) {
      console.error('승자 정보 조회 오류:', winnerBalanceError);
      throw handleDatabaseError(winnerBalanceError, 'updateGameResult');
    }
      
    const { error: balanceError } = await supabase
      .from('players')
      .update({ 
        balance: (winnerBalanceData.balance || 0) + totalPot 
      })
      .eq('id', winnerId);
    
    if (balanceError) {
      console.error('승자 잔액 업데이트 오류:', balanceError);
      throw handleDatabaseError(balanceError, 'updateGameResult');
    }
    
    // 게임 상태 업데이트
    await supabase
      .from('games')
      .update({
        status: 'finished',
        winner: winnerId,
        winning_cards: cardsToEvaluate,
        winning_rank: evaluation.rank
      })
      .eq('id', gameId);
    
    // 게임 액션 기록
    await recordGameAction(gameId, 'show', winnerId);
    
    console.log(`게임 ${gameId} 승자: ${winnerId} (${evaluation.rank})`);
  } catch (error) {
    console.error('게임 결과 업데이트 중 오류 발생:', error);
    throw error;
  }
}

// 재경기 처리 함수
async function handleRegame(gameId: string): Promise<void> {
  const gameState = await getGameState(gameId);
  
  // 플레이어들 카드 초기화 
  for (const player of gameState.players) {
    const { error } = await supabase
      .from('players')
      .update({ cards: null, is_die: false })
      .eq('id', player.id);
      
    if (error) {
      console.error('플레이어 카드 초기화 오류:', error);
    }
  }
  
  // 게임 상태 업데이트
  const { error: gameUpdateError } = await supabase
    .from('games')
    .update({
      status: 'regame',
      current_turn: null,
      winner: null,
      regame_start_time: new Date().toISOString(),
      regame_wait_time: REGAME_WAIT_TIME_MS
    })
    .eq('id', gameId);
  
  if (gameUpdateError) {
    console.error('재경기 설정 오류:', gameUpdateError);
    throw handleDatabaseError(gameUpdateError, 'handleRegame');
  }
  
  // 재경기 액션 기록
  await recordGameAction(gameId, 'regame', null);
  
  // 1초마다 대기 시간 업데이트
  let remainingTime = Math.floor(REGAME_WAIT_TIME_MS / 1000);
  
  const intervalId = setInterval(async () => {
    remainingTime--;
    
    // 남은 시간 업데이트
    await supabase
      .from('games')
      .update({ regame_remaining_time: remainingTime })
      .eq('id', gameId);
      
    if (remainingTime <= 0) {
      clearInterval(intervalId);
    }
  }, 1000);
  
  // 잠시 후 게임 재시작
  setTimeout(async () => {
    try {
      clearInterval(intervalId); // 혹시 남아있는 인터벌 정리
      await startGame(gameId);
    } catch (err) {
      console.error('재경기 시작 오류:', err);
    }
  }, REGAME_WAIT_TIME_MS);
}

// 플레이어 좌석 업데이트
export async function updateSeat(gameId: string, playerId: string, seatIndex: number): Promise<void> {
  try {
    // 해당 좌석이 이미 사용 중인지 확인
    const { data: existingPlayer, error: checkError } = await supabase
      .from('players')
      .select('id, room_id')
      .eq('game_id', gameId)
      .eq('seat_index', seatIndex);

    if (checkError) {
      console.error('좌석 확인 오류:', checkError);
      throw handleDatabaseError(checkError, 'updateSeat');
    }

    // 이미 다른 플레이어가 해당 좌석에 앉아있으면 오류
    if (existingPlayer && existingPlayer.length > 0 && existingPlayer[0].id !== playerId) {
      throw handleGameError(null, ErrorType.INVALID_STATE, 'updateSeat');
    }

    // 플레이어 정보 찾기
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, room_id')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();

    if (playerError || !player) {
      console.error('플레이어 정보 조회 오류:', playerError);
      throw handleDatabaseError(playerError, 'updateSeat');
    }

    // 방 ID가 있는 경우 roomApi의 changeSeat 함수 사용
    if (player.room_id) {
      const { changeSeat } = require('./roomApi');
      await changeSeat(player.room_id, playerId, seatIndex);
      return;
    }

    // 방 ID가 없는 경우 직접 좌석 업데이트
    const { error: updateError } = await supabase
      .from('players')
      .update({ seat_index: seatIndex })
      .eq('id', playerId)
      .eq('game_id', gameId);

    if (updateError) {
      console.error('좌석 업데이트 오류:', updateError);
      throw handleDatabaseError(updateError, 'updateSeat');
    }
  } catch (err) {
    console.error('좌석 업데이트 중 예외 발생:', err);
    throw err;
  }
} 

/**
 * 베팅 라운드 종료 및 시작
 */
export async function finishBettingRound(gameId: string): Promise<void> {
  try {
    console.log(`게임 ${gameId}: 베팅 라운드 종료`);
    
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single();
    
    if (gameError || !gameData) {
      console.error('게임 정보 조회 오류:', gameError);
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 생존한 플레이어만 필터링
    const activePlayers = gameData.players.filter((p: any) => !p.is_die);
    
    // 생존 플레이어가 1명 이하면 게임 종료
    if (activePlayers.length <= 1) {
      await finishGame(gameId);
      return;
    }
    
    // 게임 모드 확인 (2장 또는 3장)
    const gameMode = gameData.rooms?.mode || 2;
    
    // 현재 베팅 라운드 확인
    const currentBettingRound = gameData.betting_round || 1;
    
    // 모드에 따른 처리
    if (gameMode === 2) {
      // 2장 모드에서는 베팅 라운드가 끝나면 게임 종료
      await finishGame(gameId);
      return;
    } else if (gameMode === 3) {
      // 3장 모드 처리
      if (currentBettingRound === 1) {
        // 첫 번째 베팅 라운드가 끝나면 3번째 카드 배분 및 공개 카드 설정
        
        // 덱에서 추가 카드 가져오기
        const deck = createShuffledDeck();
        
        // 공개 카드 배분 및 데이터베이스 업데이트
        for (const player of activePlayers) {
          if (!player.cards || player.cards.length < 2) {
            console.error(`플레이어 ${player.id}의 카드가 없습니다.`);
            continue;
          }
          
          const thirdCard = deck.pop();
          if (!thirdCard) {
            console.error('덱에 카드가 부족합니다.');
            break;
          }
          
          // 기존 카드에 새 카드 추가
          const updatedCards = [...player.cards, thirdCard];
          
          // 플레이어 카드 업데이트
          await supabase
            .from('players')
            .update({
              cards: updatedCards,
              open_card: thirdCard // 세 번째 카드는 공개
            })
            .eq('id', player.id);
          
          // 게임 액션 기록
          await recordGameAction(gameId, 'draw_card', player.id);
        }
        
        // 게임 상태 업데이트
        await supabase
          .from('games')
          .update({
            betting_round: 2,
            current_turn: activePlayers[0].id,
            betting_value: 0, // 새 라운드에서는 베팅값 초기화
            betting_end_time: new Date(Date.now() + BETTING_TIME_LIMIT_MS).toISOString() // 베팅 시간 제한 초기화
          })
          .eq('id', gameId);
        
        console.log(`게임 ${gameId}: 두 번째 베팅 라운드 시작, 공개 카드 배분`);
        
        // 다음 플레이어 베팅 시간 타이머 설정
        setTimeout(async () => {
          try {
            // 게임 상태 다시 확인 (중간에 베팅이 완료되었을 수 있음)
            const { data: currentGame, error: currentGameError } = await supabase
              .from('games')
              .select('status, current_turn, betting_end_time, betting_round')
              .eq('id', gameId)
              .single();
            
            if (currentGameError) {
              console.error('게임 상태 확인 중 오류:', currentGameError);
              return;
            }
            
            // 게임이 진행 중이고 첫 번째 플레이어의 차례이며 베팅 시간이 만료된 경우
            if (currentGame && currentGame.status === 'playing' && 
                currentGame.current_turn === activePlayers[0].id && 
                new Date(currentGame.betting_end_time) <= new Date()) {
              console.log(`게임 ${gameId}: 베팅 타임아웃, 자동 폴드 처리`);
              await handleBettingTimeout(gameId);
            }
          } catch (err) {
            console.error('베팅 타이머 처리 중 오류:', err);
          }
        }, BETTING_TIME_LIMIT_MS);
        
      } else if (currentBettingRound === 2) {
        // 두 번째 베팅 라운드가 끝나면 최종 카드 선택 단계로 전환
        await supabase
          .from('games')
          .update({
            betting_round: 3,
            card_selection_end_time: new Date(Date.now() + CARD_SELECTION_TIME_LIMIT_MS).toISOString() // 카드 선택 시간 설정
          })
          .eq('id', gameId);

        console.log(`게임 ${gameId}: 카드 선택 단계 시작`);
        
        // 카드 선택 시간 타이머 설정
        setTimeout(async () => {
          try {
            // 게임 상태 확인
            const { data: currentGame, error: currentGameError } = await supabase
              .from('games')
              .select('status, betting_round, card_selection_end_time')
              .eq('id', gameId)
              .single();
            
            if (currentGameError) {
              console.error('게임 상태 확인 중 오류:', currentGameError);
              return;
            }
            
            // 게임이 아직 진행 중이고 카드 선택 단계인 경우에만 처리
            if (currentGame && currentGame.status === 'playing' && 
                currentGame.betting_round === 3 && 
                new Date(currentGame.card_selection_end_time) <= new Date()) {
              console.log(`게임 ${gameId}: 카드 선택 시간 종료, 자동 선택 실행`);
              await autoSelectFinalCards(gameId);
            }
          } catch (err) {
            console.error('카드 선택 타이머 처리 중 오류:', err);
          }
        }, CARD_SELECTION_TIME_LIMIT_MS);
        
      } else if (currentBettingRound === 3) {
        // 카드 선택 단계가 끝나면 게임 종료
        await finishGame(gameId);
      }
    }
  } catch (error) {
    console.error('베팅 라운드 종료 중 오류:', error);
    throw error;
  }
}

/**
 * 3장 모드에서 최종 카드 선택
 */
export async function selectFinalCards(
  gameId: string,
  playerId: string,
  selectedCards: number[]
): Promise<void> {
  try {
    // 선택한 카드 유효성 확인
    if (!selectedCards || selectedCards.length !== 2) {
      throw handleGameError(null, ErrorType.INVALID_ACTION, 'selectFinalCards');
    }

    // 플레이어 정보 조회
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();

    if (playerError || !playerData) {
      throw handleResourceNotFoundError('player', playerId, playerError);
    }

    // 선택한 카드가 플레이어의 카드인지 확인
    const isValidSelection = selectedCards.every(card => playerData.cards.includes(card));
    if (!isValidSelection) {
      throw handleGameError(null, ErrorType.INVALID_ACTION, 'selectFinalCards');
    }

    // 선택한 카드 저장
    await supabase
      .from('players')
      .update({ selected_cards: selectedCards })
      .eq('id', playerId);

    console.log(`플레이어 ${playerId}의 카드가 선택됨: ${selectedCards.join(', ')}`);

    // 게임 액션 기록
    await recordGameAction(gameId, 'show', playerId);

    // 모든 플레이어가 카드를 선택했는지 확인
    const { data: allPlayers, error: allPlayersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_die', false);

    if (allPlayersError || !allPlayers) {
      throw handleDatabaseError(allPlayersError, 'selectFinalCards');
    }

    const allSelected = allPlayers.every(
      (p: any) => p.id === playerId || p.selected_cards && p.selected_cards.length === 2
    );
    
    // 모든 플레이어가 카드를 선택했으면 게임 종료
    if (allSelected) {
      await finishGame(gameId);
    }
  } catch (error) {
    console.error('카드 선택 중 오류:', error);
    throw error;
  }
}

/**
 * 카드 선택 시간이 종료되면 자동으로 최적 카드 선택
 */
export async function autoSelectFinalCards(gameId: string): Promise<void> {
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

    // 아직 카드를 선택하지 않은 활성 플레이어들 조회
    const { data: pendingPlayers, error: pendingError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_die', false)
      .is('selected_cards', null);

    if (pendingError) {
      throw handleDatabaseError(pendingError, 'autoSelectFinalCards');
    }

    // 각 플레이어에 대해 최적의 카드 조합 선택
    for (const player of (pendingPlayers || [])) {
      if (player.cards && player.cards.length === 3) {
        const bestCards = findBestCombination(player.cards);
        
        await supabase
          .from('players')
          .update({ selected_cards: bestCards })
          .eq('id', player.id);

        console.log(`플레이어 ${player.id}의 카드가 자동 선택됨: ${bestCards.join(', ')}`);
      }
    }

    // 모든 카드 선택이 완료되었으므로 게임 종료 처리
    await finishGame(gameId);
  } catch (error) {
    console.error('자동 카드 선택 중 오류:', error);
    throw error;
  }
}

/**
 * 베팅 타임아웃 처리
 * 지정된 시간내에 플레이어가 베팅을 하지 않으면 상황에 따라 체크 또는 다이 처리
 * - 이전에 베팅한 사람이 없는 경우: 체크 처리
 * - 이전에 베팅한 사람이 있는 경우: 다이(폴드) 처리
 */
export async function handleBettingTimeout(gameId: string): Promise<void> {
  try {
    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status, current_turn, betting_end_time, betting_round, betting_value, base_bet')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      throw handleDatabaseError(gameError, 'handleBettingTimeout');
    }
    
    // 게임이 플레이 중이 아니거나, 현재 턴 플레이어가 없으면 처리 중단
    if (game.status !== 'playing' || !game.current_turn) {
      return;
    }
    
    // 베팅 타임아웃 시간이 지났는지 확인
    const currentTime = new Date().getTime();
    const bettingEndTime = new Date(game.betting_end_time).getTime();
    
    if (currentTime < bettingEndTime) {
      return; // 아직 타임아웃되지 않음
    }
    
    console.log('배팅 시간 초과'); // 디버깅용
    
    // 현재 턴 플레이어 정보 조회
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', game.current_turn)
      .eq('game_id', gameId)
      .single();
    
    if (playerError) {
      throw handleDatabaseError(playerError, 'handleBettingTimeout - 현재 플레이어 조회');
    }

    // 베팅 여부 확인 (베팅 값이 기본 베팅액보다 큰지 확인)
    const hasBetting = game.betting_value > game.base_bet;
    
    // 모든 플레이어 조회
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('seat_index', { ascending: true });
    
    if (playersError) {
      throw handleDatabaseError(playersError, 'handleBettingTimeout - 전체 플레이어 조회');
    }

    // 활성 플레이어(다이하지 않은 플레이어) 필터링
    const activePlayers = players.filter(
      (p: any) => !p.is_die && p.seat_index !== null
    );
    
    // 베팅 상황에 따라 플레이어 액션 결정 (체크 또는 다이)
    if (hasBetting) {
      // 베팅한 사람이 있는 경우: 다이(폴드) 처리
      console.log(`${currentPlayer.username}의 베팅 시간 초과, 자동 다이 처리`); 
      
      // 타임아웃 로그 기록
      await logTimeout(gameId, currentPlayer.id, '베팅 시간 초과 - 다이');
      
      // 다이 액션 기록
      await recordGameAction(gameId, 'die', currentPlayer.id, 0, game.betting_round);
      
      // 플레이어 상태 업데이트 (다이)
      await supabase
        .from('players')
        .update({ is_die: true })
        .eq('id', currentPlayer.id)
        .eq('game_id', gameId);
      
      // 다이 후 활성 플레이어 재확인
      const updatedActivePlayers = activePlayers.filter(p => p.id !== currentPlayer.id);
      
      // 활성 플레이어가 1명 이하면 게임 종료
      if (updatedActivePlayers.length <= 1) {
        await finishGame(gameId);
        return;
      }
    } else {
      // 베팅한 사람이 없는 경우: 체크 처리
      console.log(`${currentPlayer.username}의 베팅 시간 초과, 자동 체크 처리`);
      
      // 타임아웃 로그 기록
      await logTimeout(gameId, currentPlayer.id, '베팅 시간 초과 - 체크');
      
      // 체크 액션 기록
      await recordGameAction(gameId, 'check', currentPlayer.id, 0, game.betting_round);
    }
    
    // 다음 턴 플레이어 설정
    const nextPlayerId = getNextPlayerTurn(
      hasBetting ? activePlayers.filter(p => p.id !== currentPlayer.id) : activePlayers, 
      currentPlayer.id
    );
    
    // 새로운 베팅 종료 시간 설정
    const newBettingEndTime = new Date(currentTime + BETTING_TIME_LIMIT_MS);
    
    // 게임 상태 업데이트
    await supabase
      .from('games')
      .update({
        current_turn: nextPlayerId,
        betting_end_time: newBettingEndTime.toISOString()
      })
      .eq('id', gameId);
      
  } catch (error: any) {
    console.error('베팅 타임아웃 처리 중 오류:', error);
    await logSystemError(gameId, 'handleBettingTimeout', error);
  }
}

/**
 * 베팅 액션 수행 (베팅, 콜, 레이즈, 폴드)
 */
export async function betAction(
  gameId: string,
  playerId: string,
  action: BetActionType,
  amount: number
): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, players(*)')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    // 게임이 진행 중인지 확인
    if (gameData.status !== 'playing') {
      throw handleGameError(null, ErrorType.INVALID_STATE, 'betAction');
    }

    // 현재 차례인지 확인
    if (gameData.current_turn !== playerId) {
      throw handleGameError(null, ErrorType.INVALID_TURN, 'betAction');
    }

    // 플레이어 정보 찾기
    const player = gameData.players.find((p: any) => p.id === playerId);
    if (!player) {
      throw handleResourceNotFoundError('player', playerId);
    }

    // 생존한 플레이어들 찾기
    const activePlayers = gameData.players.filter((p: any) => !p.is_die);
    if (activePlayers.length <= 1) {
      // 한 명만 남았으면 게임 종료
      await finishGame(gameId);
      return;
    }

    // 액션에 따른 처리
    const currentBettingValue = gameData.betting_value || 0;
    const totalPot = gameData.total_pot || 0;
    
    let newBettingValue = currentBettingValue;
    let playerBet = 0;
    let isPlayerDie = false;

    switch (action) {
      case 'bet':
        // 첫 베팅
        if (currentBettingValue > 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        if (amount <= 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        playerBet = amount;
        newBettingValue = amount;
        break;
        
      case 'call':
        // 콜: 현재 베팅 금액에 맞추기
        if (currentBettingValue <= 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        playerBet = currentBettingValue;
        break;
        
      case 'raise':
        // 레이즈: 현재 베팅 금액보다 더 큰 금액으로 베팅
        if (currentBettingValue <= 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        if (amount <= currentBettingValue) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        playerBet = amount;
        newBettingValue = amount;
        break;
        
      case 'die':
        // 폴드: 게임에서 포기
        isPlayerDie = true;
        break;
        
      case 'check':
        // 체크: 현재 베팅액에 동의
        if (currentBettingValue > 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        playerBet = 0;
        break;
        
      case 'half':
        // 하프: 현재 총액의 절반 베팅
        playerBet = Math.floor(totalPot / 2);
        if (playerBet <= 0) playerBet = 1; // 최소 1
        newBettingValue = playerBet;
        break;
        
      case 'quarter':
        // 쿼터: 현재 총액의 4분의 1 베팅
        playerBet = Math.floor(totalPot / 4);
        if (playerBet <= 0) playerBet = 1; // 최소 1
        newBettingValue = playerBet;
        break;
        
      default:
        throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
    }

    // 플레이어 베팅액 및 상태 업데이트
    if (isPlayerDie) {
      // 폴드한 경우
      await supabase
        .from('players')
        .update({ is_die: true })
        .eq('id', playerId);
    } else {
      // 베팅한 경우 플레이어의 베팅액 차감 및 팟에 추가
      if (playerBet > 0) {
        const newBalance = (player.balance || 0) - playerBet;
        
        // 잔액 부족 확인
        if (newBalance < 0) {
          throw handleGameError(null, ErrorType.INVALID_ACTION, 'betAction');
        }
        
        await supabase
          .from('players')
          .update({ balance: newBalance })
          .eq('id', playerId);
      }
    }

    // 게임 액션 기록
    await recordGameAction(gameId, action, playerId, playerBet);

    // 다음 플레이어 찾기
    let nextPlayer = null;
    
    // 현재 폴드한 플레이어가 있는 경우 업데이트된 플레이어 목록 가져오기
    if (isPlayerDie) {
      // 사망한 플레이어를 제외한 최신 플레이어 목록 가져오기
      const { data: updatedPlayers, error: updatedPlayersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('seat_index', { ascending: true });
        
      if (updatedPlayersError) {
        console.error('업데이트된 플레이어 정보 가져오기 오류:', updatedPlayersError);
        throw handleDatabaseError(updatedPlayersError, 'betAction - 업데이트된 플레이어 정보');
      }
      
      // 죽지 않은 플레이어 필터링
      const alivePlayers = updatedPlayers.filter(p => !p.is_die);
      
      console.log('폴드 후 남은 플레이어 목록:', alivePlayers);
      
      if (alivePlayers.length <= 1) {
        // 한 명만 남았으면 게임 종료
        console.log('폴드 후 남은 플레이어가 한 명뿐입니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // getNextPlayerTurn 함수 사용하여 다음 플레이어 결정
      const nextPlayerId = getNextPlayerTurn(alivePlayers, playerId);
      console.log('다음 플레이어 ID (폴드 후):', nextPlayerId);
      
      if (!nextPlayerId) {
        console.error('다음 플레이어를 찾을 수 없습니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // 다음 플레이어 정보 가져오기
      const nextPlayerIndex = alivePlayers.findIndex(p => p.id === nextPlayerId);
      if (nextPlayerIndex >= 0) {
        nextPlayer = alivePlayers[nextPlayerIndex];
      }
    } else {
      // 폴드가 아닌 경우, 기존 활성 플레이어 목록 사용
      if (activePlayers.length <= 1) {
        // 한 명만 남았으면 게임 종료
        console.log('활성 플레이어가 한 명뿐입니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // getNextPlayerTurn 함수 사용하여 다음 플레이어 결정
      const nextPlayerId = getNextPlayerTurn(activePlayers, playerId);
      console.log('다음 플레이어 ID (일반):', nextPlayerId);
      
      if (!nextPlayerId) {
        console.error('다음 플레이어를 찾을 수 없습니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // 다음 플레이어 정보 찾기
      const nextPlayerIndex = activePlayers.findIndex((p: any) => p.id === nextPlayerId);
      if (nextPlayerIndex >= 0) {
        nextPlayer = activePlayers[nextPlayerIndex];
      }
    }
    
    // 다음 플레이어를 찾지 못한 경우
    if (!nextPlayer) {
      console.error('다음 플레이어 정보를 찾을 수 없습니다. DB에서 직접 조회합니다.');
      
      // DB에서 직접 조회 시도
      const { data: nextPlayerData, error: nextPlayerError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_die', false)
        .order('seat_index', { ascending: true });
        
      if (nextPlayerError || !nextPlayerData || nextPlayerData.length === 0) {
        console.error('다음 플레이어 정보 가져오기 오류:', nextPlayerError);
        console.log('게임을 종료합니다 (다음 플레이어 찾기 실패)');
        await finishGame(gameId);
        return;
      }
      
      // 현재 플레이어가 아닌 첫 번째 플레이어 선택
      nextPlayer = nextPlayerData.find(p => p.id !== playerId) || nextPlayerData[0];
    }

    // 모든 플레이어가 베팅을 맞췄는지 확인
    const allPlayersMatched = activePlayers.every(
      (p: any) => p.id === playerId || p.bet === newBettingValue || p.is_die
    );

    if (allPlayersMatched) {
      // 베팅 라운드 종료
      await finishBettingRound(gameId);
    } else {
      // 다음 플레이어로 차례 넘김 - 최신 플레이어 목록 가져오기
      console.log(`차례 업데이트 시도 - 현재 진행 중: ${playerId}`);
      
      // 최신 활성 플레이어 정보 가져오기
      const { data: latestPlayers, error: latestPlayersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('seat_index', { ascending: true });
      
      if (latestPlayersError) {
        console.error('최신 플레이어 정보 가져오기 오류:', latestPlayersError);
        throw handleDatabaseError(latestPlayersError, 'betAction - 최신 플레이어 정보');
      }
      
      if (!latestPlayers || latestPlayers.length === 0) {
        console.error('최신 플레이어 정보를 찾을 수 없습니다');
        throw handleGameError(null, ErrorType.GAME_DATA_ERROR, 'betAction - 최신 플레이어 정보');
      }
      
      // 활성 플레이어만 필터링
      const latestActivePlayers = latestPlayers.filter(p => !p.is_die);
      console.log('최신 활성 플레이어 수:', latestActivePlayers.length);
      
      if (latestActivePlayers.length <= 1) {
        console.log('최신 활성 플레이어가 1명 이하입니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // getNextPlayerTurn 함수를 사용하여 다음 플레이어 결정
      const nextPlayerId = getNextPlayerTurn(latestActivePlayers, playerId);
      console.log('최신 데이터로 다음 플레이어 결정:', nextPlayerId);
      
      if (!nextPlayerId) {
        console.error('다음 플레이어를 찾을 수 없습니다. 게임을 종료합니다.');
        await finishGame(gameId);
        return;
      }
      
      // 다음 플레이어 정보 찾기
      const nextPlayerInfo = latestActivePlayers.find(p => p.id === nextPlayerId);
      if (!nextPlayerInfo) {
        console.error('다음 플레이어 정보를 찾을 수 없습니다:', nextPlayerId);
        throw handleGameError(null, ErrorType.PLAYER_NOT_FOUND, 'betAction - 다음 플레이어 정보');
      }
      
      // 새로운 플레이어 차례 갱신 데이터
      const turnUpdateData = {
        current_turn: nextPlayerId,
        betting_value: newBettingValue,
        total_pot: totalPot + playerBet,
        betting_end_time: new Date(Date.now() + BETTING_TIME_LIMIT_MS).toISOString() // 새로운 타임아웃 설정
      };
      
      console.log(`차례 업데이트 시도 - 현재: ${playerId} -> 다음: ${nextPlayerId}`);
      console.log('업데이트할 데이터:', turnUpdateData);
      
      // 트랜잭션 방식으로 업데이트 시도
      const { data: updateResult, error: updateError } = await supabase
        .from('games')
        .update(turnUpdateData)
        .eq('id', gameId)
        .select('id, current_turn, betting_value, total_pot');
        
      if (updateError) {
        console.error('차례 업데이트 오류:', updateError);
        throw handleDatabaseError(updateError, 'betAction - 차례 업데이트');
      }
      
      console.log('차례 업데이트 결과:', updateResult);
      
      // 업데이트 처리가 완료되었는지 확인 및 재시도
      const { data: verifyUpdate, error: verifyError } = await supabase
        .from('games')
        .select('id, current_turn, status, betting_value, total_pot, betting_end_time')
        .eq('id', gameId)
        .single();
        
      if (verifyError) {
        console.error('차례 업데이트 확인 오류:', verifyError);
      } else {
        console.log('게임 업데이트 후 상태:', verifyUpdate);
        if (verifyUpdate.current_turn !== nextPlayerId) {
          console.warn('※※※ 차례가 제대로 업데이트되지 않았습니다! 다시 시도합니다.');
          
          // 비동기 실행 없이 즉시 재시도 (트랜잭션이 중복되지 않도록 일부 속성만 업데이트)
          const { error: retryError } = await supabase
            .from('games')
            .update({ current_turn: nextPlayerId })
            .eq('id', gameId);
            
          if (retryError) {
            console.error('차례 재업데이트 오류:', retryError);
          }
          
          // 재확인
          const { data: reVerify } = await supabase
            .from('games')
            .select('current_turn')
            .eq('id', gameId)
            .single();
            
          console.log('차례 재업데이트 후 상태:', reVerify?.current_turn);
        }
      }

      // 다음 플레이어 베팅 시간 타이머 설정
      setTimeout(async () => {
        try {
          // 게임 상태 다시 확인 (중간에 베팅이 완료되었을 수 있음)
          const { data: currentGame, error: currentGameError } = await supabase
            .from('games')
            .select('status, current_turn, betting_end_time, betting_round')
            .eq('id', gameId)
            .single();
          
          if (currentGameError) {
            console.error('게임 상태 확인 중 오류:', currentGameError);
            return;
          }
          
          // 게임이 진행 중이고 다음 플레이어의 차례이며 베팅 시간이 만료된 경우
          if (currentGame && currentGame.status === 'playing' && 
              currentGame.current_turn === nextPlayer.id && 
              new Date(currentGame.betting_end_time) <= new Date()) {
            console.log(`게임 ${gameId}: 플레이어 ${nextPlayer.id} 베팅 타임아웃, 자동 폴드 처리`);
            await handleBettingTimeout(gameId);
          }
        } catch (err) {
          console.error('베팅 타이머 처리 중 오류:', err);
        }
      }, BETTING_TIME_LIMIT_MS);
    }
  } catch (error) {
    console.error('베팅 액션 처리 중 오류:', error);
    throw error;
  }
}

/**
 * 게임 방장 여부 확인
 */
export async function isRoomOwner(gameId: string, playerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('seat_index')
      .eq('game_id', gameId)
      .eq('id', playerId)
      .single();

    if (error) {
      throw handleDatabaseError(error, 'isRoomOwner');
    }

    return data.seat_index === 0; // seat_index가 0인 플레이어가 방장
  } catch (error) {
    console.error('방장 확인 오류:', error);
    return false;
  }
}

/**
 * 게임 시작 가능 여부 확인
 */
export async function canStartGame(gameId: string): Promise<{ canStart: boolean; message: string }> {
  try {
    // 게임 상태 확인
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }

    if (gameData.status !== 'waiting') {
      return { canStart: false, message: '이미 게임이 진행 중입니다.' };
    }

    // 플레이어 수 확인
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('id, is_ready')
      .eq('game_id', gameId)
      .not('seat_index', 'is', null);

    if (playersError) {
      throw handleDatabaseError(playersError, 'canStartGame-players');
    }

    if (!playersData || playersData.length < 2) {
      return { canStart: false, message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' };
    }

    // 모든 플레이어가 준비 상태인지 확인
    const notReadyPlayers = playersData.filter(p => !p.is_ready);
    if (notReadyPlayers.length > 0) {
      return { canStart: false, message: '모든 플레이어가 준비를 완료해야 게임을 시작할 수 있습니다.' };
    }

    return { canStart: true, message: '게임을 시작할 수 있습니다.' };
  } catch (error) {
    console.error('게임 시작 가능 여부 확인 오류:', error);
    return { canStart: false, message: '게임 상태를 확인할 수 없습니다.' };
  }
}

/**
 * 플레이어 준비 상태 토글
 */
export async function toggleReady(gameId: string, playerId: string, isReady: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('players')
      .update({ is_ready: isReady })
      .eq('id', playerId)
      .eq('game_id', gameId);

    if (error) {
      throw handleDatabaseError(error, 'toggleReady');
    }
  } catch (error) {
    console.error('준비 상태 변경 오류:', error);
    throw handleGameError(error, ErrorType.DB_ERROR, '준비 상태 변경 중 오류');
  }
}

/**
 * 게임 종료 후 처리
 * 게임이 종료된 후, 2분이 지난 후 자동으로 게임을 초기화하고 플레이어를 제거합니다.
 */
export async function cleanupAfterGameFinish(gameId: string): Promise<void> {
  try {
    console.log(`게임 ${gameId} 종료 후 처리`);
    
    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      console.error(`게임 ${gameId} 종료 후 처리 중 오류:`, gameError);
      return;
    }
    
    // 게임이 종료되었는지 확인
    if (game.status !== 'finished' && game.status !== 'draw') {
      console.log(`게임 ${gameId}가 아직 종료되지 않았습니다.`);
      return;
    }
    
    // 2분이 지난 후에만 처리
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 2);
    
    // 게임 정보 조회
    const { data: gameData, error: gameDataError } = await supabase
      .from('games')
      .select('updated_at')
      .eq('id', gameId)
      .single();
    
    if (gameDataError) {
      console.error(`게임 ${gameId} 정보 조회 오류:`, gameDataError);
      return;
    }
    
    // 게임이 2분 전보다 최근에 업데이트되었다면 처리하지 않음
    if (new Date(gameData.updated_at) > cutoffTime) {
      console.log(`게임 ${gameId}가 2분 전보다 최근에 업데이트되었습니다. 처리하지 않습니다.`);
      return;
    }
    
    // 플레이어 정보 조회
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, username, game_id, room_id, last_heartbeat')
      .eq('game_id', gameId);
    
    if (playersError) {
      console.error(`게임 ${gameId} 플레이어 정보 조회 오류:`, playersError);
      return;
    }
    
    // 2분이 지난 후에만 처리
    const inactivePlayers = players.filter(player => {
      // last_heartbeat이 없거나, 2분 전보다 이전에 업데이트되었다면 제거
      return (
        !player.last_heartbeat || 
        new Date(player.last_heartbeat).getTime() < cutoffTime.getTime()
      );
    });
    
    console.log(`게임 ${gameId}에서 2분이 지난 후에만 처리: ${inactivePlayers.length}명`);
    
    // 플레이어 제거
    for (const player of inactivePlayers) {
      if (player.room_id) {
        console.log(`플레이어 ${player.username} (${player.id}) 제거, 방 ID: ${player.room_id}`);
        
        try {
          // leaveRoom 함수 호출
          const { leaveRoom } = require('./roomApi');
          await leaveRoom(player.room_id, player.id);
        } catch (err) {
          console.error(`플레이어 ${player.id} 제거 중 오류:`, err);
        }
      } else {
        console.log(`플레이어 ${player.username} (${player.id}) 제거`);
        
        try {
          // 플레이어 직접 제거
          const { error: removeError } = await supabase
            .from('players')
            .delete()
            .eq('id', player.id);
          
          if (removeError) {
            console.error(`플레이어 ${player.id} 제거 중 오류:`, removeError);
          }
        } catch (err) {
          console.error(`플레이어 ${player.id} 제거 중 오류:`, err);
        }
      }
    }
    
    console.log(`게임 ${gameId} 종료 후 처리 완료`);
  } catch (err) {
    console.error(`게임 ${gameId} 종료 후 처리 중 오류:`, err);
  }
}