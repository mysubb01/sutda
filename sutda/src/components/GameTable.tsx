'use client';

import React from 'react';
import Image from 'next/image';
import { Player } from './TablePlayer';
import { CardPair } from './Card';

interface PlayerData {
  id: string;
  username: string;
  cards?: number[];
  balance: number;
  isDie?: boolean;
}

interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerData[];
  currentTurn: string | null;
  bettingValue: number;
  winner?: string | null;
  communityCards?: number[];
}

interface GameTableProps {
  gameState: GameState;
  currentUserId: string;
  onJoin: () => void;
}

export function GameTable({ gameState, currentUserId, onJoin }: GameTableProps) {
  const maxPlayers = 5;
  const positions = [
    "top-0 left-1/2 -translate-x-1/2", // 상단 중앙
    "top-1/3 right-0", // 오른쪽
    "bottom-0 right-1/4", // 오른쪽 하단
    "bottom-0 left-1/4", // 왼쪽 하단
    "top-1/3 left-0", // 왼쪽
  ];
  
  // 현재 플레이어가 게임에 참여 중인지 확인
  const isPlayerJoined = gameState.players.some(p => p.id === currentUserId);
  
  // 플레이어 위치 배열 생성 (빈 자리 포함)
  const playerSlots: (PlayerData | null)[] = Array(maxPlayers).fill(null);
  
  // 실제 플레이어 배치
  gameState.players.forEach((player, index) => {
    if (index < maxPlayers) {
      playerSlots[index] = player;
    }
  });

  return (
    <div className="relative w-full aspect-[4/3] bg-green-800 rounded-full border-8 border-brown-800 shadow-2xl max-w-4xl mx-auto my-8">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-yellow-400 text-lg font-bold bg-green-900 px-4 py-2 rounded-full border border-yellow-600">
          배팅: {gameState.bettingValue} 포인트
        </div>
      </div>
      
      {/* 중앙 카드 */}
      {gameState.status === 'playing' && gameState.communityCards && gameState.communityCards.length > 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="text-center text-white mb-2">커뮤니티 카드</div>
          <div className="flex justify-center gap-2">
            {gameState.communityCards.map((card, idx) => (
              <div key={idx} className="transform scale-75">
                <Image 
                  src={`/images/cards/${card}.jpg`}
                  alt={`커뮤니티 카드 ${idx+1}`}
                  width={80}
                  height={120}
                  className="rounded-md border-2 border-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 플레이어 자리 */}
      {playerSlots.map((player, idx) => (
        <div 
          key={idx} 
          className={`absolute ${positions[idx]} transform -translate-x-1/2 -translate-y-1/2`}
        >
          {player ? (
            <Player 
              player={player}
              isCurrentPlayer={player.id === currentUserId}
              isCurrentTurn={player.id === gameState.currentTurn}
              showCards={gameState.status === 'finished' && player.id !== currentUserId}
            />
          ) : (
            <div className="w-32 p-3 bg-gray-800 bg-opacity-70 rounded-lg border border-gray-600 text-center">
              {!isPlayerJoined && gameState.status === 'waiting' ? (
                <button 
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                  onClick={onJoin}
                >
                  여기 앉기
                </button>
              ) : (
                <span className="text-gray-400 text-sm">빈 자리</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 