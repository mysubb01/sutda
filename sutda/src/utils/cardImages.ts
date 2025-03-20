/**
 * 카드 이미지 유틸리티
 * 이 파일은 카드 번호에 따른 이미지 경로를 제공합니다.
 */

// 카드 이미지 경로 매핑
// 카드 번호 -> 이미지 경로 (1: 1월 광, 2: 1월 일반, ...)
const cardImagePaths: Record<number, string> = {
  // 1월 카드
  1: '/images/cards/1-1.png', // 1월 광
  2: '/images/cards/1-2.png', // 1월 일반
  
  // 2월 카드
  3: '/images/cards/2-1.png', // 2월 광
  4: '/images/cards/2-2.png', // 2월 일반
  
  // 3월 카드
  5: '/images/cards/3-1.png', // 3월 광
  6: '/images/cards/3-2.png', // 3월 일반
  
  // 4월 카드
  7: '/images/cards/4-1.png', // 4월 광
  8: '/images/cards/4-2.png', // 4월 일반
  
  // 5월 카드
  9: '/images/cards/5-1.png', // 5월 광
  10: '/images/cards/5-2.png', // 5월 일반
  
  // 6월 카드
  11: '/images/cards/6-1.png', // 6월 광
  12: '/images/cards/6-2.png', // 6월 일반
  
  // 7월 카드
  13: '/images/cards/7-1.png', // 7월 광
  14: '/images/cards/7-2.png', // 7월 일반
  
  // 8월 카드
  15: '/images/cards/8-1.png', // 8월 광
  16: '/images/cards/8-2.png', // 8월 일반
  
  // 9월 카드
  17: '/images/cards/9-1.png', // 9월 광
  18: '/images/cards/9-2.png', // 9월 일반
  
  // 10월 카드
  19: '/images/cards/10-1.png', // 10월 광
  20: '/images/cards/10-2.png', // 10월 일반
};

// 카드 뒷면 이미지 경로
export const cardBackImagePath = '/images/cards/back.png';

/**
 * 카드 번호에 해당하는 이미지 경로를 반환합니다.
 * @param cardNumber 카드 번호 (1~20)
 * @returns 이미지 경로
 */
export function getCardImagePath(cardNumber: number): string {
  if (cardNumber < 1 || cardNumber > 20) {
    console.warn(`유효하지 않은 카드 번호: ${cardNumber}`);
    return cardBackImagePath; // 유효하지 않은 카드 번호인 경우 뒷면 반환
  }
  
  return cardImagePaths[cardNumber];
}

/**
 * 카드 이미지를 사전에 로드합니다.
 * 이미지를 미리 로드하여 게임 중 지연을 방지합니다.
 */
export function preloadCardImages(): void {
  if (typeof window === 'undefined') return;
  
  console.log('카드 이미지 사전 로드 중...');
  
  // 모든 카드 이미지 로드
  Object.values(cardImagePaths).forEach(path => {
    const img = new Image();
    img.src = path;
  });
  
  // 카드 뒷면 이미지 로드
  const backImg = new Image();
  backImg.src = cardBackImagePath;
  
  console.log('카드 이미지 사전 로드 완료');
} 