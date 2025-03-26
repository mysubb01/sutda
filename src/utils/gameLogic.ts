import { CardCombination, CardRank } from '@/types/game';

// 카드 값 매핑: [1월~10월] * 2 = 20장의 카드
// 1: 1월 1광, 2: 1월 일반, 3: 2월 광, 4: 2월 일반, 5: 3월 광, ..., 20: 10월 일반
const CARD_VALUES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

// 카드 조합 평가 결과 캐싱을 위한 맵
const evaluationCache = new Map<string, CardCombination>();

/**
 * 카드가 속한 월을 반환 (1~10월)
 */
export function getCardMonth(cardNumber: number): number {
  // 카드 번호를 통해 월 계산 (1~20 카드번호 -> 1~10월)
  return Math.ceil(cardNumber / 2);
}

/**
 * 카드가 광인지 확인
 */
export function isKwang(cardNumber: number): boolean {
  return cardNumber % 2 === 1 && cardNumber <= 5; // 1, 3, 5번 카드는 광
}

/**
 * 카드가 열끗인지 확인 (장, 10월 패)
 */
export function isYeol(cardNumber: number): boolean {
  return cardNumber % 2 === 0; // 짝수 카드는 모두 열끗(일반)
}

/**
 * 캐시키 생성
 */
function getCacheKey(cards: number[]): string {
  return cards.sort((a, b) => a - b).join('-');
}

/**
 * 카드 조합의 등급과 값을 계산
 */
