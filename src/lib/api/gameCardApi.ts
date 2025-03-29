import { supabase } from '../supabaseClient';
import { handleDatabaseError, handleGameError, handleResourceNotFoundError, ErrorType } from '../utils/errorHandlers';
import { logCardAction, logSystemError, logInfo } from '../logService';
import { findBestCombination } from '../../utils/gameLogic';

/**
 * 3장 모드에서 최종 카드 선택
 */
export async function selectFinalCards(
  gameId: string,
  playerId: string,
  selectedCards: number[]
): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status, game_mode, betting_round')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 게임 상태 검증
    if (game.status !== 'playing') {
      throw handleGameError(
        new Error('게임이 진행 중이 아닙니다'),
        ErrorType.INVALID_STATE,
        '카드는 게임이 진행 중일 때만 선택할 수 있습니다'
      );
    }
    
    // 3장 모드인지 확인
    if (game.game_mode !== 3) {
      throw handleGameError(
        new Error('3장 모드가 아닙니다'),
        ErrorType.INVALID_STATE,
        '카드 선택은 3장 모드에서만 가능합니다'
      );
    }
    
    // 베팅 라운드가 2라운드인지 확인
    if (game.betting_round !== 2) {
      throw handleGameError(
        new Error('카드 선택 단계가 아닙니다'),
        ErrorType.INVALID_STATE,
        '지금은 카드 선택 단계가 아닙니다'
      );
    }
    
    // 플레이어 정보 조회
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('username, cards, reserved_card, is_die')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();
    
    if (playerError || !player) {
      throw handleResourceNotFoundError('player', playerId, playerError);
    }
    
    // 이미 폴드한 경우
    if (player.is_die) {
      throw handleGameError(
        new Error('이미 폴드했습니다'),
        ErrorType.INVALID_STATE,
        '폴드한 플레이어는 카드를 선택할 수 없습니다'
      );
    }
    
    // 선택 가능한 카드 확인
    const allCards = [...player.cards];
    if (player.reserved_card !== null) {
      allCards.push(player.reserved_card);
    }
    
    if (allCards.length < 3) {
      throw handleGameError(
        new Error('선택 가능한 카드가 부족합니다'),
        ErrorType.INVALID_STATE,
        '3장의 카드가 모두 있어야 선택할 수 있습니다'
      );
    }
    
    // 선택한 카드 검증
    if (selectedCards.length < 2 || selectedCards.length > 3) {
      throw handleGameError(
        new Error('선택한 카드 수가 잘못되었습니다'),
        ErrorType.VALIDATION,
        '2장 또는 3장의 카드를 선택해야 합니다'
      );
    }
    
    // 선택한 카드가 플레이어가 가진 카드 중에 있는지 확인
    const allValid = selectedCards.every(card => allCards.includes(card));
    
    if (!allValid) {
      throw handleGameError(
        new Error('선택한 카드가 유효하지 않습니다'),
        ErrorType.VALIDATION,
        '선택한 카드 중 일부가 플레이어의 카드가 아닙니다'
      );
    }
    
    // 카드 업데이트
    const { error: updateError } = await supabase
      .from('players')
      .update({
        cards: selectedCards,
        reserved_card: null,
        has_acted: true,
        last_action: 'select_cards',
        last_action_time: new Date().toISOString()
      })
      .eq('id', playerId)
      .eq('game_id', gameId);
    
    if (updateError) {
      throw handleDatabaseError(updateError, 'selectFinalCards: player update');
    }
    
    // 로그 기록
    await logInfo(
      gameId,
      'cards',
      `카드 액션: ${playerId}의 select_cards`,
      playerId,
      { action: 'select_cards', selectedCards, allCards }
    );
    
    // 모든 플레이어가 카드를 선택했는지 확인
    const { data: allPlayers, error: allPlayersError } = await supabase
      .from('players')
      .select('id, has_acted, is_die')
      .eq('game_id', gameId);
    
    if (allPlayersError) {
      throw handleDatabaseError(allPlayersError, 'selectFinalCards: check all players');
    }
    
    const activePlayers = allPlayers.filter(p => !p.is_die);
    const allActed = activePlayers.every(p => p.has_acted);
    
    if (allActed) {
      // 모든 플레이어가 카드를 선택했으면 게임 종료 준비
      await prepareGameEnd(gameId);
    }
    
  } catch (error: any) {
    console.error('카드 선택 중 오류:', error);
    await logSystemError(gameId, 'selectFinalCards', error);
    throw error;
  }
}

