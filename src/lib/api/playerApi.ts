import { v4 as uuidv4 } from "uuid";
import { supabase } from "../supabaseClient";
import {
  handleDatabaseError,
  handleGameError,
  handleResourceNotFoundError,
  ErrorType,
} from "../utils/errorHandlers";
import { isSeatOccupied, findEmptySeat } from "./seatApi";
import { Player, GameState } from "@/types/game";

// API 응답 타입 정의
export interface JoinGameResponse {
  playerId: string;
  gameState: GameState;
  rejoined?: boolean;
}

/**
 * 기존 게임에 플레이어 참가
 *
 * @param gameId 게임 ID
 * @param username 플레이어 닉네임
 * @param seatIndex 선택한 좌석 인덱스 (선택사항)
 * @returns 플레이어 ID와 게임 상태
 */
export async function joinGame(
  gameId: string,
  username: string,
  seatIndex?: number
): Promise<JoinGameResponse> {
  console.log(
    `[joinGame] Joining game ${gameId} as ${username}, requested seat: ${
      seatIndex ?? "auto"
    }`
  );

  try {
    // 게임 상태 체크
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !gameData) {
      console.error(`[joinGame] Game not found: ${gameId}`);
      throw handleResourceNotFoundError("game", gameId, gameError);
    }

    // 클라이언트에서 브라우저 저장소로 관리할 정보
    // 클라이언트 식별을 위한 추가 정보로 활용됨
    let storedPlayerId: string | null = null;

    try {
      // 브라우저 환경인 경우에만 localStorage 접근
      if (typeof localStorage !== "undefined") {
        storedPlayerId = localStorage.getItem(`game_${gameId}_player_id`);
      }
    } catch (e) {
      console.warn("[joinGame] LocalStorage not available:", e);
      // localStorage 접근 실패 시 무시하고 계속 진행
    }

    // 기존 참여자인지 확인
    if (storedPlayerId) {
      console.log(`[joinGame] Checking existing player: ${storedPlayerId}`);

      // 기존 플레이어 정보 조회
      const { data: existingPlayer, error: existingPlayerError } =
        await supabase
          .from("players")
          .select("*")
          .eq("game_id", gameId)
          .eq("id", storedPlayerId)
          .single();

      if (!existingPlayerError && existingPlayer) {
        console.log(
          `[joinGame] Rejoining as existing player: ${existingPlayer.id}, seat: ${existingPlayer.seat_index}`
        );

        // 이름 업데이트가 필요한 경우
        if (existingPlayer.username !== username) {
          await supabase
            .from("players")
            .update({ username, updated_at: new Date().toISOString() })
            .eq("id", existingPlayer.id);
        }

        // 최신 게임 상태 가져오기
        const gameState = await getGameState(gameId);

        // 클라이언트에 응답
        return {
          playerId: existingPlayer.id,
          gameState,
          rejoined: true,
        };
      } else {
        console.log(
          `[joinGame] Stored player not found in database: ${storedPlayerId}`
        );
        // 로컬 스토리지의 정보가 유효하지 않음 - 새 플레이어로 처리
      }
    }

    // 새 플레이어 참가 (게임이 대기 중일 때만)
    if (gameData.status !== "waiting") {
      console.error(
        `[joinGame] Game is not in waiting state: ${gameData.status}`
      );
      throw handleGameError(
        null,
        ErrorType.INVALID_STATE,
        "게임이 이미 시작되었거나 종료되었습니다."
      );
    }

    // 새 플레이어 ID 생성
    const playerId = uuidv4();

    // 좌석 할당 로직
    let finalSeatIndex: number | null = null;

    // 1. 특정 좌석이 요청된 경우
    if (seatIndex !== undefined) {
      console.log(`[joinGame] Checking requested seat: ${seatIndex}`);

      // 빈 좌석인지 확인
      const isOccupied = await isSeatOccupied(seatIndex, gameId);

      if (isOccupied) {
        console.error(
          `[joinGame] Requested seat ${seatIndex} is already occupied`
        );
        throw handleGameError(
          null,
          ErrorType.INVALID_STATE,
          `좌석 ${seatIndex}번은 이미 다른 플레이어가 사용 중입니다.`
        );
      }

      finalSeatIndex = seatIndex;
    }
    // 2. 자동 좌석 할당이 요청된 경우
    else {
      console.log("[joinGame] Finding an empty seat automatically");

      // 빈 좌석 찾기
      finalSeatIndex = await findEmptySeat(gameId);

      if (finalSeatIndex === null) {
        console.error("[joinGame] No empty seats available");
        throw handleGameError(
          null,
          ErrorType.GAME_FULL,
          "게임에 더 이상 빈 좌석이 없습니다."
        );
      }
    }

    console.log(
      `[joinGame] Creating player - ID: ${playerId}, seat: ${finalSeatIndex}`
    );

    const timestamp = new Date().toISOString();

    // 플레이어 생성
    try {
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          id: playerId,
          user_id: playerId, // user_id 필드 추가 (NOT NULL 제약 조건)
          game_id: gameId,
          username: username,
          balance: 10000, // 기본 잔액
          is_die: false,
          seat_index: finalSeatIndex,
          is_ready: false,
          created_at: timestamp,
          updated_at: timestamp,
          last_heartbeat: timestamp,
        })
        .select();

      if (playerError) {
        console.error("[joinGame] Error creating player:", playerError);
        throw handleDatabaseError(playerError, "joinGame:player_insert");
      }

      console.log(
        `[joinGame] Player created successfully: ${playerId}, seat: ${finalSeatIndex}`
      );

      // 최신 게임 상태 가져오기
      const gameState = await getGameState(gameId);

      // 클라이언트에 응답
      return {
        playerId,
        gameState,
      };
    } catch (err) {
      console.error("[joinGame] Error in player creation:", err);
      throw err;
    }
  } catch (err) {
    console.error("[joinGame] Error in join process:", err);
    throw err;
  }
}

