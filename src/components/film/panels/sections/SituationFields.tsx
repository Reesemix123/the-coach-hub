'use client';

import React, { useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { COMMON_ATTRIBUTES } from '@/config/footballConfig';
import type { Drive } from '@/types/football';

// ============================================
// CONSTANTS
// ============================================

const DOWNS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
];

const HASH_MARKS = COMMON_ATTRIBUTES.hash.map(h => ({
  value: h.toLowerCase(),
  label: h,
}));

// ============================================
// TYPES
// ============================================

interface SituationFieldsProps {
  isTaggingOpponent: boolean;
  isOpponentGame: boolean;
  drives: Drive[];
  currentDrive: Drive | null;
  driveAssignMode: 'current' | 'new' | 'select';
  setDriveAssignMode: (mode: 'current' | 'new' | 'select') => void;
  autoPopulatedFields: string[];
  getFieldClassName: (fieldName: string, baseClass: string) => string;
  handleFieldChange: (fieldName: string) => void;
  getAIConfidenceClass: (fieldName: string) => string;
  teamName?: string;
  opponentName?: string;
  teamId?: string;
  gameId?: string;
  tagStartTime?: number;
}

// Confidence thresholds per field
const CONFIDENCE_THRESHOLDS: Record<string, number> = {
  quarter: 50,
  clock: 50,
  homeScore: 70,
  awayScore: 70,
  down: 70,
  distance: 70,
};

interface AIFieldState {
  confidence: number;
  fieldName: string;
}

// ============================================
// COMPONENT
// ============================================

