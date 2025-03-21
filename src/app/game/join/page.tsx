'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { joinGame } from '@/lib/gameApi';

export default function JoinGame() {
  const router = useRouter();
  const [gameId, setGameId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!gameId.trim()) {
      setError('게임 ID를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 기본 '게스트' 닉네임으로 게임에 참가
      const username = `게스트${Math.floor(Math.random() * 1000)}`;
      const { playerId, gameState } = await joinGame(gameId, username);
      
      // 로컬 스토리지에 플레이어 정보 저장
      localStorage.setItem(`game_${gameId}_player_id`, playerId);
      localStorage.setItem(`game_${gameId}_username`, username);
      
      // 게임 화면으로 이동
      router.push(`/game/${gameId}`);
    } catch (err) {
      console.error('게임 참가 오류:', err);
      setError('게임에 참가하는 중 오류가 발생했습니다. 게임 ID를 확인하세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-800 text-white p-4">
      <div className="w-full max-w-md bg-gray-700 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">게임 참가</h1>
        
        {error && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="gameId" className="block text-sm font-medium mb-2">
              게임 ID
            </label>
            <input
              type="text"
              id="gameId"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="참가할 게임 ID를 입력하세요"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className={`w-full py-3 font-medium rounded-md ${
              isLoading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            disabled={isLoading}
          >
            {isLoading ? '참가 중...' : '게임 참가'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
} 