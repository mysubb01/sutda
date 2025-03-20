'use client';

import Image from 'next/image';
import { CardStatus } from '@/types/game';
import { cn } from '@/lib/utils';

interface TablePlayerProps {
  position: number; // 0부터 시작하는 플레이어 위치
  username: string;
  balance: number;
  isCurrentTurn: boolean;
  isDead: boolean;
  isMe: boolean;
  faceImage?: string; // 플레이어 캐릭터 이미지 경로
  cards?: {
    status: CardStatus; // 'hidden' | 'showing' | 'open'
    value?: string;
  }[];
}

export function TablePlayer({
  position,
  username,
  balance,
  isCurrentTurn,
  isDead,
  isMe,
  faceImage = '/images/ui/face1.png', // 기본 이미지 설정
  cards = []
}: TablePlayerProps) {
  // 플레이어 위치에 따른 스타일 계산
  const positionStyles = getPositionStyles(position);
  
  // 카드 상태에 따른 이미지 URL 결정
  const getCardImageUrl = (status: CardStatus, value?: string) => {
    try {
      if (status === 'hidden') {
        return '/images/cards/cardback.png'; // 숨김 상태용 이미지
      } else if (status === 'showing') {
        return '/images/cards/cardback.png'; // 뒷면 카드 이미지
      } else if (status === 'open' && value) {
        // 실제 존재하는 카드 이미지 반환
        return `/images/cards/${value}.jpg`;
      } else {
        // 기본 카드 이미지 (오류 방지)
        return '/images/cards/cardback.png';
      }
    } catch (error) {
      console.error('카드 이미지 URL 생성 오류:', error);
      return '/images/cards/cardback.png'; // 오류 시 기본 카드 이미지
    }
  };

  // 카드 이미지 로드 오류시 대체 이미지 처리
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/images/cards/cardback.png';
    console.log('카드 이미지 로드 실패, 대체 이미지 사용');
  };

  return (
    <div
      className={cn(
        'absolute flex flex-col items-center',
        positionStyles.container,
        isCurrentTurn && 'animate-pulse'
      )}
    >
      {/* 플레이어 상태 표시 */}
      <div className="relative mb-1">
        {/* 플레이어 정보 */}
        <div className={cn(
          'rounded-lg px-3 py-2 text-center',
          isMe ? 'bg-blue-600 bg-opacity-90' : 'bg-gray-800 bg-opacity-90',
          isDead && 'opacity-50',
          isCurrentTurn ? 'ring-2 ring-green-400' : '',
          'border-2',
          isMe ? 'border-blue-500' : 'border-yellow-500',
        )}>
          <p className={cn(
            'font-bold text-base',
            isMe ? 'text-white' : 'text-yellow-300'
          )}>
            {username}
          </p>
          <p className="text-base font-medium text-yellow-400">
            {balance.toLocaleString()}P
          </p>
          
          {isDead && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <p className="text-red-500 font-bold text-base">다이</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 카드 영역 */}
      <div className={cn(
        'flex space-x-2',
        positionStyles.cards
      )}>
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={cn(
              'relative w-16 h-22 transition-all',
              card.status === 'hidden' && 'opacity-50 scale-95'
            )}
          >
            <Image
              src={getCardImageUrl(card.status, card.value)}
              alt={card.status}
              width={64}
              height={90}
              className="rounded-md shadow-lg"
              onError={handleImageError}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// 플레이어 위치에 따른 스타일 계산 함수
function getPositionStyles(position: number): { container: string; cards: string } {
  // 8개 위치에 맞게 스타일 설정 (원형 테이블 기준)
  switch (position % 8) {
    case 0: // 하단 중앙
      return {
        container: 'bottom-4 left-1/2 -translate-x-1/2',
        cards: 'mt-2'
      };
    case 1: // 하단 우측
      return {
        container: 'bottom-12 right-16 lg:right-24',
        cards: 'mt-2'
      };
    case 2: // 우측
      return {
        container: 'right-4 top-1/2 -translate-y-1/2',
        cards: 'ml-2 flex-col space-y-1 space-x-0'
      };
    case 3: // 상단 우측
      return {
        container: 'top-12 right-16 lg:right-24',
        cards: 'mb-2 flex-row-reverse'
      };
    case 4: // 상단 중앙
      return {
        container: 'top-4 left-1/2 -translate-x-1/2',
        cards: 'mb-2 flex-row-reverse'
      };
    case 5: // 상단 좌측
      return {
        container: 'top-12 left-16 lg:left-24',
        cards: 'mb-2 flex-row-reverse'
      };
    case 6: // 좌측
      return {
        container: 'left-4 top-1/2 -translate-y-1/2',
        cards: 'mr-2 flex-col space-y-1 space-x-0'
      };
    case 7: // 하단 좌측
      return {
        container: 'bottom-12 left-16 lg:left-24',
        cards: 'mt-2'
      };
    default:
      return {
        container: 'bottom-4 left-1/2 -translate-x-1/2',
        cards: 'mt-2'
      };
  }
} 