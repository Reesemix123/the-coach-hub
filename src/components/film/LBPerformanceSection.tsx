'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface LBPerformanceSectionProps {
  register: UseFormRegister<any>;
  players: any[];
}

export function LBPerformanceSection({ register, players }: LBPerformanceSectionProps) {
  const linebackers = players.filter(p =>
    p.position_depths && ['LB', 'MLB', 'SAM', 'WILL'].some(pos => pos in p.position_depths)
  );

  return (
    <CollapsibleSection
      title="Linebacker Performance"
      subtitle="Track LB coverage and run fills (Tier 3)"
      colorScheme="red"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* Coverage Assignment */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Coverage Player
          </label>
          <select
            {...register('lb_coverage_player_id')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            {linebackers.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">LB in coverage on this play</p>
        </div>

        {/* Zone Responsibility */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Zone Responsibility
          </label>
          <select
            {...register('lb_zone_responsibility')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="flat">Flat</option>
            <option value="hook">Hook</option>
            <option value="curl">Curl</option>
            <option value="seam">Seam</option>
            <option value="man">Man</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">LB's coverage assignment</p>
        </div>

        {/* Coverage Grade */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Coverage Grade
          </label>
          <select
            {...register('lb_coverage_grade')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="win">Win (tight coverage, no catch)</option>
            <option value="neutral">Neutral (catch but minimal yards)</option>
            <option value="loss">Loss (beat, big play allowed)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">How well did LB execute coverage?</p>
        </div>

        {/* Run Fill Grade */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Run Fill Grade
          </label>
          <select
            {...register('lb_run_fill_grade')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="fast">Fast (immediate, filled gap quickly)</option>
            <option value="on_time">On Time (proper fill)</option>
            <option value="late">Late (slow to fill, allowed run)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">LB's gap fill on run play</p>
        </div>

        {/* Blown Assignment */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Blown Assignment
          </label>
          <select
            {...register('lb_blown_assignment_player_id')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            {linebackers.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">LB who missed their assignment</p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
