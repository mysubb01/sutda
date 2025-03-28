import { supabase } from "../supabaseClient";
import {
  handleDatabaseError,
  handleGameError,
  ErrorType,
} from "../utils/errorHandlers";
import { GameState } from "@/types/game";

/**
 * 배팅 관련 액션 타입
 */
export enum BettingAction {
  CALL = "call",
  RAISE = "raise",
  CHECK = "check",
  FOLD = "fold",
  ALLIN = "allin",
}

/**
 * 배팅 트랜잭션 인터페이스
 */
export interface BettingTransaction {
  id: string;
  gameId: string; // DB: game_id (UUID)
  playerId: string; // DB: player_id (UUID)
  action: BettingAction; // DB: action (enum)
  amount: number; // DB: amount (integer)
  timestamp: string; // DB: created_at (timestamp)
  round: number; // DB: betting_round (integer)
}

/**
 * 배팅 처리 결과 인터페이스
 */
export interface BettingResult {
  success: boolean;
  updatedGameState?: GameState;
  error?: string;
  nextPlayerId?: string;
}

/**
 * 플레이어 배팅 처리
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @param action 배팅 액션 (call, raise, check, fold, allin)
 * @param amount 배팅 금액
 * @returns 배팅 처리 결과
 */
export async function processBetting(
  gameId: string,
  playerId: string,
  action: BettingAction,
  amount: number = 0
): Promise<BettingResult> {
  try {
    console.log(
      `[processBetting] Player ${playerId} in game ${gameId} is taking action: ${action} with amount: ${amount}`
    );

    // 게임 상태 조회
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*, room:rooms(*)")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 상태 조회 실패");
    }

    if (!gameData) {
      throw handleGameError(
        null,
        ErrorType.NOT_FOUND,
        "게임을 찾을 수 없습니다"
      );
    }

    // 현재 플레이어가 유효한지 확인
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .eq("game_id", gameId)
      .single();

    if (playerError) {
      throw handleDatabaseError(playerError, "플레이어 정보 조회 실패");
    }

    if (!playerData) {
      throw handleGameError(
        null,
        ErrorType.NOT_FOUND,
        "플레이어를 찾을 수 없습니다"
      );
    }

    // 현재 턴이 요청한 플레이어의 턴인지 확인
    // DB 스키마 업데이트: current_player_id가 current_turn으로 통합됨
    if (gameData.current_turn !== playerId) {
      throw handleGameError(
        null,
        ErrorType.INVALID_STATE,
        "현재 당신의 턴이 아닙니다"
      );
    }

    // 액션별 유효성 검사 및 처리
    let updatedPlayerChips = playerData.chips;
    let updatedPot = gameData.pot || 0;
    let nextAction = "";

    switch (action) {
      case BettingAction.CALL:
        // 콜 처리
        if (gameData.current_bet_amount <= 0) {
          throw handleGameError(
            null,
            ErrorType.INVALID_STATE,
            "현재 베팅이 없을 때는 콜할 수 없습니다. 체크를 사용하세요."
          );
        }
        
        // 현재 플레이어의 베팅액이 최대 베팅액과 같은 경우
        if (playerData.current_bet >= gameData.current_bet_amount) {
          throw handleGameError(
            null,
            ErrorType.INVALID_STATE,
            "이미 최대 베팅액과 동일합니다. 체크를 사용하세요."
          );
        }
        
        const callAmount = Math.min(
          gameData.current_bet_amount - playerData.current_bet,
          playerData.chips
        );
        updatedPlayerChips -= callAmount;
        updatedPot += callAmount;
        nextAction = "called";
        break;

      case BettingAction.RAISE:
        // 레이즈 처리
        if (amount <= gameData.current_bet_amount) {
          throw handleGameError(
            null,
            ErrorType.VALIDATION,
            "레이즈 금액은 현재 배팅보다 커야 합니다"
          );
        }

        if (amount > playerData.chips) {
          throw handleGameError(
            null,
            ErrorType.VALIDATION,
            "보유 칩보다 더 많이 배팅할 수 없습니다"
          );
        }

        updatedPlayerChips -= amount;
        updatedPot += amount;
        nextAction = "raised";
        break;

      case BettingAction.CHECK:
        // 체크 처리
        if (gameData.current_bet_amount > 0 && playerData.current_bet < gameData.current_bet_amount) {
          throw handleGameError(
            null,
            ErrorType.INVALID_STATE,
            "현재 베팅이 있을 때는 체크할 수 없습니다. 콜이나 레이즈를 사용하세요."
          );
        }
        nextAction = "checked";
        break;

      case BettingAction.FOLD:
        // 폴드 처리
        nextAction = "is_die";
        break;

      case BettingAction.ALLIN:
        // 올인 처리
        const allinAmount = playerData.chips;
        updatedPlayerChips = 0;
        updatedPot += allinAmount;
        nextAction = "went all-in";
        break;

      default:
        throw handleGameError(
          null,
          ErrorType.VALIDATION,
          "유효하지 않은 배팅 액션입니다"
        );
    }

    // 게임 액션 기록
    const { error: actionError } = await supabase.from("game_actions").insert([
      {
        game_id: gameId,
        player_id: playerId, // UUID 형식 사용
        player_name: playerData.username, // 별도로 플레이어 이름 저장
        action_type: action,
        amount: action === BettingAction.ALLIN ? playerData.balance : amount, // 프론트엔드에서 사용하는 balance 사용
        betting_round: gameData.betting_round || 1,
        created_at: new Date().toISOString() // timestamp 대신 created_at 사용
      },
    ]);

    if (actionError) {
      throw handleDatabaseError(actionError, "게임 액션 기록 실패");
    }

    // 플레이어 칩 업데이트
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({
        chips: updatedPlayerChips,
        current_bet:
          action === BettingAction.RAISE
            ? amount
            : action === BettingAction.CALL
            ? gameData.current_bet_amount
            : playerData.current_bet,
        last_action: action,
        last_action_time: new Date().toISOString(),
      })
      .eq("id", playerId);

    if (updatePlayerError) {
      throw handleDatabaseError(
        updatePlayerError,
        "플레이어 정보 업데이트 실패"
      );
    }

    // 다음 플레이어 결정
    const nextPlayerId = await getNextPlayerTurn(gameId, playerId);

    // 게임 상태 업데이트
    const { data: updatedGame, error: updateGameError } = await supabase
      .from("games")
      .update({
        pot: updatedPot,
        current_turn: nextPlayerId,
        current_bet_amount:
          action === BettingAction.RAISE ? amount : gameData.current_bet_amount,
        last_action: `${playerData.username} ${nextAction} ${
          amount > 0 ? amount + " chips" : ""
        }`,
      })
      .eq("id", gameId)
      .select("*, room:rooms(*)")
      .single();

    if (updateGameError) {
      throw handleDatabaseError(updateGameError, "게임 상태 업데이트 실패");
    }

    // 게임 라운드 체크 및 필요시 업데이트
    await checkRoundCompletion(gameId);

    return {
      success: true,
      updatedGameState: transformGameState(updatedGame),
      nextPlayerId,
    };
  } catch (error: any) {
    console.error("[processBetting] Error:", error);
    return {
      success: false,
      error: error.message || "배팅 처리 중 오류가 발생했습니다",
    };
  }
}

