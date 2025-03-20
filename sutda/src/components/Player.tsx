'use client';

import { CardPair } from './Card';
import { Player as PlayerType } from '@/types/game';

interface PlayerProps {
  player: PlayerType;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  showCards: boolean;
}

export function Player({ player, isCurrentPlayer, isCurrentTurn, showCards }: PlayerProps) {
  const { username, cards, isDie, balance } = player;
  
  // 카드가 없는 경우 (게임 시작 전)
  if (!cards || cards.length === 0) {
    return (
      <div className={`rounded-lg p-4 ${isCurrentPlayer ? 'bg-blue-800' : 'bg-gray-700'} ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold mb-2">{username}</div>
          <div className="text-sm text-gray-300">대기 중...</div>
          <div className="mt-2 text-yellow-400">{balance} 포인트</div>
        </div>
      </div>
    );
  }
  
  // 다이 상태
  if (isDie) {
    return (
      <div className={`rounded-lg p-4 bg-gray-800 opacity-60 ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold mb-2">{username}</div>
          <div className="text-red-500 font-bold mb-2">다이</div>
          <CardPair cards={cards} isHidden={true} />
          <div className="mt-2 text-yellow-400">{balance} 포인트</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`rounded-lg p-4 ${isCurrentPlayer ? 'bg-blue-800' : 'bg-gray-700'} ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className="flex flex-col items-center">
        <div className="text-lg font-bold mb-2">{username}</div>
        <CardPair cards={cards} isHidden={!isCurrentPlayer && !showCards} />
        <div className="mt-2 text-yellow-400">{balance} 포인트</div>
      </div>
    </div>
  );
} 