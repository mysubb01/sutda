'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRoomInfo, leaveRoom, createGameInRoom, getRoomPlayers, togglePlayerReady, checkRoomAccess } from '@/lib/roomApi';
import { Room, Player } from '@/types/game';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface WaitingRoomPageProps {
  params: {
    roomId: string;
    playerId: string;
  };
}

export default function WaitingRoomPage({ params }: WaitingRoomPageProps) {
  const { roomId, playerId } = params;
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [changingReady, setChangingReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  
  // 내 플레이어 정보
  const currentPlayer = players.find(p => p.id === playerId);
  const myReadyStatus = currentPlayer?.is_ready || false;
  
  // 방 정보와 플레이어 정보 로드
  useEffect(() => {
    async function loadRoomData() {
      try {
        setLoading(true);
        
        // 접근 권한 확인
        const hasAccess = await checkRoomAccess(roomId, playerId);
        if (!hasAccess) {
          toast.error('방에 접근할 권한이 없습니다.');
          router.push('/room');
          return;
        }
        
        // 방 정보 로드
        const roomInfo = await getRoomInfo(roomId);
        setRoom(roomInfo);
        
        // 플레이어 정보 로드
        const roomPlayers = await getRoomPlayers(roomId);
        setPlayers(roomPlayers);
        
        // 첫 번째 입장한 플레이어를 방장으로 설정 (seat_index가 0인 플레이어)
        const owner = roomPlayers.find(p => p.seat_index === 0);
        setIsRoomOwner(owner?.id === playerId);
        
        setError(null);
      } catch (err) {
        console.error('방 정보 로딩 오류:', err);
        setError('방 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    // 초기 데이터 로드
    loadRoomData();
    
    // Supabase Realtime 구독 설정
    // 1. players 테이블 구독 - 플레이어 목록 변경 감지
    const playersSubscription = supabase
      .channel(`players-room-${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}` 
        }, 
        (payload) => {
          console.log('새로운 플레이어 입장:', payload);
          // 새로운 플레이어 추가
          const newPlayer = payload.new as Player;
          setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
          toast.success(`${newPlayer.username}님이 입장했습니다.`);
        }
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}` 
        }, 
        (payload) => {
          console.log('플레이어 정보 업데이트:', payload);
          // 플레이어 정보 업데이트
          const updatedPlayer = payload.new as Player;
          const oldPlayer = payload.old as Player;
          
          setPlayers(prevPlayers => 
            prevPlayers.map(player => 
              player.id === updatedPlayer.id ? updatedPlayer : player
            )
          );
          
          // 준비 상태 변경 알림
          if (oldPlayer.is_ready !== updatedPlayer.is_ready) {
            // 다른 플레이어의 준비 상태 변경 알림
            if (updatedPlayer.id !== playerId) {
              toast.success(`${updatedPlayer.username}님이 ${updatedPlayer.is_ready ? '준비 완료' : '준비 취소'}했습니다.`);
            }
          }
          
          // 방장 변경 알림
          if (oldPlayer.seat_index !== updatedPlayer.seat_index && updatedPlayer.seat_index === 0) {
            toast.success(`${updatedPlayer.username}님이 새로운 방장이 되었습니다.`);
            // 현재 플레이어가 새로운 방장이 된 경우
            if (updatedPlayer.id === playerId) {
              setIsRoomOwner(true);
              toast.success('당신이 새로운 방장이 되었습니다!');
            }
          }
        }
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}` 
        }, 
        (payload) => {
          console.log('플레이어 퇴장:', payload);
          // 플레이어 퇴장
          const deletedPlayer = payload.old as Player;
          
          // 현재 플레이어가 퇴장한 경우 (방을 나가는 경우)
          if (deletedPlayer.id === playerId) {
            // API 호출을 통해 방을 나가는 처리를 합니다.
            return;
          }
          
          setPlayers(prevPlayers => 
            prevPlayers.filter(player => player.id !== deletedPlayer.id)
          );
          toast.success(`${deletedPlayer.username}님이 퇴장했습니다.`);
        }
      )
      .subscribe();
      
    // 2. rooms 테이블 구독 - 방 정보 변경 감지  
    const roomsSubscription = supabase
      .channel(`room-detail-${roomId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('방 정보 업데이트:', payload);
          // 방 정보 업데이트
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);
          
          // 방 비활성화 알림
          if (!updatedRoom.is_active) {
            toast.error('방이 비활성화되었습니다. 방 목록으로 이동합니다.');
            router.push('/room');
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('방 삭제:', payload);
          toast.error('방이 삭제되었습니다. 방 목록으로 이동합니다.');
          router.push('/room');
        }
      )
      .subscribe();
    
    // 구독 정리
    return () => {
      playersSubscription.unsubscribe();
      roomsSubscription.unsubscribe();
    };
  }, [roomId, playerId, router]);

  // 준비 상태 토글
  const handleToggleReady = async () => {
    try {
      setChangingReady(true);
      await togglePlayerReady(roomId, playerId, !myReadyStatus);
      toast.success(myReadyStatus ? '준비 취소되었습니다.' : '준비 완료!');
    } catch (err) {
      console.error('준비 상태 변경 오류:', err);
      toast.error('준비 상태를 변경하는 중 오류가 발생했습니다.');
    } finally {
      setChangingReady(false);
    }
  };
  
  // 게임 시작 - 방장만 가능
  const handleStartGame = async () => {
    if (!room || !isRoomOwner) return;
    
    // 최소 2명 이상, 모든 플레이어가 준비 상태인지 확인
    const playerCount = players.length;
    const readyCount = players.filter(p => p.is_ready).length;
    
    if (playerCount < 2) {
      toast.error('게임을 시작하려면 최소 2명의 플레이어가 필요합니다.');
      return;
    }
    
    if (readyCount < playerCount - 1) { // 방장 제외 모두 준비해야 함
      toast.error('모든 플레이어가 준비를 완료해야 게임을 시작할 수 있습니다.');
      return;
    }
    
    try {
      setStartingGame(true);
      setError(null);
      
      const gameId = await createGameInRoom(roomId);
      
      toast.success('게임이 시작됩니다!');
      router.push(`/game/${gameId}`);
    } catch (err: any) {
      console.error('게임 시작 오류:', err);
      setError(err.message || '게임을 시작하는 중 오류가 발생했습니다.');
      setStartingGame(false);
    }
  };

  // 방 나가기
  const handleLeaveRoom = async () => {
    try {
      await leaveRoom(roomId, playerId);
      toast.success('방에서 나갔습니다.');
      router.push('/room');
    } catch (err) {
      console.error('방 나가기 오류:', err);
      toast.error('방을 나가는 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
        <div className="text-xl">대기실 정보 불러오는 중...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">방을 찾을 수 없습니다</h1>
          <p className="mb-6 text-gray-400">요청하신 방이 존재하지 않거나 삭제되었습니다.</p>
          <button
            onClick={() => router.push('/room')}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors">
            방 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-yellow-400">{room.name} <span className="text-sm text-gray-400">대기실</span></h1>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm ${room.mode === 2 ? 'bg-blue-600' : 'bg-purple-600'}`}>
              {room.mode}장 모드
            </span>
            <span className="px-3 py-1 bg-yellow-700 rounded-full text-sm">
              참가비: {room.entry_fee.toLocaleString()}원
            </span>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">플레이어 목록</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-3 rounded-lg flex items-center ${player.id === playerId ? 'bg-yellow-900 border border-yellow-600' : 'bg-gray-700'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center mr-3">
                      {player.username.substring(0, 1)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center">
                        <div className="font-bold">{player.username}</div>
                        {player.id === playerId && (
                          <span className="ml-2 text-xs bg-yellow-600 px-2 py-0.5 rounded">나</span>
                        )}
                        {player.seat_index === 0 && (
                          <span className="ml-2 text-xs bg-red-600 px-2 py-0.5 rounded">방장</span>
                        )}
                      </div>
                      <div className="text-sm text-yellow-300">
                        {player.balance.toLocaleString()}원
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm text-gray-400">
                        좌석 {player.seat_index! + 1}
                      </div>
                      {player.is_ready && (
                        <span className="text-xs bg-green-600 px-2 py-0.5 rounded mt-1">준비 완료</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* 빈 좌석 표시 */}
                {Array.from({ length: room.max_players - players.length }).map((_, index) => (
                  <div 
                    key={`empty-${index}`} 
                    className="p-3 rounded-lg flex items-center bg-gray-800 border border-gray-700 border-dashed text-gray-500"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                      ?
                    </div>
                    <div className="flex-grow">
                      <div>빈 좌석</div>
                      <div className="text-sm">대기 중..</div>
                    </div>
                    <div className="text-sm">
                      좌석 {players.length + index}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <div className="bg-gray-800 p-4 rounded-lg mb-4">
              <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">방 정보</h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400 block">게임 모드</span>
                  <span className="font-bold">
                    {room.mode === 2 ? '2장 모드' : '3장 모드'}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-400 block">베팅 방식</span>
                  <span className="font-bold">
                    {room.betting_option === 'standard' ? '일반베팅' : '단계별베팅'}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-400 block">인원</span>
                  <span className="font-bold">
                    {players.length}/{room.max_players} 명
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">액션</h2>
              
              <div className="space-y-3">
                {isRoomOwner ? (
                  <button
                    onClick={handleStartGame}
                    disabled={players.length < 2 || startingGame || players.filter(p => p.is_ready).length < players.length - 1}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    {startingGame ? '게임 시작 중...' : '게임 시작하기'}
                  </button>
                ) : (
                  <button
                    onClick={handleToggleReady}
                    disabled={changingReady}
                    className={`w-full py-3 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${myReadyStatus ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {changingReady ? '준비 상태 변경 중...' : myReadyStatus ? '준비 취소하기' : '준비 완료하기'}
                  </button>
                )}
                
                {players.length < 2 && (
                  <p className="text-sm text-gray-400 text-center">
                    게임을 시작하려면 최소 2명의 플레이어가 필요합니다.
                  </p>
                )}
                
                {isRoomOwner && players.length >= 2 && players.filter(p => p.is_ready).length < players.length - 1 && (
                  <p className="text-sm text-gray-400 text-center">
                    모든 플레이어가 준비를 완료해야 게임을 시작할 수 있습니다.
                  </p>
                )}
                
                <button
                  onClick={handleLeaveRoom}
                  disabled={startingGame}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  방 나가기
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg mt-4">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">게임 규칙</h2>
          
          <div className="text-sm text-gray-300">
            {room.mode === 2 ? (
              <div>
                <p className="mb-2"><strong>2장 모드</strong>: 각 플레이어는 2장의 카드를 받습니다.</p>
                <p>기본 베팅 금액은 10원이며, 베팅 금액에 따라 콜, 다이, 레이즈를 선택할 수 있습니다.</p>
              </div>
            ) : (
              <div>
                <p className="mb-2"><strong>3장 모드</strong>: 각 플레이어는 3장의 카드를 받고, 그 중 2장을 선택합니다.</p>
                <p>먼저 2장을 받고 베팅 후, 추가로 1장을 받아 최종 2장을 선택하여 승부합니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
