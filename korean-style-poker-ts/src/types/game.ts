export interface Player {
  id: string;
  username: string;
  cards: number[];
  isDie: boolean;
  balance: number;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  currentTurn: string | null;
  bettingValue: number;
  winner: string | null;
}

export type GameAction = 
  | { type: 'JOIN_GAME'; payload: { playerId: string; username: string } }
  | { type: 'START_GAME'; payload: { initialTurn: string } }
  | { type: 'PLACE_BET'; payload: { playerId: string; amount: number } }
  | { type: 'CALL'; payload: { playerId: string } }
  | { type: 'DIE'; payload: { playerId: string } }
  | { type: 'CHECK'; payload: { playerId: string } }
  | { type: 'END_GAME'; payload: { winnerId: string } };

export type CardRank = 
  | '광땡' // 1-3광땡, 1-8광땡
  | '땡' // 같은 숫자 2장 (1땡~10땡)
  | '알리' // 1-2
  | '독사' // 1-4
  | '구삥' // 1-9
  | '장삥' // 1-10
  | '장사' // 4-10
  | '세륙' // 4-6
  | '끗' // 나머지 조합 (X끗)
  | '망통'; // 0끗

export interface CardCombination {
  cards: number[];
  rank: CardRank;
  value: number;
} 