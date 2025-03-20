import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

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
  });
  
  console.log('Subscription status:', status);
  return channel;
}

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
  });
  
  console.log('Message subscription status:', status);
  return channel;
}