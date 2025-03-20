'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Player } from '@/types/game';
import { evaluateCards } from '@/utils/gameLogic'; // 예시
import { Card } from './Card';

interface GameResultProps {
  winner: Player;
  players: Player[];
  restartGame: () => void;
}

export function GameResult({ winner, players, restartGame }: GameResultProps) {
  const [visible, setVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setVisible(true);
    // 3초 후 전체 플레이어 카드 공개
    const timer = setTimeout(() => setShowAll(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!winner || !winner.cards || winner.cards.length < 2) return null;

  const winnerEval = evaluateCards(winner.cards);
  // 활성 플레이어
  const active = players.filter(p => p.cards && p.cards.length === 2);
  const sorted = active.map(p => {
    const evalRes = evaluateCards(p.cards!);
    return { ...p, rank: evalRes.rank, value: evalRes.value };
  }).sort((a, b) => b.value - a.value);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.8 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="w-full max-w-3xl bg-white text-gray-800 p-6 rounded-md relative">
        <h2 className="text-2xl font-bold text-center text-red-500">게임 종료</h2>

        <div className="mt-4 text-center">
          <p className="text-lg">
            승자: <span className="font-semibold">{winner.username}</span>
          </p>
          <p className="text-amber-600 font-bold text-lg">
            {winnerEval.rank} 패로 승리!
          </p>
        </div>

        <div className="flex justify-center mt-4 space-x-4">
          {winner.cards.map((c, i) => (
            <div key={i} className="w-16 h-24">
              <Card card={c} isHidden={false} width={64} height={96} />
            </div>
          ))}
        </div>

        {/* 전체 플레이어 결과 */}
        <div className="mt-6 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2">플레이어</th>
                <th className="px-3 py-2">족보</th>
                {showAll && <th className="px-3 py-2">카드</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr
                  key={p.id}
                  className={p.id === winner.id ? 'bg-yellow-50' : 'bg-white'}
                >
                  <td className="border px-3 py-2">
                    {p.username}{p.id === winner.id && ' (승자)'}
                  </td>
                  <td className="border px-3 py-2">
                    {p.rank}
                  </td>
                  {showAll && (
                    <td className="border px-3 py-2">
                      <div className="flex space-x-2">
                        {p.cards?.map((cc, i) => (
                          <Card key={i} card={cc} width={32} height={48} isHidden={false} />
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={restartGame}
            className="px-4 py-2 bg-red-500 text-white font-bold rounded shadow hover:bg-red-600"
          >
            다시 게임하기
          </button>
        </div>
      </div>
    </motion.div>
  );
}