/**
 * 다음 플레이어 턴 결정
 * @param gameId 게임 ID
 * @param currentPlayerId 현재 플레이어 ID
 * @returns 다음 플레이어 ID
 */
export async function getNextPlayerTurn(
  gameId: string,
  currentPlayerId: string
): Promise<string> {
  try {
    // 현재 게임의 활성 플레이어 목록 조회
    const { data: players, error } = await supabase
      .from("players")
      .select("id, seat_index, is_die, chips")
      .eq("game_id", gameId)
      .eq("is_playing", true)
      .order("seat_index", { ascending: true });

    if (error) {
      throw handleDatabaseError(error, "플레이어 목록 조회 실패");
    }

    if (!players || players.length === 0) {
      throw handleGameError(
        null,
        ErrorType.INVALID_STATE,
        "활성 플레이어가 없습니다"
      );
    }

    // 폴드하지 않고 칩이 있는 플레이어만 필터링
    const activePlayers = players.filter((p) => !p.is_die && p.chips > 0);

    if (activePlayers.length <= 1) {
      // 활성 플레이어가 1명 이하면 게임 종료 처리 필요
      // 여기서는 단순히 현재 플레이어를 반환
      return currentPlayerId;
    }

    // 현재 플레이어의 인덱스 찾기
    const currentIndex = activePlayers.findIndex(
      (p) => p.id === currentPlayerId
    );

    if (currentIndex === -1) {
      // 현재 플레이어가 활성 목록에 없으면 첫 번째 활성 플레이어 반환
      return activePlayers[0].id;
    }

    // 다음 플레이어 계산 (순환)
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    return activePlayers[nextIndex].id;
  } catch (error: any) {
    console.error("[getNextPlayerTurn] Error:", error);
    // 오류 발생 시 현재 플레이어 유지
    return currentPlayerId;
  }
}

