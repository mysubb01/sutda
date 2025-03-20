# 섯다 게임 성능 최적화 가이드

이 문서는 Next.js 및 Supabase로 구현된 한국식 포커 게임(섯다)의 성능 최적화에 관한 가이드입니다. 이 프로젝트에서는 최적의 사용자 경험을 제공하기 위해 다양한 최적화 전략을 적용하였습니다.

## Core Web Vitals 최적화

Next.js 애플리케이션의 핵심 성능 지표를 개선하기 위한 최적화 방법입니다.

### LCP (Largest Contentful Paint) 개선

1. **카드 이미지 최적화**
   - Next.js의 `Image` 컴포넌트를 사용하여 카드 이미지 최적화
   - 이미지 크기 및 품질 최적화 (WebP 포맷 사용)
   - 적절한 `priority` 속성 활용으로 중요 이미지 먼저 로드

```tsx
// 최적화된 이미지 사용 예시
import Image from 'next/image';

function CardImage({ src, alt }: { src: string, alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={240}
      height={384}
      priority={true}  // 중요 이미지 먼저 로드
      placeholder="blur" // 로딩 중 블러 처리
      blurDataURL="data:image/png;base64,..." // 블러 처리용 데이터 URL
    />
  );
}
```

2. **서버 컴포넌트 활용**
   - 가능한 많은 컴포넌트를 서버 컴포넌트로 구현하여 클라이언트 번들 크기 감소
   - 자바스크립트 전송 최소화로 초기 로딩 시간 단축

### FID/INP (First Input Delay/Interaction to Next Paint) 개선

1. **이벤트 핸들러 최적화**
   - 게임 액션 핸들러(베팅, 콜, 다이 등)를 디바운싱하여 연속 클릭 방지
   - React의 `useCallback`을 사용하여 핸들러 함수 메모이제이션

```tsx
// 최적화된 이벤트 핸들러 예시
const handleBet = useCallback(
  debounce(async (amount: number) => {
    setIsLoading(true);
    try {
      await placeBet(gameId, playerId, amount);
    } catch (error) {
      console.error('베팅 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, 300),
  [gameId, playerId]
);
```

2. **상태 관리 최적화**
   - 필요한 상태만 가능한 작게 분리하여 관리
   - 불필요한 리렌더링 방지를 위한 상태 구조화

### CLS (Cumulative Layout Shift) 개선

1. **UI 요소 크기 고정**
   - 카드 및 게임 인터페이스 요소에 고정 크기 적용
   - 로딩 상태와 데이터 로드 후 상태의 크기 일관성 유지

2. **스켈레톤 UI 활용**
   - 데이터 로딩 중 스켈레톤 UI를 표시하여 레이아웃 이동 최소화

```tsx
function CardSkeleton() {
  return (
    <div className="w-[240px] h-[384px] bg-gray-200 animate-pulse rounded-lg"></div>
  );
}
```

## Supabase 실시간 기능 최적화

### 구독 최적화

1. **필터링된 구독**
   - 필요한 데이터만 구독하도록 필터 적용
   - 게임 ID를 기준으로 데이터 필터링

```typescript
// 좁은 범위로 필터링된 구독
const subscription = supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'games',
    filter: `id=eq.${gameId}` // 특정 게임 ID만 필터링
  }, handleUpdate)
  .subscribe();
```

2. **구독 정리**
   - 컴포넌트 언마운트 시 구독 정리
   - 메모리 누수 및 불필요한 업데이트 방지

```typescript
useEffect(() => {
  const subscription = subscribeToGameUpdates(gameId, handleUpdate);
  
  return () => {
    unsubscribe(subscription);
  };
}, [gameId]);
```

### 데이터 로딩 최적화

1. **점진적 로딩**
   - 중요 게임 데이터 먼저 로드, 채팅 메시지는 지연 로드
   - Suspense와 함께 동적 가져오기 활용

```tsx
// 동적 로딩 사용 예시
const Chat = dynamic(() => import('@/components/Chat'), {
  loading: () => <ChatSkeleton />,
  ssr: false // 클라이언트 사이드에서만 로드
});
```

2. **데이터 캐싱**
   - 게임 상태 캐싱으로 불필요한 재요청 방지
   - 필요할 때만 서버에서 새 데이터 가져오기

## 클라이언트 최적화

### 컴포넌트 최적화

1. **컴포넌트 분리 및 메모이제이션**
   - 논리적 기능 단위로 컴포넌트 분리
   - `React.memo`를 활용한 불필요한 리렌더링 방지

```tsx
// 메모이제이션된 컴포넌트 예시
const PlayerInfo = React.memo(({ player }: { player: Player }) => {
  return (
    <div className="player-info">
      <h3>{player.username}</h3>
      <p>잔액: {player.balance}원</p>
    </div>
  );
});
```

2. **가상화 적용**
   - 채팅 메시지와 같은 긴 목록에 가상화 적용
   - `react-window` 등의 라이브러리 활용

### 번들 크기 최적화

1. **코드 분할**
   - 페이지 및 주요 컴포넌트 단위로 코드 분할
   - 동적 import를 통한 지연 로딩

2. **불필요한 종속성 제거**
   - 미사용 라이브러리 제거
   - 트리 쉐이킹 활용으로 사용 코드만 번들에 포함

## 모니터링 및 분석

1. **성능 모니터링**
   - Vercel Analytics를 통한 실제 사용자 경험 측정
   - Lighthouse 점수 정기 확인

2. **에러 추적**
   - Sentry 등의 도구를 활용한 런타임 에러 추적
   - 사용자 경험에 영향을 줄 수 있는 이슈 우선 해결

## 결론

성능 최적화는 지속적인 과정입니다. 사용자 피드백과 분석 데이터를 바탕으로 꾸준히 개선해 나가는 것이 중요합니다. 이 문서에서 소개한 방법들을 적용하면 한국식 포커 게임의 성능을 크게 향상시킬 수 있습니다.

최적화 작업 시 다음 원칙을 기억하세요:

1. 데이터를 적게, 필요할 때만 가져오기
2. JavaScript 실행 시간 최소화하기
3. 레이아웃 변화 방지하기
4. 사용자 액션에 빠르게 응답하기

이러한 원칙을 따르면 빠르고 반응성 좋은 게임 경험을 제공할 수 있습니다. 