'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GameState, Player } from '@/types/game';
import { TablePlayer } from './TablePlayer';
import { cn } from '@/lib/utils';
import { GameControls } from './GameControls';
import { Chat } from './Chat';
import { GameResult } from './GameResult';
import { toast } from 'react-hot-toast';
import { startGame, updateSeat, joinGame, toggleReady } from '@/lib/gameApi';

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
  const maxPlayers = 5; // 최대 5명까지 참가 가능
  
  // 카드 변환 함수 - 카드 ID를 카드 정보로 변환
  const mapCards = (playerCards?: number[], isVisible = false) => {
    if (!playerCards || playerCards.length === 0) {
      return [
        { status: 'hidden' as const },
        { status: 'hidden' as const }
      ];
    }
    
    if (isVisible) {
      return playerCards.map(card => ({
        status: 'open' as const,
        value: String(card) // 카드 ID를 문자열로 변환하여 사용
      }));
    } else {
      return playerCards.map(() => ({
        status: 'showing' as const
      }));
    }
  };
  
  // 플레이어들의 화면 위치 매핑
  // seat_index가 있는 경우 해당 위치에 표시하고, 없으면 현재 플레이어를 기준으로 상대적 위치 계산
  const positionedPlayers = gameState.players.map((player) => {
    // 좌석 인덱스가 있으면 해당 위치에 표시
    let position = 0;
    
    if (player.seat_index !== undefined && player.seat_index >= 0 && player.seat_index < 5) {
      // 좌석 인덱스를 직접 사용 (0-4)
      position = player.seat_index;
    } else {
      // 좌석 인덱스가 없는 경우, 현재 플레이어를 기준으로 상대적 위치 계산
      const currentPlayerIndex = gameState.players.findIndex(p => p.id === currentPlayerId);
      position = (gameState.players.indexOf(player) - currentPlayerIndex) % playerCount;
      if (position < 0) position += playerCount;
    }
    
    // 현재 플레이어인지 확인
    const isMe = player.id === currentPlayerId;
    
    // 현재 턴인 플레이어인지 확인
    const isCurrentTurn = player.id === gameState.currentTurn;
    
    // 카드가 보이는지 여부 결정
    // 자신의 카드는 항상 보이고, 게임이 끝났거나 showCards가 true면 모든 카드 표시
    const isCardVisible = isMe || showCards || gameState.status === 'finished';
    
    return {
      ...player,
      position,
      isMe,
      isCurrentTurn,
      isDead: player.isDie === true,
      cards: mapCards(player.cards, isCardVisible)
    };
  });

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
    
    // 닉네임 입력 모달 표시
    setSelectedSeat(seatIndex);
    setShowNicknameModal(true);
  };

  // 닉네임 입력 후 참가하기
  const handleJoinWithNickname = async () => {
    if (!selectedSeat && selectedSeat !== 0) return;
    if (!username.trim()) {
      toast.error('닉네임을 입력해주세요.');
      return;
    }
    
    try {
      setIsJoining(true);
      console.log(`참가 시도: 좌석 ${selectedSeat}, 닉네임 ${username}`);
      const { playerId } = await joinGame(gameId, username, selectedSeat);
      
      // 플레이어 ID 저장
      localStorage.setItem(`game_${gameId}_player_id`, playerId);
      localStorage.setItem(`game_${gameId}_username`, username);
      
      // 부모 컴포넌트에 참가 알림
      if (onPlayerJoined) {
        onPlayerJoined(playerId, username);
      }
      
      toast.success('게임에 참가했습니다!');
      setShowNicknameModal(false);
      fetchGameState(); // 게임 상태 새로고침
    } catch (error) {
      console.error('참가 오류:', error);
      toast.error('게임에 참가할 수 없습니다.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="h-full min-h-screen w-full bg-gradient-to-b from-green-800 to-green-950 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col lg:flex-row">
        {/* 메인 게임 영역 */}
        <div className="relative mb-4 flex-1 overflow-hidden rounded-2xl bg-green-900 p-6 shadow-xl lg:mb-0 lg:mr-4">
          <div className="relative h-full w-full overflow-hidden">
            {/* 테이블 배경 */}
            <div 
              className="absolute inset-0 rounded-full bg-gradient-to-b from-green-800 to-green-900 m-8"
              style={{
                boxShadow: '0 0 30px rgba(0, 0, 0, 0.7), inset 0 0 80px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.3)',
                border: '10px solid #8B4513'
              }}
            >
              {/* 테이블 패턴 */}
              <div className="absolute inset-2 rounded-full bg-green-700 bg-opacity-50 flex items-center justify-center">
                <div className="w-[80%] h-[80%] rounded-full border-2 border-dashed border-green-500 border-opacity-50"></div>
                <Image
                  src="/images/table/bgM.png"
                  alt="Table Background"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-full opacity-80"
                />
              </div>
              
              {/* 중앙 카드 및 배팅 영역 */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="relative mb-3">
                  <div className="px-4 py-2 bg-gray-900 bg-opacity-80 rounded-lg border border-yellow-600 shadow-lg">
                    <p className="text-yellow-400 font-bold text-center">
                      총 배팅 금액: {gameState.bettingValue.toLocaleString()} 포인트
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 플레이어 위치 */}
            {positionedPlayers.map(player => (
              <TablePlayer
                key={player.id}
                position={player.position!}
                username={player.username}
                balance={player.balance}
                isCurrentTurn={player.isCurrentTurn}
                isDead={player.isDead}
                isMe={player.isMe}
                faceImage={`/images/ui/face${(parseInt(player.id) % 5) + 1}.png`}
                cards={player.cards}
              />
            ))}
            
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
            
            {/* 관찰자 모드 표시 */}
            {isObserver && (
              <div className="fixed top-4 left-4 px-4 py-2 bg-gray-800 bg-opacity-90 rounded-md border border-yellow-500 text-yellow-300 text-sm z-30 shadow-lg">
                <span className="font-semibold">관찰자 모드</span> - 빈 자리를 클릭하여 참가하세요
              </div>
            )}
            
            {/* 게임 상태 표시 */}
            {gameState.status === 'waiting' && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30">
                <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
                  <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 대기 중</h2>
                  <p className="text-white">현재 {playerCount}명의 플레이어가 참가했습니다.</p>
                  <p className="text-white mt-1">게임을 시작하려면 최소 2명의 플레이어가 필요합니다.</p>
                </div>
              </div>
            )}
            
            {gameState.status === 'finished' && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30">
                <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
                  <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 종료!</h2>
                  <p className="text-white">
                    승자: {gameState.players.find(p => p.id === gameState.winner)?.username || '없음'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* 게임 결과 모달 - 게임이 끝나고 승자가 있을 때만 표시 */}
          {gameState?.status === 'finished' && gameState.winner && (
            <GameResult 
              winner={gameState.players.find(p => p.id === gameState.winner) as Player} 
              players={gameState.players} 
              restartGame={handleRestartGame}
            />
          )}
        </div>
        
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
                  <button 
                    onClick={onToggleReady}
                    disabled={!onToggleReady}
                    className={`px-3 py-1 rounded text-sm font-bold transition-colors ${isReady 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {isReady ? '준비 취소' : '준비 완료'}
                  </button>
                )}
                
                {/* 방장인 경우 게임 시작 버튼 표시 */}
                {isHost && onStartGame && (
                  <button 
                    onClick={onStartGame}
                    disabled={!canStartGame.canStart || isStartingGame}
                    className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
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
            <div className="bg-gray-800 px-3 py-1 rounded text-sm">
              <span className="text-gray-400">잔액: </span>
              <span className="text-yellow-300 font-bold">
                {currentPlayer?.balance?.toLocaleString() || 0}원
              </span>
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
        
        {/* ... existing code ... */}
      </div>
    </div>
  );
}

// 빈 자리 위치 스타일 계산 함수
function getEmptySlotStyles(position: number): string {
  // 5개 위치에 맞게 스타일 설정 (원형 테이블 기준)
  switch (position % 5) {
    case 0: // 하단 중앙
      return 'bottom-6 left-1/2 -translate-x-1/2';
    case 1: // 하단 우측
      return 'bottom-16 right-20 lg:right-28';
    case 2: // 우측
      return 'right-6 top-1/2 -translate-y-1/2';
    case 3: // 상단 우측
      return 'top-16 right-20 lg:right-28';
    case 4: // 상단 중앙
      return 'top-6 left-1/2 -translate-x-1/2';
    default:
      return 'bottom-6 left-1/2 -translate-x-1/2';
  }
} 