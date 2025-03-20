import { supabase } from './supabase';
import { GameState, CreateGameResponse, JoinGameResponse, BetActionType } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';
import { determineWinner, evaluateCards } from '@/utils/gameLogic';
import { Player } from '@/types/game';

// 상수 정의 (파일 상단에 추가)
const REGAME_WAIT_TIME_MS = 5000; // 재경기 대기 시간 (5초)

/**
 * 새로운 게임 생성
 */
export async function createGame(username: string): Promise<CreateGameResponse> {
  const gameId = uuidv4();
  const playerId = uuidv4();
  // 임시 사용자 ID 생성
  const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    // 게임 생성
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        status: 'waiting',
        current_turn: null,
        betting_value: 0,
        winner: null
      })
      .select();
    
    if (gameError) {
      console.error('게임 생성 오류 세부 정보:', gameError);
      throw new Error('게임을 생성할 수 없습니다: ' + gameError.message);
    }
    
    console.log('게임 생성 성공:', gameId);
    
    // 플레이어 생성
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        game_id: gameId,
        user_id: userId,
        username,
        balance: 10000,
        is_die: false
      })
      .select();
    
    if (playerError) {
      console.error('플레이어 생성 오류 세부 정보:', playerError);
      throw new Error('플레이어를 생성할 수 없습니다: ' + playerError.message);
    }
    
    console.log('플레이어 생성 성공:', playerId);
    
    // 로컬 스토리지에 사용자 정보 저장
    localStorage.setItem(`game_${gameId}_user_id`, userId);
    localStorage.setItem(`game_${gameId}_player_id`, playerId);
    
    return { gameId, playerId };
  } catch (err) {
    console.error('게임 생성 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 기존 게임에 참가
 */
export async function joinGame(gameId: string, username: string): Promise<JoinGameResponse> {
  try {
    // 게임 상태 체크
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      console.error('게임 조회 오류 세부 정보:', gameError);
      throw new Error('게임을 찾을 수 없습니다: ' + (gameError?.message || '알 수 없는 오류'));
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
      throw new Error('이미 시작된 게임에는 참가할 수 없습니다.');
    }
    
    const playerId = uuidv4();
    // 임시 사용자 ID 생성
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    
    // 플레이어 생성
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        game_id: gameId,
        user_id: userId,
        username,
        balance: 10000,
        is_die: false
      })
      .select();
    
    if (playerError) {
      console.error('플레이어 생성 오류 세부 정보:', playerError);
      throw new Error('게임에 참가할 수 없습니다: ' + playerError.message);
    }
    
    console.log('플레이어 참가 성공:', playerId);
    
    // 로컬 스토리지에 사용자 정보 저장
    localStorage.setItem(`game_${gameId}_user_id`, userId);
    localStorage.setItem(`game_${gameId}_player_id`, playerId);
    
    // 최신 게임 상태 가져오기
    const gameState = await getGameState(gameId);
    
    return { playerId, gameState };
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
    console.error('게임 조회 오류:', gameError);
    throw new Error('게임을 찾을 수 없습니다.');
  }
  
  // 플레이어 정보 가져오기
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);
  
  if (playersError) {
    console.error('플레이어 조회 오류:', playersError);
    throw new Error('플레이어 정보를 불러올 수 없습니다.');
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
      isDie: player.is_die
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
export async function startGame(gameId: string): Promise<void> {
  // 게임 및 플레이어 정보 가져오기
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId);

  if (playersError || !playersData || playersData.length < 2) {
    throw new Error('최소 2명의 플레이어가 필요합니다.');
  }
  
  // 카드 덱 생성 및 셔플
  const deck = createShuffledDeck();
  
  // 플레이어들에게 카드 배분 및 업데이트
  for (let i = 0; i < playersData.length; i++) {
    const playerCards = [deck.pop(), deck.pop()].filter(Boolean) as number[];
    
    const { error: updateError } = await supabase
      .from('players')
      .update({ cards: playerCards })
      .eq('id', playersData[i].id);
    
    if (updateError) {
      console.error('플레이어 카드 업데이트 오류:', updateError);
      throw new Error('카드를 배분할 수 없습니다.');
    }
  }
  
  // 첫 턴을 랜덤으로 선택
  const firstTurn = playersData[Math.floor(Math.random() * playersData.length)].id;
  
  // 게임 상태 업데이트
  const { error: updateError } = await supabase
    .from('games')
    .update({
      status: 'playing',
      current_turn: firstTurn,
      betting_value: 0
    })
    .eq('id', gameId);
  
  if (updateError) {
    console.error('게임 상태 업데이트 오류:', updateError);
    throw new Error('게임을 시작할 수 없습니다.');
  }
  
  // 게임 시작 액션 기록
  await recordGameAction(gameId, 'start', firstTurn);
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
  // 게임 상태 확인
  const gameState = await getGameState(gameId);
  
  if (gameState.status !== 'playing') {
    throw new Error('게임이 진행 중이 아닙니다.');
  }
  
  if (gameState.currentTurn !== playerId) {
    throw new Error('당신의 턴이 아닙니다.');
  }
  
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  // 최근 배팅 액션 조회
  const { data: actionsData, error: actionsError } = await supabase
    .from('game_actions')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (actionsError) {
    console.error('게임 액션 조회 오류:', actionsError);
    throw new Error('게임 액션을 조회할 수 없습니다.');
  }

  // 마지막 배팅 액션 찾기
  const lastBetAction = actionsData?.find(action => 
    ['bet', 'raise', 'call', 'half', 'quarter'].includes(action.action_type) && 
    action.player_id !== playerId
  );

  // 액션 별 배팅 금액 계산
  let betAmount = 0;
  const baseBet = gameState.baseBet || 500; // 기본 배팅액
  
  switch (actionType) {
    case 'check':
      // 이전 베팅이 없을 때만 가능
      if (lastBetAction && lastBetAction.amount > 0) {
        throw new Error('이전 베팅이 있어 체크할 수 없습니다.');
      }
      betAmount = 0;
      break;
      
    case 'call':
      // 이전 베팅액과 동일하게
      betAmount = lastBetAction?.amount || baseBet;
      break;
      
    case 'half':
      // 팟의 절반
      betAmount = Math.floor(gameState.bettingValue / 2);
      // 최소 기본 배팅액 보장
      betAmount = betAmount < baseBet ? baseBet : betAmount;
      break;
      
    case 'quarter':
      // 따당(현재 배팅액의 2배)
      betAmount = (lastBetAction?.amount || baseBet) * 2;
      break;
      
    case 'bet':
    case 'raise':
      // 사용자가 지정한 금액
      if (!amount || amount <= 0) {
        throw new Error('베팅 금액은 0보다 커야 합니다.');
      }
      
      // 최소 베팅액 확인
      const minBet = lastBetAction ? lastBetAction.amount * 2 : baseBet;
      if (amount < minBet) {
        throw new Error(`최소 베팅액은 ${minBet}입니다.`);
      }
      
      // 최대 베팅액 (올인 이외)은 보유량
      betAmount = amount;
      break;
      
    case 'die':
      // 다이는 비용 없음
      betAmount = 0;
      break;
      
    default:
      throw new Error('잘못된 액션 타입입니다.');
  }
  
  // 잔액 확인
  if (actionType !== 'die' && player.balance < betAmount) {
    throw new Error('잔액이 부족합니다.');
  }
  
  // 액션 처리
  if (actionType === 'die') {
    // 플레이어를 다이 상태로 변경
    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        is_die: true
      })
      .eq('id', playerId);
    
    if (playerUpdateError) {
      console.error('플레이어 다이 상태 업데이트 오류:', playerUpdateError);
      throw new Error('다이할 수 없습니다.');
    }
    
    // 남은 플레이어 확인
    const activePlayers = gameState.players.filter(p => p.id !== playerId && !p.isDie);
    
    if (activePlayers.length === 1) {
      // 한 명만 남았으면 게임 종료
      const winner = activePlayers[0].id;

      // 승자의 잔액 업데이트
      const { error: winnerUpdateError } = await supabase
        .from('players')
        .update({
          balance: activePlayers[0].balance + gameState.bettingValue
        })
        .eq('id', winner);
      
      if (winnerUpdateError) {
        console.error('승자 잔액 업데이트 오류:', winnerUpdateError);
        throw new Error('승자 잔액을 업데이트할 수 없습니다.');
      }
      
      // 게임 종료 상태 업데이트
      const { error: gameUpdateError } = await supabase
            .from('games')
            .update({
              status: 'finished',
          winner: winner
            })
            .eq('id', gameId);
      
      if (gameUpdateError) {
        console.error('게임 종료 상태 업데이트 오류:', gameUpdateError);
        throw new Error('게임을 종료할 수 없습니다.');
      }
      
      // 액션 기록
      await recordGameAction(gameId, 'die', playerId);
      return;
    } else {
      // 다음 플레이어 결정
      const nextPlayerTurnId = getNextPlayerTurn(gameState.players, playerId);

      // 게임 상태 업데이트
      const { error: gameUpdateError } = await supabase
        .from('games')
        .update({
          current_turn: nextPlayerTurnId
        })
        .eq('id', gameId);
      
      if (gameUpdateError) {
        console.error('게임 상태 업데이트 오류:', gameUpdateError);
        throw new Error('게임 상태를 업데이트할 수 없습니다.');
      }
      
      // 액션 기록
      await recordGameAction(gameId, 'die', playerId);
      return;
    }
  }
  
  // 다음 플레이어 결정
  const nextPlayerTurnId = getNextPlayerTurn(gameState.players, playerId);

  // 게임 상태 업데이트
  const { error: gameUpdateError } = await supabase
    .from('games')
    .update({
      current_turn: nextPlayerTurnId,
      betting_value: gameState.bettingValue + betAmount
    })
    .eq('id', gameId);
  
  if (gameUpdateError) {
    console.error('게임 상태 업데이트 오류:', gameUpdateError);
    throw new Error('베팅할 수 없습니다.');
  }
  
  // 플레이어 잔액 업데이트
  if (betAmount > 0) {
    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        balance: player.balance - betAmount
      })
      .eq('id', playerId);
    
    if (playerUpdateError) {
      console.error('플레이어 잔액 업데이트 오류:', playerUpdateError);
      throw new Error('잔액을 업데이트할 수 없습니다.');
    }
  }
  
  // 모든 플레이어가 액션을 취했는지 확인
  const allPlayersTookAction = await checkAllPlayersHadTurn(gameId, gameState.players);
  const allPlayersMatchedBet = await checkAllPlayersMatchedBet(gameId, gameState.players);
  
  // 모든 플레이어가 액션을 취했고, 배팅 금액이 일치하면 게임 종료
  if (allPlayersTookAction && allPlayersMatchedBet) {
    console.log('모든 플레이어 액션 완료, 베팅 금액 일치 - 게임 종료');
    await finishGame(gameId);
  } else {
    // 디버그 로그
    if (!allPlayersTookAction) {
      console.log('아직 모든 플레이어가 액션을 취하지 않음');
    }
    if (!allPlayersMatchedBet) {
      console.log('플레이어들의 베팅 금액이 일치하지 않음');
    }
  }
  
  // 액션 기록
  await recordGameAction(gameId, actionType, playerId, betAmount);
}

