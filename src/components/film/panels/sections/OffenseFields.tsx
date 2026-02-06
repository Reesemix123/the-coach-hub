'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { QBPerformanceSection } from '@/components/film/QBPerformanceSection';
import { RBPerformanceSection } from '@/components/film/RBPerformanceSection';
import { WRPerformanceSection } from '@/components/film/WRPerformanceSection';
import { OLPerformanceSection } from '@/components/film/OLPerformanceSection';
import { playerHasPosition } from '@/utils/playerHelpers';

// ============================================
// CONSTANTS
// ============================================

const PLAY_TYPES = [
  { value: 'run', label: 'Run' },
  { value: 'pass', label: 'Pass' },
  { value: 'screen', label: 'Screen' },
  { value: 'rpo', label: 'RPO' },
  { value: 'trick', label: 'Trick Play' },
];

const DIRECTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'middle', label: 'Middle' },
  { value: 'right', label: 'Right' },
];

// ============================================
// TYPES
// ============================================

interface OffenseFieldsProps {
  players: any[];
  plays: any[];
  isFieldVisible: (field: string) => boolean;
  getAIConfidenceClass: (fieldName: string) => string;
  renderPlayerOptions: (
    preferredFilter: (p: any) => boolean,
    preferredLabel?: string,
    showPosition?: boolean,
    excludeIds?: string[]
  ) => React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function OffenseFields({
  players,
  plays,
  isFieldVisible,
  getAIConfidenceClass,
  renderPlayerOptions,
}: OffenseFieldsProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();

  return (
    <>
      {/* Play Code Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Play <span className="text-red-600">*</span>
        </label>
        <select
          {...register('play_code', { required: 'Please select a play' })}
          onChange={(e) => {
            const selectedPlay = plays.find((p: any) => p.play_code === e.target.value);
            if (selectedPlay?.attributes) {
              const attrs = selectedPlay.attributes;
              if (attrs.formation) setValue('formation', attrs.formation);
              if (attrs.playType) {
                const playType = attrs.playType.toLowerCase();
                if (playType.includes('run')) setValue('play_type', 'run');
                else if (playType.includes('pass')) setValue('play_type', 'pass');
                else if (playType.includes('screen')) setValue('play_type', 'screen');
                else if (playType.includes('rpo')) setValue('play_type', 'rpo');
                else if (playType.includes('trick')) setValue('play_type', 'trick');
              }
              if (attrs.targetHole) {
                const hole = attrs.targetHole.toLowerCase();
                if (hole.includes('left') || hole === '0' || hole === '2' || hole === '4') setValue('direction', 'left');
                else if (hole.includes('right') || hole === '1' || hole === '3' || hole === '5') setValue('direction', 'right');
                else if (hole === '6' || hole === '7' || hole === '8' || hole === '9' || hole.includes('middle')) setValue('direction', 'middle');
              }
              if (attrs.playType?.toLowerCase().includes('pass')) {
                if (attrs.ballCarrier && !attrs.ballCarrier.toUpperCase().includes('QB')) {
                  const passerPosition = attrs.ballCarrier.toUpperCase();
                  const potentialPasser = players.find((p: any) =>
                    playerHasPosition(p, passerPosition) ||
                    playerHasPosition(p, ['RB', 'FB']) && passerPosition.includes('RB') ||
                    playerHasPosition(p, ['X', 'Y', 'Z']) && passerPosition.includes('WR')
                  );
                  if (potentialPasser) setValue('qb_id', potentialPasser.id);
                } else {
                  const qb = players.find((p: any) => playerHasPosition(p, 'QB'));
                  if (qb) setValue('qb_id', qb.id);
                }
              } else {
                setValue('qb_id', '');
              }
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
        >
          <option value="">Select play...</option>
          {plays.map((play: any) => (
            <option key={play.play_code} value={play.play_code}>
              {play.play_code} - {play.play_name}
            </option>
          ))}
        </select>
        {errors.play_code && <p className="text-red-600 text-sm mt-1">{(errors.play_code as any).message}</p>}
      </div>

      {/* Formation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Formation</label>
        <input
          {...register('formation')}
          type="text"
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('formation')}`}
          placeholder="e.g., Shotgun Spread, I-Formation"
        />
        <p className="text-xs text-gray-500 mt-1">Auto-filled from playbook when available</p>
      </div>

      {/* Player Performance */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Player Performance</h4>

        {/* Play Type & Direction */}
        {isFieldVisible('play_type') && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Play Type</label>
              <select {...register('play_type')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                <option value="">-</option>
                {PLAY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            {isFieldVisible('direction') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
                <select
                  {...register('direction')}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('direction')}`}
                >
                  <option value="">-</option>
                  {DIRECTIONS.map(dir => (
                    <option key={dir.value} value={dir.value}>{dir.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Player Attribution */}
        <div className="space-y-2">
          {isFieldVisible('qb_id') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">QB</label>
              <select {...register('qb_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                <option value="">-</option>
                {renderPlayerOptions(p => playerHasPosition(p, 'QB'), 'Quarterbacks', false)}
              </select>
            </div>
          )}

          {/* Ball Carrier */}
          {(['run', 'rpo', 'trick', ''].includes(watch('play_type') || '')) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ball Carrier {watch('play_type') === 'run' && <span className="text-red-600">*</span>}
              </label>
              <select {...register('ball_carrier_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                <option value="">-</option>
                {renderPlayerOptions(p => playerHasPosition(p, ['QB', 'RB', 'FB', 'WR']), 'Ball Carriers')}
              </select>
              <p className="text-xs text-gray-500 mt-1">Who had the ball (RB on runs)</p>
            </div>
          )}

          {/* Target */}
          {(['pass', 'screen', 'rpo', 'trick', ''].includes(watch('play_type') || '')) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Target {['pass', 'screen'].includes(watch('play_type') || '') && <span className="text-red-600">*</span>}
              </label>
              <select {...register('target_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                <option value="">-</option>
                {renderPlayerOptions(
                  p => playerHasPosition(p, ['WR', 'TE', 'RB']),
                  'Receivers',
                  true,
                  watch('qb_id') ? [watch('qb_id')] : []
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">Intended receiver (even if incomplete)</p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Offensive Performance (Comprehensive) */}
      {isFieldVisible('qb_decision_grade') && (
        <div className="space-y-3">
          <QBPerformanceSection register={register} />
          <RBPerformanceSection register={register} />
          <WRPerformanceSection register={register} />
          <OLPerformanceSection register={register} players={players} />
        </div>
      )}
    </>
  );
}

export default OffenseFields;
