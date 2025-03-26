import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-6 text-yellow-400">한국식 포커 - 섯다</h1>
        <p className="text-lg mb-8 text-gray-300">
          전통적인 한국식 포커 게임인 섯다를 온라인에서 즐겨보세요!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link 
            href="/room" 
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            방 목록 보기
          </Link>
          
          <Link 
            href="/room/create" 
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 방 만들기
          </Link>
          
          <Link 
            href="/admin" 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            관리자 설정
          </Link>
        </div>
      </div>
      
      <div className="mt-12 text-center max-w-2xl bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4 text-yellow-400">게임 모드</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-blue-400">2장 모드</h3>
            <p className="text-gray-300">기본적인 섯다 게임으로, 2장의 카드로 족보를 결정하여 승부합니다.</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-purple-400">3장 모드</h3>
            <p className="text-gray-300">3장 중 2장을 선택하는 전략적인 섯다 게임입니다. 공개 카드로 베팅 후 최종 선택합니다.</p>
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold mb-4 text-yellow-400">주요 족보</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">광땡</span> - 3·8광땡, 1·3광땡
          </div>
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">땡</span> - 같은 숫자 조합(10땡~1땡)
          </div>
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">알리</span> - 1·2 조합
          </div>
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">독사</span> - 1·4 조합
          </div>
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">구삥</span> - 1·9 조합
          </div>
          <div className="bg-gray-700 p-2 rounded-lg">
            <span className="font-bold text-yellow-300">장삥</span> - 1·10 조합
          </div>
        </div>
      </div>
    </div>
  );
}