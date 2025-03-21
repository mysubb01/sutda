'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/roomApi';
import { toast } from 'react-hot-toast';
import { GameMode } from '@/types/game';

const DEFAULT_ENTRY_FEE = 10000;
const DEFAULT_MAX_PLAYERS = 8;

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>(2);
  const [entryFee, setEntryFee] = useState(DEFAULT_ENTRY_FEE);
  const [bettingOption, setBettingOption] = useState<'standard' | 'step_by_step'>('standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('ubc29 uc774ub984uc744 uc785ub825ud574uc8fcuc138uc694.');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      const { roomId } = await createRoom(
        name,
        mode,
        entryFee,
        bettingOption
      );
      
      toast.success('ubc29uc774 uc0dduc131ub418uc5c8uc2b5ub2c8ub2e4!');
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('ubc29 uc0dduc131 uc624ub958:', err);
      setError('ubc29uc744 uc0dduc131ud558ub294 ub3c4uc911 uc624ub958uac00 ubc1cuc0ddud588uc2b5ub2c8ub2e4.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex justify-center items-center">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-center mb-6 text-yellow-400">uc0c8 ubc29 ub9ccub4e4uae30</h1>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">ubc29 uc774ub984</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="uc608) uc2e0uc785 ud658uc601 ud55cud310"
              maxLength={20}
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">uac8cuc784 ubaa8ub4dc</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setMode(2)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === 2 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                2uc7a5 ubaa8ub4dc
              </button>
              <button
                type="button"
                onClick={() => setMode(3)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === 3 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                3uc7a5 ubaa8ub4dc
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {mode === 2 
                ? '2uc7a5 ubaa8ub4dc: uae30ubcf8uc801uc778 uc12fub2e4 uac8cuc784, 2uc7a5uc758 uce74ub4dcub85c uc871ubcf4 uacb0uc815' 
                : '3uc7a5 ubaa8ub4dc: 3uc7a5 uc911 2uc7a5uc744 uc120ud0ddud558uc5ec uac8cuc784ud558ub294 ubc29uc2dd'}
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">ubca0ud305 ubc29uc2dd</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setBettingOption('standard')}
                className={`flex-1 py-2 px-3 rounded-md transition-colors ${
                  bettingOption === 'standard' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                uc77cubc18 ubca0ud305
              </button>
              <button
                type="button"
                onClick={() => setBettingOption('step_by_step')}
                className={`flex-1 py-2 px-3 rounded-md transition-colors ${
                  bettingOption === 'step_by_step' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                ub2e8uacc4ubcc4 ubca0ud305
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {bettingOption === 'standard' 
                ? 'uc77cubc18 ubca0ud305: ub9deubc14ub85c ubca0ud305 ud55c ubc88ub9cc uc9c4ud589ud569ub2c8ub2e4.' 
                : 'ub2e8uacc4ubcc4 ubca0ud305: ud55c uc7a5 ubc1buace0 ubca0ud305ud55c ud6c4, ucd94uac00 uce74ub4dcub97c ubc1buace0 ub2e4uc2dc ubca0ud305ud569ub2c8ub2e4.'}
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">ucc38uac00ube44</label>
            <div className="relative">
              <input
                type="number"
                value={entryFee}
                onChange={(e) => setEntryFee(Math.max(1000, Math.min(1000000, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                min="1000"
                max="1000000"
                step="1000"
                required
              />
              <span className="absolute right-3 top-2 text-gray-400">uc6d0</span>
            </div>
            <div className="flex justify-between mt-2">
              <button 
                type="button" 
                onClick={() => setEntryFee(5000)}
                className="px-2 py-1 text-xs bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
              >
                5,000uc6d0
              </button>
              <button 
                type="button" 
                onClick={() => setEntryFee(10000)}
                className="px-2 py-1 text-xs bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
              >
                10,000uc6d0
              </button>
              <button 
                type="button" 
                onClick={() => setEntryFee(50000)}
                className="px-2 py-1 text-xs bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
              >
                50,000uc6d0
              </button>
              <button 
                type="button" 
                onClick={() => setEntryFee(100000)}
                className="px-2 py-1 text-xs bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
              >
                100,000uc6d0
              </button>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              disabled={isCreating}
            >
              ucde8uc18c
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            >
              {isCreating ? 'uc0dduc131 uc911...' : 'ubc29 uc0dduc131'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
