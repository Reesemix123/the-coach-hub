'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { RESULT_TYPES, SCORING_TYPES, PENALTY_TYPES } from '@/types/football';

// ============================================
// TYPES
// ============================================

interface ResultFieldsProps {
  getAIConfidenceClass: (fieldName: string) => string;
}

// ============================================
// COMPONENT
// ============================================

export function ResultFields({ getAIConfidenceClass }: ResultFieldsProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();

  return (
    <>
      {/* Result Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Result <span className="text-red-600">*</span>
        </label>
        <select
          {...register('result_type', { required: 'Please select result' })}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('result_type')}`}
        >
          <option value="">Select result...</option>
          {RESULT_TYPES.map(result => (
            <option key={result.value} value={result.value}>{result.label}</option>
          ))}
        </select>
        {errors.result_type && <p className="text-red-600 text-sm mt-1">{(errors.result_type as any).message}</p>}
      </div>

      {/* Yards Gained */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Yards Gained</label>
        <input
          {...register('yards_gained', {
            onChange: (e) => {
              const yards = parseInt(e.target.value);
              const distance = parseInt(String(watch('distance') || '0'));
              const down = parseInt(String(watch('down') || '0'));
              if (!isNaN(yards) && !isNaN(distance) && down > 1) {
                setValue('resulted_in_first_down', yards >= distance);
              } else if (down === 1) {
                setValue('resulted_in_first_down', false);
              }
            },
          })}
          type="number"
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('yards_gained')}`}
          placeholder="Negative for loss, positive for gain"
        />
        <p className="text-xs text-gray-500 mt-1">Auto-checks if down is 2nd-4th and yards ≥ distance</p>
      </div>

      {/* First Down Checkbox */}
      <div className="flex items-center space-x-2">
        <input {...register('resulted_in_first_down')} type="checkbox" id="first-down" className="w-4 h-4 text-gray-900 border-gray-300 rounded" />
        <label htmlFor="first-down" className="text-sm font-medium text-gray-700">Resulted in First Down</label>
      </div>

      {/* Score */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
        <select
          {...register('scoring_type', {
            onChange: (e) => {
              const selectedType = SCORING_TYPES.find(s => s.value === e.target.value);
              setValue('scoring_points', selectedType ? selectedType.points : undefined);
            },
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
        >
          <option value="">No score on this play</option>
          {SCORING_TYPES.map(score => (
            <option key={score.value} value={score.value}>{score.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">Select if this play resulted in points</p>
      </div>

      {/* Penalty */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Penalty</label>
        <select
          {...register('penalty_type', {
            onChange: (e) => {
              const selectedPenalty = PENALTY_TYPES.find(p => p.value === e.target.value);
              if (selectedPenalty) {
                setValue('penalty_on_play', true);
                setValue('penalty_yards', selectedPenalty.yards);
              } else {
                setValue('penalty_on_play', false);
                setValue('penalty_yards', undefined);
                setValue('penalty_on_us', undefined);
              }
            },
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
        >
          <option value="">No penalty on this play</option>
          {PENALTY_TYPES.map(penalty => (
            <option key={penalty.value} value={penalty.value}>
              {penalty.label} ({penalty.yards > 0 ? `${penalty.yards} yds` : 'Spot foul'})
            </option>
          ))}
        </select>

        {watch('penalty_type') && (
          <div className="pl-4 border-l-2 border-yellow-400 space-y-2">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Penalty On:</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1">
                  <input {...register('penalty_on_us')} type="radio" value="true" className="text-gray-900" />
                  <span className="text-sm text-gray-700">Our Team</span>
                </label>
                <label className="flex items-center space-x-1">
                  <input {...register('penalty_on_us')} type="radio" value="false" className="text-gray-900" />
                  <span className="text-sm text-gray-700">Opponent</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Penalty Yards</label>
                <input {...register('penalty_yards')} type="number" className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md text-gray-900" placeholder="Yards" />
              </div>
              <label className="flex items-center gap-2 mt-4">
                <input {...register('penalty_declined')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-gray-600" />
                <span className="text-sm text-gray-600">Declined</span>
              </label>
            </div>
            {watch('penalty_declined') && (
              <p className="text-xs text-gray-500 italic">
                Penalty will not affect next play&apos;s down, distance, or field position
              </p>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" placeholder="Optional notes..." />
      </div>
    </>
  );
}

export default ResultFields;
