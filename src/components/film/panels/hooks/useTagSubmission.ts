'use client';

import { useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DriveService } from '@/lib/services/drive.service';
import { filmSessionService } from '@/lib/services/film-session.service';
import {
  SCORING_TYPES,
  PENALTY_TYPES,
  type SpecialTeamsUnit,
  type FilmAnalysisStatus,
} from '@/types/football';
import type { TaggingMode } from '@/components/film/context/types';

// ============================================
// TYPES
// ============================================

interface PlayTagForm {
  [key: string]: any;
}

export interface SubmissionContext {
  selectedVideo: { id: string };
  game: { id: string; team_id: string };
  gameId: string;
  taggingMode: TaggingMode;
  isTaggingOpponent: boolean;
  selectedSpecialTeamsUnit: SpecialTeamsUnit | '';
  selectedTacklers: string[];
  primaryTacklerId: string;
  driveAssignMode: 'current' | 'new' | 'select';
  currentDrive: any | null;
  editingInstance: any | null;
  players: any[];
  filmAnalysisStatus: FilmAnalysisStatus;
  tagStartTime: number;
  tagEndTime: number | null;
}

export interface SubmissionCallbacks {
  onSaveComplete: () => void;
  onDriveCreated: (drive: any) => void;
  onStatusChange: (status: FilmAnalysisStatus) => void;
  onClose: () => void;
  fetchDrives: () => Promise<void>;
}

export interface UseTagSubmissionReturn {
  submitTag: (values: PlayTagForm) => Promise<void>;
}

// ============================================
// HELPERS
// ============================================

