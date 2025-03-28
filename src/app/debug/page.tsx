'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function DebugPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [playerCount, setPlayerCount] = useState(2);
  const [readyCount, setReadyCount] = useState(2);
  const [gameMode, setGameMode] = useState(2); // 2장 or 3장
  const [createdGameId, setCreatedGameId] = useState<string | null>(null); // 생성된 게임 ID 상태
  const [createdHostPlayerId, setCreatedHostPlayerId] = useState<string | null>(null); // 생성된 호스트 플레이어 ID 상태

  // 디버그용 게임 생성
  const createDebugGame = async () => {
    setCreatedGameId(null); // 이전 게임 정보 초기화
    setCreatedHostPlayerId(null);
    try {
      setIsCreating(true);
      
      // 1. 게임방 생성
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: `디버그방-${Date.now()}`,
          mode: gameMode,
          max_players: Math.max(playerCount, 8),
          is_active: true
        })
        .select()
        .single();
        
      if (roomError || !room) {
        throw new Error('방 생성 실패: ' + roomError?.message);
      }
      
      // 2. 게임 생성
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          room_id: room.id,
          status: 'waiting',
          base_bet: 1000,
          total_pot: 0
        })
        .select()
        .single();
        
      if (gameError || !game) {
        throw new Error('게임 생성 실패: ' + gameError?.message);
      }
      
      // 3. 호스트 플레이어 생성
      const { data: hostPlayer, error: hostPlayerError } = await supabase
        .from('players')
        .insert({
          game_id: game.id,
          user_id: `debug-host-${Date.now()}`, // user_id 필드 추가
          username: '디버그호스트',
          balance: 10000,
          seat_index: 0,
          is_ready: true,
          is_die: false
        })
        .select()
        .single();
        
      if (hostPlayerError || !hostPlayer) {
        throw new Error('호스트 생성 실패: ' + hostPlayerError?.message);
      }
      
      // 4. 추가 가상 플레이어 생성
      const dummyPlayers = [];
      
      for (let i = 1; i < playerCount; i++) {
        dummyPlayers.push({
          game_id: game.id,
          user_id: `debug-user-${i}-${Date.now()}`, // user_id 필드 추가
          username: `테스트유저${i}`,
          balance: 10000,
          seat_index: i % 8,
          is_ready: i < readyCount, // readyCount만큼 준비 상태로 설정
          is_die: false
        });
      }
      
      if (dummyPlayers.length > 0) {
        const { error: dummyPlayersError } = await supabase
          .from('players')
          .insert(dummyPlayers);
          
        if (dummyPlayersError) {
          throw new Error('가상 플레이어 생성 실패: ' + dummyPlayersError.message);
        }
      }
      
      toast.success('디버그 게임이 생성되었습니다!');
      
      // 생성된 게임 및 호스트 정보 저장
      setCreatedGameId(game.id);
      setCreatedHostPlayerId(hostPlayer.id);
      
      // 자동 이동 제거
      // router.push(`/debug/game/${game.id}?playerId=${hostPlayer.id}`);
      
    } catch (err: any) {
      console.error('디버그 게임 생성 오류:', err);
      toast.error(err.message || '디버그 게임 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 p-8">
      <div className="max-w-md mx-auto bg-zinc-800 rounded-lg shadow-lg p-6 border border-zinc-700">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">디버그 모드</h1>
        
        { !createdGameId ? ( // 게임 생성 전 UI
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-300">
                총 플레이어 수
                <span className="text-xs ml-2 text-zinc-400">(호스트 포함)</span>
              </label>
              <input
                type="number"
                min="2"
                max="8"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full rounded border border-zinc-600 bg-zinc-700 text-white p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-300">
                준비 완료된 플레이어 수
                <span className="text-xs ml-2 text-zinc-400">(호스트 포함)</span>
              </label>
              <input
                type="number"
                min="1"
                max={playerCount}
                value={readyCount}
                onChange={(e) => setReadyCount(Math.min(Number(e.target.value), playerCount))}
                className="w-full rounded border border-zinc-600 bg-zinc-700 text-white p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-300">게임 모드</label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(Number(e.target.value))}
                className="w-full rounded border border-zinc-600 bg-zinc-700 text-white p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value={2}>2장 모드</option>
                <option value={3}>3장 모드</option>
              </select>
            </div>
            
            <button
              onClick={createDebugGame}
              disabled={isCreating}
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreating ? '생성 중...' : '디버그 게임 생성'}
            </button>
          </div>
        ) : ( // 게임 생성 후 UI
          <div className="mt-6 text-center">
            <p className="text-white mb-4">게임 ID: <span className="font-mono bg-zinc-700 px-2 py-1 rounded">{createdGameId}</span></p>
            <div className="space-y-2">
              <Link href={`/game/${createdGameId}?debug=true`} passHref legacyBehavior>
                <a className="block w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  관전자로 입장
                </a>
              </Link>
              {createdHostPlayerId && (
                <Link href={`/game/${createdGameId}?playerId=${createdHostPlayerId}&debug=true`} passHref legacyBehavior>
                  <a className="block w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                    호스트로 입장
                  </a>
                </Link>
              )}
            </div>
            <button
              onClick={() => {
                setCreatedGameId(null);
                setCreatedHostPlayerId(null);
              }}
              className="mt-4 text-sm text-zinc-400 hover:text-white"
            >
              새 게임 생성하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
