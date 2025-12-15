'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { UseFormRegister } from 'react-hook-form';

interface RBPerformanceSectionProps {
  register: UseFormRegister<any>;
}

export function RBPerformanceSection({ register }: RBPerformanceSectionProps) {
  return (
    <CollapsibleSection
      title="Running Back Performance"
      subtitle="Track RB effectiveness"
      colorScheme="green"
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {/* Broken Tackles */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Broken Tackles
          </label>
          <input
            {...register('rb_broken_tackles')}
            type="number"
            min="0"
            max="10"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">Number of tackles broken by RB</p>
        </div>

        {/* Yards After Contact */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Yards After Contact
          </label>
          <input
            {...register('rb_yards_after_contact')}
            type="number"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">Yards gained after first contact</p>
        </div>

        {/* Pass Protection Grade */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Pass Protection Grade
          </label>
          <select
            {...register('rb_pass_pro_grade')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">-</option>
            <option value="win">Win (successful block)</option>
            <option value="neutral">Neutral</option>
            <option value="loss">Loss (allowed pressure)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">RB's pass blocking performance</p>
        </div>

        {/* RB Flags */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center space-x-2">
            <input
              {...register('rb_contact_at_los')}
              type="checkbox"
              className="w-4 h-4 text-green-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Contact at LOS</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              {...register('rb_fumbled')}
              type="checkbox"
              className="w-4 h-4 text-green-600 border-gray-300 rounded"
            />
            <span className="text-xs font-medium text-gray-700">Fumbled</span>
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
