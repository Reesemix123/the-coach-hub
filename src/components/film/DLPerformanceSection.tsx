'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface DLPerformanceSectionProps {
  register: UseFormRegister<any>;
  players: any[];
}

export function DLPerformanceSection({ register, players }: DLPerformanceSectionProps) {
  const defensivePlayers = players.filter(p =>
    p.position_depths && ['DE', 'DT', 'DT1', 'DT2', 'NT'].some(pos => pos in p.position_depths)
  );

  return (
    <CollapsibleSection
      title="Defensive Line Performance"
      subtitle="Track DL disruption and pressure (Tier 3)"
      colorScheme="red"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* QB Hits */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            QB Hits
          </label>
          <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto">
            {defensivePlayers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No DL players found</div>
            ) : (
              defensivePlayers.map(player => (
                <label
                  key={player.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    {...register('dl_qb_hit_player_ids')}
                    type="checkbox"
                    value={player.id}
                    className="h-4 w-4 text-red-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">
                    #{player.jersey_number} {player.first_name} {player.last_name}
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">DL players who hit the QB</p>
        </div>

        {/* Tackles for Loss */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Tackle for Loss (TFL)
          </label>
          <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto">
            {defensivePlayers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No DL players found</div>
            ) : (
              defensivePlayers.map(player => (
                <label
                  key={player.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    {...register('dl_tfl_player_ids')}
                    type="checkbox"
                    value={player.id}
                    className="h-4 w-4 text-red-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">
                    #{player.jersey_number} {player.first_name} {player.last_name}
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">DL players who made TFL</p>
        </div>

        {/* Special DL Events */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Batted Pass</label>
            <select
              {...register('dl_batted_pass_player_id')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">-</option>
              {defensivePlayers.map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">DL player who batted down a pass</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contain Player</label>
            <select
              {...register('dl_contain_player_id')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">-</option>
              {defensivePlayers.map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">DL player who maintained contain</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Blown Gap Assignment</label>
            <select
              {...register('dl_blown_gap_player_id')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">-</option>
              {defensivePlayers.map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">DL player who missed gap responsibility</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Double Teamed</label>
            <select
              {...register('dl_double_team_player_id')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">-</option>
              {defensivePlayers.map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">DL player who was double teamed</p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
