'use client';

import React, { memo, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { TaggingFormContainer } from './TaggingFormContainer';
import { TaggingModeSelector } from './TaggingModeSelector';
import { SituationFields } from './sections/SituationFields';
import { OffenseFields } from './sections/OffenseFields';
import { DefenseFields } from './sections/DefenseFields';
import { SpecialTeamsFields } from './sections/SpecialTeamsFields';
import { ResultFields } from './sections/ResultFields';
import { useTaggingForm } from './hooks/useTaggingForm';
import { useTagSubmission } from './hooks/useTagSubmission';
import { AITaggingButton, type AITagPredictions } from '@/components/film/AITaggingButton';
import { OFFENSIVE_FORMATIONS } from '@/config/footballConfig';
import {
  PENALTY_TYPES,
  type TaggingTier,
  type FilmAnalysisStatus,
  type SpecialTeamsUnit,
  type Drive,
} from '@/types/football';
import type { TaggingMode } from '@/components/film/context/types';
import { getPositionDisplay } from '@/utils/playerHelpers';

// ============================================
// TYPES
// ============================================

export interface TaggingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tagStartTime: number;
  tagEndTime: number | null;
  editingInstance: any | null;
  game: { id: string; name: string; team_id: string; is_opponent_game?: boolean };
  selectedVideo: { id: string; url?: string } | null;
  players: any[];
  plays: { play_code: string; play_name: string; attributes: any }[];
  drives: Drive[];
  currentDrive: Drive | null;
  taggingTier: TaggingTier | null;
  onSaveComplete: () => void;
  onDriveCreated: (drive: any) => void;
  fetchDrives: () => Promise<void>;
  filmAnalysisStatus: FilmAnalysisStatus;
  onStatusChange: (status: FilmAnalysisStatus) => void;
  teamId: string;
  gameId: string;
  previousPlay: any | null;
  quarterFromTimestamp: number | null;
}

// ============================================
// AUTO-POPULATION HELPERS (pure functions)
// ============================================

function detectPossessionChange(play: any): { changed: boolean; isAfterScore: boolean } {
  if (play.scoring_type && ['touchdown', 'field_goal', 'safety'].includes(play.scoring_type)) {
    return { changed: true, isAfterScore: true };
  }
  if (play.result_type && ['pass_interception', 'fumble_lost'].includes(play.result_type)) {
    return { changed: true, isAfterScore: false };
  }
  const possessionChangingUnits: SpecialTeamsUnit[] = ['punt', 'kickoff', 'punt_return', 'kick_return'];
  if (play.special_teams_unit && possessionChangingUnits.includes(play.special_teams_unit)) {
    return { changed: true, isAfterScore: false };
  }
  return { changed: false, isAfterScore: false };
}

function calculateNextYardLine(play: any): number {
  let yardLine = (play.yard_line || 20) + (play.yards_gained || 0);
  if (play.penalty_on_play && play.penalty_yards && !play.penalty_declined) {
    yardLine += play.penalty_on_us ? -play.penalty_yards : play.penalty_yards;
  }
  return Math.max(1, Math.min(99, yardLine));
}

function calculateNextDistance(play: any): { distance: number; isFirstDown: boolean } {
  const baseDistance = (play.distance || 10) - (play.yards_gained || 0);
  if (play.penalty_on_play && play.penalty_type && !play.penalty_declined) {
    const penaltyDef = PENALTY_TYPES.find(p => p.value === play.penalty_type);
    const penaltyYards = play.penalty_yards || penaltyDef?.yards || 0;
    const isAutoFirstDown = penaltyDef?.auto_first === true;
    if (play.penalty_on_us) {
      return { distance: baseDistance + penaltyYards, isFirstDown: false };
    } else {
      if (isAutoFirstDown) return { distance: 10, isFirstDown: true };
      const adjusted = baseDistance - penaltyYards;
      return adjusted <= 0
        ? { distance: 10, isFirstDown: true }
        : { distance: adjusted, isFirstDown: false };
    }
  }
  return baseDistance <= 0
    ? { distance: 10, isFirstDown: true }
    : { distance: baseDistance, isFirstDown: false };
}

