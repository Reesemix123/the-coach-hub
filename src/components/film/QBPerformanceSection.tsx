'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface QBPerformanceSectionProps {
  register: UseFormRegister<any>;
}

export function QBPerformanceSection({ register }: QBPerformanceSectionProps) {
  return (
    <CollapsibleSection
      title="Quarterback Performance"
      subtitle="Enhanced QB evaluation (Tier 3)"
      colorScheme="purple"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* Read Progression */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Read Progression
          </label>
          <select
            {...register('qb_read_progression')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="1">1st Read</option>
            <option value="2">2nd Read</option>
            <option value="3">3rd Read</option>
            <option value="4">4th Read</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Which read did QB throw to?</p>
        </div>

        {/* Throw Accuracy */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Throw Accuracy
          </label>
          <select
            {...register('qb_throw_accuracy')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="on_target">On Target (catchable, accurate)</option>
            <option value="catchable">Catchable (receiver had to adjust)</option>
            <option value="uncatchable">Uncatchable</option>
          </select>
        </div>

        {/* Decision Time */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Decision Time
          </label>
          <select
            {...register('qb_decision_time')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="quick">Quick (under 2.5s)</option>
            <option value="normal">Normal (2.5-3.5s)</option>
            <option value="late">Late (over 3.5s)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Time from snap to throw</p>
        </div>

        {/* QB Flags */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center space-x-2">
            <input
              {...register('qb_under_pressure')}
              type="checkbox"
              className="w-4 h-4 text-purple-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Under Pressure</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              {...register('qb_scramble')}
              type="checkbox"
              className="w-4 h-4 text-purple-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Scramble</span>
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
