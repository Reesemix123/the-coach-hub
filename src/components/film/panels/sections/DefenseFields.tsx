'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { OPPONENT_PLAY_TYPES } from '@/config/footballConfig';
import { DLPerformanceSection } from '@/components/film/DLPerformanceSection';
import { LBPerformanceSection } from '@/components/film/LBPerformanceSection';
import { DBPerformanceSection } from '@/components/film/DBPerformanceSection';
import { playerInPositionGroup, getPositionDisplay } from '@/utils/playerHelpers';
import type { TaggingTier } from '@/types/football';

// ============================================
// CONSTANTS
// ============================================

const QB_DECISION_GRADES = [
  { value: 0, label: '0 - Bad Decision' },
  { value: 1, label: '1 - OK Decision' },
  { value: 2, label: '2 - Great Decision' },
];

// ============================================
// TYPES
// ============================================

interface DefenseFieldsProps {
  players: any[];
  taggingTier: TaggingTier | null;
  selectedTacklers: string[];
  primaryTacklerId: string;
  toggleTackler: (playerId: string) => void;
  setPrimaryTackler: (playerId: string) => void;
  getAIConfidenceClass: (fieldName: string) => string;
}

// ============================================
// TACKLERSECTION (shared between quick/standard and comprehensive)
// ============================================

