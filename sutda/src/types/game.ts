/**
 * 게임의 상태를 나타내는 타입
 */
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'regame';

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
  action_type: BetActionType | 'start' | 'show' | 'regame';
  player_id: string;
  amount?: number;
  created_at: string;
}

// 배팅 액션 타입 정의
export type BetActionType = 'check' | 'call' | 'half' | 'quarter' | 'bet' | 'raise' | 'die';

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
  baseBet?: number; // 기본 배팅액 추가
  show_cards?: boolean; // 카드 공개 여부
  dang_values?: Record<string, number>; // 땡값 정보
  lastAction?: GameAction;
  messages?: Message[];
  regame_remaining_time?: number; // 재경기 남은 시간 
  regame_start_time?: string; // 재경기 시작 시간
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
  rejoined?: boolean; // 재접속 여부
}

export type CardRank = 
  | '38광땡'     // 3-8 광땡
  | '13광땡'     // 1-3 광땡
  | '18광땡'     // 1-8 광땡
  | '10땡'      // 10땡(장땡)
  | '9땡' | '8땡' | '7땡' | '6땡' | '5땡' | '4땡' | '3땡' | '2땡' | '1땡' // 개별 땡
  | '알리'       // 1-2
  | '독사'       // 1-4
  | '구삥'       // 1-9
  | '장삥'       // 1-10
  | '장사'       // 4-10
  | '세륙'       // 4-6
  | '땡잡이'     // 3-7
  | '암행어사'   // 4-7
  | '구사'       // 4-9
  | '멍텅구리구사' // 4-9 모두 열끗
  | '갑오'       // 9끗
  | '8끗' | '7끗' | '6끗' | '5끗' | '4끗' | '3끗' | '2끗' | '1끗' // 끗
  | '망통';      // 0끗

export interface CardCombination {
  cards: number[];
  rank: CardRank;
  value: number;
} 