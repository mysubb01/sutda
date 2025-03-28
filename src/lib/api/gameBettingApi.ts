import { supabase } from '../supabaseClient';
import { handleDatabaseError, handleGameError, handleResourceNotFoundError, ErrorType } from '../utils/errorHandlers';
import { BetActionType, Player } from '@/types/game';
import { getNextPlayerTurn, handleBettingTimeout } from './gameActionApi';
import { logBettingAction, logSystemError, logInfo } from '../logService';

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
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('베팅 중 오류:', errorMsg);
    throw error;
  }
}

/**
 * 모든 플레이어가 동일한 금액을 배팅했는지 확인
 */
export async function checkAllPlayersMatchedBet(gameId: string, players: Player[]): Promise<boolean> {
  // 프론트엔드 호환성을 위해 is_die 사용
  const activePlayers = players.filter(p => !p.is_die);
  
  if (activePlayers.length <= 1) {
    return true; // 한 명만 남으면 자동으로 매치됨
  }
  
  // 폴드하지 않은 플레이어 중 최대 베팅액
  const maxBet = Math.max(...activePlayers.map(p => p.current_bet || 0));
  
  // 모든 활성 플레이어가 최대 베팅액과 동일한지 확인
  const allMatched = activePlayers.every(p => p.current_bet === maxBet);
  
  // 모든 활성 플레이어가 액션을 취했는지 확인
  // has_acted 필드는 DB에 추가됨
  const allActed = activePlayers.every(p => p.has_acted);
  
  return allMatched && allActed;
}

/**
 * 베팅 라운드 종료 및 시작
 */
export async function finishBettingRound(gameId: string): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 현재 플레이어 정보
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId);
    
    if (playersError) {
      throw handleDatabaseError(playersError, 'finishBettingRound: players');
    }
    
    // 활성 플레이어 수 확인
    const activePlayers = players.filter(p => !p.is_die);
    
    if (activePlayers.length <= 1) {
      // 한 명만 남았으면 게임 종료
      await logBettingAction(gameId, 'system', 'end_round', {
        message: '한 명만 남아 게임을 종료합니다.',
        nextPlayer: null
      });
      return;
    }
    
    const gameMode = game.rooms.mode;
    const currentRound = game.betting_round || 1;
    
    if (gameMode === 2) {
      // 2장 모드인 경우 라운드는 1개이므로 게임 종료
      await logBettingAction(gameId, 'system', 'end_round', {
        message: '베팅 라운드 종료, 게임 결과를 계산합니다.',
        round: currentRound,
        nextPlayer: null
      });
      return;
    }
    
    // 3장 모드인 경우 라운드 처리
    if (currentRound === 1) {
      // 1라운드 종료, 2라운드 시작
      await startRound2(gameId, players);
    } else if (currentRound === 2) {
      // 2라운드 종료, 게임 종료
      await logBettingAction(gameId, 'system', 'end_round', {
        message: '2라운드 베팅 종료, 게임 결과를 계산합니다.',
        round: currentRound,
        nextPlayer: null
      });
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('베팅 라운드 종료 처리 중 오류:', errorMsg);
    await logSystemError(gameId, 'finishBettingRound', error);
    throw error;
  }
}

/**
 * 3장 모드에서 2라운드 시작
 */
