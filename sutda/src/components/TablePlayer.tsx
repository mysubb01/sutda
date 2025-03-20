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
    console.log('카드 상태:', status, '값:', value);
    try {
      if (status === 'open' && value) {
        // 실제 존재하는 카드 이미지로 변경 (.jpg)
        return `/images/cards/${value}.jpg`;
      } else if (status === 'showing') {
        return '/images/cards/back.jpg';
      } else {
        // 숨겨진 카드
        return '/images/cards/back.jpg'; // 뒷면 카드 이미지
      }
    } catch (error) {
      console.error('카드 이미지 URL 생성 오류:', error);
      return '/images/cards/back.jpg'; // 오류 시 기본 카드 이미지
    }
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
        {/* 플레이어 프로필 */}
        <div className={cn(
          'flex items-center justify-center relative',
          isDead && 'opacity-50'
        )}>
          <div className={cn(
            'relative w-16 h-16 rounded-full overflow-hidden border-2 shadow-lg',
            isMe ? 'border-blue-500' : 'border-yellow-500',
            isCurrentTurn ? 'ring-2 ring-green-400' : ''
          )}>
            <Image
              src={faceImage}
              alt={username}
              width={64}
              height={64}
              className="object-cover"
            />
            
            {isDead && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <Image
                  src="/images/ui/dieM.png"
                  alt="Die"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* 플레이어 정보 */}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-20 text-center">
          <div className="bg-gray-900 bg-opacity-80 p-1 rounded-md shadow-md border border-yellow-600">
            <p className="text-xs font-bold text-white truncate">
              {username}
            </p>
            <p className="text-xs text-yellow-400">
              {balance.toLocaleString()}P
            </p>
          </div>
        </div>
      </div>
      
      {/* 카드 영역 */}
      <div className={cn(
        'flex space-x-1',
        positionStyles.cards
      )}>
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={cn(
              'relative w-10 h-14 transition-all',
              card.status === 'hidden' && 'opacity-50 scale-95'
            )}
          >
            <Image
              src={getCardImageUrl(card.status, card.value)}
              alt={card.status}
              width={40}
              height={56}
              className="rounded shadow-md"
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