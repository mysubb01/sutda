'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGame } from '@/lib/gameApi';
import { toast } from 'react-hot-toast';

export default function CreateGamePage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleCreateGame = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      // 기본 게스트 이름으로 게임 생성 (닉네임 입력 없이)
      const { gameId } = await createGame('관찰자');
      
      // 성공 시 게임 페이지로 이동
      router.push(`/game/${gameId}`);
      
      toast.success('게임이 생성되었습니다. 빈 자리를 클릭하여 참가하세요.');
    } catch (err) {
      console.error('게임 생성 오류:', err);
      setError('게임을 생성할 수 없습니다. 다시 시도해주세요.');
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-lg shadow-lg border border-yellow-800">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-6">섯다 게임 생성</h1>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <button
          onClick={handleCreateGame}
          disabled={isCreating}
          className={`w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold rounded-md shadow-lg transition-all ${
            isCreating ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isCreating ? '생성 중...' : '게임 생성하기'}
        </button>
        
        <p className="mt-4 text-gray-400 text-sm text-center">
          게임을 생성하면 관찰자 모드로 시작됩니다.<br />
          빈 자리를 클릭하여 게임에 참가할 수 있습니다.
        </p>
      </div>
    </div>
  );
} 