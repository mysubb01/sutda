-- players 테이블에 last_heartbeat 필드 추가 마이그레이션
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE;

-- 기존 사용자들의 last_heartbeat 값 현재 시간으로 초기화
UPDATE public.players
SET last_heartbeat = NOW()
WHERE last_heartbeat IS NULL;
