import { supabase } from './supabase';
import { GameState, Player } from '@/types/game';
import { shuffleDeck, nextTurn, determineWinner } from '@/utils/gameLogic';

// 새 게임 생성
export async function createGame(): Promise<string> {
  const { data, error } = await supabase
    .from('games')
    .insert({
      status: 'waiting',
      betting_value: 0,
      current_turn: null
    })
    .select('id')
    .single();

  if (error) {
    console.error('게임 생성 오류:', error);
    throw error;
  }

  return data.id;
}

// 게임 참가
export async function joinGame(gameId: string, userId: string, username: string): Promise<void> {
  // 이미 참가했는지 확인
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();

  if (existingPlayer) {
    console.log('이미 게임에 참가 중입니다.');
    return;
  }

  // 초기 잔액 설정 (10,000)
  const { error } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      user_id: userId,
      username,
      cards: [],
      is_die: false,
      balance: 10000
    });

  if (error) {
    console.error('게임 참가 오류:', error);
    throw error;
  }

  // 게임 참가 액션 기록
  await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: userId,
      action_type: 'join',
      amount: 0
    });
}

// 게임 시작
export async function startGame(gameId: string): Promise<void> {
  // 참가자 목록 가져오기
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, user_id')
    .eq('game_id', gameId);

  if (playersError || !players || players.length < 2) {
    console.error('게임 시작 오류: 참가자가 부족합니다.');
    throw new Error('게임을 시작하려면 최소 2명의 플레이어가 필요합니다.');
  }

  // 카드 덱 섞기
  const deck = shuffleDeck();
  
  // 각 플레이어에게 카드 2장씩 분배
  const playerUpdates = players.map((player, index) => {
    const cards = [deck[index * 2], deck[index * 2 + 1]];
    return {
      id: player.id,
      cards
    };
  });

  // 플레이어 카드 업데이트
  for (const update of playerUpdates) {
    await supabase
      .from('players')
      .update({ cards: update.cards })
      .eq('id', update.id);
  }

  // 게임 상태 업데이트: 첫 번째 플레이어가 시작
  await supabase
    .from('games')
    .update({
      status: 'playing',
      current_turn: players[0].user_id,
      betting_value: 0
    })
    .eq('id', gameId);
}

// 베팅 액션 처리
export async function placeBet(gameId: string, playerId: string, amount: number): Promise<void> {
  // 게임 상태 확인
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_turn, betting_value')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error('베팅 오류: 게임을 찾을 수 없습니다.');
    throw new Error('게임을 찾을 수 없습니다.');
  }

  if (game.current_turn !== playerId) {
    throw new Error('당신의 차례가 아닙니다.');
  }

  // 플레이어 정보 확인
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('balance, is_die')
    .eq('game_id', gameId)
    .eq('user_id', playerId)
    .single();

  if (playerError || !player) {
    console.error('베팅 오류: 플레이어를 찾을 수 없습니다.');
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  if (player.is_die) {
    throw new Error('이미 다이 상태입니다.');
  }

  if (player.balance < amount) {
    throw new Error('잔액이 부족합니다.');
  }

  // 플레이어 잔액 업데이트
  await supabase
    .from('players')
    .update({ balance: player.balance - amount })
    .eq('game_id', gameId)
    .eq('user_id', playerId);

  // 베팅 액션 기록
  await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: playerId,
      action_type: 'bet',
      amount
    });

  // 게임 상태 업데이트
  const newBettingValue = game.betting_value + amount;

  // 다음 턴 계산을 위해 모든 플레이어 정보 가져오기
  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('user_id, is_die')
    .eq('game_id', gameId);

  if (allPlayersError || !allPlayers) {
    console.error('베팅 오류: 플레이어 목록을 가져올 수 없습니다.');
    throw new Error('플레이어 목록을 가져올 수 없습니다.');
  }

  // 다음 턴 계산
  const nextPlayerId = nextTurn(
    playerId,
    allPlayers.map(p => ({ id: p.user_id, isDie: p.is_die }))
  );

  // 게임 상태 업데이트
  await supabase
    .from('games')
    .update({
      betting_value: newBettingValue,
      current_turn: nextPlayerId
    })
    .eq('id', gameId);
}

