'use client';

import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useState } from 'react';

interface LBPassCoverageSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

const COVERAGE_ZONES = [
  { value: 'hook_curl', label: 'Hook/Curl Zone' },
  { value: 'flat', label: 'Flat Zone' },
  { value: 'seam', label: 'Seam Zone' },
  { value: 'deep_third', label: 'Deep Third' },
  { value: 'man_coverage', label: 'Man Coverage' },
  { value: 'spy', label: 'QB Spy' },
  { value: 'blitz', label: 'Blitz' }
];

const COVERAGE_RESULTS = [
  { value: 'target_allowed', label: 'Target Allowed', color: 'yellow' },
  { value: 'completion_allowed', label: 'Completion Allowed', color: 'red' },
  { value: 'incompletion', label: 'Incompletion', color: 'green' },
  { value: 'interception', label: 'Interception', color: 'green' },
  { value: 'pass_breakup', label: 'Pass Breakup', color: 'green' }
];

interface PlayerCoverageData {
  zone?: string;
  result?: string;
}

export function LBPassCoverageSection({ register, watch, setValue, players }: LBPassCoverageSectionProps) {
  // Filter to LB players only
  const lbPlayers = players.filter(p =>
    p.position_depths && ['MLB', 'ILB', 'OLB', 'WILL', 'MIKE', 'SAM'].some(pos => pos in p.position_depths)
  );

  // Track which LB players are selected for coverage
  const selectedPlayerIds = watch('lb_pass_coverage_players')?.split(',').filter(Boolean) || [];

  // Track per-player data
  const [playerData, setPlayerData] = useState<Record<string, PlayerCoverageData>>({});

  const togglePlayer = (playerId: string) => {
    const currentIds = watch('lb_pass_coverage_players')?.split(',').filter(Boolean) || [];
    const isSelected = currentIds.includes(playerId);

    if (isSelected) {
      const newIds = currentIds.filter((id: string) => id !== playerId);
      setValue('lb_pass_coverage_players', newIds.join(','));

      // Clear their data
      const newData = { ...playerData };
      delete newData[playerId];
      setPlayerData(newData);
    } else {
      setValue('lb_pass_coverage_players', [...currentIds, playerId].join(','));
    }
  };

  const updatePlayerData = (playerId: string, field: keyof PlayerCoverageData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value
      }
    }));

    setValue('lb_pass_coverage_data', JSON.stringify({
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
          LB Pass Coverage {selectedPlayerIds.length > 0 && (
            <span className="text-gray-500 font-normal">({selectedPlayerIds.length} selected)</span>
          )}
        </label>
      </div>
      <p className="text-xs text-gray-500">Track coverage assignments and results for linebackers</p>

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
                    {data.zone && (
                      <span className="ml-2 text-xs text-blue-600">
                        ({COVERAGE_ZONES.find(z => z.value === data.zone)?.label})
                      </span>
                    )}
                    {data.result && (
                      <span className={`ml-2 text-xs ${
                        data.result === 'incompletion' || data.result === 'interception' || data.result === 'pass_breakup' ? 'text-green-600' :
                        data.result === 'completion_allowed' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {COVERAGE_RESULTS.find(r => r.value === data.result)?.label}
                      </span>
                    )}
                  </span>
                </label>

                {/* Player detail inputs (show when selected) */}
                {isSelected && (
                  <div className="px-3 py-2 bg-gray-50 space-y-2">
                    {/* Coverage Zone */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Coverage Assignment</label>
                      <select
                        value={data.zone || ''}
                        onChange={(e) => updatePlayerData(player.id, 'zone', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">-</option>
                        {COVERAGE_ZONES.map(zone => (
                          <option key={zone.value} value={zone.value}>{zone.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Coverage Result */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Coverage Result</label>
                      <select
                        value={data.result || ''}
                        onChange={(e) => updatePlayerData(player.id, 'result', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">-</option>
                        {COVERAGE_RESULTS.map(result => (
                          <option key={result.value} value={result.value}>{result.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hidden fields for form submission */}
      <input type="hidden" {...register('lb_pass_coverage_players')} />
      <input type="hidden" {...register('lb_pass_coverage_data')} />
    </div>
  );
}
