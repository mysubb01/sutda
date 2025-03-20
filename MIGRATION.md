# Socket.io에서 Supabase로의 마이그레이션 가이드

이 문서는 기존 Socket.io 기반의 섯다 게임 애플리케이션을 Supabase를 활용한 실시간 서비스로 리팩토링한 방법을 설명합니다.

## 마이그레이션 개요

### 기존 아키텍처 (Socket.io)

기존 애플리케이션은 다음과 같은 아키텍처를 사용했습니다:

- **백엔드**: Express.js 서버
- **실시간 통신**: Socket.io
- **데이터 저장**: 서버 메모리 (인메모리 변수)
- **클라이언트**: HTML + vanilla JavaScript

### 새 아키텍처 (Supabase)

리팩토링된 애플리케이션은 다음 아키텍처를 사용합니다:

- **백엔드**: Supabase (PostgreSQL 기반)
- **실시간 통신**: Supabase Realtime
- **데이터 저장**: Supabase Database
- **클라이언트**: Next.js + TypeScript + React

## 주요 변경 사항

### 1. 데이터 모델링

#### Socket.io 접근 방식
- 서버 메모리에 게임 상태 저장
- 게임 상태 변경 시 전체 상태를 클라이언트에 전송

```javascript
// 기존 방식 (Socket.io)
var users = [];
var connections = [];
var bettingValue = 0;
var socketId = [];

// Socket.io 이벤트 핸들러
io.on('connection', function(socket) {
  socket.on('send message', function(data) {
    io.sockets.emit('new message', {
      msg: data,
      user: socket.username
    });
  });
});
```

#### Supabase 접근 방식
- PostgreSQL 테이블에 구조화된 데이터 저장
- 테이블 변경 시 Realtime 기능으로 업데이트 구독

```typescript
// 새 방식 (Supabase)
interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  currentTurn: string | null;
  bettingValue: number;
  winner: string | null;
}

// Supabase 실시간 구독
const channel = supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'games',
    filter: `id=eq.${gameId}`
  }, () => {
    onGameUpdate();
  })
  .subscribe();
```

### 2. 실시간 통신

#### Socket.io 접근 방식
- 사용자 정의 이벤트 발신 및 수신
- 양방향 통신 (클라이언트 <-> 서버)
- 룸 개념으로 그룹 통신

```javascript
// 서버 측
socket.on('bet', function(data) {
  // 베팅 처리
  bettingValue += data.amount;
  
  // 모든 클라이언트에 업데이트 전송
  io.to(data.gameRoom).emit('betting update', {
    player: socket.username,
    amount: data.amount,
    totalBet: bettingValue
  });
});

// 클라이언트 측
socket.emit('bet', {
  gameRoom: currentRoom,
  amount: betAmount
});

socket.on('betting update', function(data) {
  updateBettingUI(data);
});
```

#### Supabase 접근 방식
- 데이터베이스 변경 구독
- 변경 감지 시 클라이언트 코드 실행
- 필터를 통한 특정 데이터 구독

```typescript
// 클라이언트 측
// 게임 액션 API
async function placeBet(gameId: string, playerId: string, amount: number) {
  // 데이터베이스 업데이트
  await supabase
    .from('game_actions')
    .insert({
      game_id: gameId,
      player_id: playerId,
      action_type: 'bet',
      amount
    });
  
  // 게임 상태 업데이트
  await supabase
    .from('games')
    .update({ betting_value: bettingValue + amount })
    .eq('id', gameId);
}

// 실시간 구독
const subscription = supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'games',
    filter: `id=eq.${gameId}`
  }, () => {
    fetchGameState(); // 게임 상태 다시 불러오기
  })
  .subscribe();
```

### 3. 인증 방식

#### Socket.io 접근 방식
- 소켓 연결 시 사용자 이름 등록
- 세션 기반 인증

#### Supabase 접근 방식
- Supabase Auth 활용 가능 (현재 구현에서는 간소화)
- 사용자 ID 및 사용자 이름 기반 식별

## 마이그레이션 이점

1. **타입 안전성**: TypeScript를 사용하여 타입 안전성 확보
2. **확장성**: Supabase의 확장 가능한 인프라 활용
3. **유지보수성**: 구조화된 데이터와 모듈화된 코드로 유지보수 향상
4. **보안**: Supabase의 Row Level Security를 통한 보안 강화
5. **개발 경험**: React 및 Next.js를 통한 향상된 개발 경험

## 마이그레이션 도전 과제

1. **실시간 통신 패러다임 변화**: 
   - Socket.io의 명령형 이벤트 기반 방식에서 
   - Supabase의 선언적 구독 기반 방식으로 전환

2. **상태 관리**:
   - 서버 메모리 상태에서 
   - 데이터베이스 상태로 전환

3. **라우팅 및 사용자 경험**:
   - 단일 페이지 애플리케이션에서
   - Next.js 라우팅 시스템으로 전환

## 결론

Socket.io에서 Supabase로의 마이그레이션은 코드베이스의 품질, 확장성 및 유지보수성을 향상시켰습니다. 또한 TypeScript와 React를 도입하여 개발 경험이 크게 개선되었습니다. 하지만 새로운 패러다임으로의 전환은 학습 곡선을 수반하며, 특히 실시간 통신 방식의 변화는 기존 소켓 기반 코드를 리팩토링할 때 주의가 필요합니다. 