/**
 * 카드 선택 시간이 종료되면 자동으로 최적 카드 선택
 */
export async function autoSelectFinalCards(gameId: string): Promise<void> {
  try {
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('status, game_mode, betting_round, card_selection_time')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      throw handleResourceNotFoundError('game', gameId, gameError);
    }
    
    // 게임 상태 검증
    if (game.status !== 'playing' || game.game_mode !== 3 || game.betting_round !== 2) {
      console.log(`[autoSelectFinalCards] 카드 선택 단계가 아님: ${gameId}, 상태: ${game.status}, 모드: ${game.game_mode}, 라운드: ${game.betting_round}`);
      return;
    }
    
    // 카드 선택 시간이 지났는지 확인
    const selectionTime = new Date(game.card_selection_time);
    const currentTime = new Date();
    
    if (currentTime < selectionTime) {
      console.log(`[autoSelectFinalCards] 카드 선택 시간이 아직 안 지남: ${gameId}`);
      return;
    }
    
    // 카드를 선택하지 않은 활성 플레이어 조회
    const { data: unselectedPlayers, error: playerError } = await supabase
      .from('players')
      .select('id, username, cards, reserved_card, is_die, has_acted')
      .eq('game_id', gameId)
      .eq('has_acted', false)
      .eq('is_die', false);
    
    if (playerError) {
      throw handleDatabaseError(playerError, 'autoSelectFinalCards: players');
    }
    
    if (unselectedPlayers.length === 0) {
      // 모든 플레이어가 이미 카드를 선택했으면 종료
      console.log(`[autoSelectFinalCards] 모든 플레이어가 이미 카드 선택함: ${gameId}`);
      return;
    }
    
    // 각 플레이어에 대해 최적의 카드 조합 선택
    for (const player of unselectedPlayers) {
      const allCards = [...player.cards];
      if (player.reserved_card !== null) {
        allCards.push(player.reserved_card);
      }
      
      if (allCards.length < 3) {
        console.warn(`[autoSelectFinalCards] 플레이어 ${player.id}의 카드가 부족함: ${allCards.length}`);
        continue;
      }
      
      // 최적 조합 찾기
      const bestCombination = findBestCombination(allCards);
      
      // 카드 업데이트
      await supabase
        .from('players')
        .update({
          cards: bestCombination,
          reserved_card: null,
          has_acted: true,
          last_action: 'auto_select_cards',
          last_action_time: new Date().toISOString()
        })
        .eq('id', player.id);
      
      // 로그 기록
      await logInfo(
        gameId,
        'cards', 
        `카드 액션: ${player.id}의 auto_select_cards`, 
        player.id, 
        { 
          action: 'auto_select_cards',
          selectedCards: bestCombination,
          allCards: allCards,
          auto: true
        }
      );
      
      console.log(`[autoSelectFinalCards] 플레이어 ${player.username}의 카드 자동 선택: ${bestCombination}`);
    }
    
    // 게임 종료 준비
    await prepareGameEnd(gameId);
    
  } catch (error: any) {
    console.error('자동 카드 선택 중 오류:', error);
    await logSystemError(gameId, 'autoSelectFinalCards', error);
  }
}

/**
 * 모든 플레이어가 카드를 선택한 후 게임 종료 준비
 */
async function prepareGameEnd(gameId: string): Promise<void> {
  try {
    // 플레이어 액션 초기화
    await supabase
      .from('players')
      .update({
        has_acted: false
      })
      .eq('game_id', gameId);
    
    // 게임 종료 준비 상태로 업데이트
    await supabase
      .from('games')
      .update({
        show_cards: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);
    
    // 로그 기록
    await logInfo(
      gameId,
      'system', // category
      '게임 종료 준비 완료', // message
      'system', // playerId
      { action: 'prepare_end' } // metadata
    );

  } catch (error: any) {
    console.error('게임 종료 준비 중 오류:', error);
    await logSystemError(gameId, 'prepareGameEnd', error);
    throw error;
  }
}
