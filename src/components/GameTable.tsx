'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { GameState, Player, CardStatus } from '@/types/game';
import { TablePlayer } from './TablePlayer';
import { cn } from '@/lib/utils';
import { GameControls } from './GameControls';
import { Chat } from './Chat';
import { GameResult } from './GameResult';
import { toast } from 'react-hot-toast';
import { startGame, updateSeat, joinGame, toggleReady } from '@/lib/gameApi';
import { BettingTimer } from './BettingTimer';

interface GameTableProps {
  gameState: GameState;
  currentPlayerId: string;
  gameId: string;
  fetchGameState: () => void;
  isObserver?: boolean;
  onPlayerJoined?: (newPlayerId: string, newUsername: string) => void;
  onSeatChange?: (seatIndex: number) => Promise<void>;
  isHost?: boolean;
  isReady?: boolean;
  onToggleReady?: () => Promise<void>;
  onStartGame?: () => Promise<void>;
  isStartingGame?: boolean;
  canStartGame?: {canStart: boolean, message: string};
}

export function GameTable({ 
  gameState, 
  currentPlayerId, 
  gameId, 
  fetchGameState,
  isObserver = false,
  onPlayerJoined,
  onSeatChange,
  isHost = false,
  isReady = false,
  onToggleReady,
  onStartGame,
  isStartingGame = false,
  canStartGame = {canStart: false, message: ''}
}: GameTableProps) {
  const [showCards, setShowCards] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [joinSlot, setJoinSlot] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // 게임이 시작되었는지 여부를 체크
  useEffect(() => {
    if (gameState?.status === 'playing' && !hasStarted) {
      setHasStarted(true);
    } else if (gameState?.status === 'finished' && !showCards) {
      setShowCards(true);
    }
  }, [gameState?.status, hasStarted, showCards]);
  
  // 현재 플레이어 찾기
  const currentPlayer = gameState?.players.find(p => p.id === currentPlayerId);
  
  // 관찰자 모드거나 게임 상태가 없을 때 로딩 화면 표시
  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-yellow-400 border-yellow-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-400 font-bold">게임 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  // 게임 참가자인데 플레이어 정보가 없으면 오류 표시
  if (!isObserver && !currentPlayer) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center bg-red-900 bg-opacity-80 p-4 rounded-lg border border-red-700">
          <p className="text-white font-bold mb-2">플레이어 정보를 찾을 수 없습니다</p>
          <p className="text-gray-300 text-sm">새로고침 하시거나 빈 자리를 클릭하여 참가해주세요.</p>
        </div>
      </div>
    );
  }
  
  // 게임에 참여한 플레이어 수
  const playerCount = gameState.players.length;
  const maxPlayers = 8; // 최대 8명까지 참가 가능
  
  // 플레이어들의 화면 위치 매핑
  const positionedPlayers = useMemo(() => {
    if (!gameState || !gameState.players) return [];
    
    const currentUserId = currentPlayerId;
    let playersWithPosition = [...gameState.players];
    
    if (!playersWithPosition.length) return [];

    // 현재 플레이어 인덱스 찾기
    let myIndex = playersWithPosition.findIndex(p => p.id === currentUserId);
    
    const gameShowCards = gameState.show_cards || false;
    
    return playersWithPosition.map((player, index) => {
      // 상대적 위치 계산
      let relativePosition = myIndex === -1 ? index : (index - myIndex + playersWithPosition.length) % playersWithPosition.length;
      
      // 카드 상태 계산
      const playerCards = player.cards || [];
      const cardStatus: { status: CardStatus; value?: string }[] = [];
      
      // 2장 게임 모드
      if (gameState.game_mode === 2 || !gameState.game_mode) {
        playerCards.forEach((card, idx) => {
          // 카드 표시 여부 결정
          const cardsVisible = gameState.status === 'finished' || gameShowCards;
          const isMyCard = player.id === currentUserId;
          
          if (cardsVisible || isMyCard) {
            cardStatus.push({ status: 'open', value: String(card) });
          } else {
            cardStatus.push({ status: 'hidden' });
          }
        });
      } 
      // 3장 게임 모드
      else if (gameState.game_mode === 3) {
        playerCards.forEach((card, idx) => {
          const cardsVisible = gameState.status === 'finished' || gameShowCards;
          const isMyCard = player.id === currentUserId;
          const isOpenCard = player.open_card === card;
          
          // 첫 번째 베팅 라운드에서 오픈 카드 표시
          if (gameState.betting_round === 1 && isOpenCard) {
            cardStatus.push({ status: 'open', value: String(card) });
          }
          // 카드 표시 여부 결정
          else if (cardsVisible || isMyCard) {
            cardStatus.push({ status: 'open', value: String(card) });
          } else {
            cardStatus.push({ status: 'hidden' });
          }
        });
      }
      
      // 플레이어 데이터 반환
      return {
        ...player,
        position: relativePosition,
        isMe: player.id === currentUserId,
        isCurrentTurn: gameState.currentTurn === player.id,
        isDead: player.isDie === true,
        cards: cardStatus
      };
    });
  }, [gameState, currentPlayerId, showCards]);
  
  // 비어있는 자리 계산 (게임이 대기 중일 때만 참가 가능)
  const emptySlots = gameState.status === 'waiting' 
    ? Array.from({ length: maxPlayers }, (_, i) => i)
      .filter(seatIndex => !gameState.players.some(player => player.seat_index === seatIndex))
    : [];
    
  // 디버깅용 로그
  console.log('GameTable 정보:', {
    플레이어수: playerCount,
    플레이어정보: gameState.players.map(p => ({ id: p.id, name: p.username, seat: p.seat_index, ready: p.is_ready })),
    빈자리: emptySlots,
    방장여부: isHost,
    준비상태: isReady
  });

  // 게임 재시작 함수
  const handleRestartGame = async () => {
    try {
      // 플레이어의 잔액 확인 (최소 2000원 이상 필요)
      const player = gameState?.players.find(p => p.id === currentPlayerId);
      if (!player || player.balance < 2000) {
        toast.error('잔액이 부족합니다. 최소 2000원 이상 필요합니다.');
        return;
      }
      
      // 새 게임 시작
      await startGame(gameId);
      
      // 성공 메시지 표시
      toast.success('새 게임이 시작되었습니다.');
      
      // 게임 상태 새로고침
      fetchGameState();
    } catch (error) {
      console.error('게임 재시작 오류:', error);
      toast.error('게임을 재시작할 수 없습니다.');
    }
  };

  // 빈 자리 클릭 핸들러
  const handleSeatClick = async (seatIndex: number) => {
    if (!seatIndex && seatIndex !== 0) {
      console.error('유효하지 않은 자리 번호:', seatIndex);
      return;
    }
    
    // 이미 참가한 플레이어인 경우, 자리 이동 처리
    if (currentPlayer) {
      try {
        console.log(`자리 이동 시도: 좌석 ${seatIndex}`);
        
        // onSeatChange 함수가 있다면 호출
        if (onSeatChange) {
          await onSeatChange(seatIndex);
          fetchGameState(); // 게임 상태 새로고침
          toast.success('자리를 이동했습니다!');
        }
      } catch (error) {
        console.error('자리 이동 오류:', error);
        toast.error('자리를 이동할 수 없습니다.');
      }
    } else {
      // 신규 플레이어인 경우, 닉네임 입력 모달 표시
      setSelectedSeat(seatIndex);
      setShowNicknameModal(true);
    }
  };

  // 닉네임 입력 후 참가하기
  const handleJoinWithNickname = async () => {
    if (!selectedSeat && selectedSeat !== 0) {
      toast.error('선택된 좌석이 없습니다.');
      return;
    }
    
    if (!username.trim()) {
      toast.error('닉네임을 입력해주세요.');
      return;
    }
    
    try {
      setIsJoining(true);
      console.log(`참가 시도: 좌석 ${selectedSeat}, 닉네임 ${username}`);
      
      // 비동기 작업 시작 전 메시지 표시
      toast.loading('게임에 참가 중입니다...', { id: 'joining' });
      
      // 비동기 작업 실행
      const response = await joinGame(gameId, username, selectedSeat);
      const { playerId } = response;
      
      // 성공 시 로컬 스토리지에 플레이어 정보 저장
      localStorage.setItem(`game_${gameId}_player_id`, playerId);
      localStorage.setItem(`game_${gameId}_username`, username);
      localStorage.setItem(`game_${gameId}_seat_index`, String(selectedSeat));
      
      // 성공 메시지 표시
      toast.success('게임에 참가했습니다!', { id: 'joining' });
      
      // 모달 닫기
      setShowNicknameModal(false);
      
      // 상태 업데이트 전 약간의 딜레이
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 부모 컴포넌트에 참가 알림
      if (onPlayerJoined) {
        onPlayerJoined(playerId, username);
      }
      
      // 게임 상태 새로고침
      fetchGameState();
    } catch (error) {
      console.error('참가 오류:', error);
      
      // 실패 메시지 표시
      toast.error('게임에 참가할 수 없습니다. 다시 시도해주세요.', { id: 'joining' });
      
      // 에러 세부사항에 따른 구체적인 메시지 표시
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      if (errorMessage.includes('INVALID_STATE')) {
        toast.error('현재 게임에 참가할 수 없습니다. 게임이 이미 시작되었을 수 있습니다.');
      } else if (errorMessage.includes('DB_ERROR')) {
        toast.error('데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      // 상태 정리
      setIsJoining(false);
    }
  };

  return (
    <div className="h-full min-h-screen w-full bg-gradient-to-b from-green-800 to-green-950 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col lg:flex-row">
        {/* 메인 게임 영역 */}
        <div className="relative mb-4 flex-1 overflow-hidden rounded-2xl bg-gray-900 p-8 shadow-xl lg:mb-0 lg:mr-4">
          <div className="relative w-full max-w-4xl mx-auto aspect-square">
            {/* 테이블 배경 */}
            <div className="absolute inset-0 rounded-full border-8 border-yellow-700 bg-green-800 flex items-center justify-center shadow-2xl">
              {/* 테이블 패턴 */}
              <div className="absolute w-[95%] h-[95%] rounded-full border-4 border-yellow-600 bg-green-700 flex items-center justify-center">
                {/* 중앙 카드 및 배팅 영역 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                  <div className="px-4 py-2 bg-gray-900 bg-opacity-80 rounded-lg border border-yellow-600 shadow-lg">
                    <p className="text-yellow-400 font-bold text-center">
                      {gameState.game_mode === 3 ? '3장 게임' : '2장 게임'} | 총 배팅 금액: {gameState?.bettingValue?.toLocaleString() ?? 0} 포인트
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 플레이어 배치 */}
            {positionedPlayers.map((player) => (
              <TablePlayer
                key={player.id}
                player={player}
                isReady={player.is_ready}
                mode={gameState.game_mode || 2}
                bettingRound={gameState.betting_round || 1}
              />
            ))}
            
            {/* 배팅 타이머 - 게임 중이고 현재 턴인 플레이어가 있을 때만 표시 */}
            {gameState.status === 'playing' && gameState.currentTurn && (
              <BettingTimer 
                timeLimit={30} 
                visible={gameState.status === 'playing'}
                onTimeUp={async () => {
                  console.log('배팅 시간 초과');
                  try {
                    // 시간 초과 시 현재 플레이어가 나인지 확인
                    if (gameState.currentTurn === currentPlayerId) {
                      // 자동으로 다이 처리
                      await import('@/lib/gameApi').then(async ({ placeBet }) => {
                        try {
                          await placeBet(gameId, currentPlayerId, 'die');
                          console.log('시간 초과로 인한 자동 다이 처리 완료');
                          toast.success('시간 초과로 자동 다이 처리되었습니다.');
                        } catch (betError: any) {
                          console.error('다이 처리 오류:', betError);
                          toast.error(`다이 처리 오류: ${betError?.message || '알 수 없는 오류가 발생했습니다.'}`);
                        } finally {
                          // 게임 상태 새로고침
                          fetchGameState();
                        }
                      });
                    } else {
                      // 다른 플레이어의 턴이 만료되었을 때는 게임 상태만 새로고침
                      fetchGameState();
                    }
                  } catch (error: any) {
                    console.error('시간 초과 처리 오류:', error);
                    toast.error(`시간 초과 처리 오류: ${error?.message || '알 수 없는 오류가 발생했습니다.'}`);
                  }
                }}
              />
            )}
          </div>
        </div>
        
        {/* 관찰자 모드 메시지 */}
        {isObserver && (
          <div className="absolute top-4 left-4 px-4 py-2 bg-gray-800 bg-opacity-90 rounded-md border border-yellow-500 text-yellow-300 text-sm z-30 shadow-lg">
            <span className="font-semibold">관찰자 모드</span> - 게임을 관찰하는 중입니다. 참가하시려면 빈 자리를 클릭하세요.
          </div>
        )}
        
        {/* 게임 상태 표시 */}
        {gameState.status === 'waiting' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30">
            <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
              <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 대기 중</h2>
              <p className="text-white">현재 {playerCount}명이 참가했습니다. 게임을 시작하려면 {maxPlayers}명이 참가해야 합니다.</p>
              <p className="text-white mt-1">게임이 시작되면 각 플레이어는 2장의 카드를 받게 됩니다.</p>

              {/* 게임 시작 버튼 */}
              {isHost && onStartGame && (
                <button 
                  onClick={onStartGame}
                  disabled={!canStartGame.canStart || isStartingGame}
                  className={`px-4 py-2 rounded font-medium ${
                    canStartGame.canStart 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-gray-600 cursor-not-allowed'}`}
                  title={!canStartGame.canStart ? canStartGame.message : '게임 시작하기'}
                >
                  {isStartingGame ? '시작 중...' : '게임 시작'}
                </button>
              )}

              {/* 준비 버튼 */}
              {!isObserver && onToggleReady && (
                <button 
                  onClick={() => {
                    // 준비 버튼 클릭 시 기본 배팅 금액 확인
                    const player = gameState?.players.find(p => p.id === currentPlayerId);
                    if (!isReady && player && player.balance < (gameState?.baseBet ?? 0)) {
                      toast.error(`기본 배팅 금액이 부족합니다. 기본 배팅 금액: ${(gameState?.baseBet ?? 0).toLocaleString()}원`);
                      return;
                    }
                    onToggleReady();
                  }}
                  disabled={!onToggleReady}
                  className={`px-4 py-2 rounded font-medium ${isReady 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0)
                      ? 'bg-gray-600 cursor-not-allowed' // 기본 배팅 금액이 부족하면 버튼 비활성화
                      : 'bg-green-600 hover:bg-green-700'}`}
                  title={currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0)
                    ? `기본 배팅 금액: ${(gameState?.baseBet ?? 0).toLocaleString()}원`
                    : isReady ? '준비 취소' : '준비 완료'}
                >
                  {isReady ? '준비 취소' : '준비 완료'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {gameState.status === 'finished' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30">
            <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
              <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 종료</h2>
              <p className="text-white">
                승자: {gameState.players.find(p => p.id === gameState.winner)?.username || '없음'}
              </p>
            </div>
          </div>
        )}
        
        {/* 빈 자리 (게임 대기 중일 때만 표시) */}
        {gameState.status === 'waiting' && emptySlots.map((position) => (
          <div
            key={`empty-${position}`}
            className={cn(
              'absolute z-20',
              getEmptySlotStyles(position)
            )}
          >
            <button
              onClick={() => handleSeatClick(position)}
              className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 bg-opacity-60 hover:bg-opacity-80 border-2 border-dashed border-yellow-400 transition-all transform hover:scale-110"
            >
              <span className="text-yellow-400 font-bold text-xs">
                {isObserver ? '참가하기' : '빈 자리'}
              </span>
            </button>
          </div>
        ))}
        
        {/* 게임 정보 (상단) */}
        <div className="relative z-10 flex justify-between items-center px-4 py-2 bg-gray-900 bg-opacity-70 border-b border-gray-700">
          <div className="text-yellow-300 font-bold text-lg">
            {gameState.room_name || '섯다 게임'}
            <span className="ml-2 text-xs text-gray-400">
              {gameState.status === 'waiting' ? '대기 중' : 
               gameState.status === 'playing' ? '게임 중' : '게임 종료'}
            </span>
          </div>

          <div className="flex space-x-4">
            {/* 게임이 대기 중일 때만 표시할 준비/시작 버튼 */}
            {gameState.status === 'waiting' && !isObserver && (
              <div className="flex space-x-2">
                {/* 방장이 아닌 경우 준비 버튼 표시 */}
                {!isHost && onToggleReady && (
                  <div className="relative">
                    <button 
                      onClick={() => {
                        // 준비 버튼 클릭 시 기본 배팅 금액 확인
                        const player = gameState?.players.find(p => p.id === currentPlayerId);
                        if (!isReady && player && player.balance < (gameState?.baseBet ?? 0)) {
                          toast.error(`기본 배팅 금액이 부족합니다. 기본 배팅 금액: ${(gameState?.baseBet ?? 0).toLocaleString()}원`);
                          return;
                        }
                        onToggleReady();
                      }}
                      disabled={!onToggleReady}
                      className={`px-3 py-1 rounded text-sm font-bold transition-colors ${isReady 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0)
                          ? 'bg-gray-600 cursor-not-allowed' // 기본 배팅 금액이 부족하면 버튼 비활성화
                          : 'bg-green-600 hover:bg-green-700'}`}
                      title={currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0)
                        ? `기본 배팅 금액: ${(gameState?.baseBet ?? 0).toLocaleString()}원`
                        : isReady ? '준비 취소' : '준비 완료'}
                    >
                      {isReady ? '준비 취소' : '준비 완료'}
                    </button>
                    {!isReady && currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0) && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-red-800 text-white text-xs p-1 rounded shadow-lg">
                        기본 배팅 금액: {(gameState?.baseBet ?? 0).toLocaleString()}원
                      </div>
                    )}
                  </div>
                )}
                
                {/* 방장인 경우 게임 시작 버튼 표시 */}
                {isHost && onStartGame && (
                  <button 
                    onClick={onStartGame}
                    disabled={!canStartGame.canStart || isStartingGame}
                    className={`px-3 py-1 rounded font-medium ${
                      canStartGame.canStart 
                        ? 'bg-yellow-600 hover:bg-yellow-700' 
                        : 'bg-gray-600 cursor-not-allowed'}`}
                    title={!canStartGame.canStart ? canStartGame.message : '게임 시작하기'}
                  >
                    {isStartingGame ? '시작 중...' : '게임 시작'}
                  </button>
                )}
              </div>
            )}

            {/* 현재 플레이어 잔액 표시 */}
            <div className="bg-gray-800 px-3 py-1 rounded text-sm flex items-center">
              <span className="text-gray-400">잔액: </span>
              <span className="text-yellow-300 font-bold">
                {currentPlayer?.balance?.toLocaleString() ?? 0}원
              </span>
              
              {/* 기본 배팅 금액 표시 */}
              {gameState.status === 'waiting' && (gameState?.baseBet ?? 0) > 0 && (
                <div className="ml-3 flex items-center" title="기본 배팅 금액">
                  <span className="text-gray-400 text-xs mr-1">기본 배팅:</span>
                  <span className={`text-xs font-bold ${currentPlayer && currentPlayer.balance >= (gameState?.baseBet ?? 0) ? 'text-green-400' : 'text-red-400'}`}>
                    {(gameState?.baseBet ?? 0).toLocaleString()}원
                  </span>
                  {currentPlayer && currentPlayer.balance < (gameState?.baseBet ?? 0) && (
                    <span className="text-xs text-red-500 ml-1">(부족)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 닉네임 입력 모달 */}
        {showNicknameModal && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-900 p-6 rounded-lg border-2 border-yellow-500 text-white shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-yellow-400 mb-4">닉네임 입력</h2>
              <p className="mb-4 text-gray-300">닉네임을 입력하여 게임에 참가하세요.</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">닉네임</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="닉네임을 입력하세요"
                  className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-yellow-500 focus:outline-none"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowNicknameModal(false)} 
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleJoinWithNickname} 
                  disabled={isJoining || !username.trim()}
                  className={`px-4 py-2 rounded font-medium ${
                    isJoining || !username.trim()
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
                >
                  {isJoining ? '참가 중...' : '참가하기'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 게임 결과 모달 - 게임이 끝나고 승자가 있을 때만 표시 */}
        {gameState?.status === 'finished' && gameState.winner && (
          <GameResult 
            winner={gameState.players.find(p => p.id === gameState.winner) as Player} 
            players={gameState.players} 
            restartGame={handleRestartGame}
          />
        )}
      </div>
    </div>
  );
}

// 빈 자리 위치 스타일 계산 함수
function getEmptySlotStyles(position: number): string {
  // ube48 uc790ub9ac ud45cuc2dc uc704uce58ub97c uc5c5ub370uc774ud2b8ud558uc5ec ud50cub808uc774uc5b4 uc704uce58uc640 ub9deucd94uae30
  switch (position % 8) {
    case 0: // ud558ub2e8 uc911uc559
      return 'bottom-[5%] left-1/2 -translate-x-1/2';
    case 1: // uc624ub978ucabd ud558ub2e8
      return 'bottom-[20%] right-[10%]';
    case 2: // uc624ub978ucabd
      return 'right-[5%] top-1/2 -translate-y-1/2';
    case 3: // uc624ub978ucabd uc0c1ub2e8
      return 'top-[20%] right-[10%]';
    case 4: // uc0c1ub2e8 uc911uc559
      return 'top-[5%] left-1/2 -translate-x-1/2';
    case 5: // uc67cuc058 uc0c1ub2e8
      return 'top-[20%] left-[10%]';
    case 6: // uc67cuc058
      return 'left-[5%] top-1/2 -translate-y-1/2';
    case 7: // uc67cuc058 ud558ub2e8
      return 'bottom-[20%] left-[10%]';
    default:
      return 'bottom-[5%] left-1/2 -translate-x-1/2';
  }
}