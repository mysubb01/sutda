-- 방(Room) 테이블
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  mode INTEGER NOT NULL CHECK (mode IN (2, 3)), -- 2: 2장 모드, 3: 3장 모드
  entry_fee INTEGER NOT NULL DEFAULT 10000, -- 참가비
  max_players INTEGER NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  betting_option VARCHAR(50) DEFAULT 'standard' -- 'standard': 표준, 'step_by_step': 단계별(1장-베팅-1장-베팅)
);

-- 게임 테이블 (개별 게임 라운드)
ALTER TABLE games ADD COLUMN room_id UUID REFERENCES rooms(id);
ALTER TABLE games ADD COLUMN total_pot INTEGER DEFAULT 0; -- 총 판돈
ALTER TABLE games ADD COLUMN betting_round INTEGER DEFAULT 1; -- 현재 베팅 라운드 (3장 모드에서 사용)

-- 플레이어 테이블 변경
ALTER TABLE players ADD COLUMN room_id UUID REFERENCES rooms(id);
ALTER TABLE players ADD COLUMN open_card INTEGER; -- 3장 모드에서 공개된 카드
ALTER TABLE players ADD COLUMN selected_cards INTEGER[]; -- 3장 모드에서 최종 선택한 2장

-- 게임 액션 테이블 변경
ALTER TABLE game_actions ADD COLUMN betting_round INTEGER; -- 베팅 라운드

-- 게임 로그 테이블
CREATE TABLE IF NOT EXISTS game_logs (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 게임 로그 인덱스
CREATE INDEX IF NOT EXISTS game_logs_game_id_idx ON game_logs(game_id);
CREATE INDEX IF NOT EXISTS game_logs_player_id_idx ON game_logs(player_id);
CREATE INDEX IF NOT EXISTS game_logs_level_idx ON game_logs(level);
CREATE INDEX IF NOT EXISTS game_logs_category_idx ON game_logs(category);
CREATE INDEX IF NOT EXISTS game_logs_timestamp_idx ON game_logs(timestamp);
