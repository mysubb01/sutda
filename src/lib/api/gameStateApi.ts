import { supabase } from "../supabaseClient";
import {
  handleDatabaseError,
  handleResourceNotFoundError,
} from "../utils/errorHandlers";
import { GameState, Player } from "@/types/game";

/**
 * 게임 상태 조회
 *
 * @param gameId 게임 ID
 * @returns 게임 상태 정보
 */
export async function getGameState(gameId: string): Promise<GameState> {
  console.log(`[getGameState] Getting state for game: ${gameId}`);

  try {
    // 게임 기본 정보와 플레이어 정보를 한 번에 조회
    const { data, error } = await supabase
      .from("games")
      .select(
        `
        id,
        status,
        room_id,
        room:rooms(name),
        current_turn,
        winner,
        betting_value,
        total_pot,
        base_bet,
        betting_round,
        game_mode,
        betting_end_time,
        card_selection_time,
        created_at,
        updated_at,
        players(
          id, user_id, username, balance, room_id, cards, open_card, selected_cards,
          is_die, seat_index, is_ready, game_id, is_muted, last_action,
          last_action_time, last_heartbeat, has_acted, folded, created_at, updated_at
        )
      `
      )
      .eq("id", gameId)
      .single();

    if (error) {
      console.error(`[getGameState] Error retrieving game state:`, error);
      throw handleDatabaseError(error, "getGameState:query");
    }

    if (!data) {
      console.error(`[getGameState] Game not found: ${gameId}`);
      throw handleResourceNotFoundError("game", gameId);
    }

    // 중첩된 room 필드에서 room_name을 추출
    // room은 배열로 오거나 객체로 올 수 있음
    let roomName = "";
    if (data.room) {
      if (Array.isArray(data.room) && data.room.length > 0) {
        roomName = data.room[0]?.name || "";
      } else if (typeof data.room === "object") {
        roomName = (data.room as any).name || "";
      }
    }

    // 반환할 GameState 객체 구성
    const gameState: GameState = {
      id: data.id,
      room_id: data.room_id,
      room_name: roomName,
      status: data.status,
      players: data.players || [],
      // 카멜케이스 필드 (프론트엔드 호환성)
      currentTurn: data.current_turn,
      winner: data.winner,
      bettingValue: data.betting_value || 0,
      totalPot: data.total_pot || 0,
      baseBet: data.base_bet || 0,
      bettingRound: data.betting_round,
      gameMode: data.game_mode,
      bettingEndTime: data.betting_end_time,
      cardSelectionTime: data.card_selection_time,
      // 스네이크케이스 필드 (인터페이스에 정의된 것만)
      betting_round: data.betting_round,
      game_mode: data.game_mode,
      betting_end_time: data.betting_end_time,
      // 대체 필드명 (인터페이스에 정의된 것만)
      pot: data.total_pot || 0,
      round: data.betting_round,
      mode: data.game_mode,
    };

    // 추가 정보 조회 (메시지, 액션 등)
    await enrichGameState(gameState);

    return gameState;
  } catch (err) {
    console.error(`[getGameState] Unexpected error:`, err);
    throw err;
  }
}

/**
 * 게임 상태에 추가 정보 포함
 *
 * @param gameState 기본 게임 상태
 */
async function enrichGameState(gameState: GameState): Promise<void> {
  try {
    // 메시지 조회
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, game_id, user_id, username, content, created_at") // 명시적 컬럼 조회
      .eq("game_id", gameState.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!msgError && messages) {
      gameState.messages = messages;
    }

    // 마지막 액션 조회
    const { data: lastActions, error: actionError } = await supabase
      .from("game_actions")
      .select(
        "id, game_id, player_id, action_type, amount, created_at, betting_round"
      ) // 명시적 컬럼 조회
      .eq("game_id", gameState.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!actionError && lastActions && lastActions.length > 0) {
      gameState.lastAction = lastActions[0];
    }
  } catch (err) {
    console.warn(`[enrichGameState] Error enriching game state:`, err);
    // 주요 게임 정보는 이미 있으므로 추가 정보 조회 실패해도 진행
  }
}
