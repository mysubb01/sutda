/**
 * 게임의 상태를 나타내는 타입
 */
export type GameStatus = "waiting" | "playing" | "finished" | "regame";

/**
 * 게임 모드 타입
 */
export type GameMode = 2 | 3; // 2: 2장 모드, 3: 3장 모드

/**
 * 카드의 상태를 나타내는 타입
 */
export type CardStatus = "hidden" | "showing" | "open";

/**
 * 방 정보 인터페이스
 */
export interface Room {
  id: string;
  name: string;
  mode: GameMode;
  entry_fee: number;
  max_players: number;
  is_active: boolean;
  created_at: string;
  betting_option: "standard" | "step_by_step";
  current_players?: number; // 현재 방에 있는 플레이어 수
  default_base_bet?: number; // 기본 배팅액
  metadata?: any; // 추가 메타데이터 (예: 디버그 플래그)
}

/**
 * 플레이어 정보 인터페이스
 */
export interface Player {
  id: string;
  user_id: string;
  username: string;
  balance: number; // 프론트엔드 호환성 위해 balance 사용
  room_id?: string; // 속한 방 ID 추가
  cards?: number[];
  open_card?: number; // 3장 모드에서 공개된 카드
  selected_cards?: number[]; // 3장 모드에서 최종 선택한 카드
  is_die?: boolean; // 폴드 여부 (folded -> is_die로 통일함)
  current_bet?: number; // 현재 베팅 금액
  position?: number;
  seat_index?: number; // 테이블에서의 좌석 인덱스 (0-7)
  is_ready?: boolean; // 준비 여부
  game_id?: string; // 속한 게임 ID
  is_muted?: boolean; // 음소거 여부

  // 추가된 필드
  last_action?: string; // 마지막 액션
  last_action_time?: string; // 마지막 액션 시간
  last_heartbeat?: string; // 마지막 하트비트 시간
  has_acted?: boolean; // 현재 턴에 액션을 취했는지 여부
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
  game_id: string;
}

/**
 * 게임 액션 인터페이스
 */
export interface GameAction {
  id: string;
  action_type:
    | BetActionType
    | "start"
    | "show"
    | "regame"
    | "select_cards"
    | "draw_card";
  player_id: string;
  amount?: number;
  betting_round?: number; // 베팅 라운드 추가
  created_at: string;
}

// 배팅 액션 타입 정의
export type BetActionType =
  | "check"
  | "call"
  | "half"
  | "bet"
  | "raise"
  | "fold"
  | "quarter"; // die -> fold로 변경

/**
 * 게임 상태 인터페이스
 */
export interface GameState {
  id: string;
  room_id?: string; // 속한 방 ID
  room_name?: string; // 방 이름
  status: GameStatus;
  players: Player[];
  currentTurn: string; // 프론트엔드에서 사용하는 필드명
  winner: string | null;
  bettingValue: number;
  totalPot?: number; // 총 판돈 - 지원 해야 하는 필드 명
  pot?: number; // DB에서 사용하는 필드명
  baseBet?: number; // 기본 배팅액
  show_cards?: boolean; // 카드 공개 여부
  dang_values?: Record<string, number>; // 땡값 정보
  lastAction?: GameAction;
  messages?: Message[];
  regame_remaining_time?: number; // 재경기 남은 시간
  regame_start_time?: string; // 재경기 시작 시간

  // 베팅 라운드 관련 필드 - 대체 필드를 모두 지원
  bettingRound?: number; // camel 케이스 표기법(프론트엔드)
  betting_round?: number; // 스네이크 케이스 표기법(API -> DB)
  round?: number; // DB에서 사용하는 필드명

  // 게임 모드 관련 필드 - 대체 필드를 모두 지원
  gameMode?: GameMode; // camel 케이스 표기법(프론트엔드)
  game_mode?: GameMode; // 스네이크 케이스 표기법(API -> DB)
  mode?: GameMode; // DB에서 사용하는 필드명

  // 베팅 제한 시간 관련 필드 - 대체 필드를 모두 지원
  bettingEndTime?: string; // camel 케이스 표기법(프론트엔드)
  betting_end_time?: string; // 스네이크 케이스 표기법(API -> DB)

  cardSelectionTime?: string; // 카드 선택 시간
  deckRemaining?: number; // 남은 덱 카드 수
}

/**
 * 게임 생성 응답 인터페이스
 */
export interface CreateGameResponse {
  gameId: string;
  playerId: string | null;
}

/**
 * 게임 참여 응답 인터페이스
 */
export interface JoinGameResponse {
  playerId: string;
  gameState: GameState;
  rejoined?: boolean; // 재접속 여부
}

/**
 * 방 생성 응답 인터페이스
 */
export interface CreateRoomResponse {
  roomId: string;
}

/**
 * 방 참여 응답 인터페이스
 */
export interface JoinRoomResponse {
  roomId: string;
  playerId: string;
}

/**
 * 카드 선택 인터페이스 (3장 모드)
 */
export interface SelectCardsRequest {
  gameId: string;
  playerId: string;
  selectedCards: number[]; // 선택한 2장의 카드
}

export type CardRank =
  | "38광땡" // 3-8 광땡
  | "13광땡" // 1-3 광땡
  | "18광땡" // 1-8 광땡
  | "10땡" // 10땡(장땡)
  | "9땡"
  | "8땡"
  | "7땡"
  | "6땡"
  | "5땡"
  | "4땡"
  | "3땡"
  | "2땡"
  | "1땡" // 개별 땡
  | "알리" // 1-2
  | "독사" // 1-4
  | "구삥" // 1-9
  | "장삥" // 1-10
  | "장사" // 4-10
  | "세륙" // 4-6
  | "땡잡이" // 3-7
  | "암행어사" // 4-7
  | "구사" // 4-9
  | "멍텅구리구사" // 4-9 모두 열끗
  | "갑오" // 9끗
  | "8끗"
  | "7끗"
  | "6끗"
  | "5끗"
  | "4끗"
  | "3끗"
  | "2끗"
  | "1끗" // 끗
  | "망통"; // 0끗

export interface CardCombination {
  cards: number[];
  rank: CardRank;
  value: number;
}

/**
 * 로그 레벨 타입
 */
export type LogLevel = "debug" | "info" | "warning" | "error";

/**
 * 로그 카테고리 타입
 */
export type LogCategory = "game" | "player" | "betting" | "cards" | "system";

/**
 * 게임 로그 인터페이스
 */
export interface GameLog {
  id: string;
  game_id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  player_id?: string;
  metadata?: any; // 추가 데이터 (예: 에러 정보, 사용자 정보 등)
}
