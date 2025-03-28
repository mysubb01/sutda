'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button'; // 원래 경로로 복구

interface DebugPanelProps {
  gameId: string;
  loadGameData: () => Promise<void>; // 상위 컴포넌트의 게임 데이터 로드 함수
}

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

export function DebugPanel({ gameId, loadGameData }: DebugPanelProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 컴포넌트 마운트 시 및 gameId 변경 시 데이터 로드
  useEffect(() => {
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (gameError) throw gameError;
      setGame(gameData);

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('seat_index', { ascending: true });
      if (playerError) throw playerError;
      setPlayers(playerData || []);
    } catch (err) {
      console.error('디버그 패널 데이터 로드 오류:', err);
      toast.error('디버그 패널 데이터 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // 모든 플레이어 준비상태 설정
  const setAllPlayersReady = async () => {
    setIsLoading(true);
    try {
      await supabase
        .from('players')
        .update({ is_ready: true })
        .eq('game_id', gameId);
      toast.success('모든 플레이어가 준비 완료되었습니다.');
      await loadGameData(); // 상위 컴포넌트의 데이터 로드 함수 호출
      await fetchInitialData(); // 내부 상태도 업데이트
    } catch (err) {
      console.error('준비상태 설정 오류:', err);
      toast.error('준비상태 설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 게임 상태 리셋
  const resetGame = async () => {
    setIsLoading(true);
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
          balance: 10000, // 기본값으로 재설정
          is_ready: false
        })
        .eq('game_id', gameId);

      toast.success('게임이 초기화되었습니다.');
      await loadGameData(); // 상위 컴포넌트 데이터 로드
      await fetchInitialData(); // 내부 상태 업데이트
    } catch (err) {
      console.error('게임 초기화 오류:', err);
      toast.error('게임 초기화에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 잔고 충전
  const rechargeAllBalance = async () => {
    setIsLoading(true);
    try {
      await supabase
        .from('players')
        .update({ balance: 10000 })
        .eq('game_id', gameId);
      toast.success('모든 플레이어의 잔고가 10,000으로 충전되었습니다.');
      await loadGameData(); // 상위 컴포넌트 데이터 로드
      await fetchInitialData(); // 내부 상태 업데이트
    } catch (err) {
      console.error('잔고 충전 오류:', err);
      toast.error('잔고 충전에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 다음 턴으로 넘기기
  const advanceToNextTurn = async () => {
    setIsLoading(true);
    try {
      if (!game || !players.length) {
        toast.error('게임 정보를 불러올 수 없습니다.');
        return;
      }

      // 현재 턴 인덱스 찾기 (players 상태 기준)
      const currentTurnIndex = players.findIndex(p => p.id === game.current_turn);

      // 활성 플레이어만 필터링 (다이하지 않고 좌석이 있는 플레이어)
      const activePlayers = players.filter(p => !p.is_die && p.seat_index !== null).sort((a, b) => (a.seat_index || 0) - (b.seat_index || 0));

      if (activePlayers.length > 0) {
        let nextPlayer = null;
        const currentActiveIndex = activePlayers.findIndex(p => p.id === game.current_turn);

        if (currentActiveIndex !== -1) {
          // 현재 턴 플레이어가 활성 플레이어 목록에 있으면 다음 순서 찾기
          const nextActiveIndex = (currentActiveIndex + 1) % activePlayers.length;
          nextPlayer = activePlayers[nextActiveIndex];
        } else {
          // 현재 턴 플레이어가 없거나 활성 목록에 없으면, 첫 번째 활성 플레이어로 설정
          nextPlayer = activePlayers[0];
        }

        if (nextPlayer) {
          await supabase
            .from('games')
            .update({ current_turn: nextPlayer.id })
            .eq('id', gameId);
          toast.success(`${nextPlayer.username}의 턴으로 변경되었습니다.`);
          await loadGameData(); // 상위 컴포넌트 데이터 로드
          await fetchInitialData(); // 내부 상태 업데이트
        } else {
           toast.error('다음 턴 플레이어를 찾을 수 없습니다.');
        }
      } else {
        toast.error('활성 플레이어가 없습니다.');
      }
    } catch (err) {
      console.error('턴 변경 오류:', err);
      toast.error('턴 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 bg-opacity-90 p-4 shadow-lg backdrop-blur-sm z-50">
      <h3 className="text-lg font-semibold text-yellow-400 mb-3">🛠️ 디버그 패널</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <Button onClick={fetchInitialData} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? '로딩중...' : '데이터 새로고침'}
        </Button>
        <Button onClick={setAllPlayersReady} disabled={isLoading} variant="outline" size="sm">
          모두 준비
        </Button>
        <Button onClick={resetGame} disabled={isLoading} variant="destructive" size="sm">
          게임 초기화
        </Button>
        <Button onClick={rechargeAllBalance} disabled={isLoading} variant="outline" size="sm">
          잔고 충전 (10k)
        </Button>
        <Button onClick={advanceToNextTurn} disabled={isLoading || game?.status !== 'playing'} variant="outline" size="sm">
          다음 턴
        </Button>
        {/* 추가 디버그 기능 버튼들 */}
      </div>
      {game && (
        <div className="mt-3 text-xs text-gray-400">
          <p>게임 상태: {game.status} | 현재 턴: {players.find(p => p.id === game.current_turn)?.username || '없음'}</p>
        </div>
      )}
    </div>
  );
}
