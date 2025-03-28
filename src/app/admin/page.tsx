"use client";

import React from 'react';
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

// 게임 상태를 한글로 변환하는 함수
function gameStatusToKorean(status: string | undefined): string {
  if (!status) return '알 수 없음';
  switch (status) {
    case 'waiting': return '대기 중';
    case 'playing': return '게임 중';
    case 'finished': return '게임 종료';
    case 'regame': return '재경기 대기';
    default: return status; // 알 수 없는 상태는 그대로 반환
  }
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

      console.log('방 선택:', room.id, room.name);

      // 방 상세 정보 가져오기
      const response = await getRoomDetails(room.id);
      
      console.log('API 응답:', response);
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '방 정보를 불러올 수 없습니다');
      }
      
      console.log('방 정보:', response.data);
      
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

  const message = success || error;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 탭 네비게이션 */}
      <div className="mb-8 border-b border-gray-300 bg-white shadow-md rounded-lg">
        <div className="flex space-x-1 p-1">
          <button
            className={`py-3 px-6 ${activeTab === AdminTab.ROOMS
              ? 'bg-blue-700 text-white font-bold'
              : 'bg-white text-gray-800 hover:bg-blue-100'} rounded-t-lg transition duration-200`}
            onClick={() => setActiveTab(AdminTab.ROOMS)}
          >
            방 관리
          </button>
          <button
            className={`py-3 px-6 ${activeTab === AdminTab.PLAYERS
              ? 'bg-blue-700 text-white font-bold'
              : 'bg-white text-gray-800 hover:bg-blue-100'} rounded-t-lg transition duration-200`}
            onClick={() => setActiveTab(AdminTab.PLAYERS)}
          >
            전체 플레이어
          </button>
        </div>
      </div>

      {/* 알림 메시지 */}
      {message && (
        <div className={`p-4 mb-6 rounded-lg shadow-md ${success ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
          <div className="flex items-center">
            <div className={`rounded-full p-1 mr-3 ${success ? 'bg-green-200' : 'bg-red-200'}`}>
              <svg className={`h-5 w-5 ${success ? 'text-green-700' : 'text-red-700'}`} fill="currentColor" viewBox="0 0 20 20">
                {success ? (
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
                ) : (
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.28 7.22a.75.75 0 0 1 0-1.06.75.75 0 0 1 1.06 0l.72.72.72-.72a.75.75 0 0 1 1.06 0 .75.75 0 0 1 0 1.06l-.72.72.72.72a.75.75 0 0 1-1.06 1.06l-.72-.72-.72.72a.75.75 0 0 1-1.06-1.06l.72-.72-.72-.72z" clipRule="evenodd"/>
                )}
              </svg>
            </div>
            <span className="font-medium">{message}</span>
          </div>
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
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">방 이름</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">생성일</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rooms.map((room) => (
                      <React.Fragment key={room.id}>
                        <tr 
                          className={`hover:bg-blue-50 cursor-pointer ${selectedRoom?.id === room.id ? 'bg-blue-200 border-b-0' : ''}`}
                          onClick={() => handleRoomSelect(room)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <span className="font-medium text-blue-800">{room.name}</span>
                              {selectedRoom?.id === room.id && (
                                <svg className="ml-2 h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-800">
                            {new Date(room.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRoom(room.id);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                        
                        {/* 방 정보 디테일 */}
                        {selectedRoom?.id === room.id && roomDetails && (
                          <tr className="bg-blue-50">
                            <td colSpan={3} className="p-0">
                              <div className="border-t-0 border border-blue-200 bg-white rounded-b-lg shadow-inner">
                                <div className="p-4">
                                  {/* 방 정보 */}
                                  <div className="flex justify-between items-center border-b border-blue-100 pb-3 mb-4">
                                    <h3 className="text-lg font-semibold text-blue-800">
                                      {room.name} - 방 정보
                                    </h3>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleRoomSelect(room)} 
                                        className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* 현재 게임 정보 */}
                                    <div>
                                      <h4 className="text-md font-semibold mb-2 text-blue-800 border-b border-blue-200 pb-1">
                                        현재 게임 정보
                                      </h4>
                                      {roomDetails.currentGame ? (
                                        <div className="bg-blue-100 p-3 rounded-md">
                                          <p><span className="font-medium text-gray-800">상태:</span> <span className="text-blue-800 font-medium">{gameStatusToKorean(roomDetails.currentGame.status)}</span></p>
                                          <p><span className="font-medium text-gray-800">총 포트:</span> <span className="text-green-700 font-medium">{roomDetails.currentGame.total_pot?.toLocaleString() || 0}원</span></p>
                                          <p><span className="font-medium text-gray-800">기본 베팅액(블라인드):</span> <span className="text-gray-900">{roomDetails.currentGame.base_bet?.toLocaleString() || 0}원</span></p>
                                        </div>
                                      ) : (
                                        <p className="text-gray-600 italic">현재 진행 중인 게임이 없습니다</p>
                                      )}
                                    </div>
                                    
                                    {/* 방 정보 */}
                                    <div>
                                      <h4 className="text-md font-semibold mb-2 text-blue-800 border-b border-blue-200 pb-1">
                                        방 정보
                                      </h4>
                                      <div className="bg-gray-100 p-3 rounded-md space-y-2">
                                        <p><span className="font-medium text-gray-800">방 모드:</span> <span className="text-gray-900">{roomDetails.room.mode} 모드</span></p>
                                        <p><span className="font-medium text-gray-800">최대 인원:</span> <span className="text-gray-900">{roomDetails.room.max_players || 0}명</span></p>
                                        <p><span className="font-medium text-gray-800">기본 베팅액(블라인드):</span> <span className="text-gray-900">{roomDetails.room.default_base_bet?.toLocaleString() || 0}원</span></p>
                                        <p><span className="font-medium text-gray-800">생성일:</span> <span className="text-gray-900">{roomDetails.room.created_at ? new Date(roomDetails.room.created_at).toLocaleString() : '정보 없음'}</span></p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* 방 설정 */}
                                  <div className="grid grid-cols-1 gap-4 bg-gray-100 p-3 rounded-md">
                                    {/* 기본 베팅액 설정 */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-800 mb-1">기본 베팅액(블라인드) 설정</label>
                                      <div className="flex space-x-2">
                                        <input 
                                          type="number" 
                                          className="border border-gray-300 px-3 py-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                          value={baseBet} 
                                          onChange={(e) => setBaseBet(parseInt(e.target.value) || 0)} 
                                          min="0"
                                        />
                                        <button 
                                          onClick={handleBaseBetUpdate} 
                                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors duration-200"
                                        >
                                          설정
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* 플레이어 목록 */}
                                  <div>
                                    <h4 className="text-md font-semibold mb-2 text-blue-800 border-b border-blue-200 pb-1">
                                      플레이어 목록
                                    </h4>
                                    {players.length === 0 ? (
                                      <p className="text-gray-600 italic">현재 방에 플레이어가 없습니다</p>
                                    ) : (
                                      <div className="overflow-x-auto bg-white border border-gray-200 rounded-md">
                                        <table className="min-w-full divide-y divide-gray-200">
                                          <thead className="bg-gray-200">
                                            <tr>
                                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-800">플레이어</th>
                                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-800">잔액</th>
                                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-800">상태</th>
                                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-800">관리</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-200">
                                            {players.map((player) => (
                                              <tr key={player.id} className="hover:bg-blue-50">
                                                <td className="px-2 py-2">
                                                  <div className="text-sm font-medium text-blue-800">{player.username}</div>
                                                  <div className="flex space-x-1 mt-1">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${player.is_muted ? 'bg-red-200 text-red-900' : 'bg-green-200 text-green-900'}`}>
                                                      {player.is_muted ? '채팅 금지' : '채팅 가능'}
                                                    </span>
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${player.is_ready ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-900'}`}>
                                                      {player.is_ready ? '준비 완료' : '대기 중'}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                  <div className="text-sm font-medium text-green-700">{player.balance.toLocaleString()}원</div>
                                                </td>
                                                <td className="px-2 py-2">
                                                  <div className="flex flex-col space-y-1">
                                                    <button
                                                      onClick={() => openBalanceUpdateDialog(player.id)}
                                                      className="bg-indigo-200 hover:bg-indigo-300 text-indigo-900 px-2 py-1 rounded text-xs transition-colors duration-200"
                                                    >
                                                      잔액 수정
                                                    </button>
                                                    <button
                                                      onClick={() => handleToggleMute(player.id, !player.is_muted)}
                                                      className={`${player.is_muted ? 'bg-green-200 hover:bg-green-300 text-green-900' : 'bg-red-200 hover:bg-red-300 text-red-900'} px-2 py-1 rounded text-xs transition-colors duration-200`}
                                                    >
                                                      {player.is_muted ? '채팅 해제' : '채팅 금지'}
                                                    </button>
                                                    <button
                                                      onClick={() => handleKickPlayer(player.id)}
                                                      className="bg-red-200 hover:bg-red-300 text-red-900 px-2 py-1 rounded text-xs transition-colors duration-200"
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 방 정보 디버깅 */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-4 p-4 border border-blue-300">
            <h2 className="text-lg font-bold text-blue-800 mb-2">방 정보 상태:</h2>
            <div>
              <p className="mb-2"><span className="font-medium">선택한 방:</span> {selectedRoom ? selectedRoom.name : '없음'}</p>
              <p className="mb-2"><span className="font-medium">roomDetails:</span> {roomDetails ? '존재함' : 'null'}</p>
              <p className="mb-2"><span className="font-medium">로딩 상태:</span> {loading ? '로딩 중' : '완료'}</p>
              <p className="mb-2"><span className="font-medium">플레이어 수:</span> {players.length}</p>
              <button 
                onClick={() => {
                  if (selectedRoom) {
                    console.log('방 새로고침 시도:', selectedRoom);
                    handleRoomSelect(selectedRoom);
                  }
                }} 
                className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded"
              >
                다시 불러오기
              </button>
            </div>
          </div>

          {/* 기존 roomDetails 조건부 렌더링 코드 제거 */}
        </div>
      )}

      {/* 전체 플레이어 탭 컨텐츠 */}
      {activeTab === AdminTab.PLAYERS && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-blue-100">
            <h2 className="text-lg font-semibold text-blue-900">전체 플레이어 목록</h2>
          </div>
          
          {loading ? (
            <div className="p-4 text-center">로딩 중...</div>
          ) : allPlayers.length === 0 ? (
            <div className="p-4 text-center text-gray-600">등록된 플레이어가 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">플레이어</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">잔액</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">등록일</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-blue-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-blue-800">{player.username}</div>
                            <div className="text-xs text-gray-600">{player.user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-green-700">{player.balance.toLocaleString()}원</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">
                          {player.created_at ? new Date(player.created_at).toLocaleString() : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openBalanceUpdateDialog(player.id)}
                            className="bg-indigo-200 hover:bg-indigo-300 text-indigo-900 px-2 py-1 rounded text-xs transition-colors duration-200"
                          >
                            잔액 수정
                          </button>
                          <button
                            onClick={() => handleToggleMute(player.id, !player.is_muted)}
                            className={`${player.is_muted ? 'bg-green-200 hover:bg-green-300 text-green-900' : 'bg-red-200 hover:bg-red-300 text-red-900'} px-2 py-1 rounded text-xs transition-colors duration-200`}
                          >
                            {player.is_muted ? '채팅 해제' : '채팅 금지'}
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
      )}

      {/* 잔액 수정 모달 */}
      {playerToUpdateId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">플레이어 잔액 수정</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-1">변경 금액 (+ 증가, - 감소)</label>
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
