'use client';

import { useState } from 'react';
import Image from 'next/image';
import { GameState, BetActionType } from '@/types/game';
import { startGame, placeBet } from '@/lib/gameApi';

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
  const isGameRegame = gameState.status === 'regame';
  
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
  const handleBet = async (amount?: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentPlayer) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.');
      }

      // 전달된 금액이 있으면 그 금액으로, 없으면 입력 필드의 금액으로
      const betValue = amount !== undefined ? amount : betAmount;
      
      if (betValue <= 0 || betValue > currentPlayer.balance) {
        throw new Error('유효하지 않은 베팅 금액입니다.');
      }
      
      await placeBet(gameState.id, currentPlayerId, 'bet', betValue);
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
      await placeBet(gameState.id, currentPlayerId, 'call');
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
      await placeBet(gameState.id, currentPlayerId, 'die');
      onAction();
    } catch (err) {
      console.error('다이 오류:', err);
      setError('다이 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 하프 처리
  const handleHalf = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await placeBet(gameState.id, currentPlayerId, 'half');
      onAction();
    } catch (err) {
      console.error('하프 오류:', err);
      setError('하프 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 체크 처리
  const handleCheck = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await placeBet(gameState.id, currentPlayerId, 'check');
      onAction();
    } catch (err) {
      console.error('체크 오류:', err);
      setError('체크 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 따당 처리
  const handleDoubleQuarter = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await placeBet(gameState.id, currentPlayerId, 'quarter');
      onAction();
    } catch (err) {
      console.error('따당 오류:', err);
      setError('따당 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 이전 베팅이 있는지 확인
  const hasPreviousBet = (): boolean => {
    // 게임 베팅값이 0보다 크면 이전 베팅이 있는 것
    return gameState.bettingValue > 0;
  };

  // 베팅 버튼 컴포넌트
  const BettingButton = ({ 
    imageSrc, 
    label, 
    onClick, 
    disabled = false 
  }: { 
    imageSrc: string; 
    label: string; 
    onClick: () => void; 
    disabled?: boolean; 
  }) => (
    <button
      className={`relative h-10 w-20 overflow-hidden rounded-md shadow-md ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 transition-transform'
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <Image
        src={imageSrc}
        alt={label}
        width={80}
        height={40}
        className="w-full h-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm drop-shadow-lg">
        {label}
      </span>
    </button>
  );

  if (isGameFinished) {
    return (
      <div className="p-4 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-xl font-bold text-center mb-3 text-yellow-400">게임 종료</h2>
        {winnerName && (
          <div className="text-center">
            <p className="text-yellow-400 font-bold mb-2 text-lg">{winnerName}님이 승리했습니다!</p>
            <p className="text-gray-300">획득 포인트: {gameState.bettingValue}</p>
          </div>
        )}
        <button
          className="mt-3 w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-md shadow-lg transition-all"
          onClick={() => window.location.href = '/'}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  if (isGameRegame) {
    const remainingTime = gameState.regame_remaining_time || 5; // 기본값 5초

    return (
      <div className="p-4 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-xl font-bold text-center mb-3 text-yellow-400">재경기 진행 중</h2>
        <div className="flex justify-center">
          <div className="spinner"></div>
        </div>
        <p className="text-gray-300 text-center mt-3">특수 패(구사/멍텅구리구사) 발생으로 재경기를 준비하고 있습니다.</p>
        <p className="text-yellow-400 text-center mt-2 font-bold">{remainingTime}초 후 재시작...</p>
        
        <style jsx>{`
          .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #fbbd23;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (isGameWaiting) {
    return (
      <div className="p-4 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-xl font-bold text-center mb-3 text-yellow-400">게임 대기 중</h2>
        <p className="text-gray-300 text-center mb-3">현재 {gameState.players.length}명의 플레이어가 대기 중입니다.</p>
        
        {error && (
          <div className="bg-red-500 text-white p-2 rounded-md mb-3">
            {error}
          </div>
        )}
        
        <div className="text-center">
          {gameState.players.length >= 2 ? (
            <button
              className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-bold rounded-md shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={handleStartGame}
              disabled={isLoading}
            >
              {isLoading ? '게임 시작 중...' : '게임 시작하기'}
            </button>
          ) : (
            <p className="text-yellow-400">게임을 시작하려면 최소 2명의 플레이어가 필요합니다.</p>
          )}
        </div>
      </div>
    );
  }

  // 게임 진행 중 컨트롤
  return (
    <div className="p-3 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
      <h3 className="text-lg font-bold text-center mb-2 text-yellow-400">
        게임 진행 중
      </h3>
      
      {error && (
        <div className="bg-red-500 text-white p-2 rounded-md mb-2 text-sm">
          {error}
        </div>
      )}
      
      <div className="mb-2 text-center">
        <p className="text-white text-sm">
          현재 판돈: <span className="text-yellow-400 font-bold">{gameState.bettingValue.toLocaleString()} P</span>
          {isCurrentTurn && <span className="block text-green-400 mt-1">내 차례입니다!</span>}
        </p>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {/* 콜 버튼 */}
        <BettingButton 
          imageSrc={buttonImages.call}
          label="콜"
          onClick={handleCall}
          disabled={!isCurrentTurn || !hasPreviousBet()}
        />
        
        {/* 다이 버튼 */}
        <BettingButton 
          imageSrc={buttonImages.die}
          label="다이"
          onClick={handleDie}
          disabled={!isCurrentTurn}
        />
        
        {/* 체크 버튼 */}
        <BettingButton
          imageSrc={buttonImages.ping}
          label="체크"
          onClick={handleCheck}
          disabled={!isCurrentTurn || hasPreviousBet()}
        />
        
        {/* 하프 버튼 */}
        <BettingButton 
          imageSrc={buttonImages.half}
          label="하프"
          onClick={handleHalf}
          disabled={!isCurrentTurn}
        />
        
        {/* 따당 버튼 */}
        <BettingButton 
          imageSrc={buttonImages.quarter}
          label="따당"
          onClick={handleDoubleQuarter}
          disabled={!isCurrentTurn}
        />
        
        {/* 베팅 입력 영역 */}
        <div className="flex flex-col space-y-1">
          <div className="flex rounded-md overflow-hidden">
            <input
              type="number"
              min="1"
              step="100"
              value={betAmount}
              onChange={(e) => setBetAmount(parseInt(e.target.value))}
              className="w-full p-1 bg-gray-800 text-white text-sm border border-gray-700"
            />
          </div>
          <button
            className={`px-2 py-1 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold rounded-md shadow transition-all text-sm ${
              !isCurrentTurn ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => handleBet()}
            disabled={!isCurrentTurn}
          >
            베팅
          </button>
        </div>
      </div>
      
      <div className="mt-2">
        <p className="text-yellow-300 text-xs text-center">내 잔액: {currentPlayer?.balance.toLocaleString() || 0} P</p>
      </div>
    </div>
  );
} 