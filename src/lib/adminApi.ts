import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

/**
 * 시스템 메시지 전송 (관리자 알림용)
 */
export async function sendSystemMessage(
  gameId: string,
  content: string
): Promise<void> {
  if (!gameId) {
    throw new Error("Invalid game ID");
  }

  const id = uuidv4();
  const timestamp = new Date().toISOString();

  // 시스템 메시지 데이터 구성
  const messageData = {
    id,
    game_id: gameId,
    user_id: "system", // 시스템 메시지는 user_id를 'system'으로 설정
    username: "시스템", // 시스템 메시지 표시 이름
    content: content,
    created_at: timestamp,
  };

  // 메시지 저장
  const { error: messageError } = await supabase
    .from("messages")
    .insert(messageData);

  if (messageError) {
    console.error("System message error:", messageError);
    throw new Error("Failed to send system message");
  }
}

/**
 * 플레이어 강퇴 API
 * @param playerId 강퇴할 플레이어 ID
 */
export async function kickPlayer(playerId: string) {
  try {
    // 먼저 플레이어 정보 조회
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select(
        `
        id, username,
        games!inner(id, status)
      `
      ) // 필요한 컬럼만 명시적으로 조회
      .eq("id", playerId)
      .single();

    if (playerError) {
      throw playerError;
    }

    // 플레이어 제거
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId);

    if (error) {
      throw error;
    }

    // 게임이 진행 중인 경우, 시스템 메시지 전송
    const gameData = playerData.games as any;
    if (gameData && gameData.status === "playing") {
      await sendSystemMessage(
        gameData.id,
        `관리자가 ${playerData.username}님을 강퇴했습니다.`
      );
    }

    return { success: true, message: "플레이어가 성공적으로 강퇴되었습니다." };
  } catch (error: any) {
    console.error("플레이어 강퇴 중 오류 발생:", error.message);
    return { success: false, message: "플레이어 강퇴 중 오류가 발생했습니다." };
  }
}

/**
 * 플레이어 채팅 금지 상태 변경
 * @param playerId 채팅 금지할 플레이어 ID
 * @param isMuted 채팅 금지 상태 여부
 */
