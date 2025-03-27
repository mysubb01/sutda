import { supabase } from '../supabaseClient';
import { handleDatabaseError, handleGameError, ErrorType } from '../utils/errorHandlers';

/**
 * 특정 좌석이 이미 점유되었는지 확인
 * 
 * @param seatIndex 확인할 좌석 인덱스
 * @param gameId 게임 ID
 * @param currentPlayerId 현재 플레이어 ID (해당 플레이어가 이미 차지한 좌석은 점유되지 않은 것으로 간주)
 * @returns 좌석이 점유되었으면 true, 아니면 false
 */
export async function isSeatOccupied(
  seatIndex: number,
  gameId: string,
  currentPlayerId?: string
): Promise<boolean> {
  console.log(`[isSeatOccupied] Checking seat ${seatIndex} in game ${gameId}${currentPlayerId ? `, excluding player ${currentPlayerId}` : ''}`);
  
  try {
    // gameId 유효성 검증
    if (!gameId) {
      console.error('[isSeatOccupied] Invalid game ID: empty string');
      return false; // 게임 ID가 없으면 좌석이 점유되지 않은 것으로 간주
    }
    // 게임의 모든 플레이어 중 해당 좌석 번호를 가진 플레이어 찾기
    const { data: existingSeat, error } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .eq('seat_index', seatIndex);
    
    if (error) {
      console.error(`[isSeatOccupied] Error checking seat occupancy:`, error);
      throw handleDatabaseError(error, 'isSeatOccupied:query');
    }
    
    // 좌석이 비어있거나, 현재 플레이어의 좌석인 경우
    if (!existingSeat || existingSeat.length === 0) {
      console.log(`[isSeatOccupied] Seat ${seatIndex} is empty`);
      return false;
    }
    
    // 현재 플레이어 ID가 제공된 경우, 현재 플레이어가 해당 좌석을 차지하고 있는지 확인
    if (currentPlayerId) {
      const isOwnSeat = existingSeat.some((seat: {id: string}) => seat.id === currentPlayerId);
      if (isOwnSeat) {
        console.log(`[isSeatOccupied] Seat ${seatIndex} is occupied by the current player ${currentPlayerId}`);
        return false; // 자기 자신의 좌석은 점유되지 않은 것으로 간주
      }
    }
    
    console.log(`[isSeatOccupied] Seat ${seatIndex} is occupied by another player`);
    return true; // 다른 플레이어가 차지한 좌석
  } catch (err) {
    console.error(`[isSeatOccupied] Unexpected error:`, err);
    throw err;
  }
}

/**
 * 게임에서 비어있는 좌석 찾기
 * 
 * @param gameId 게임 ID
 * @returns 비어있는 첫 번째 좌석 인덱스, 없으면 null
 */
export async function findEmptySeat(gameId: string): Promise<number | null> {
  console.log(`[findEmptySeat] Finding empty seat for game ${gameId}`);
  
  try {
    // 게임의 모든 플레이어 좌석 조회
    const { data: occupiedSeats, error } = await supabase
      .from('players')
      .select('seat_index')
      .eq('game_id', gameId);
    
    if (error) {
      console.error(`[findEmptySeat] Error retrieving occupied seats:`, error);
      throw handleDatabaseError(error, 'findEmptySeat:query');
    }
    
    // 이미 차지된 좌석 번호들의 집합
    const occupiedSeatSet = new Set(occupiedSeats?.map((p: {seat_index: number}) => p.seat_index) || []);
    
    // 사용 가능한 좌석 범위 (0-7)
    const MAX_SEATS = 8;
    
    // 빈 좌석 찾기 (0부터 7까지 순차적으로 확인)
    for (let i = 0; i < MAX_SEATS; i++) {
      if (!occupiedSeatSet.has(i)) {
        console.log(`[findEmptySeat] Found empty seat at index ${i}`);
        return i;
      }
    }
    
    console.log(`[findEmptySeat] No empty seats available`);
    return null; // 빈 좌석 없음
  } catch (err) {
    console.error(`[findEmptySeat] Unexpected error:`, err);
    throw err;
  }
}

