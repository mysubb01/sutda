# Supabase 마이그레이션 가이드

## 데이터베이스 스키마

현재 프로젝트는 Supabase를 사용하여 백엔드를 구축하고 있습니다. 데이터베이스 스키마는 다음과 같이 구성되어 있습니다:

### 주요 테이블

- **rooms**: 게임방 정보
  - `id`: UUID (PK)
  - `name`: VARCHAR(255) - 방 이름
  - `mode`: INTEGER - 게임 모드 (2: 2장 모드, 3: 3장 모드)
  - `entry_fee`: INTEGER - 참가비 (DEFAULT 10000)
  - `max_players`: INTEGER - 최대 플레이어 수 (DEFAULT 8)
  - `is_active`: BOOLEAN - 방 활성화 상태
  - `created_at`, `updated_at`: TIMESTAMP
  - `betting_option`: VARCHAR(50) - 베팅 옵션

- **games**: 게임 정보
  - `id`: UUID (PK)
  - `room_id`: UUID (FK) - rooms 테이블 참조
  - `status`: VARCHAR - 게임 상태 (waiting, playing, finished)
  - `betting_value`: INTEGER - 현재 베팅 금액
  - `base_bet`: INTEGER - 기본 배팅 금액 (게임 시작 시 필요한 금액)
  - `total_pot`: INTEGER - 총 판돈
  - `room_name`: VARCHAR(255) - 방 이름
  - 기타 게임 상태 관련 필드

- **players**: 플레이어 정보
  - `id`: UUID (PK)
  - `room_id`: UUID (FK) - rooms 테이블 참조
  - `game_id`: UUID (FK) - games 테이블 참조
  - `user_id`: VARCHAR - 사용자 식별자
  - `username`: VARCHAR - 사용자 이름
  - `balance`: INTEGER - 잔액
  - `seat_index`: INTEGER - 좌석 번호
  - `is_ready`: BOOLEAN - 준비 상태
  - 기타 플레이어 상태 관련 필드

## 마이그레이션 파일

Supabase 마이그레이션은 `supabase/migrations` 디렉토리에 SQL 파일로 관리됩니다. 주요 마이그레이션 파일은 다음과 같습니다:

1. **room_game_schema.sql**: 기본 테이블 구조 정의
2. **20250321_add_player_ready_status.sql**: 플레이어 준비 상태 필드 추가
3. **20250322_allow_null_game_id.sql**: game_id 필드가 NULL 허용하도록 변경
4. **20250322_add_base_bet_column.sql**: games 테이블에 base_bet, room_name 컬럼 추가

## 마이그레이션 적용 방법

### 로컬 개발 환경

1. Supabase CLI를 사용하여 마이그레이션 적용:
   ```bash
   npx supabase migration apply
   ```

2. 브라우저에서 Supabase Studio 접속 (로컬): http://localhost:54323
   - SQL 편집기에서 직접 마이그레이션 SQL 실행 가능

### 운영 환경

1. Supabase 프로젝트 대시보드 접속
2. SQL 편집기 열기
3. 마이그레이션 SQL 파일 내용을 복사하여 실행

## 주의사항

1. 마이그레이션 파일 작성 시 `IF NOT EXISTS` 구문 사용으로 중복 실행 오류 방지
2. 운영 환경에 적용 전 반드시 로컬에서 테스트 필요
3. 기존 데이터가 있는 상태에서 NOT NULL 제약 추가 시 기본값 설정 필요
4. 외래 키 관계가 있는 테이블 수정 시 참조 무결성 고려

## 데이터베이스 변경 시 코드 반영

데이터베이스 스키마 변경 후 코드에서 다음 부분 확인 필요:

1. Supabase 쿼리 수정 (insert, update, select 등)
2. TypeScript 타입 정의 업데이트 (`src/types` 디렉토리)
3. 관련 API 함수 수정 (`src/lib` 디렉토리)