export async function togglePlayerMute(playerId: string, isMuted: boolean) {
  try {
    // 먼저 플레이어 정보 조회
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select(
        `
        id, username,
        games!inner(id, status)
      `
      ) // 필요한 컬럼만 명시적으로 조회
      .eq("id", playerId)
      .single();

    if (playerError) {
      throw playerError;
    }

    // 채팅 금지 상태 변경
    const { error } = await supabase
      .from("players")
      .update({ is_muted: isMuted })
      .eq("id", playerId);

    if (error) {
      throw error;
    }

    // 게임이 진행 중인 경우, 시스템 메시지 전송
    const gameData = playerData.games as any;
    if (gameData && gameData.status === "playing") {
      const actionMessage = isMuted
        ? `관리자가 ${playerData.username}님의 채팅을 금지했습니다.`
        : `관리자가 ${playerData.username}님의 채팅 금지를 해제했습니다.`;

      await sendSystemMessage(gameData.id, actionMessage);
    }

    return {
      success: true,
      message: isMuted
        ? "플레이어의 채팅이 금지되었습니다."
        : "플레이어의 채팅 금지가 해제되었습니다.",
    };
  } catch (error: any) {
    console.error("채팅 금지 설정 중 오류 발생:", error.message);
    return {
      success: false,
      message: "채팅 금지 설정 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 방의 참가비(바이인) 금액 변경
 * @param roomId 변경할 방 ID
 * @param entryFee 새 참가비 금액
 */
export async function updateRoomEntryFee(roomId: string, entryFee: number) {
  try {
    const { error } = await supabase
      .from("rooms")
      .update({ entry_fee: entryFee })
      .eq("id", roomId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: `참가비가 ${entryFee.toLocaleString()}원으로 변경되었습니다.`,
    };
  } catch (error: any) {
    console.error("참가비 변경 중 오류 발생:", error.message);
    return { success: false, message: "참가비 변경 중 오류가 발생했습니다." };
  }
}

/**
 * 게임의 기본 베팅액(블라인드) 변경
 * @param roomId 변경할 방 ID
 * @param baseBet 새 기본 베팅액
 */
export async function updateGameBaseBet(roomId: string, baseBet: number) {
  try {
    // 현재 진행 중인 게임 찾기
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("id") // id만 필요
      .eq("room_id", roomId)
      .eq("status", "playing")
      .single();

    if (gameError && gameError.code !== "PGRST116") {
      // PGRST116: 결과가 없음
      throw gameError;
    }

    // 게임이 진행 중인 경우
    if (gameData) {
      const { error } = await supabase
        .from("games")
        .update({ base_bet: baseBet })
        .eq("id", gameData.id);

      if (error) {
        throw error;
      }
    } else {
      // 게임이 없으면 방의 기본값 업데이트
      const { error } = await supabase
        .from("rooms")
        .update({ default_base_bet: baseBet })
        .eq("id", roomId);

      if (error) {
        throw error;
      }
    }

    return {
      success: true,
      message: `기본 베팅액이 ${baseBet.toLocaleString()}원으로 변경되었습니다.`,
    };
  } catch (error: any) {
    console.error("기본 베팅액 변경 중 오류 발생:", error.message);
    return {
      success: false,
      message: "기본 베팅액 변경 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 플레이어 잔액 수정
 * @param playerId 수정할 플레이어 ID
 * @param amount 변경할 금액 (양수: 추가, 음수: 차감)
 */
export async function updatePlayerBalance(playerId: string, amount: number) {
  try {
    // 현재 플레이어 잔액 조회
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select(
        `
        balance, username,
        games!inner(id, status)
      `
      ) // 필요한 컬럼만 명시적으로 조회
      .eq("id", playerId)
      .single();

    if (playerError) {
      throw playerError;
    }

    const currentBalance = playerData.balance;
    const newBalance = currentBalance + amount;

    // 잔액이 음수가 되지 않도록 체크
    if (newBalance < 0) {
      return {
        success: false,
        message: "플레이어 잔액은 0 미만이 될 수 없습니다.",
      };
    }

    // 잔액 업데이트
    const { error } = await supabase
      .from("players")
      .update({ balance: newBalance })
      .eq("id", playerId);

    if (error) {
      throw error;
    }

    const action = amount >= 0 ? "추가" : "차감";
    const absAmount = Math.abs(amount);

    // 게임이 진행 중인 경우, 시스템 메시지 전송
    const gameData = playerData.games as any;
    if (gameData && gameData.status === "playing") {
      const actionMessage =
        amount >= 0
          ? `관리자가 ${
              playerData.username
            }님의 잔액에 ${absAmount.toLocaleString()}원을 추가했습니다.`
          : `관리자가 ${
              playerData.username
            }님의 잔액에서 ${absAmount.toLocaleString()}원을 차감했습니다.`;

      await sendSystemMessage(gameData.id, actionMessage);
    }

    return {
      success: true,
      message: `${
        playerData.username
      }님의 잔액이 ${absAmount.toLocaleString()}원 ${action}되었습니다. 현재 잔액: ${newBalance.toLocaleString()}원`,
    };
  } catch (error: any) {
    console.error("플레이어 잔액 수정 중 오류 발생:", error.message);
    return {
      success: false,
      message: "플레이어 잔액 수정 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 특정 방의 모든 정보 가져오기 (상세 정보)
 * @param roomId 방 ID
 */
export async function getRoomDetails(roomId: string) {
  try {
    // 방 정보 조회
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select(
        `
        id, name, mode, entry_fee, max_players, is_active, created_at,
        updated_at, betting_option, default_base_bet, metadata
      `
      ) // 명시적 컬럼 지정
      .eq("id", roomId)
      .single();

    if (roomError) {
      throw roomError;
    }

    // 플레이어 정보 조회
    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select(
        `
        id, user_id, username, balance, room_id, cards, open_card, selected_cards,
        is_die, seat_index, is_ready, game_id, is_muted, last_action,
        last_action_time, last_heartbeat, has_acted, created_at, updated_at
      `
      ) // 명시적으로 컬럼 지정
      .eq("room_id", roomId);

    if (playersError) {
      throw playersError;
    }

    // 현재 게임 정보 조회
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select(
        `
        id, status, room_id, current_turn, winner, betting_value, total_pot,
        base_bet, betting_round, game_mode, betting_end_time, card_selection_time,
        created_at, updated_at, show_cards, room_name
      `
      ) // 명시적 컬럼 지정
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (gameError) {
      throw gameError;
    }

    return {
      success: true,
      data: {
        room: roomData,
        players: playersData,
        currentGame: gameData?.[0] || null,
      },
    };
  } catch (error: any) {
    console.error("방 상세 정보 조회 중 오류 발생:", error.message);
    return {
      success: false,
      message: "방 정보를 불러올 수 없습니다.",
      data: null,
    };
  }
}

/**
 * 방 삭제 API
 * @param roomId 삭제할 방 ID
 */
export async function deleteRoom(roomId: string) {
  try {
    // 방 정보 가져오기
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", roomId)
      .single();

    if (roomError) {
      throw roomError;
    }

    // 해당 방의 플레이어 조회
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", roomId);

    if (playersError) {
      throw playersError;
    }

    // 해당 방의 게임 조회
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id")
      .eq("room_id", roomId);

    if (gamesError) {
      throw gamesError;
    }

    // 트랜잭션은 지원되지 않으므로 순차적으로 삭제
    // 1. 플레이어 삭제
    if (players && players.length > 0) {
      const playerIds = players.map(p => p.id);
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .in("id", playerIds);

      if (deletePlayersError) {
        throw deletePlayersError;
      }
    }

    // 2. 게임 삭제
    if (games && games.length > 0) {
      const gameIds = games.map(g => g.id);
      
      // 게임 관련 채팅 메시지 삭제
      const { error: deleteMessagesError } = await supabase
        .from("messages")
        .delete()
        .in("game_id", gameIds);

      if (deleteMessagesError) {
        throw deleteMessagesError;
      }

      // 게임 삭제
      const { error: deleteGamesError } = await supabase
        .from("games")
        .delete()
        .in("id", gameIds);

      if (deleteGamesError) {
        throw deleteGamesError;
      }
    }

    // 3. 방 삭제
    const { error: deleteRoomError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);

    if (deleteRoomError) {
      throw deleteRoomError;
    }

    return { 
      success: true, 
      message: `'${roomData.name}' 방이 성공적으로 삭제되었습니다.` 
    };
  } catch (error: any) {
    console.error("방 삭제 중 오류 발생:", error.message);
    return { success: false, message: "방 삭제 중 오류가 발생했습니다." };
  }
}

/**
 * 모든 플레이어 목록 조회
 */
export async function getAllPlayers() {
  try {
    const { data, error } = await supabase
      .from("players")
      .select(`
        *,
        rooms:room_id(id, name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data,
      message: "플레이어 목록을 성공적으로 가져왔습니다."
    };
  } catch (error: any) {
    console.error("플레이어 목록 조회 중 오류 발생:", error.message);
    return { 
      success: false, 
      data: null,
      message: "플레이어 목록을 불러올 수 없습니다." 
    };
  }
}
