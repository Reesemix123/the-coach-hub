'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface DBPerformanceSectionProps {
  register: UseFormRegister<any>;
  players: any[];
}

export function DBPerformanceSection({ register, players }: DBPerformanceSectionProps) {
  const defensiveBacks = players.filter(p =>
    p.position_depths && ['LCB', 'RCB', 'S', 'FS', 'SS', 'CB', 'DB'].some(pos => pos in p.position_depths)
  );

  return (
    <CollapsibleSection
      title="Defensive Back Performance"
      subtitle="Track DB coverage and pass defense (Tier 3)"
      colorScheme="red"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* Target Separation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Target Separation
          </label>
          <select
            {...register('db_target_separation')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="step_for_step">Step for Step (right with receiver)</option>
            <option value="close">Close (within 1-2 yards)</option>
            <option value="beaten">Beaten (3+ yards separation)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">How close was DB to receiver?</p>
        </div>

        {/* Closest Defender */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Closest Defender to Target
          </label>
          <select
            {...register('db_closest_defender_id')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            {defensiveBacks.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">DB closest to intended receiver</p>
        </div>

        {/* Yards Allowed */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Yards Allowed in Coverage
          </label>
          <input
            {...register('db_allowed_catch_yards')}
            type="number"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">Yards gained against this DB's coverage</p>
        </div>

        {/* Missed Assignment */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Missed Assignment
          </label>
          <select
            {...register('db_missed_assignment_player_id')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            {defensiveBacks.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">DB who blew coverage assignment</p>
        </div>

        {/* DB Flags */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center space-x-2">
            <input
              {...register('db_pi_penalty')}
              type="checkbox"
              className="w-4 h-4 text-red-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Pass Interference</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              {...register('db_run_support_tackle')}
              type="checkbox"
              className="w-4 h-4 text-red-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Run Support Tackle</span>
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
