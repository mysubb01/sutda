'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GameClient from '@/app/game/[id]/client';
import { toast } from 'react-hot-toast';
import { startDebugGame } from '@/lib/gameApi';

interface Player {
  id: string;
  username: string;
  game_id: string;
  seat_index: number | null;
  is_ready: boolean;
  is_die: boolean;
  balance: number;
}

interface Game {
  id: string;
  status: string;
  current_turn: string | null;
  betting_round: number;
  total_pot: number;
  winner: string | null;
}

export default function DebugGamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId');
  
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [currentTurnPlayer, setCurrentTurnPlayer] = useState<Player | null>(null);
  
  // 게임 및 플레이어 정보 불러오기
  const loadGameData = async () => {
    try {
      // 게임 정보 불러오기
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
        
      if (gameError) throw gameError;
      setGame(gameData);
      
      // 플레이어 목록 불러오기
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('seat_index', { ascending: true });
        
      if (playerError) throw playerError;
      setPlayers(playerData || []);
      
      // 현재 턴 플레이어 찾기
      if (gameData?.current_turn && playerData) {
        const currentPlayer = playerData.find(p => p.id === gameData.current_turn);
        setCurrentTurnPlayer(currentPlayer || null);
      } else {
        setCurrentTurnPlayer(null);
      }
    } catch (err) {
      console.error('게임 데이터 불러오기 오류:', err);
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
      loadGameData();
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
      loadGameData();
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
      loadGameData();
    } catch (err) {
      console.error('잔고 충전 오류:', err);
      toast.error('잔고 충전에 실패했습니다.');
    }
  };
  
  // 다음 턴으로 넘기기
  const advanceToNextTurn = async () => {
    try {
      if (!game || !players.length) {
        toast.error('게임 정보를 불러올 수 없습니다.');
        return;
      }
      
      // 현재 턴 인덱스 찾기
      const currentTurnIndex = players.findIndex(p => p.id === game.current_turn);
      
      // 다음 턴 결정 (다이하지 않은 플레이어 중에서)
      let nextIndex = currentTurnIndex;
      let nextPlayer = null;
      
      // 활성 플레이어만 필터링 (다이하지 않고 좌석이 있는 플레이어)
      const activePlayers = players.filter(p => !p.is_die && p.seat_index !== null);
      
      if (activePlayers.length > 0) {
        // 활성 플레이어들 중 다음 순서 결정
        for (let i = 1; i <= activePlayers.length; i++) {
          const checkIndex = (currentTurnIndex + i) % players.length;
          if (!players[checkIndex].is_die && players[checkIndex].seat_index !== null) {
            nextIndex = checkIndex;
            nextPlayer = players[nextIndex];
            break;
          }
        }
        
        // 다음 턴 없으면 첫 번째 활성 플레이어로
        if (!nextPlayer) {
          nextPlayer = activePlayers[0];
        }
        
        // 게임 현재 턴 업데이트
        await supabase
          .from('games')
          .update({ current_turn: nextPlayer.id })
          .eq('id', gameId);
          
        toast.success(`${nextPlayer.username}의 턴으로 변경되었습니다.`);
        loadGameData();
      } else {
        toast.error('활성 플레이어가 없습니다.');
      }
    } catch (err) {
      console.error('턴 변경 오류:', err);
      toast.error('턴 변경에 실패했습니다.');
    }
  };
  
  useEffect(() => {
    loadGameData();
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
          
          <button 
            onClick={async () => {
              try {
                await startDebugGame(gameId);
                toast.success('디버그 게임이 시작되었습니다.');
                loadGameData();
              } catch (err: any) {
                console.error('디버그 게임 시작 오류:', err);
                toast.error(`디버그 게임 시작 실패: ${err.message || '알 수 없는 오류'}`);
              }
            }}
            className="text-xs bg-green-800 hover:bg-green-700 text-white py-1 px-3 rounded border border-green-700"
          >
            디버그 게임 시작
          </button>
          
          <button 
            onClick={advanceToNextTurn}
            disabled={game?.status !== 'playing'}
            className="text-xs bg-blue-800 hover:bg-blue-700 text-white py-1 px-3 rounded border border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={game?.status !== 'playing' ? '게임이 진행 중일 때만 사용 가능합니다' : ''}
          >
            다음 턴으로 넘기기
          </button>
          
          <div className="ml-auto text-xs">
            <div>게임 ID: {gameId}</div>
            {playerId && <div>플레이어 ID: {playerId}</div>}
            {game && (
              <div className="mt-1">
                <div>게임 상태: {game.status}</div>
                <div>베팅 라운드: {game.betting_round}</div>
                <div>총 팟: {game.total_pot}</div>
                {currentTurnPlayer && (
                  <div className="font-bold text-yellow-400">현재 턴: {currentTurnPlayer.username}</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* 플레이어 요약 정보 */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          {players.map(player => (
            <div 
              key={player.id} 
              className={`p-2 rounded border ${player.id === game?.current_turn 
                ? 'bg-yellow-700 border-yellow-500' 
                : 'bg-zinc-700 border-zinc-600'
              }`}
            >
              <div className="font-bold">{player.username}</div>
              <div className="flex justify-between">
                <span>좌석: {player.seat_index !== null ? player.seat_index : '없음'}</span>
                <span>잔고: {player.balance}</span>
              </div>
              <div className="flex justify-between">
                <span>준비: {player.is_ready ? '완료' : '대기'}</span>
                <span>상태: {player.is_die ? '다이' : '생존'}</span>
              </div>
              {player.id === game?.current_turn && (
                <div className="mt-1 text-center text-yellow-300 font-bold">현재 턴</div>
              )}
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
