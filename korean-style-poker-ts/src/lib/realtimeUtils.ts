import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * 게임 관련 실시간 업데이트를 위한 구독을 생성합니다.
 * 
 * @param gameId 게임 ID
 * @param onGameUpdate 게임 상태 업데이트 콜백
 * @param onPlayerUpdate 플레이어 정보 업데이트 콜백
 * @param onActionUpdate 게임 액션 업데이트 콜백
 * @returns 구독 채널 객체
 */
export function subscribeToGameUpdates(
  gameId: string,
  onGameUpdate?: () => void,
  onPlayerUpdate?: () => void,
  onActionUpdate?: () => void
): RealtimeChannel {
  const channel = supabase
    .channel(`game:${gameId}`)
    // 게임 상태 변경 구독
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'games',
      filter: `id=eq.${gameId}`
    }, () => {
      console.log('게임 상태 변경 감지');
      onGameUpdate?.();
    })
    // 플레이어 정보 변경 구독
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'players',
      filter: `game_id=eq.${gameId}`
    }, () => {
      console.log('플레이어 정보 변경 감지');
      onPlayerUpdate?.();
    })
    // 게임 액션 변경 구독
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'game_actions',
      filter: `game_id=eq.${gameId}`
    }, () => {
      console.log('게임 액션 변경 감지');
      onActionUpdate?.();
    })
    .subscribe((status) => {
      console.log(`Supabase 실시간 연결 상태: ${status}`);
    });

  return channel;
}

/**
 * 채팅 메시지에 대한 실시간 업데이트를 위한 구독을 생성합니다.
 * 
 * @param gameId 게임 ID
 * @param onMessageReceived 새 메시지 수신 콜백
 * @returns 구독 채널 객체
 */
export function subscribeToMessages(
  gameId: string,
  onMessageReceived: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`messages:${gameId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      console.log('새 메시지 수신');
      onMessageReceived(payload);
    })
    .subscribe();

  return channel;
}

/**
 * 구독 채널을 정리합니다.
 * 
 * @param channel 제거할 채널 객체
 */
export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

/**
 * Supabase 실시간 연결 상태를 확인합니다.
 * 
 * @returns 연결 상태가 정상인지 여부
 */
export async function checkRealtimeConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('games').select('id').limit(1);
    
    if (error) {
      console.error('Supabase 연결 오류:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Supabase 연결 확인 중 오류:', err);
    return false;
  }
}