function TacklerSection({
  players,
  selectedTacklers,
  primaryTacklerId,
  toggleTackler,
  setPrimaryTackler,
  radioName = 'primary-tackler',
}: {
  players: any[];
  selectedTacklers: string[];
  primaryTacklerId: string;
  toggleTackler: (playerId: string) => void;
  setPrimaryTackler: (playerId: string) => void;
  radioName?: string;
}) {
  const defensivePlayers = players.filter(p => playerInPositionGroup(p, 'defense'));

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-2">
        Tacklers {selectedTacklers.length > 0 && <span className="text-gray-500">({selectedTacklers.length} selected)</span>}
      </label>
      <p className="text-xs text-gray-500 mb-2">Select all players involved in the tackle. Designate one as primary.</p>

      <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
        {defensivePlayers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-500">No defensive players found</div>
        ) : (
          defensivePlayers.map(player => {
            const isSelected = selectedTacklers.includes(player.id);
            const isPrimary = primaryTacklerId === player.id;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleTackler(player.id)} className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label className="flex-1 text-sm text-gray-900 cursor-pointer" onClick={() => toggleTackler(player.id)}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </label>
                {isSelected && (
                  <div className="flex items-center gap-2">
                    <input type="radio" name={radioName} checked={isPrimary} onChange={() => setPrimaryTackler(player.id)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <span className="text-xs text-gray-600">Primary</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {selectedTacklers.length > 0 && !primaryTacklerId && (
        <p className="text-xs text-amber-600 mt-1">⚠ Select which tackler is primary</p>
      )}
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function DefenseFields({
  players,
  taggingTier,
  selectedTacklers,
  primaryTacklerId,
  toggleTackler,
  setPrimaryTackler,
  getAIConfidenceClass,
}: DefenseFieldsProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const isComprehensive = taggingTier === 'comprehensive';

  return (
    <>
      {/* Opponent Play Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Opponent Play Type <span className="text-red-600">*</span>
        </label>
        <select
          {...register('opponent_play_type', { required: 'Please select play type' })}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('opponent_play_type')}`}
        >
          <option value="">Select play type...</option>
          <optgroup label="Run Plays">
            {OPPONENT_PLAY_TYPES.run.map(play => (<option key={play} value={play}>{play}</option>))}
          </optgroup>
          <optgroup label="Pass Plays">
            {OPPONENT_PLAY_TYPES.pass.map(play => (<option key={play} value={play}>{play}</option>))}
          </optgroup>
          <optgroup label="Special Teams">
            {OPPONENT_PLAY_TYPES.special.map(play => (<option key={play} value={play}>{play}</option>))}
          </optgroup>
        </select>
        {errors.opponent_play_type && <p className="text-red-600 text-sm mt-1">{(errors.opponent_play_type as any).message}</p>}
      </div>

      {/* Opponent Player Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Opponent Player Number</label>
        <input {...register('opponent_player_number')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" placeholder="e.g., #24" />
        <p className="text-xs text-gray-500 mt-1">Optional - jersey number of ball carrier</p>
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
      </div>

      {/* Basic Defensive Tracking (Quick/Standard) */}
      {!isComprehensive && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Defensive Players</h4>
          <p className="text-xs text-gray-600 mb-3">Track which of your players made tackles on this opponent play</p>
          <div className="space-y-3">
            <TacklerSection
              players={players}
              selectedTacklers={selectedTacklers}
              primaryTacklerId={primaryTacklerId}
              toggleTackler={toggleTackler}
              setPrimaryTackler={setPrimaryTackler}
            />
          </div>
        </div>
      )}

      {/* Advanced Defensive Performance (Comprehensive) */}
      {isComprehensive && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Defensive Stats (Comprehensive)</h4>
          <div className="space-y-3">
            <TacklerSection
              players={players}
              selectedTacklers={selectedTacklers}
              primaryTacklerId={primaryTacklerId}
              toggleTackler={toggleTackler}
              setPrimaryTackler={setPrimaryTackler}
              radioName="primary-tackler-advanced"
            />

            {/* Missed Tackles */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Missed Tackles {watch('missed_tackle_ids')?.split(',').filter(Boolean).length > 0 && (
                  <span className="text-gray-500">({watch('missed_tackle_ids')?.split(',').filter(Boolean).length} players)</span>
                )}
              </label>
              <p className="text-xs text-gray-500 mb-2">Players who attempted but missed the tackle</p>
              <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto">
                {players.filter(p => playerInPositionGroup(p, 'defense')).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">No defensive players found</div>
                ) : (
                  players.filter(p => playerInPositionGroup(p, 'defense')).map(player => {
                    const missedIds = watch('missed_tackle_ids')?.split(',').filter(Boolean) || [];
                    const isSelected = missedIds.includes(player.id);
                    return (
                      <label key={player.id} className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-yellow-50' : ''}`}>
                        <input
                          type="checkbox" checked={isSelected}
                          onChange={(e) => {
                            const currentIds = watch('missed_tackle_ids')?.split(',').filter(Boolean) || [];
                            const newIds = e.target.checked ? [...currentIds, player.id] : currentIds.filter((id: string) => id !== player.id);
                            setValue('missed_tackle_ids', newIds.join(','));
                          }}
                          className="h-4 w-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                        />
                        <span className="text-sm text-gray-900">
                          #{player.jersey_number} {player.first_name} {player.last_name}
                          <span className="text-xs text-gray-500 ml-1">({getPositionDisplay(player)})</span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pressure Players & Sacks (Pass Plays Only) */}
            {watch('opponent_play_type')?.toLowerCase().includes('pass') && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <label className="block text-xs font-semibold text-gray-700">Pass Rush</label>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Pressured QB {watch('pressure_player_ids')?.split(',').filter(Boolean).length > 0 && (
                      <span className="text-gray-500">({watch('pressure_player_ids')?.split(',').filter(Boolean).length} players)</span>
                    )}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Players who hurried, hit, or sacked the QB</p>
                  <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto">
                    {players.filter(p => playerInPositionGroup(p, 'defense')).map(player => {
                      const pressureIds = watch('pressure_player_ids')?.split(',').filter(Boolean) || [];
                      const isSelected = pressureIds.includes(player.id);
                      return (
                        <label key={player.id} className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-red-50' : ''}`}>
                          <input
                            type="checkbox" checked={isSelected}
                            onChange={(e) => {
                              const currentIds = watch('pressure_player_ids')?.split(',').filter(Boolean) || [];
                              const newIds = e.target.checked ? [...currentIds, player.id] : currentIds.filter((id: string) => id !== player.id);
                              setValue('pressure_player_ids', newIds.join(','));
                              if (!e.target.checked && watch('sack_player_id') === player.id) setValue('sack_player_id', '');
                            }}
                            className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-900">
                            #{player.jersey_number} {player.first_name} {player.last_name}
                            <span className="text-xs text-gray-500 ml-1">({getPositionDisplay(player)})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Sack Player */}
                {watch('pressure_player_ids')?.split(',').filter(Boolean).length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Sack (if QB was sacked)</label>
                    <select {...register('sack_player_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                      <option value="">No sack (just pressure)</option>
                      {watch('pressure_player_ids')?.split(',').filter(Boolean).map((playerId: string) => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;
                        return (
                          <option key={playerId} value={playerId}>
                            #{player.jersey_number} {player.first_name} {player.last_name} ({getPositionDisplay(player)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Coverage Tracking (Pass Plays Only) */}
            {watch('opponent_play_type')?.toLowerCase().includes('pass') && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <label className="block text-xs font-semibold text-gray-700">Coverage</label>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Player in Coverage</label>
                  <p className="text-xs text-gray-500 mb-2">Defender assigned to cover the target/zone</p>
                  <select {...register('coverage_player_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                    <option value="">-</option>
                    {players.filter(p => playerInPositionGroup(p, 'defense')).map(player => (
                      <option key={player.id} value={player.id}>
                        #{player.jersey_number} {player.first_name} {player.last_name} ({getPositionDisplay(player)})
                      </option>
                    ))}
                  </select>
                </div>

                {watch('coverage_player_id') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Coverage Result</label>
                    <p className="text-xs text-gray-500 mb-2">What happened on this coverage assignment?</p>
                    <div className="space-y-2">
                      {[
                        { value: 'target_allowed', label: 'Target Allowed', desc: '(ball thrown at receiver)', color: 'blue' },
                        { value: 'completion_allowed', label: 'Completion Allowed', desc: '(receiver caught it)', color: 'red' },
                        { value: 'incompletion', label: 'Incompletion', desc: '(pass defended/dropped)', color: 'green' },
                        { value: 'interception', label: 'Interception', desc: '(INT by coverage player)', color: 'green' },
                        { value: 'pass_breakup', label: 'Pass Breakup', desc: '(PBU by coverage player)', color: 'green' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input {...register('coverage_result')} type="radio" value={opt.value} className={`h-4 w-4 text-${opt.color}-600 border-gray-300 focus:ring-${opt.color}-500`} />
                          <span className="text-sm text-gray-900">{opt.label} <span className="text-xs text-gray-500">{opt.desc}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Position-Specific Defensive Performance */}
            <div className="space-y-3 pt-4">
              <DLPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
              <LBPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
              <DBPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
            </div>

            {/* Defensive Events */}
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">Big Plays</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { field: 'is_tfl', label: 'Tackle for Loss' },
                  { field: 'is_sack', label: 'Sack' },
                  { field: 'is_forced_fumble', label: 'Forced Fumble' },
                  { field: 'is_pbu', label: 'Pass Breakup' },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center space-x-2">
                    <input {...register(field)} type="checkbox" className="w-4 h-4 text-red-600 border-gray-300 rounded" />
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Forced Fumble Attribution */}
              {watch('is_forced_fumble') && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Forced By <span className="text-red-600">*</span>
                  </label>
                  <select {...register('forced_fumble_player_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
                    <option value="">Select player...</option>
                    {players
                      .filter(p => ['DL', 'LB', 'DB', 'S', 'CB'].some(pos => p.primary_position?.includes(pos)))
                      .map(player => (
                        <option key={player.id} value={player.id}>
                          #{player.jersey_number} {player.first_name} {player.last_name} ({player.primary_position})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QB Evaluation (Pass Plays Only) */}
      {watch('opponent_play_type')?.toLowerCase().includes('pass') && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">Opponent QB Evaluation</label>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">QB Decision Grade</label>
            <select {...register('qb_decision_grade')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900">
              <option value="">-</option>
              {QB_DECISION_GRADES.map(grade => (
                <option key={grade.value} value={grade.value}>{grade.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Grade the opponent QB&apos;s decision-making on this play</p>
          </div>
        </div>
      )}

      {/* Intercepted By */}
      {watch('result_type') === 'pass_interception' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Intercepted By <span className="text-red-600">*</span>
          </label>
          <select {...register('interception_player_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
            <option value="">Select player...</option>
            {players
              .filter(p => ['DL', 'LB', 'DB', 'S', 'CB'].some(pos => p.primary_position?.includes(pos)))
              .map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name} ({player.primary_position})
                </option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Select the defensive player who intercepted the pass</p>
        </div>
      )}
    </>
  );
}

export default DefenseFields;