/**
 * 라운드 완료 여부 확인 및 처리
 * @param gameId 게임 ID
 */
export async function checkRoundCompletion(gameId: string): Promise<void> {
  try {
    // 게임 상태 조회
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 상태 조회 실패");
    }

    // 플레이어 배팅 상태 조회
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, current_bet, is_die, chips")
      .eq("game_id", gameId)
      .eq("is_playing", true);

    if (playersError) {
      throw handleDatabaseError(playersError, "플레이어 정보 조회 실패");
    }

    // 활성 플레이어 (폴드하지 않은 플레이어)
    const activePlayers = players.filter((p) => !p.is_die);

    // 모든 플레이어가 폴드했거나 한 명만 남은 경우 게임 종료
    if (activePlayers.length <= 1) {
      await endRound(gameId);
      return;
    }

    // 칩이 있는 활성 플레이어
    const playersWithChips = activePlayers.filter((p) => p.chips > 0);

    // 모든 플레이어의 배팅 금액이 같은지 확인
    const currentBet = game.current_bet_amount;
    const allPlayersMatchBet = playersWithChips.every(
      (p) => p.current_bet === currentBet || p.chips === 0 // 올인한 플레이어는 예외
    );

    // 모든 플레이어가 같은 금액을 배팅했다면 라운드 종료
    if (allPlayersMatchBet) {
      await endRound(gameId);
    }
  } catch (error) {
    console.error("[checkRoundCompletion] Error:", error);
  }
}

/**
 * 라운드 종료 및 승자 결정
 * @param gameId 게임 ID
 */
export async function endRound(gameId: string): Promise<void> {
  try {
    console.log(`[endRound] Ending round for game ${gameId}`);

    // 게임 상태 조회
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 상태 조회 실패");
    }

    // 활성 플레이어 조회
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, username, cards, is_die, chips")
      .eq("game_id", gameId)
      .eq("is_playing", true);

    if (playersError) {
      throw handleDatabaseError(playersError, "플레이어 정보 조회 실패");
    }

    // 폴드하지 않은 플레이어만 필터링
    const activePlayers = players.filter((p) => !p.is_die);

    // 승자 결정
    let winnerId: string | null = null;
    let winnerUsername: string = "";

    if (activePlayers.length === 1) {
      // 한 명만 남았으면 자동 승리
      winnerId = activePlayers[0].id;
      winnerUsername = activePlayers[0].username;
    } else if (activePlayers.length > 1) {
      // 여러 명이 남았으면 카드 비교
      let highestScore = -1;

      for (const player of activePlayers) {
        if (!player.cards || player.cards.length !== 2) continue;

        // 카드 점수 계산
        const score = calculateCardScore(player.cards);

        if (score > highestScore) {
          highestScore = score;
          winnerId = player.id;
          winnerUsername = player.username;
        }
      }
    }

    // 승자에게 팟 분배
    if (winnerId) {
      console.log(
        `[endRound] Winner is ${winnerUsername} (${winnerId}) - awarding pot: ${game.pot}`
      );

      const { error: updateWinnerError } = await supabase
        .from("players")
        .update({
          chips: supabase.rpc("increment", { x: game.pot }),
          wins: supabase.rpc("increment", { x: 1 }),
        })
        .eq("id", winnerId);

      if (updateWinnerError) {
        throw handleDatabaseError(updateWinnerError, "승자 업데이트 실패");
      }
    }

    // 게임 상태 업데이트
    const newRound = (game.round || 1) + 1;
    // 한 명만 남았을 때는 게임을 완전히 종료 상태로 설정
    const isGameFinished = activePlayers.length === 1;
    
    const { error: updateGameError } = await supabase
      .from("games")
      .update({
        pot: 0,
        round: newRound,
        current_bet_amount: 0,
        last_action: winnerId
          ? `${winnerUsername} won the pot (${game.pot} chips)`
          : "Round ended",
        last_winner_id: winnerId,
        status: isGameFinished ? 'finished' : game.status,
        winner: isGameFinished ? winnerId : null
      })
      .eq("id", gameId);

    if (updateGameError) {
      throw handleDatabaseError(updateGameError, "게임 상태 업데이트 실패");
    }

    // 플레이어 상태 초기화
    const { error: resetPlayersError } = await supabase
      .from("players")
      .update({
        current_bet: 0,
        last_action: null,
      })
      .eq("game_id", gameId);

    if (resetPlayersError) {
      throw handleDatabaseError(resetPlayersError, "플레이어 상태 초기화 실패");
    }

    // 새 라운드 시작 및 카드 배분
    await dealNewRound(gameId);
  } catch (error) {
    console.error("[endRound] Error:", error);
  }
}

