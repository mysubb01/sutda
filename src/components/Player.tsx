'use client';

import { CardPair } from './Card';
import Image from 'next/image';

interface Player {
  id: string;
  username: string;
  cards?: number[];
  balance: number;
  is_die?: boolean;
}

interface PlayerProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  showCards: boolean;
}

export function Player({ player, isCurrentPlayer, isCurrentTurn, showCards }: PlayerProps) {
  const { username, cards, is_die, balance } = player;
  
  // 플레이어 상태에 따른 UI 클래스
  const playerBoxClasses = `
    rounded-lg p-4 relative
    ${isCurrentPlayer ? 'bg-blue-800 bg-opacity-70' : 'bg-gray-700 bg-opacity-70'} 
    ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}
    ${is_die ? 'opacity-60' : ''}
    border border-gray-600
    transition-all duration-300
  `;
  
  // 카드가 없는 경우 (게임 시작 전)
  if (!cards || cards.length === 0) {
    return (
      <div className={playerBoxClasses}>
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold mb-2 text-yellow-400">{username}</div>
          <div className="text-sm text-gray-300">대기 중...</div>
          <div className="mt-2 text-yellow-400">{balance} 포인트</div>
        </div>
        {isCurrentTurn && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full animate-pulse"></div>
        )}
      </div>
    );
  }
  
  // 다이 상태
  if (is_die) {
    return (
      <div className={playerBoxClasses}>
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold mb-2 text-yellow-400">{username}</div>
          <div className="text-red-500 font-bold mb-2 text-lg">다이</div>
          <div className="relative">
            <CardPair cards={cards} isHidden={true} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/images/ui/dieM.png"
                alt="다이"
                width={60}
                height={30}
                className="object-contain"
              />
            </div>
          </div>
          <div className="mt-2 text-yellow-400">{balance} 포인트</div>
        </div>
        {isCurrentTurn && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full animate-pulse"></div>
        )}
      </div>
    );
  }
  
  return (
    <div className={playerBoxClasses}>
      <div className="flex flex-col items-center">
        <div className="text-lg font-bold mb-2 text-yellow-400">{username}</div>
        <CardPair cards={cards} isHidden={!isCurrentPlayer && !showCards} />
        <div className="mt-2 text-yellow-400">{balance} 포인트</div>
        
        {isCurrentPlayer && (
          <div className="mt-1 text-xs text-green-400 font-semibold">
            나
          </div>
        )}
      </div>
      {isCurrentTurn && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
} 