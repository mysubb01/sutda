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
  getRoomDetails,
  deleteRoom,
  getAllPlayers
} from '@/lib/adminApi';

interface GameDetails {
  room: Room;
  players: Player[];
  currentGame: any | null;
}

enum AdminTab {
  ROOMS = 'rooms',
  PLAYERS = 'players'
}

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<GameDetails | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.ROOMS);
  
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
  }, [success]);

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

  // 방 삭제 핸들러
  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('정말로 이 방을 삭제하시겠습니까? 방에 포함된 모든 데이터가 삭제됩니다.')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await deleteRoom(roomId);
      
      if (response.success) {
        setSuccess(response.message);
        // 방 목록에서 삭제
        setRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
        // 선택된 방이 삭제된 방이었다면 리셋
        if (selectedRoom?.id === roomId) {
          setSelectedRoom(null);
          setRoomDetails(null);
          setPlayers([]);
        }
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError('방 삭제 중 오류가 발생했습니다');
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

  // 전체 플레이어 목록 가져오기
  useEffect(() => {
    async function fetchAllPlayers() {
      if (activeTab !== AdminTab.PLAYERS) return;
      
      try {
        setLoading(true);
        const response = await getAllPlayers();
        
        if (response.success && response.data) {
          setAllPlayers(response.data);
        } else {
          setError(response.message);
        }
      } catch (error: any) {
        console.error('전체 플레이어 목록을 가져오는 중 오류 발생:', error.message);
        setError('전체 플레이어 목록을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchAllPlayers();
  }, [activeTab, success]);

  return (
    <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 border-b-2 border-blue-400 pb-2">관리자 설정</h1>
      
      {/* 탭 메뉴 */}
      <div className="flex bg-white rounded-t-lg mb-6 shadow">
        <button
          className={`px-6 py-3 font-medium ${activeTab === AdminTab.ROOMS ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'} rounded-tl-lg transition-colors`}
          onClick={() => setActiveTab(AdminTab.ROOMS)}
        >
          방 관리
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === AdminTab.PLAYERS ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'} transition-colors`}
          onClick={() => setActiveTab(AdminTab.PLAYERS)}
        >
          전체 플레이어
        </button>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded" role="alert">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded" role="alert">
          <p>{success}</p>
        </div>
      )}

      {/* 방 관리 탭 컨텐츠 */}
      {activeTab === AdminTab.ROOMS && (
        <div className="space-y-6">
          {/* 방 목록 */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b bg-blue-50">
              <h2 className="text-lg font-semibold text-blue-800">방 목록</h2>
            </div>
            <div className="overflow-x-auto">
              {loading && !selectedRoom ? (
                <div className="p-4 text-center">로딩 중...</div>
              ) : rooms.length === 0 ? (
                <div className="p-4 text-center text-gray-500">등록된 방이 없습니다</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">방 이름</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">생성일</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rooms.map((room) => (
                      <tr 
                        key={room.id} 
                        className={`hover:bg-blue-50 cursor-pointer ${selectedRoom?.id === room.id ? 'bg-blue-100' : ''}`}
                      >
                        <td className="py-3 px-4" onClick={() => handleRoomSelect(room)}>
                          <span className="font-medium text-blue-700">{room.name}</span>
                        </td>
                        <td className="py-3 px-4" onClick={() => handleRoomSelect(room)}>
                          {new Date(room.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 방 상세 정보 */}
          {roomDetails && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold">{roomDetails.room.name} 방 정보</h2>
                <button
                  onClick={() => handleDeleteRoom(roomDetails.room.id)}
                  className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                >
                  방 삭제
                </button>
              </div>
              
              <div className="p-4">
                {/* 현재 게임 정보 */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2 text-gray-700">게임 정보</h3>
                  <div className="bg-gray-50 p-4 rounded border">
                    {roomDetails.currentGame ? (
                      <div>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">기본 베팅액 (블라인드)</label>
                          <div className="flex items-center space-x-2">
                            <select
                              value={baseBet}
                              onChange={(e) => setBaseBet(Number(e.target.value))}
                              className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border rounded-md p-2"
                            >
                              <option value="5">5원</option>
                              <option value="10">10원</option>
                              <option value="50">50원</option>
                              <option value="100">100원</option>
                              <option value="500">500원</option>
                              <option value="1000">1,000원</option>
                            </select>
                            <button 
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={handleBaseBetUpdate}
                              disabled={loading}
                            >
                              변경
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">게임 상태: <span className="font-semibold">{roomDetails.currentGame.status || '알 수 없음'}</span></p>
                          <p className="text-sm text-gray-600">생성일: <span className="font-semibold">{new Date(roomDetails.currentGame.created_at).toLocaleString()}</span></p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">현재 진행 중인 게임이 없습니다</p>
                    )}
                  </div>
                </div>

                {/* 플레이어 목록 */}
                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">플레이어 목록</h3>
                  {players.length === 0 ? (
                    <p className="text-gray-500 p-4 bg-gray-50 rounded border">등록된 플레이어가 없습니다</p>
                  ) : (
                    <div className="overflow-x-auto bg-gray-50 rounded border">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">잔액</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {players.map((player) => (
                            <tr key={player.id}>
                              <td className="px-4 py-2">{player.username}</td>
                              <td className="px-4 py-2">{player.balance.toLocaleString()}원</td>
                              <td className="px-4 py-2">
                                <div className="flex space-x-2">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${player.is_muted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {player.is_muted ? '채팅 금지' : '채팅 가능'}
                                  </span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${player.is_ready ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {player.is_ready ? '준비 완료' : '대기 중'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => openBalanceUpdateDialog(player.id)}
                                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2 py-1 rounded text-xs"
                                  >
                                    잔액 수정
                                  </button>
                                  <button
                                    onClick={() => handleToggleMute(player.id, !player.is_muted)}
                                    className={`${player.is_muted ? 'bg-green-100 hover:bg-green-200 text-green-800' : 'bg-red-100 hover:bg-red-200 text-red-800'} px-2 py-1 rounded text-xs`}
                                  >
                                    {player.is_muted ? '채팅 해제' : '채팅 금지'}
                                  </button>
                                  <button
                                    onClick={() => handleKickPlayer(player.id)}
                                    className="bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded text-xs"
                                  >
                                    강퇴
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 전체 플레이어 탭 컨텐츠 */}
      {activeTab === AdminTab.PLAYERS && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-800">전체 플레이어 목록</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">로딩 중...</div>
          ) : allPlayers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">플레이어 정보가 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">플레이어</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">잔액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">방</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등록일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-blue-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-blue-700">{player.username}</div>
                            <div className="text-sm text-gray-500">{player.user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">{player.balance.toLocaleString()}원</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {player.rooms ? player.rooms.name : '없음'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          player.is_muted 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {player.is_muted ? '채팅 금지' : '정상'}
                        </span>
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          player.is_ready 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {player.is_ready ? '준비됨' : '대기중'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.created_at ? new Date(player.created_at).toLocaleString() : '등록일 없음'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openBalanceUpdateDialog(player.id)}
                          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2 py-1 mr-1 rounded text-xs"
                        >
                          잔액수정
                        </button>
                        <button
                          onClick={() => handleToggleMute(player.id, !player.is_muted)}
                          className={`mr-1 ${
                            player.is_muted 
                              ? 'bg-green-100 hover:bg-green-200 text-green-800' 
                              : 'bg-red-100 hover:bg-red-200 text-red-800'
                          } px-2 py-1 rounded text-xs`}
                        >
                          {player.is_muted ? '채팅해제' : '채팅금지'}
                        </button>
                        <button
                          onClick={() => handleKickPlayer(player.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded text-xs"
                        >
                          강퇴
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 잔액 수정 모달 */}
      {playerToUpdateId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">플레이어 잔액 수정</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">변경 금액 (+ 증가, - 감소)</label>
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(Number(e.target.value))}
                className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border rounded-md p-2"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setPlayerToUpdateId(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                취소
              </button>
              <button
                onClick={handleBalanceUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                disabled={loading}
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
