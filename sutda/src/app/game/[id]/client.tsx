'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Message } from '@/types/game';
import { getGameState, joinGame } from '@/lib/gameApi';
import { GameTable } from '@/components/GameTable';
import { GameControls } from '@/components/GameControls';
import { Chat } from '@/components/Chat';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ClientGamePageProps {
  gameId: string;
}

export default function ClientGamePage({ gameId }: ClientGamePageProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // 메시지 불러오기
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      } else {
        console.error('메시지 불러오기 오류:', error);
      }
    } catch (err) {
      console.error('메시지 불러오기 예외:', err);
    }
  };
  
  // 게임 상태 불러오기
  const fetchGameState = async () => {
    try {
      const data = await getGameState(gameId);
      console.log('게임 상태 업데이트:', data);
      setGameState(data);
      return data;
    } catch (err) {
      console.error('게임 상태 불러오기 실패:', err);
      setError('게임 정보를 불러오는 중 오류가 발생했습니다.');
      return null;
    }
  };
  
  // 게임 참가 및 구독 설정
  useEffect(() => {
    // 로컬 스토리지에서 플레이어 정보 가져오기
    const storedPlayerId = localStorage.getItem(`game_${gameId}_player_id`);
    const storedUsername = localStorage.getItem(`game_${gameId}_username`);
    
    if (storedPlayerId && storedUsername) {
      console.log('저장된 플레이어 정보 발견:', storedPlayerId, storedUsername);
      setPlayerId(storedPlayerId);
      setUsername(storedUsername);
      
      // 초기 데이터 로드
      fetchGameState();
      fetchMessages();
      
      // 폴링 설정 - 정기적으로 데이터 갱신
      const gameStateInterval = setInterval(() => {
        console.log('게임 상태 폴링...');
        fetchGameState();
      }, 1000); // 1초마다로 변경하여 반응성 향상
      
      const messagesInterval = setInterval(() => {
        console.log('메시지 폴링...');
        fetchMessages();
      }, 1000); // 1초마다
      
      // 컴포넌트 언마운트 시 인터벌 정리
      return () => {
        clearInterval(gameStateInterval);
        clearInterval(messagesInterval);
        console.log('폴링 인터벌 정리 완료');
      };
    }
  }, [gameId]);
  
  // 실시간 구독 설정 - 폴링으로 대체되어 필요 없음
  const setupSubscriptions = (pid: string) => {
    console.log('폴링 방식으로 변경되어 실시간 구독이 사용되지 않습니다.');
    return () => {}; // 빈 정리 함수
  };

  // 게임 참가 처리
  const handleJoinGame = async (username: string) => {
    if (!username.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    
    setIsJoining(true);
    setError(null);
    
    try {
      const { playerId: newPlayerId, gameState: newGameState } = await joinGame(gameId, username);
      
      // 플레이어 정보 저장
      localStorage.setItem(`game_${gameId}_player_id`, newPlayerId);
      localStorage.setItem(`game_${gameId}_username`, username);
      
      setPlayerId(newPlayerId);
      setUsername(username);
      setGameState(newGameState);
      
      // 최초 참가 시 메시지 불러오기
      fetchMessages();
      
      // 이제 setupSubscriptions는 호출하지 않음 (폴링 방식 사용)
    } catch (err) {
      console.error('게임 참가 오류:', err);
      setError('게임 참가 중 오류가 발생했습니다.');
    } finally {
      setIsJoining(false);
    }
  };
  
  // 액션 후 게임 상태 갱신
  const handleAfterAction = () => {
    fetchGameState();
  };
  
  // 이미 참가한 상태이고 게임 상태가 로드된 경우
  if (playerId && gameState) {
    return (
      <div className="min-h-screen w-full bg-gray-950 relative overflow-hidden">
        {/* 테이블 배경 효과 */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom, #1a2035, #0a0a1a)',
            backgroundImage: 'url(/images/table/bgM.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px)',
            opacity: 0.3,
            transform: 'scale(1.1)'
          }}
        />
        
        <div className="container mx-auto p-4 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-2rem)]">
            {/* 게임 테이블 영역 */}
            <div className="flex-grow rounded-xl overflow-hidden shadow-2xl bg-gray-900 bg-opacity-50 border border-gray-800">
              <GameTable 
                gameState={gameState} 
                currentPlayerId={playerId}
              />
            </div>
            
            {/* 우측 정보 패널 */}
            <div className="w-full md:w-80 lg:w-96 flex flex-col space-y-4">
              {/* 게임 컨트롤 */}
              <div className="h-auto">
                <GameControls 
                  gameState={gameState} 
                  currentPlayerId={playerId}
                  onAction={handleAfterAction} 
                />
              </div>
              
              {/* 채팅 */}
              <div className="flex-grow overflow-hidden">
                <Chat 
                  gameId={gameId} 
                  playerId={playerId} 
                  username={username}
                  messages={messages}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // 게임 참가 폼
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-lg shadow-lg border border-yellow-800">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-6">섯다 게임 참가</h1>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={(e) => {
          e.preventDefault();
          handleJoinGame(username);
        }}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-bold text-gray-300 mb-2">
              닉네임
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="게임에서 사용할 닉네임을 입력하세요"
              disabled={isJoining}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isJoining || !username.trim()}
            className={`w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold rounded-md shadow-lg transition-all ${
              isJoining || !username.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isJoining ? '참가 중...' : '게임 참가하기'}
          </button>
        </form>
      </div>
    </div>
  );
} 