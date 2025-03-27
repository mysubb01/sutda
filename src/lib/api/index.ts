/**
 * 게임 API 모듈 - 통합 내보내기
 * 함수 충돌 문제 해결을 위해 명시적 내보내기 사용
 */

// 좌석 관련 함수
import { isSeatOccupied, changeSeat, updateSeat } from './seatApi';
export { isSeatOccupied, changeSeat, updateSeat };

// 플레이어 관련 함수
import { getGamePlayers } from './playerApi';
export { getGamePlayers };

// 게임 상태 관련 함수
import { getGameState } from './gameStateApi';
export { getGameState };

// 커뮤니케이션 관련 함수
import { sendMessage, getMessages } from './messageApi';
export { sendMessage, getMessages };

// 카드 관련 함수
import * as deckFunctions from './deckApi';
export { deckFunctions };
import * as gameCardFunctions from './gameCardApi';
export { gameCardFunctions };

// 베팅 관련 함수
import { BettingAction, processBetting, handleBettingTimeout } from './bettingApi';
export { BettingAction, processBetting, handleBettingTimeout };
import * as gameBettingFunctions from './gameBettingApi';
export { gameBettingFunctions };

// 게임 액션 관련 함수
import { 
  canStartGame,
  isRoomOwner,
  toggleReady,
  getNextPlayerTurn
} from './gameActionApi';
export { canStartGame, isRoomOwner, toggleReady, getNextPlayerTurn };

// 게임 룸 관련 함수
import { joinGame } from './gameRoomApi';
export { joinGame };

// 게임 라이프사이클 관련 함수
import { startGame, startDebugGame } from './gameLifecycleApi';
export { startGame, startDebugGame };

/**
 * API 버전 및 정보
 */
export const apiInfo = {
  version: '1.0.0',
  modulesReady: ['seat', 'player', 'gameState', 'message', 'deck', 'betting', 'gameAction'],
  pendingModules: ['admin']
};
