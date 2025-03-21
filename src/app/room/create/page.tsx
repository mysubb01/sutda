'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/roomApi';
import { toast } from 'react-hot-toast';
import { GameMode } from '@/types/game';

const DEFAULT_BASE_BET = 1000;
const DEFAULT_MAX_PLAYERS = 8;

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>(2);
  const [baseBet, setBaseBet] = useState(DEFAULT_BASE_BET);
  const [bettingOption, setBettingOption] = useState<'standard' | 'step_by_step'>('standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('방 이름을 입력해주세요.');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      const { roomId } = await createRoom(
        name,
        mode,
        baseBet,
        bettingOption
      );
      
      toast.success('방이 생성되었습니다!');
      router.push(`/game/${roomId}`);
    } catch (err) {
      console.error('방 생성 오류:', err);
      setError('방을 생성하는 도중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex justify-center items-center">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-center mb-6 text-yellow-400">새 방 만들기</h1>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">방 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="예) 신입 환영 한판"
              maxLength={20}
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">게임 모드</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setMode(2)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === 2 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                2장 모드
              </button>
              <button
                type="button"
                onClick={() => setMode(3)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === 3 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                3장 모드
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {mode === 2 
                ? '2장 모드: 기본적인 섯다 게임, 2장의 카드로 족보 결정' 
                : '3장 모드: 3장 중 2장을 선택하여 게임하는 방식'}
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">베팅 방식</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setBettingOption('standard')}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${bettingOption === 'standard' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                기본 베팅
              </button>
              <button
                type="button"
                onClick={() => setBettingOption('step_by_step')}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${bettingOption === 'step_by_step' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                단계별 베팅
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {bettingOption === 'standard' 
                ? '기본 베팅: 자유롭게 베팅 금액 설정 가능' 
                : '단계별 베팅: 정해진 금액으로 단계별 베팅'}
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">기본 베팅액</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setBaseBet(500)}
                className={`py-2 px-2 rounded-md text-center text-sm transition-colors ${baseBet === 500 ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                500원
              </button>
              <button
                type="button"
                onClick={() => setBaseBet(1000)}
                className={`py-2 px-2 rounded-md text-center text-sm transition-colors ${baseBet === 1000 ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                1,000원
              </button>
              <button
                type="button"
                onClick={() => setBaseBet(5000)}
                className={`py-2 px-2 rounded-md text-center text-sm transition-colors ${baseBet === 5000 ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                5,000원
              </button>
              <button
                type="button"
                onClick={() => setBaseBet(10000)}
                className={`py-2 px-2 rounded-md text-center text-sm transition-colors ${baseBet === 10000 ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                10,000원
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              게임 시작 시 각 플레이어가 지불하는 기본 베팅액입니다.
            </p>
          </div>
          
          <div className="mt-6">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '생성 중...' : '방 생성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
