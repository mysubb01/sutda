'use client';

// Window 객체에 커스텀 속성 추가
declare global {
  interface Window {
    _isSeatChanging?: boolean;
  }
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Message } from '@/types/game';
import { getGameState, joinGame, updateSeat, isRoomOwner, canStartGame, startGame, toggleReady } from '@/lib/gameApi';
import { GameTable } from '@/components/GameTable';
import { GameControls } from '@/components/GameControls';
import { Chat } from '@/components/Chat';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameTableSkeleton } from '@/components/GameTableSkeleton';
import { toast } from 'react-hot-toast';
import { BettingHistory } from '@/components/BettingHistory';

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
  const [reconnected, setReconnected] = useState(false);
  const [isObserver, setIsObserver] = useState(true); // 처음에는 관찰자 모드로 시작
  const [isSeatChanging, setIsSeatChanging] = useState(false); // 좌석 변경 중 상태
  const [isHost, setIsHost] = useState(false); // 방장 여부
  const [isReady, setIsReady] = useState(false); // 준비 상태
  const [isTogglingReady, setIsTogglingReady] = useState(false); // 준비 상태 변경 중
  const [isStartingGame, setIsStartingGame] = useState(false); // 게임 시작 중
  const [canStart, setCanStart] = useState<{canStart: boolean, message: string}>({canStart: false, message: ''});

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
      
      // 플레이어 정보가 있는 경우
      if (playerId) {
        // 방장 여부 확인
        const hostStatus = await isRoomOwner(gameId, playerId);
        setIsHost(hostStatus);
        
        // 준비 상태 확인
        const player = data.players.find(p => p.id === playerId);
        if (player) {
          setIsReady(player.is_ready || false);
        }
        
        // 게임 시작 가능 여부 확인 (방장인 경우만)
        if (hostStatus) {
          const startStatus = await canStartGame(gameId);
          setCanStart(startStatus);
        }
      }
      
      return data;
    } catch (err) {
      console.error('게임 상태 불러오기 실패:', err);
      setError('게임 정보를 불러오는 중 오류가 발생했습니다.');
      return null;
    }
  };
  
  // 자리 변경 처리 함수
  const handleSeatChange = async (seatIndex: number) => {
    try {
      setIsSeatChanging(true);
      
      // 좌석 변경 API 호출
      await updateSeat(gameId, playerId!, seatIndex);
      
      // 성공 메시지
      toast.success('좌석이 변경되었습니다.');
      
      // 로컬 스토리지에도 좌석 정보 저장 (복구 용도)
      localStorage.setItem(`game_${gameId}_seat_index`, String(seatIndex));
      
      console.log('좌석 변경 완료:', seatIndex);
      
      // 좌석 변경 상태 해제 - 실시간 업데이트가 자동으로 처리함
      setTimeout(() => {
        setIsSeatChanging(false);
      }, 500);
    } catch (err) {
      console.error('좌석 변경 오류:', err);
      toast.error('좌석을 변경할 수 없습니다.');
      setIsSeatChanging(false);
    }
  };
  
  // 게임 참가 및 실시간 구독 설정
  useEffect(() => {
    // 로컬 스토리지에서 플레이어 정보 가져오기
    const storedPlayerId = localStorage.getItem(`game_${gameId}_player_id`);
    const storedUsername = localStorage.getItem(`game_${gameId}_username`);
    
    // 초기 데이터 로드
    fetchGameState();
    fetchMessages();
    
    if (storedPlayerId && storedUsername) {
      console.log('저장된 플레이어 정보 발견:', storedPlayerId, storedUsername);
      setPlayerId(storedPlayerId);
      setUsername(storedUsername);
      setIsObserver(false); // 이미 참가한 플레이어인 경우 관찰자 모드 해제
    }
    
    // 실시간 구독 설정
    const gameChannel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        console.log('게임 상태 업데이트 수신:', payload);
        fetchGameState();
      })
      .subscribe((status) => {
        console.log('게임 채널 구독 상태:', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });
    
    // 플레이어 테이블 실시간 구독
    const playersChannel = supabase
      .channel(`players:${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('플레이어 정보 업데이트 수신:', payload);
        fetchGameState();
      })
      .subscribe((status) => {
        console.log('플레이어 채널 구독 상태:', status);
      });
    
    // 메시지 실시간 구독
    const messagesChannel = supabase
      .channel(`messages:${gameId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('새 메시지 수신:', payload);
        // 새 메시지를 기존 메시지 배열에 추가
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe((status) => {
        console.log('메시지 채널 구독 상태:', status);
      });
    
    // 게임 액션 실시간 구독
    const actionsChannel = supabase
      .channel(`actions:${gameId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_actions',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('새 게임 액션 수신:', payload);
        // 게임 액션 발생 시 게임 상태 갱신
        fetchGameState();
      })
      .subscribe((status) => {
        console.log('액션 채널 구독 상태:', status);
      });
    
    // 컴포넌트 언마운트 시 구독 정리
    return () => {
      gameChannel.unsubscribe();
      playersChannel.unsubscribe();
      messagesChannel.unsubscribe();
      actionsChannel.unsubscribe();
      console.log('실시간 구독 정리 완료');
    };
  }, [gameId]);
  
  // 실시간 연결 재설정 함수
  const reconnectRealtimeChannels = () => {
    console.log('실시간 연결 재시도...');
    // 페이지 새로고침으로 모든 구독 재설정
    window.location.reload();
  };

  // 게임 참가 처리 - 관찰자 모드에서는 호출되지 않음
  // 대신 GameTable의 handleSeatClick에서 직접 처리
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
      setIsObserver(false); // 참가 후 관찰자 모드 해제
      
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
  
  // 관찰자 모드에서 플레이어로 전환
  const handleObserverToPlayer = (newPlayerId: string, newUsername: string) => {
    setPlayerId(newPlayerId);
    setUsername(newUsername);
    setIsObserver(false);
    toast.success('게임에 참가했습니다!');
    
    // 폴링 빈도 조정 (참가자는 더 높은 빈도로 업데이트)
    fetchGameState();
    fetchMessages();
  };
  
  // 액션 후 게임 상태 갱신
  const handleAfterAction = () => {
    fetchGameState();
  };
  
  // 준비 상태 토글 처리
  const handleToggleReady = async () => {
    if (!playerId || isHost) return; // 방장은 준비상태 불필요
    
    try {
      setIsTogglingReady(true);
      await toggleReady(gameId, playerId, !isReady);
      setIsReady(!isReady);
      toast.success(isReady ? '준비 취소되었습니다.' : '준비 완료!');
    } catch (err) {
      console.error('준비 상태 변경 오류:', err);
      toast.error('준비 상태를 변경하는 중 오류가 발생했습니다.');
    } finally {
      setIsTogglingReady(false);
    }
  };
  
  // 게임 시작 처리 (방장만 가능)
  const handleStartGame = async () => {
    if (!playerId || !isHost) return;
    
    try {
      // 시작 가능 여부 다시 확인
      const startStatus = await canStartGame(gameId);
      if (!startStatus.canStart) {
        toast.error(startStatus.message);
        return;
      }
      
      setIsStartingGame(true);
      await startGame(gameId);
      toast.success('게임이 시작됩니다!');
      
      // 게임 상태 갱신
      await fetchGameState();
    } catch (err) {
      console.error('게임 시작 오류:', err);
      toast.error('게임을 시작하는 중 오류가 발생했습니다.');
    } finally {
      setIsStartingGame(false);
    }
  };
  
  // 게임 상태와 현재 플레이어 정보 추출
  const isWaiting = gameState?.status === 'waiting';
  const isPlaying = gameState?.status === 'playing'; 
  const isFinished = gameState?.status === 'finished';
  const isRegame = gameState?.status === 'regame';
  
  // 현재 플레이어 정보
  const currentPlayer = gameState?.players.find(p => p.id === playerId);
  const isCurrentTurn = gameState?.currentTurn === playerId;
  
  // 게임 재접속 처리
  useEffect(() => {
    if (sessionStorage.getItem('gameReconnected') !== 'true') {
      toast.success('게임에 접속되었습니다');
      sessionStorage.setItem('gameReconnected', 'true');
      
      // 재접속 메시지 표시
      if (reconnected) {
        toast('기존 게임에 재접속했습니다', { duration: 3000 });
      }
    }
    
    return () => {
      // 페이지 이탈 시 재접속 플래그 초기화
      sessionStorage.removeItem('gameReconnected');
    };
  }, [reconnected]);

  // 현재 턴 변경 시 효과음 및 알림
  useEffect(() => {
    if (!isPlaying || isObserver) return; // 관찰자 모드에서는 턴 알림 없음
    
    if (isCurrentTurn) {
      toast.success('당신의 턴입니다!', { duration: 3000 });
      // 효과음 재생
      const audio = new Audio('/sounds/turn.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('효과음 재생 실패:', e));
    }
  }, [gameState?.currentTurn, isPlaying, isCurrentTurn, isObserver]);
  
  // 승자 결정 시 효과음 및 알림
  useEffect(() => {
    if (isFinished && gameState?.winner) {
      const isWinner = gameState.winner === playerId;
      const winnerName = gameState.players.find(p => p.id === gameState.winner)?.username;
      
      if (isWinner) {
        toast.success('🎉 승리했습니다! 🎉', { duration: 5000 });
        // 승리 효과음
        const audio = new Audio('/sounds/win.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('효과음 재생 실패:', e));
      } else if (!isObserver) { // 관찰자가 아닌 경우에만 패배 효과음
        toast.error(`${winnerName}님이 승리했습니다`, { duration: 5000 });
        // 패배 효과음
        const audio = new Audio('/sounds/lose.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('효과음 재생 실패:', e));
      } else { // 관찰자인 경우
        toast(`${winnerName}님이 승리했습니다`, { duration: 5000 });
      }
    }
  }, [isFinished, gameState?.winner, playerId, gameState?.players, isObserver]);
  
  // 재경기 처리 시 알림
  useEffect(() => {
    if (isRegame) {
      toast('⚠️ 특수 패로 인한 재경기를 진행합니다', { 
        duration: 5000,
        style: {
          border: '1px solid #F97316',
          padding: '16px',
          color: '#F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#FFFAEE',
        },
      });
      // 재경기 효과음
      const audio = new Audio('/sounds/regame.mp3');
      audio.volume = 0.4;
      audio.play().catch(e => console.log('효과음 재생 실패:', e));
    }
  }, [isRegame]);
  
  // 이미 참가한 상태지만 게임 상태를 로딩 중인 경우
  if (!gameState) {
    return <GameTableSkeleton />;
  }
  
  // 게임 상태를 체크하는 부분에서 로그 추가
  console.log('게임 상태 체크:', {
    gameState: !!gameState,
    playerId: playerId,
    isObserver: isObserver, 
    playerCount: gameState?.players.length
  });
  
  // 게임 상태가 로드된 경우 (관찰자/참가자 모두)
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
        {error && (
          <div className="bg-red-600 text-white p-4 mb-4 rounded-md">
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-2rem)]">
          {/* 게임 테이블 영역 */}
          <div className="flex-grow rounded-xl overflow-hidden shadow-2xl bg-gray-900 bg-opacity-50 border border-gray-800 relative">
            <GameTable 
              gameState={gameState} 
              currentPlayerId={playerId || ''}
              gameId={gameId}
              fetchGameState={fetchGameState}
              isObserver={isObserver}
              onPlayerJoined={handleObserverToPlayer}
              onSeatChange={handleSeatChange}
              isHost={isHost}
              isReady={isReady}
              onToggleReady={handleToggleReady}
              onStartGame={handleStartGame}
              isStartingGame={isStartingGame}
              canStartGame={canStart}
            />
            
            {/* 게임 컨트롤 (오른쪽 아래에 위치) */}
            {gameState?.status === 'playing' && playerId && (
              <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 w-full max-w-xs md:max-w-sm z-20">
                <GameControls 
                  gameState={gameState} 
                  currentPlayerId={playerId}
                  onAction={handleAfterAction} 
                />
              </div>
            )}
          </div>
          
          {/* 우측 정보 패널 */}
          <div className="w-full md:w-80 lg:w-96 flex flex-col space-y-4">
            {/* 게임 컨트롤 (대기 및 종료 상태용) */}
            {gameState?.status !== 'playing' && playerId && (
              <div className="h-auto">
                <GameControls 
                  gameState={gameState} 
                  currentPlayerId={playerId}
                  onAction={handleAfterAction} 
                />
              </div>
            )}
            
            {/* 채팅 */}
            <div className="flex-grow h-auto overflow-hidden">
              <Chat 
                gameId={gameId} 
                playerId={playerId || ''} 
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