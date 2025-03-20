// 메시지 목록
{messages.map((msg) => (
  <div 
    key={msg.id} 
    className={`my-2 p-2 rounded-lg ${msg.user_id === currentUserId ? 'bg-blue-600 ml-auto' : 'bg-gray-700'}`} 
    style={{ maxWidth: '80%', alignSelf: msg.user_id === currentUserId ? 'flex-end' : 'flex-start' }}
  >
    <div className="text-xs text-gray-300">{msg.username}</div>
    <div className="mt-1">{msg.content}</div>
  </div>
))} 