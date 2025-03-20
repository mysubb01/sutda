'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GameState } from '@/types/game';
import { TablePlayer } from './TablePlayer';
import { cn } from '@/lib/utils';

interface GameTableProps {
  gameState: GameState;
  currentPlayerId: string;
}

export function GameTable({ gameState, currentPlayerId }: GameTableProps) {
  const [showCards, setShowCards] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
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

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 테이블 배경 */}
      <div 
        className="absolute inset-0 rounded-full bg-gradient-to-b from-green-800 to-green-900 m-8"
        style={{
          boxShadow: '0 0 30px rgba(0, 0, 0, 0.7), inset 0 0 80px rgba(0, 0, 0, 0.3)',
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
      
      {/* 게임 상태 표시 */}
      {gameState.status === 'waiting' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 대기 중</h2>
            <p className="text-white">현재 {playerCount}명의 플레이어가 참가했습니다.</p>
            <p className="text-white mt-1">게임을 시작하려면 최소 2명의 플레이어가 필요합니다.</p>
          </div>
        </div>
      )}
      
      {gameState.status === 'finished' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="px-6 py-4 bg-black bg-opacity-70 rounded-lg border border-yellow-600 shadow-lg">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">게임 종료!</h2>
            <p className="text-white">
              승자: {gameState.players.find(p => p.id === gameState.winner)?.username || '없음'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// 카드 이미지 파일 이름 변환 함수
function getCardFileName(cardId: number): string {
  // 마지막 숫자가 1~10이 되도록 변환
  const month = Math.ceil(cardId / 4) || 10;
  // 종류(광, 피, 똥, 쌍피) 계산: 1~4
  const type = ((cardId - 1) % 4) + 1;
  
  return `${month}_${type}`;
} 