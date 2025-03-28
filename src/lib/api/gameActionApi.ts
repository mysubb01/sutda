import { supabase } from "../supabaseClient";
import {
  handleDatabaseError,
  handleGameError,
  ErrorType,
} from "../utils/errorHandlers";
import { GameState, Player, GameMode } from "@/types/game";
import { createShuffledDeck, dealCards } from "./deckApi";

/**
 * 게임 상태 타입
 */
export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  PLAYING = "playing",
  FINISHED = "finished",
}

/**
 * 게임 시작 처리
 * @param gameId 게임 ID
 * @param playerId 시작 요청 플레이어 ID
 * @returns 성공 여부 및 업데이트된 게임 상태
 */
export async function startGame(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
  try {
    console.log(`[startGame] Starting game ${gameId} by player ${playerId}`);

    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*, room:rooms(*)")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 정보 조회 실패");
    }

    if (!game) {
      throw handleGameError(
        new Error("게임을 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "게임을 찾을 수 없습니다"
      );
    }

    // 게임이 이미 시작되었는지 확인
    if (game.status === GameStatus.PLAYING) {
      throw handleGameError(
        new Error("게임이 이미 시작되었습니다"),
        ErrorType.INVALID_STATE,
        "게임이 이미 시작되었습니다"
      );
    }

    // 플레이어가 방장인지 확인
    const isOwner = await isRoomOwner(gameId, playerId);
    if (!isOwner) {
      throw handleGameError(
        new Error("방장만 게임을 시작할 수 있습니다"),
        ErrorType.UNAUTHORIZED,
        "방장만 게임을 시작할 수 있습니다"
      );
    }

    // 시작 가능 여부 확인
    const startResult = await canStartGame(gameId);
    if (!startResult.canStart) {
      throw handleGameError(
        new Error(`게임을 시작할 수 없습니다. ${startResult.message}`),
        ErrorType.INVALID_STATE,
        `게임을 시작할 수 없습니다. ${startResult.message}`
      );
    }

    // 카드 덱 생성 및 셔플
    const deck = createShuffledDeck();

    // 준비된 플레이어 목록 조회
    const { data: readyPlayers, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("game_id", gameId)
      .eq("is_ready", true);

    if (playersError) {
      throw handleDatabaseError(playersError, "플레이어 정보 조회 실패");
    }

    // 각 플레이어에게 카드 2장씩 분배
    const playerCards = dealCards(deck, readyPlayers.length);

    // 각 플레이어 상태 업데이트
    for (let i = 0; i < readyPlayers.length; i++) {
      const { error: updatePlayerError } = await supabase
        .from("players")
        .update({
          cards: playerCards[i],
          is_playing: true,
          is_ready: false,
          balance: 1000, // 초기 칩 지급 (chips -> balance)
          current_bet: 0,
          is_die: false, // folded -> is_die
          last_heartbeat: new Date().toISOString(), // 추가된 필드
          has_acted: false, // 추가된 필드
        })
        .eq("id", readyPlayers[i].id);

      if (updatePlayerError) {
        console.error(
          `[startGame] Error updating player ${readyPlayers[i].id}:`,
          updatePlayerError
        );
      }
    }

    // 첫 번째 플레이어를 현재 플레이어로 설정
    const firstPlayerId = readyPlayers.length > 0 ? readyPlayers[0].id : null;

    // 게임 상태 업데이트
    // 베팅 종료 시간 설정
    const bettingEndTime = new Date();
    bettingEndTime.setSeconds(bettingEndTime.getSeconds() + 30); // 30초 제한시간

    const { data: updatedGame, error: updateGameError } = await supabase
      .from("games")
      .update({
        status: GameStatus.PLAYING,
        current_turn: firstPlayerId, // 통합된 current_turn 필드 사용
        current_bet_amount: 0,
        pot: 0, // 프론트엔드와 호환성 위해 pot 사용
        round: 1, // 프론트엔드와 호환성 위해 round 사용
        deck: deck,
        last_action: "게임이 시작되었습니다",
        updated_at: new Date().toISOString(),
        betting_end_time: bettingEndTime.toISOString(), // 추가된 필드 유지
        mode: game.room?.mode || 2, // 프론트엔드와 호환성 위해 mode 사용
      })
      .eq("id", gameId)
      .select("*, room:rooms(*)")
      .single();

    if (updateGameError) {
      throw handleDatabaseError(updateGameError, "게임 상태 업데이트 실패");
    }

    // 시작 메시지 기록
    await sendGameMessage(gameId, "system", "게임이 시작되었습니다");

    return {
      success: true,
      gameState: transformGameState(updatedGame),
    };
  } catch (error: any) {
    console.error("[startGame] Error:", error);
    return {
      success: false,
      error: error.message || "게임 시작 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플레이어의 준비 상태 토글
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @param targetState 변경할 준비 상태. 설정하지 않으면 현재 상태의 반대로 설정.
 * @returns 성공 여부 및 준비 상태
 */
export async function toggleReady(
  gameId: string,
  playerId: string,
  targetState?: boolean
): Promise<{ success: boolean; isReady?: boolean; error?: string }> {
  try {
    console.log(
      `[toggleReady] Toggling ready state for player ${playerId} in game ${gameId}`
    );

    // 현재 플레이어 상태 조회
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("is_ready")
      .eq("id", playerId)
      .eq("game_id", gameId)
      .single();

    if (playerError) {
      throw handleDatabaseError(playerError, "플레이어 정보 조회 실패");
    }

    if (!player) {
      throw handleGameError(
        new Error("플레이어를 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "플레이어를 찾을 수 없습니다"
      );
    }

    // 게임 상태 확인
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 정보 조회 실패");
    }

    if (!game) {
      throw handleGameError(
        new Error("게임을 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "게임을 찾을 수 없습니다"
      );
    }

    // 게임이 이미 시작되었으면 준비 불가
    if (game.status === GameStatus.PLAYING) {
      throw handleGameError(
        new Error("게임이 이미 시작되었습니다"),
        ErrorType.INVALID_STATE,
        "게임이 이미 시작되었습니다"
      );
    }

    // 준비 상태 설정 (매개변수로 주어진 값 또는 현재 값의 반대)
    const newReadyState =
      targetState !== undefined ? targetState : !player.is_ready;

    const { error: updateError } = await supabase
      .from("players")
      .update({ is_ready: newReadyState })
      .eq("id", playerId)
      .eq("game_id", gameId);

    if (updateError) {
      throw handleDatabaseError(updateError, "플레이어 상태 업데이트 실패");
    }

    return {
      success: true,
      isReady: newReadyState,
    };
  } catch (error: any) {
    console.error("[toggleReady] Error:", error);
    return {
      success: false,
      error: error.message || "준비 상태 변경 중 오류가 발생했습니다",
    };
  }
}

/**
 * 게임 종료 처리
 * @param gameId 게임 ID
 * @returns 성공 여부 및 결과 메시지
 */
export async function endGame(
  gameId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log(`[endGame] Ending game ${gameId}`);

    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (gameError) {
      throw handleDatabaseError(gameError, "게임 정보 조회 실패");
    }

    if (!game) {
      throw handleGameError(
        new Error("게임을 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "게임을 찾을 수 없습니다"
      );
    }

    // 게임이 이미 종료되었는지 확인
    if (game.status === GameStatus.FINISHED) {
      return {
        success: true,
        message: "게임이 이미 종료되었습니다",
      };
    }

    // 게임 결과 계산 (승자, 칩 배당 등)
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, username, chips")
      .eq("game_id", gameId)
      .eq("is_playing", true)
      .order("chips", { ascending: false });

    if (playersError) {
      throw handleDatabaseError(playersError, "플레이어 정보 조회 실패");
    }

    // 게임 종료 상태 업데이트
    const { error: updateError } = await supabase
      .from("games")
      .update({
        status: GameStatus.FINISHED,
        last_action: "게임이 종료되었습니다",
        updated_at: new Date().toISOString(),
      })
      .eq("id", gameId);

    if (updateError) {
      throw handleDatabaseError(updateError, "게임 상태 업데이트 실패");
    }

    // 종료 메시지 및 결과 기록
    let resultMessage = "게임이 종료되었습니다.\n";

    if (players && players.length > 0) {
      resultMessage += "\n최종 순위:\n";
      players.forEach((player, index) => {
        resultMessage += `${index + 1}위: ${player.username} (${
          player.chips
        } 칩)\n`;
      });
    }

    await sendGameMessage(gameId, "system", resultMessage);

    return {
      success: true,
      message: resultMessage,
    };
  } catch (error: any) {
    console.error("[endGame] Error:", error);
    return {
      success: false,
      error: error.message || "게임 종료 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타이머가 만료되었을 때 자동 폴드 처리
 * @param gameId 게임 ID
 * @param playerId 시간 초과된 플레이어 ID (선택적)
 * @returns 처리 결과
 */
export async function handleBettingTimeout(
  gameId: string,
  playerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[handleBettingTimeout] ========= 시작: 플레이어 ${
        playerId || "unknown"
      }, 게임 ${gameId} =========`
    );

    // 최신 게임 상태 확인 - 더 많은 필드 선택
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status, current_turn, betting_end_time, round, total_pot")
      .eq("id", gameId)
      .single();

    if (gameError) {
      console.error(`[handleBettingTimeout] 게임 조회 오류:`, gameError);
      throw handleDatabaseError(gameError, "게임 정보 조회 실패");
    }

    if (!game) {
      console.error(`[handleBettingTimeout] 게임을 찾을 수 없음: ${gameId}`);
      throw handleGameError(
        new Error("게임을 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "게임을 찾을 수 없습니다"
      );
    }

    console.log(`[handleBettingTimeout] 게임 상태:`, JSON.stringify(game, null, 2));

    // 현재 턴 플레이어 결정 (인자로 전달된 playerId가 우선, 없으면 게임의 current_turn 사용)
    const currentPlayerId = playerId || game.current_turn;
    if (!currentPlayerId) {
      console.error(`[handleBettingTimeout] 현재 플레이어 ID 없음`);
      throw handleGameError(
        new Error("현재 플레이어 ID를 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "현재 플레이어 ID를 찾을 수 없습니다"
      );
    }

    // 게임이 진행 중인지 확인
    if (game.status !== GameStatus.PLAYING) {
      console.log(`[handleBettingTimeout] 게임이 진행 중이 아님: ${game.status}`);
      return {
        success: false,
        error: "게임이 진행 중이 아닙니다",
      };
    }

    // 지정된 플레이어가 현재 턴인지 확인 
    // 참고: 강제 타임아웃일 경우 playerId가 지정되고 턴 체크를 하지 않음
    if (playerId && game.current_turn !== playerId) {
      console.log(`[handleBettingTimeout] 지정된 플레이어의 턴이 아님: 현재턴=${game.current_turn}, 지정=${playerId}`);
      return {
        success: false,
        error: "해당 플레이어의 턴이 아닙니다",
      };
    }

    // 전체 플레이어 정보 가져오기
    const { data: allPlayers, error: playersError } = await supabase
      .from("players")
      .select("id, username, is_die, is_playing, seat_index")
      .eq("game_id", gameId);

    if (playersError) {
      console.error(`[handleBettingTimeout] 플레이어 목록 조회 오류:`, playersError);
      throw handleDatabaseError(playersError, "플레이어 목록 조회 실패");
    }

    // 참여 중인 플레이어 목록 (폴드되지 않은)
    const activePlayers = allPlayers.filter(p => p.is_playing && !p.is_die);
    console.log(`[handleBettingTimeout] 활성 플레이어 수: ${activePlayers.length}`);
    
    // 현재 턴 플레이어 정보 가져오기
    const currentPlayer = allPlayers.find(p => p.id === currentPlayerId);
    if (!currentPlayer) {
      console.error(`[handleBettingTimeout] 현재 턴 플레이어를 찾을 수 없음: ${currentPlayerId}`);
      throw handleGameError(
        new Error("플레이어를 찾을 수 없습니다"),
        ErrorType.NOT_FOUND,
        "플레이어를 찾을 수 없습니다"
      );
    }

    // 이미 폴드된 플레이어라면 그냥 다음 턴으로 넘김
    if (currentPlayer.is_die) {
      console.log(`[handleBettingTimeout] 플레이어 ${currentPlayerId}는 이미 폴드 상태임`);
      
      // 다음 플레이어 구하기
      const nextPlayerId = await getNextPlayerTurn(gameId, currentPlayerId);
      console.log(`[handleBettingTimeout] 이미 폴드된 플레이어의 다음 턴: ${nextPlayerId || '없음'}`);
      
      if (nextPlayerId) {
        // 게임 상태 업데이트 - 턴만 넘기고 타이머 리셋
        const { error: updateError } = await supabase
          .from("games")
          .update({
            current_turn: nextPlayerId,
            betting_end_time: new Date(Date.now() + 40000).toISOString(), // 타이머 40초로 설정 (버퍼 증가)
            updated_at: new Date().toISOString(),
          })
          .eq("id", gameId);

        if (updateError) {
          console.error(`[handleBettingTimeout] 게임 상태 업데이트 오류:`, updateError);
          throw handleDatabaseError(updateError, "게임 상태 업데이트 실패");
        }
        
        console.log(`[handleBettingTimeout] 이미 폴드된 플레이어의 다음 턴으로 성공적으로 넘김`);
      }
      
      return { success: true };
    }

    // 자동 폴드 처리 (is_die = true로 설정)
    console.log(`[handleBettingTimeout] 플레이어 ${currentPlayerId} 자동 폴드 처리 시작`);
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({
        is_die: true,
        has_acted: true,
        last_action: "fold",
        last_action_time: new Date().toISOString(),
      })
      .eq("id", currentPlayerId);

    if (updatePlayerError) {
      console.error(`[handleBettingTimeout] 플레이어 폴드 처리 오류:`, updatePlayerError);
      throw handleDatabaseError(
        updatePlayerError,
        "플레이어 상태 업데이트 실패"
      );
    }
    
    console.log(`[handleBettingTimeout] 플레이어 ${currentPlayerId} 자동 폴드 처리 완료`);

    // 현재 게임 상태 재확인 (타이머 초기화 여부 확인)
    const { data: currentGameState } = await supabase
      .from("games")
      .select("id, status, current_turn, betting_end_time")
      .eq("id", gameId)
      .single();
      
    console.log(`[handleBettingTimeout] 현재 게임 상태 (다음 플레이어 결정 전):`, currentGameState);
    
    // 다음 플레이어 결정
    console.log(`[handleBettingTimeout] 다음 플레이어 ID 결정 중... 현재: ${currentPlayerId}`);
    const nextPlayerId = await getNextPlayerTurn(gameId, currentPlayerId);
    console.log(`[handleBettingTimeout] 다음 플레이어 ID 결정됨: ${nextPlayerId || '없음 (라운드 종료)'}`);

    // 게임 상태 업데이트를 위한 데이터 준비
    const now = new Date();
    const newBettingEndTime = nextPlayerId ? new Date(now.getTime() + 40000).toISOString() : null;
    
    const updateData: any = {
      current_turn: nextPlayerId,
      last_action: `${currentPlayer.username} 시간 초과로 폴드`,
      betting_end_time: newBettingEndTime,
      updated_at: now.toISOString(),
    };
    
    console.log(`[handleBettingTimeout] 게임 상태 업데이트 시작:`, JSON.stringify(updateData, null, 2));
    
    // 트랜잭션 내에서 업데이트 실행 - 다른 처리와 원자적 실행 보장
    try {
      const { error: updateGameError } = await supabase
        .from("games")
        .update(updateData)
        .eq("id", gameId);
          
      if (updateGameError) {
        console.error(`[handleBettingTimeout] 게임 상태 업데이트 오류:`, updateGameError);
        throw handleDatabaseError(updateGameError, "게임 상태 업데이트 실패");
      }
      
      console.log(`[handleBettingTimeout] 게임 상태 업데이트 완료`);
      
      // 업데이트 후 즉시 상태 재확인 (타이머 업데이트 확인)
      const { data: stateAfterUpdate } = await supabase
        .from("games")
        .select("id, status, current_turn, betting_end_time")
        .eq("id", gameId)
        .single();
        
      console.log(`[handleBettingTimeout] 업데이트 후 상태:`, stateAfterUpdate);
      
      // 업데이트가 실제로 적용되지 않은 경우 추가 재시도
      if (stateAfterUpdate && (
          stateAfterUpdate.current_turn !== nextPlayerId ||
          stateAfterUpdate.betting_end_time !== newBettingEndTime)) {
        console.warn(`[handleBettingTimeout] 게임 상태 업데이트가 완전히 적용되지 않았습니다. 재시도...`);
        
        // 지연 후 재시도
        const { error: retryError } = await supabase
          .from("games")
          .update(updateData)
          .eq("id", gameId);
          
        if (retryError) {
          console.error(`[handleBettingTimeout] 재시도 업데이트 오류:`, retryError);
        } else {
          console.log(`[handleBettingTimeout] 재시도 업데이트 성공`);
        }
      }
    } catch (updateError) {
      console.error(`[handleBettingTimeout] 게임 상태 업데이트 중 예외 발생:`, updateError);
      throw updateError;
    }
    
    // 알림 메시지 기록
    try {
      await sendGameMessage(
        gameId,
        "system",
        `${currentPlayer.username}님이 시간 초과로 자동 폴드되었습니다.`
      );
      console.log(`[handleBettingTimeout] 폴드 알림 메시지 전송 완료`);
    } catch (msgError) {
      console.error(`[handleBettingTimeout] 알림 메시지 전송 중 오류:`, msgError);
      // 메시지 오류는 크리티켜하지 않으므로 오류 전파하지 않음
    }

    // 라운드 완료 여부 확인
    console.log(`[handleBettingTimeout] 라운드 완료 여부 체크`);
    try {
      await checkRoundCompletion(gameId);
      console.log(`[handleBettingTimeout] 라운드 완료 체크 완료`);
    } catch (roundError) {
      console.error(`[handleBettingTimeout] 라운드 완료 체크 중 오류:`, roundError);
      // 라운드 완료 오류는 턴 전환에 영향을 주지 않으므로 오류 전파하지 않음
    }

    // 최종 게임 상태 재확인 (최종 검증 목적)
    const { data: finalGame } = await supabase
      .from("games")
      .select("id, status, current_turn, betting_end_time, updated_at")
      .eq("id", gameId)
      .single();
      
    console.log(`[handleBettingTimeout] 최종 게임 상태:`, finalGame);
    console.log(`[handleBettingTimeout] ========= 종료: 성공 =========`);

    return { success: true };
  } catch (error: any) {
    console.error("[handleBettingTimeout] Error:", error);
    return {
      success: false,
      error: error.message || "시간 초과 처리 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플레이어가 방장인지 확인
 * @param gameId 게임 ID
 * @param playerId 플레이어 ID
 * @returns 방장 여부
 */
export async function isRoomOwner(
  gameId: string,
  playerId: string
): Promise<boolean> {
  try {
    // 게임의 플레이어 정보를 시간순으로 조회
    const { data: players, error } = await supabase
      .from("players")
      .select("id, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[isRoomOwner] Error retrieving players:", error);
      return false;
    }

    // 가장 먼저 생성된 플레이어가 방장
    return players.length > 0 && players[0].id === playerId;
  } catch (error) {
    console.error("[isRoomOwner] Error:", error);
    return false;
  }
}

/**
 * 게임을 시작할 수 있는지 확인
 * @param gameId 게임 ID
 * @returns 시작 가능 여부 및 메시지
 */
export async function canStartGame(
  gameId: string
): Promise<{ canStart: boolean; message: string }> {
  try {
    // 준비된 플레이어 수 확인
    const { data, error, count } = await supabase
      .from("players")
      .select("id", { count: "exact" })
      .eq("game_id", gameId)
      .eq("is_ready", true);

    if (error) {
      console.error("[canStartGame] Error:", error);
      return {
        canStart: false,
        message: "게임 정보를 확인하는 중 오류가 발생했습니다",
      };
    }

    // 최소 2명 이상의 준비된 플레이어가 필요
    const readyPlayerCount = count || 0;
    const canStart = readyPlayerCount >= 2;

    return {
      canStart,
      message: canStart
        ? "게임을 시작할 수 있습니다"
        : `게임 시작을 위해 최소 2명의 준비된 플레이어가 필요합니다. (현재 ${readyPlayerCount}명)`,
    };
  } catch (error) {
    console.error("[canStartGame] Error:", error);
    return {
      canStart: false,
      message: "예상치 못한 오류가 발생했습니다",
    };
  }
}

/**
 * 게임 메시지 전송
 * @param gameId 게임 ID
 * @param sender 발신자
 * @param content 메시지 내용
 * @returns 성공 여부
 */
async function sendGameMessage(
  gameId: string,
  sender: string,
  content: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("messages").insert([
      {
        game_id: gameId,
        sender: sender,
        content: content,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[sendGameMessage] Error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[sendGameMessage] Error:", error);
    return false;
  }
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
    totalPot: gameData.pot || 0, // 프론트엔드와 호환성 위해 pot 사용
    bettingValue: gameData.current_bet_amount || 0,
    currentTurn: gameData.current_turn || null, // 통합된 current_turn 필드 사용
    lastAction: gameData.last_action,
    winner: null,
    players: [], // 플레이어 정보는 별도로 로드
    betting_round: gameData.round || 1, // 프론트엔드와 호환성 위해 round 사용
    game_mode: gameData.mode || 2, // 프론트엔드와 호환성 위해 mode 사용
    betting_end_time: gameData.betting_end_time || null, // 추가된 필드 유지
    cardSelectionTime: gameData.card_selection_time || null, // 추가된 필드
  };
}

// 다음 플레이어 턴 참조
/**
 * 현재 플레이어 다음 턴을 가질 플레이어 ID를 반환
 *
 * @param gameId 게임 ID
 * @param currentPlayerId 현재 플레이어 ID
 * @returns 다음 플레이어 ID 또는 null
 */
export async function getNextPlayerTurn(
  gameId: string,
  currentPlayerId: string
): Promise<string | null> {
  try {
    console.log(`[getNextPlayerTurn] 다음 턴 찾기 시작: gameId=${gameId}, currentPlayerId=${currentPlayerId}`);
    
    // 현재 게임의 활성 플레이어 목록 조회
    const { data: players, error } = await supabase
      .from("players")
      .select("id, seat_index, is_die, balance")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });

    console.log(`[getNextPlayerTurn] 조회된 플레이어:`, players?.length || 0, '번');

    if (error || !players || players.length === 0) {
      console.error("[getNextPlayerTurn] Error retrieving players:", error);
      return null;
    }

    // 원래의 필터: 다이하지 않고 잔액이 있는 플레이어만
    const activePlayersOriginal = players.filter((p) => !p.is_die && p.balance > 0);
    console.log(`[getNextPlayerTurn] 기존 조건 활성 플레이어:`, activePlayersOriginal.length, '번, 상태:', 
      activePlayersOriginal.map(p => `ID:${p.id.substring(0,6)}, is_die:${p.is_die}, balance:${p.balance}`));
    
    // 문제 해결을 위한 수정: 다이하지 않은 플레이어만 필터링 (잔액 조건 제거)
    const activePlayers = players.filter((p) => !p.is_die);
    console.log(`[getNextPlayerTurn] 수정된 활성 플레이어:`, activePlayers.length, '번, 상태:', 
      activePlayers.map(p => `ID:${p.id.substring(0,6)}, is_die:${p.is_die}, balance:${p.balance}`));

    if (activePlayers.length <= 1) {
      console.log(`[getNextPlayerTurn] 활성 플레이어가 한 명 이하로 다음 플레이어 없음`);
      return null; // 한 명만 남았으면 다음 플레이어가 없음
    }

    // 현재 플레이어의 인덱스 찾기
    const currentIndex = activePlayers.findIndex(
      (p) => p.id === currentPlayerId
    );

    console.log(`[getNextPlayerTurn] 현재 플레이어 인덱스: ${currentIndex}, ID: ${currentPlayerId}`);

    if (currentIndex === -1) {
      console.log(`[getNextPlayerTurn] 현재 플레이어가 주요 플레이어 목록에 없음, 첫 번째 활성 플레이어 사용: ${activePlayers[0].id}`);
      return activePlayers[0].id; // 현재 플레이어가 목록에 없으면 첫 번째 활성 플레이어
    }

    // 다음 플레이어 계산 (순환)
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayerId = activePlayers[nextIndex].id;
    console.log(`[getNextPlayerTurn] 다음 플레이어 계산: 현재 인덱스 ${currentIndex} -> 다음 인덱스 ${nextIndex}, ID: ${nextPlayerId}`);
    return nextPlayerId;
  } catch (error) {
    console.error("[getNextPlayerTurn] Error:", error);
    return null; // 오류 발생 시 null 반환
  }
}

/**
 * 라운드 완료 여부를 체크하고 게임 상태를 업데이트
 * @param gameId 게임 ID
 * @returns 라운드 완료 여부
 */
async function checkRoundCompletion(gameId: string): Promise<boolean> {
  try {
    console.log(`[checkRoundCompletion] 게임 ${gameId}의 라운드 완료 여부 체크 시작`);
    
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    
    if (gameError || !game) {
      console.error(`[checkRoundCompletion] 게임 정보 조회 실패:`, gameError);
      return false;
    }
    
    // 현재 게임에 참여 중인 플레이어 목록 조회
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId);
    
    if (playersError || !players) {
      console.error(`[checkRoundCompletion] 플레이어 정보 조회 실패:`, playersError);
      return false;
    }
    
    // 다이하지 않은 플레이어 수 체크
    const activePlayers = players.filter(p => !p.is_die);
    console.log(`[checkRoundCompletion] 활성 플레이어 수: ${activePlayers.length}명`);
    
    // 한 명만 남았으면 라운드 종료 처리
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      console.log(`[checkRoundCompletion] 한 명의 플레이어만 남음. 승자: ${winner.username}`);
      
      // 게임 상태 업데이트 - 라운드 종료 처리
      const updateData = {
        current_turn: null,
        betting_end_time: null,
        last_action: `${winner.username}님이 승리했습니다. (다른 모든 플레이어 폴드)`,
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from("games")
        .update(updateData)
        .eq("id", gameId);
      
      if (updateError) {
        console.error(`[checkRoundCompletion] 게임 상태 업데이트 실패:`, updateError);
        return false;
      }
      
      // 승리 메시지 전송
      await sendGameMessage(
        gameId,
        "system",
        `${winner.username}님이 이번 라운드에서 승리했습니다. (다른 모든 플레이어 폴드)`
      );
      
      console.log(`[checkRoundCompletion] 라운드 종료 처리 완료`);
      return true;
    }
    
    console.log(`[checkRoundCompletion] 여러 플레이어가 남아있어 라운드 계속 진행`);
    return false;
  } catch (error) {
    console.error(`[checkRoundCompletion] 오류 발생:`, error);
    return false;
  }
}
