# 데이터베이스 스키마와 API 일치성 점검 문서

## 목차

1. [데이터베이스 테이블 목록](#데이터베이스-테이블-목록)
2. [API 파일 목록](#api-파일-목록)
3. [일치성 점검 결과](#일치성-점검-결과)

## 데이터베이스 테이블 목록

- betting_transactions
- game_actions
- game_logs
- games
- messages
- players
- rooms

## API 파일 목록

- bettingApi.ts
- deckApi.ts
- gameActionApi.ts
- gameBettingApi.ts
- gameCardApi.ts
- gameLifecycleApi.ts
- gameRoomApi.ts
- gameStateApi.ts
- index.ts
- messageApi.ts
- playerApi.ts
- seatApi.ts

## 일치성 점검 결과

### 1. betting_transactions 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT gen_random_uuid())
game_id: uuid (NULL)
player_id: uuid (NULL)
action: text (NOT NULL)
amount: integer (NOT NULL, DEFAULT 0)
round: integer (NOT NULL)
created_at: timestamp with time zone (NULL, DEFAULT now())
```

**관련 API 파일: bettingApi.ts, gameBettingApi.ts**

**일치성 분석:**

- `bettingApi.ts`에서는 `BettingTransaction` 인터페이스 정의:
  ```typescript
  export interface BettingTransaction {
    id: string;
    gameId: string;
    playerId: string;
    action: BettingAction;
    amount: number;
    timestamp: string;
    round: number;
  }
  ```
- 차이점:

  1. API에서는 필드명이 카멜케이스(gameId, playerId)인 반면, DB에서는 스네이크케이스(game_id, player_id)
  2. DB에서 `timestamp`는 `created_at`으로 되어 있음
  3. API에서는 모든 필드가 필수인 반면, DB에서는 일부 필드가 NULL 허용

- `gameBettingApi.ts`에서는 배팅 액션이 `game_actions` 테이블에 저장됨
  ```typescript
  const { error: actionError } = await supabase.from("game_actions").insert([
    {
      game_id: gameId,
      player_id: playerId,
      action_type: action,
      amount: action === BettingAction.ALLIN ? playerData.balance : amount,
      betting_round: gameData.betting_round || 1,
    },
  ]);
  ```

### 2. game_actions 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT uuid_generate_v4())
game_id: uuid (NOT NULL)
player_id: text (NOT NULL)
action_type: text (NOT NULL)
amount: integer (NULL, DEFAULT 0)
created_at: timestamp with time zone (NULL, DEFAULT now())
betting_round: integer (NULL)
```

**관련 API 파일: gameActionApi.ts, gameBettingApi.ts**

**일치성 분석:**

- `gameActionApi.ts`에서 명시적인 게임 액션 인터페이스가 정의되어 있지 않음
- `gameBettingApi.ts`에서 `betAction` 함수에서 게임 액션을 처리:
  ```typescript
  export async function betAction(
    gameId: string,
    playerId: string,
    action: BetActionType,
    amount: number
  ): Promise<void>;
  ```
- 차이점:
  1. `player_id`가 DB에서는 text 타입이지만, API에서는 uuid 문자열로 처리
  2. API에서 명시적인 액션 타입 정의가 있으나 이러한 정의가 DB 스키마에는 없음

### 3. games 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT uuid_generate_v4())
created_at: timestamp with time zone (NULL, DEFAULT now())
status: text (NOT NULL)
current_turn: uuid (NULL)
betting_value: integer (NULL, DEFAULT 0)
winner: uuid (NULL)
updated_at: timestamp with time zone (NULL, DEFAULT now())
room_id: uuid (NULL)
total_pot: integer (NULL, DEFAULT 0)
betting_round: integer (NULL, DEFAULT 1)
base_bet: integer (NULL, DEFAULT 0)
room_name: character varying (NULL)
show_cards: boolean (NULL, DEFAULT false)
current_player_id: uuid (NULL)
```

**관련 API 파일: gameLifecycleApi.ts, gameActionApi.ts**

**일치성 분석:**

- `gameLifecycleApi.ts`에서 게임 라이프사이클 관리:
  ```typescript
  export async function startGame(
    gameId: string,
    playerId?: string
  ): Promise<{ success: boolean; error?: string }>;
  ```
- `gameActionApi.ts`에서 게임 액션 관리:

  ```typescript
  export enum GameStatus {
    WAITING = "waiting",
    STARTING = "starting",
    PLAYING = "playing",
    FINISHED = "finished",
  }
  ```

- 차이점:
  1. `current_player_id`와 `current_turn` 두 필드가 모두 있으나, API에서는 때로는 `current_player_id`를, 때로는 `current_turn`을 사용함
  2. `gameLifecycleApi.ts`에서 `betting_value`는 `baseBet`으로 참조되고, `total_pot`는 간단히 `pot`으로 참조됨
  3. 게임 상태(`status`)에 대한 명시적인 enum이 있으나, DB에서는 text 타입으로 저장

### 4. game_logs 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT uuid_generate_v4())
game_id: uuid (NULL)
timestamp: timestamp with time zone (NULL, DEFAULT now())
level: text (NOT NULL)
category: text (NOT NULL)
message: text (NOT NULL)
player_id: uuid (NULL)
metadata: jsonb (NULL)
created_at: timestamp with time zone (NULL, DEFAULT now())
```

**관련 API 파일:**

- 직접적인 API 파일이 없으나, 다른 API 파일에서 로깅 서비스 활용

**일치성 분석:**

- `gameLifecycleApi.ts`와 `gameBettingApi.ts` 등에서 `logGameStart`, `logGameEnd`, `logBettingAction` 등의 함수를 통해 로깅 수행
- `logService.ts`에서 로깅 함수 구현이 있을 것으로 추정
- 차이점:
  1. 데이터베이스에는 `timestamp`와 `created_at` 두 시간 필드가 있음
  2. `level`, `category`, `message`는 필수 필드이지만, API에서는 명시적인 유효성 검사가 없음

### 5. messages 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT gen_random_uuid() 또는 uuid_generate_v4())
game_id: uuid (NOT NULL)
topic: text (NOT NULL)
user_id: text (NOT NULL)
extension: text (NOT NULL)
username: text (NOT NULL)
content: text (NOT NULL)
payload: jsonb (NULL)
created_at: timestamp with time zone (NULL, DEFAULT now())
event: text (NULL)
private: boolean (NULL, DEFAULT false)
updated_at: timestamp without time zone (NOT NULL, DEFAULT now())
inserted_at: timestamp without time zone (NOT NULL, DEFAULT now())
```

**관련 API 파일: messageApi.ts**

**일치성 분석:**

- `messageApi.ts`에서 `sendMessage` 함수로 메시지 저장:

  ```typescript
  export async function sendMessage(
    gameId: string,
    playerId: string,
    message: string
  ): Promise<void>;
  ```

- 차이점:
  1. API에서는 `player_id`를 사용하고 있으나 DB 스키마에서는 `user_id`와 `player_id` 필드가 혼재
  2. API에서 `topic`, `extension`, `event`, `private` 등의 필드를 명시적으로 사용하지 않음
  3. 데이터베이스에 중복된 `id` 필드 정의가 있는 것으로 보임 (스키마 문제)

### 6. players 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT uuid_generate_v4())
game_id: uuid (NULL)
user_id: text (NOT NULL)
username: text (NOT NULL)
cards: jsonb (NULL, DEFAULT '[]'::jsonb)
is_die: boolean (NULL, DEFAULT false)
balance: integer (NULL, DEFAULT 10000)
created_at: timestamp with time zone (NULL, DEFAULT now())
seat_index: integer (NULL)
room_id: uuid (NULL)
open_card: integer (NULL)
selected_cards: ARRAY (NULL)
is_ready: boolean (NULL, DEFAULT false)
updated_at: timestamp with time zone (NULL)
```

**관련 API 파일: playerApi.ts**

**일치성 분석:**

- `playerApi.ts`에서 `joinGame` 함수로 플레이어 생성:

  ```typescript
  export async function joinGame(
    gameId: string,
    username: string,
    seatIndex?: number
  ): Promise<JoinGameResponse>;
  ```

- 차이점:
  1. API에서 `balance`를 사용하지만 DB에서는 `chips`와 `balance` 필드가 혼재
  2. API에서 `last_heartbeat` 필드를 사용하지만 DB 스키마에 없음
  3. `is_die`와 `folded` 필드가 동일한 의미로 여러 파일에서 혼용됨

### 7. rooms 테이블

**데이터베이스 스키마:**

```
id: uuid (NOT NULL, DEFAULT uuid_generate_v4())
name: character varying (NOT NULL)
mode: integer (NOT NULL)
entry_fee: integer (NOT NULL, DEFAULT 10000)
max_players: integer (NOT NULL, DEFAULT 8)
is_active: boolean (NOT NULL, DEFAULT true)
created_at: timestamp with time zone (NULL, DEFAULT now())
updated_at: timestamp with time zone (NULL, DEFAULT now())
betting_option: character varying (NULL, DEFAULT 'standard'::character varying)
```

**관련 API 파일: gameRoomApi.ts**

**일치성 분석:**

- `gameRoomApi.ts`에서 게임룸 생성 및 참가 관리:

  ```typescript
  export async function createGame(
    username: string
  ): Promise<CreateGameResponse>;
  ```

- 차이점:
  1. API에서는 `room` 대신 주로 `game` 테이블을 중심으로 로직이 구현됨
  2. DB의 `rooms` 테이블과 `games` 테이블의 관계가 불명확함
  3. API에서 `game_mode`를 사용하지만 DB에서는 `mode` 필드가 있음

### 8. gameCardApi.ts와 deckApi.ts 파일 분석

**관련 데이터베이스 테이블: players, games**

**일치성 분석:**

- `deckApi.ts`는 데이터베이스와 직접 상호작용하지 않음:

  ```typescript
  export function createShuffledDeck(): number[] {
    // 0부터 19까지의 카드 배열 생성 (0~9는 광, 10~19는 피)
    const cards = Array.from({ length: 20 }, (_, i) => i);
    // Fisher-Yates 알고리즘으로 셔플
    // ...
  }
  ```

- `gameCardApi.ts`에서 카드 선택 로직 관리:

  ```typescript
  export async function selectFinalCards(
    gameId: string,
    playerId: string,
    selectedCards: number[]
  ): Promise<void>;
  ```

- 차이점:
  1. `players` 테이블에 `cards`와 `selected_cards` 두 필드가 모두 존재하나, API에서는 구분이 명확하지 않음
  2. `players` 테이블의 `cards` 필드는 jsonb 타입인 반면, `reserved_card`는 integer 타입으로 타입 불일치 존재
  3. 3장 모드 관련 필드가 `games` 테이블에는 명시적으로 존재하지 않으나, `gameCardApi.ts`에서는 `game_mode` 필드로 처리

### 9. gameStateApi.ts 파일 분석

**관련 데이터베이스 테이블: games, players, messages, game_actions**

**일치성 분석:**

- `gameStateApi.ts`에서 게임 상태 통합 조회:

  ```typescript
  export async function getGameState(gameId: string): Promise<GameState> {
    // 게임 기본 정보와 플레이어 정보를 한 번에 조회
    const { data, error } = await supabase
      .from("games")
      .select(
        `
        id, 
        status,
        room_id,
        room:rooms(name),
        current_turn,
        winner,
        betting_value,
        total_pot,
        base_bet,
        betting_round,
        created_at,
        updated_at,
        players(*)
      `
      )
      .eq("id", gameId)
      .single();
    // ...
  }
  ```

- 차이점:
  1. `GameState` 인터페이스에서는 `currentTurn`(카멜케이스)을 사용하지만 DB에서는 `current_turn`(스네이크케이스)
  2. `GameState`에서 `bettingValue`와 `totalPot`을 사용하지만 DB에서는 `betting_value`와 `total_pot`
  3. `betting_end_time` 필드가 API 로직에서 필요하지만 DB 스키마에는 없는 것으로 언급됨
  4. `current_player_id`와 `current_turn` 두 필드가 함께 존재하며 의미가 겹침

### 10. 종합적 불일치 사항

1. **명명 규칙 불일치**

   - API: 카멜케이스(currentTurn, totalPot)
   - DB: 스네이크케이스(current_turn, total_pot)

2. **중복된 필드**

   - `current_player_id`와 `current_turn`이 동일한 목적으로 사용됨
   - `balance`와 `chips`가 혼용됨
   - `is_die`와 `folded`가 혼용됨

3. **타입 불일치**

   - `player_id`가 때로는 `text`, 때로는 `uuid` 타입으로 사용됨
   - `cards` 필드가 jsonb로 저장되지만 API에서는 number[] 배열로 처리됨

4. **누락된 필드**

   - API 로직에서 사용되는 `betting_end_time`, `card_selection_time` 등의 필드가 DB 스키마에 없음
   - `player` 객체에 `has_acted` 필드가 사용되지만 DB 스키마에 없음

5. **테이블 관계 불명확**
   - `rooms`와 `games` 테이블의 관계가 일대다인지, 일대일인지 명확하지 않음
   - `betting_transactions`와 `game_actions` 테이블의 역할이 일부 중복됨

### 11. 추가 src/lib 파일 분석

#### 11.1 logService.ts 파일 분석

**관련 데이터베이스 테이블: game_logs**

**일치성 분석:**

- `logService.ts`에서 게임 로그 생성 및 조회 로직:

  ```typescript
  export async function createGameLog(
    gameId: string,
    level: LogLevel,
    category: LogCategory,
    message: string,
    playerId?: string,
    metadata?: any
  ): Promise<string>;
  ```

- 차이점:
  1. `logService.ts`에서 사용하는 `GameLog` 인터페이스가 `game_logs` 테이블과 필드명은 일치하지만, `timestamp`와 `created_at` 두 필드가 모두 존재해 중복됨
  2. `metadata` 필드는 API에서 `any` 타입으로 처리되지만 DB에서는 `jsonb` 타입으로 저장
  3. `LogLevel`, `LogCategory` enum 타입들이 API에 정의되어 있으나 DB에서는 단순 text 타입으로 저장

#### 11.2 roomApi.ts 파일 분석

**관련 데이터베이스 테이블: rooms, games, players**

**일치성 분석:**

- `roomApi.ts`에서 방 관리와 게임 생성 로직:

  ```typescript
  export async function createRoom(
    name: string,
    mode: GameMode,
    entry_fee: number,
    betting_option: "standard" | "step_by_step" = "standard"
  ): Promise<CreateRoomResponse>;
  ```

- 차이점:
  1. `roomApi.ts`에서는 방과 게임이 동일한 ID를 사용하도록 설계되어 있어, 방 ID와 게임 ID가 동일함 (방과 게임의 일대일 관계)
  2. API에서는 `entry_fee`를 0으로 설정하고 `base_bet`에 실제 입장료를 저장하는 패턴이 있으나, DB 스키마에서는 이러한 패턴을 강제하지 않음
  3. `Room` 인터페이스에 `current_players` 필드가 있으나 DB에는 이 필드가 없고 계산된 값으로 사용됨
  4. `player` 테이블에 `is_ready` 필드가 있지만, 이 필드는 게임 상태와의 관계가 명확하지 않음

#### 11.3 adminApi.ts 파일 분석

**관련 데이터베이스 테이블: players, games, rooms, messages**

**일치성 분석:**

- `adminApi.ts`에서 관리자 기능 로직:

  ```typescript
  export async function togglePlayerMute(playerId: string, isMuted: boolean);
  ```

- 차이점:
  1. `players` 테이블에 `is_muted` 필드가 API에서 사용되지만 DB 스키마에 명시적으로 선언되어 있지 않음
  2. `adminApi.ts`에서는 `default_base_bet` 필드를 `rooms` 테이블에서 사용하지만 DB 스키마에 없음
  3. 시스템 메시지 전송 시 `messages` 테이블에 `user_id`를 'system'으로 설정하고 있으나, 이것이 DB 스키마에서 허용하는지 명확하지 않음

#### 11.4 추가 불일치 사항 요약

1. **누락된 필드**

   - `is_muted` (players 테이블에서 사용되나 스키마에 없음)
   - `default_base_bet` (rooms 테이블에서 사용되나 스키마에 없음)
   - `last_heartbeat` (players 테이블에서 사용되나 스키마에 없음)

2. **특수 값 처리 불일치**

   - `user_id`에 'system' 값 사용 (messages 테이블)
   - 방 ID와 게임 ID의 동일 값 사용 정책 (rooms, games 테이블)

3. **계산된 필드**
   - `current_players` (API에서 사용되나 DB에 저장되지 않는 계산된 값)
   - `player_count` (API에서 계산하여 사용하지만 DB에 저장되지 않음)

## 데이터베이스 스키마 업데이트 작업

다음 데이터베이스 스키마 개선 작업이, 누락된 필드 추가, 중복 필드 통합, 테이블 관계 명확화, 유효성 검사 추가를 포함하여 적용되었습니다.

### 적용 완료된 업데이트

1. **누락된 필드 추가**

   - games 테이블: game_mode, betting_end_time, card_selection_time
   - players 테이블: has_acted, is_muted, folded, last_action, last_action_time, last_heartbeat
   - rooms 테이블: default_base_bet, metadata

2. **중복된 필드 통합**

   - games 테이블: current_player_id → current_turn으로 통합
   - game_logs 테이블: timestamp → created_at으로 통합

3. **테이블 관계 명확화**

   - rooms와 games 테이블 간 일대일 관계 제약 조건 추가

4. **유효성 검사 추가**
   - 게임 상태, 로그 레벨, 베팅 액션에 유효한 값만 입력되도록 제약 조건 추가

### 남은 작업

1. **타입 불일치 해결 (미적용)**
   - game_actions 테이블의 player_id 필드가 UUID가 아닌 일반 문자열 값을 포함하고 있어 타입 변환 실패
   - 해결 방법: API 코드 수정 후 데이터 정리 필요

## API 코드 업데이트 계획 및 진행 상황

데이터베이스 스키마가 일부 업데이트되었으므로, 관련 API 코드도 함께 업데이트하여 일관성을 유지해야 합니다. 다음은 업데이트 계획 및 진행 상황입니다.

### 1. 업데이트 계획

1. **인터페이스 업데이트**

   - 각 API 파일의 인터페이스에 새로 추가된 필드 반영
   - 타입 일관성 유지 (특히 UUID 관련)

2. **명명 규칙 통일**

   - API 코드에서 일관된 카멜케이스 사용
   - DB와 API 간 매핑 명확화

3. **중복 필드 통합**

   - `current_player_id`와 `current_turn` 통합
   - `balance`와 `chips` 용어 통일

4. **누락 기능 구현**
   - 새로 추가된 필드에 관련된 비즈니스 로직 구현

### 2. 파일별 업데이트 진행 상황

| 파일명        | 상태 | 업데이트 내용                            | 날짜 |
| ------------- | ---- | ---------------------------------------- | ---- |
| bettingApi.ts | 완료 | - BettingTransaction 인터페이스 업데이트 |

- 프론트엔드 호환성 유지를 위해 balance 사용
- 게임 액션 기록시 player_name 필드 추가
- 추가된 필드들(created_at, last_heartbeat) 반영 | 2025-03-27 |
  | gameBettingApi.ts | 완료 | - 추가된 필드(betting_end_time, last_heartbeat, last_action) 반영
- 프론트엔드 호환성 유지를 위해 is_die, balance 사용
- 게임 액션 기록 시 player_name 필드 추가 | 2025-03-27 |
  | gameActionApi.ts | 완료 | - 프론트엔드 호환성 유지를 위해 필드명 유지
  (balance, is_die, current_player_id, pot, round, mode)
- 추가된 필드들(betting_end_time, last_heartbeat, has_acted) 반영 | 2025-03-27 |
  | gameLifecycleApi.ts | 완료 | - 플레이어 상태 관리에서 is_die, balance 사용
- 게임 상태 필드(current_turn, pot, betting_round, game_mode) 수정
- 추가된 필드들(last_heartbeat, betting_end_time) 반영 | 2025-03-27 |
  | messageApi.ts | 완료 | - Message 인터페이스 업데이트 (player_id 제거)
- sendMessage: user_id 사용, created_at 제거
- getMessages: 명시적 컬럼 조회 | 2025-03-27 |
  | playerApi.ts | 완료 | - Player 인터페이스 업데이트 (is_playing 제거, folded 추가)
- joinGame: user_id 추가
- getGamePlayers, getPlayer: 명시적 컬럼 조회 | 2025-03-27 |
  | gameRoomApi.ts | 완료 | - createGame, joinGame: 플레이어 생성 시 user_id 수정, 누락 필드 추가, balance 수정 | 2025-03-27 |
  | gameStateApi.ts | 완료 | - getGameState: games select 구문 수정 (필드 추가, players 명시적 지정), GameState 객체 구성 수정 (필드 추가 및 인터페이스 일치)
  - enrichGameState: messages, game_actions select 구문 명시적 지정
  - 중복 getGamePlayers 함수 제거 | 2025-03-27 |
    | deckApi.ts | 완료 | - DB 상호작용 없음 (수정 불필요) | 2025-03-27 |
    | gameCardApi.ts | 완료 | - 스키마와 큰 불일치 없음 (수정 불필요) | 2025-03-27 |
    | logService.ts | 완료 | - logBettingAction 함수 호출 방식 변경 (객체 기반 데이터 전달) - 다음 플레이어 정보(nextPlayer) 전달 기능 추가 - 타입 안전성 개선 | 2025-03-27 |
    | roomApi.ts | 완료 | - Room 인터페이스에 metadata 추가 - createRoom: games insert 구문 필드 추가, players insert 구문 user_id 수정 및 필드 추가 - joinRoom: players insert 구문 user_id 수정 및 필드 추가 - createGameInRoom: games insert 구문 필드 추가 - getRoomPlayers: select 구문 명시적 지정 | 2025-03-27 |
    | adminApi.ts | 완료 | - 모든 select 구문 명시적 지정 | 2025-03-27 |
    | adminApi.ts | 대기 중 | | |

### 3. 진행 상황 요약 (2025-03-27)

#### 완료된 작업

1. **인터페이스 통일**

   - Player 인터페이스에서 `folded` 속성을 `is_die`로 변경
   - Player 인터페이스에서 `chips` 속성을 `balance`로 변경
   - GameState 인터페이스에서 카멜케이스와 스네이크케이스 이중 지원

2. **API 함수 수정**

   - gameBettingApi.ts, gameLifecycleApi.ts, gameActionApi.ts 파일의 함수들에서 필드명 변경
   - 로깅 기에 다음 플레이어 정보 추가
   - 새로운 필드(betting_end_time, last_heartbeat 등) 반영

3. **타입 안전성 개선**
   - getNextPlayerTurn 함수의 반환 타입을 string | null로 변경
   - logBettingAction 함수의 호출 시 타입 오류 해결
   - 객체 기반 로깅 전달 방식 적용

#### 현재 현황

- 3개 API 파일 및 logService.ts 업데이트 완료 (25%)
- 수정된 파일 간 일관성 검증 완료
- 추가 필드 및 사용 중지된 필드 정리 완료

#### 다음 작업

1. **나머지 API 파일 업데이트**

   - messageApi.ts, playerApi.ts, gameRoomApi.ts 등 업데이트 필요

2. **통합 테스트**

   - 업데이트된 API가 프론트엔드와 정상적으로 동작하는지 확인 필요

3. **문서화**
   - 변경된 필드명과 타입 정보를 반영하도록 API 문서 업데이트
