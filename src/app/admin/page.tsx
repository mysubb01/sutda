"use client";

import { useState, useEffect } from 'react';
import { Room, Player } from '@/types/game';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  updateGameBaseBet, 
  kickPlayer,
  togglePlayerMute,
  updatePlayerBalance,
  getRoomDetails
} from '@/lib/adminApi';

interface GameDetails {
  room: Room;
  players: Player[];
  currentGame: any | null;
}

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<GameDetails | null>(null);
  
  // 설정 변경 상태
  const [baseBet, setBaseBet] = useState<number>(0);
  const [playerToUpdateId, setPlayerToUpdateId] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<number>(0);
  
  const router = useRouter();

  // 방 목록 가져오기
  useEffect(() => {
    async function fetchRooms() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setRooms(data || []);
      } catch (error: any) {
        console.error('방 목록을 가져오는 중 오류 발생:', error.message);
        setError('방 목록을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchRooms();
  }, []);

  // 방 선택 시 해당 방의 상세 정보 가져오기
  const handleRoomSelect = async (room: Room) => {
    try {
      setSelectedRoom(room);
      setLoading(true);
      setError(null);
      setSuccess(null);

      // 방 상세 정보 가져오기
      const response = await getRoomDetails(room.id);
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '방 정보를 불러올 수 없습니다');
      }
      
      setRoomDetails(response.data);
      setPlayers(response.data.players || []);
      
      // 초기 값 설정
      setBaseBet(response.data.currentGame?.base_bet || 10); // 기본값 10

    } catch (error: any) {
      console.error('플레이어 목록을 가져오는 중 오류 발생:', error.message);
      setError('방 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  // 기본 베팅액(블라인드) 변경 핸들러
  const handleBaseBetUpdate = async () => {
    if (!selectedRoom) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await updateGameBaseBet(selectedRoom.id, baseBet);
      
      if (response.success) {
        setSuccess(response.message);
        // 게임 정보 업데이트
        if (roomDetails?.currentGame) {
          setRoomDetails(prev => {
            if (!prev) return null;
            return {
              ...prev,
              currentGame: { ...prev.currentGame, base_bet: baseBet }
            };
          });
        }
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('기본 베팅액 변경 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 플레이어 강퇴 핸들러
  const handleKickPlayer = async (playerId: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await kickPlayer(playerId);
      
      if (response.success) {
        setSuccess(response.message);
        // 플레이어 목록에서 제거
        setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== playerId));
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('플레이어 강퇴 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 플레이어 채팅 금지 핸들러
  const handleToggleMute = async (playerId: string, isMuted: boolean) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await togglePlayerMute(playerId, isMuted);
      
      if (response.success) {
        setSuccess(response.message);
        // 플레이어 상태 업데이트
        setPlayers(prevPlayers => 
          prevPlayers.map(player => 
            player.id === playerId ? { ...player, is_muted: isMuted } : player
          )
        );
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('채팅 금지 설정 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 플레이어 잔액 수정 다이얼로그 열기
  const openBalanceUpdateDialog = (playerId: string) => {
    setPlayerToUpdateId(playerId);
    setBalanceAmount(0);
  };

  // 플레이어 잔액 수정 핸들러
  const handleBalanceUpdate = async () => {
    if (!playerToUpdateId) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await updatePlayerBalance(playerToUpdateId, balanceAmount);
      
      if (response.success) {
        setSuccess(response.message);
        // 플레이어 잔액 업데이트
        setPlayers(prevPlayers => 
          prevPlayers.map(player => {
            if (player.id === playerToUpdateId) {
              return { ...player, balance: player.balance + balanceAmount };
            }
            return player;
          })
        );
        // 다이얼로그 닫기
        setPlayerToUpdateId(null);
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('플레이어 잔액 수정 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 성공/에러 메시지 표시 후 일정 시간 후 사라지게 처리
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (success || error) {
      timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [success, error]);

  return (
    <div className="container mx-auto p-4 bg-gradient-to-br from-gray-900 to-blue-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-white border-b-2 border-blue-400 pb-2">관리자 설정</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-4 shadow-md">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded mb-4 shadow-md">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 방 목록 */}
        <div className="md:col-span-1 bg-white bg-opacity-10 shadow-lg rounded-lg p-5 backdrop-blur-sm text-white border border-blue-400">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">방 목록</h2>
          {loading && <p className="text-gray-300">로딩 중...</p>}
          
          {!loading && rooms.length === 0 && (
            <p className="text-gray-300">활성화된 방이 없습니다.</p>
          )}

          <ul className="space-y-2">
            {rooms.map((room) => (
              <li 
                key={room.id} 
                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedRoom?.id === room.id ? 'bg-blue-700 border-l-4 border-yellow-400' : 'hover:bg-gray-700 border-l-4 border-transparent'}`}
                onClick={() => handleRoomSelect(room)}
              >
                <div className="font-medium text-yellow-300">{room.name}</div>
                <div className="text-sm text-gray-300">
                  기본 베팅액: {(room.default_base_bet || 10).toLocaleString()}원 | 최대 인원: {room.max_players}명
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 방 설정 및 플레이어 관리 */}
        <div className="md:col-span-2 bg-white bg-opacity-10 shadow-lg rounded-lg p-5 backdrop-blur-sm text-white border border-blue-400">
          {!selectedRoom ? (
            <div className="text-center py-16 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              왼쪽에서 방을 선택하세요
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-yellow-300">{selectedRoom.name} 관리</h2>
              
              {/* 방 설정 */}
              <div className="mb-6 p-5 border border-blue-500 rounded-lg bg-blue-900 bg-opacity-30">
                <h3 className="font-medium mb-4 text-blue-300 border-b border-blue-600 pb-2">방 설정</h3>
                
                {/* 블라인드(기본 베팅액) 설정 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">기본 베팅액(블라인드) 설정</label>
                  <div className="flex items-center gap-2">
                    <select 
                      className="border bg-gray-800 border-blue-500 rounded-md p-2 w-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={baseBet}
                      onChange={(e) => setBaseBet(Number(e.target.value))}
                    >
                      <option value="5">5원</option>
                      <option value="10">10원</option>
                      <option value="20">20원</option>
                      <option value="50">50원</option>
                      <option value="100">100원</option>
                      <option value="500">500원</option>
                      <option value="1000">1,000원</option>
                    </select>
                    <button 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                      onClick={handleBaseBetUpdate}
                      disabled={loading}
                    >
                      변경
                    </button>
                  </div>
                </div>
              </div>

              {/* 플레이어 목록 및 관리 */}
              <div className="p-5 border border-purple-500 rounded-lg bg-purple-900 bg-opacity-30">
                <h3 className="font-medium mb-4 text-purple-300 border-b border-purple-600 pb-2">플레이어 관리</h3>
                
                {loading && <p className="text-gray-300">로딩 중...</p>}
                
                {!loading && players.length === 0 && (
                  <p className="text-gray-300">현재 방에 플레이어가 없습니다.</p>
                )}

                {!loading && players.length > 0 && (
                  <ul className="space-y-4">
                    {players.map((player) => (
                      <li key={player.id} className="p-4 border border-purple-600 rounded-lg bg-purple-800 bg-opacity-30 hover:bg-opacity-40 transition-all">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="font-medium text-yellow-300">{player.username}</div>
                            <div className="text-sm text-gray-300">보유금: <span className="text-green-300 font-semibold">{player.balance.toLocaleString()}원</span></div>
                          </div>
                          
                          {/* 플레이어 관리 버튼 (강퇴, 채팅금지, 금액 수정 등) */}
                          <div className="flex gap-2">
                            <button 
                              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                              onClick={() => handleKickPlayer(player.id)}
                              disabled={loading}
                            >
                              강퇴
                            </button>
                            <button 
                              className={`px-3 py-1 text-sm ${player.is_muted ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'} text-white rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500`}
                              onClick={() => handleToggleMute(player.id, !player.is_muted)}
                              disabled={loading}
                            >
                              {player.is_muted ? '채팅허용' : '채팅금지'}
                            </button>
                            <button 
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={() => openBalanceUpdateDialog(player.id)}
                              disabled={loading}
                            >
                              금액 수정
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 플레이어 잔액 수정 다이얼로그 */}
      {playerToUpdateId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-blue-300 border-b border-blue-700 pb-2">플레이어 금액 수정</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">금액 조정</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  className="border border-blue-500 bg-gray-700 rounded-md p-2 w-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(Number(e.target.value))}
                  placeholder="변경할 금액 입력 (음수는 차감)"
                />
              </div>
              <p className="text-sm text-gray-400 mt-1">
                양수: 금액 추가, 음수: 금액 차감
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 border border-gray-500 text-gray-300 rounded-md hover:bg-gray-700 transition-colors focus:outline-none"
                onClick={() => setPlayerToUpdateId(null)}
              >
                취소
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={handleBalanceUpdate}
                disabled={loading}
              >
                변경 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