/**
 * 새 라운드 시작 및 카드 배분
 * @param gameId 게임 ID
 */
export async function dealNewRound(gameId: string): Promise<void> {
  try {
    // 활성 플레이어 조회
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("game_id", gameId)
      .eq("is_playing", true)
      .eq("is_die", false)
      .gt("chips", 0);

    if (playersError) {
      throw handleDatabaseError(playersError, "플레이어 정보 조회 실패");
    }

    if (!players || players.length === 0) {
      console.log(`[dealNewRound] No active players for game ${gameId}`);
      return;
    }

    // 새 카드 덱 생성
    const deck = createShuffledDeck();

    // 각 플레이어에게 카드 2장씩 분배
    for (let i = 0; i < players.length; i++) {
      const cards = [deck[i * 2], deck[i * 2 + 1]];

      const { error: updatePlayerError } = await supabase
        .from("players")
        .update({
          cards: cards,
          is_die: false,
        })
        .eq("id", players[i].id);

      if (updatePlayerError) {
        console.error(
          `[dealNewRound] Error updating player ${players[i].id}:`,
          updatePlayerError
        );
      }
    }

    // 첫 번째 플레이어를 현재 플레이어로 설정
    if (players.length > 0) {
      const { error: updateGameError } = await supabase
        .from("games")
        .update({
          current_turn: players[0].id,
        })
        .eq("id", gameId);

      if (updateGameError) {
        console.error(
          `[dealNewRound] Error updating game state:`,
          updateGameError
        );
      }
    }

    console.log(`[dealNewRound] Dealt new cards for game ${gameId}`);
  } catch (error) {
    console.error("[dealNewRound] Error:", error);
  }
}

/**
 * 카드 점수 계산
 * @param cards 카드 배열
 * @returns 계산된 점수
 */
function calculateCardScore(cards: number[]): number {
  // 간단한 점수 계산 구현 (실제 섯다 규칙에 맞게 확장 필요)
  if (!cards || cards.length !== 2) return 0;

  // 각 카드의 월수(1~10)
  const card1Month = (cards[0] % 10) + 1;
  const card2Month = (cards[1] % 10) + 1;

  // 땡 체크 (같은 월인 경우)
  if (card1Month === card2Month) {
    return 100 + card1Month; // 땡은 100+월수로 계산
  }

  // 끗수 계산 (두 카드의 월수 합의 일의 자리)
  const score = (card1Month + card2Month) % 10;

  // 특수 조합 체크
  if (
    (card1Month === 1 && card2Month === 2) ||
    (card1Month === 2 && card2Month === 1)
  ) {
    return 90; // 알리
  }

  if (
    (card1Month === 1 && card2Month === 4) ||
    (card1Month === 4 && card2Month === 1)
  ) {
    return 88; // 독사
  }

  // 일반 끗수 반환
  return score === 0 ? 1 : score; // 0끗은 망통(1점)
}

