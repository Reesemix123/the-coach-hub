'use client';

import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useState } from 'react';

interface DBRunSupportSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

const RUN_SUPPORT_RESULTS = [
  { value: 'force_set', label: 'Force Set', color: 'green' },
  { value: 'alley_fill', label: 'Alley Fill', color: 'green' },
  { value: 'overpursuit', label: 'Over-Pursuit', color: 'red' },
  { value: 'cutback_allowed', label: 'Cutback Allowed', color: 'red' }
];

interface PlayerRunSupportData {
  result?: string;
  forceContain?: boolean;
  alleyFill?: boolean;
}

export function DBRunSupportSection({ register, watch, setValue, players }: DBRunSupportSectionProps) {
  // Filter to DB players only
  const dbPlayers = players.filter(p =>
    p.position_depths && ['CB', 'FS', 'SS', 'S', 'NB'].some(pos => pos in p.position_depths)
  );

  // Track which DB players are selected for run support
  const selectedPlayerIds = watch('db_run_support_players')?.split(',').filter(Boolean) || [];

  // Track per-player data
  const [playerData, setPlayerData] = useState<Record<string, PlayerRunSupportData>>({});

  const togglePlayer = (playerId: string) => {
    const currentIds = watch('db_run_support_players')?.split(',').filter(Boolean) || [];
    const isSelected = currentIds.includes(playerId);

    if (isSelected) {
      const newIds = currentIds.filter((id: string) => id !== playerId);
      setValue('db_run_support_players', newIds.join(','));

      // Clear their data
      const newData = { ...playerData };
      delete newData[playerId];
      setPlayerData(newData);
    } else {
      setValue('db_run_support_players', [...currentIds, playerId].join(','));
    }
  };

  const updatePlayerData = (playerId: string, field: keyof PlayerRunSupportData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value
      }
    }));

    setValue('db_run_support_data', JSON.stringify({
      ...playerData,
      [playerId]: {
        ...playerData[playerId],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700">
          DB Run Support {selectedPlayerIds.length > 0 && (
            <span className="text-gray-500 font-normal">({selectedPlayerIds.length} selected)</span>
          )}
        </label>
      </div>
      <p className="text-xs text-gray-500">Track force/alley responsibilities for defensive backs</p>

      {/* Player Selection */}
      <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto">
        {dbPlayers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-500">No DB players found</div>
        ) : (
          dbPlayers.map(player => {
            const isSelected = selectedPlayerIds.includes(player.id);
            const data = playerData[player.id] || {};

            return (
              <div key={player.id} className="border-b border-gray-100 last:border-b-0">
                {/* Player checkbox row */}
                <label
                  className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePlayer(player.id)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900 flex-1">
                    #{player.jersey_number} {player.first_name} {player.last_name}
                    {data.result && (
                      <span className={`ml-2 text-xs ${
                        data.result === 'force_set' || data.result === 'alley_fill' ? 'text-green-600' :
                        data.result === 'overpursuit' || data.result === 'cutback_allowed' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {RUN_SUPPORT_RESULTS.find(r => r.value === data.result)?.label}
                      </span>
                    )}
                  </span>
                </label>

                {/* Player detail inputs (show when selected) */}
                {isSelected && (
                  <div className="px-3 py-2 bg-gray-50 space-y-2">
                    {/* Result */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
                      <select
                        value={data.result || ''}
                        onChange={(e) => updatePlayerData(player.id, 'result', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">-</option>
                        {RUN_SUPPORT_RESULTS.map(result => (
                          <option key={result.value} value={result.value}>{result.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Force Contain */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.forceContain || false}
                        onChange={(e) => updatePlayerData(player.id, 'forceContain', e.target.checked)}
                        className="h-3 w-3 text-blue-600 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Had Force/Contain Responsibility</span>
                    </label>

                    {/* Alley Fill */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.alleyFill || false}
                        onChange={(e) => updatePlayerData(player.id, 'alleyFill', e.target.checked)}
                        className="h-3 w-3 text-green-600 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Had Alley Fill Responsibility</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hidden fields for form submission */}
      <input type="hidden" {...register('db_run_support_players')} />
      <input type="hidden" {...register('db_run_support_data')} />
    </div>
  );
}