// 콜 액션 처리
export async function callBet(gameId: string, playerId: string): Promise<void> {
  // 게임 상태 확인
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_turn, betting_value')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error('콜 오류: 게임을 찾을 수 없습니다.');
    throw new Error('게임을 찾을 수 없습니다.');
  }

  if (game.current_turn !== playerId) {
    throw new Error('당신의 차례가 아닙니다.');
  }

  // 마지막 베팅 액션 확인
  const { data: lastBetAction, error: lastBetError } = await supabase
    .from('game_actions')
    .select('amount')
    .eq('game_id', gameId)
    .eq('action_type', 'bet')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastBetError || !lastBetAction) {
    console.error('콜 오류: 마지막 베팅 정보를 찾을 수 없습니다.');
    throw new Error('마지막 베팅 정보를 찾을 수 없습니다.');
  }

  const callAmount = lastBetAction.amount;

  // 플레이어 정보 확인
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('balance, is_die')
    .eq('game_id', gameId)
    .eq('user_id', playerId)
    .single();

  if (playerError || !player) {
    console.error('콜 오류: 플레이어를 찾을 수 없습니다.');
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  if (player.is_die) {
    throw new Error('이미 다이 상태입니다.');
  }

  if (player.balance < callAmount) {
    throw new Error('잔액이 부족합니다.');
  }

  // 플레이어 잔액 업데이트
  await supabase
    .from('players')
    .update({ balance: player.balance - callAmount })
    .eq('game_id', gameId)
    .eq('user_id', playerId);

  // 콜 액션 기록
  await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: playerId,
      action_type: 'call',
      amount: callAmount
    });

  // 게임 상태 업데이트
  const newBettingValue = game.betting_value + callAmount;

  // 다음 턴 계산을 위해 모든 플레이어 정보 가져오기
  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('user_id, is_die, cards')
    .eq('game_id', gameId);

  if (allPlayersError || !allPlayers) {
    console.error('콜 오류: 플레이어 목록을 가져올 수 없습니다.');
    throw new Error('플레이어 목록을 가져올 수 없습니다.');
  }

  // 모든 활동 중인 플레이어가 베팅했는지 확인
  const { data: callCount, error: callCountError } = await supabase
    .from('game_actions')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('action_type', 'call')
    .order('created_at', { ascending: false });

  if (callCountError) {
    console.error('콜 오류: 콜 횟수를 확인할 수 없습니다.');
    throw new Error('콜 횟수를 확인할 수 없습니다.');
  }

  const activePlayers = allPlayers.filter(p => !p.is_die);
  const isGameEnd = callCount && callCount.length >= activePlayers.length - 1;

  if (isGameEnd) {
    // 승자 결정
    const winnerId = determineWinner(
      allPlayers.map(p => ({
        id: p.user_id,
        cards: p.cards,
        isDie: p.is_die
      }))
    );

    // 게임 종료, 승자에게 베팅 금액 지급
    if (winnerId) {
      // 승자 정보 업데이트
      const { data: winner, error: winnerError } = await supabase
        .from('players')
        .select('balance')
        .eq('game_id', gameId)
        .eq('user_id', winnerId)
        .single();

      if (!winnerError && winner) {
        await supabase
          .from('players')
          .update({ balance: winner.balance + newBettingValue })
          .eq('game_id', gameId)
          .eq('user_id', winnerId);
      }

      // 게임 상태 업데이트
      await supabase
        .from('games')
        .update({
          status: 'finished',
          winner: winnerId,
          betting_value: 0
        })
        .eq('id', gameId);
    }
  } else {
    // 게임 계속 진행
    // 다음 턴 계산
    const nextPlayerId = nextTurn(
      playerId,
      allPlayers.map(p => ({ id: p.user_id, isDie: p.is_die }))
    );

    // 게임 상태 업데이트
    await supabase
      .from('games')
      .update({
        betting_value: newBettingValue,
        current_turn: nextPlayerId
      })
      .eq('id', gameId);
  }
}

