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
  const roomsWithPlayerCount = (data || []).map(room => {
    const playerCount = Array.isArray(room.players) ? room.players.length : 0;
    
    // 플레이어가 0명인 방은 비활성화 처리 (삭제는 아님)
    if (playerCount === 0) {
      // 비활성화 처리
      supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', room.id)
        .then(({ error }) => {
          if (error) {
            console.error(`방 ${room.id} 비활성화 오류:`, error);
          } else {
            console.log(`방 ${room.id} 비활성화 처리 (플레이어 0명)`);
          }
        });
      
      // 게임도 종료 처리
      supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', room.id)
        .then(({ error }) => {
          if (error) {
            console.error(`게임 ${room.id} 종료 오류:`, error);
          }
        });
    }
    
    return {
      ...room,
      current_players: playerCount,
      players: undefined  // API 응답에서 players 배열 제거
    };
  });

  // 플레이어가 1명 이상이며 디버그용 방이 아닌 방만 반환
  return roomsWithPlayerCount.filter(room => {
    // 플레이어 수 필터링
    if (room.current_players <= 0) return false;
    
    // 디버그용 방 필터링
    // 방 이름에 'debug', '디버그', '테스트' 등이 포함된 경우
    const roomName = (room.name || '').toLowerCase();
    if (roomName.includes('debug') || roomName.includes('디버그') || roomName.includes('test') || roomName.includes('테스트')) {
      return false;
    }
    
    // room_metadata에 is_debug 플래그가 있을 경우
    const metadata = room.metadata || {};
    if (metadata.is_debug === true) {
      return false;
    }
    
    // 특정 URL 경로로 접근한 방인 경우 (URL에 debug 포함)
    const referer = metadata.referer || '';
    if (referer.includes('/debug/')) {
      return false;
    }
    
    return true;
  });
}

/**
 * 새로운 방 생성
 */
