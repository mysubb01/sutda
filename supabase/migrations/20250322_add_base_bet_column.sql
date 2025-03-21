-- Add base_bet and room_name columns to games table
-- games 테이블에 필요한 컬럼 추가
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_name VARCHAR(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS base_bet INTEGER DEFAULT 0;

-- 기존 게임 데이터 처리 
-- 이미 존재하는 레코드에 대해 room_id 기반으로 room_name 설정 (예시)
UPDATE games g
SET room_name = r.name
FROM rooms r
WHERE g.room_id = r.id AND g.room_name IS NULL;
