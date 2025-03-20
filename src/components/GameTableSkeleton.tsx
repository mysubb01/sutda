'use client'

export function GameTableSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-green-900 p-8">
      <div className="w-16 h-16 mb-4 rounded-full border-4 border-t-amber-400 border-amber-200 animate-spin"></div>
      <div className="space-y-2 text-center">
        <div className="text-lg font-bold text-amber-400">게임 정보 로드 중...</div>
        <div className="text-sm text-amber-300/70">잠시만 기다려 주세요</div>
      </div>
      
      {/* 가짜 테이블 배경 */}
      <div className="mt-8 w-full max-w-xl">
        <div className="aspect-video rounded-xl bg-green-800/50 animate-pulse"></div>
        
        {/* 가짜 배팅 영역 */}
        <div className="mt-6 flex justify-center">
          <div className="h-12 w-48 rounded-md bg-gray-700/50 animate-pulse"></div>
        </div>
        
        {/* 가짜 플레이어 슬롯 */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <div className="h-10 w-10 rounded-full bg-gray-700/50 animate-pulse"></div>
              <div className="h-6 w-24 rounded bg-gray-700/50 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 