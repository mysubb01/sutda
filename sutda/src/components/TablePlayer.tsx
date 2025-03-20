'use client';

import { CardPair } from './Card';
import Image from 'next/image';

interface PlayerData {
  id: string;
  username: string;
  cards?: number[];
  balance: number;
  isDie?: boolean;
}

interface PlayerProps {
  player: PlayerData;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  showCards: boolean;
}

export function Player({ player, isCurrentPlayer, isCurrentTurn, showCards }: PlayerProps) {
  const { username, cards, isDie, balance } = player;
  
  const playerClasses = `
    w-36 p-2 rounded-lg relative
    ${isCurrentPlayer ? 'bg-blue-800 bg-opacity-90' : 'bg-gray-800 bg-opacity-80'} 
    ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}
    ${isDie ? 'opacity-70' : ''}
    border border-gray-600
    transition-all duration-300
  `;

  return (
    <div className={playerClasses}>
      <div className="flex flex-col items-center">
        <div className="text-sm font-bold mb-1 text-yellow-400">
          {username}
          {isCurrentPlayer && <span className="ml-1 text-green-400">(나)</span>}
        </div>
        
        {cards && cards.length > 0 ? (
          <div className="scale-75 origin-top">
            <CardPair cards={cards} isHidden={!isCurrentPlayer && !showCards} />
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center">
            <span className="text-xs text-gray-400">대기 중...</span>
          </div>
        )}
        
        <div className="mt-1 text-xs text-yellow-400">{balance} 포인트</div>
        
        {isDie && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <span className="text-red-500 font-bold text-sm">다이</span>
          </div>
        )}
      </div>
      
      {isCurrentTurn && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
} 