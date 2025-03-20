'use client';

import { GameAction, BetActionType } from '@/types/game';

interface BettingHistoryProps {
  actions: GameAction[];
}

export function BettingHistory({ actions }: BettingHistoryProps) {
  if (!actions || actions.length === 0) {
    return (
      <div className="p-2 text-sm text-gray-400">
        베팅 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="p-2 text-sm space-y-1 max-h-48 overflow-y-auto">
      {actions.map((action) => (
        <div key={action.id} className="bg-gray-700 bg-opacity-70 rounded-md p-1">
          <p className="font-bold text-yellow-300">{action.player_id}</p>
          <p className="text-white text-xs">
            {renderAction(action.action_type, action.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderAction(type: string, amount?: number) {
  switch (type as BetActionType) {
    case 'call':
      return `콜${amount ? ` (${amount}P)` : ''}`;
    case 'bet':
      return `베팅 ${amount}P`;
    case 'die':
      return '다이';
    case 'check':
      return '체크';
    case 'half':
      return '하프';
    case 'quarter':
      return '따당';
    case 'raise':
      return `레이즈 ${amount}P`;
    default:
      return `${type} ${amount || ''}`;
  }
}