async function startRound2(gameId: string, players: Player[]): Promise<void> {
  try {
    // 활성 플레이어 확인
    const activePlayers = players.filter(p => !p.is_die);
    
    if (activePlayers.length <= 1) {
      return; // 한 명만 남았으면 처리 안함
    }
    
    // 카드 선택 시간 설정
    const cardSelectionTime = new Date();
    cardSelectionTime.setSeconds(cardSelectionTime.getSeconds() + 20); // 20초 시간 제한
    
    // 새출된 betting_end_time 필드도 설정
    const bettingEndTime = new Date();
    bettingEndTime.setSeconds(bettingEndTime.getSeconds() + 30); // 30초 베팅 제한 시간
    
    // 게임 상태 업데이트
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        betting_round: 2,
        card_selection_time: cardSelectionTime.toISOString(),
        betting_end_time: bettingEndTime.toISOString() // 추가된 필드
      })
      .eq('id', gameId);
    
    if (updateGameError) {
      throw handleDatabaseError(updateGameError, 'startRound2: game update');
    }
    
    // 플레이어 상태 초기화
    for (const player of activePlayers) {
      await supabase
        .from('players')
        .update({
          has_acted: false,
          last_action: null,
          last_action_time: null,
          // 새로 추가된 필드들 초기화
          last_heartbeat: new Date().toISOString()
        })
        .eq('id', player.id);
    }
    
    // 로그 기록
    await logBettingAction(gameId, 'system', 'start_round', {
      message: '2라운드 시작: 각 플레이어는 사용할 최종 2장의 카드를 선택해주세요.',
      round: 2,
      activePlayers: activePlayers.length
    });
    
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('2라운드 시작 중 오류:', errorMsg);
    await logSystemError(gameId, 'startRound2', error);
    throw error;
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
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 게임 진행 중인지 확인
    if (game.status !== 'playing') {
      throw handleGameError(
        new Error('게임이 진행 중이 아닙니다'),
        ErrorType.INVALID_STATE,
        '베팅은 게임이 진행 중일 때만 가능합니다'
      );
    }
    
    // 현재 플레이어 턴인지 확인
    if (game.current_turn !== playerId) {
      console.log(`[betAction] 현재 턴 오류: 현재 턴=${game.current_turn}, 플레이어=${playerId}`);
      throw handleGameError(
        new Error('현재 턴이 아닙니다'),
        ErrorType.UNAUTHORIZED,
        '당신의 턴이 아닙니다'
      );
    }
    
    // 플레이어 정보 조회
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();
    
    if (playerError || !currentPlayer) {
      throw handleResourceNotFoundError('player', playerId, playerError);
    }
    
    // 이미 다이한 플레이어인지 확인
    if (currentPlayer.is_die) {
      throw handleGameError(
        new Error('이미 폴드한 플레이어입니다'),
        ErrorType.INVALID_STATE,
        '이미 폴드했습니다'
      );
    }
    
    // 모든 플레이어 정보 조회
    const { data: allPlayers, error: allPlayersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId);
    
    if (allPlayersError) {
      throw handleDatabaseError(allPlayersError, 'betAction: all players');
    }
    
    // 현재 최대 베팅액 계산
    const maxBet = Math.max(...allPlayers.map(p => p.current_bet || 0));
    
    // 베팅 액션 처리
    let betAmount = 0;
    let newBalance = currentPlayer.balance;
    let actionDescription = '';
    
    console.log(`[베팅액션] 처리중: 게임 ${gameId}, 플레이어 ${playerId}, 액션 ${action}, 금액 ${amount}`);

    switch (action) {
      case 'check':
        // 체크는 이전에 베팅이 없을 때만 가능
        if (maxBet > currentPlayer.current_bet) {
          throw handleGameError(
            new Error('체크할 수 없습니다'),
            ErrorType.INVALID_STATE,
            '이전 베팅이 있어 체크할 수 없습니다'
          );
        }
        actionDescription = '체크';
        break;
        
      case 'call':
        // 콜은 이전 베팅액과 맞추기
        betAmount = maxBet - (currentPlayer.current_bet || 0);
        
        if (betAmount <= 0) {
          throw handleGameError(
            new Error('콜할 수 없습니다'),
            ErrorType.INVALID_STATE,
            '이미 최대 베팅액과 동일합니다'
          );
        }
        
        if (betAmount > currentPlayer.balance) {
          // 잔액이 부족하면 올인
          betAmount = currentPlayer.balance;
        }
        
        newBalance = currentPlayer.balance - betAmount;
        actionDescription = `콜: ${betAmount}`;
        break;

      // 추가: 기본 베팅 처리
      case 'bet':
        // 기본 베팅 (amount가 없으면 기본 베팅액 사용)
        betAmount = amount || game.base_bet || 100;
        
        if (betAmount <= 0) {
          throw handleGameError(
            new Error('유효하지 않은 베팅 금액'),
            ErrorType.VALIDATION,
            '베팅 금액은 0보다 커야 합니다'
          );
        }
        
        if (betAmount > currentPlayer.balance) {
          throw handleGameError(
            new Error('잔액이 부족합니다'),
            ErrorType.VALIDATION,
            '잔액이 부족합니다'
          );
        }
        
        newBalance = currentPlayer.balance - betAmount;
        actionDescription = `베팅: ${betAmount}`;
        break;

      // 추가: 하프 (현재 팟의 하프)
      case 'half':
        // 하프 베팅 (현재 팟의 절반)
        const halfAmount = Math.floor((game.total_pot || 0) / 2);
        betAmount = halfAmount > 0 ? halfAmount : (game.base_bet || 100);
        
        if (betAmount <= 0) {
          throw handleGameError(
            new Error('유효하지 않은 하프 금액'),
            ErrorType.VALIDATION,
            '하프 금액이 계산되지 않았습니다'
          );
        }
        
        if (betAmount > currentPlayer.balance) {
          // 잔액이 부족하면 올인
          betAmount = currentPlayer.balance;
        }
        
        newBalance = currentPlayer.balance - betAmount;
        actionDescription = `하프: ${betAmount}`;
        break;

      // 추가: 1/4 베팅
      case 'quarter':
        // 1/4 베팅 (현재 팟의 1/4)
        const quarterAmount = Math.floor((game.total_pot || 0) / 4);
        betAmount = quarterAmount > 0 ? quarterAmount : (game.base_bet || 100);
        
        if (betAmount <= 0) {
          throw handleGameError(
            new Error('유효하지 않은 쿼터 금액'),
            ErrorType.VALIDATION,
            '쿼터 금액이 계산되지 않았습니다'
          );
        }
        
        if (betAmount > currentPlayer.balance) {
          // 잔액이 부족하면 올인
          betAmount = currentPlayer.balance;
        }
        
        newBalance = currentPlayer.balance - betAmount;
        actionDescription = `쿼터: ${betAmount}`;
        break;
        
      case 'raise':
        // 레이즈는 이전 베팅액보다 더 많이 베팅
        if (!amount || amount <= 0) {
          throw handleGameError(
            new Error('유효하지 않은 레이즈 금액'),
            ErrorType.VALIDATION,
            '레이즈 금액은 0보다 커야 합니다'
          );
        }
        
        // 최소 레이즈 = 현재 최대 베팅액 + 게임 기본 베팅액
        const minRaiseAmount = maxBet + game.base_bet;
        
        // 최종 베팅액 계산
        const finalBetAmount = amount;
        
        if (finalBetAmount <= maxBet) {
          throw handleGameError(
            new Error('레이즈 금액이 충분하지 않습니다'),
            ErrorType.VALIDATION,
            `레이즈 금액은 최소 ${minRaiseAmount}이어야 합니다`
          );
        }
        
        // 현재 플레이어가 이미 베팅한 금액 제외
        betAmount = finalBetAmount - (currentPlayer.current_bet || 0);
        
        if (betAmount > currentPlayer.balance) {
          throw handleGameError(
            new Error('잔액이 부족합니다'),
            ErrorType.VALIDATION,
            '잔액이 부족합니다'
          );
        }
        
        newBalance = currentPlayer.balance - betAmount;
        actionDescription = `레이즈: ${betAmount} (총 ${finalBetAmount})`;
        break;

      // 테이블/DB 호환성을 위해 fold 와 die 를 둘 다 지원
      case 'fold':
        // 폴드/다이는 베팅 없이 게임에서 빠지기
        actionDescription = '폴드';
        break;
        
      default:
        console.error(`지원되지 않는 베팅 액션: ${action}`)
        throw handleGameError(
          new Error(`유효하지 않은 베팅 액션: ${action}`),
          ErrorType.VALIDATION,
          '유효하지 않은 베팅 액션입니다'
        );
    }
    
    // 플레이어 상태 업데이트
    const playerUpdate: any = {
      has_acted: true,
      last_action: action,
      last_action_time: new Date().toISOString(),
      last_heartbeat: new Date().toISOString() // 추가된 필드
    };
    
    // 폴드가 아닌 경우 베팅액과 잔액 업데이트
    if (action === 'fold') { 
      // 폴드 액션 처리
      playerUpdate.is_die = true; // is_die로 설정
    } else { 
      // 다른 베팅 액션들 처리 (체크, 콜, 레이즈, 베팅, 하프, 쿼터)
      // 체크는 예외적으로 현재 베팅을 유지
      if (action === 'check') {
        playerUpdate.current_bet = currentPlayer.current_bet || 0;
      } else {
        // 나머지 액션은 베팅액 및 잔액 업데이트
        playerUpdate.current_bet = Math.max(maxBet, amount);
        playerUpdate.balance = newBalance;
      }
    }
    
    const { error: updatePlayerError } = await supabase
      .from('players')
      .update(playerUpdate)
      .eq('id', playerId);
    
    if (updatePlayerError) {
      throw handleDatabaseError(updatePlayerError, 'betAction: player update');
    }
    
    // 게임 상태 업데이트
    interface GameUpdate {
      total_pot?: number;
      betting_value?: number;
      current_turn?: string; // current_turn으로 통합
      last_action?: string;
      updated_at?: string;
      betting_end_time?: string; // 추가된 필드
    }
    
    const gameUpdate: GameUpdate = {};
    
    // 베팅 액션이면 총 팟 업데이트
    if (action !== 'check' && action !== 'fold') {
      gameUpdate.total_pot = game.total_pot + betAmount;
      gameUpdate.betting_value = Math.max(game.betting_value, playerUpdate.current_bet);
      
      // 베팅 종료 시간 업데이트
      const bettingEndTime = new Date();
      bettingEndTime.setSeconds(bettingEndTime.getSeconds() + 30); // 30초 제한시간
      gameUpdate.betting_end_time = bettingEndTime.toISOString();
    }
    
    // 다음 플레이어 결정
    const nextPlayerId = await getNextPlayerTurn(gameId, playerId);
    console.log(`[betAction] 다음 플레이어 결정: ${nextPlayerId || '없음'}`);
    gameUpdate.current_turn = nextPlayerId || undefined;  // current_turn 사용
    gameUpdate.last_action = `${currentPlayer.username} ${actionDescription}`;
    gameUpdate.updated_at = new Date().toISOString();
    
    const { error: updateGameError } = await supabase
      .from('games')
      .update(gameUpdate)
      .eq('id', gameId);
    
    if (updateGameError) {
      throw handleDatabaseError(updateGameError, 'betAction: game update');
    }
    
    // 게임 액션 기록
    const { error: actionError } = await supabase.from('game_actions').insert([
      {
        game_id: gameId,
        player_id: playerId,
        // player_name 필드 제거 - 데이터베이스에 해당 컬럼이 없음
        action_type: action,
        amount: betAmount,
        betting_round: game.betting_round || 1,
        created_at: new Date().toISOString() // timestamp -> created_at
      }
    ]);
    
    if (actionError) {
      throw handleDatabaseError(actionError, 'betAction: action record');
    }
    
    // 베팅 액션 로그 기록
    await logBettingAction(gameId, playerId, action, {
      amount: betAmount,
      totalBet: playerUpdate.current_bet,
      balance: newBalance, // 프론트엔드와 호환성 위해 balance 사용
      nextPlayer: nextPlayerId
    });
    
    // 액션 후 라운드 완료 확인
    const updatedPlayers = [...allPlayers];
    const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        ...playerUpdate
      };
    }
    
    const allMatched = await checkAllPlayersMatchedBet(gameId, updatedPlayers);
    const activePlayers = updatedPlayers.filter(p => !p.is_die);
    
    if (allMatched || activePlayers.length <= 1) {
      await finishBettingRound(gameId);
    }
    
  } catch (error: any) {
    console.error(`베팅 액션 처리 중 오류 (${action}):`, error);
    await logSystemError(gameId, `betAction:${action}`, error);
    throw error;
  }
}

// gameBettingApi.ts에서는 중앙화된 gameActionApi의 handleBettingTimeout 함수를 사용합니다.
// 함수 구현을 이 파일에서는 삭제하고 가져오기만 합니다.

// gameActionApi의 handleBettingTimeout 함수를 재내보내기
export { handleBettingTimeout };
