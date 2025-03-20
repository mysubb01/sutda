# 섯다 게임 설정 가이드

이 문서는 TypeScript와 Supabase로 리팩토링된 섯다 게임을 설정하는 방법을 안내합니다.

## 1. Supabase 프로젝트 설정

### 1.1. Supabase 계정 및 프로젝트 생성

1. [Supabase](https://supabase.com/)에 방문하여 계정을 생성합니다.
2. 대시보드에서 "New Project"를 클릭하여 새 프로젝트를 생성합니다.
3. 프로젝트 이름(예: `sutda`) 및 데이터베이스 비밀번호를 설정합니다.
4. 지역은 가능한 가까운 곳으로 선택합니다 (예: `Asia Northeast 3 (Seoul)`).
5. "Create new project"를 클릭하여 프로젝트를 생성합니다.

### 1.2. 데이터베이스 테이블 생성

프로젝트가 생성되면 다음 두 가지 방법 중 하나로 테이블을 생성할 수 있습니다:

#### A. SQL 에디터 사용

1. Supabase 대시보드에서 왼쪽 사이드바의 "SQL Editor"를 클릭합니다.
2. "New Query"를 클릭하여 새 SQL 쿼리를 작성합니다.
3. 프로젝트의 `supabase_setup.sql` 파일 내용을 복사하여 붙여넣습니다.
4. "Run"을 클릭하여 SQL을 실행합니다.

#### B. 테이블 에디터 사용

1. Supabase 대시보드에서 왼쪽 사이드바의 "Table Editor"를 클릭합니다.
2. "Create a new table"을 클릭하여 README.md 파일에 명시된 구조대로 테이블을 생성합니다.
   - games, players, game_actions, messages 테이블을 각각 생성합니다.
   - 각 테이블의 컬럼과 제약조건을 설정합니다.

### 1.3. 실시간 기능 활성화

1. Supabase 대시보드에서 왼쪽 사이드바의 "Database"를 클릭합니다.
2. "Replication"을 클릭합니다.
3. "Source"와 "Destination" 탭에서 각각 "Enable Realtime"을 활성화합니다.
4. 생성한 모든 테이블(games, players, game_actions, messages)에 대해 실시간 변경 사항을 구독할 수 있도록 설정합니다.

### 1.4. API 키 및 URL 확인

1. Supabase 대시보드에서 왼쪽 사이드바의 "Project Settings"를 클릭합니다.
2. "API" 섹션에서 다음 정보를 확인합니다:
   - **Project URL**: 프로젝트 URL
   - **anon public**: 익명 공개 키

이 정보는 환경 변수 설정에 사용됩니다.

## 2. 환경 변수 설정

### 2.1. 로컬 환경 설정

1. 프로젝트 루트 디렉토리에서 `.env.example` 파일을 복사하여 `.env.local` 파일을 생성합니다:

```bash
cp .env.example .env.local
```

2. 텍스트 에디터로 `.env.local` 파일을 열고 Supabase 프로젝트 정보를 입력합니다:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Supabase 대시보드의 API 섹션에서 확인한 값을 입력합니다.

### 2.2. 배포 환경 설정 (Vercel)

Vercel에 배포하는 경우:

1. [Vercel](https://vercel.com/)에 로그인합니다.
2. 프로젝트를 임포트합니다.
3. 설정 > 환경 변수에서 다음 변수를 추가합니다:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 익명 공개 키
4. "Deploy"를 클릭하여 프로젝트를 배포합니다.

## 3. 카드 이미지 추가

화투 카드 이미지를 추가하려면:

1. 화투 카드 이미지 파일을 획득합니다. (무료 이미지, 구매 이미지 등)
2. 다음 이름 형식으로 이미지 파일 이름을 변경합니다:
   - `1-1.png`: 1월 첫 번째 카드(광)
   - `1-2.png`: 1월 두 번째 카드(일반)
   - `2-1.png`: 2월 첫 번째 카드 등...
3. 카드 뒷면 이미지는 `back.png`로 이름을 변경합니다.
4. 이 이미지 파일들을 `public/images/cards/` 디렉토리에 위치시킵니다.

**참고**: 카드 이미지가 없어도 게임은 작동합니다. 이미지가 없는 경우 텍스트 기반 카드가 표시됩니다.

## 4. 개발 서버 실행

환경 설정이 완료되면 개발 서버를 실행합니다:

```bash
npm run dev
```

## 5. 빌드 및 배포

프로덕션 빌드를 생성하려면:

```bash
npm run build
```

생성된 빌드를 실행하려면:

```bash
npm start
```

## 문제 해결

**Q: Supabase 연결 오류가 발생합니다.**

A: 다음을 확인하세요:
- 환경 변수가 올바르게 설정되었는지 확인
- Supabase 프로젝트가 활성 상태인지 확인
- 브라우저 콘솔에서 정확한 오류 메시지 확인

**Q: 카드 이미지가 표시되지 않습니다.**

A: 다음을 확인하세요:
- 이미지 파일이 `public/images/cards/` 디렉토리에 올바른 이름으로 위치하는지 확인
- 이미지 파일 형식이 브라우저와 호환되는지 확인 (PNG, JPG, WebP 권장)
- 이미지 파일 권한이 올바른지 확인

**Q: 실시간 업데이트가 작동하지 않습니다.**

A: Supabase 프로젝트에서 Realtime 기능이 활성화되어 있는지 확인하세요. 