/**
 * 게임 데이터를 GameState 타입으로 변환
 * @param gameData 게임 데이터
 * @returns GameState 객체
 */
function transformGameState(gameData: any): GameState {
  if (!gameData) return {} as GameState;

  // room은 배열로 오거나 객체로 올 수 있음
  let roomName = "";
  if (gameData.room) {
    if (Array.isArray(gameData.room) && gameData.room.length > 0) {
      roomName = gameData.room[0]?.name || "";
    } else if (typeof gameData.room === "object") {
      roomName = (gameData.room as any).name || "";
    }
  }

  return {
    id: gameData.id,
    room_id: gameData.room_id,
    room_name: roomName,
    status: gameData.status,
    bettingValue: gameData.betting_value || 0,
    totalPot: gameData.total_pot || 0,
    baseBet: gameData.base_bet || 0,
    currentTurn: gameData.current_turn,
    winner: gameData.winner,
    betting_round: gameData.betting_round || 1,
    players: [], // 플레이어 정보는 별도로 로드
  };
}

/**
 * 새로운 덱 생성 및 셔플
 * @returns 셔플된 카드 덱
 */
export function createShuffledDeck(): number[] {
  // 0부터 19까지의 카드 배열 생성 (0~9는 광, 10~19는 피)
  const cards = Array.from({ length: 20 }, (_, i) => i);

  // Fisher-Yates 알고리즘으로 셔플
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

/**
 * 현재 게임 상태와 플레이어 상태에 따라 사용 가능한 베팅 액션을 가져옴
 * 
 * @param gameState 현재 게임 상태 데이터
 * @param playerState 현재 플레이어 상태 데이터
 * @param blindAmount 최소 베팅 금액(블라인드)
 * @returns 가능한 베팅 액션 목록
 */
export function getAvailableBettingActions(gameState: any, playerState: any, blindAmount: number): { 
  actions: BettingAction[];
  descriptions: string[];
} {
  const actions: BettingAction[] = [];
  const descriptions: string[] = [];
  
  // 폴드는 항상 가능
  actions.push(BettingAction.FOLD);
  descriptions.push('폴드(Fold) - 게임에서 법니다');
  
  // 최대 베팅액과 플레이어의 현재 베팅액 비교
  const hasPreviousBet = gameState.current_bet_amount > 0;
  const hasMatchedBet = playerState.current_bet >= gameState.current_bet_amount;
  
  if (hasPreviousBet && !hasMatchedBet) {
    // 이전 사람이 베팅했고, 내가 아직 맞추지 않았을 때: 콜, 레이즈 가능
    actions.push(BettingAction.CALL);
    descriptions.push(`콜(Call) - ${gameState.current_bet_amount - playerState.current_bet}원 베팅`);
    
    if (playerState.chips > gameState.current_bet_amount - playerState.current_bet) {
      // 콜보다 더 많은 칩이 있는 경우만 레이즈 가능
      actions.push(BettingAction.RAISE);
      descriptions.push(`레이즈(Raise) - 최소 ${gameState.current_bet_amount + blindAmount}원 이상 베팅`);
    }
  } else {
    // 이전 사람이 베팅하지 않았거나, 내가 이미 맞춤: 체크, 레이즈 가능
    actions.push(BettingAction.CHECK);
    descriptions.push('체크(Check) - 배팅없이 너김');
    
    if (playerState.chips > 0) {
      actions.push(BettingAction.RAISE);
      descriptions.push(`레이즈(Raise) - 최소 ${Math.max(gameState.current_bet_amount + blindAmount, blindAmount)}원 이상 베팅`);
    }
  }
  
  // 올인 옵션 (칩이 있는 경우)
  if (playerState.chips > 0) {
    actions.push(BettingAction.ALLIN);
    descriptions.push(`올인(All-in) - ${playerState.chips}원 베팅`);
  }
  
  return { actions, descriptions };
}

// bettingApi.ts에서는 중앙화된 gameActionApi의 handleBettingTimeout 함수를 사용합니다.
// 함수 구현을 이 파일에서는 삭제합니다.
