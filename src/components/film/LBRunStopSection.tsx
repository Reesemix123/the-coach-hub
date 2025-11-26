'use client';

import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useState } from 'react';

interface LBRunStopSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

const GAP_OPTIONS = [
  { value: 'A', label: 'A Gap' },
  { value: 'B', label: 'B Gap' },
  { value: 'C', label: 'C Gap' },
  { value: 'D', label: 'D Gap' }
];

const RUN_STOP_RESULTS = [
  { value: 'gap_fill', label: 'Gap Fill', color: 'green' },
  { value: 'wrong_gap', label: 'Wrong Gap', color: 'red' },
  { value: 'scraped', label: 'Scrape Exchange', color: 'blue' },
  { value: 'run_through', label: 'Run Through', color: 'red' }
];

interface PlayerRunStopData {
  gap?: string;
  result?: string;
  scrapeExchange?: boolean;
}

export function LBRunStopSection({ register, watch, setValue, players }: LBRunStopSectionProps) {
  // Filter to LB players only
  const lbPlayers = players.filter(p =>
    p.position_depths && ['MLB', 'ILB', 'OLB', 'WILL', 'MIKE', 'SAM'].some(pos => pos in p.position_depths)
  );

  // Track which LB players are selected for run stop
  const selectedPlayerIds = watch('lb_run_stop_players')?.split(',').filter(Boolean) || [];

  // Track per-player data
  const [playerData, setPlayerData] = useState<Record<string, PlayerRunStopData>>({});

  const togglePlayer = (playerId: string) => {
    const currentIds = watch('lb_run_stop_players')?.split(',').filter(Boolean) || [];
    const isSelected = currentIds.includes(playerId);

    if (isSelected) {
      const newIds = currentIds.filter((id: string) => id !== playerId);
      setValue('lb_run_stop_players', newIds.join(','));

      // Clear their data
      const newData = { ...playerData };
      delete newData[playerId];
      setPlayerData(newData);
    } else {
      setValue('lb_run_stop_players', [...currentIds, playerId].join(','));
    }
  };

  const updatePlayerData = (playerId: string, field: keyof PlayerRunStopData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value
      }
    }));

    setValue('lb_run_stop_data', JSON.stringify({
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
          LB Run Stop {selectedPlayerIds.length > 0 && (
            <span className="text-gray-500 font-normal">({selectedPlayerIds.length} selected)</span>
          )}
        </label>
      </div>
      <p className="text-xs text-gray-500">Track gap fills and run fits for linebackers</p>

      {/* Player Selection */}
      <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto">
        {lbPlayers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-500">No LB players found</div>
        ) : (
          lbPlayers.map(player => {
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
                    {data.gap && <span className="ml-2 text-xs text-blue-600">({data.gap} Gap)</span>}
                    {data.result && (
                      <span className={`ml-2 text-xs ${
                        data.result === 'gap_fill' || data.result === 'scraped' ? 'text-green-600' :
                        data.result === 'wrong_gap' || data.result === 'run_through' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {RUN_STOP_RESULTS.find(r => r.value === data.result)?.label}
                      </span>
                    )}
                  </span>
                </label>

                {/* Player detail inputs (show when selected) */}
                {isSelected && (
                  <div className="px-3 py-2 bg-gray-50 space-y-2">
                    {/* Gap Assignment */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Gap Assignment</label>
                      <select
                        value={data.gap || ''}
                        onChange={(e) => updatePlayerData(player.id, 'gap', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">-</option>
                        {GAP_OPTIONS.map(gap => (
                          <option key={gap.value} value={gap.value}>{gap.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Result */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
                      <select
                        value={data.result || ''}
                        onChange={(e) => updatePlayerData(player.id, 'result', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">-</option>
                        {RUN_STOP_RESULTS.map(result => (
                          <option key={result.value} value={result.value}>{result.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Scrape Exchange */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.scrapeExchange || false}
                        onChange={(e) => updatePlayerData(player.id, 'scrapeExchange', e.target.checked)}
                        className="h-3 w-3 text-purple-600 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Scrape Exchange</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hidden fields for form submission */}
      <input type="hidden" {...register('lb_run_stop_players')} />
      <input type="hidden" {...register('lb_run_stop_data')} />
    </div>
  );
}
