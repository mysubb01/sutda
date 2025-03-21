'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoom, getRoomInfo } from '@/lib/roomApi';
import { Room } from '@/types/game';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params;
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoomInfo() {
      try {
        setLoading(true);
        const roomInfo = await getRoomInfo(roomId);
        setRoom(roomInfo);
        setError(null);
      } catch (err) {
        console.error('방 정보 로딩 오류:', err);
        setError('방 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    // 초기 방 정보 로딩
    loadRoomInfo();
    
    // Supabase Realtime 구독 - 방 정보 업데이트
    const roomSubscription = supabase
      .channel(`room-details-${roomId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'rooms',
          filter: `id=eq.${roomId}` // 특정 방 ID에 대한 업데이트
        },
        (payload) => {
          console.log('방 정보 업데이트:', payload);
          
          if (payload.eventType === 'UPDATE') {
            // 방 정보 업데이트
            const updatedRoom = payload.new as Room;
            setRoom(updatedRoom);
          } else if (payload.eventType === 'DELETE') {
            // 방 삭제
            toast.error('방이 삭제되었습니다.');
            router.push('/room');
          }
        }
      )
      .subscribe();
      
    // 구독 해제
    return () => {
      roomSubscription.unsubscribe();
    };
  }, [roomId, router]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    
    try {
      setJoining(true);
      setError(null);
      
      const { playerId, roomId: joinedRoomId } = await joinRoom(roomId, username);
      
      toast.success('방에 입장했습니다!');
      // 게임 페이지로 이동 - 현재는 방 ID와 플레이어 ID를 함께 전달
      router.push(`/game/${roomId}`);
    } catch (err: any) {
      console.error('방 입장 오류:', err);
      setError(err.message || '방에 입장하는 도중 오류가 발생했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
        <div className="text-xl">방 정보 불러오는 중...</div>
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
    <div className="min-h-screen bg-gray-900 text-white p-4 flex justify-center items-center">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-center mb-2 text-yellow-400">{room.name}</h1>
        
        <div className="flex justify-center mb-6">
          <span className={`px-3 py-1 rounded-full text-sm ${room.mode === 2 ? 'bg-blue-600' : 'bg-purple-600'}`}>
            {room.mode}장 모드
          </span>
        </div>
        
        <div className="mb-6 grid grid-cols-2 gap-4 bg-gray-700 p-4 rounded-lg">
          <div>
            <p className="text-gray-400 text-sm">참가비</p>
            <p className="text-yellow-300 font-bold">{room.entry_fee.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">플레이어</p>
            <p className={room.current_players === room.max_players ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
              {room.current_players || 0}/{room.max_players}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">베팅 방식</p>
            <p className="font-bold">
              {room.betting_option === 'standard' ? '일반베팅' : '단계별베팅'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">생성일</p>
            <p className="text-sm">
              {new Date(room.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        
        {room.current_players === room.max_players ? (
          <div className="bg-red-600 bg-opacity-30 p-4 rounded-lg mb-6 text-center">
            <p className="text-white">현재 방이 가득 찼습니다. 나중에 다시 시도해주세요.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-600 text-white p-3 rounded-md mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleJoinRoom} className="mb-6">
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">닉네임</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="게임에서 사용할 닉네임"
                  maxLength={12}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">참가비 안내</label>
                <div className="bg-gray-700 p-3 rounded-md text-sm">
                  <p>이 방에 입장하시면 <span className="text-yellow-300 font-bold">{room.entry_fee.toLocaleString()}원</span>의 참가비가 자동으로 차감됩니다.</p>
                  <p className="mt-1 text-gray-400">입장 후 시작 전까지는 언제든지 방을 나갈 수 있으며, 이 경우 참가비는 환불됩니다.</p>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => router.push('/room')}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                  disabled={joining}
                >
                  목록으로
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={joining}
                >
                  {joining ? '입장 중...' : '입장하기'}
                </button>
              </div>
            </form>
          </>
        )}
        
        <div className="mt-4 text-sm text-gray-400">
          <h3 className="font-bold mb-2">게임 모드 안내</h3>
          {room.mode === 2 ? (
            <p>2장 모드: 기본적인 섯다 게임으로, 2장의 카드로 족보를 결정하여 승부합니다.</p>
          ) : (
            <p>3장 모드: 2장을 받고 1장을 공개 후 베팅, 이후 추가 1장을 받아 총 3장 중 최종 2장을 선택하여 족보를 결정합니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
