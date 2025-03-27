import { supabase } from "../supabaseClient";
import { handleDatabaseError } from "../utils/errorHandlers";
import { Message } from "@/types/game";

/**
 * 채팅 메시지 전송
 *
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @param message 메시지 내용
 */
export async function sendMessage(
  gameId: string,
  playerId: string,
  message: string
): Promise<void> {
  console.log(
    `[sendMessage] Game: ${gameId}, Player: ${playerId}, Message: ${message}`
  );

  try {
    // 1. 플레이어 정보 가져오기
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("username")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      console.error("[sendMessage] Player not found for ID:", playerId);
      throw handleDatabaseError(playerError, "sendMessage:player_query");
    }

    // 2. 메시지 저장 - 플레이어 ID를 일관되게 사용
    const { error: messageError } = await supabase.from("messages").insert({
      game_id: gameId,
      user_id: playerId, // DB 스키마에 맞춰 user_id 사용
      username: player.username,
      content: message,
      // created_at은 DB 기본값 사용
    });

    if (messageError) {
      console.error("[sendMessage] Message insert error:", messageError);
      throw handleDatabaseError(messageError, "sendMessage:message_insert");
    }

    console.log("[sendMessage] Message sent successfully");
  } catch (err) {
    console.error("[sendMessage] Error sending message:", err);
    throw err;
  }
}

/**
 * 게임 메시지 조회
 *
 * @param gameId 게임 ID
 * @param limit 조회할 메시지 수 (기본값: 50)
 * @param beforeTimestamp 특정 시간 이전 메시지만 조회 (선택사항)
 * @returns 메시지 목록
 */
export async function getMessages(
  gameId: string,
  limit: number = 50,
  beforeTimestamp?: string
): Promise<Message[]> {
  console.log(
    `[getMessages] Getting messages for game: ${gameId}, limit: ${limit}`
  );

  try {
    let query = supabase
      .from("messages")
      .select("id, game_id, user_id, username, content, created_at") // 필요한 컬럼만 명시적으로 조회
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 특정 시간 이전 메시지만 조회
    if (beforeTimestamp) {
      query = query.lt("created_at", beforeTimestamp);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getMessages] Error retrieving messages:", error);
      throw handleDatabaseError(error, "getMessages:query");
    }

    return (data || []) as Message[];
  } catch (err) {
    console.error("[getMessages] Unexpected error:", err);
    throw err;
  }
}
