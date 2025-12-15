'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface WRPerformanceSectionProps {
  register: UseFormRegister<any>;
}

export function WRPerformanceSection({ register }: WRPerformanceSectionProps) {
  return (
    <CollapsibleSection
      title="Receiver Performance"
      subtitle="Track WR/TE effectiveness"
      colorScheme="blue"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* Separation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Separation
          </label>
          <select
            {...register('wr_separation')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="wide_open">Wide Open (3+ yards)</option>
            <option value="open">Open (1-3 yards)</option>
            <option value="tight">Tight (under 1 yard)</option>
            <option value="blanketed">Blanketed (no separation)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Separation from defender at catch point</p>
        </div>

        {/* Route Depth */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Route Depth (yards)
          </label>
          <input
            {...register('wr_route_depth')}
            type="number"
            min="0"
            max="80"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">How deep was the route?</p>
        </div>

        {/* Yards After Catch */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Yards After Catch (YAC)
          </label>
          <input
            {...register('wr_yac')}
            type="number"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">Yards gained after the catch</p>
        </div>

        {/* Broken Tackles */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Broken Tackles After Catch
          </label>
          <input
            {...register('wr_broken_tackles')}
            type="number"
            min="0"
            max="10"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
        </div>

        {/* Block Grade (for run plays) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Blocking Grade (on run plays)
          </label>
          <select
            {...register('wr_block_grade')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="win">Win (successful block)</option>
            <option value="neutral">Neutral</option>
            <option value="loss">Loss (failed block)</option>
          </select>
        </div>

        {/* WR Flags */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center space-x-2">
            <input
              {...register('wr_contested_catch')}
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Contested Catch</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              {...register('wr_drop')}
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Drop</span>
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