export async function createRoom(
  name: string,
  mode: GameMode,
  entry_fee: number, // 입장료는 0으로 설정, 게임 시작 시에만 입장료가 부과됨
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
        entry_fee: 0, // 방 생성 시 입장료는 0으로 설정
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
        base_bet: entry_fee, // 입장료는 게임 시작 시에만 부과됨
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
    
    // 방장 플레이어 정보 추가
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_id: roomId,
        game_id: roomId,
        user_id: userId,
        username,
        balance: userBalance, // 잔액은 게임 시작 시에만 변경됨
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

    // 사용자 잔액 설정 (실제 구현에서는 인증 시스템과 연동)
    // 현재는 간단히 10만으로 설정
    const userBalance = 100000;
    
    // 임시 사용자 ID 생성 (실제 구현시 인증 시스템 연동)
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    const playerId = uuidv4();

    // 방 입장은 무료로 변경
    // 플레이어 생성 - 방에만 입장 (게임 시작 시 참가비 지불)
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_id: roomId,
        game_id: roomId, // 방 ID와 동일한 ID 사용
        user_id: userId,
        username: username,
        balance: userBalance, // 방 입장은 무료로 변경
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
    // 플레이어 제거
    const { error: playerError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('room_id', roomId);

    if (playerError) {
      console.error('플레이어 제거 오류:', playerError);
      throw new Error('방에서 나갈 수 없습니다: ' + playerError.message);
    }

    // 방에 남은 플레이어 확인
    const { data: remainingPlayers, error: countError } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId);

    if (countError) {
      console.error('남은 플레이어 확인 오류:', countError);
      return;
    }

    // 방에 플레이어가 없으면 방을 비활성화
    if (!remainingPlayers || remainingPlayers.length === 0) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', roomId);

      if (roomError) {
        console.error('방 비활성화 오류:', roomError);
      } else {
        console.log(`방 ${roomId}이(가) 비활성화되었습니다 (플레이어 0명)`);  
      }

      // 게임도 종료 처리
      const { error: gameError } = await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', roomId);

      if (gameError) {
        console.error('게임 종료 오류:', gameError);
      }
    }

    // 브라우저에서 실행 중인 경우에만 localStorage 사용
    if (typeof window !== 'undefined') {
      // 로컬 스토리지에서 플레이어 정보 제거
      localStorage.removeItem(`game_${roomId}_player_id`);
      localStorage.removeItem(`game_${roomId}_username`);
    }

    console.log(`플레이어 ${playerId}가 방 ${roomId}에서 나갔습니다.`);
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

    // 새 게임 생성 (이미 방장은 있음)
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert({
        room_id: roomId,
        status: 'waiting',
        betting_value: 0,
        base_bet: roomData.entry_fee, // 입장료는 게임 시작 시에만 부과됨
        total_pot: 0,
        room_name: roomData.name // 방 이름도 저장
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

/**
 * 플레이어 좌석 변경
 * @deprecated gameApi.ts의 updateSeat 함수를 대신 사용할 것
 */
export async function changeSeat(roomId: string, playerId: string, newSeatIndex: number): Promise<void> {
  console.log(`[DEPRECATED] changeSeat in roomApi.ts is called. Use updateSeat from gameApi.ts instead`);
  
  // gameApi의 updateSeat 함수를 직접 import하여 사용합니다.
  const { updateSeat } = await import('./gameApi');
  
  try {
    const result = await updateSeat(null, playerId, newSeatIndex, roomId);
    if (!result) {
      throw new Error('좌석 변경에 실패했습니다.');
    }
  } catch (error) {
    console.error('좌석 변경 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 플레이어 하트비트 업데이트
 * 플레이어의 마지막 활동 시간을 업데이트합니다.
 */
export async function updatePlayerHeartbeat(playerId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('players')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('id', playerId);

    if (error) {
      console.error('플레이어 하트비트 업데이트 오류:', error);
    }
  } catch (err) {
    console.error('하트비트 업데이트 중 예외 발생:', err);
  }
}

/**
 * 플레이어 비활성화 처리
 * 2분 동안 활동하지 않은 플레이어를 비활성화 처리합니다.
 */
export async function cleanupInactivePlayers(): Promise<void> {
  try {
    // 2분(120초) 동안 활동하지 않은 플레이어를 비활성화 처리
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 2);
    
    const { data: inactivePlayers, error } = await supabase
      .from('players')
      .select('id, room_id, username, last_heartbeat')
      .lt('last_heartbeat', cutoffTime.toISOString());
    
    if (error) {
      console.error('플레이어 비활성화 처리 오류:', error);
      return;
    }
    
    console.log(`비활성화 플레이어 ${inactivePlayers?.length || 0}명`);
    
    // 비활성화 플레이어 처리
    if (inactivePlayers && inactivePlayers.length > 0) {
      for (const player of inactivePlayers) {
        console.log(`플레이어 ${player.username} (${player.id})을(를) 비활성화 처리`);
        await leaveRoom(player.room_id, player.id);
      }
    }
  } catch (err) {
    console.error('비활성화 처리 중 예외 발생:', err);
  }
}

/**
 * 방 비활성화 처리
 * 비활성화 처리된 방을 삭제합니다.
 */
export async function cleanupRooms(): Promise<void> {
  try {
    console.log('방 비활성화 처리 시작');
    
    // 1. 비활성화된 방을 삭제
    const { data: activeRooms, error: activeRoomsError } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('is_active', true);
    
    if (activeRoomsError) {
      console.error('활성화된 방 목록 조회 오류:', activeRoomsError);
      return;
    }
    
    // 활성화된 방에 플레이어가 0명인 경우 비활성화 처리
    for (const room of activeRooms || []) {
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id);
      
      if (playersError) {
        console.error(`방 ${room.id} 플레이어 목록 조회 오류:`, playersError);
        continue;
      }
      
      const playerCount = players?.length || 0;
      
      // 방에 플레이어가 0명인 경우 비활성화 처리
      if (playerCount === 0) {
        console.log(`방 ${room.id}에 플레이어가 0명, 비활성화 처리`);
        
        const { error: updateError } = await supabase
          .from('rooms')
          .update({ is_active: false })
          .eq('id', room.id);
        
        if (updateError) {
          console.error(`방 ${room.id} 비활성화 오류:`, updateError);
        }
        
        // 게임도 종료 처리
        const { error: gameError } = await supabase
          .from('games')
          .update({ status: 'finished' })
          .eq('id', room.id);
        
        if (gameError) {
          console.error(`게임 ${room.id} 종료 오류:`, gameError);
        }
      }
    }
    
    console.log('방 비활성화 처리 완료');
  } catch (err) {
    console.error('방 비활성화 처리 중 예외 발생:', err);
  }
}
