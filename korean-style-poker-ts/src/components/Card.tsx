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
      <div className="w-20 h-32 rounded-md bg-red-800 border-2 border-yellow-500 flex items-center justify-center shadow-lg overflow-hidden relative">
        {/* 이미지가 있으면 이미지 사용, 없으면 대체 UI */}
        <div className="w-full h-full relative">
          <Image
            src={cardBackImagePath}
            alt="카드 뒷면"
            width={80}
            height={128}
            layout="responsive"
            className="object-cover"
            onError={(e) => {
              // 이미지 로드 오류시 대체 UI 표시
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-yellow-500 font-bold text-xl">
            ?
          </div>
        </div>
      </div>
    );
  }
  
  // 카드 앞면 표시
  return (
    <div className="w-20 h-32 rounded-md bg-white border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg overflow-hidden relative">
      {/* 이미지가 있으면 이미지 사용, 없으면 대체 UI */}
      <div className="w-full h-full relative">
        <Image
          src={getCardImagePath(card)}
          alt={`${month}월 ${kwang ? '광' : '일반'}`}
          width={80}
          height={128}
          layout="responsive"
          className="object-cover"
          onError={(e) => {
            // 이미지 로드 오류시 대체 UI 표시
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80">
          <div className="text-3xl font-bold text-red-800">
            {month}
          </div>
          <div className="mt-2 text-xs text-gray-800">
            {kwang ? '광' : '월'}
          </div>
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
    <div className="flex space-x-2">
      {cards.map((card, idx) => (
        <Card key={idx} card={card} isHidden={isHidden} />
      ))}
    </div>
  );
} 