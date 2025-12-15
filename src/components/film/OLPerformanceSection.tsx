'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface OLPerformanceSectionProps {
  register: UseFormRegister<any>;
  players: any[];
}

const BLOCK_RESULTS = [
  { value: 'win', label: 'Win' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'loss', label: 'Loss' }
];

export function OLPerformanceSection({ register, players }: OLPerformanceSectionProps) {
  return (
    <CollapsibleSection
      title="Offensive Line Performance"
      subtitle="Track each OL player's block"
      colorScheme="green"
      defaultExpanded={false}
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-600">
          Grade each offensive lineman's performance on this play
        </p>

        {/* Left Tackle */}
        <div className="border-b border-gray-200 pb-3">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Left Tackle (LT)</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                {...register('ol_lt_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['LT', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Result</label>
              <select
                {...register('ol_lt_block_result')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {BLOCK_RESULTS.map(result => (
                  <option key={result.value} value={result.value}>{result.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Left Guard */}
        <div className="border-b border-gray-200 pb-3">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Left Guard (LG)</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                {...register('ol_lg_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['LG', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Result</label>
              <select
                {...register('ol_lg_block_result')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {BLOCK_RESULTS.map(result => (
                  <option key={result.value} value={result.value}>{result.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Center */}
        <div className="border-b border-gray-200 pb-3">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Center (C)</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                {...register('ol_c_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['C', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Result</label>
              <select
                {...register('ol_c_block_result')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {BLOCK_RESULTS.map(result => (
                  <option key={result.value} value={result.value}>{result.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Guard */}
        <div className="border-b border-gray-200 pb-3">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Right Guard (RG)</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                {...register('ol_rg_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['RG', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Result</label>
              <select
                {...register('ol_rg_block_result')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {BLOCK_RESULTS.map(result => (
                  <option key={result.value} value={result.value}>{result.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Tackle */}
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Right Tackle (RT)</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                {...register('ol_rt_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['RT', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Result</label>
              <select
                {...register('ol_rt_block_result')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {BLOCK_RESULTS.map(result => (
                  <option key={result.value} value={result.value}>{result.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Special OL Events */}
        <div className="pt-3 border-t border-gray-200">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Special Events</h5>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pancake Block</label>
              <select
                {...register('ol_pancake_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['LT', 'LG', 'C', 'RG', 'RT', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">OL player who pancaked a defender</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sack Allowed By</label>
              <select
                {...register('sack_allowed_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['LT', 'LG', 'C', 'RG', 'RT', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">OL player responsible for sack</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pressure Allowed By</label>
              <select
                {...register('pressure_allowed_player_id')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
              >
                <option value="">-</option>
                {players
                  .filter(p => p.position_depths && ['LT', 'LG', 'C', 'RG', 'RT', 'OL'].some(pos => pos in p.position_depths))
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">OL player who allowed QB pressure</p>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
