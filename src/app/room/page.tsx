'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllRooms } from '@/lib/roomApi';
import { Room } from '@/types/game';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function RoomListPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        const roomList = await getAllRooms();
        setRooms(roomList);
        setError(null);
      } catch (err) {
        console.error('방 목록 로딩 오류:', err);
        setError('방 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    // 초기 데이터 로드
    loadRooms();

    // Supabase Realtime 구독 설정 - 방 목록 변경 감지
    const roomsSubscription = supabase
      .channel('rooms-list-changes')
      .on('postgres_changes', 
        { 
          event: '*',  // insert, update, delete 모두 감지
          schema: 'public',
          table: 'rooms' 
        },
        (payload) => {
          console.log('방 목록 변경 감지:', payload);
          
          // 페이로드를 직접 활용하여 효율적으로 상태 업데이트
          if (payload.eventType === 'INSERT') {
            // 새로운 방이 생성된 경우
            const newRoom = payload.new as Room;
            setRooms(prevRooms => [...prevRooms, newRoom]);
          } else if (payload.eventType === 'UPDATE') {
            // 방 정보가 업데이트된 경우
            const updatedRoom = payload.new as Room;
            setRooms(prevRooms => 
              prevRooms.map(room => 
                room.id === updatedRoom.id ? updatedRoom : room
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // 방이 삭제된 경우
            const deletedRoomId = payload.old.id;
            setRooms(prevRooms => 
              prevRooms.filter(room => room.id !== deletedRoomId)
            );
          }
        }
      )
      .subscribe();

    // 구독 정리
    return () => {
      roomsSubscription.unsubscribe();
    };
  }, []);

  const handleCreateRoom = () => {
    router.push('/room/create');
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/game/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center my-8 text-yellow-400">섯다 게임방 목록</h1>
        
        <div className="mb-6 flex justify-between items-center">
          <div>
            <button 
              onClick={handleCreateRoom}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors">
              새 방 만들기
            </button>
          </div>
          <div className="text-sm text-gray-400">
            {loading ? '방 목록 로딩 중...' : `총 ${rooms.length}개의 방이 운영 중입니다.`}
          </div>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-4 mb-6 rounded-lg">
            {error}
          </div>
        )}

        {rooms.length === 0 && !loading ? (
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <p className="text-gray-400 mb-4">현재 운영 중인 방이 없습니다.</p>
            <button 
              onClick={handleCreateRoom}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors">
              첫 번째 방 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div 
                key={room.id} 
                className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-yellow-600 cursor-pointer transition-all"
                onClick={() => handleJoinRoom(room.id)}
              >
                <div className="px-6 py-4">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold text-yellow-400 truncate pr-2">{room.name}</h2>
                    <span className={`px-2 py-1 rounded-full text-xs ${room.mode === 2 ? 'bg-blue-600' : 'bg-purple-600'}`}>
                      {room.mode}장 모드
                    </span>
                  </div>
                  
                  <div className="text-gray-400 text-sm mt-4 flex items-center justify-between">
                    <div>
                      <span className="font-semibold">참가비: </span>
                      <span className="text-yellow-300">{room.entry_fee.toLocaleString()}원</span>
                    </div>
                    <div>
                      <span className="font-semibold">베팅방식: </span>
                      <span>
                        {room.betting_option === 'standard' ? '일반베팅' : '단계별베팅'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-between text-sm">
                    <div>
                      <span className="text-gray-400">인원: </span>
                      <span className={room.current_players === room.max_players ? 'text-red-400' : 'text-green-400'}>
                        {room.current_players || 0}/{room.max_players}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      {new Date(room.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-3 bg-gray-700 text-center">
                  <button 
                    className="text-yellow-300 font-bold hover:text-yellow-100 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinRoom(room.id);
                    }}
                  >
                    입장하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
