import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-800 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">한국식 포커 - 섯다</h1>
        <p className="text-lg mb-8">
          전통적인 한국식 포커 게임인 섯다를 온라인에서 즐겨보세요!
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/game/new" 
            className="block w-64 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg mx-auto"
          >
            새 게임 시작하기
          </Link>
          
          <Link 
            href="/game/join" 
            className="block w-64 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg mx-auto"
          >
            게임 참가하기
          </Link>
        </div>
      </div>
      
      <div className="mt-16 text-center text-gray-400">
        <h2 className="text-xl font-semibold mb-4">게임 규칙</h2>
        <ul className="text-left max-w-md mx-auto space-y-2">
          <li>• 각 플레이어는 2장의 카드를 받습니다.</li>
          <li>• 각 턴마다 베팅(Bet), 콜(Call), 또는 다이(Die) 중 하나를 선택합니다.</li>
          <li>• 모든 플레이어가 콜하거나 한 명만 남으면 게임이 종료됩니다.</li>
          <li>• 카드 조합 순위: 광땡 > 땡 > 알리 > 독사 > 구삥 > 장삥 > 장사 > 세륙 > 끗 > 망통</li>
        </ul>
      </div>
    </div>
  );
}