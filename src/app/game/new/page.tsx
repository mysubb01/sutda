'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewGameRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // /game/create 페이지로 리디렉션
    router.replace('/game/create');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-t-yellow-400 border-yellow-200 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-yellow-400 font-bold">새로운 게임 페이지로 이동 중...</p>
      </div>
    </div>
  );
} 