// 다이 액션 처리
export async function dieBet(gameId: string, playerId: string): Promise<void> {
  // 게임 상태 확인
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_turn, status')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error('다이 오류: 게임을 찾을 수 없습니다.');
    throw new Error('게임을 찾을 수 없습니다.');
  }

  if (game.current_turn !== playerId) {
    throw new Error('당신의 차례가 아닙니다.');
  }

  if (game.status !== 'playing') {
    throw new Error('게임이 진행 중이 아닙니다.');
  }

  // 플레이어 다이 상태로 업데이트
  await supabase
    .from('players')
    .update({ is_die: true })
    .eq('game_id', gameId)
    .eq('user_id', playerId);

  // 다이 액션 기록
  await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: playerId,
      action_type: 'die',
      amount: 0
    });

  // 다음 턴 계산을 위해 모든 플레이어 정보 가져오기
  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('user_id, is_die, cards')
    .eq('game_id', gameId);

  if (allPlayersError || !allPlayers) {
    console.error('다이 오류: 플레이어 목록을 가져올 수 없습니다.');
    throw new Error('플레이어 목록을 가져올 수 없습니다.');
  }

  const activePlayers = allPlayers.filter(p => !p.is_die);

  // 한 명만 남았는지 확인
  if (activePlayers.length === 1) {
    const winnerId = activePlayers[0].user_id;

    // 승자 정보 업데이트
    const { data: winner, error: winnerError } = await supabase
      .from('players')
      .select('balance')
      .eq('game_id', gameId)
      .eq('user_id', winnerId)
      .single();

    if (!winnerError && winner) {
      // 베팅 총액 확인
      const { data: gameInfo, error: gameInfoError } = await supabase
        .from('games')
        .select('betting_value')
        .eq('id', gameId)
        .single();

      if (!gameInfoError && gameInfo) {
        // 승자에게 베팅 금액 지급
        await supabase
          .from('players')
          .update({ balance: winner.balance + gameInfo.betting_value })
          .eq('game_id', gameId)
          .eq('user_id', winnerId);

        // 게임 상태 업데이트
        await supabase
          .from('games')
          .update({
            status: 'finished',
            winner: winnerId,
            betting_value: 0
          })
          .eq('id', gameId);
      }
    }
  } else {
    // 다음 턴 계산
    const nextPlayerId = nextTurn(
      playerId,
      allPlayers.map(p => ({ id: p.user_id, isDie: p.is_die }))
    );

    // 게임 상태 업데이트
    await supabase
      .from('games')
      .update({
        current_turn: nextPlayerId
      })
      .eq('id', gameId);
  }
}

// 게임 상태 조회
export async function getGameState(gameId: string): Promise<GameState> {
  // 게임 정보 조회
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error('게임 상태 조회 오류:', gameError);
    throw new Error('게임을 찾을 수 없습니다.');
  }

  // 플레이어 정보 조회
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error('플레이어 정보 조회 오류:', playersError);
    throw new Error('플레이어 정보를 가져올 수 없습니다.');
  }

  return {
    id: game.id,
    status: game.status,
    currentTurn: game.current_turn,
    bettingValue: game.betting_value,
    winner: game.winner,
    players: players.map((p): Player => ({
      id: p.user_id,
      username: p.username,
      cards: p.cards,
      isDie: p.is_die,
      balance: p.balance
    }))
  };
}

// 채팅 메시지 전송
export async function sendMessage(gameId: string, userId: string, username: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({
      game_id: gameId,
      user_id: userId,
      username,
      content
    });

  if (error) {
    console.error('메시지 전송 오류:', error);
    throw error;
  }
} 