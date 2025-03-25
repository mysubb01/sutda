import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { leaveRoom } from './roomApi';

// 연결 상태 추적을 위한 데이터 구조
interface PresenceState {
  playerId: string;
  roomId: string;
  username: string;
  lastActive: number;
}

// 채널별 추적 상태 저장
const channelStates: Record<string, {
  channel: RealtimeChannel;
  timeoutId?: NodeJS.Timeout;
  checkIntervalId?: NodeJS.Timeout;
}> = {};

/**
 * 플레이어 연결 상태 추적 시작
 * @param roomId 방 ID
 * @param playerId 플레이어 ID
 * @param username 사용자명
 * @param onDisconnect 연결 끊김 처리 콜백 (선택적)
 */
export function trackPlayerPresence(
  roomId: string,
  playerId: string,
  username: string,
  onDisconnect?: (playerId: string, roomId: string) => void
): RealtimeChannel {
  console.log(`Starting presence tracking for player ${playerId} in room ${roomId}`);
  
  const channelKey = `presence-${roomId}-${playerId}`;
  
  // 이미 존재하는 채널이 있으면 재사용
  if (channelStates[channelKey]) {
    updatePresence(channelStates[channelKey].channel, { playerId, roomId, username });
    return channelStates[channelKey].channel;
  }
  
  // 새 Presence 채널 생성
  const channel = supabase.channel(channelKey, {
    config: {
      presence: {
        key: playerId,
      },
    },
  });
  
  // 플레이어 상태 데이터
  const presenceState: PresenceState = {
    playerId,
    roomId,
    username,
    lastActive: Date.now(),
  };
  
  // Presence 이벤트 구독
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log('Presence state synced:', state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log(`User ${key} joined with state:`, newPresences);
    })
    .on('presence', { event: 'leave' }, async ({ key, leftPresences }) => {
      console.log(`User ${key} left with state:`, leftPresences);
      
      // 연결이 끊긴 경우, 일정 시간 후에 자동으로 방에서 퇴장 처리
      if (key === playerId) {
        const timeoutId = setTimeout(async () => {
          console.log(`User ${playerId} considered disconnected, leaving room ${roomId}`);
          
          try {
            // 방에서 플레이어 제거
            await leaveRoom(roomId, playerId);
            
            // 콜백 호출
            if (onDisconnect) {
              onDisconnect(playerId, roomId);
            }
          } catch (err) {
            console.error('Error removing disconnected player:', err);
          }
          
          // 채널 정리
          cleanupChannel(channelKey);
        }, 10000); // 10초 후 퇴장 처리 (필요에 따라 조정)
        
        // 타임아웃 ID 저장
        channelStates[channelKey].timeoutId = timeoutId;
      }
    });
  
  // 채널 구독
  channel.subscribe(async (status) => {
    console.log(`Presence channel status: ${status}`);
    
    if (status === 'SUBSCRIBED') {
      // 연결 상태 추적 시작
      updatePresence(channel, presenceState);
      
      // 주기적인 하트비트 설정 (30초마다)
      const intervalId = setInterval(() => {
        updatePresence(channel, { ...presenceState, lastActive: Date.now() });
      }, 30000);
      
      channelStates[channelKey].checkIntervalId = intervalId;
    }
  });
  
  // 채널 상태 저장
  channelStates[channelKey] = {
    channel,
    timeoutId: undefined,
    checkIntervalId: undefined,
  };
  
  return channel;
}

/**
 * Presence 상태 업데이트
 */
function updatePresence(channel: RealtimeChannel, state: Partial<PresenceState>): void {
  try {
    channel.track(state);
  } catch (err) {
    console.error('Error updating presence state:', err);
  }
}

/**
 * 연결 추적 중지 및 정리
 */
export function stopTracking(roomId: string, playerId: string): void {
  const channelKey = `presence-${roomId}-${playerId}`;
  cleanupChannel(channelKey);
}

/**
 * 채널 정리 및 제거
 */
function cleanupChannel(channelKey: string): void {
  const channelState = channelStates[channelKey];
  if (!channelState) return;
  
  // 타임아웃 제거
  if (channelState.timeoutId) {
    clearTimeout(channelState.timeoutId);
  }
  
  // 인터벌 제거
  if (channelState.checkIntervalId) {
    clearInterval(channelState.checkIntervalId);
  }
  
  // 채널 제거
  try {
    supabase.removeChannel(channelState.channel);
  } catch (err) {
    console.error('Error removing presence channel:', err);
  }
  
  // 상태 객체에서 제거
  delete channelStates[channelKey];
}

/**
 * 모든 방의 비활성 플레이어 확인 및 정리를 위한 서버 기능
 * (서버 측에서 주기적으로 실행)
 */
export async function cleanupInactivePlayersServerSide(): Promise<void> {
  try {
    console.log('Checking for inactive players...');
    
    // 3분(180초) 이상 활동이 없는 플레이어를 비활성 상태로 간주
    const inactiveThreshold = Date.now() - 180000;
    
    // DB에서 플레이어 상태를 확인하고 오래된 연결 정리
    const { data: players, error } = await supabase
      .from('players')
      .select('id, room_id, last_heartbeat');
    
    if (error) {
      console.error('Error fetching players for cleanup:', error);
      return;
    }
    
    // 비활성 플레이어 필터링
    const inactivePlayers = players.filter(player => {
      // last_heartbeat가 없거나 오래된 경우
      if (!player.last_heartbeat) return false;
      
      const lastActive = new Date(player.last_heartbeat).getTime();
      return lastActive < inactiveThreshold;
    });
    
    console.log(`Found ${inactivePlayers.length} inactive players`);
    
    // 비활성 플레이어 정리
    for (const player of inactivePlayers) {
      try {
        await leaveRoom(player.room_id, player.id);
        console.log(`Removed inactive player ${player.id} from room ${player.room_id}`);
      } catch (err) {
        console.error(`Error removing inactive player ${player.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error in inactive player cleanup:', err);
  }
}
