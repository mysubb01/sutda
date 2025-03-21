'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardPair } from './Card';
import { Player, CardStatus } from '@/types/game';
import { evaluateCards } from '@/utils/gameLogic';
import { cn } from '@/lib/utils';

interface TablePlayerProps {
  player: {
    id: string;
    user_id: string;
    username: string;
    balance: number;
    position: number;
    isMe: boolean;
    isCurrentTurn: boolean;
    isDead: boolean;
    cards: { status: CardStatus; value?: string }[];
    selected_cards?: number[];
    open_card?: number;
    is_ready?: boolean;
  };
  isReady?: boolean;
  mode?: 2 | 3; // 게임 모드: 2장 또는 3장 모드
  bettingRound?: number; // 현재 베팅 라운드 (3장 모드에서 필요)
}

export function TablePlayer({ player, isReady, mode = 2, bettingRound = 1 }: TablePlayerProps) {
  const { username, balance, position, isMe, isCurrentTurn, cards, isDead, selected_cards, open_card } = player;
  const [cardValues, setCardValues] = useState<number[]>([]);
  const [combination, setCombination] = useState<{ rank: string; value: number } | null>(null);

  useEffect(() => {
    if (cards && Array.isArray(cards)) {
      const values = [];
      for (const card of cards) {
        if (card.status === 'open' && card.value && !isNaN(parseInt(card.value))) {
          values.push(parseInt(card.value));
        }
      }

      setCardValues(values);

      if (values.length >= 2 && (isMe || isDead)) {
        try {
          const cardsToEvaluate = mode === 3 && selected_cards
            ? selected_cards.slice(0, 2)
            : values.slice(0, 2);

          const result = evaluateCards(cardsToEvaluate);
          setCombination(result);
        } catch (error) {
          console.error('족보 계산 오류:', error);
          setCombination(null);
        }
      }
    }
  }, [cards, isMe, isDead, mode, selected_cards]);

  const posStyle = getPositionStyles(position);

  const cardsVisible = cards.some(card => card.status === 'open');

  const cardNumbers = cards.map(card => card.value ? parseInt(card.value) : 0);

  const openCard = mode === 3 && bettingRound === 1 && cards && cards.length > 0
    ? open_card
    : undefined;

  return (
    <div
      className={`absolute ${posStyle.container} transition-all duration-300 w-36`}
      style={{ zIndex: isCurrentTurn ? 20 : 10 }}
    >
      {cardsVisible && combination && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 px-2 py-1 rounded text-yellow-400 text-sm font-bold z-20 whitespace-nowrap">
          {combination.rank}
        </div>
      )}

      <div className={`flex flex-col items-center`}>
        {isCurrentTurn && (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-yellow-500 rounded-full animate-pulse flex items-center justify-center">
            <span className="text-xs font-bold">턴</span>
          </div>
        )}

        {isReady !== undefined && (
          <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center ${isReady ? 'bg-green-500' : 'bg-gray-500'}`}>
            <span className="text-xs font-bold">{isReady ? 'R' : '?'}</span>
          </div>
        )}

        <div className={`relative rounded-full w-12 h-12 overflow-hidden border-2 ${isCurrentTurn ? 'border-yellow-400 animate-pulse' : 'border-gray-600'} mb-1`}>
          <Image
            src={`/images/ui/Mface${(position % 4) + 1}.png`}
            alt="Player"
            fill
            className={`object-cover ${isDead ? 'grayscale opacity-50' : ''}`}
          />
        </div>

        <div className="text-center mb-1 w-full">
          <p className={`font-bold truncate ${isMe ? 'text-blue-400' : 'text-white'}`}>{username}</p>
          <p className="text-xs text-yellow-300">{balance.toLocaleString()} P</p>
        </div>

        <div className={`flex ${posStyle.cards} transition-all duration-300`}>
          {mode === 2 && (
            cardNumbers.length > 0 ? (
              <div className="flex space-x-1">
                {cardNumbers.map((cardNum, idx) => (
                  <Card
                    key={idx}
                    card={cardNum}
                    isHidden={!cardsVisible && !isMe}
                    width={65}
                    height={95}
                  />
                ))}
              </div>
            ) : (
              <div className="w-[130px] h-[95px] bg-gray-800 bg-opacity-30 rounded-md border border-gray-700" />
            )
          )}

          {mode === 3 && (
            cardNumbers.length > 0 ? (
              <div className="flex space-x-1">
                {cardNumbers.map((cardNum, idx) => {
                  const isOpen = bettingRound === 1 && idx === 0 && openCard === cardNum;
                  return (
                    <Card
                      key={idx}
                      card={cardNum}
                      isHidden={!cardsVisible && !isMe && !isOpen}
                      width={55}
                      height={80}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="w-[165px] h-[80px] bg-gray-800 bg-opacity-30 rounded-md border border-gray-700" />
            )
          )}
        </div>

        {isDead && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-md">
            <div className="bg-red-900 px-3 py-1 rounded-md text-white font-bold">
              DIE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getPositionStyles(position: number): { container: string; cards: string } {
  // 8uac1c uc704uce58uc5d0 ub9deuac8c uc2a4ud0c0uc77c uc124uc815 (uc6d0ud615 ud14cuc774ube14 uae30uc900)
  switch (position % 8) {
    case 0: // ud558ub2e8 uc911uc559
      return {
        container: 'bottom-[5%] left-1/2 -translate-x-1/2',
        cards: 'mt-4'
      };
    case 1: // uc624ub978ucabd ud558ub2e8
      return {
        container: 'bottom-[20%] right-[10%]',
        cards: 'mt-4'
      };
    case 2: // uc624ub978ucabd
      return {
        container: 'right-[5%] top-1/2 -translate-y-1/2',
        cards: 'ml-4'
      };
    case 3: // uc624ub978ucabd uc0c1ub2e8
      return {
        container: 'top-[20%] right-[10%]',
        cards: 'mb-4 flex-row-reverse'
      };
    case 4: // uc0c1ub2e8 uc911uc559
      return {
        container: 'top-[5%] left-1/2 -translate-x-1/2',
        cards: 'mb-4 flex-row-reverse'
      };
    case 5: // uc67cuc058 uc0c1ub2e8
      return {
        container: 'top-[20%] left-[10%]',
        cards: 'mb-4 flex-row-reverse'
      };
    case 6: // uc67cuc058
      return {
        container: 'left-[5%] top-1/2 -translate-y-1/2',
        cards: 'mr-4 flex-row-reverse'
      };
    case 7: // uc67cuc058 ud558ub2e8
      return {
        container: 'bottom-[20%] left-[10%]',
        cards: 'mt-4 flex-row'
      };
    default:
      return {
        container: 'bottom-[5%] left-1/2 -translate-x-1/2',
        cards: 'mt-4'
      };
  }
}