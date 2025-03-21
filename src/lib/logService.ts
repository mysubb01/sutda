import { supabase } from './supabase';
import { GameLog, LogCategory, LogLevel } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

/**
 * 로그 서비스
 * 게임 이벤트와 오류를 기록하고 조회하는 기능 제공
 */

/**
 * 게임 로그 생성
 */
export async function createGameLog(
  gameId: string,
  level: LogLevel,
  category: LogCategory,
  message: string,
  playerId?: string,
  metadata?: any
): Promise<string> {
  try {
    const logId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const logEntry: GameLog = {
      id: logId,
      game_id: gameId,
      timestamp,
      level,
      category,
      message,
      player_id: playerId,
      metadata
    };
    
    // 콘솔 출력 (개발 디버깅용)
    const consoleMessage = `[${level.toUpperCase()}] [${category}] ${message}`;
    switch(level) {
      case 'error':
        console.error(consoleMessage, metadata);
        break;
      case 'warning':
        console.warn(consoleMessage, metadata);
        break;
      case 'info':
        console.info(consoleMessage, metadata);
        break;
      default:
        console.log(consoleMessage, metadata);
    }
    
    // 데이터베이스에 저장
    const { error } = await supabase
      .from('game_logs')
      .insert(logEntry);
      
    if (error) {
      console.error('로그 저장 오류:', error);
      return logId; // 로그 저장 실패해도 ID는 반환
    }
    
    return logId;
  } catch (err) {
    console.error('로그 생성 중 예외 발생:', err);
    return uuidv4(); // 오류 발생 시 임의 ID 반환
  }
}

/**
 * 게임의 모든 로그 조회
 */
export async function getGameLogs(
  gameId: string,
  options?: {
    level?: LogLevel,
    category?: LogCategory,
    playerId?: string,
    limit?: number,
    offset?: number
  }
): Promise<GameLog[]> {
  try {
    let query = supabase
      .from('game_logs')
      .select('*')
      .eq('game_id', gameId)
      .order('timestamp', { ascending: false });
    
    // 필터 적용
    if (options?.level) {
      query = query.eq('level', options.level);
    }
    
    if (options?.category) {
      query = query.eq('category', options.category);
    }
    
    if (options?.playerId) {
      query = query.eq('player_id', options.playerId);
    }
    
    // 페이징 처리
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50) - 1));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('로그 조회 오류:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('로그 조회 중 예외 발생:', err);
    return [];
  }
}

/**
 * 편의 함수: 디버그 로그
 */
export function logDebug(gameId: string, category: LogCategory, message: string, playerId?: string, metadata?: any) {
  return createGameLog(gameId, 'debug', category, message, playerId, metadata);
}

/**
 * 편의 함수: 정보 로그
 */
export function logInfo(gameId: string, category: LogCategory, message: string, playerId?: string, metadata?: any) {
  return createGameLog(gameId, 'info', category, message, playerId, metadata);
}

/**
 * 편의 함수: 경고 로그
 */
export function logWarning(gameId: string, category: LogCategory, message: string, playerId?: string, metadata?: any) {
  return createGameLog(gameId, 'warning', category, message, playerId, metadata);
}

/**
 * 편의 함수: 오류 로그
 */
export function logError(gameId: string, category: LogCategory, message: string, playerId?: string, metadata?: any) {
  return createGameLog(gameId, 'error', category, message, playerId, metadata);
}

/**
 * 게임 시작 로그
 */
export function logGameStart(gameId: string, playerCount: number, gameMode: number) {
  return logInfo(
    gameId,
    'game',
    `게임 시작: ${playerCount}명 참가, ${gameMode}장 모드`,
    undefined,
    { playerCount, gameMode }
  );
}

/**
 * 게임 종료 로그
 */
export function logGameEnd(gameId: string, winnerId: string, winningRank: string, totalPot: number) {
  return logInfo(
    gameId,
    'game',
    `게임 종료: 승자 ${winnerId}, 족보 ${winningRank}, 총 상금 ${totalPot}`,
    winnerId,
    { winningRank, totalPot }
  );
}

/**
 * 베팅 액션 로그
 */
export function logBettingAction(gameId: string, playerId: string, action: string, amount: number, currentPot: number) {
  return logInfo(
    gameId,
    'betting',
    `베팅 액션: ${playerId}의 ${action} ${amount}원, 현재 총 ${currentPot}원`,
    playerId,
    { action, amount, currentPot }
  );
}

/**
 * 카드 관련 액션 로그
 */
export function logCardAction(gameId: string, playerId: string, action: string, cards: number[]) {
  return logInfo(
    gameId,
    'cards',
    `카드 액션: ${playerId}의 ${action}`,
    playerId,
    { action, cards }
  );
}

/**
 * 타임아웃 로그
 */
export function logTimeout(gameId: string, playerId: string, action: string) {
  return logWarning(
    gameId,
    'player',
    `타임아웃: ${playerId}의 ${action} 시간 초과`,
    playerId,
    { action }
  );
}

/**
 * 시스템 에러 로그
 */
export function logSystemError(gameId: string, operation: string, error: any) {
  return logError(
    gameId,
    'system',
    `시스템 오류: ${operation} 중 오류 발생`,
    undefined,
    { error: error.message || String(error), stack: error.stack }
  );
}
