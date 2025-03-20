'use client';

import Image from 'next/image';
import { getCardMonth, isKwang } from '@/utils/gameLogic';
import { getCardImagePath, cardBackImagePath } from '@/utils/cardImages';
import { useEffect } from 'react';

interface CardProps {
  card: number;
  isHidden?: boolean;
}

export function Card({ card, isHidden = false }: CardProps) {
  const month = getCardMonth(card);
  const kwang = isKwang(card);
  
  // 카드가 숨겨진 경우 뒷면 표시
  if (isHidden) {
    return (
      <div className="w-32 h-48 rounded-md overflow-hidden shadow-lg relative group transition-transform hover:scale-105">
        <Image
          src={cardBackImagePath}
          alt="카드 뒷면"
          width={128}
          height={192}
          className="w-full h-full object-cover"
          priority={true}
          onError={(e) => {
            // 이미지 로드 오류시 대체 UI 표시
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('image-error');
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-red-800 text-yellow-500 font-bold text-2xl hidden group-[.image-error]:flex">
          ?
        </div>
      </div>
    );
  }
  
  // 카드 앞면 표시
  return (
    <div className="w-32 h-48 rounded-md overflow-hidden shadow-lg relative group transition-transform hover:scale-105">
      <Image
        src={getCardImagePath(card)}
        alt={`${month}월 ${kwang ? '광' : '일반'}`}
        width={128}
        height={192}
        className="w-full h-full object-cover"
        priority={true}
        onError={(e) => {
          // 이미지 로드 오류시 대체 UI 표시
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.classList.add('image-error');
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 hidden group-[.image-error]:flex">
        <div className="text-4xl font-bold text-red-800">
          {month}
        </div>
        <div className="mt-2 text-sm text-gray-800">
          {kwang ? '광' : '월'}
        </div>
      </div>
    </div>
  );
}

interface CardPairProps {
  cards: number[];
  isHidden?: boolean;
}

export function CardPair({ cards, isHidden = false }: CardPairProps) {
  // 컴포넌트 마운트 시 카드 이미지 프리로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/utils/cardImages').then(module => {
        module.preloadCardImages();
      });
    }
  }, []);
  
  return (
    <div className="flex space-x-3">
      {cards.map((card, idx) => (
        <Card key={idx} card={card} isHidden={isHidden} />
      ))}
    </div>
  );
} 