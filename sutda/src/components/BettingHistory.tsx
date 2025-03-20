'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Player } from '@/types/game'
import { motion, AnimatePresence } from 'framer-motion'

interface BettingHistoryProps {
  gameId: string
  players: Player[]
}

interface ActionItem {
  id: string
  game_id: string
  player_id: string
  action_type: string
  amount: number | null
  created_at: string
  playerName: string
}

export function BettingHistory({ gameId, players }: BettingHistoryProps) {
  const [actions, setActions] = useState<ActionItem[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // 베팅 액션 가져오기
  useEffect(() => {
    async function fetchActions() {
      const { data, error } = await supabase
        .from('game_actions')
        .select('*')
        .eq('game_id', gameId)
        .in('action_type', ['bet', 'call', 'raise', 'half', 'check', 'die'])
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('베팅 히스토리 조회 오류:', error)
        return
      }

      if (data) {
        // 플레이어 이름 매핑
        const actionsWithNames = data.map(action => ({
          ...action,
          playerName: players.find(p => p.id === action.player_id)?.username || '알 수 없음'
        }))
        setActions(actionsWithNames)
        setIsVisible(true)
      }
    }

    fetchActions()

    // 실시간 구독
    const subscription = supabase
      .channel(`game-actions-${gameId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_actions',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        if (payload.new && ['bet', 'call', 'raise', 'half', 'check', 'die'].includes(payload.new.action_type)) {
          const newAction = payload.new as any
          setActions(prev => [{
            ...newAction,
            playerName: players.find(p => p.id === newAction.player_id)?.username || '알 수 없음'
          }, ...prev])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [gameId, players])

  // 액션 타입에 따른 표시 문구
  function getActionText(action: ActionItem): string {
    switch (action.action_type) {
      case 'bet':
        return `${action.amount?.toLocaleString() || 0}원 베팅`
      case 'call':
        return `${action.amount?.toLocaleString() || 0}원 콜`
      case 'raise':
        return `${action.amount?.toLocaleString() || 0}원 레이즈`
      case 'half':
        return `${action.amount?.toLocaleString() || 0}원 하프`
      case 'check':
        return '체크'
      case 'die':
        return '다이'
      default:
        return action.action_type
    }
  }

  // 액션 타입에 따른 색상
  function getActionColor(action: ActionItem): string {
    switch (action.action_type) {
      case 'bet':
      case 'raise':
        return 'text-red-500'
      case 'call':
        return 'text-blue-500'
      case 'half':
        return 'text-purple-500'
      case 'check':
        return 'text-green-500'
      case 'die':
        return 'text-gray-500'
      default:
        return 'text-gray-800 dark:text-gray-200'
    }
  }

  // 타임스탬프 포맷
  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  if (actions.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-64 rounded-lg bg-white shadow-lg dark:bg-zinc-900"
          >
            <div 
              className="flex cursor-pointer items-center justify-between rounded-t-lg bg-gray-100 px-4 py-2 dark:bg-zinc-800"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                베팅 히스토리
              </h3>
              <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {isExpanded ? '▼' : '▲'}
              </button>
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ul className="max-h-48 overflow-y-auto p-2 text-sm">
                    {actions.map(action => (
                      <li 
                        key={action.id} 
                        className="mb-1 flex items-start justify-between border-b border-gray-100 pb-1 dark:border-zinc-800"
                      >
                        <div>
                          <span className="mr-1 font-medium">{action.playerName}</span>
                          <span className={getActionColor(action)}>
                            {getActionText(action)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(action.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 