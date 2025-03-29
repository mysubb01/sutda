'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameState } from '@/types/game';
import { startGame, placeBet } from '@/lib/gameApi';
import soundPlayer from '@/utils/soundEffects';
import { toast } from 'react-hot-toast';
import { getAvailableBettingActions, BETTING_ACTIONS } from '@/lib/api/bettingApi';
import type { BettingActionValue } from '@/lib/api/bettingApi';

interface GameControlsProps {
  gameState: GameState;
  currentPlayerId: string;
  onAction: () => void;
}

// 베팅 버튼 컴포넌트
const BettingButton = ({ 
  label, 
  onClick, 
  disabled = false,
  variant = 'default',
  title = ''
}: { 
  label: string; 
  onClick: () => void; 
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  title?: string;
}) => {
  // 버튼 스타일링을 위한 함수
  const getButtonStyle = () => {
    switch(variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-500 text-white';
      case 'success':
        return 'bg-green-600 hover:bg-green-500 text-white';
      case 'danger':
        return 'bg-red-600 hover:bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-500 text-white';
      default:
        return 'bg-gray-700 hover:bg-gray-600 text-white';
    }
  };

  return (
    <button
      className={`relative h-12 rounded-md shadow-md ${getButtonStyle()} ${disabled ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 transition-transform'} font-bold`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <span className="text-white font-bold text-sm">{label}</span>
    </button>
  );
};

export function GameControls({ gameState, currentPlayerId, onAction }: GameControlsProps) {
  const [betAmount, setBetAmount] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // 사운드 플레이어 초기화 및 게임 상태에 따른 효과음 처리
  useEffect(() => {
    soundPlayer.initialize();
    
    // 컴포넌트 언마운트 시 배경음악 중지
    return () => {
      soundPlayer.pauseBGM();
    };
  }, [gameState.status]);

  // 음소거 토글 함수
  const toggleMute = () => {
    const newMutedState = soundPlayer.toggleMute();
    setIsMuted(newMutedState);
  };

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
      // 카드 배분 사운드 재생
      soundPlayer.play('handout');
      onAction();
    } catch (err: any) {
      console.error('게임 시작 오류:', err);
      const errorMsg = err?.message || '게임을 시작하는 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`게임 시작 오류: ${errorMsg}`);
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
      
      await placeBet(gameState.id, currentPlayerId, 'raise', betValue);
      // 일반 베팅 사운드 재생
      soundPlayer.play('call');
      onAction();
    } catch (err: any) {
      console.error('베팅 오류:', err);
      const errorMsg = err?.message || '베팅 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`베팅 오류: ${errorMsg}`);
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
      // 콜 사운드 재생
      soundPlayer.play('call');
      onAction();
    } catch (err: any) {
      console.error('콜 오류:', err);
      const errorMsg = err?.message || '콜 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`콜 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 다이 처리
  const handleDie = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 'die' 대신 'fold' 사용
      await placeBet(gameState.id, currentPlayerId, 'fold');
      // 다이 사운드 재생
      soundPlayer.play('die');
      onAction();
    } catch (err: any) {
      console.error('다이 오류:', err);
      const errorMsg = err?.message || '다이 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`다이 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 하프 처리 추가
  const handleHalf = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await placeBet(gameState.id, currentPlayerId, 'half');
      // 하프 사운드 재생
      soundPlayer.play('half');
      onAction();
    } catch (err: any) {
      console.error('하프 오류:', err);
      const errorMsg = err?.message || '하프 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`하프 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 체크 처리 추가
  const handleCheck = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await placeBet(gameState.id, currentPlayerId, 'check');
      // 체크 사운드 재생
      soundPlayer.play('check');
      onAction();
    } catch (err: any) {
      console.error('체크 오류:', err);
      const errorMsg = err?.message || '체크 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`체크 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 따당 처리 추가
  const handleDouble = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentPlayer) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.');
      }
      
      // 현재 배팅금액의 2배 계산
      const doubleAmount = gameState.bettingValue * 2;
      
      if (doubleAmount <= 0 || doubleAmount > currentPlayer.balance) {
        throw new Error('유효하지 않은 베팅 금액입니다.');
      }
      
      await placeBet(gameState.id, currentPlayerId, 'bet', doubleAmount);
      // 따당(삥) 사운드 재생
      soundPlayer.play('double');
      onAction();
    } catch (err: any) {
      console.error('따당 베팅 오류:', err);
      const errorMsg = err?.message || '따당 베팅 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`따당 베팅 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 쿼터 베팅 처리 추가
  const handleQuarter = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentPlayer) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.');
      }
      
      const quarterAmount = Math.floor(gameState.bettingValue / 4);
      
      if (quarterAmount <= 0 || quarterAmount > currentPlayer.balance) {
        throw new Error('유효하지 않은 베팅 금액입니다.');
      }
      
      await placeBet(gameState.id, currentPlayerId, 'bet', quarterAmount);
      // 쿼터 사운드 재생 (call 사운드 사용)
      soundPlayer.play('call');
      onAction();
    } catch (err: any) {
      console.error('쿼터 베팅 오류:', err);
      const errorMsg = err?.message || '쿼터 베팅 중 오류가 발생했습니다.';
      setError(errorMsg);
      toast.error(`쿼터 베팅 오류: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 삥 처리 추가
  const handlePing = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentPlayer) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.');
      }
      
      // 삥은 현재 베팅 금액과 동일한 금액으로 베팅
      const betValue = gameState.bettingValue || 500;
      
      if (betValue <= 0 || betValue > currentPlayer.balance) {
        throw new Error('유효하지 않은 베팅 금액입니다.');
      }
      
      await placeBet(gameState.id, currentPlayerId, 'raise', betValue);
      // 삥 사운드 재생
      soundPlayer.play('ping');
      onAction();
    } catch (err) {
      console.error('삥 베팅 오류:', err);
      setError('삥 베팅 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사용 가능한 베팅 액션 목록 가져오기
  const { availableActions, availableDescriptions } = useMemo(() => {
    if (!currentPlayer || isGameFinished) {
      return { availableActions: [], availableDescriptions: {} };
    }
    
    const blindAmount = gameState.bettingRules.blind_amount || 100; 
    const result = getAvailableBettingActions({
      gameState: {
        bettingValue: gameState.bettingValue || 0, // current_bet_amount -> bettingValue
        pot: gameState.pot || 0,
        bettingRules: gameState.bettingRules,
        baseBet: gameState.baseBet || 0, // baseBet 추가
      },
      playerState: {
        current_bet: currentPlayer.current_bet || 0,
        balance: currentPlayer.balance || 0, // chips -> balance
        is_die: currentPlayer.is_die || false 
      }
    });
    
    return {
      availableActions: result.actions,
      availableDescriptions: result.descriptions
    };
  }, [gameState, currentPlayer]);

  // 특정 액션이 가능한지 확인
  const isActionAvailable = (action: BettingActionValue): boolean => {
    if (isLoading || !isCurrentTurn) return false;
    return availableActions.includes(action);
  };

  // 액션 설명 가져오기
  const getActionDescription = (action: BettingActionValue): string => {
    // 사용 가능한 액션이 아니면 빈 문자열 반환
    if (!availableActions.includes(action)) return '';
    
    // 사용 가능한 액션이면 설명 반환
    return availableDescriptions[action] || '';
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

  if (isGameRegame) {
    const remainingTime = gameState.regame_remaining_time || 5; 

    return (
      <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">재경기 진행 중</h2>
        <div className="flex justify-center">
          <div className="spinner"></div>
        </div>
        <p className="text-gray-300 text-center mt-4">특수 패(구사/멍텅구사) 발생으로 재경기를 준비하고 있습니다.</p>
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
    const callAmount = gameState.bettingValue - (currentPlayer?.current_bet || 0);
    const potAmount = gameState.pot || 0;
    const blindAmount = gameState.bettingRules?.blind_amount || 100;
    const currentBet = gameState.bettingValue || 0;
    const playerChips = currentPlayer?.balance || 0;

    return (
      <div className="p-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg border border-yellow-500 shadow-xl">
        {/* 화면이 테이블 위에 겹쳐질 때는 컴팩트하게 표시 */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-yellow-400">게임 진행 중</h2>
          <div className="flex items-center">
            <button 
              onClick={toggleMute}
              className="mr-2 p-1 rounded-full bg-gray-700 hover:bg-gray-600 focus:outline-none"
              title={isMuted ? "음소거 해제" : "음소거"}
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <div className="text-right">
              <p className="text-yellow-400 font-bold">{gameState.bettingValue} 포인트</p>
              {currentPlayer && (
                <p className="text-xs text-gray-300">내 잔액: {currentPlayer.balance} P</p>
              )}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-500 text-white p-2 rounded-md mb-2 text-xs">
            {error}
          </div>
        )}
        
        {isCurrentTurn ? (
          <div>
            <p className="text-green-400 font-bold text-sm mb-2">내 턴입니다!</p>
            
            {/* 커스텀 베팅 입력 */}
            <div className="mb-3">
              <div className="flex space-x-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                min={100}
                max={currentPlayer?.balance || 0}
                step={100}
                  className="flex-grow px-2 py-1 bg-gray-800 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                disabled={isLoading}
              />
                <button
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-md shadow transition-all text-sm"
                  onClick={() => handleBet()}
                  disabled={isLoading || !currentPlayer || betAmount <= 0 || betAmount > currentPlayer.balance}
                >
                  베팅
                </button>
              </div>
            </div>
            
            {/* 배팅 버튼 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {/* 콜 버튼 */}
              <BettingButton 
                label="콜" 
                onClick={handleCall} 
                disabled={!isActionAvailable(BETTING_ACTIONS.CALL)}
                variant='success'
                title={getActionDescription(BETTING_ACTIONS.CALL)}
              />
              {/* 체크 버튼 추가 */}
              <BettingButton 
                label="체크" 
                onClick={handleCheck} 
                disabled={!isActionAvailable(BETTING_ACTIONS.CHECK)}
                variant='default'
                title={getActionDescription(BETTING_ACTIONS.CHECK)}
              />
              {/* 다이(폴드) 버튼 */}
              <BettingButton 
                label="다이" 
                onClick={handleDie} 
                disabled={!isActionAvailable(BETTING_ACTIONS.FOLD)}
                variant='danger'
                title={getActionDescription(BETTING_ACTIONS.FOLD)}
              />
              {/* 삥(레이즈 기본) 버튼 */}
              <BettingButton 
                label="삥" 
                onClick={handlePing} 
                disabled={!isActionAvailable(BETTING_ACTIONS.RAISE)} 
                variant='primary'
                title={getActionDescription(BETTING_ACTIONS.RAISE)}
              />
              {/* 하프 버튼 */}
              <BettingButton 
                label="하프" 
                onClick={handleHalf} 
                disabled={!isActionAvailable(BETTING_ACTIONS.RAISE) || playerChips < callAmount + Math.floor(potAmount / 2)} 
                variant='warning'
                title={isActionAvailable(BETTING_ACTIONS.RAISE) ? `하프: ${callAmount + Math.floor(potAmount / 2)} 칩 베팅` : "하프 베팅 불가"}
              />
              {/* 따당 버튼 */}
              <BettingButton 
                label="따당" 
                onClick={handleDouble} 
                disabled={!isActionAvailable(BETTING_ACTIONS.RAISE) || currentBet <= 0 || playerChips < callAmount + currentBet} 
                variant='primary'
                title={(isActionAvailable(BETTING_ACTIONS.RAISE) && currentBet > 0) ? `따당: ${callAmount + currentBet} 칩 베팅` : "따당 베팅 불가"}
              />
              {/* 올인 버튼 */}
              <BettingButton 
                label="올인" 
                onClick={() => handleBet(currentPlayer?.balance)} 
                disabled={!isActionAvailable(BETTING_ACTIONS.ALLIN)}
                variant='danger'
                title={getActionDescription(BETTING_ACTIONS.ALLIN)}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-blue-400 mb-2 text-sm">
              <span className="font-bold">{gameState.players.find(p => p.id === gameState.currentTurn)?.username || '알 수 없음'}</span>님의 차례입니다
            </p>
            
            <div className="flex justify-end">
              <div className="w-1/2">
                <BettingButton 
                  label="다이 (포기)" 
                  onClick={handleDie} 
                  disabled={!isActionAvailable(BETTING_ACTIONS.FOLD)}
                  variant="danger"
                  title="게임에서 포기합니다"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 bg-opacity-90 rounded-lg border border-yellow-500 shadow-lg">
      <p className="text-gray-300 text-center">게임 상태를 불러오는 중...</p>
    </div>
  );
} 