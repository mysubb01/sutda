'use client';

import { useState } from 'react';
import Image from 'next/image';
import { GameState } from '@/types/game';
import { startGame, placeBet, callBet, dieBet } from '@/lib/gameApi';

interface GameControlsProps {
  gameState: GameState;
  currentPlayerId: string;
  onAction: () => void;
}

// 버튼 이미지 경로
const buttonImages = {
  call: '/images/ui/callbtn.png',
  die: '/images/ui/diebtn.png',
  bet: '/images/ui/doublebtn.png', 
  half: '/images/ui/halfbtn.png',
  quarter: '/images/ui/quarterbtn.png',
  ping: '/images/ui/pingbtn.png'
};

export function GameControls({ gameState, currentPlayerId, onAction }: GameControlsProps) {
  const [betAmount, setBetAmount] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentTurn = gameState.currentTurn === currentPlayerId;
  const isGameWaiting = gameState.status === 'waiting';
  const isGamePlaying = gameState.status === 'playing';
  const isGameFinished = gameState.status === 'finished';
  
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  
  // 승자 이름 가져오기
  const winnerName = gameState.winner 
    ? gameState.players.find(p => p.id === gameState.winner)?.username 
    : null;

  // 게임 시작 처리
  const handleStartGame = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await startGame(gameState.id);
      onAction();
    } catch (err) {
      console.error('게임 시작 오류:', err);
      setError('게임을 시작하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 베팅 처리
  const handleBet = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentPlayer || betAmount <= 0 || betAmount > currentPlayer.balance) {
        throw new Error('유효하지 않은 베팅 금액입니다.');
      }
      
      await placeBet(gameState.id, currentPlayerId, betAmount);
      onAction();
    } catch (err) {
      console.error('베팅 오류:', err);
      setError('베팅 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 콜 처리
  const handleCall = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await callBet(gameState.id, currentPlayerId);
      onAction();
    } catch (err) {
      console.error('콜 오류:', err);
      setError('콜 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 다이 처리
  const handleDie = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await dieBet(gameState.id, currentPlayerId);
      onAction();
    } catch (err) {
      console.error('다이 오류:', err);
      setError('다이 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isGameFinished) {
    return (
      <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">게임 종료</h2>
        {winnerName && (
          <div className="text-center">
            <p className="text-yellow-400 font-bold mb-2 text-xl">{winnerName}님이 승리했습니다!</p>
            <p className="text-gray-300">획득 포인트: {gameState.bettingValue}</p>
          </div>
        )}
        <button
          className="mt-4 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-md shadow-lg transition-all"
          onClick={() => window.location.href = '/'}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  if (isGameWaiting) {
    return (
      <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">게임 대기 중</h2>
        <p className="text-gray-300 text-center mb-4">현재 {gameState.players.length}명의 플레이어가 대기 중입니다.</p>
        
        {error && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <div className="text-center">
          <button
            className={`py-3 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-md shadow-lg transition-all ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleStartGame}
            disabled={isLoading || gameState.players.length < 2}
          >
            {isLoading ? '처리 중...' : '게임 시작'}
          </button>
        </div>
        
        {gameState.players.length < 2 && (
          <p className="text-red-400 text-center mt-2">최소 2명의 플레이어가 필요합니다.</p>
        )}
        
        <div className="mt-4 text-gray-300 text-center text-sm">
          <p>게임 ID: {gameState.id}</p>
          <p className="mt-1">이 ID를 친구들에게 공유하여 같이 게임하세요!</p>
        </div>
      </div>
    );
  }

  if (isGamePlaying) {
    return (
      <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">게임 진행 중</h2>
        
        <div className="mb-4">
          <p className="text-gray-300">현재 베팅 금액: <span className="text-yellow-400 font-bold">{gameState.bettingValue} 포인트</span></p>
          
          {currentPlayer && (
            <p className="text-gray-300 mt-1">내 잔액: <span className="text-yellow-400 font-bold">{currentPlayer.balance} 포인트</span></p>
          )}
        </div>
        
        {error && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {isCurrentTurn ? (
          <div>
            <p className="text-green-400 font-bold mb-3">당신의 차례입니다!</p>
            
            <div>
              <label className="block text-gray-300 mb-1">베팅 금액</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                min={100}
                max={currentPlayer?.balance || 0}
                step={100}
                className="w-full px-3 py-2 bg-gray-800 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button
                className={`relative h-12 overflow-hidden rounded-lg ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 transition-transform'
                }`}
                onClick={handleBet}
                disabled={isLoading || !currentPlayer || betAmount <= 0 || betAmount > currentPlayer.balance}
              >
                <Image
                  src={buttonImages.bet}
                  alt="베팅"
                  width={80}
                  height={48}
                  className="w-full h-full object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold drop-shadow-lg">베팅</span>
              </button>
              
              <button
                className={`relative h-12 overflow-hidden rounded-lg ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 transition-transform'
                }`}
                onClick={handleCall}
                disabled={isLoading}
              >
                <Image
                  src={buttonImages.call}
                  alt="콜"
                  width={80}
                  height={48}
                  className="w-full h-full object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold drop-shadow-lg">콜</span>
              </button>
              
              <button
                className={`relative h-12 overflow-hidden rounded-lg ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 transition-transform'
                }`}
                onClick={handleDie}
                disabled={isLoading}
              >
                <Image
                  src={buttonImages.die}
                  alt="다이"
                  width={80}
                  height={48}
                  className="w-full h-full object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold drop-shadow-lg">다이</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-300 py-3 border border-gray-700 rounded-lg bg-gray-800 bg-opacity-50">다른 플레이어의 차례입니다.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
      <p className="text-center text-gray-300">게임 상태를 불러오는 중...</p>
    </div>
  );
} 