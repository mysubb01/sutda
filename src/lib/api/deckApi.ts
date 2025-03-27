/**
 * 카드 덱 관리 및 셔플링 관련 기능
 */

/**
 * 섯다 카드 덱 생성 및 셔플링
 * @returns 셔플된 카드 덱(0-19 범위의 숫자 배열)
 */
export function createShuffledDeck(): number[] {
  // 0부터 19까지의 카드 배열 생성 (0~9는 광, 10~19는 피)
  const cards = Array.from({ length: 20 }, (_, i) => i);
  
  // Fisher-Yates 알고리즘으로 셔플
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  
  return cards;
}

/**
 * 플레이어들에게 카드 분배
 * @param deck 셔플된 카드 덱
 * @param playerCount 플레이어 수
 * @param cardsPerPlayer 플레이어당 카드 수
 * @returns 플레이어별 카드 배열
 */
export function dealCards(
  deck: number[],
  playerCount: number,
  cardsPerPlayer: number = 2
): number[][] {
  const playerCards: number[][] = [];
  
  for (let i = 0; i < playerCount; i++) {
    const cards = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
    playerCards.push(cards);
  }
  
  return playerCards;
}

/**
 * 카드 조합의 패 순위 확인
 * @param cards 카드 배열(2장)
 * @returns 점수 (높을수록 강한 패)
 */
export function evaluateCards(cards: number[]): number {
  // 간단한 평가 로직 구현
  // 실제로는 더 복잡한 섯다 규칙을 적용해야 함
  
  if (cards.length !== 2) {
    return 0; // 카드가 2장이 아니면 0점
  }
  
  // 각 카드의 월수(1~10)
  const card1Month = (cards[0] % 10) + 1;
  const card2Month = (cards[1] % 10) + 1;
  
  // 땡 체크 (같은 월인 경우)
  if (card1Month === card2Month) {
    return 100 + card1Month; // 땡은 100+월수로 계산
  }
  
  // 끗수 계산 (두 카드의 월수 합의 일의 자리)
  const score = (card1Month + card2Month) % 10;
  
  // 특수 조합 체크
  if ((card1Month === 1 && card2Month === 2) || (card1Month === 2 && card2Month === 1)) {
    return 90; // 알리
  }
  
  if ((card1Month === 1 && card2Month === 4) || (card1Month === 4 && card2Month === 1)) {
    return 88; // 독사
  }
  
  // 일반 끗수 반환
  return score === 0 ? 1 : score; // 0끗은 망통(1점)
}

/**
 * 3장 모드에서 최종 2장 카드 선택
 * @param cards 보유한 3장의 카드
 * @returns 선택할 2장 카드 조합과 점수
 */
export function selectBestPair(cards: number[]): { selectedCards: number[], score: number } {
  if (cards.length !== 3) {
    throw new Error('3장의 카드가 필요합니다');
  }
  
  // 3장 중 2장을 선택하는 모든 조합 평가
  const pairs = [
    [cards[0], cards[1]],
    [cards[0], cards[2]],
    [cards[1], cards[2]]
  ];
  
  let bestPair = pairs[0];
  let highestScore = evaluateCards(pairs[0]);
  
  for (let i = 1; i < pairs.length; i++) {
    const score = evaluateCards(pairs[i]);
    if (score > highestScore) {
      highestScore = score;
      bestPair = pairs[i];
    }
  }
  
  return {
    selectedCards: bestPair,
    score: highestScore
  };
}
