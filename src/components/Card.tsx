'use client';

import Image from 'next/image';

interface CardProps {
  card: number;
  isHidden?: boolean;
  width?: number;
  height?: number;
}

export function Card({
  card,
  isHidden = false,
  width = 80,
  height = 112
}: CardProps) {
  const backImg = '/images/cards/CardBack.png';
  const frontImg = `/images/cards/${card}.jpg`;

  return (
    <div
      className="relative"
      style={{ width, height }}
    >
      <Image
        src={isHidden ? backImg : frontImg}
        alt="Card"
        fill
        className="object-cover rounded-sm shadow-md"
      />
    </div>
  );
}

interface CardPairProps {
  cards?: number[];
  isHidden?: boolean;
  width?: number;
  height?: number;
}

export function CardPair({
  cards = [],
  isHidden = false,
  width = 60,
  height = 84
}: CardPairProps) {
  // 카드가 없는 경우 빈 자리 표시
  if (!cards || cards.length === 0) {
    return (
      <div className="flex space-x-1">
        <div className="w-[60px] h-[84px] bg-gray-800 rounded-sm opacity-30"></div>
        <div className="w-[60px] h-[84px] bg-gray-800 rounded-sm opacity-30"></div>
      </div>
    );
  }

  return (
    <div className="flex space-x-1">
      <Card card={cards[0]} isHidden={isHidden} width={width} height={height} />
      {cards.length > 1 ? (
        <Card card={cards[1]} isHidden={isHidden} width={width} height={height} />
      ) : (
        <div className="w-[60px] h-[84px] bg-gray-800 rounded-sm opacity-30"></div>
      )}
    </div>
  );
}
