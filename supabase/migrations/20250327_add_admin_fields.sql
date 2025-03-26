-- 플레이어 테이블에 채팅 금지 상태 필드 추가
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;

-- 방 테이블에 기본 베팅액 필드 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS default_base_bet INTEGER DEFAULT 10;

-- 게임 시작 시 기본 베팅액 설정을 방의 default_base_bet으로 초기화하는 트리거 함수
CREATE OR REPLACE FUNCTION set_game_base_bet()
RETURNS TRIGGER AS $$
BEGIN
    NEW.base_bet = (SELECT default_base_bet FROM rooms WHERE id = NEW.room_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 게임 생성 시 트리거 적용 (room_id가 있는 경우에만)
DROP TRIGGER IF EXISTS set_game_base_bet_trigger ON games;
CREATE TRIGGER set_game_base_bet_trigger
BEFORE INSERT ON games
FOR EACH ROW
WHEN (NEW.room_id IS NOT NULL)
EXECUTE FUNCTION set_game_base_bet();