function buildInstanceData(
  values: PlayTagForm,
  ctx: SubmissionContext
): Record<string, any> {
  const { isTaggingOpponent, taggingMode, selectedSpecialTeamsUnit, selectedTacklers, primaryTacklerId, tagStartTime, tagEndTime } = ctx;

  // Prepare tackler_ids array with primary tackler first
  let tacklerIdsArray: string[] | undefined;
  if (isTaggingOpponent && selectedTacklers.length > 0) {
    tacklerIdsArray = primaryTacklerId
      ? [primaryTacklerId, ...selectedTacklers.filter(id => id !== primaryTacklerId)]
      : selectedTacklers;
  }

  const instanceData: Record<string, any> = {
    video_id: ctx.selectedVideo.id,
    camera_id: ctx.selectedVideo.id,
    team_id: ctx.game.team_id,
    timestamp_start: tagStartTime,
    timestamp_end: tagEndTime || undefined,
    is_opponent_play: isTaggingOpponent,

    play_code: taggingMode === 'specialTeams'
      ? `ST-${selectedSpecialTeamsUnit?.toUpperCase() || 'UNKNOWN'}`
      : isTaggingOpponent
        ? (values.opponent_play_type || 'Unknown')
        : (values.play_code || ''),

    formation: values.formation || undefined,
    result: values.result_type || undefined,
    resulted_in_first_down: values.resulted_in_first_down || false,
    is_turnover: values.result_type === 'pass_interception' || values.result_type === 'fumble_lost',
    turnover_type: values.result_type === 'pass_interception' ? 'interception' :
                   values.result_type === 'fumble_lost' ? 'fumble' : undefined,

    down: values.down ? parseInt(String(values.down)) : undefined,
    distance: values.distance ? parseInt(String(values.distance)) : undefined,
    yard_line: values.yard_line ? parseInt(String(values.yard_line)) : undefined,
    hash_mark: values.hash_mark || undefined,
    yards_gained: values.yards_gained ? parseInt(String(values.yards_gained)) : undefined,
    notes: isTaggingOpponent && values.opponent_player_number
      ? `Player: ${values.opponent_player_number}${values.notes ? ' | ' + values.notes : ''}`
      : (values.notes || undefined),
    tags: [],

    quarter: values.quarter ? parseInt(String(values.quarter)) : undefined,

    // Player attribution (Offense only)
    qb_id: !isTaggingOpponent ? (values.qb_id || undefined) : undefined,
    ball_carrier_id: !isTaggingOpponent ? (values.ball_carrier_id || undefined) : undefined,
    target_id: !isTaggingOpponent ? (values.target_id || undefined) : undefined,
    play_type: !isTaggingOpponent ? (values.play_type || undefined) : undefined,
    direction: !isTaggingOpponent ? (values.direction || undefined) : undefined,

    // Offensive Line
    lt_id: !isTaggingOpponent ? (values.lt_id || undefined) : undefined,
    lt_block_result: !isTaggingOpponent ? (values.lt_block_result || undefined) : undefined,
    lg_id: !isTaggingOpponent ? (values.lg_id || undefined) : undefined,
    lg_block_result: !isTaggingOpponent ? (values.lg_block_result || undefined) : undefined,
    c_id: !isTaggingOpponent ? (values.c_id || undefined) : undefined,
    c_block_result: !isTaggingOpponent ? (values.c_block_result || undefined) : undefined,
    rg_id: !isTaggingOpponent ? (values.rg_id || undefined) : undefined,
    rg_block_result: !isTaggingOpponent ? (values.rg_block_result || undefined) : undefined,
    rt_id: !isTaggingOpponent ? (values.rt_id || undefined) : undefined,
    rt_block_result: !isTaggingOpponent ? (values.rt_block_result || undefined) : undefined,

    // Defensive tracking
    tackler_ids: tacklerIdsArray,
    missed_tackle_ids: isTaggingOpponent && values.missed_tackle_ids
      ? values.missed_tackle_ids.split(',').map((jersey: string) => {
          const trimmed = jersey.trim().replace('#', '');
          const player = ctx.players.find(p => p.jersey_number === trimmed);
          return player?.id;
        }).filter((id: string | undefined) => id)
      : undefined,
    pressure_player_ids: isTaggingOpponent && values.pressure_player_ids
      ? values.pressure_player_ids.split(',').map((jersey: string) => {
          const trimmed = jersey.trim().replace('#', '');
          const player = ctx.players.find(p => p.jersey_number === trimmed);
          return player?.id;
        }).filter((id: string | undefined) => id)
      : undefined,
    sack_player_id: isTaggingOpponent ? (values.sack_player_id || undefined) : undefined,
    coverage_player_id: isTaggingOpponent ? (values.coverage_player_id || undefined) : undefined,
    coverage_result: isTaggingOpponent ? (values.coverage_result || undefined) : undefined,
    is_tfl: isTaggingOpponent ? (values.is_tfl || false) : undefined,
    is_sack: isTaggingOpponent ? (values.is_sack || false) : undefined,
    is_forced_fumble: isTaggingOpponent ? (values.is_forced_fumble || false) : undefined,
    is_pbu: isTaggingOpponent ? (values.is_pbu || false) : undefined,
    is_interception: isTaggingOpponent ? (values.result_type === 'pass_interception') : undefined,
    qb_decision_grade: isTaggingOpponent && values.qb_decision_grade !== undefined
      ? parseInt(String(values.qb_decision_grade))
      : undefined,

    // Special teams
    special_teams_unit: taggingMode === 'specialTeams' ? (selectedSpecialTeamsUnit || undefined) : undefined,
    kicker_id: taggingMode === 'specialTeams' && ['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
      ? (values.kicker_id || undefined) : undefined,
    kick_result: taggingMode === 'specialTeams' ? (values.kick_result || undefined) : undefined,
    kick_distance: taggingMode === 'specialTeams' && values.kick_distance
      ? parseInt(String(values.kick_distance)) : undefined,
    returner_id: taggingMode === 'specialTeams' && ['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit)
      ? (values.returner_id || undefined) : undefined,
    return_yards: taggingMode === 'specialTeams' && values.return_yards
      ? parseInt(String(values.return_yards)) : undefined,
    is_fair_catch: taggingMode === 'specialTeams' ? (values.is_fair_catch || false) : undefined,
    is_touchback: taggingMode === 'specialTeams' ? (values.is_touchback || false) : undefined,
    is_muffed: taggingMode === 'specialTeams' ? (values.is_muffed || false) : undefined,
    punter_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
      ? (values.punter_id || undefined) : undefined,
    punt_type: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
      ? (values.punt_type || undefined) : undefined,
    gunner_tackle_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
      ? (values.coverage_tackler_id || undefined) : undefined,
    kickoff_type: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'kickoff'
      ? (values.kickoff_type || undefined) : undefined,
    long_snapper_id: taggingMode === 'specialTeams' && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
      ? (values.long_snapper_id || undefined) : undefined,
    snap_quality: taggingMode === 'specialTeams' && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
      ? (values.snap_quality || undefined) : undefined,
    holder_id: taggingMode === 'specialTeams' && ['field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
      ? (values.holder_id || undefined) : undefined,
    coverage_tackler_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'kickoff'
      ? (values.coverage_tackler_id || undefined) : undefined,
    blocker_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'fg_block'
      ? (values.blocker_id || undefined) : undefined,

    // Scoring
    scoring_type: values.scoring_type || undefined,
    scoring_points: values.scoring_type
      ? (SCORING_TYPES.find(s => s.value === values.scoring_type)?.points || 0)
      : undefined,
    is_touchdown: values.scoring_type === 'touchdown',
    opponent_scored: values.opponent_scored || false,

    // Penalty
    penalty_on_play: values.penalty_type ? true : false,
    penalty_type: values.penalty_type || undefined,
    penalty_yards: values.penalty_yards
      ? parseInt(String(values.penalty_yards))
      : (values.penalty_type ? (PENALTY_TYPES.find(p => p.value === values.penalty_type)?.yards || 0) : undefined),
    penalty_on_us: values.penalty_type ? values.penalty_on_us === 'true' : undefined,
    penalty_declined: values.penalty_declined || false,
  };

  return instanceData;
}

function buildParticipations(
  values: PlayTagForm,
  playInstanceId: string,
  ctx: SubmissionContext
): any[] {
  const { isTaggingOpponent, taggingMode, selectedSpecialTeamsUnit, selectedTacklers, primaryTacklerId } = ctx;
  const participations: any[] = [];

  // Offensive participations
  if (!isTaggingOpponent) {
    // OL positions
    const olPositions = [
      { id: values.lt_id, pos: 'ol_lt', result: values.lt_block_result },
      { id: values.lg_id, pos: 'ol_lg', result: values.lg_block_result },
      { id: values.c_id, pos: 'ol_c', result: values.c_block_result },
      { id: values.rg_id, pos: 'ol_rg', result: values.rg_block_result },
      { id: values.rt_id, pos: 'ol_rt', result: values.rt_block_result },
    ];

    olPositions.forEach(({ id, pos, result }) => {
      if (id) {
        participations.push({
          play_instance_id: playInstanceId,
          player_id: id,
          team_id: ctx.game.team_id,
          participation_type: pos,
          phase: 'offense',
          result: result || null,
        });
      }
    });

    // Result fields for offensive participations
    const yardsGained = values.yards_gained ? parseInt(String(values.yards_gained)) : null;
    const isTouchdown = values.scoring_type === 'touchdown';
    const isFirstDown = values.resulted_in_first_down || false;
    const isTurnover = values.result_type === 'pass_interception' || values.result_type === 'fumble_lost';
    const isSpecialTeamsPlay = taggingMode === 'specialTeams' ||
      ['kick', 'punt', 'pat', 'two_point'].includes(values.play_type || '');

    if (values.qb_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.qb_id,
        team_id: ctx.game.team_id,
        participation_type: 'passer',
        phase: 'offense',
        yards_gained: yardsGained,
        is_touchdown: isTouchdown,
        is_first_down: isFirstDown,
        is_turnover: isTurnover,
      });
    }

    if (values.ball_carrier_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.ball_carrier_id,
        team_id: ctx.game.team_id,
        participation_type: isSpecialTeamsPlay ? 'returner' : 'rusher',
        phase: isSpecialTeamsPlay ? 'special_teams' : 'offense',
        yards_gained: yardsGained,
        is_touchdown: isTouchdown,
        is_first_down: isFirstDown,
        is_turnover: isTurnover,
      });
    }

    if (values.target_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.target_id,
        team_id: ctx.game.team_id,
        participation_type: 'receiver',
        phase: 'offense',
        yards_gained: yardsGained,
        is_touchdown: isTouchdown,
        is_first_down: isFirstDown,
        is_turnover: isTurnover,
      });
    }
  }

  // Defensive participations
  if (isTaggingOpponent) {
    // Tackles
    const tacklerIdsArray = primaryTacklerId
      ? [primaryTacklerId, ...selectedTacklers.filter(id => id !== primaryTacklerId)]
      : selectedTacklers;

    if (tacklerIdsArray.length > 0) {
      tacklerIdsArray.forEach((tacklerId: string) => {
        participations.push({
          play_instance_id: playInstanceId,
          player_id: tacklerId,
          team_id: ctx.game.team_id,
          participation_type: tacklerId === primaryTacklerId ? 'primary_tackle' : 'assist_tackle',
          phase: 'defense',
          result: 'made',
        });
      });
    }

    // Missed tackles
    if (values.missed_tackle_ids) {
      values.missed_tackle_ids.split(',').filter(Boolean).forEach((playerId: string) => {
        participations.push({
          play_instance_id: playInstanceId,
          player_id: playerId,
          team_id: ctx.game.team_id,
          participation_type: 'missed_tackle',
          phase: 'defense',
          result: 'missed',
        });
      });
    }

    // Pressures
    if (values.pressure_player_ids) {
      values.pressure_player_ids.split(',').filter(Boolean).forEach((playerId: string) => {
        let result = 'hurry';
        if (values.sack_player_id === playerId) result = 'sack';
        participations.push({
          play_instance_id: playInstanceId,
          player_id: playerId,
          team_id: ctx.game.team_id,
          participation_type: 'pressure',
          phase: 'defense',
          result,
        });
      });
    }

    // Coverage
    if (values.coverage_player_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.coverage_player_id,
        team_id: ctx.game.team_id,
        participation_type: 'coverage_assignment',
        phase: 'defense',
        result: values.coverage_result || null,
      });
    }

    // Multi-player defensive tracking sections
    const multiPlayerSections = [
      { playersKey: 'dl_run_defense_players', dataKey: 'dl_run_defense_data', type: 'dl_run_defense', metaFn: (d: any) => ({ gap_assignment: d.gap || null, double_teamed: d.doubleTeamed || false }) },
      { playersKey: 'lb_run_stop_players', dataKey: 'lb_run_stop_data', type: 'lb_run_stop', metaFn: (d: any) => ({ gap_assignment: d.gap || null, scrape_exchange: d.scrapeExchange || false }) },
      { playersKey: 'lb_pass_coverage_players', dataKey: 'lb_pass_coverage_data', type: 'lb_pass_coverage', metaFn: (d: any) => ({ coverage_zone: d.zone || null }) },
      { playersKey: 'db_run_support_players', dataKey: 'db_run_support_data', type: 'db_run_support', metaFn: (d: any) => ({ force_contain: d.forceContain || false, alley_fill: d.alleyFill || false }) },
      { playersKey: 'db_pass_coverage_players', dataKey: 'db_pass_coverage_data', type: 'db_pass_coverage', metaFn: (d: any) => ({ coverage_zone: d.zone || null, alignment: d.alignment || null }) },
    ];

    multiPlayerSections.forEach(({ playersKey, dataKey, type, metaFn }) => {
      if (values[playersKey] && values[dataKey]) {
        const playerIds = values[playersKey].split(',').filter(Boolean);
        const playerDataMap = JSON.parse(values[dataKey] || '{}');
        playerIds.forEach((playerId: string) => {
          const data = playerDataMap[playerId] || {};
          participations.push({
            play_instance_id: playInstanceId,
            player_id: playerId,
            team_id: ctx.game.team_id,
            participation_type: type,
            phase: 'defense',
            result: data.result || null,
            metadata: metaFn(data),
          });
        });
      }
    });

    // DL Pass Rush metadata enrichment
    if (values.dl_pass_rush_data) {
      const playerDataMap = JSON.parse(values.dl_pass_rush_data || '{}');
      Object.keys(playerDataMap).forEach((playerId: string) => {
        const data = playerDataMap[playerId] || {};
        const pressureParticipation = participations.find(
          p => p.player_id === playerId && p.participation_type === 'pressure'
        );
        if (pressureParticipation) {
          pressureParticipation.metadata = {
            rush_technique: data.rushTechnique || null,
            gap: data.gap || null,
            qb_impact: data.qbImpact || false,
          };
        }
      });
    }

    // Interception participation
    if (values.interception_player_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.interception_player_id,
        team_id: ctx.game.team_id,
        participation_type: 'interception',
        phase: 'defense',
        result: 'interception',
        metadata: {},
      });
    }

    // Forced fumble participation
    if (values.forced_fumble_player_id) {
      participations.push({
        play_instance_id: playInstanceId,
        player_id: values.forced_fumble_player_id,
        team_id: ctx.game.team_id,
        participation_type: 'forced_fumble',
        result: 'forced_fumble',
        metadata: {},
      });
    }
  }

  // Special teams participations
  if (taggingMode === 'specialTeams' && selectedSpecialTeamsUnit) {
    if (values.kicker_id && ['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
      participations.push({
        play_instance_id: playInstanceId, player_id: values.kicker_id,
        team_id: ctx.game.team_id, participation_type: 'kicker', phase: 'special_teams',
        yards_gained: values.kick_distance ? parseInt(String(values.kick_distance)) : null,
        is_touchdown: false, result: values.kick_result || null,
        metadata: { kick_type: selectedSpecialTeamsUnit, kickoff_type: values.kickoff_type || null },
      });
    }

    if (values.punter_id && selectedSpecialTeamsUnit === 'punt') {
      participations.push({
        play_instance_id: playInstanceId, player_id: values.punter_id,
        team_id: ctx.game.team_id, participation_type: 'punter', phase: 'special_teams',
        yards_gained: values.kick_distance ? parseInt(String(values.kick_distance)) : null,
        result: values.kick_result || null,
        metadata: { punt_type: values.punt_type || null },
      });
    }

    if (values.long_snapper_id && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
      participations.push({
        play_instance_id: playInstanceId, player_id: values.long_snapper_id,
        team_id: ctx.game.team_id, participation_type: 'long_snapper', phase: 'special_teams',
        result: values.snap_quality || null, metadata: {},
      });
    }

    if (values.holder_id && ['field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
      participations.push({
        play_instance_id: playInstanceId, player_id: values.holder_id,
        team_id: ctx.game.team_id, participation_type: 'holder', phase: 'special_teams',
        result: values.kick_result || null, metadata: {},
      });
    }

    if (values.returner_id && ['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit)) {
      const stTouchdown = values.scoring_type === 'touchdown';
      participations.push({
        play_instance_id: playInstanceId, player_id: values.returner_id,
        team_id: ctx.game.team_id, participation_type: 'returner', phase: 'special_teams',
        yards_gained: values.return_yards ? parseInt(String(values.return_yards)) : null,
        is_touchdown: stTouchdown, is_turnover: values.is_muffed || false,
        result: values.kick_result || null,
        metadata: { is_fair_catch: values.is_fair_catch || false, is_touchback: values.is_touchback || false, is_muffed: values.is_muffed || false },
      });
    }

    if (values.coverage_tackler_id && ['kickoff', 'punt'].includes(selectedSpecialTeamsUnit)) {
      participations.push({
        play_instance_id: playInstanceId, player_id: values.coverage_tackler_id,
        team_id: ctx.game.team_id,
        participation_type: selectedSpecialTeamsUnit === 'punt' ? 'gunner' : 'coverage_tackle',
        phase: 'special_teams', result: 'tackle', metadata: {},
      });
    }
  }

  return participations;
}

// ============================================
// HOOK
// ============================================

export function useTagSubmission(
  ctx: SubmissionContext,
  callbacks: SubmissionCallbacks,
  setIsSavingPlay: (saving: boolean) => void,
): UseTagSubmissionReturn {
  const supabase = createClient();
  const driveService = new DriveService();

  const submitTag = useCallback(async (values: PlayTagForm) => {
    if (!ctx.selectedVideo || !ctx.game?.team_id) return;
    if (ctx.editingInstance === undefined) return; // Guard

    setIsSavingPlay(true);

    try {
      // Handle drive creation/assignment
      let driveId: string | undefined;

      if (ctx.driveAssignMode === 'new' && values.new_drive_number && values.new_drive_quarter && values.yard_line) {
        const newDrive = await driveService.createDrive({
          gameId: ctx.gameId,
          teamId: ctx.game.team_id,
          driveNumber: values.new_drive_number,
          quarter: values.new_drive_quarter,
          startYardLine: values.yard_line,
          possessionType: ctx.isTaggingOpponent ? 'defense' : 'offense',
        });
        driveId = newDrive.id;
        callbacks.onDriveCreated(newDrive);
        await callbacks.fetchDrives();
      } else if (ctx.driveAssignMode === 'current' && ctx.currentDrive) {
        driveId = ctx.currentDrive.id;
      } else if (ctx.driveAssignMode === 'select' && values.drive_id) {
        driveId = values.drive_id;
      }

      // Build instance data
      const instanceData = buildInstanceData(values, ctx);
      instanceData.drive_id = driveId;

      // Clean: convert undefined and empty strings to null
      const cleanedData = Object.fromEntries(
        Object.entries(instanceData).map(([key, value]) => [
          key,
          value === undefined || value === '' ? null : value,
        ])
      );

      let playInstanceId: string;

      if (ctx.editingInstance) {
        const { error } = await supabase
          .from('play_instances')
          .update(cleanedData)
          .eq('id', ctx.editingInstance.id);
        if (error) throw error;
        playInstanceId = ctx.editingInstance.id;

        // Clear existing participations when editing
        await supabase
          .from('player_participation')
          .delete()
          .eq('play_instance_id', playInstanceId);

        // Recalculate drive stats if drive changed
        if (driveId && ctx.editingInstance.drive_id !== driveId) {
          if (ctx.editingInstance.drive_id) {
            await driveService.recalculateDriveStats(ctx.editingInstance.drive_id);
          }
          await driveService.recalculateDriveStats(driveId);
        } else if (driveId) {
          await driveService.recalculateDriveStats(driveId);
        }
      } else {
        const { data: newPlay, error } = await supabase
          .from('play_instances')
          .insert([cleanedData])
          .select('id')
          .single();
        if (error) throw error;
        playInstanceId = newPlay.id;

        if (driveId) {
          await driveService.recalculateDriveStats(driveId);
        }
      }

      // Build and insert participations
      const participations = buildParticipations(values, playInstanceId, ctx);
      if (participations.length > 0) {
        const { error: participationError } = await supabase
          .from('player_participation')
          .insert(participations);
        if (participationError) {
          console.error('Failed to save player participations:', participationError);
        }
      }

      // Refresh drives
      await callbacks.fetchDrives();

      // Success notification
      alert(ctx.editingInstance ? 'Play updated successfully!' : 'Play saved successfully!');

      // Auto-update film analysis status
      if (ctx.filmAnalysisStatus === 'not_started') {
        await filmSessionService.updateAnalysisStatus(ctx.gameId, 'in_progress');
        callbacks.onStatusChange('in_progress');
      }

      callbacks.onClose();
      callbacks.onSaveComplete();
    } catch (error: any) {
      alert('Error saving play: ' + error.message);
    } finally {
      setIsSavingPlay(false);
    }
  }, [ctx, callbacks, supabase, driveService, setIsSavingPlay]);

  return { submitTag };
}
