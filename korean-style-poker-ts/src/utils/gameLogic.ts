import { CardCombination, CardRank } from '@/types/game';

// 카드 값 매핑: [1월~10월] * 2 = 20장의 카드
// 1: 1월 1광, 2: 1월 일반, 3: 2월, ..., 20: 10월 일반
const CARD_VALUES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

// 카드 번호를 월로 변환 (1~10)
export function getCardMonth(cardNumber: number): number {
  return Math.ceil(cardNumber / 2);
}

// 카드가 광인지 확인
export function isKwang(cardNumber: number): boolean {
  return cardNumber === 1 || cardNumber === 3 || cardNumber === 8;
}

// 카드 덱을 섞는 함수
export function shuffleDeck(): number[] {
  const deck = [...CARD_VALUES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // 스왑
  }
  return deck;
}

// 카드 조합의 등급과 값을 계산
export function evaluateCards(cards: number[]): CardCombination {
  if (cards.length !== 2) {
    throw new Error('카드는 정확히 2장이어야 합니다');
  }

  const [card1, card2] = cards;
  const month1 = getCardMonth(card1);
  const month2 = getCardMonth(card2);

  // 광땡 체크
  if (card1 === 1 && card2 === 3) {
    return { cards, rank: '광땡', value: 1000 };
  }
  if (card1 === 1 && card2 === 8) {
    return { cards, rank: '광땡', value: 999 };
  }
  if (card2 === 1 && card1 === 3) {
    return { cards, rank: '광땡', value: 1000 };
  }
  if (card2 === 1 && card1 === 8) {
    return { cards, rank: '광땡', value: 999 };
  }

  // 땡 체크
  if (month1 === month2) {
    return { cards, rank: '땡', value: 900 + month1 * 10 };
  }

  // 특수 조합 체크
  // 알리 (1월, 2월)
  if ((month1 === 1 && month2 === 2) || (month1 === 2 && month2 === 1)) {
    return { cards, rank: '알리', value: 800 };
  }

  // 독사 (1월, 4월)
  if ((month1 === 1 && month2 === 4) || (month1 === 4 && month2 === 1)) {
    return { cards, rank: '독사', value: 700 };
  }

  // 구삥 (1월, 9월)
  if ((month1 === 1 && month2 === 9) || (month1 === 9 && month2 === 1)) {
    return { cards, rank: '구삥', value: 600 };
  }

  // 장삥 (1월, 10월)
  if ((month1 === 1 && month2 === 10) || (month1 === 10 && month2 === 1)) {
    return { cards, rank: '장삥', value: 500 };
  }

  // 장사 (4월, 10월)
  if ((month1 === 4 && month2 === 10) || (month1 === 10 && month2 === 4)) {
    return { cards, rank: '장사', value: 400 };
  }

  // 세륙 (4월, 6월)
  if ((month1 === 4 && month2 === 6) || (month1 === 6 && month2 === 4)) {
    return { cards, rank: '세륙', value: 300 };
  }

  // 끗 (나머지 조합)
  const kkeut = (month1 + month2) % 10;
  if (kkeut === 0) {
    return { cards, rank: '망통', value: 0 };
  } else {
    return { cards, rank: '끗', value: kkeut };
  }
}

// 카드 비교 함수: 누가 이겼는지 계산 (1: 첫 번째 플레이어, 2: 두 번째 플레이어, 0: 무승부)
export function compareCards(player1Cards: number[], player2Cards: number[]): number {
  const p1Eval = evaluateCards(player1Cards);
  const p2Eval = evaluateCards(player2Cards);

  if (p1Eval.value > p2Eval.value) {
    return 1;
  } else if (p1Eval.value < p2Eval.value) {
    return 2;
  } else {
    return 0; // 무승부
  }
}

// 다음 차례 계산
export function nextTurn(currentPlayerId: string, players: { id: string; isDie: boolean }[]): string {
  const activePlayers = players.filter(p => !p.isDie);
  if (activePlayers.length <= 1) {
    return activePlayers[0]?.id || currentPlayerId;
  }

  const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex].id;
}

// 승자 결정
export function determineWinner(players: { id: string; cards: number[]; isDie: boolean }[]): string | null {
  const activePlayers = players.filter(p => !p.isDie);
  
  if (activePlayers.length === 0) {
    return null;
  }
  
  if (activePlayers.length === 1) {
    return activePlayers[0].id;
  }
  
  let winnerId = activePlayers[0].id;
  let winnerCards = activePlayers[0].cards;
  
  for (let i = 1; i < activePlayers.length; i++) {
    const result = compareCards(winnerCards, activePlayers[i].cards);
    if (result === 2) {
      winnerId = activePlayers[i].id;
      winnerCards = activePlayers[i].cards;
    }
  }
  
  return winnerId;
} 