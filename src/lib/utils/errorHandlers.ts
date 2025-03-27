/**
 * 에러 타입 정의
 */
export enum ErrorType {
  NOT_FOUND = 'not_found',
  DATABASE = 'database_error',
  VALIDATION = 'validation_error',
  UNAUTHORIZED = 'unauthorized',
  INVALID_STATE = 'invalid_state',
  GAME_FULL = 'game_full',
  GAME_CLOSED = 'game_closed',
  SERVER_ERROR = 'server_error',
  UNAVAILABLE = 'service_unavailable'
}

/**
 * 게임 관련 에러 클래스
 */
export class GameError extends Error {
  type: ErrorType;
  details?: any;

  constructor(message: string, type: ErrorType, details?: any) {
    super(message);
    this.name = 'GameError';
    this.type = type;
    this.details = details;
  }
}

/**
 * 데이터베이스 에러 처리
 * 
 * @param error Supabase 에러 객체
 * @param context 발생 컨텍스트
 * @returns GameError 객체
 */
export function handleDatabaseError(error: any, context: string): GameError {
  console.error(`[${context}] Database error:`, error);
  
  const message = error?.message || '데이터베이스 오류가 발생했습니다.';
  return new GameError(message, ErrorType.DATABASE, { 
    originalError: error, 
    context 
  });
}

/**
 * 리소스 찾을 수 없음 에러 처리
 * 
 * @param resourceType 리소스 타입 (예: 'game', 'player')
 * @param resourceId 리소스 ID
 * @param originalError 원본 에러 (선택 사항)
 * @returns GameError 객체
 */
export function handleResourceNotFoundError(
  resourceType: string,
  resourceId: string | number,
  originalError?: any
): GameError {
  const message = `${resourceType} ${resourceId}를 찾을 수 없습니다.`;
  console.error(`[Not Found] ${message}`, originalError || '');
  
  return new GameError(message, ErrorType.NOT_FOUND, { 
    resourceType, 
    resourceId,
    originalError 
  });
}

/**
 * 게임 일반 에러 처리
 * 
 * @param originalError 원본 에러 (선택 사항)
 * @param type 에러 타입
 * @param message 에러 메시지
 * @param details 추가 세부 정보 (선택 사항)
 * @returns GameError 객체
 */
export function handleGameError(
  originalError: any, 
  type: ErrorType, 
  message: string,
  details?: any
): GameError {
  console.error(`[GameError:${type}] ${message}`, originalError || '');
  
  return new GameError(message, type, {
    originalError,
    ...details
  });
}
