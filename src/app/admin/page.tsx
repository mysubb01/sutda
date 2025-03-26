"use client";

import { useState, useEffect } from 'react';
import { Room, Player } from '@/types/game';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  updateRoomEntryFee, 
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
  const [entryFee, setEntryFee] = useState<number>(0);
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
      setEntryFee(room.entry_fee);
      setBaseBet(response.data.currentGame?.base_bet || 10); // 기본값 10

    } catch (error: any) {
      console.error('플레이어 목록을 가져오는 중 오류 발생:', error.message);
      setError('방 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  // 바이인(참가비) 변경 핸들러
  const handleEntryFeeUpdate = async () => {
    if (!selectedRoom) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await updateRoomEntryFee(selectedRoom.id, entryFee);
      
      if (response.success) {
        setSuccess(response.message);
        // 방 목록 업데이트
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === selectedRoom.id ? { ...room, entry_fee: entryFee } : room
          )
        );
        setSelectedRoom(prev => prev ? { ...prev, entry_fee: entryFee } : null);
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('바이인 금액 변경 중 오류가 발생했습니다');
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">관리자 설정</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 방 목록 */}
        <div className="md:col-span-1 bg-white shadow rounded p-4">
          <h2 className="text-xl font-semibold mb-4">방 목록</h2>
          {loading && <p>로딩 중...</p>}
          
          {!loading && rooms.length === 0 && (
            <p>활성화된 방이 없습니다.</p>
          )}

          <ul className="space-y-2">
            {rooms.map((room) => (
              <li 
                key={room.id} 
                className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${selectedRoom?.id === room.id ? 'bg-blue-100' : ''}`}
                onClick={() => handleRoomSelect(room)}
              >
                <div className="font-medium">{room.name}</div>
                <div className="text-sm text-gray-600">
                  참가비: {room.entry_fee.toLocaleString()}원 | 최대 인원: {room.max_players}명
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 방 설정 및 플레이어 관리 */}
        <div className="md:col-span-2 bg-white shadow rounded p-4">
          {!selectedRoom ? (
            <div className="text-center py-6">왼쪽에서 방을 선택하세요</div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-4">{selectedRoom.name} 관리</h2>
              
              {/* 방 설정 */}
              <div className="mb-6 p-4 border rounded">
                <h3 className="font-medium mb-4">방 설정</h3>
                
                {/* 바이인(참가비) 설정 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">바이인 금액 변경</label>
                  <div className="flex items-center gap-2">
                    <select 
                      className="border rounded p-2 w-full"
                      value={entryFee}
                      onChange={(e) => setEntryFee(Number(e.target.value))}
                    >
                      <option value="100000">100,000원</option>
                      <option value="200000">200,000원</option>
                      <option value="300000">300,000원</option>
                      <option value="500000">500,000원</option>
                      <option value="1000000">1,000,000원</option>
                    </select>
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                      onClick={handleEntryFeeUpdate}
                      disabled={loading}
                    >
                      변경
                    </button>
                  </div>
                </div>
                
                {/* 블라인드(기본 베팅액) 설정 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 베팅액(블라인드) 설정</label>
                  <div className="flex items-center gap-2">
                    <select 
                      className="border rounded p-2 w-full"
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
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                      onClick={handleBaseBetUpdate}
                      disabled={loading}
                    >
                      변경
                    </button>
                  </div>
                </div>
              </div>

              {/* 플레이어 목록 및 관리 */}
              <div className="p-4 border rounded">
                <h3 className="font-medium mb-4">플레이어 관리</h3>
                
                {loading && <p>로딩 중...</p>}
                
                {!loading && players.length === 0 && (
                  <p>현재 방에 플레이어가 없습니다.</p>
                )}

                {!loading && players.length > 0 && (
                  <ul className="space-y-4">
                    {players.map((player) => (
                      <li key={player.id} className="p-4 border rounded">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="font-medium">{player.username}</div>
                            <div className="text-sm text-gray-600">보유금: {player.balance.toLocaleString()}원</div>
                          </div>
                          
                          {/* 플레이어 관리 버튼 (강퇴, 채팅금지, 금액 수정 등) */}
                          <div className="flex gap-2">
                            <button 
                              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                              onClick={() => handleKickPlayer(player.id)}
                              disabled={loading}
                            >
                              강퇴
                            </button>
                            <button 
                              className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                              onClick={() => handleToggleMute(player.id, !player.is_muted)}
                              disabled={loading}
                            >
                              {player.is_muted ? '채팅허용' : '채팅금지'}
                            </button>
                            <button 
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">플레이어 금액 수정</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">금액 조정</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  className="border rounded p-2 w-full" 
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(Number(e.target.value))}
                  placeholder="변경할 금액 입력 (음수는 차감)"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                양수: 금액 추가, 음수: 금액 차감
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 border rounded hover:bg-gray-100"
                onClick={() => setPlayerToUpdateId(null)}
              >
                취소
              </button>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
