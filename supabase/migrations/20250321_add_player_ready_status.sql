-- 플레이어 준비 상태 필드 추가
ALTER TABLE players ADD COLUMN is_ready BOOLEAN DEFAULT FALSE;
