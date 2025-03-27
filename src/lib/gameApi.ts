/**
 * 게임 API - 새 모듈에서 기능을 다시 내보내는 파일
 * 코드베이스 리팩토링의 일환으로 모든 기능이 /lib/api/ 디렉토리의 모듈로 이동되었습니다.
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 */

// API 모듈에서 모든 기능 다시 내보내기
export * from './api/gameRoomApi';
export * from './api/gameLifecycleApi';
export * from './api/gameBettingApi';
export * from './api/gameCardApi';
export * from './api/messageApi';
export * from './api/seatApi';
