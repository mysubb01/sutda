import { supabase } from './supabase';
import { GameState, CreateGameResponse, JoinGameResponse } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';

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
    bettingValue: gameData.betting_value
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
export async function placeBet(gameId: string, playerId: string, amount: number): Promise<void> {
  if (amount <= 0) {
    throw new Error('베팅 금액은 0보다 커야 합니다.');
  }
  
  // 현재 게임 상태 확인
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

  if (player.balance < amount) {
    throw new Error('잔액이 부족합니다.');
  }

  // 다음 플레이어 결정
  const nextPlayerTurnId = getNextPlayerTurn(gameState.players, playerId);

  // 게임 상태 업데이트
  const { error: gameUpdateError } = await supabase
    .from('games')
    .update({
      current_turn: nextPlayerTurnId,
      betting_value: gameState.bettingValue + amount
    })
    .eq('id', gameId);
  
  if (gameUpdateError) {
    console.error('게임 상태 업데이트 오류:', gameUpdateError);
    throw new Error('베팅할 수 없습니다.');
  }
  
  // 플레이어 잔액 업데이트
  const { error: playerUpdateError } = await supabase
    .from('players')
    .update({
      balance: player.balance - amount
    })
    .eq('id', playerId);
  
  if (playerUpdateError) {
    console.error('플레이어 잔액 업데이트 오류:', playerUpdateError);
    throw new Error('잔액을 업데이트할 수 없습니다.');
  }
  
  // 액션 기록
  await recordGameAction(gameId, 'bet', playerId, amount);
}

/**
 * 콜
 */
export async function callBet(gameId: string, playerId: string): Promise<void> {
  // 현재 게임 상태 확인
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

  // 기본 콜 금액은 500
  const callAmount = 500;

  if (player.balance < callAmount) {
    throw new Error('잔액이 부족합니다.');
  }

  // 다음 플레이어 결정
  const nextPlayerTurnId = getNextPlayerTurn(gameState.players, playerId);

  // 게임 상태 업데이트
  const { error: gameUpdateError } = await supabase
        .from('games')
        .update({
      current_turn: nextPlayerTurnId,
      betting_value: gameState.bettingValue + callAmount
        })
        .eq('id', gameId);
  
  if (gameUpdateError) {
    console.error('게임 상태 업데이트 오류:', gameUpdateError);
    throw new Error('콜할 수 없습니다.');
  }
  
  // 플레이어 잔액 업데이트
  const { error: playerUpdateError } = await supabase
    .from('players')
      .update({
      balance: player.balance - callAmount
    })
    .eq('id', playerId);
  
  if (playerUpdateError) {
    console.error('플레이어 잔액 업데이트 오류:', playerUpdateError);
    throw new Error('잔액을 업데이트할 수 없습니다.');
  }
  
  // 액션 기록
  await recordGameAction(gameId, 'call', playerId, callAmount);
}

/**
 * 다이
 */
export async function dieBet(gameId: string, playerId: string): Promise<void> {
  // 현재 게임 상태 확인
  const gameState = await getGameState(gameId);
  
  if (gameState.status !== 'playing') {
    throw new Error('게임이 진행 중이 아닙니다.');
  }

  if (gameState.currentTurn !== playerId) {
    throw new Error('당신의 턴이 아닙니다.');
  }
  
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
  }
  
  // 액션 기록
  await recordGameAction(gameId, 'die', playerId);
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
  
  // 브로드캐스트 채널로 메시지 전송 (실시간 알림)
  const channel = supabase.channel(`chat-${gameId}`);
  channel.subscribe();
  channel.send({
    type: 'broadcast',
    event: 'new-message',
    payload: messageData
  });
}

/**
 * 게임 액션 기록
 */
async function recordGameAction(
  gameId: string,
  actionType: 'bet' | 'call' | 'die' | 'show' | 'start',
  playerId: string,
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
 * 다음 턴 플레이어 ID 반환
 */
function getNextPlayerTurn(players: Array<any>, currentPlayerId: string): string {
  if (players.length <= 1) {
    return currentPlayerId;
  }
  
  // 다음 플레이어 찾기 (다이 하지 않은 플레이어 중에서)
  const activePlayers = players.filter(p => !p.isDie);
  const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  
  return activePlayers[nextIndex].id;
}

/**
 * 셔플된 카드 덱 생성
 */
function createShuffledDeck(): number[] {
  // 1부터 40까지의 카드 생성 (한국식 포커)
  const deck = Array.from({ length: 40 }, (_, i) => i + 1);
  
  // 덱 셔플 (Fisher-Yates 알고리즘)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
} 