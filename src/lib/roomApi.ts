import { supabase } from './supabase';
import { Room, CreateRoomResponse, JoinRoomResponse, GameMode, Player } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';

/**
 * 모든 방 목록 조회
 */
export async function getAllRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, players:players(id)')  // 플레이어 수 계산을 위해 플레이어 정보도 가져옴
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('방 목록 조회 오류:', error);
    throw new Error('방 목록을 불러올 수 없습니다.');
  }

  // 각 방의 현재 플레이어 수 계산
  const roomsWithPlayerCount = (data || []).map(room => ({
    ...room,
    current_players: Array.isArray(room.players) ? room.players.length : 0,
    players: undefined  // API 응답에서 players 배열 제거
  }));

  return roomsWithPlayerCount;
}

/**
 * 새로운 방 생성
 */
export async function createRoom(
  name: string,
  mode: GameMode,
  entry_fee: number,
  betting_option: 'standard' | 'step_by_step' = 'standard'
): Promise<CreateRoomResponse> {
  const roomId = uuidv4();

  try {
    // 방 생성
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        name,
        mode,
        entry_fee,
        betting_option,
        is_active: true
      })
      .select();

    if (error) {
      console.error('방 생성 오류:', error);
      throw new Error('방을 생성할 수 없습니다: ' + error.message);
    }
    
    // 방과 동일한 ID로 게임 생성
    const { error: gameError } = await supabase
      .from('games')
      .insert({
        id: roomId,  // 방 ID와 동일한 ID 사용
        room_id: roomId,
        status: 'waiting',
        betting_value: 0,
        base_bet: 1000,
        total_pot: 0,
        room_name: name // 방 이름도 저장
      });

    if (gameError) {
      console.error('게임 생성 오류:', gameError);
      throw new Error('게임을 생성할 수 없습니다: ' + gameError.message);
    }
    
    // 방장 플레이어 생성 (임시 사용자명 사용)
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    const playerId = uuidv4();
    const username = '방장'; // 기본 사용자명
    
    // 임시 사용자 잔액 설정 (실제 구현에서는 인증 시스템 사용)
    const userBalance = 100000;
    const newBalance = userBalance - entry_fee;
    
    // 방장 플레이어 정보 추가
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_id: roomId,
        game_id: roomId,
        user_id: userId,
        username,
        balance: newBalance,
        seat_index: 0, // 방장은 0번 자리에 배치
        is_ready: true // 방장은 항상 준비됨
      });
      
    if (playerError) {
      console.error('방장 플레이어 생성 오류:', playerError);
      throw new Error('방장 플레이어를 생성할 수 없습니다: ' + playerError.message);
    }
    
    // 브라우저에서 실행 중인 경우에만 localStorage 사용
    if (typeof window !== 'undefined') {
      // 로컬 스토리지에 방장 정보 저장
      localStorage.setItem(`game_${roomId}_player_id`, playerId);
      localStorage.setItem(`game_${roomId}_username`, username);
    }

    console.log('방 및 게임 생성 성공:', roomId);
    return { roomId };
  } catch (err) {
    console.error('방 생성 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 방 입장하기
 */
export async function joinRoom(
  roomId: string,
  username: string,
  seatIndex?: number
): Promise<JoinRoomResponse> {
  try {
    // 방 정보 조회
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      console.error('방 조회 오류:', roomError);
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 사용자 잔액 확인 (실제 구현에서는 인증 시스템과 연동)
    // 현재는 간단히 10만으로 설정
    const userBalance = 100000;
    
    if (userBalance < roomData.entry_fee) {
      throw new Error('잔액이 부족하여 이 방에 입장할 수 없습니다.');
    }

    // 임시 사용자 ID 생성 (실제 구현시 인증 시스템 연동)
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    const playerId = uuidv4();

    // 참가비 차감
    const newBalance = userBalance - roomData.entry_fee;

    // 플레이어 생성 - 아직 게임 참여는 아님 (방에만 입장)
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_id: roomId,
        game_id: roomId, // 방 ID와 동일한 ID 사용
        user_id: userId,
        username: username,
        balance: newBalance,
        seat_index: seatIndex !== undefined ? seatIndex : null,
        is_ready: false // 준비 상태 기본값 false
      });

    if (playerError) {
      console.error('플레이어 생성 오류:', playerError);
      throw new Error('방에 입장할 수 없습니다: ' + playerError.message);
    }

    // 브라우저에서 실행 중인 경우에만 localStorage 사용
    if (typeof window !== 'undefined') {
      // 로컬 스토리지에 사용자 정보 저장 (게임 페이지에서 사용)
      localStorage.setItem(`game_${roomId}_player_id`, playerId);
      localStorage.setItem(`game_${roomId}_username`, username);
    }

    return { playerId, roomId };
  } catch (err) {
    console.error('방 입장 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 방 정보 조회
 */
export async function getRoomInfo(roomId: string): Promise<Room> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, players:players(id)')
      .eq('id', roomId)
      .single();
    
    if (error || !data) {
      console.error('방 정보 조회 오류:', error);
      throw new Error('방 정보를 불러올 수 없습니다.');
    }

    // 플레이어 수 계산
    const room: Room = {
      ...data,
      current_players: Array.isArray(data.players) ? data.players.length : 0,
      players: undefined  // API 응답에서 players 배열 제거
    };

    return room;
  } catch (err) {
    console.error('방 정보 조회 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 방 나가기
 */
export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  try {
    // 플레이어 정보 조회
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('room_id', roomId)
      .single();
    
    if (playerError) {
      console.error('플레이어 정보 조회 오류:', playerError);
      throw new Error('플레이어 정보를 조회할 수 없습니다.');
    }
    
    // 방장(seat_index = 0)인 경우 새로운 방장을 선출
    if (playerData.seat_index === 0) {
      // 다른 플레이어 조회
      const { data: otherPlayers, error: otherPlayersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .neq('id', playerId)
        .order('created_at', { ascending: true });
      
      if (otherPlayersError) {
        console.error('다른 플레이어 조회 오류:', otherPlayersError);
        throw new Error('다른 플레이어를 조회할 수 없습니다.');
      }
      
      // 다른 플레이어가 있는 경우 새로운 방장을 선출
      if (otherPlayers && otherPlayers.length > 0) {
        const newOwner = otherPlayers[0]; // 새로운 방장
        
        // 새로운 방장의 seat_index를 0으로 업데이트
        const { error: updateError } = await supabase
          .from('players')
          .update({ seat_index: 0 })
          .eq('id', newOwner.id);
        
        if (updateError) {
          console.error('새로운 방장 업데이트 오류:', updateError);
          throw new Error('새로운 방장을 선출할 수 없습니다.');
        }
      } else {
        // 다른 플레이어가 없는 경우 방을 비활성화
        const { error: roomUpdateError } = await supabase
          .from('rooms')
          .update({ is_active: false })
          .eq('id', roomId);
        
        if (roomUpdateError) {
          console.error('방 비활성화 오류:', roomUpdateError);
        }
      }
    }
    
    // 플레이어 삭제
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('room_id', roomId);
    
    if (deleteError) {
      console.error('플레이어 삭제 오류:', deleteError);
      throw new Error('플레이어를 삭제할 수 없습니다.');
    }
  } catch (err) {
    console.error('방 나가기 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 게임 생성 (방 내에서 새 게임 시작)
 */
export async function createGameInRoom(roomId: string): Promise<string> {
  try {
    // 방 정보 조회
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    const gameId = uuidv4();

    // 게임 생성
    const { error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        room_id: roomId,
        status: 'waiting',
        betting_value: 0,
        base_bet: 1000,
        total_pot: 0
      });

    if (gameError) {
      throw new Error('게임을 생성할 수 없습니다: ' + gameError.message);
    }

    return gameId;
  } catch (err) {
    console.error('게임 생성 중 오류 발생:', err);
    throw err;
  }
}

/**
 * 방에 입장한 플레이어 목록 조회
 */
export async function getRoomPlayers(roomId: string): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId);
    
    if (error) {
      console.error('플레이어 목록 조회 오류:', error);
      throw new Error('플레이어 목록을 불러올 수 없습니다.');
    }

    return data || [];
  } catch (err) {
    console.error('플레이어 목록 조회 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 플레이어 준비 상태 변경
 */
export async function togglePlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('players')
      .update({ is_ready: isReady })
      .eq('id', playerId)
      .eq('room_id', roomId);
    
    if (error) {
      console.error('준비 상태 변경 오류:', error);
      throw new Error('준비 상태를 변경할 수 없습니다.');
    }
  } catch (err) {
    console.error('준비 상태 변경 중 예외 발생:', err);
    throw err;
  }
}

/**
 * 방 접근 가능 여부 확인 (방장만 접근 가능)
 */
export async function checkRoomAccess(roomId: string, playerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('room_id', roomId)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('방 접근 가능 여부 확인 중 오류 발생:', err);
    return false;
  }
}
