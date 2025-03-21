-- base_bet 컬럼 추가
ALTER TABLE games ADD COLUMN base_bet INTEGER DEFAULT 1000;  -- 기본 배팅액
ALTER TABLE games ADD COLUMN room_name VARCHAR(255);  -- 방 이름 추가

-- 기존 games 테이블 레코드에 기본값 설정
UPDATE games SET base_bet = 1000 WHERE base_bet IS NULL;
