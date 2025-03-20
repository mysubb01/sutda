-- players 테이블에 seat_index 필드 추가
ALTER TABLE public.players
ADD COLUMN seat_index INTEGER DEFAULT NULL;