/**
 * 임시 정의 - 나중에 제대로 구현
 */
async function getGameState(gameId: string): Promise<GameState> {
  // 임시로 기본 구조만 설정
  const { data, error } = await supabase
    .from("games")
    .select(
      `
      id, 
      status, 
      current_turn,
      betting_value,
      total_pot,
      room_id,
      players (*)
    `
    )
    .eq("id", gameId)
    .single();

  if (error) {
    throw handleDatabaseError(error, "getGameState");
  }

  return data as unknown as GameState;
}

/**
 * 게임의 모든 플레이어 정보 조회
 *
 * @param gameId 게임 ID
 * @returns 플레이어 정보 목록
 */
export async function getGamePlayers(gameId: string): Promise<Player[]> {
  console.log(`[getGamePlayers] Getting players for game: ${gameId}`);

  try {
    const { data, error } = await supabase
      .from("players")
      .select(
        `
        id, user_id, username, balance, room_id, cards, open_card, selected_cards,
        is_die, seat_index, is_ready, game_id, is_muted, last_action,
        last_action_time, last_heartbeat, has_acted, folded, created_at, updated_at
      `
      ) // 명시적으로 컬럼 지정
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });

    if (error) {
      throw handleDatabaseError(error, "getGamePlayers");
    }

    if (!data || data.length === 0) {
      console.log(`[getGamePlayers] No players found for game: ${gameId}`);
      return [];
    }

    console.log(
      `[getGamePlayers] Found ${data.length} players for game: ${gameId}`
    );
    return data as Player[];
  } catch (error) {
    console.error(`[getGamePlayers] Error:`, error);
    throw error;
  }
}

/**
 * 플레이어 정보 조회
 *
 * @param playerId 플레이어 ID
 * @returns 플레이어 정보
 */
export async function getPlayer(playerId: string): Promise<Player> {
  console.log(`[getPlayer] Getting player info for ID: ${playerId}`);

  try {
    const { data, error } = await supabase
      .from("players")
      .select(
        `
        id, user_id, username, balance, room_id, cards, open_card, selected_cards,
        is_die, seat_index, is_ready, game_id, is_muted, last_action,
        last_action_time, last_heartbeat, has_acted, folded, created_at, updated_at
      `
      ) // 명시적으로 컬럼 지정
      .eq("id", playerId)
      .single();

    if (error) {
      console.error(`[getPlayer] Error retrieving player:`, error);
      throw handleDatabaseError(error, "getPlayer:query");
    }

    if (!data) {
      console.error(`[getPlayer] Player not found: ${playerId}`);
      throw handleResourceNotFoundError("player", playerId);
    }

    return data as Player;
  } catch (err) {
    console.error(`[getPlayer] Unexpected error:`, err);
    throw err;
  }
}