export function SituationFields({
  isTaggingOpponent,
  isOpponentGame,
  drives,
  currentDrive,
  driveAssignMode,
  setDriveAssignMode,
  autoPopulatedFields,
  getFieldClassName,
  handleFieldChange,
  getAIConfidenceClass,
  teamName,
  opponentName,
  teamId,
  gameId,
  tagStartTime,
}: SituationFieldsProps) {
  const { register, watch, setValue } = useFormContext();

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [noCamera, setNoCamera] = useState(false);
  const [aiFields, setAiFields] = useState<AIFieldState[]>([]);
  const [partialNote, setPartialNote] = useState<string | null>(null);

  const handleReadScoreboard = useCallback(async () => {
    if (!teamId || !gameId || tagStartTime == null) return;

    setOcrLoading(true);
    setOcrError(null);
    setNoCamera(false);
    setPartialNote(null);
    setAiFields([]);

    try {
      const res = await fetch(`/api/teams/${teamId}/ai-tagging/scoreboard-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, timestampSeconds: tagStartTime }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'NO_SCOREBOARD_CAMERA') {
          setNoCamera(true);
          return;
        }
        throw new Error(data.message || 'Scoreboard read failed');
      }

      if (!data.reading) {
        throw new Error('No reading returned');
      }

      const reading = data.reading;
      const filled: AIFieldState[] = [];
      let skipped = 0;

      // Apply fields that meet confidence thresholds
      if (reading.quarter?.confidence >= CONFIDENCE_THRESHOLDS.quarter) {
        setValue('quarter', reading.quarter.value);
        filled.push({ confidence: reading.quarter.confidence, fieldName: 'quarter' });
      } else if (reading.quarter) {
        skipped++;
      }

      if (reading.clock?.confidence >= CONFIDENCE_THRESHOLDS.clock) {
        setValue('clock_start', reading.clock.value);
        filled.push({ confidence: reading.clock.confidence, fieldName: 'clock_start' });
      } else if (reading.clock) {
        skipped++;
      }

      if (reading.homeScore?.confidence >= CONFIDENCE_THRESHOLDS.homeScore) {
        setValue('team_score_at_snap', reading.homeScore.value);
        filled.push({ confidence: reading.homeScore.confidence, fieldName: 'team_score_at_snap' });
      } else if (reading.homeScore) {
        skipped++;
      }

      if (reading.awayScore?.confidence >= CONFIDENCE_THRESHOLDS.awayScore) {
        setValue('opponent_score_at_snap', reading.awayScore.value);
        filled.push({ confidence: reading.awayScore.confidence, fieldName: 'opponent_score_at_snap' });
      } else if (reading.awayScore) {
        skipped++;
      }

      if (reading.down?.confidence >= CONFIDENCE_THRESHOLDS.down) {
        setValue('down', reading.down.value);
        filled.push({ confidence: reading.down.confidence, fieldName: 'down' });
      } else if (reading.down) {
        skipped++;
      }

      if (reading.distance?.confidence >= CONFIDENCE_THRESHOLDS.distance) {
        setValue('distance', reading.distance.value);
        filled.push({ confidence: reading.distance.confidence, fieldName: 'distance' });
      } else if (reading.distance) {
        skipped++;
      }

      if (filled.length > 0) {
        setValue('score_source', 'ai');
      }

      setAiFields(filled);

      if (skipped > 0) {
        setPartialNote(`${skipped} field${skipped > 1 ? 's' : ''} could not be read clearly`);
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Scoreboard read failed');
    } finally {
      setOcrLoading(false);
    }
  }, [teamId, gameId, tagStartTime, setValue]);

  // Helper: get AI confidence for a specific field
  const getAIFieldConfidence = (fieldName: string): number | null => {
    const field = aiFields.find(f => f.fieldName === fieldName);
    return field ? field.confidence : null;
  };

  return (
    <>
      {/* Drive Context */}
      {!isOpponentGame && (
        <div className={`mb-4 rounded-lg p-4 border ${isTaggingOpponent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Drive Context {isTaggingOpponent ? '(Defensive Drive)' : '(Offensive Drive)'}
          </label>

          {/* Current Drive Info */}
          {currentDrive && driveAssignMode === 'current' && (
            <div className={`bg-white rounded px-3 py-2 mb-3 border ${isTaggingOpponent ? 'border-red-200' : 'border-blue-200'}`}>
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Drive {currentDrive.drive_number}</span> • Q{currentDrive.quarter}
                {currentDrive.plays_count > 0 && <span className="text-gray-500"> • {currentDrive.plays_count} plays</span>}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Started at {currentDrive.start_yard_line} yard line
              </div>
            </div>
          )}

          {/* Drive Assignment Mode */}
          <div className="space-y-2">
            {drives.length > 0 && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" checked={driveAssignMode === 'current'} onChange={() => setDriveAssignMode('current')} className="w-4 h-4 text-gray-900" />
                <span className="text-sm font-medium text-gray-900">
                  Current Drive {currentDrive && `(Drive ${currentDrive.drive_number})`}
                </span>
              </label>
            )}

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={driveAssignMode === 'new'}
                onChange={() => {
                  setDriveAssignMode('new');
                  const possessionType = isTaggingOpponent ? 'defense' : 'offense';
                  const teamDrives = drives.filter((d: any) => d.possession_type === possessionType);
                  const maxDriveNum = teamDrives.length > 0 ? Math.max(...teamDrives.map((d: any) => d.drive_number || 0)) : 0;
                  setValue('new_drive_number', maxDriveNum + 1);
                }}
                className="w-4 h-4 text-gray-900"
              />
              <span className="text-sm font-medium text-gray-900">Start New Drive</span>
            </label>

            {drives.length > 1 && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" checked={driveAssignMode === 'select'} onChange={() => setDriveAssignMode('select')} className="w-4 h-4 text-gray-900" />
                <span className="text-sm font-medium text-gray-900">Select Different Drive</span>
              </label>
            )}
          </div>

          {/* New Drive Form */}
          {driveAssignMode === 'new' && (
            <div className="mt-3 space-y-2 bg-white rounded p-3 border border-gray-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Drive #</label>
                  <input {...register('new_drive_number')} type="number" min="1" defaultValue={drives.length + 1} className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                  <select {...register('new_drive_quarter')} defaultValue="1" className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900">
                    <option value="1">1st</option>
                    <option value="2">2nd</option>
                    <option value="3">3rd</option>
                    <option value="4">4th</option>
                    <option value="5">OT</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-600">Starting yard line will be set from play&apos;s yard line below</p>
            </div>
          )}

          {/* Select Different Drive */}
          {driveAssignMode === 'select' && (
            <div className="mt-3">
              <select {...register('drive_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-gray-900">
                <option value="">Select drive...</option>
                {drives
                  .filter((drive: any) => drive.possession_type === (isTaggingOpponent ? 'defense' : 'offense'))
                  .map((drive: any) => (
                    <option key={drive.id} value={drive.id}>
                      Drive #{drive.drive_number} - Q{drive.quarter} - {drive.possession_type.toUpperCase()} ({drive.plays_count} plays)
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Situational Context - Down & Distance */}
      <div className="mb-4 bg-white rounded p-3 border border-gray-200">
        <label className="block text-xs font-semibold text-gray-900 mb-2">Situation</label>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Down
              {getAIFieldConfidence('down') != null && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded font-medium">
                  AI {getAIFieldConfidence('down')}%
                </span>
              )}
            </label>
            <select
              {...register('down', {
                onChange: (e) => {
                  handleFieldChange('down');
                  const down = parseInt(e.target.value || '0');
                  if (down === 1) {
                    setValue('distance', 10);
                    setValue('resulted_in_first_down', false);
                  } else {
                    const yards = parseInt(String(watch('yards_gained') || '0'));
                    const distance = parseInt(String(watch('distance') || '0'));
                    if (!isNaN(yards) && !isNaN(distance)) {
                      setValue('resulted_in_first_down', yards >= distance);
                    }
                  }
                },
              })}
              className={getFieldClassName('down', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
            >
              <option value="">-</option>
              {DOWNS.map(down => (
                <option key={down.value} value={down.value}>{down.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Distance
              {getAIFieldConfidence('distance') != null && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded font-medium">
                  AI {getAIFieldConfidence('distance')}%
                </span>
              )}
            </label>
            <input
              {...register('distance', {
                onChange: () => {
                  handleFieldChange('distance');
                  const yards = parseInt(String(watch('yards_gained') || '0'));
                  const distance = parseInt(String(watch('distance') || '0'));
                  const down = parseInt(String(watch('down') || '0'));
                  if (!isNaN(yards) && !isNaN(distance) && down > 1) {
                    setValue('resulted_in_first_down', yards >= distance);
                  } else if (down === 1) {
                    setValue('resulted_in_first_down', false);
                  }
                },
              })}
              type="number" min="1" max="99" placeholder="10"
              className={getFieldClassName('distance', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
            />
          </div>
        </div>
        <p className="text-xs text-gray-600 mb-3">Yards needed for 1st down or TD</p>

        {/* Yard Line & Hash Mark */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Yard Line</label>
            <input
              {...register('yard_line', { onChange: () => handleFieldChange('yard_line') })}
              type="number" min="0" max="100" placeholder="25"
              className={getFieldClassName('yard_line', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
            />
            <p className="text-xs text-gray-500 mt-1">0 = own goal, 50 = midfield, 100 = opp goal</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hash Mark</label>
            <select
              {...register('hash_mark', { onChange: () => handleFieldChange('hash_mark') })}
              className={getFieldClassName('hash_mark', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
            >
              <option value="">-</option>
              {HASH_MARKS.map(hash => (
                <option key={hash.value} value={hash.value}>{hash.label}</option>
              ))}
            </select>
          </div>
        </div>

        {autoPopulatedFields.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
            <span className="inline-block w-3 h-3 bg-blue-50 border border-blue-300 rounded"></span>
            <span>Auto-calculated from previous play</span>
          </div>
        )}

        {/* Scoreboard OCR */}
        {teamId && gameId && (
          <div className="mt-3 mb-2">
            <div className="flex items-center gap-2">
              {noCamera ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Camera className="w-3.5 h-3.5 text-gray-400" />
                  <span>No scoreboard camera designated</span>
                  <span className="text-gray-300">·</span>
                  <a
                    href={`/football/teams/${teamId}/film`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    title="Go to Film page to set a camera's role to Scoreboard"
                  >
                    Designate a camera &rarr;
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleReadScoreboard}
                  disabled={ocrLoading || tagStartTime == null}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {ocrLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                  {ocrLoading ? 'Reading...' : 'Read Scoreboard'}
                </button>
              )}
            </div>

            {ocrError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{ocrError}</span>
                <button
                  type="button"
                  onClick={handleReadScoreboard}
                  className="text-blue-600 hover:text-blue-700 font-medium ml-1"
                >
                  Retry
                </button>
              </div>
            )}

            {partialNote && (
              <p className="mt-1.5 text-[10px] text-amber-600">{partialNote}</p>
            )}
          </div>
        )}

        {/* Score at Snap */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {teamName || 'Team'} Score
              {watch('score_source') === 'auto' && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-medium">auto</span>
              )}
              {watch('score_source') === 'ai' && getAIFieldConfidence('team_score_at_snap') != null && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded font-medium">
                  AI {getAIFieldConfidence('team_score_at_snap')}%
                </span>
              )}
              {watch('score_source') === 'manual' && watch('team_score_at_snap') !== '' && (
                <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-medium">manual</span>
              )}
            </label>
            <input
              type="number"
              min={0}
              {...register('team_score_at_snap')}
              onChange={(e) => {
                register('team_score_at_snap').onChange(e);
                setValue('score_source', 'manual');
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {opponentName || 'Opponent'} Score
              {watch('score_source') === 'ai' && getAIFieldConfidence('opponent_score_at_snap') != null && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded font-medium">
                  AI {getAIFieldConfidence('opponent_score_at_snap')}%
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              {...register('opponent_score_at_snap')}
              onChange={(e) => {
                register('opponent_score_at_snap').onChange(e);
                setValue('score_source', 'manual');
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default SituationFields;