function calculateNextPlayContext(previousPlay: any | null) {
  if (!previousPlay) return null;
  const { changed, isAfterScore } = detectPossessionChange(previousPlay);
  if (changed) {
    return {
      down: 1, distance: 10,
      yard_line: isAfterScore ? undefined : 100 - calculateNextYardLine(previousPlay),
      hash_mark: undefined as string | undefined,
    };
  }
  if (previousPlay.resulted_in_first_down) {
    return { down: 1, distance: 10, yard_line: calculateNextYardLine(previousPlay), hash_mark: undefined as string | undefined };
  }
  const nextDown = (previousPlay.down || 1) + 1;
  if (nextDown > 4) {
    return { down: 1, distance: 10, yard_line: 100 - calculateNextYardLine(previousPlay), hash_mark: undefined as string | undefined };
  }
  const { distance, isFirstDown } = calculateNextDistance(previousPlay);
  if (isFirstDown) {
    return { down: 1, distance: 10, yard_line: calculateNextYardLine(previousPlay), hash_mark: undefined as string | undefined };
  }
  return {
    down: nextDown, distance: Math.max(1, distance),
    yard_line: calculateNextYardLine(previousPlay),
    hash_mark: previousPlay.direction as string | undefined,
  };
}

// ============================================
// COMPONENT
// ============================================

