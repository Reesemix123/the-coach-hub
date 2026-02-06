'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import {
  SPECIAL_TEAMS_UNITS,
  KICK_RESULTS,
  PUNT_TYPES,
  KICKOFF_TYPES,
  SNAP_QUALITY_OPTIONS,
  SCORING_TYPES,
  PENALTY_TYPES,
  getKickResultsForUnit,
  type SpecialTeamsUnit,
} from '@/types/football';
import { playerHasPosition, getPlayerDisplayName } from '@/utils/playerHelpers';

// ============================================
// TYPES
// ============================================

interface SpecialTeamsFieldsProps {
  players: any[];
  selectedSpecialTeamsUnit: SpecialTeamsUnit | '';
  setSelectedSpecialTeamsUnit: (unit: SpecialTeamsUnit | '') => void;
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

export function SpecialTeamsFields({
  players,
  selectedSpecialTeamsUnit,
  setSelectedSpecialTeamsUnit,
  getAIConfidenceClass,
  renderPlayerOptions,
}: SpecialTeamsFieldsProps) {
  const { register, watch, setValue } = useFormContext();

  return (
    <>
      {/* Unit Selection */}
      <div className="mb-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Special Teams Unit</label>
        <select
          value={selectedSpecialTeamsUnit}
          onChange={(e) => setSelectedSpecialTeamsUnit(e.target.value as SpecialTeamsUnit | '')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
        >
          <option value="">Select Unit...</option>
          {SPECIAL_TEAMS_UNITS.map(unit => (
            <option key={unit.value} value={unit.value}>{unit.label}</option>
          ))}
        </select>
      </div>

      {/* Unit-Specific Form */}
      {selectedSpecialTeamsUnit && (
        <div className="mb-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            {SPECIAL_TEAMS_UNITS.find(u => u.value === selectedSpecialTeamsUnit)?.label} Details
          </label>

          {/* Kicker (Kickoff, FG, PAT) */}
          {['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Kicker</label>
              <select {...register('kicker_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select kicker...</option>
                {renderPlayerOptions(p => playerHasPosition(p, 'K'), 'Kickers')}
              </select>
            </div>
          )}

          {/* Punter */}
          {selectedSpecialTeamsUnit === 'punt' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Punter</label>
              <select {...register('punter_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select punter...</option>
                {renderPlayerOptions(p => playerHasPosition(p, 'P'), 'Punters')}
              </select>
            </div>
          )}

          {/* Returner */}
          {['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit) && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Returner</label>
              <select {...register('returner_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select returner...</option>
                {renderPlayerOptions(p => playerHasPosition(p, 'KR') || playerHasPosition(p, 'PR'), 'Returners')}
              </select>
            </div>
          )}

          {/* FG Block: Blocker */}
          {selectedSpecialTeamsUnit === 'fg_block' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Blocked By</label>
              <select {...register('blocker_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select player who blocked...</option>
                {renderPlayerOptions(p => playerHasPosition(p, ['DL', 'LB', 'DE', 'DT', 'NT']), 'Defensive Players')}
              </select>
            </div>
          )}

          {/* Kickoff Type */}
          {selectedSpecialTeamsUnit === 'kickoff' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Kickoff Type</label>
              <select {...register('kickoff_type')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select type...</option>
                {KICKOFF_TYPES.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
              </select>
            </div>
          )}

          {/* Punt Type */}
          {selectedSpecialTeamsUnit === 'punt' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Punt Type</label>
              <select {...register('punt_type')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select type...</option>
                {PUNT_TYPES.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
              </select>
            </div>
          )}

          {/* Kick Result */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Result</label>
            <select
              {...register('kick_result', {
                onChange: (e) => {
                  const result = e.target.value;
                  const isKickingUnit = ['punt', 'kickoff'].includes(selectedSpecialTeamsUnit);
                  if (result === 'returned_td' || result === 'blocked_td') {
                    setValue('scoring_type', 'touchdown');
                    setValue('scoring_points', 6);
                    setValue('opponent_scored', isKickingUnit);
                  } else if (result === 'made' && selectedSpecialTeamsUnit === 'field_goal') {
                    setValue('scoring_type', 'field_goal');
                    setValue('scoring_points', 3);
                    setValue('opponent_scored', false);
                  } else if (result === 'made' && selectedSpecialTeamsUnit === 'pat') {
                    setValue('scoring_type', 'pat');
                    setValue('scoring_points', 1);
                    setValue('opponent_scored', false);
                  } else {
                    setValue('scoring_type', '');
                    setValue('scoring_points', undefined);
                    setValue('opponent_scored', false);
                  }
                },
              })}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('kick_result')}`}
            >
              <option value="">Select result...</option>
              {getKickResultsForUnit(selectedSpecialTeamsUnit).map(result => (
                <option key={result.value} value={result.value}>{result.label}</option>
              ))}
            </select>
          </div>

          {/* Distance/Yards */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {['field_goal', 'punt', 'kickoff'].includes(selectedSpecialTeamsUnit) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {selectedSpecialTeamsUnit === 'field_goal' ? 'FG Distance (yds)' :
                   selectedSpecialTeamsUnit === 'punt' ? 'Gross Punt Yards' : 'Kickoff Distance'}
                </label>
                <input
                  {...register('kick_distance')} type="number" min="0" max="99"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('kick_distance')}`}
                  placeholder={selectedSpecialTeamsUnit === 'field_goal' ? '35' : '45'}
                />
              </div>
            )}
            {['kick_return', 'punt_return', 'fg_block'].includes(selectedSpecialTeamsUnit) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Return Yards</label>
                <input
                  {...register('return_yards')} type="number" min="-99" max="109"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('return_yards')}`}
                  placeholder="25"
                />
              </div>
            )}
          </div>

          {/* Long Snapper */}
          {['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Long Snapper</label>
                <select {...register('long_snapper_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select...</option>
                  {renderPlayerOptions(p => playerHasPosition(p, 'LS'), 'Long Snappers')}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Snap Quality</label>
                <select {...register('snap_quality')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select...</option>
                  {SNAP_QUALITY_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
            </div>
          )}

          {/* Holder */}
          {['field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Holder</label>
              <select {...register('holder_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select holder...</option>
                {renderPlayerOptions(p => playerHasPosition(p, 'H') || playerHasPosition(p, 'P') || playerHasPosition(p, 'QB'), 'Holders')}
              </select>
            </div>
          )}

          {/* Coverage Tackler */}
          {['kickoff', 'punt'].includes(selectedSpecialTeamsUnit) && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {selectedSpecialTeamsUnit === 'punt' ? 'Gunner/Coverage Tackler' : 'Coverage Tackler'}
              </label>
              <select {...register('coverage_tackler_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">Select tackler...</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    #{player.jersey_number} {getPlayerDisplayName(player)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scoring */}
          <div className="mt-4 pt-3 border-t border-green-200">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-900">Scoring</label>
              {watch('opponent_scored') && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Opponent Scores</span>
              )}
              {watch('scoring_type') && !watch('opponent_scored') && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Your Team Scores</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Score Type</label>
                <select
                  {...register('scoring_type', {
                    onChange: (e) => {
                      const selectedType = SCORING_TYPES.find(s => s.value === e.target.value);
                      setValue('scoring_points', selectedType ? selectedType.points : undefined);
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">No Score</option>
                  {SCORING_TYPES.map(score => (
                    <option key={score.value} value={score.value}>{score.label} ({score.points} pts)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Points</label>
                <input {...register('scoring_points')} type="number" min="0" max="8" className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-gray-50" readOnly />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {['punt', 'kickoff'].includes(selectedSpecialTeamsUnit)
                ? 'If opponent returns for TD, points go to opponent'
                : selectedSpecialTeamsUnit === 'kick_return' || selectedSpecialTeamsUnit === 'punt_return'
                ? 'If you return for TD, points go to your team'
                : selectedSpecialTeamsUnit === 'field_goal'
                ? 'Auto-set when FG result is "Made"'
                : selectedSpecialTeamsUnit === 'pat'
                ? 'Auto-set when PAT result is "Made"'
                : 'Select if play resulted in scoring'}
            </p>
          </div>

          {/* Penalty */}
          <div className="mt-4 pt-3 border-t border-amber-200">
            <label className="flex items-center space-x-2 mb-2">
              <input {...register('penalty_on_play')} type="checkbox" className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm font-medium text-gray-700">Penalty on Play</span>
            </label>
            {watch('penalty_on_play') && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Type</label>
                    <select
                      {...register('penalty_type', {
                        onChange: (e) => {
                          const selectedPenalty = PENALTY_TYPES.find(p => p.value === e.target.value);
                          if (selectedPenalty) setValue('penalty_yards', selectedPenalty.yards);
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select penalty...</option>
                      {PENALTY_TYPES.map(penalty => (
                        <option key={penalty.value} value={penalty.value}>
                          {penalty.label} ({penalty.yards > 0 ? `${penalty.yards} yds` : 'Spot foul'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Yards</label>
                    <input {...register('penalty_yards')} type="number" min="0" max="99" className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium text-gray-700">Penalty On:</span>
                  <label className="flex items-center gap-1"><input {...register('penalty_on_us')} type="radio" value="true" className="text-gray-900" /><span className="text-xs text-gray-700">Our Team</span></label>
                  <label className="flex items-center gap-1"><input {...register('penalty_on_us')} type="radio" value="false" className="text-gray-900" /><span className="text-xs text-gray-700">Opponent</span></label>
                </div>
                <label className="flex items-center gap-2 mt-2">
                  <input {...register('penalty_declined')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-gray-600" />
                  <span className="text-xs text-gray-600">Penalty Declined</span>
                </label>
                {watch('penalty_declined') && (
                  <p className="text-xs text-gray-500 italic">Penalty will not affect next play calculations</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Field Position & Quarter */}
      {selectedSpecialTeamsUnit && (
        <div className="mb-4 bg-white rounded p-3 border border-gray-200">
          {['punt', 'punt_return', 'field_goal', 'fg_block'].includes(selectedSpecialTeamsUnit) ? (
            <>
              <label className="block text-xs font-semibold text-gray-900 mb-2">Field Position</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Yard Line</label>
                  <input {...register('yard_line')} type="number" min="0" max="100" placeholder="25" className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedSpecialTeamsUnit === 'punt_return' ? 'Where return ended' : '0 = own goal, 50 = midfield'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                  <select {...register('quarter')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                    <option value="">-</option>
                    <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option><option value="5">OT</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
              <select {...register('quarter')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                <option value="">-</option>
                <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option><option value="5">OT</option>
              </select>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default SpecialTeamsFields;
