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
import { startGame } from '@/lib/gameApi';

interface GameTableProps {
  gameState: GameState;
  currentPlayerId: string;
  gameId: string;
  fetchGameState: () => void;
}

export function GameTable({ gameState, currentPlayerId, gameId, fetchGameState }: GameTableProps) {
  const [showCards, setShowCards] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [joinSlot, setJoinSlot] = useState<number | null>(null);
  
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
  
  if (!gameState || !currentPlayer) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-yellow-400 border-yellow-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-400 font-bold">게임 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  // 게임에 참여한 플레이어 수
  const playerCount = gameState.players.length;
  const maxPlayers = 8; // 최대 8명까지 참가 가능
  
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
        value: getCardFileName(card)
      }));
    } else {
      return playerCards.map(() => ({
        status: 'showing' as const
      }));
    }
  };
  
  // 플레이어들의 화면 위치 매핑
  // 현재 플레이어는 항상 하단 중앙(0번 위치)이 되도록 계산
  const positionedPlayers = gameState.players.map((player, index) => {
    // 현재 플레이어의 인덱스 찾기
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === currentPlayerId);
    
    // 현재 플레이어를 기준으로 상대적 위치 계산
    let position = (index - currentPlayerIndex) % playerCount;
    if (position < 0) position += playerCount;
    
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
  const emptySlots = gameState.status === 'waiting' ? Array.from({ length: maxPlayers - playerCount }, (_, i) => {
    // 현재 플레이어 위치에서의 다음 빈 자리 계산
    const position = (playerCount + i) % maxPlayers;
    return position;
  }) : [];

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

  return (
    <div className="h-full min-h-screen w-full bg-gradient-to-b from-green-800 to-green-950 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        {/* 메인 게임 영역 */}
        <div className="relative flex-1 overflow-hidden rounded-2xl bg-green-900 p-6 shadow-xl mb-4">
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
                  onClick={() => setJoinSlot(position)}
                  className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 bg-opacity-60 hover:bg-opacity-80 border-2 border-dashed border-yellow-400 transition-all transform hover:scale-110"
                >
                  <span className="text-yellow-400 font-bold text-xs">빈 자리</span>
                </button>
              </div>
            ))}
            
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
        
        {/* 게임 컨트롤 및 채팅 영역 - 테이블 외부로 이동 */}
        <div className="flex space-x-4">
          <div className="w-3/4">
            {gameState?.status !== 'finished' && (
              <GameControls
                gameState={gameState}
                currentPlayerId={currentPlayerId}
                onAction={fetchGameState}
              />
            )}
          </div>
          <div className="w-1/4 h-40">
            <Chat
              gameId={gameId}
              playerId={currentPlayerId}
              username={currentPlayer.username}
              messages={gameState.messages || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 빈 자리 위치 스타일 계산 함수
function getEmptySlotStyles(position: number): string {
  // 8개 위치에 맞게 스타일 설정 (원형 테이블 기준)
  switch (position % 8) {
    case 0: // 하단 중앙
      return 'bottom-6 left-1/2 -translate-x-1/2';
    case 1: // 하단 우측
      return 'bottom-1/4 right-1/4 -translate-x-1/2 -translate-y-1/2';
    case 2: // 우측 중앙
      return 'right-6 top-1/2 -translate-y-1/2';
    case 3: // 상단 우측
      return 'top-1/4 right-1/4 -translate-x-1/2 -translate-y-1/2';
    case 4: // 상단 중앙
      return 'top-6 left-1/2 -translate-x-1/2';
    case 5: // 상단 좌측
      return 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2';
    case 6: // 좌측 중앙
      return 'left-6 top-1/2 -translate-y-1/2';
    case 7: // 하단 좌측
      return 'bottom-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2';
    default:
      return '';
  }
}

// 카드 파일명 변환 함수
function getCardFileName(cardId: number): string {
  // 카드 타입 (0-9)과 카드 색상 (0-1)으로 분리
  const cardType = cardId % 10;
  const cardColor = Math.floor(cardId / 10);
  
  // 카드 파일명 형식: '색상타입.png'
  // 색상: 0=검정, 1=빨강
  // 타입: 0-9까지의 숫자
  return `/images/cards/${cardColor}${cardType}.png`;
} 