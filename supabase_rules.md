# Supabase 데이터베이스 설정

## 테이블 구조

```sql
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
```

## RLS 정책

```sql
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
```

## 실시간 업데이트 트리거 설정

```sql
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
```

## Supabase 실시간 활성화 방법

1. Supabase 대시보드의 `Database` > `Replication` 메뉴로 이동
2. `Realtime` 섹션에서 모든 테이블(games, players, game_actions, messages)이 활성화되어 있는지 확인
3. 테이블이 보이지 않으면 `Add Table` 버튼을 클릭하여 해당 테이블 추가

## 주의사항

1. user_id 필드는 필수 입력 항목입니다. 플레이어 생성 시 반드시 포함해야 합니다.
2. Supabase 프로젝트 설정에서 Realtime 기능이 활성화되어 있어야 합니다.
3. 환경 변수가 정확히 설정되어 있어야 합니다:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY 