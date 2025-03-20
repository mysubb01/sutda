'use client';

import Image from 'next/image';
import { getCardMonth, isKwang } from '@/utils/gameLogic';
import { getCardImagePath, cardBackImagePath } from '@/utils/cardImages';
import { useEffect, useState } from 'react';

interface CardProps {
  card: number;
  isHidden?: boolean;
  width?: number;
  height?: number;
}

export function Card({ card, isHidden = false, width = 120, height = 192 }: CardProps) {
  const [imageError, setImageError] = useState(false);
  
  // 카드 뒷면 이미지
  if (isHidden) {
    return (
      <div className="relative w-full h-full" style={{ aspectRatio: '5/8' }}>
        <Image
          src="/images/cards/back.png"
          alt="카드 뒷면"
          width={width}
          height={height}
          className="object-contain w-full h-full rounded-md shadow-md"
          priority
        />
      </div>
    );
  }
  
  // 카드 정보 계산
  const month = getCardMonth(card);
  const isLight = isKwang(card);
  
  // 카드 이미지 경로
  let cardImagePath = `/images/cards/${month}_${isLight ? 'kwang' : 'yeol'}.png`;
  
  // 폴백 이미지 경로 (이미지 로드 실패 시)
  const fallbackImagePath = '/images/cards/unknown.png';
  
  return (
    <div className="relative w-full h-full" style={{ aspectRatio: '5/8' }}>
      <Image
        src={imageError ? fallbackImagePath : cardImagePath}
        alt={`${month}월 ${isLight ? '광' : '열끗'}`}
        width={width}
        height={height}
        className="object-contain w-full h-full rounded-md shadow-md"
        priority
        onError={() => setImageError(true)}
      />
      <div className="absolute top-1 left-1 text-xs font-bold bg-white/70 dark:bg-black/70 px-1 rounded">
        {month}월{isLight ? ' 광' : ''}
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
        <div key={idx} className="w-16 h-24 sm:w-20 sm:h-32">
          <Card card={card} isHidden={isHidden} />
        </div>
      ))}
    </div>
  );
} 