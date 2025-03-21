/**
 * 카드 이미지 유틸리티
 * 이 파일은 카드 번호에 따른 이미지 경로를 제공합니다.
 */

// 카드 이미지 경로 매핑
// 카드 번호 -> 이미지 경로 (1: 1월 광, 2: 1월 일반, ...)
const cardImagePaths: Record<number, string> = {
  // 1월 카드
  1: '/images/cards/1.jpg', // 1월 광
  2: '/images/cards/2.jpg', // 1월 일반
  
  // 2월 카드
  3: '/images/cards/3.jpg', // 2월 광
  4: '/images/cards/4.jpg', // 2월 일반
  
  // 3월 카드
  5: '/images/cards/5.jpg', // 3월 광
  6: '/images/cards/6.jpg', // 3월 일반
  
  // 4월 카드
  7: '/images/cards/7.jpg', // 4월 광
  8: '/images/cards/8.jpg', // 4월 일반
  
  // 5월 카드
  9: '/images/cards/9.jpg', // 5월 광
  10: '/images/cards/10.jpg', // 5월 일반
  
  // 6월 카드
  11: '/images/cards/11.jpg', // 6월 광
  12: '/images/cards/12.jpg', // 6월 일반
  
  // 7월 카드
  13: '/images/cards/13.jpg', // 7월 광
  14: '/images/cards/14.jpg', // 7월 일반
  
  // 8월 카드
  15: '/images/cards/15.jpg', // 8월 광
  16: '/images/cards/16.jpg', // 8월 일반
  
  // 9월 카드
  17: '/images/cards/17.jpg', // 9월 광
  18: '/images/cards/18.jpg', // 9월 일반
  
  // 10월 카드
  19: '/images/cards/19.jpg', // 10월 광
  20: '/images/cards/20.jpg', // 10월 일반
};

// 카드 뒷면 이미지 경로 - 절대 경로로 확정
export const cardBackImagePath = '/images/cards/CardBack.png';

// 카드 텍스트 설명
const cardTextDescriptions: Record<number, string> = {
  1: "1월 광", 2: "1월 일반",
  3: "2월 광", 4: "2월 일반",
  5: "3월 광", 6: "3월 일반",
  7: "4월 광", 8: "4월 일반",
  9: "5월 광", 10: "5월 일반",
  11: "6월 광", 12: "6월 일반",
  13: "7월 광", 14: "7월 일반",
  15: "8월 광", 16: "8월 일반",
  17: "9월 광", 18: "9월 일반",
  19: "10월 광", 20: "10월 일반"
};

/**
 * 카드 이미지 경로 생성
 */
export function getCardImagePath(cardNumber: number): string {
  const month = Math.ceil(cardNumber / 2);
  const isKwang = cardNumber % 2 === 1;
  return `/images/cards/${month}_${isKwang ? 'kwang' : 'yeol'}.jpg`;
}

/**
 * 카드 번호에 해당하는 텍스트 설명을 반환합니다.
 * @param cardNumber 카드 번호 (1~20)
 * @returns 카드 설명 텍스트
 */
export function getCardDescription(cardNumber: number): string {
  if (cardNumber < 1 || cardNumber > 20) {
    return "알 수 없는 카드";
  }
  
  return cardTextDescriptions[cardNumber];
}

/**
 * 이미지 로드 성공 여부를 확인합니다.
 * @param path 이미지 경로
 * @returns Promise로 감싼 불리언 값 (성공: true, 실패: false)
 */
export function checkImageExists(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = path;
  });
}

/**
 * 모든 카드 이미지를 프리로드
 */
export function preloadCardImages(): void {
  // 브라우저 환경에서만 실행
  if (typeof window === 'undefined') return;
  
  console.log('카드 이미지 프리로딩 시작...');
  
  // 뒷면과 폴백 이미지 프리로드
  const preloadBackImage = new Image();
  preloadBackImage.src = cardBackImagePath;
  
  const preloadFallbackImage = new Image();
  preloadFallbackImage.src = '/images/cards/unknown.jpg';
  
  // 모든 카드 이미지 프리로드 (1월~10월, 광/열끗)
  for (let month = 1; month <= 10; month++) {
    // 광 카드
    const kwangImage = new Image();
    kwangImage.src = `/images/cards/${month}_kwang.jpg`;
    
    // 열끗 카드
    const yeolImage = new Image();
    yeolImage.src = `/images/cards/${month}_yeol.jpg`;
  }
  
  console.log('카드 이미지 프리로딩 완료');
} 