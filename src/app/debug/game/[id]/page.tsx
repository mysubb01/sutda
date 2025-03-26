'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GameClient from '@/app/game/[id]/client';
import { toast } from 'react-hot-toast';

interface Player {
  id: string;
  username: string;
  game_id: string;
  seat_index: number | null;
  is_ready: boolean;
  is_die: boolean;
  balance: number;
}

export default function DebugGamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId');
  
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // 플레이어 목록 불러오기
  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('seat_index', { ascending: true });
        
      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error('플레이어 목록 불러오기 오류:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 모든 플레이어 준비상태 설정
  const setAllPlayersReady = async () => {
    try {
      await supabase
        .from('players')
        .update({ is_ready: true })
        .eq('game_id', gameId);
        
      toast.success('모든 플레이어가 준비 완료되었습니다.');
      loadPlayers();
    } catch (err) {
      console.error('준비상태 설정 오류:', err);
      toast.error('준비상태 설정에 실패했습니다.');
    }
  };
  
  // 게임 상태 리셋
  const resetGame = async () => {
    try {
      // 게임 상태 초기화
      await supabase
        .from('games')
        .update({
          status: 'waiting',
          current_turn: null,
          betting_round: 0,
          total_pot: 0,
          winner: null
        })
        .eq('id', gameId);
        
      // 플레이어 상태 초기화
      await supabase
        .from('players')
        .update({
          cards: null,
          open_card: null,
          selected_cards: null,
          is_die: false,
          balance: 10000,
          is_ready: false
        })
        .eq('game_id', gameId);
        
      toast.success('게임이 초기화되었습니다.');
      loadPlayers();
    } catch (err) {
      console.error('게임 초기화 오류:', err);
      toast.error('게임 초기화에 실패했습니다.');
    }
  };
  
  // 잔고 충전
  const rechargeAllBalance = async () => {
    try {
      await supabase
        .from('players')
        .update({ balance: 10000 })
        .eq('game_id', gameId);
        
      toast.success('모든 플레이어의 잔고가 10,000으로 충전되었습니다.');
      loadPlayers();
    } catch (err) {
      console.error('잔고 충전 오류:', err);
      toast.error('잔고 충전에 실패했습니다.');
    }
  };
  
  useEffect(() => {
    loadPlayers();
  }, [gameId]);
  
  return (
    <div>
      {/* 디버그 컨트롤 패널 */}
      <div className="sticky top-0 z-50 bg-zinc-800 text-white p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold mr-4">디버그 컨트롤</h2>
          
          <button 
            onClick={setAllPlayersReady}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white py-1 px-3 rounded border border-zinc-600"
          >
            모든 플레이어 준비완료
          </button>
          
          <button 
            onClick={resetGame}
            className="text-xs bg-red-800 hover:bg-red-700 text-white py-1 px-3 rounded border border-red-700"
          >
            게임 상태 초기화
          </button>
          
          <button 
            onClick={rechargeAllBalance}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white py-1 px-3 rounded border border-zinc-600"
          >
            모든 플레이어 잔고 충전
          </button>
          
          <div className="ml-auto text-xs">
            <div>게임 ID: {gameId}</div>
            {playerId && <div>플레이어 ID: {playerId}</div>}
          </div>
        </div>
        
        {/* 플레이어 요약 정보 */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          {players.map(player => (
            <div key={player.id} className="bg-zinc-700 p-2 rounded border border-zinc-600">
              <div className="font-bold">{player.username}</div>
              <div className="flex justify-between">
                <span>좌석: {player.seat_index !== null ? player.seat_index : '없음'}</span>
                <span>잔고: {player.balance}</span>
              </div>
              <div className="flex justify-between">
                <span>준비: {player.is_ready ? '완료' : '대기'}</span>
                <span>상태: {player.is_die ? '다이' : '생존'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 실제 게임 컴포넌트 */}
      <div className="mt-4">
        {!loading && playerId && (
          <GameClient gameId={gameId} />
        )}
      </div>
    </div>
  );
}
