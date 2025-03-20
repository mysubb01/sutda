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
  const backImg = '/images/cards/back.png';
  const frontImg = `/images/cards/${card}.png`;

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