export function evaluateCards(cards: number[]): CardCombination {
  // 입력 검증
  if (!cards || cards.length !== 2) {
    console.error('유효하지 않은 카드 조합:', cards);
    return { cards: cards || [], rank: '망통', value: 0 };
  }

  // 캐시 확인
  const cacheKey = getCacheKey(cards);
  const cachedResult = evaluationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const [card1, card2] = [...cards].sort((a, b) => a - b); // 오름차순 정렬, 원본 배열 변경 방지
    const month1 = getCardMonth(card1);
    const month2 = getCardMonth(card2);
    
    // 카드 종류 확인
    const isCard1Kwang = isKwang(card1);
    const isCard2Kwang = isKwang(card2);
    const isCard1Yeol = isYeol(card1);
    const isCard2Yeol = isYeol(card2);

    // 38광땡 (3월 광 + 8월 광)
    if (month1 === 3 && month2 === 8 && isCard1Kwang && isCard2Kwang) {
      const result = { cards, rank: '38광땡' as CardRank, value: 2000 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 13광땡 (1월 광 + 3월 광)
    if (month1 === 1 && month2 === 3 && isCard1Kwang && isCard2Kwang) {
      const result = { cards, rank: '13광땡' as CardRank, value: 1900 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 18광땡 (1월 광 + 8월 광)
    if (month1 === 1 && month2 === 8 && isCard1Kwang && isCard2Kwang) {
      const result = { cards, rank: '18광땡' as CardRank, value: 1800 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 암행어사 (4월 열끗 + 7월 열끗)
    if (month1 === 4 && month2 === 7 && isCard1Yeol && isCard2Yeol) {
      const result = { cards, rank: '암행어사' as CardRank, value: 1700 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 땡잡이 (3월 열끗 + 7월 열끗)
    if (month1 === 3 && month2 === 7 && isCard1Yeol && isCard2Yeol) {
      const result = { cards, rank: '땡잡이' as CardRank, value: 1600 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 멍텅구리 구사 (4월 열끗 + 9월 열끗)
    if (month1 === 4 && month2 === 9 && isCard1Yeol && isCard2Yeol) {
      console.log('멍텅구리구사 발생: 4월 열끗 + 9월 열끗');
      const result = { cards, rank: '멍텅구리구사' as CardRank, value: -100 }; // 특별 처리 위해 음수값
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 구사 (4월 + 9월 조합, 둘 다 열끗이 아닌 경우)
    if ((month1 === 4 && month2 === 9) || (month1 === 9 && month2 === 4)) {
      // 둘 다 열끗인 경우는 제외 (이미 멍텅구리구사로 처리됨)
      if (!(month1 === 4 && month2 === 9 && isCard1Yeol && isCard2Yeol)) {
        console.log('구사 발생: 4월 + 9월 (열끗 아닌 조합)');
        const result = { cards, rank: '구사' as CardRank, value: -200 }; // 특별 처리 위해 음수값
        evaluationCache.set(cacheKey, result);
        return result;
      }
    }
    
    // 땡 (같은 월)
    if (month1 === month2) {
      // 장땡 (10땡)
      if (month1 === 10) {
        const result = { cards, rank: '10땡' as CardRank, value: 1500 };
        evaluationCache.set(cacheKey, result);
        return result;
      }
      // 나머지 땡들 (9땡 ~ 1땡)
      const result = { cards, rank: `${month1}땡` as CardRank, value: 1400 + month1 * 10 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 알리 (1월, 2월)
    if ((month1 === 1 && month2 === 2) || (month1 === 2 && month2 === 1)) {
      const result = { cards, rank: '알리' as CardRank, value: 800 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 독사 (1월, 4월)
    if ((month1 === 1 && month2 === 4) || (month1 === 4 && month2 === 1)) {
      const result = { cards, rank: '독사' as CardRank, value: 700 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 구삥 (1월, 9월)
    if ((month1 === 1 && month2 === 9) || (month1 === 9 && month2 === 1)) {
      const result = { cards, rank: '구삥' as CardRank, value: 600 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 장삥 (1월, 10월)
    if ((month1 === 1 && month2 === 10) || (month1 === 10 && month2 === 1)) {
      const result = { cards, rank: '장삥' as CardRank, value: 500 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 장사 (4월, 10월)
    if ((month1 === 4 && month2 === 10) || (month1 === 10 && month2 === 4)) {
      const result = { cards, rank: '장사' as CardRank, value: 400 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 세륙 (4월, 6월)
    if ((month1 === 4 && month2 === 6) || (month1 === 6 && month2 === 4)) {
      const result = { cards, rank: '세륙' as CardRank, value: 300 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 끗 계산 (1~9끗)
    const kkeut = (month1 + month2) % 10;
    
    // 갑오 (9끗)
    if (kkeut === 9) {
      const result = { cards, rank: '갑오' as CardRank, value: 250 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 나머지 끗
    if (kkeut > 0) {
      const result = { cards, rank: `${kkeut}끗` as CardRank, value: 100 + kkeut * 10 };
      evaluationCache.set(cacheKey, result);
      return result;
    }
    
    // 망통 (0끗)
    const result = { cards, rank: '망통' as CardRank, value: 50 };
    evaluationCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('카드 평가 중 오류 발생:', error, cards);
    return { cards, rank: '망통' as CardRank, value: 0 };
  }
}

// 카드 비교 함수: 누가 이겼는지 계산 (1: 첫 번째 플레이어, 2: 두 번째 플레이어, 0: 무승부)
export function compareCards(player1Cards: number[], player2Cards: number[]): number {
  const p1Eval = evaluateCards(player1Cards);
  const p2Eval = evaluateCards(player2Cards);
  
  console.log('패 비교:', p1Eval.rank, '(값:', p1Eval.value, ') vs', p2Eval.rank, '(값:', p2Eval.value, ')');
  
  // 구사류 특수 처리
  if (p1Eval.rank === '구사' || p1Eval.rank === '멍텅구리구사' || 
      p2Eval.rank === '구사' || p2Eval.rank === '멍텅구리구사') {
    return 0; // 구사 발생은 일단 무승부 처리 (나중에 finishGame에서 재경기 로직 실행)
  }
  
  // 암행어사는 광땡(13, 18)에 승리
  if (p1Eval.rank === '암행어사' && 
     (p2Eval.rank === '13광땡' || p2Eval.rank === '18광땡')) {
    console.log('암행어사가 광땡을 이김');
    return 1;
  }
  if (p2Eval.rank === '암행어사' && 
     (p1Eval.rank === '13광땡' || p1Eval.rank === '18광땡')) {
    console.log('암행어사가 광땡을 이김');
    return 2;
  }
  
  // 땡잡이는 1땡~9땡을 이김 (장땡 및 광땡 제외)
  if (p1Eval.rank === '땡잡이' && 
     (p2Eval.rank.includes('땡') && p2Eval.rank !== '10땡' && 
      !p2Eval.rank.includes('광땡'))) {
    console.log('땡잡이가 일반 땡을 이김');
    return 1;
  }
  if (p2Eval.rank === '땡잡이' && 
     (p1Eval.rank.includes('땡') && p1Eval.rank !== '10땡' && 
      !p1Eval.rank.includes('광땡'))) {
    console.log('땡잡이가 일반 땡을 이김');
    return 2;
  }
  
  // 일반 족보 비교
  if (p1Eval.value > p2Eval.value) {
    return 1;
  } else if (p1Eval.value < p2Eval.value) {
    return 2;
  } else {
    return 0; // 무승부
  }
}

// 다음 차례 계산
export function nextTurn(currentPlayerId: string, players: { id: string; is_die: boolean }[]): string {
  const activePlayers = players.filter(p => !p.is_die);
  if (activePlayers.length <= 1) {
    return activePlayers[0]?.id || currentPlayerId;
  }

  const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex].id;
}

// 승자 결정 함수 개선
export function determineWinner(players: { id: string; cards: number[]; is_die: boolean }[]): { winnerId: string | null; isRegame: boolean } {
  const activePlayers = players.filter(p => !p.is_die);
  
  if (activePlayers.length === 0) {
    return { winnerId: null, isRegame: false };
  }
  
  if (activePlayers.length === 1) {
    return { winnerId: activePlayers[0].id, isRegame: false };
  }
  
  // 구사패 체크
  const playersWithGusa = activePlayers.filter(p => {
    const evaluation = evaluateCards(p.cards);
    return evaluation.rank === '구사';
  });
  
  // 멍텅구리 구사 체크
  const playersWithMengGusa = activePlayers.filter(p => {
    const evaluation = evaluateCards(p.cards);
    return evaluation.rank === '멍텅구리구사';
  });
  
  // 구사가 있을 경우 특별 규칙 적용
  if (playersWithGusa.length > 0) {
    // 알리 이하인지 확인
    const highestNonGusaPlayer = activePlayers
      .filter(p => evaluateCards(p.cards).rank !== '구사')
      .sort((a, b) => {
        const aEval = evaluateCards(a.cards);
        const bEval = evaluateCards(b.cards);
        return bEval.value - aEval.value; // 내림차순 정렬
      })[0];
      
    if (highestNonGusaPlayer) {
      const highestEval = evaluateCards(highestNonGusaPlayer.cards);
      if (highestEval.value <= 800) { // 알리 이하
        console.log('구사 발생, 최고 패가 알리 이하이므로 재경기');
        return { winnerId: null, isRegame: true };
      }
    }
  }
  
  // 멍텅구리 구사 처리
  if (playersWithMengGusa.length > 0) {
    // 최고 패가 장땡(10땡) 이하인지 확인
    const highestNonMengGusaPlayer = activePlayers
      .filter(p => evaluateCards(p.cards).rank !== '멍텅구리구사')
      .sort((a, b) => {
        const aEval = evaluateCards(a.cards);
        const bEval = evaluateCards(b.cards);
        return bEval.value - aEval.value; // 내림차순 정렬
      })[0];
      
    if (highestNonMengGusaPlayer) {
      const highestEval = evaluateCards(highestNonMengGusaPlayer.cards);
      if (highestEval.value <= 1500) { // 장땡(10땡) 이하
        console.log('멍텅구리 구사 발생, 최고 패가 장땡 이하이므로 재경기');
        return { winnerId: null, isRegame: true };
      }
    }
  }
  
  // 일반 승자 결정
  let winnerId = activePlayers[0].id;
  let winnerCards = activePlayers[0].cards;
  let winnerEval = evaluateCards(winnerCards);
  
  // 각 플레이어의 인덱스를 기억해둠 (자리 순서 판별용)
  const playerIndices: Record<string, number> = {};
  activePlayers.forEach((player, index) => {
    playerIndices[player.id] = index;
  });
  
  for (let i = 1; i < activePlayers.length; i++) {
    const result = compareCards(winnerCards, activePlayers[i].cards);
    if (result === 2) {
      winnerId = activePlayers[i].id;
      winnerCards = activePlayers[i].cards;
      winnerEval = evaluateCards(winnerCards);
    } else if (result === 0) {
      // 동점자 처리 (먼저 앉은 사람이 이김)
      // 인덱스가 더 작은(먼저 앉은) 플레이어가 이김
      if (playerIndices[activePlayers[i].id] < playerIndices[winnerId]) {
        winnerId = activePlayers[i].id;
        winnerCards = activePlayers[i].cards;
        winnerEval = evaluateCards(winnerCards);
      }
    }
  }
  
  return { winnerId, isRegame: false };
}

// 3장 중 최적의 2장 조합 찾기
export function findBestCombination(cards: number[]): number[] {
  if (!cards || cards.length !== 3) {
    return cards || [];
  }

  // 3장 중 가능한 모든 2장 조합
  const combinations = [
    [cards[0], cards[1]],
    [cards[0], cards[2]],
    [cards[1], cards[2]]
  ];

  // 각 조합 평가
  const evaluations = combinations.map(combo => {
    const evaluation = evaluateCards(combo);
    return {
      cards: combo,
      rank: evaluation.rank,
      value: evaluation.value
    };
  });

  // 값이 가장 높은 조합 찾기
  const bestCombination = evaluations.reduce((best, current) => {
    // 구사/멍텅구리구사처럼 음수 값을 가진 특수 족보는 특별 처리
    const isBestSpecial = best.value < 0;
    const isCurrentSpecial = current.value < 0;

    if (isBestSpecial && isCurrentSpecial) {
      // 둘 다 특수 족보면 값이 큰 것이 이김 (-100 > -200)
      return best.value > current.value ? best : current;
    } else if (isBestSpecial) {
      // best만 특수 족보면 current 선택
      return current;
    } else if (isCurrentSpecial) {
      // current만 특수 족보면 best 유지
      return best;
    } else {
      // 일반 족보는 값이 높은 것이 이김
      return best.value >= current.value ? best : current;
    }
  }, evaluations[0]);

  return bestCombination.cards;
}