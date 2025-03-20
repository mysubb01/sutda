-- games 테이블 생성
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
  current_turn UUID,
  betting_value INTEGER DEFAULT 0,
  winner UUID
);

-- players 테이블 생성
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  cards JSONB DEFAULT '[]'::jsonb,
  is_die BOOLEAN DEFAULT false,
  balance INTEGER DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- game_actions 테이블 생성
CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) NOT NULL,
  player_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('join', 'bet', 'call', 'die', 'check')),
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- messages 테이블 생성
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_game_actions_game_id ON game_actions(game_id);
CREATE INDEX idx_messages_game_id ON messages(game_id);

-- 실시간 업데이트를 위한 발행/구독 설정
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 정책 (모든 사용자)
CREATE POLICY "모든 사용자가 게임을 볼 수 있습니다" ON games
  FOR SELECT USING (true);

CREATE POLICY "모든 사용자가 플레이어를 볼 수 있습니다" ON players
  FOR SELECT USING (true);

CREATE POLICY "모든 사용자가 게임 액션을 볼 수 있습니다" ON game_actions
  FOR SELECT USING (true);

CREATE POLICY "모든 사용자가 메시지를 볼 수 있습니다" ON messages
  FOR SELECT USING (true);

-- 쓰기 권한 정책 (인증된 사용자 또는 익명 사용자)
CREATE POLICY "사용자가 게임을 생성할 수 있습니다" ON games
  FOR INSERT WITH CHECK (true);

CREATE POLICY "사용자가 게임을 업데이트할 수 있습니다" ON games
  FOR UPDATE USING (true);

CREATE POLICY "사용자가 플레이어를 추가할 수 있습니다" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "사용자가 플레이어 정보를 업데이트할 수 있습니다" ON players
  FOR UPDATE USING (true);

CREATE POLICY "사용자가 게임 액션을 추가할 수 있습니다" ON game_actions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "사용자가 메시지를 추가할 수 있습니다" ON messages
  FOR INSERT WITH CHECK (true);

-- 게임 테이블 변경 감지를 위한 함수 및 트리거 설정
CREATE OR REPLACE FUNCTION handle_game_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TRIGGER game_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION handle_game_change(); 