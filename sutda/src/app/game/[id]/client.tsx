'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameState } from '@/types/game';
import { getGameState, joinGame } from '@/lib/gameApi';
import { supabase } from '@/lib/supabase';
import { subscribeToGameUpdates, subscribeToMessages } from '@/lib/realtimeUtils';
import { GameTable } from '@/components/GameTable';
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
  const router = useRouter();
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

  // 게임 참가 처리
  const handleJoinGame = async () => {
    if (!userId || !username) {
      alert('사용자 정보가 없습니다. 홈 페이지로 이동합니다.');
      router.push('/');
      return;
    }
    
    try {
      setIsLoading(true);
      await joinGame(gameId, userId, username);
      await fetchGameState();
    } catch (err) {
      console.error('게임 참가 오류:', err);
      setError('게임에 참가할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 새 메시지 수신 처리
  const handleNewMessage = useCallback((payload: any) => {
    console.log('새 메시지 수신됨', payload);
  }, []);

  useEffect(() => {
    console.log('Setting up game with ID:', gameId);
    fetchGameState();
    
    // 실시간 업데이트 구독
    const gameSubscription = subscribeToGameUpdates(
      gameId,
      (payload) => {
        console.log('Game state updated:', payload);
        fetchGameState();
      },
      (payload) => {
        console.log('Player updated:', payload);
        fetchGameState();
      },
      (payload) => {
        console.log('Action received:', payload);
        fetchGameState();
      }
    );
    
    const msgSubscription = subscribeToMessages(
      gameId,
      (payload) => {
        console.log('Message received in game component:', payload);
        handleNewMessage(payload);
      }
    );
    
    setGameChannel(gameSubscription);
    setMessageChannel(msgSubscription);

    return () => {
      if (gameSubscription) {
        console.log('Removing game subscription');
        supabase.removeChannel(gameSubscription);
      }
      if (msgSubscription) {
        console.log('Removing message subscription');
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
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white p-4 relative"
      style={{
        backgroundImage: 'url(/images/ui/bgM.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      <div className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold mb-2 text-center text-yellow-400">한국식 포커 - 섯다</h1>
        
        {/* 게임 ID와 정보 */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-300">게임 ID: {gameId} | 상태: {translateStatus(gameState.status)}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 왼쪽: 게임 테이블과 컨트롤 */}
          <div className="md:col-span-3 space-y-4">
            {/* 게임 테이블 */}
            <GameTable 
              gameState={gameState}
              currentUserId={userId}
              onJoin={handleJoinGame}
            />
            
            {/* 카드 조합 정보 */}
            {cardCombination && (
              <div className="p-4 bg-gray-700 bg-opacity-80 rounded-lg border border-yellow-500">
                <h3 className="text-lg font-bold mb-2 text-yellow-400">내 카드 조합</h3>
                <div className="flex justify-between items-center">
                  <CardPair cards={cardCombination.cards} />
                  <div className="text-right">
                    <p className="font-bold text-yellow-400 text-xl">{cardCombination.rank}</p>
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

// 게임 상태 한글 변환 함수
function translateStatus(status: string): string {
  switch (status) {
    case 'waiting': return '대기 중';
    case 'playing': return '게임 중';
    case 'finished': return '종료됨';
    default: return status;
  }
} 