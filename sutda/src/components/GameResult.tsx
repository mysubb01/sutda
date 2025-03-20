'use client'

import { useEffect, useState } from 'react'
import { evaluateCards, getCardMonth, isKwang } from '@/utils/gameLogic'
import { motion } from 'framer-motion'
import { Player } from '@/types/game'
import { Card } from './Card'

// 족보 설명
const rankDescriptions: Record<string, string> = {
  '38광땡': '최고의 패 - 3월 광과 8월 광',
  '13광땡': '두 번째로 높은 광땡 - 1월 광과 3월 광',
  '18광땡': '세 번째로 높은 광땡 - 1월 광과 8월 광',
  '장땡': '가장 높은 땡 - 10월 카드 두 장',
  '9땡': '9월 카드 두 장',
  '8땡': '8월 카드 두 장',
  '7땡': '7월 카드 두 장',
  '6땡': '6월 카드 두 장',
  '5땡': '5월 카드 두 장',
  '4땡': '4월 카드 두 장',
  '3땡': '3월 카드 두 장',
  '2땡': '2월 카드 두 장',
  '1땡': '1월 카드 두 장',
  '알리': '1월과 2월 조합',
  '독사': '1월과 4월 조합',
  '구삥': '1월과 9월 조합',
  '장삥': '1월과 10월 조합',
  '장사': '4월과 10월 조합',
  '세륙': '4월과 6월 조합',
  '땡잡이': '3월과 7월 조합으로 9땡까지 이김',
  '암행어사': '4월과 7월 조합으로 13광땡, 18광땡을 이김',
  '구사': '4월과 9월 조합, 특수한 규칙 적용',
  '망통': '끗수가 0인 조합',
  '망통(2-8)': '2월과 8월 조합으로 가장 낮은 패'
}

// 족보 설명 가져오기 (없으면 기본 설명 반환)
function getRankDescription(rank: string): string {
  if (rank.includes('끗')) {
    const num = parseInt(rank.replace('끗', ''))
    return `${num}끗 - 두 카드의 끗수 합이 ${num}`
  }
  return rankDescriptions[rank] || '알 수 없는 패'
}

// 카드 설명 가져오기
function getCardDescription(card: number): string {
  const month = getCardMonth(card)
  const type = isKwang(card) ? '광' : '일반'
  return `${month}월 ${type}`
}

interface GameResultProps {
  winner: Player
  players: Player[]
  restartGame: () => void
}

export function GameResult({ winner, players, restartGame }: GameResultProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showAllCards, setShowAllCards] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    
    // 3초 후 모든 플레이어 카드 표시
    const timer = setTimeout(() => {
      setShowAllCards(true)
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [])

  if (!winner || !winner.cards || winner.cards.length !== 2) return null

  const winnerCards = winner.cards
  const evaluation = evaluateCards(winnerCards)

  // 활성 플레이어 (다이하지 않은 플레이어들)
  const activePlayers = players.filter(p => p.cards && p.cards.length === 2 && !p.isDie)
  
  // 플레이어 패 정보 및 평가 계산
  const playerEvaluations = activePlayers.map(player => {
    const cards = player.cards || []
    return {
      ...player,
      evaluation: cards.length === 2 ? evaluateCards(cards) : { rank: '없음', value: 0 }
    }
  }).sort((a, b) => {
    if (a.id === winner.id) return -1
    if (b.id === winner.id) return 1
    return b.evaluation.value - a.evaluation.value
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.8 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-4 text-center text-2xl font-bold text-red-500">게임 종료</h2>
        
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold">승자: {winner.username}</p>
          <p className="mt-2 text-lg font-medium text-amber-500">
            {evaluation.rank} 패로 승리!
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {getRankDescription(evaluation.rank)}
          </p>
        </div>
        
        {/* 승자 카드 */}
        <div className="mb-6 flex justify-center space-x-4">
          {winnerCards.map((card, index) => (
            <div key={index} className="w-20">
              <Card card={card} isHidden={false} />
              <p className="mt-1 text-center text-xs text-gray-500">
                {getCardDescription(card)}
              </p>
            </div>
          ))}
        </div>
        
        {/* 전체 플레이어 패 및 결과 */}
        <div className="mb-6">
          <h3 className="mb-2 text-center font-semibold text-gray-700 dark:text-gray-300">
            모든 플레이어 결과
          </h3>
          <div className="overflow-hidden rounded-md border dark:border-gray-700">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2">플레이어</th>
                  <th className="px-4 py-2">패</th>
                  <th className="px-4 py-2">족보</th>
                  {showAllCards && <th className="px-4 py-2">카드</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-zinc-900">
                {playerEvaluations.map((player) => (
                  <tr 
                    key={player.id}
                    className={player.id === winner.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-sm font-medium">
                      {player.username}
                      {player.id === winner.id && ' (승자)'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      <div className="flex flex-col">
                        <span>{player.evaluation.rank}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getRankDescription(player.evaluation.rank)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {player.id === winner.id ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          승리
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          패배
                        </span>
                      )}
                    </td>
                    {showAllCards && (
                      <td className="px-4 py-2">
                        <div className="flex space-x-1">
                          {player.cards && player.cards.map((card, idx) => (
                            <div key={idx} className="h-10 w-7">
                              <Card card={card} isHidden={false} width={28} height={40} />
                            </div>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {!showAllCards && (
            <p className="mt-2 text-center text-xs text-gray-500">
              잠시 후 모든 플레이어의 카드가 공개됩니다...
            </p>
          )}
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={restartGame}
            className="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          >
            다시 게임하기
          </button>
        </div>
      </div>
    </motion.div>
  )
} 