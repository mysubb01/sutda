/**
 * 게임의 상태를 나타내는 타입
 */
export type GameStatus = 'waiting' | 'playing' | 'finished';

/**
 * 카드의 상태를 나타내는 타입
 */
export type CardStatus = 'hidden' | 'showing' | 'open';

/**
 * 플레이어 정보 인터페이스
 */
export interface Player {
  id: string;
  user_id: string;
  username: string;
  balance: number;
  cards?: number[];
  isDie?: boolean;
  position?: number;
}

/**
 * 메시지 인터페이스
 */
export interface Message {
  id: string;
  content: string;
  username: string;
  user_id: string;
  created_at: string;
  player_id?: string;
  game_id: string;
}

/**
 * 게임 액션 인터페이스
 */
export interface GameAction {
  id: string;
  action_type: 'bet' | 'call' | 'die' | 'show' | 'start';
  player_id: string;
  amount?: number;
  created_at: string;
}

/**
 * 게임 상태 인터페이스
 */
export interface GameState {
  id: string;
  status: GameStatus;
  players: Player[];
  currentTurn: string;
  winner: string | null;
  bettingValue: number;
  lastAction?: GameAction;
  messages?: Message[];
}

/**
 * 게임 생성 응답 인터페이스
 */
export interface CreateGameResponse {
  gameId: string;
  playerId: string;
}

/**
 * 게임 참여 응답 인터페이스
 */
export interface JoinGameResponse {
  playerId: string;
  gameState: GameState;
}

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