// 모든 플레이어가 동일한 금액을 배팅했는지 확인
async function checkAllPlayersMatchedBet(gameId: string, players: Player[]): Promise<boolean> {
  const activePlayers = players.filter(p => !p.isDie);
  
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
  const activePlayers = players.filter(p => !p.isDie);
  if (activePlayers.length <= 1) {
    return '';
  }
  
  const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex].id;
}

/**
 * 메시지 전송
 */
export async function sendMessage(gameId: string, playerId: string, content: string): Promise<void> {
  if (!content.trim()) {
    throw new Error('메시지 내용이 비어있습니다.');
  }
  
  // 플레이어 정보 가져오기
  const { data: playerData, error: playerError } = await supabase
    .from('players')
    .select('username, user_id')
    .eq('id', playerId)
    .single();
  
  if (playerError || !playerData) {
    console.error('플레이어 정보 조회 오류:', playerError);
    throw new Error('플레이어 정보를 찾을 수 없습니다.');
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
    console.error('메시지 저장 오류:', messageError);
    throw new Error('메시지를 전송할 수 없습니다: ' + messageError.message);
  }
}

/**
 * 게임 액션 기록
 */
async function recordGameAction(
  gameId: string,
  actionType: BetActionType | 'show' | 'start' | 'regame',
  playerId: string | null,
  amount?: number
): Promise<void> {
  const { error } = await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: playerId,
      action_type: actionType,
      amount: amount
    });

  if (error) {
    console.error('게임 액션 기록 오류:', error);
    // 액션 기록 실패는 게임 진행에 치명적이지 않으므로 오류를 던지지 않음
    console.warn('게임 액션을 기록할 수 없습니다.');
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
  const activePlayers = players.filter(p => !p.isDie);
  
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
 * 게임 종료 처리
 */
async function finishGame(gameId: string): Promise<void> {
  // 게임 상태 조회
  const gameState = await getGameState(gameId);
  
  // 활성 플레이어 (다이하지 않은 플레이어 중 카드가 있는 플레이어)
  const activePlayers = gameState.players
    .filter(p => !p.isDie && p.cards && p.cards.length === 2)
    .map(p => ({
      id: p.id,
      cards: p.cards as number[],
      isDie: p.isDie || false
    }));
  
  if (activePlayers.length === 0) {
    console.error('활성 플레이어가 없습니다');
    return;
  }
  
  // 승자 결정
  const { winnerId, isRegame } = determineWinner(activePlayers);
  
  // 재경기 처리
  if (isRegame) {
    await handleRegame(gameId);
    return;
  }
  
  if (!winnerId) {
    console.log('승자를 결정할 수 없음 (구사 등의 특수 상황)');
    return;
  }
  
  // 승자 찾기
  const winner = gameState.players.find(p => p.id === winnerId);
  if (!winner) {
    console.error('승자 정보를 찾을 수 없음');
    return;
  }
  
  // 땡값 계산 처리
  let winnings = gameState.bettingValue;
  let dangValues: Record<string, number> = {};
  
  // 활성 플레이어 중 패자들 확인
  for (const player of gameState.players.filter(p => !p.isDie && p.id !== winnerId)) {
    // 승자 패 확인
    const winnerEval = evaluateCards(winner.cards || []);
    // 패자 패 확인
    const loserEval = evaluateCards(player.cards || []);
    
    // 땡값 계산 - 승자가 땡잡이고 패자가 땡일 경우
    if (winnerEval.rank === '땡잡이' && loserEval.rank.includes('땡') && 
       !loserEval.rank.includes('광땡') && loserEval.rank !== '10땡') {
      const dangValue = calculateDangValue(loserEval.rank, gameState.bettingValue);
      dangValues[player.id] = dangValue;
      winnings += dangValue;
    }
    
    // 암행어사와 광땡 처리
    if (winnerEval.rank === '암행어사' && 
       (loserEval.rank === '13광땡' || loserEval.rank === '18광땡')) {
      // 광땡에 대한 암행어사 배당 (일반적으로 3배)
      const amhaengValue = gameState.bettingValue * 3;
      dangValues[player.id] = amhaengValue;
      winnings += amhaengValue;
    }
    
    // 38광땡이 다른 광땡을 이겼을 경우 (상위 광땡이 하위 광땡 배당)
    if (winnerEval.rank === '38광땡' && 
       (loserEval.rank === '13광땡' || loserEval.rank === '18광땡')) {
      const gwangDangValue = gameState.bettingValue * 2;
      dangValues[player.id] = gwangDangValue;
      winnings += gwangDangValue;
    }
  }
  
  // 승자의 잔액 업데이트
  const { error: winnerUpdateError } = await supabase
    .from('players')
    .update({
      balance: winner.balance + winnings
    })
    .eq('id', winnerId);
  
  if (winnerUpdateError) {
    console.error('승자 잔액 업데이트 오류:', winnerUpdateError);
    throw new Error('승자 잔액을 업데이트할 수 없습니다.');
  }
  
  // 땡값이 있다면 패자들의 잔액 추가 차감
  for (const [playerId, dangValue] of Object.entries(dangValues)) {
    const loser = gameState.players.find(p => p.id === playerId);
    if (loser) {
      const { error: loserUpdateError } = await supabase
        .from('players')
        .update({
          balance: Math.max(0, loser.balance - dangValue) // 최소 0으로 제한
        })
        .eq('id', playerId);
      
      if (loserUpdateError) {
        console.error('패자 잔액 업데이트 오류:', loserUpdateError);
      }
    }
  }
  
  // 게임 상태 업데이트
  const { error: gameUpdateError } = await supabase
    .from('games')
    .update({
      status: 'finished',
      winner: winnerId,
      show_cards: true,
      dang_values: dangValues
    })
    .eq('id', gameId);
  
  if (gameUpdateError) {
    console.error('게임 종료 상태 업데이트 오류:', gameUpdateError);
    throw new Error('게임을 종료할 수 없습니다.');
  }
  
  // 결과 액션 기록
  await recordGameAction(gameId, 'show', winnerId);
}

// 땡값 계산 함수
function calculateDangValue(rank: string, bettingValue: number): number {
  // 광땡 배당
  if (rank === '38광땡') return bettingValue * 10;
  if (rank === '13광땡') return bettingValue * 8;
  if (rank === '18광땡') return bettingValue * 7;
  
  // 일반 땡 배당
  if (rank === '10땡' || rank === '장땡') return bettingValue * 5;
  if (rank === '9땡') return bettingValue * 4.5;
  if (rank === '8땡') return bettingValue * 4;
  if (rank === '7땡') return bettingValue * 3.5;
  if (rank === '6땡') return bettingValue * 3;
  if (rank === '5땡') return bettingValue * 2.5;
  if (rank === '4땡') return bettingValue * 2;
  if (rank === '3땡') return bettingValue * 1.5;
  if (rank === '2땡') return bettingValue * 1.25;
  if (rank === '1땡') return bettingValue * 1;
  
  // 특수 조합 배당
  if (rank === '암행어사') return bettingValue * 3; // 광땡 잡았을 때
  
  return 0; // 땡이 아닌 경우
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
  
  // 게임 상태 업데이트 - 배팅값은 유지하며 재시작
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
    throw new Error('재경기를 설정할 수 없습니다.');
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