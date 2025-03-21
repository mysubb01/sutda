-- 플레이어 테이블의 game_id 컬럼을 NULL 허용으로 변경
ALTER TABLE players ALTER COLUMN game_id DROP NOT NULL;