export const TaggingPanel = memo(function TaggingPanel({
  isOpen, onClose, tagStartTime, tagEndTime, editingInstance,
  game, selectedVideo, players, plays, drives, currentDrive,
  taggingTier, onSaveComplete, onDriveCreated, fetchDrives,
  filmAnalysisStatus, onStatusChange, teamId, gameId,
  previousPlay, quarterFromTimestamp,
}: TaggingPanelProps) {
  const methods = useForm<any>({ defaultValues: {} });
  const { handleSubmit, setValue, formState: { isSubmitting } } = methods;

  const taggingForm = useTaggingForm({ taggingTier, formReset: methods.reset });

  const { submitTag } = useTagSubmission(
    {
      selectedVideo: selectedVideo!,
      game, gameId,
      taggingMode: taggingForm.taggingMode,
      isTaggingOpponent: taggingForm.isTaggingOpponent,
      selectedSpecialTeamsUnit: taggingForm.selectedSpecialTeamsUnit,
      selectedTacklers: taggingForm.selectedTacklers,
      primaryTacklerId: taggingForm.primaryTacklerId,
      driveAssignMode: taggingForm.driveAssignMode,
      currentDrive, editingInstance, players,
      filmAnalysisStatus, tagStartTime, tagEndTime,
    },
    {
      onSaveComplete, onDriveCreated, onStatusChange,
      onClose: () => { taggingForm.closeModal(); onClose(); },
      fetchDrives,
    },
    taggingForm.setIsSavingPlay,
  );

  // ===========================
  // Auto-populate on open (new play)
  // ===========================
  useEffect(() => {
    if (!isOpen || editingInstance) return;

    // Default to defense mode for opponent games
    if (game.is_opponent_game) {
      taggingForm.setTaggingMode('defense');
    }

    // Default to 'new' drive mode when no drives exist
    if (drives.length === 0) {
      taggingForm.setDriveAssignMode('new');
    }

    if (quarterFromTimestamp) {
      setValue('quarter', quarterFromTimestamp);
    }

    const context = calculateNextPlayContext(previousPlay);
    if (context) {
      const fields: string[] = [];
      setValue('down', context.down); fields.push('down');
      setValue('distance', context.distance); fields.push('distance');
      if (context.yard_line !== undefined) { setValue('yard_line', context.yard_line); fields.push('yard_line'); }
      if (context.hash_mark) { setValue('hash_mark', context.hash_mark); fields.push('hash_mark'); }
      taggingForm.setAutoPopulatedFields(fields);
    } else {
      taggingForm.setAutoPopulatedFields([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ===========================
  // Pre-populate on edit
  // ===========================
  useEffect(() => {
    if (!editingInstance || !isOpen) return;

    // Set tagging mode from instance
    if (editingInstance.special_teams_unit) {
      taggingForm.setTaggingMode('specialTeams');
      taggingForm.setSelectedSpecialTeamsUnit(editingInstance.special_teams_unit);
    } else if (editingInstance.is_opponent_play) {
      taggingForm.setTaggingMode('defense');
    } else {
      taggingForm.setTaggingMode('offense');
    }

    // Populate play identification
    if (editingInstance.is_opponent_play) {
      setValue('opponent_play_type', editingInstance.play_code);
      const playerMatch = editingInstance.notes?.match(/Player: (#?\d+)/);
      if (playerMatch) setValue('opponent_player_number', playerMatch[1]);
    } else {
      setValue('play_code', editingInstance.play_code);
    }

    // Core fields
    setValue('formation', editingInstance.formation);
    setValue('result_type', editingInstance.result || editingInstance.result_type);
    setValue('resulted_in_first_down', editingInstance.resulted_in_first_down);
    setValue('down', editingInstance.down);
    setValue('distance', editingInstance.distance);
    setValue('yard_line', editingInstance.yard_line);
    setValue('hash_mark', editingInstance.hash_mark || '');
    setValue('yards_gained', editingInstance.yards_gained);
    setValue('notes', editingInstance.notes || '');
    setValue('quarter', editingInstance.quarter);

    // Player attribution
    setValue('qb_id', editingInstance.qb_id);
    setValue('ball_carrier_id', editingInstance.ball_carrier_id);
    setValue('target_id', editingInstance.target_id);
    setValue('play_type', editingInstance.play_type);
    setValue('direction', editingInstance.direction);

    // Offensive Line
    ['lt', 'lg', 'c', 'rg', 'rt'].forEach(pos => {
      setValue(`${pos}_id`, editingInstance[`${pos}_id`]);
      setValue(`${pos}_block_result`, editingInstance[`${pos}_block_result`]);
    });

    // Defensive tracking - tacklers
    if (editingInstance.tackler_ids?.length > 0) {
      taggingForm.setSelectedTacklers(editingInstance.tackler_ids);
      taggingForm.setPrimaryTackler(editingInstance.tackler_ids[0]);
    } else {
      taggingForm.setSelectedTacklers([]);
      taggingForm.setPrimaryTackler('');
    }

    setValue('missed_tackle_ids', editingInstance.missed_tackle_ids?.join(',') || '');
    setValue('pressure_player_ids', editingInstance.pressure_player_ids?.join(',') || '');
    setValue('sack_player_id', editingInstance.sack_player_id);
    setValue('coverage_player_id', editingInstance.coverage_player_id);
    setValue('coverage_result', editingInstance.coverage_result);
    setValue('is_tfl', editingInstance.is_tfl);
    setValue('is_sack', editingInstance.is_sack);
    setValue('is_forced_fumble', editingInstance.is_forced_fumble);
    setValue('is_pbu', editingInstance.is_pbu);
    setValue('is_interception', editingInstance.is_interception);
    setValue('qb_decision_grade', editingInstance.qb_decision_grade);

    // Penalty fields
    setValue('penalty_on_play', editingInstance.penalty_on_play);
    setValue('penalty_type', editingInstance.penalty_type);
    setValue('penalty_yards', editingInstance.penalty_yards);
    setValue('penalty_on_us', editingInstance.penalty_on_us ? 'true' : 'false');
    setValue('penalty_declined', editingInstance.penalty_declined);

    taggingForm.setAutoPopulatedFields([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingInstance, isOpen]);

  // ===========================
  // AI Predictions Handler
  // ===========================
  const handleAIPredictions = useCallback((predictions: AITagPredictions, _predictionId: string) => {
    taggingForm.setAiPredictions(predictions);
    taggingForm.setAiError(null);
    const filledFields: Record<string, number> = {};

    const setField = (name: string, value: unknown, confidence: number) => {
      setValue(name, value);
      filledFields[name] = confidence;
    };

    // Play type
    if (predictions.play_type?.value !== undefined) {
      const confidence = predictions.play_type.confidence ?? 0;
      if (taggingForm.isTaggingOpponent) {
        const aiType = predictions.play_type.value.toLowerCase();
        const yards = predictions.yards_gained?.value ?? 0;
        let oppType = '';
        if (aiType.includes('run')) oppType = 'Other Run';
        else if (aiType.includes('pass')) {
          if (yards <= 5) oppType = 'Quick Pass (0-5 yds)';
          else if (yards <= 10) oppType = 'Short Pass (6-10 yds)';
          else if (yards <= 20) oppType = 'Medium Pass (11-20 yds)';
          else oppType = 'Deep Pass (20+ yds)';
        } else if (aiType.includes('screen')) oppType = 'Screen';
        else if (aiType.includes('rpo')) oppType = 'RPO';
        if (oppType) setField('opponent_play_type', oppType, confidence);
      } else {
        setField('play_type', predictions.play_type.value, confidence);
      }
    }

    // Basic fields
    if (predictions.direction?.value !== undefined) setField('direction', predictions.direction.value, predictions.direction.confidence ?? 0);
    if (predictions.result?.value !== undefined) setField('result_type', predictions.result.value, predictions.result.confidence ?? 0);
    if (predictions.yards_gained?.value !== undefined) setField('yards_gained', predictions.yards_gained.value, predictions.yards_gained.confidence ?? 0);

    // Formation matching against valid formations
    if (predictions.formation?.value !== undefined) {
      const aiFormation = predictions.formation.value;
      const validFormations = Object.keys(OFFENSIVE_FORMATIONS);
      if (validFormations.includes(aiFormation)) {
        setField('formation', aiFormation, predictions.formation.confidence ?? 0);
      } else {
        const lower = aiFormation.toLowerCase().replace(/[_-]/g, ' ');
        const matched = validFormations.find(f => {
          const fl = f.toLowerCase().replace(/[_-]/g, ' ');
          return fl === lower || fl.includes(lower) || lower.includes(fl);
        });
        if (matched) {
          setField('formation', matched, Math.max((predictions.formation.confidence ?? 0) - 15, 30));
        } else {
          const keywords = ['shotgun', 'gun', 'i-form', 'i form', 'pro', 'pistol', 'wing', 'goalline', 'singleback', 'empty', 'trips', 'doubles', 'power', 'wishbone', 'flexbone'];
          const kw = keywords.find(k => lower.includes(k));
          if (kw) {
            const kwMatch = validFormations.find(f => f.toLowerCase().includes(kw));
            if (kwMatch) setField('formation', kwMatch, Math.max((predictions.formation.confidence ?? 0) - 25, 25));
          }
        }
      }
    }

    // Context fields
    if (predictions.down?.value !== undefined) setField('down', predictions.down.value, predictions.down.confidence ?? 0);
    if (predictions.distance?.value !== undefined) setField('distance', predictions.distance.value, predictions.distance.confidence ?? 0);
    if (predictions.hash?.value !== undefined) setField('hash_mark', predictions.hash.value, predictions.hash.confidence ?? 0);

    // Situational flags (own team only)
    if (!taggingForm.isTaggingOpponent) {
      if (predictions.motion?.value !== undefined) setField('has_motion', predictions.motion.value, predictions.motion.confidence ?? 0);
      if (predictions.play_action?.value !== undefined) setField('is_play_action', predictions.play_action.value, predictions.play_action.confidence ?? 0);
    }

    // Special teams
    if (predictions.special_teams_unit?.value !== undefined) {
      taggingForm.setSelectedSpecialTeamsUnit(predictions.special_teams_unit.value as SpecialTeamsUnit);
      taggingForm.setTaggingMode('specialTeams');
      filledFields['special_teams_unit'] = predictions.special_teams_unit.confidence ?? 0;
    }
    if (predictions.kick_result?.value !== undefined) setField('kick_result', predictions.kick_result.value, predictions.kick_result.confidence ?? 0);
    if (predictions.kick_distance?.value !== undefined) setField('kick_distance', predictions.kick_distance.value, predictions.kick_distance.confidence ?? 0);
    if (predictions.return_yards?.value !== undefined) setField('return_yards', predictions.return_yards.value, predictions.return_yards.confidence ?? 0);
    if (predictions.is_touchback?.value !== undefined) setField('is_touchback', predictions.is_touchback.value, predictions.is_touchback.confidence ?? 0);
    if (predictions.is_fair_catch?.value !== undefined) setField('is_fair_catch', predictions.is_fair_catch.value, predictions.is_fair_catch.confidence ?? 0);

    taggingForm.setAiFilledFields(filledFields);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taggingForm.isTaggingOpponent, setValue]);

  // ===========================
  // Player Options Helper
  // ===========================
  const renderPlayerOptions = useCallback((
    preferredFilter: (p: any) => boolean,
    preferredLabel: string = 'Preferred',
    showPosition: boolean = true,
    excludeIds: string[] = []
  ) => {
    const available = players.filter(p => !excludeIds.includes(p.id));
    const preferred = available.filter(preferredFilter);
    const other = available.filter(p => !preferredFilter(p));
    return (
      <>
        {preferred.length > 0 && (
          <optgroup label={preferredLabel}>
            {preferred.map(p => (
              <option key={p.id} value={p.id}>
                #{p.jersey_number} {p.first_name} {p.last_name}{showPosition ? ` (${getPositionDisplay(p)})` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {other.length > 0 && (
          <optgroup label="Other Players">
            {other.map(p => (
              <option key={p.id} value={p.id}>
                #{p.jersey_number} {p.first_name} {p.last_name}{showPosition ? ` (${getPositionDisplay(p)})` : ''}
              </option>
            ))}
          </optgroup>
        )}
      </>
    );
  }, [players]);

  // ===========================
  // Close handler
  // ===========================
  const handleClose = useCallback(() => {
    taggingForm.closeModal();
    onClose();
  }, [taggingForm, onClose]);

  // ===========================
  // Header Actions (AI button + confidence legend)
  // ===========================
  const headerActions = tagEndTime && selectedVideo ? (
    <div className="flex flex-col items-end">
      <AITaggingButton
        teamId={teamId}
        videoId={selectedVideo.id}
        clipStartSeconds={tagStartTime}
        clipEndSeconds={tagEndTime}
        tier={taggingTier || 'quick'}
        taggingMode={taggingForm.taggingMode as TaggingMode}
        onPredictionsReceived={handleAIPredictions}
        onError={(error: string) => taggingForm.setAiError(error)}
        disabled={!tagEndTime || (tagEndTime - tagStartTime) < 2}
      />
      {taggingForm.aiError && <p className="text-xs text-red-500 mt-1">{taggingForm.aiError}</p>}
      {taggingForm.aiPredictions?.reasoning && (
        <p className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={taggingForm.aiPredictions.reasoning}>
          AI: {taggingForm.aiPredictions.reasoning}
        </p>
      )}
      {Object.keys(taggingForm.aiFilledFields).length > 0 && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="text-gray-500">Confidence:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-green-400 bg-green-50"></span><span className="text-gray-600">High</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-yellow-400 bg-yellow-50"></span><span className="text-gray-600">Med</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-red-400 bg-red-50"></span><span className="text-gray-600">Low</span></span>
        </div>
      )}
    </div>
  ) : undefined;

  // ===========================
  // RENDER
  // ===========================
  return (
    <FormProvider {...methods}>
      <TaggingFormContainer
        isOpen={isOpen}
        onClose={handleClose}
        tagStartTime={tagStartTime}
        tagEndTime={tagEndTime}
        editingInstance={editingInstance}
        selectedVideo={selectedVideo}
        headerActions={headerActions}
      >
        <form onSubmit={handleSubmit(submitTag)} className="space-y-4">
          {/* Mode Selector */}
          <TaggingModeSelector
            mode={taggingForm.taggingMode}
            onModeChange={(mode) => {
              taggingForm.setTaggingMode(mode);
              if (mode !== 'specialTeams') taggingForm.setSelectedSpecialTeamsUnit('');
            }}
            isOpponentGame={game.is_opponent_game}
          />

          {/* Mode-specific fields */}
          {taggingForm.taggingMode === 'specialTeams' ? (
            <SpecialTeamsFields
              players={players}
              selectedSpecialTeamsUnit={taggingForm.selectedSpecialTeamsUnit}
              setSelectedSpecialTeamsUnit={taggingForm.setSelectedSpecialTeamsUnit}
              getAIConfidenceClass={taggingForm.getAIConfidenceClass}
              renderPlayerOptions={renderPlayerOptions}
            />
          ) : (
            <>
              {/* Situation (shared between offense and defense) */}
              <SituationFields
                isTaggingOpponent={taggingForm.isTaggingOpponent}
                isOpponentGame={!!game.is_opponent_game}
                drives={drives}
                currentDrive={currentDrive}
                driveAssignMode={taggingForm.driveAssignMode}
                setDriveAssignMode={taggingForm.setDriveAssignMode}
                autoPopulatedFields={taggingForm.autoPopulatedFields}
                getFieldClassName={taggingForm.getFieldClassName}
                handleFieldChange={taggingForm.handleFieldChange}
                getAIConfidenceClass={taggingForm.getAIConfidenceClass}
              />

              {/* Offense fields */}
              {!taggingForm.isTaggingOpponent && (
                <OffenseFields
                  players={players}
                  plays={plays}
                  isFieldVisible={taggingForm.isFieldVisible}
                  getAIConfidenceClass={taggingForm.getAIConfidenceClass}
                  renderPlayerOptions={renderPlayerOptions}
                />
              )}

              {/* Defense fields */}
              {taggingForm.isTaggingOpponent && (
                <DefenseFields
                  players={players}
                  taggingTier={taggingTier}
                  selectedTacklers={taggingForm.selectedTacklers}
                  primaryTacklerId={taggingForm.primaryTacklerId}
                  toggleTackler={taggingForm.toggleTackler}
                  setPrimaryTackler={taggingForm.setPrimaryTackler}
                  getAIConfidenceClass={taggingForm.getAIConfidenceClass}
                />
              )}

              {/* Result fields (shared between offense and defense) */}
              <ResultFields getAIConfidenceClass={taggingForm.getAIConfidenceClass} />
            </>
          )}

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={taggingForm.isSavingPlay || isSubmitting}
              className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {taggingForm.isSavingPlay || isSubmitting ? 'Saving...' : (editingInstance ? 'Update Play' : 'Tag Play')}
            </button>
          </div>
        </form>
      </TaggingFormContainer>
    </FormProvider>
  );
});

export default TaggingPanel;
