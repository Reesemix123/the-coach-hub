'use client';

import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useState } from 'react';

interface DLPassRushSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

const RUSH_TECHNIQUES = [
  { value: 'speed_rush', label: 'Speed Rush' },
  { value: 'power_rush', label: 'Power Rush' },
  { value: 'swim_move', label: 'Swim Move' },
  { value: 'rip_move', label: 'Rip Move' },
  { value: 'bull_rush', label: 'Bull Rush' },
  { value: 'spin_move', label: 'Spin Move' },
  { value: 'stunt', label: 'Stunt/Twist' }
];

const GAP_OPTIONS = [
  { value: 'A', label: 'A Gap' },
  { value: 'B', label: 'B Gap' },
  { value: 'C', label: 'C Gap' },
  { value: 'D', label: 'D Gap' }
];

interface PlayerPassRushData {
  rushTechnique?: string;
  gap?: string;
  qbImpact?: boolean;
}

export function DLPassRushSection({ register, watch, setValue, players }: DLPassRushSectionProps) {
  // Filter to DL players only
  const dlPlayers = players.filter(p =>
    p.position_depths && ['DE', 'DT', 'DT1', 'DT2', 'NT'].some(pos => pos in p.position_depths)
  );

  // Get pressure players from global pressure section
  const pressurePlayerIds = watch('pressure_player_ids')?.split(',').filter(Boolean) || [];

  // Filter to only DL players who got pressure
  const dlPressurePlayers = dlPlayers.filter(p => pressurePlayerIds.includes(p.id));

  // Track per-player pass rush data
  const [playerData, setPlayerData] = useState<Record<string, PlayerPassRushData>>({});

  const updatePlayerData = (playerId: string, field: keyof PlayerPassRushData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value
      }
    }));

    // Also update the hidden form field with JSON
    setValue('dl_pass_rush_data', JSON.stringify({
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
          DL Pass Rush Details
        </label>
      </div>
      <p className="text-xs text-gray-500">
        Additional pass rush data for DL who got pressure
        {dlPressurePlayers.length === 0 && ' (select pressures in section above first)'}
      </p>

      {dlPressurePlayers.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 rounded border border-gray-200">
          No DL players with pressure. Add DL players in the "Pressured QB" section above.
        </div>
      ) : (
        <div className="space-y-2">
          {dlPressurePlayers.map(player => {
            const data = playerData[player.id] || {};

            return (
              <div key={player.id} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                {/* Player name */}
                <div className="text-sm font-medium text-gray-900 mb-2">
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </div>

                <div className="space-y-2">
                  {/* Rush Technique */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rush Technique</label>
                    <select
                      value={data.rushTechnique || ''}
                      onChange={(e) => updatePlayerData(player.id, 'rushTechnique', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">-</option>
                      {RUSH_TECHNIQUES.map(tech => (
                        <option key={tech.value} value={tech.value}>{tech.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Gap Rushed */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gap Rushed</label>
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

                  {/* QB Impact */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.qbImpact || false}
                      onChange={(e) => updatePlayerData(player.id, 'qbImpact', e.target.checked)}
                      className="h-3 w-3 text-red-600 rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-700">Impacted QB's throw</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden field for form submission */}
      <input type="hidden" {...register('dl_pass_rush_data')} />
    </div>
  );
}
