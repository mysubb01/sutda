'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Message } from '@/types/game';
import { sendMessage } from '@/lib/gameApi';

interface ChatProps {
  gameId: string;
  playerId: string;
  username: string;
  messages: Message[];
}

export function Chat({ gameId, playerId, username, messages }: ChatProps) {
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  
  // 새 메시지가 오면 스크롤을 아래로 이동
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // 메시지 전송 처리
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim()) return;
    
    setIsLoading(true);
    
    try {
      await sendMessage(gameId, playerId, messageText);
      setMessageText('');
    } catch (err) {
      console.error('메시지 전송 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 bg-opacity-80 rounded-lg border border-yellow-600 shadow-lg overflow-hidden text-xs">
      <div className="p-1 bg-gradient-to-r from-yellow-700 to-yellow-900 border-b border-yellow-600">
        <h2 className="text-xs font-bold text-yellow-300">채팅</h2>
      </div>
      
      <div 
        ref={chatBoxRef}
        className="flex-grow p-1 overflow-y-auto"
        style={{ maxHeight: 'calc(100% - 40px)' }}
      >
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center italic text-xs">메시지가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`${
                  message.user_id === localStorage.getItem(`game_${gameId}_user_id`)
                    ? 'bg-blue-900 ml-2 rounded-md' 
                    : 'bg-gray-800 mr-2 rounded-md'
                } p-1 shadow-md text-xs`}
              >
                <div className="flex items-center space-x-1">
                  <span className={`font-bold text-xs ${
                    message.user_id === localStorage.getItem(`game_${gameId}_user_id`) ? 'text-blue-300' : 'text-yellow-300'
                  }`}>
                    {message.username.substring(0, 5)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-white break-words text-xs">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <form onSubmit={handleSendMessage} className="p-1 bg-gray-800 border-t border-gray-700">
        <div className="flex space-x-1">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-grow px-1 py-0.5 bg-gray-700 text-white text-xs rounded-lg border border-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            placeholder="메시지 입력..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !messageText.trim()}
            className={`px-1 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold rounded-lg transition-all ${
              isLoading || !messageText.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Image 
              src="/images/ui/send.png" 
              alt="전송" 
              width={12} 
              height={12} 
              className="w-3 h-3"
            />
          </button>
        </div>
      </form>
    </div>
  );
} 