'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface BettingTimerProps {
  timeLimit: number; // 초 단위
  onTimeUp?: () => void;
  visible: boolean;
}

export function BettingTimer({ timeLimit = 30, onTimeUp, visible }: BettingTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  
  useEffect(() => {
    // 타이머 초기화
    if (!visible) {
      setTimeLeft(timeLimit);
      return () => {};
    }
    
    // 타이머 초기화
    setTimeLeft(timeLimit);
    
    // 타이머 시작
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp && onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // 컴포넌트 언마운트시 타이머 정리
    return () => clearInterval(timer);
  }, [timeLimit, onTimeUp, visible]);
  
  if (!visible) return null;
  
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-opacity-80 bg-gray-900 p-3 rounded-full border-2 border-yellow-400 shadow-lg">
      <div className="flex items-center justify-center">
        <div className="text-white text-2xl font-bold">{timeLeft}</div>
      </div>
    </div>
  );
}
