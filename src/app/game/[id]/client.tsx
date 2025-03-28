'use client';

// Window 객체에 커스텀 속성 추가
declare global {
  interface Window {
    _isSeatChanging?: boolean;
  }
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameState, Player, Message } from '@/types/game';
// 모든 API 기능을 통합 인덱스에서 임포트
import {
  // 게임 상태 관련
  getGameState,
  getGamePlayers,
  // 플레이어 관련
  joinGame,
  // 좌석 관련
  isSeatOccupied,
  changeSeat,
  // 메시지 관련
  getMessages,
  sendMessage,
  // 게임 액션 관련
  isRoomOwner,
  canStartGame,
  startGame,
  toggleReady,
  handleBettingTimeout,
  // 배팅 관련
  processBetting,
  BettingAction
} from '@/lib/api';
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
        toast.error(`메시지 불러오기 오류: ${error.message || '알 수 없는 오류'}`);
      }
    } catch (err: any) {
      console.error('메시지 불러오기 예외:', err);
      toast.error(`메시지 불러오기 오류: ${err?.message || '알 수 없는 오류'}`);
    }
  };
  
  // 게임 상태 불러오기
  const fetchGameState = async () => {
    console.log(`[fetchGameState] Starting fetch for gameId: ${gameId}`);
    try {
      const fetchStart = Date.now();
      const data = await getGameState(gameId);
      console.log(`[fetchGameState] Received response in ${Date.now() - fetchStart}ms`);      
      console.log('[fetchGameState] Received players data:', data.players.map(p => ({
        id: p.id,
        seat_index: p.seat_index,
        username: p.username,
        is_ready: p.is_ready
      })));
      
      setGameState(data);
      console.log('[fetchGameState] State updated in React component');
      
      // 플레이어 정보가 있는 경우
      if (playerId) {
        console.log(`[fetchGameState] Found playerId: ${playerId}, checking status`);
        
        // 방장 여부 확인
        const hostStatusStart = Date.now();
        const hostStatus = await isRoomOwner(gameId, playerId);
        console.log(`[fetchGameState] Host status check completed in ${Date.now() - hostStatusStart}ms: ${hostStatus}`);
        setIsHost(hostStatus);
        
        // 준비 상태 확인
        const player = data.players.find(p => p.id === playerId);
        if (player) {
          const readyStatus = player.is_ready || false;
          console.log(`[fetchGameState] Player ${playerId} ready status: ${readyStatus}`);
          setIsReady(readyStatus);
        } else {
          console.warn(`[fetchGameState] Player with ID ${playerId} not found in game state players`);
        }
        
        // 게임 시작 가능 여부 확인 (방장인 경우만)
        if (hostStatus) {
          const startCheckStart = Date.now();
          const canStartResult = await canStartGame(gameId);
          console.log(`[fetchGameState] Can start game check completed in ${Date.now() - startCheckStart}ms: ${JSON.stringify(canStartResult)}`);
          
          setCanStart(canStartResult);
        }
      } else {
        console.log('[fetchGameState] No playerId found, skipping player-specific checks');
      }
      
      console.log('[fetchGameState] Completed successfully');
      return data;
    } catch (err: any) {
      console.error('[fetchGameState] uc624ub958 ubc1cuc0dd:', err);
      const errorMsg = err?.message || 'uac8cuc784 uc0c1ud0dc uac00uc838uc624uae30 uc911 uc624ub958uac00 ubc1cuc0ddud588uc2b5ub2c8ub2e4.';
      setError(errorMsg);
      toast.error(`uac8cuc784 ub85cub4dc uc624ub958: ${errorMsg}`);
      return null;
    }
  };
  
  // 새로운 플레이어 추가 처리 함수
  // 실제 플레이어 추가 로직을 처리하는 함수 (최신 구현)  
  const handleAddPlayer = async (nickname: string, seatIndex?: number): Promise<void> => {
    console.log(`[handleAddPlayer] Observer joining game with nickname ${nickname}, seat: ${seatIndex ?? 'auto'}`);
    try {
      // 닉네임 검증
      if (!nickname || !nickname.trim()) {
        toast.error('닉네임을 입력해주세요.');
        return;
      }

      // 게임 참가 API 호출 (player_id 생성)
      const { playerId: newPlayerId, gameState: newGameState } = await joinGame(gameId, nickname, seatIndex);
      
      // 생성된 player_id 확인 및 저장
      if (!newPlayerId) {
        console.error('[handleAddPlayer] Failed to get valid player_id from joinGame');
        toast.error('플레이어 ID 생성에 실패했습니다.');
        return;
      }
      
      console.log(`[handleAddPlayer] Successfully joined game. New player_id: ${newPlayerId}`);
      
      // 로컬 스토리지에 플레이어 정보 저장
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`game_${gameId}_player_id`, newPlayerId);
          localStorage.setItem(`game_${gameId}_username`, nickname);
          if (seatIndex !== undefined) {
            localStorage.setItem(`game_${gameId}_seat_index`, String(seatIndex));
          }
        }
      } catch (e) {
        console.warn('[handleAddPlayer] LocalStorage not available for saving:', e);
        // localStorage 접근 실패 시 무시하고 계속 진행
      }
      
      // 상태 업데이트
      setPlayerId(newPlayerId);
      setUsername(nickname);
      setIsObserver(false); // 관찰자 모드에서 플레이어 모드로 전환
      
      // 게임 상태와 메시지 새로고침
      await fetchGameState();
      await fetchMessages();
      
      // 참가 성공 메시지
      toast.success(`${nickname}님이 게임에 참가했습니다!`);
      // 값을 반환하지 않음 (Promise<void>)
    } catch (err: any) {
      console.error('[handleAddPlayer] Error adding player:', err);
      toast.error(`게임 참가 오류: ${err?.message || '알 수 없는 오류가 발생했습니다.'}`);
    }
  };
  
  // GameBoard 컴포넌트에 전달할 래퍼 함수
  // 매개변수 순서 변환: (seatIndex, username) => (username, seatIndex)
  const handleAddPlayerForGameBoard = async (seatIndex: number, username: string): Promise<void> => {
    return handleAddPlayer(username, seatIndex);
  };
  
  // 자리 변경 처리 함수
  const handleSeatChange = async (seatIndex: number) => {
    console.log(`[handleSeatChange] Starting seat change process - ${isObserver ? 'Observer' : 'Player'} mode, Seat: ${seatIndex}`);
    
    if (!gameId) {
      console.error('[handleSeatChange] Cannot change seat: gameId is undefined');
      toast.error('게임 ID가 정의되지 않았습니다.');
      return;
    }
    
    if (isSeatChanging) {
      console.log('[handleSeatChange] Seat change already in progress, ignoring request');
      toast.error('좌석 변경이 이미 진행 중입니다.');
      return;
    }
    
    // 좌석 변경 중 표시 (중복 요청 방지)
    setIsSeatChanging(true);
    if (typeof window !== 'undefined') {
      (window as any)._isSeatChanging = true;
    }
    
    try {
      console.log(`[handleSeatChange] Checking conditions - isObserver: ${isObserver}, playerId: ${playerId}`);
      console.log(`[handleSeatChange] Host status: ${isHost ? 'IS HOST' : 'NOT HOST'}`);
      
      // gameState 확인
      if (!gameState) {
        console.error('[handleSeatChange] Game state is null or undefined');
        toast.error('게임 상태를 불러올 수 없습니다. 새로고침 후 다시 시도해주세요.');
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      // 게임 상태 확인 (대기 중이 아니면 자리 변경 불가)
      if (gameState.status !== 'waiting') {
        console.log(`[handleSeatChange] Current game status: ${gameState.status}`);
        toast.error('게임이 진행 중일 때는 자리를 변경할 수 없습니다.');
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      // 대상 좌석이 이미 점유되어 있는지 DB에서 직접 확인
      const tempPlayerId = playerId || 'temp_observer_id'; // 관찰자인 경우 임시 ID 사용
      const isOccupied = await isSeatOccupied(seatIndex, tempPlayerId, gameId);
      
      if (isOccupied) {
        console.log(`[handleSeatChange] Seat ${seatIndex} is already occupied by another player`);
        toast.error('이미 다른 플레이어가 선택한 좌석입니다.');
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      // 좌석이 비어있음이 확인됨
      console.log(`[handleSeatChange] Verified seat ${seatIndex} is available`);
      
      // 관찰자 모드인 경우 - 닉네임 입력 후 플레이어로 추가
      if (isObserver) {
        console.log('[handleSeatChange] Observer mode detected, prompting for nickname');
        
        // 닉네임 입력창 표시
        const nickname = prompt('게임에 참가할 닉네임을 입력해주세요');
        
        // 닉네임이 입력되지 않은 경우 처리 중단
        if (!nickname || nickname.trim() === '') {
          console.log('[handleSeatChange] Nickname input cancelled or empty');
          toast.error('닉네임을 입력해야 게임에 참가할 수 있습니다.');
          setIsSeatChanging(false);
          if (typeof window !== 'undefined') {
            (window as any)._isSeatChanging = false;
          }
          return;
        }
        
        console.log(`[handleSeatChange] Observer provided nickname: ${nickname}, adding as player to seat ${seatIndex}`);
        
        try {
          // handleAddPlayer 함수를 호출하여 플레이어 추가 (닉네임, 좌석 번호 순서로 전달)
          await handleAddPlayer(nickname, seatIndex);
          console.log('[handleSeatChange] Observer successfully added as player');
          
          // 관찰자를 플레이어로 전환 및 UI 업데이트
          setIsObserver(false);
          toast.success(`${nickname}님이 ${seatIndex}번 좌석에 참가했습니다!`);
          
          // 최신 게임 상태 로드
          await fetchGameState();
          await fetchMessages();
        } catch (addError: any) {
          console.error('[handleSeatChange] Failed to add observer as player:', addError);
          toast.error(`플레이어 등록 실패: ${addError?.message || '알 수 없는 오류가 발생했습니다.'}`);
        }
        
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      // 기존 플레이어의 좌석 변경 처리
      if (!playerId) {
        console.error('[handleSeatChange] PlayerId is required for seat change');
        toast.error('플레이어 ID가 없습니다.');
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      console.log(`[handleSeatChange] Player changing seat: ${playerId}, to seat: ${seatIndex}`);
      const updateSuccess = await changeSeat(playerId, seatIndex, gameId);
      
      if (!updateSuccess) {
        console.error('[handleSeatChange] Seat update failed');
        toast.error('좌석 변경에 실패했습니다.');
        setIsSeatChanging(false);
        if (typeof window !== 'undefined') {
          (window as any)._isSeatChanging = false;
        }
        return;
      }
      
      console.log('[handleSeatChange] Seat update successful');
      toast.success('좌석을 변경했습니다!');
      
      // 최신 게임 상태 가져오기
      await fetchGameState();
    } catch (error) {
      console.error('[handleSeatChange] Error:', error);
      toast.error('좌석 변경 중 오류가 발생했습니다.');
    } finally {
      // 좌석 변경 상태 초기화
      setIsSeatChanging(false);
      if (typeof window !== 'undefined') {
        (window as any)._isSeatChanging = false;
      }
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
    } catch (err: any) {
      console.error('게임 참가 오류:', err);
      const errorMsg = err?.message || '게임 참가 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`게임 참가 오류: ${errorMsg}`);
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
      // 현재 준비 상태의 반대값으로 명시적으로 설정
      const newReadyState = !isReady;
      const result = await toggleReady(gameId, playerId, newReadyState);
      if (result.success) {
        setIsReady(result.isReady || false);
        toast.success(isReady ? '준비 취소되었습니다.' : '준비 완료!');
      } else {
        throw new Error(result.error || '준비 상태 변경 실패');
      }
    } catch (err: any) {
      console.error('준비 상태 변경 오류:', err);
      toast.error(`준비 상태를 변경하는 중 오류가 발생했습니다: ${err.message || ''}`);
    } finally {
      setIsTogglingReady(false);
    }
  };
  
  // 게임 시작 처리 (방장만 가능)
  const handleStartGame = async () => {
    if (!playerId || !isHost) return;
    
    try {
      setIsStartingGame(true);
      
      // 최신 게임 상태 가져오기
      await fetchGameState();
      
      // 시작 가능 여부 확인
      const startStatus = await canStartGame(gameId);
      console.log('게임 시작 가능 여부:', startStatus);
      
      if (!startStatus.canStart) {
        toast.error(startStatus.message);
        return;
      }
      
      // 현재 준비된 플레이어 수 확인
      const { data: readyPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', gameId)
        .eq('is_ready', true)
        .is('is_die', false);
      
      console.log('준비된 플레이어 수:', readyPlayers?.length);
      
      if (!readyPlayers || readyPlayers.length < 2) {
        toast.error('게임 시작을 위해 최소 2명의 준비된 플레이어가 필요합니다.');
        return;
      }
      
      // 게임 시작 요청
      const startResult = await startGame(gameId, playerId);
      
      if (startResult.success) {
        toast.success('게임이 시작됩니다!');
      } else {
        throw new Error(startResult.error || '게임 시작 실패');
      }
      
      // 게임 상태를 즉시 갱신하지 않고 실시간 구독에 의존
      // 실시간 업데이트가 자동으로 상태를 갱신할 것임
    } catch (err: any) {
      console.error('게임 시작 오류:', err);
      const errorMessage = err?.message || '게임을 시작하는 중 오류가 발생했습니다.';
      toast.error(errorMessage);
    } finally {
      setIsStartingGame(false);
    }
  };
  
  // 타임아웃 확인 로직
  useEffect(() => {
    // 게임 플레이 중이 아니거나 게임 상태가 없으면 타이머 설정 안함
    if (!gameState || gameState.status !== 'playing') {
      return;
    }
    
    console.log('타임아웃 감시 시작 - 현재 플레이어:', gameState.currentTurn);
    
    // 타이머 마지막 체크 시간 기록 (2초마다 체크하며 중복 처리 방지)
    let lastTimeoutCheckTime = 0;
    let lastProcessedTimeout = '';
    
    // 타임아웃 처리 함수
    const checkAndHandleTimeout = async () => {
      try {
        // 베팅 종료 시간이 있고, 게임이 플레이 중인 경우에만 체크
        if (gameState && gameState.status === 'playing' && gameState.betting_end_time) {
          const currentTime = new Date().getTime();
          const bettingEndTime = new Date(gameState.betting_end_time).getTime();
          
          // 현재 턴 플레이어 ID 확인
          const currentPlayerTurn = gameState.currentTurn || '';
          const timeoutKey = `${gameId}_${currentPlayerTurn}_${gameState.betting_end_time}`;
          
          // 디버깅용 로그
          const remainingSeconds = Math.floor((bettingEndTime - currentTime) / 1000);
          
          if (remainingSeconds <= 5 || remainingSeconds % 5 === 0) {
            console.log('타임아웃 체크:', {
              현재시간: new Date(currentTime).toLocaleString(),
              종료시간: new Date(bettingEndTime).toLocaleString(),
              남은시간: remainingSeconds + '초',
              현재턴: currentPlayerTurn,
              시간초과여부: currentTime > bettingEndTime ? '초과됨' : '포함됨'
            });
          }
          
          // 베팅 시간이 초과되고 마지막 처리 후 충분한 시간이 지났을 때만 실행 (2초)
          const timeElapsedSinceLastCheck = currentTime - lastTimeoutCheckTime;
          if (currentTime > bettingEndTime && 
              timeElapsedSinceLastCheck > 2000 && 
              lastProcessedTimeout !== timeoutKey) {
            
            console.log('홈 베팅 시간 초과 감지');
            console.log(`타임아웃 처리 요청 - 게임ID: ${gameId}, 현재턴: ${currentPlayerTurn}`);
            
            // 중복 처리 방지를 위해 현재 처리 중인 타임아웃 기록
            lastTimeoutCheckTime = currentTime;
            lastProcessedTimeout = timeoutKey;
            
            if (!currentPlayerTurn) {
              console.error('현재 턴 플레이어 ID가 없어 타임아웃 처리를 중단합니다.');
              return;
            }
            
            try {
              // 위잫 표시를 위한 구분자
              console.log('\n홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈');
              console.log(`타임아웃 처리 시작 - 플레이어: ${currentPlayerTurn}`);
              console.log('\n');
              
              // 타임아웃 API 호출
              const result = await handleBettingTimeout(gameId, currentPlayerTurn);
              console.log(`\n타임아웃 API 호출 결과:`, result);
              
              if (result.success) {
                console.log('홈 타임아웃 처리 성공');
                
                // 즉시 게임 상태 다시 불러오기
                console.log('타임아웃 처리 후 즉시 게임 상태 새로고침');
                await fetchGameState();
                
                // 안정적인 상태 갱신을 위해 여러 번 새로고침 (지정된 시간 후)
                const intervals = [500, 1500, 3000, 5000];
                for (const delay of intervals) {
                  setTimeout(async () => {
                    console.log(`타임아웃 처리 후 ${delay}ms 게임 상태 강제 새로고침`);
                    await fetchGameState();
                  }, delay);
                }
              } else {
                console.error('홈 타임아웃 처리 실패:', result.error);
                
                // 실패 시 3초 후 재시도
                setTimeout(async () => {
                  console.log('타임아웃 처리 실패 - 3초 후 재시도');
                  try {
                    const retryResult = await handleBettingTimeout(gameId, currentPlayerTurn);
                    console.log('재시도 결과:', retryResult);
                    
                    // 성공 시 게임 상태 갱신
                    if (retryResult.success) {
                      console.log('타임아웃 재시도 성공 - 게임 상태 갱신');
                      await fetchGameState();
                    }
                  } catch (retryError) {
                    console.error('타임아웃 재시도 중 오류:', retryError);
                  }
                }, 3000);
              }
              
              console.log('\n홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈홈');
            } catch (apiError) {
              console.error('타임아웃 API 호출 중 오류:', apiError);
              
              // 오류 발생 시 3초 후 게임 상태 강제 새로고침
              setTimeout(async () => {
                console.log('API 오류 후 게임 상태 강제 새로고침');
                await fetchGameState();
              }, 3000);
            }
          }
        }
      } catch (err) {
        console.error('타임아웃 체크 중 예외 발생:', err);
        
        // 오류 발생 시에도 게임 상태 새로고침
        setTimeout(async () => {
          console.log('오류 후 게임 상태 강제 새로고침');
          await fetchGameState();
        }, 2000);
      }
    };
    
    // 최초 실행
    checkAndHandleTimeout();
    
    // 정기적 체크 (1초마다) - 더 빠른 감지를 위해 간격 줄임
    const checkTimeoutInterval = setInterval(checkAndHandleTimeout, 1000);
    
    console.log('타임아웃 감시 설정 완료 - 간격: 1초');
    
    return () => {
      clearInterval(checkTimeoutInterval);
      console.log('타임아웃 감시 종료');
    };
  }, [gameId, gameState, fetchGameState]);
  
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
              playerId={playerId || undefined}
              currentPlayerId={playerId || undefined}
              gameId={gameId}
              onSeatChange={handleSeatChange}
              onPlayerJoined={handleObserverToPlayer}
              fetchGameState={fetchGameState}
              onToggleReady={handleToggleReady}
              isReady={isReady}
              onStartGame={handleStartGame}
              isStartingGame={isStartingGame}
              canStartGame={canStart}
              setGameState={setGameState}
              isHost={isHost}
              isObserver={isObserver}
              onAddPlayer={handleAddPlayerForGameBoard}
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