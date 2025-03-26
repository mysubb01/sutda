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
  playerId?: string;
  currentPlayerId?: string;
  gameId?: string;
  isObserver?: boolean;
  isHost?: boolean;
  onSeatChange?: (seatIndex: number) => Promise<void>;
  onAddPlayer?: (seatIndex: number, username: string) => Promise<void>;
  onPlayerJoined?: (newPlayerId: string, newUsername: string) => void;
  onRevealCards?: () => Promise<void>;
  onAction?: (action: string, amount?: number) => Promise<void>;
  fetchGameState?: () => Promise<GameState | null>;
  onToggleReady?: () => Promise<void>;
  isReady?: boolean;
  onStartGame?: () => Promise<void>;
  isStartingGame?: boolean;
  canStartGame?: {canStart: boolean, message: string};
  setGameState?: (newGameState: GameState) => void;
}

export function GameTable({ 
  gameState, 
  playerId, 
  currentPlayerId, 
  gameId,
  isObserver = false,
  isHost = false,
  onSeatChange,
  onAddPlayer,
  onPlayerJoined,
  onRevealCards,
  onAction,
  fetchGameState,
  onToggleReady,
  isReady = false,
  onStartGame,
  isStartingGame = false,
  canStartGame = {canStart: false, message: ''},
  setGameState
}: GameTableProps) {
  const [showCards, setShowCards] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [joinSlot, setJoinSlot] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
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
  const maxPlayers = 5; // 최대 5명까지 참가 가능
  
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
        isDead: player.is_die === true,
        cards: cardStatus
      };
    });
  }, [gameState, currentPlayerId, showCards]);
  
  // 비어있는 자리 계산 (useMemo 훅으로 감싸기)
  const emptySlots = useMemo(() => {
    if (gameState.status !== 'waiting') return [];
    
    // 비어있는 자리 목록 계산
    return Array.from({ length: maxPlayers }, (_, i) => i)
      .filter(seatIndex => !gameState.players.some(player => player.seat_index === seatIndex));
  }, [gameState.players, gameState.status, maxPlayers]);
  
  // 디버깅용 로그
  console.log('GameTable 정보:', {
    플레이어수: playerCount,
    플레이어정보: gameState.players.map(p => ({ id: p.id, name: p.username, seat: p.seat_index, ready: p.is_ready })),
    빈자리: emptySlots,
    방장여부: isHost,
    준비상태: isReady
  });

  // 좌석 클릭 핸들러
  const handleSeatClick = async (seatIndex: number) => {
    if (!seatIndex && seatIndex !== 0) {
      console.error('[GameTable] Invalid seat index:', seatIndex);
      return;
    }
    
    console.log(`[GameTable] Seat clicked: ${seatIndex}, Current state:`, { 
      gameId,
      isObserver, 
      currentPlayer: currentPlayer ? { 
        id: currentPlayer.id, 
        seat: currentPlayer.seat_index,
        name: currentPlayer.username 
      } : null,
      allPlayers: gameState.players.map(p => ({ id: p.id, seat_index: p.seat_index }))
    });
    
    // 게임이 진행 중인 경우 자리 이동 불가
    if (gameState.status !== 'waiting') {
      toast.error('게임이 진행 중일 때는 자리를 이동할 수 없습니다.');
      return;
    }
    
    // 이미 참가한 플레이어인 경우, 자리 이동 처리
    if (currentPlayer && onSeatChange) {
      try {
        // 이미 다른 플레이어가 해당 자리에 있는지 확인
        const isOccupied = gameState.players.some(p => 
          p.id !== currentPlayer.id && p.seat_index === seatIndex
        );
        
        if (isOccupied) {
          console.log(`[GameTable] Seat ${seatIndex} is already taken by another player`);
          toast.error('이미 다른 플레이어가 선택한 좌석에 있습니다.');
          return;
        }
        
        // 현재 같은 자리에 있는지 확인
        if (currentPlayer.seat_index === seatIndex) {
          console.log('[GameTable] Already sitting in this seat');
          toast.error('이미 해당 좌석에 앉아있습니다.');
          return;
        }
        
        // DB 업데이트 전 상태 기록
        const previousSeatIndex = currentPlayer.seat_index;
        console.log(`[GameTable] Moving player from seat ${previousSeatIndex} to ${seatIndex}`);
        
        // UI 즉시 반영 (낙관적 업데이트)
        console.log('[GameTable] Starting optimistic UI update - Original players:', JSON.stringify(gameState.players));
        
        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.id === currentPlayer.id);
        
        if (playerIndex >= 0) {
          const updatedPlayer = { 
            ...newPlayers[playerIndex], 
            seat_index: seatIndex 
          };
          
          console.log('[GameTable] Optimistic UI update:', { 
            playerId: updatedPlayer.id,
            oldSeat: newPlayers[playerIndex].seat_index,
            newSeat: updatedPlayer.seat_index,
          });
          
          newPlayers[playerIndex] = updatedPlayer;
          console.log('[GameTable] Players array after update:', JSON.stringify(newPlayers));
          
          // 낙관적 업데이트 - 새 게임 상태 생성
          const newGameState = {
            ...gameState,
            players: newPlayers
          };
          
          // 상태 업데이트 함수가 있다면 호출
          if (typeof setGameState === 'function') {
            console.log('[GameTable] Updating gameState with new player positions');
            setGameState(newGameState);
            console.log('[GameTable] GameState updated locally');
          } else {
            console.warn('[GameTable] setGameState is not available, skipping optimistic update');
          }
        } else {
          console.warn(`[GameTable] Player ${currentPlayer.id} not found in gameState.players array`);
        }
        
        // API 호출
        console.log(`[GameTable] Calling onSeatChange API for seat ${seatIndex}`);
        const apiStart = Date.now();
        await onSeatChange(seatIndex);
        console.log(`[GameTable] API call completed in ${Date.now() - apiStart}ms`);
        
        // UI 업데이트 완료 표시
        toast.success('자리를 이동했습니다!');
        
        // 게임 상태 새로고침 (fetchGameState가 있는 경우에만 호출)
        console.log('[GameTable] Refreshing game state...');
        if (typeof fetchGameState === 'function') {
          const fetchStart = Date.now();
          const refreshedState = await fetchGameState();
          console.log(`[GameTable] Game state refreshed in ${Date.now() - fetchStart}ms`);
          console.log('[GameTable] Refreshed player data:', refreshedState?.players.map(p => ({ 
            id: p.id, 
            seat_index: p.seat_index 
          })));
        }
      } catch (error) {
        console.error('[GameTable] Seat change error:', error);
        toast.error('자리 이동 중 오류가 발생했습니다.');
      }
    } else {
      // 신규 플레이어인 경우, 닉네임 입력 모달에 자리 번호 전달
      setSelectedSeat(seatIndex);
      setShowNicknameModal(true);
    }
  };

  // 카드 공개 함수
  const handleRevealCard = () => {
    if (typeof onRevealCards === 'function') {
      onRevealCards();
    } else {
      console.warn('[GameTable] onRevealCards function is not available');
    }
  };

  // 게임 재시작 함수
  const handleRestartGame = async () => {
    try {
      if (!gameId) {
        console.error('[GameTable] Cannot restart game: gameId is undefined');
        toast.error('게임 ID가 없습니다.');
        return;
      }

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
      if (typeof fetchGameState === 'function') {
        await fetchGameState();
      } else {
        console.warn('[GameTable] fetchGameState is not available, skipping game state refresh');
      }
    } catch (error) {
      console.error('게임 재시작 오류:', error);
      toast.error('게임을 재시작할 수 없습니다.');
    }
  };

  // 베팅 액션 핸들러 (콜, 체크, 레이즈, 폴드 등)
  const handleAction = (action: string, amount?: number) => {
    if (typeof onAction === 'function') {
      onAction(action, amount);
    } else {
      console.warn(`[GameTable] onAction function is not available for ${action}`);
    }
  };

  const handleJoinGame = async (seatIndex: number, playerName: string) => {
    try {
      if (!gameId) {
        console.error('[GameTable] Cannot join game: gameId is undefined');
        toast.error('게임 ID가 없습니다.');
        return null;
      }
      
      console.log(`[GameTable] Joining game ${gameId} with name ${playerName} at seat ${seatIndex}`);
      return await joinGame(gameId, playerName, seatIndex);
    } catch (error) {
      console.error('[GameTable] Error joining game:', error);
      toast.error('게임 참가 중 오류가 발생했습니다.');
      return null;
    }
  };

  // 닉네임 입력 후 참가하기
  const handleJoinWithNickname = async () => {
    if (!selectedSeat && selectedSeat !== 0) {
      console.error('[GameTable] No seat selected for join');
      return;
    }
    
    if (!nickname.trim()) {
      toast.error('닉네임을 입력해주세요.');
      return;
    }

    try {
      if (!currentPlayerId) {
        // 게임 참가 함수 호출
        const result = await handleJoinGame(selectedSeat, nickname);
        
        if (result?.playerId) {
          console.log(`[GameTable] Successfully joined game with player ID: ${result.playerId}`);
          
          // onPlayerJoined callback (if available)
          if (typeof onPlayerJoined === 'function') {
            onPlayerJoined(result.playerId, nickname);
          } else {
            console.warn('[GameTable] onPlayerJoined is not available, skipping callback');
          }
          
          // Refresh game state
          if (typeof fetchGameState === 'function') {
            await fetchGameState();
          } else {
            console.warn('[GameTable] fetchGameState is not available, skipping refresh');
          }
          
          toast.success('게임에 참가했습니다!');
        }
      } else {
        console.error('[GameTable] Already has a currentPlayerId, cannot join again');
      }
    } catch (error) {
      console.error('[GameTable] Join error:', error);
      toast.error('게임에 참가할 수 없습니다.');
    }
    
    // 닉네임 입력 모달 닫기
    setShowNicknameModal(false);
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* 메인 게임 테이블 */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* 배경 및 테이블 */}
        <div className="absolute inset-0 bg-gray-900 z-0">
          <Image
            src="/images/table/bgM.png"
            alt="Game Background"
            fill
            className="object-cover opacity-60"
            priority
          />
        </div>
        
        {/* 게임 테이블 - 반응형으로 크기 조정 */}
        <div className="relative flex-1 flex items-center justify-center z-10 px-4 py-6">
          <div className="relative w-full max-w-[800px] h-full max-h-[800px] mx-auto">
            {/* 테이블 이미지 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[95%] h-[95%] max-w-[700px] max-h-[700px] rounded-full overflow-hidden sm:w-[90%] sm:h-[90%] md:w-[85%] md:h-[85%]">
                {/* 테이블 이미지 - 변경된 코드 */}
                <div className="absolute inset-0 rounded-full border-8 border-yellow-700 bg-green-800 flex items-center justify-center shadow-2xl">
                  <div className="absolute w-[95%] h-[95%] rounded-full border-4 border-yellow-600 bg-green-700 flex items-center justify-center">
                  </div>
                </div>
              </div>
            </div>
            
            {/* 중앙 카드 및 배팅 영역 */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
              <div className="px-3 py-2 bg-gray-900 bg-opacity-80 rounded-lg border border-yellow-600 shadow-lg text-sm sm:text-base md:px-4 md:py-2">
                <p className="text-yellow-400 font-bold text-center">
                  {gameState.game_mode === 3 ? '3장 게임' : '2장 게임'} | 총 배팅 금액: {gameState?.bettingValue?.toLocaleString() ?? 0} 포인트
                </p>
              </div>
              {gameState.status === 'waiting' && !isObserver && isHost && (
                <div className="mt-4">
                  {onStartGame && (
                    <button
                      onClick={onStartGame}
                      disabled={isStartingGame || !canStartGame.canStart}
                      className={`px-4 py-2 rounded font-medium ${isStartingGame || !canStartGame.canStart ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                      title={canStartGame.canStart ? '게임 시작' : canStartGame.message}
                    >
                      {isStartingGame ? '시작 중...' : '게임 시작'}
                    </button>
                  )}
                </div>
              )}
              {gameState.status === 'waiting' && !isObserver && !isHost && onToggleReady && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      // 준비 버튼 클릭 시 기본 배팅 금액 확인
                      const player = gameState?.players.find(p => p.id === currentPlayerId);
                      if (!isReady && player && player.balance < (gameState?.baseBet ?? 0)) {
                        toast.error(`기본 배팅 금액이 부족합니다. 기본 배팅 금액: ${(gameState?.baseBet ?? 0).toLocaleString()}원`);
                        return;
                      }
                      if (onToggleReady) {
                        onToggleReady();
                      }
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
                </div>
              )}
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
                      if (!gameId) {
                        console.error('[GameTable] Cannot place bet: gameId is undefined');
                        return;
                      }
                      if (!currentPlayerId) {
                        console.error('[GameTable] Cannot place bet: currentPlayerId is undefined');
                        return;
                      }
                      
                      // 자동으로 다이 처리
                      await import('@/lib/gameApi').then(async ({ placeBet }) => {
                        try {
                          await placeBet(gameId, currentPlayerId, 'die');
                          console.log('시간 초과로 인한 자동 다이 처리 완료');
                          toast.success('시간 초과로 자동 다이 처리되었습니다.');
                        } catch (betError: any) {
                          console.error('다이 처리 오류:', betError);
                          toast.error('다이 처리 중 오류가 발생했습니다.');
                        }
                      });
                    }
                  } catch (error) {
                    console.error('베팅 시간 초과 처리 중 오류:', error);
                  }
                }}
              />
            )}
            
            {/* 게임 상태 메시지 (대기 중일 때) */}
            {gameState.status === 'waiting' && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30">
                <div className="px-4 py-3 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg max-w-sm w-full">
                  <h2 className="text-xl font-bold text-yellow-400 mb-2">게임 대기 중</h2>
                  <p className="text-white text-sm mb-3">
                    현재 {gameState.players.length}명의 플레이어가 참가했습니다. 게임을 시작하려면 2명 이상의 플레이어가 필요합니다.
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
            
            {/* 관찰자 모드 메시지 */}
            {isObserver && (
              <div className="absolute top-4 left-4 px-4 py-2 bg-gray-800 bg-opacity-90 rounded-md border border-yellow-500 text-yellow-300 text-sm z-30 shadow-lg">
                <span className="font-semibold">관찰자 모드</span> - 게임을 관찰하는 중입니다. 참가하시려면 빈 자리를 클릭하세요.
              </div>
            )}
            
            {/* 게임 상태 표시 */}
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
                      value={nickname} 
                      onChange={(e) => setNickname(e.target.value)} 
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
                      disabled={isJoining || !nickname.trim()}
                      className={`px-4 py-2 rounded font-medium ${
                        isJoining || !nickname.trim()
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
      </div>
    </div>
  );
}

// 빈 자리 위치 스타일 계산 함수
function getEmptySlotStyles(position: number): string {
  // ube48 uc790ub9ac ud074ub9ad ud578ub4e4ub7ec
  switch (position % 5) {
    case 0: // ud558ub2e8 uc911uc559
      return 'bottom-[8%] left-1/2 -translate-x-1/2';
    case 1: // uc624ub978ucabd ud558ub2e8
      return 'bottom-[25%] right-[15%]';
    case 2: // uc624ub978ucabd uc0c1ub2e8
      return 'top-[25%] right-[15%]';
    case 3: // uc0c1ub2e8 uc911uc559
      return 'top-[8%] left-1/2 -translate-x-1/2';
    case 4: // uc67cucabd uc0c1ub2e8
      return 'top-[25%] left-[15%]';
    default:
      return 'bottom-[8%] left-1/2 -translate-x-1/2';
  }
}