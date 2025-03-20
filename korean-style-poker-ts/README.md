# 한국식 포커 - 섯다 (TypeScript & Supabase 버전)

전통적인 한국식 포커 게임인 섯다를 온라인에서 즐겨보세요!

## 기술 스택

- **프론트엔드**: Next.js, React, TypeScript, Tailwind CSS
- **백엔드**: Supabase (데이터베이스, 실시간 업데이트, 인증)

## 프로젝트 설치 및 실행

1. 프로젝트 클론 및 의존성 설치

```bash
git clone https://github.com/yourusername/korean-style-poker-ts.git
cd korean-style-poker-ts
npm install
```

2. 환경 변수 설정
   
`.env.example` 파일을 복사하여 `.env.local` 파일을 생성하고 Supabase 프로젝트 설정 정보를 입력하세요.

```bash
cp .env.example .env.local
```

상세한 설정 방법은 [SETUP.md](./SETUP.md) 문서를 참고하세요.

3. 개발 서버 실행

```bash
npm run dev
```

## Supabase 데이터베이스 설정

이 프로젝트는 Supabase를 백엔드로 사용합니다. 다음 테이블을 생성해야 합니다:

### games 테이블
- `id` (uuid, PK)
- `created_at` (timestamp)
- `status` (enum: 'waiting', 'playing', 'finished')
- `current_turn` (uuid, nullable)
- `betting_value` (integer)
- `winner` (uuid, nullable)

### players 테이블
- `id` (uuid, PK)
- `game_id` (uuid, FK)
- `user_id` (string)
- `username` (string)
- `cards` (jsonb, array)
- `is_die` (boolean)
- `balance` (integer)
- `created_at` (timestamp)

### game_actions 테이블
- `id` (uuid, PK)
- `game_id` (uuid, FK)
- `player_id` (string)
- `action_type` (enum: 'join', 'bet', 'call', 'die', 'check')
- `amount` (integer)
- `created_at` (timestamp)

### messages 테이블
- `id` (uuid, PK)
- `game_id` (uuid, FK)
- `user_id` (string)
- `username` (string)
- `content` (text)
- `created_at` (timestamp)

테이블 생성을 위한 SQL 스크립트는 [supabase_setup.sql](./supabase_setup.sql) 파일을 참고하세요.

## 게임 규칙

- 섯다는 화투패를 사용하는 한국 전통 카드 게임입니다.
- 각 플레이어는 2장의 카드를 받습니다.
- 각 턴마다 베팅(Bet), 콜(Call), 또는 다이(Die) 중 하나를 선택합니다.
- 모든 플레이어가 콜하거나 한 명만 남으면 게임이 종료됩니다.
- 카드 조합 순위: 광땡 > 땡 > 알리 > 독사 > 구삥 > 장삥 > 장사 > 세륙 > 끗 > 망통

## 기술 문서

- [상세 설정 가이드](./SETUP.md): Supabase 프로젝트 생성 및 환경 설정 방법
- [마이그레이션 문서](./MIGRATION.md): Socket.io에서 Supabase로의 마이그레이션 설명
- [성능 최적화 가이드](./PERFORMANCE.md): 게임 성능 및 사용자 경험 최적화 방법

## 스크린샷 및 데모

![게임 스크린샷](./public/images/exampleImg.jpg)

## 라이선스

ISC 라이선스 