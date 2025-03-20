import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 여러 클래스 이름을 병합하는 유틸리티 함수
 * clsx와 tailwind-merge를 사용하여 충돌 없이 클래스를 결합
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 카드 가치를 계산하는 함수
 */
export function calculateCardValue(cards: number[]): number {
  if (cards.length !== 2) return 0;
  
  // 숫자 부분 추출 (1-10)
  const firstValue = cards[0] % 10 || 10;
  const secondValue = cards[1] % 10 || 10;
  
  // 끗 계산 (일의 자리 합)
  return (firstValue + secondValue) % 10;
}

/**
 * 카드 조합의 이름을 가져오는 함수
 */
export function getCardCombinationName(cards: number[]): string {
  if (cards.length !== 2) return '없음';
  
  // 카드 값 분리: 1~10은 월 / 1~4는 광
  const firstMonth = Math.ceil(cards[0] / 4) || 10;
  const secondMonth = Math.ceil(cards[1] / 4) || 10;
  
  const firstValue = cards[0] % 10 || 10;
  const secondValue = cards[1] % 10 || 10;
  
  // 특수 조합 체크
  // 광땡
  if ((cards[0] === 1 && cards[1] === 5) || 
      (cards[0] === 5 && cards[1] === 1) || 
      (cards[0] === 1 && cards[1] === 9) || 
      (cards[0] === 9 && cards[1] === 1) || 
      (cards[0] === 5 && cards[1] === 9) || 
      (cards[0] === 9 && cards[1] === 5)) {
    return '광땡';
  }
  
  // 땡
  if (firstMonth === secondMonth) {
    return `${firstMonth}땡`;
  }
  
  // 알리
  if ((firstMonth === 1 && secondMonth === 2) ||
      (firstMonth === 2 && secondMonth === 1)) {
    return '알리';
  }
  
  // 독사
  if ((firstMonth === 1 && secondMonth === 4) ||
      (firstMonth === 4 && secondMonth === 1)) {
    return '독사';
  }
  
  // 구삥
  if ((firstMonth === 1 && secondMonth === 9) ||
      (firstMonth === 9 && secondMonth === 1)) {
    return '구삥';
  }
  
  // 장삥
  if ((firstMonth === 1 && secondMonth === 10) ||
      (firstMonth === 10 && secondMonth === 1)) {
    return '장삥';
  }
  
  // 장사
  if ((firstMonth === 4 && secondMonth === 10) ||
      (firstMonth === 10 && secondMonth === 4)) {
    return '장사';
  }
  
  // 세륙
  if ((firstMonth === 4 && secondMonth === 6) ||
      (firstMonth === 6 && secondMonth === 4)) {
    return '세륙';
  }
  
  // 끗
  const kkeut = (firstValue + secondValue) % 10;
  if (kkeut === 0) {
    return '망통';
  } else {
    return `${kkeut}끗`;
  }
}

/**
 * 포맷된 날짜를 반환하는 함수
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * URL에서 ID를 추출하는 함수
 */
export function extractIdFromUrl(url: string): string | null {
  const parts = url.split('/');
  return parts[parts.length - 1] || null;
} 