'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

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
  const [imgSrc, setImgSrc] = useState<string>('/images/cards/CardBack.png');
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    // 카드가 보이는 상태일 때만 이미지 경로 설정
    if (!isHidden && card !== undefined && card !== null) {
      // 카드 번호 유효성 검사 (1-20 범위)
      if (!isNaN(card) && card >= 1 && card <= 20) {
        setImgSrc(`/images/cards/${card}.jpg`);
        setHasError(false);
      } else {
        console.warn(`유효하지 않은 카드 번호: ${card}`);
        setHasError(true);
      }
    } else {
      // 숨겨진 카드는 뒷면 이미지 사용
      setImgSrc('/images/cards/CardBack.png');
      setHasError(false);
    }
  }, [card, isHidden]);

  // 이미지 로드 에러 처리
  const handleImageError = () => {
    console.error(`카드 이미지 로드 실패: ${imgSrc}`);
    setImgSrc('/images/cards/CardBack.png');
    setHasError(true);
  };

  // 유효하지 않은 카드인 경우 빈 카드 표시
  if (hasError) {
    return (
      <div
        className="relative bg-gray-800 rounded-sm opacity-70 flex items-center justify-center"
        style={{ width, height }}
      >
        <span className="text-white text-xs">카드 에러</span>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ width, height }}
    >
      <Image
        src={imgSrc}
        alt="Card"
        fill
        className="object-cover rounded-sm shadow-md"
        onError={handleImageError}
        priority={true}
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
  width = 80,
  height = 110
}: CardPairProps) {
  // 카드가 없는 경우 빈 자리 표시
  if (!cards || cards.length === 0) {
    return (
      <div className="flex space-x-1">
        <div className="w-[80px] h-[110px] bg-gray-800 rounded-sm opacity-30"></div>
        <div className="w-[80px] h-[110px] bg-gray-800 rounded-sm opacity-30"></div>
      </div>
    );
  }

  return (
    <div className="flex space-x-1">
      <Card card={cards[0]} isHidden={isHidden} width={width} height={height} />
      {cards.length > 1 ? (
        <Card card={cards[1]} isHidden={isHidden} width={width} height={height} />
      ) : (
        <div className="w-[80px] h-[110px] bg-gray-800 rounded-sm opacity-30"></div>
      )}
    </div>
  );
}
