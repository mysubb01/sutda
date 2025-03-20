'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameState } from '@/types/game';
import { getGameState } from '@/lib/gameApi';
import { supabase } from '@/lib/supabase';
import { subscribeToGameUpdates, subscribeToMessages } from '@/lib/realtimeUtils';
import { Player } from '@/components/Player';
import { Chat } from '@/components/Chat';
import { GameControls } from '@/components/GameControls';
import { CardPair } from '@/components/Card';
import { evaluateCards } from '@/utils/gameLogic';
import { RealtimeChannel } from '@supabase/supabase-js';

type GamePageClientProps = {
  gameId: string;
}

export default function GamePageClient({ gameId }: GamePageClientProps) {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const username = searchParams.get('username') || '';
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [gameChannel, setGameChannel] = useState<RealtimeChannel | null>(null);
  const [messageChannel, setMessageChannel] = useState<RealtimeChannel | null>(null);

  // 게임 상태 불러오기
  const fetchGameState = useCallback(async () => {
    try {
      const state = await getGameState(gameId);
      setGameState(state);
      setError(null);

      // 게임이 종료된 경우 카드 공개
      if (state.status === 'finished') {
        setShowAllCards(true);
      }
    } catch (err) {
      console.error('게임 상태 불러오기 오류:', err);
      setError('게임 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // 새 메시지 수신 처리
  const handleNewMessage = useCallback((payload: any) => {
    // Chat 컴포넌트에서 자체적으로 구독하므로 여기서는 필요 없음
    console.log('새 메시지 수신됨', payload);
  }, []);

  useEffect(() => {
    fetchGameState();
    
    // 실시간 업데이트 구독
    const gameSubscription = subscribeToGameUpdates(
      gameId,
      fetchGameState,  // 게임 상태 업데이트 시
      fetchGameState,  // 플레이어 정보 업데이트 시
      fetchGameState   // 게임 액션 업데이트 시
    );
    
    const msgSubscription = subscribeToMessages(
      gameId,
      handleNewMessage
    );
    
    setGameChannel(gameSubscription);
    setMessageChannel(msgSubscription);

    return () => {
      // 구독 정리
      if (gameSubscription) {
        supabase.removeChannel(gameSubscription);
      }
      if (msgSubscription) {
        supabase.removeChannel(msgSubscription);
      }
    };
  }, [gameId, fetchGameState, handleNewMessage]);
  
  // 현재 플레이어의 카드 정보
  const currentPlayer = gameState?.players.find(p => p.id === userId);
  let cardCombination = null;
  
  if (currentPlayer?.cards && currentPlayer.cards.length === 2) {
    cardCombination = evaluateCards(currentPlayer.cards);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        <div className="text-center">
          <p className="text-xl">게임을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        <div className="text-center">
          <p className="text-xl text-red-500 mb-4">{error || '게임을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">한국식 포커 - 섯다</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 왼쪽: 플레이어 목록 */}
          <div className="md:col-span-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameState.players.map(player => (
                <Player
                  key={player.id}
                  player={player}
                  isCurrentPlayer={player.id === userId}
                  isCurrentTurn={player.id === gameState.currentTurn}
                  showCards={showAllCards}
                />
              ))}
            </div>
            
            {/* 카드 조합 정보 */}
            {cardCombination && (
              <div className="p-4 bg-gray-700 rounded-lg">
                <h3 className="text-lg font-bold mb-2">내 카드 조합</h3>
                <div className="flex justify-between items-center">
                  <CardPair cards={cardCombination.cards} />
                  <div className="text-right">
                    <p className="font-bold text-yellow-400">{cardCombination.rank}</p>
                    <p className="text-sm text-gray-300">점수: {cardCombination.value}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 게임 컨트롤 */}
            <GameControls
              gameState={gameState}
              currentPlayerId={userId}
              onAction={fetchGameState}
            />
          </div>
          
          {/* 오른쪽: 채팅 */}
          <div className="h-[600px]">
            <Chat
              gameId={gameId}
              userId={userId}
              username={username}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 