/**
 * 플레이어의 좌석 변경
 * 
 * @param playerId 플레이어 ID
 * @param newSeatIndex 새 좌석 인덱스
 * @param gameId 게임 ID
 * @returns 성공 여부
 */
/**
 * 플레이어 좌석 업데이트 - 통합 함수
 * gameId와 roomId 모두 처리 가능하도록 구현된 함수
 * 
 * @param gameId 게임 ID (null일 경우 roomId 사용)
 * @param playerId 플레이어 ID
 * @param seatIndex 좌석 인덱스
 * @param roomId 방 ID (선택적)
 * @returns 성공 여부
 */
export async function updateSeat(
  gameId: string | null, 
  playerId: string, 
  seatIndex: number,
  roomId?: string
): Promise<boolean> {
  console.log(`[updateSeat] Updating seat for player ${playerId} to ${seatIndex} in ${gameId ? `game ${gameId}` : `room ${roomId}`}`);
  
  try {
    // 입력값 검증
    if (!gameId && !roomId) {
      throw handleGameError(new Error('게임 ID 또는 방 ID가 필요합니다.'), ErrorType.VALIDATION, 'updateSeat');
    }
    
    // 좌석 점유 여부 확인
    let isOccupied = false;
    if (gameId) {
      console.log(`[updateSeat] Checking if seat ${seatIndex} is occupied in game ${gameId} by any player other than ${playerId}`);
      isOccupied = await isSeatOccupied(seatIndex, gameId, playerId);
    } else if (roomId) {
      // 방에서 좌석 점유 확인 로직
      const { data, error } = await supabase
        .from('room_players')
        .select('id')
        .eq('room_id', roomId)
        .eq('seat_index', seatIndex)
        .neq('player_id', playerId);
      
      if (error) {
        throw handleDatabaseError(error, 'updateSeat:check_room_seat');
      }
      
      isOccupied = data && data.length > 0;
    }
    
    if (isOccupied) {
      console.error(`[updateSeat] Seat ${seatIndex} is already occupied`);
      throw handleGameError(
        new Error(`좌석 ${seatIndex}은 이미 다른 플레이어가 사용 중입니다`),
        ErrorType.INVALID_STATE,
        '이미 다른 플레이어가 사용 중인 좌석입니다'
      );
    }
    
    // 데이터베이스 업데이트
    let updateResult;
    if (gameId) {
      updateResult = await supabase
        .from('players')
        .update({ seat_index: seatIndex })
        .eq('id', playerId)
        .eq('game_id', gameId);
    } else if (roomId) {
      updateResult = await supabase
        .from('room_players')
        .update({ seat_index: seatIndex })
        .eq('player_id', playerId)
        .eq('room_id', roomId);
    }
    
    if (updateResult?.error) {
      console.error(`[updateSeat] Error updating seat:`, updateResult.error);
      throw handleDatabaseError(updateResult.error, 'updateSeat:update');
    }
    
    console.log(`[updateSeat] Successfully updated seat for player ${playerId} to ${seatIndex}`);
    return true;
  } catch (error) {
    console.error(`[updateSeat] Unexpected error:`, error);
    throw error;
  }
}

export async function changeSeat(
  playerId: string,
  newSeatIndex: number,
  gameId: string
): Promise<boolean> {
  console.log(`[changeSeat] Changing seat for player ${playerId} to seat ${newSeatIndex} in game ${gameId}`);
  
  try {
    // 새 좌석이 이미 차지되었는지 확인
    const isOccupied = await isSeatOccupied(newSeatIndex, gameId, playerId);
    
    if (isOccupied) {
      console.error(`[changeSeat] Seat ${newSeatIndex} is already occupied by another player`);
      return false;
    }
    
    // 좌석 변경
    const { error } = await supabase
      .from('players')
      .update({ 
        seat_index: newSeatIndex,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId)
      .eq('game_id', gameId);
    
    if (error) {
      console.error(`[changeSeat] Error updating seat:`, error);
      throw handleDatabaseError(error, 'changeSeat:update');
    }
    
    console.log(`[changeSeat] Successfully changed seat for player ${playerId} to ${newSeatIndex}`);
    return true;
  } catch (err) {
    console.error(`[changeSeat] Unexpected error:`, err);
    throw err;
  }
}
