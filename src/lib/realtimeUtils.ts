import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * 게임 업데이트 구독 함수
 * 게임, 플레이어, 게임 액션의 변경을 실시간으로 구독합니다.
 */
export function subscribeToGameUpdates(
  gameId: string,
  onGameUpdate: (payload: any) => void,
  onPlayerUpdate: (payload: any) => void,
  onActionUpdate: (payload: any) => void
): RealtimeChannel {
  console.log(`Subscribing to game updates for game ${gameId}`);
  
  const channel = supabase
    .channel(`game-${gameId}`)
    // 게임 테이블 변경 구독
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, (payload) => {
      console.log('Game update received:', payload);
      onGameUpdate(payload);
    })
    // 플레이어 테이블 변경 구독
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      console.log('Player update received:', payload);
      onPlayerUpdate(payload);
    })
    // 게임 액션 테이블 변경 구독
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_actions',
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      console.log('Action update received:', payload);
      onActionUpdate(payload);
    });
    
  const status = channel.subscribe((status) => {
    console.log(`Game channel subscription status: ${status}`);
    
    // 상태 변경 로그 출력
    if (status === 'SUBSCRIBED') {
      console.log('✅ Successfully subscribed to game updates');
    } else if (status === 'TIMED_OUT') {
      console.error('⚠️ Subscription timed out. Trying to reconnect...');
      // 재연결 시도
      channel.subscribe();
    } else if (status === 'CLOSED') {
      console.error('❌ Connection closed');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Channel error occurred');
    }
  });
  
  console.log('Subscription status:', status);
  return channel;
}

/**
 * 메시지 업데이트 구독 함수
 * 특정 게임의 새 메시지를 실시간으로 구독합니다.
 */
export function subscribeToMessages(
  gameId: string,
  onNewMessage: (payload: any) => void
): RealtimeChannel {
  console.log(`Subscribing to messages for game ${gameId}`);
  
  const channel = supabase
    .channel(`messages-${gameId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      console.log('New message received:', payload);
      onNewMessage(payload);
    });
    
  const status = channel.subscribe((status) => {
    console.log(`Message channel subscription status: ${status}`);
    
    // 상태 변경 로그 출력
    if (status === 'SUBSCRIBED') {
      console.log('✅ Successfully subscribed to message updates');
    } else if (status === 'TIMED_OUT') {
      console.error('⚠️ Message subscription timed out. Trying to reconnect...');
      // 재연결 시도
      channel.subscribe();
    }
  });
  
  console.log('Message subscription status:', status);
  return channel;
}

/**
 * 구독 취소 함수
 * 채널 구독을 안전하게 해제합니다.
 * @param channel 구독 해제할 채널
 */
export function unsubscribe(channel: RealtimeChannel | null): void {
  if (!channel) return;
  
  console.log('Unsubscribing from channel:', channel.topic);
  try {
    supabase.removeChannel(channel);
    console.log('Successfully unsubscribed from channel');
  } catch (error) {
    console.error('Error unsubscribing from channel:', error);
  }
}

/**
 * 실시간 기능 테스트
 * @param gameId 게임 ID
 */
export async function testRealtimeConnection(gameId: string): Promise<boolean> {
  try {
    // 테스트 메시지 전송
    const { data, error } = await supabase
      .from('messages')
      .insert([
        { 
          game_id: gameId, 
          user_id: 'system_test', 
          username: '시스템', 
          content: '실시간 연결 테스트 중...' 
        }
      ]);
      
    if (error) {
      console.error('Realtime test failed:', error);
      return false;
    }
    
    console.log('Realtime test message sent successfully:', data);
    return true;
  } catch (err) {
    console.error('Error testing realtime connection:', err);
    return false;
  }
}