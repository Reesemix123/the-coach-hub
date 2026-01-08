'use client';

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from '@/components/AuthGuard';
import { useForm } from "react-hook-form";
import { createClient } from '@/utils/supabase/client';
import { COMMON_ATTRIBUTES, OPPONENT_PLAY_TYPES } from '@/config/footballConfig';
import {
  RESULT_TYPES,
  SCORING_TYPES,
  PENALTY_TYPES,
  SPECIAL_TEAMS_UNITS,
  KICK_RESULTS,
  PUNT_TYPES,
  KICKOFF_TYPES,
  SNAP_QUALITY_OPTIONS,
  getKickResultsForUnit,
  type SpecialTeamsUnit,
  type KickResult,
  type PuntType,
  type KickoffType,
  type SnapQuality
} from '@/types/football';
import { DriveService } from '@/lib/services/drive.service';
import type { Drive } from '@/types/football';
import VirtualVideoPlayer from '@/components/VirtualVideoPlayer';
import CombineVideosModal from '@/components/CombineVideosModal';
import { VideoClipPlayer } from '@/components/film/VideoClipPlayer';
import { QBPerformanceSection } from '@/components/film/QBPerformanceSection';
import { RBPerformanceSection } from '@/components/film/RBPerformanceSection';
import { WRPerformanceSection } from '@/components/film/WRPerformanceSection';
import { OLPerformanceSection } from '@/components/film/OLPerformanceSection';
import { DLPerformanceSection } from '@/components/film/DLPerformanceSection';
import { LBPerformanceSection } from '@/components/film/LBPerformanceSection';
import { DBPerformanceSection } from '@/components/film/DBPerformanceSection';
import { playerHasPosition, playerInPositionGroup, getPlayerDisplayName, getPositionDisplay } from '@/utils/playerHelpers';
import VideoTimelineMarkers from '@/components/film/VideoTimelineMarkers';
import MarkerList from '@/components/film/MarkerList';
// AddMarkerModal removed - using dropdown instead
import EditMarkerModal from '@/components/film/EditMarkerModal';
import CameraRow from '@/components/film/CameraRow';
import DirectorsCut from '@/components/film/DirectorsCut';
// import { TimelineEditor } from '@/components/film/TimelineEditor'; // Deprecated - using UnifiedTimeline via bridge
import { TagPageFilmBridge } from '@/components/film/TagPageFilmBridge';
import { TagPageUnifiedTimeline } from '@/components/film/TagPageUnifiedTimeline';
import { TimelineCameraSelector } from '@/components/film/TimelineCameraSelector';
import { VideoMarkerService } from '@/lib/services/video-marker.service';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { Flag, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { uploadFile, formatBytes, formatTime, formatSpeed, type UploadProgress } from '@/lib/utils/resumable-upload';
import { TierSelectorModal } from '@/components/film/TierSelectorModal';
import { TierBadge } from '@/components/film/TierBadge';
import { TierUpgradeModal } from '@/components/film/TierUpgradeModal';
import { isFieldVisibleForTier, type TaggingTier, type GameScoreBreakdown, type FilmAnalysisStatus } from '@/types/football';
import { QuarterScoreDisplay } from '@/components/film/QuarterScoreDisplay';
import { ScoreMismatchWarning } from '@/components/film/ScoreMismatchWarning';
import { FilmAnalysisStatusPanel } from '@/components/film/FilmAnalysisStatusPanel';
import { ResumeTaggingButton } from '@/components/film/ResumeTaggingButton';
import { gameScoreService, type ScoreMismatchResult } from '@/lib/services/game-score.service';
import { filmSessionService } from '@/lib/services/film-session.service';
import StorageUsageCard from '@/components/StorageUsageCard';
import type { CameraLane } from '@/types/timeline';
import { findActiveClipForTime, findLaneForVideo } from '@/types/timeline';
import { AITaggingButton, type AITagPredictions, type TaggingMode } from '@/components/film/AITaggingButton';

interface Game {
  id: string;
  name: string;
  opponent?: string;
  date?: string;
  team_id: string;
  is_opponent_game?: boolean;
  tagging_tier?: TaggingTier;
}

interface Video {
  id: string;
  name: string;
  file_path?: string;
  game_id?: string;
  url?: string;
  created_at: string;
  is_virtual?: boolean;
  source_video_ids?: string[];
  virtual_name?: string;
  video_count?: number;
  video_group_id?: string;
  // Camera fields (from migration 084 and 090)
  camera_label?: string | null;
  camera_order?: number;
  sync_offset_seconds?: number;
  thumbnail_url?: string | null;
  upload_status?: 'pending' | 'processing' | 'ready' | 'failed';
  duration_seconds?: number | null;
}

interface Play {
  play_code: string;
  play_name: string;
  attributes: any;
}

interface PlayInstance {
  id: string;
  video_id: string;
  camera_id?: string; // Which camera was selected when tagging
  play_code: string;
  team_id: string;
  timestamp_start: number;
  timestamp_end?: number;
  down?: number;
  distance?: number;
  yard_line?: number;
  hash_mark?: string;
  result?: string;
  result_type?: string;
  yards_gained?: number;
  notes?: string;
  tags?: string[];
  play_name?: string;
  player_id?: string;
  formation?: string;
  resulted_in_first_down?: boolean;
  is_opponent_play?: boolean;

  // Context fields
  quarter?: number;
  time_remaining?: number;
  score_differential?: number;
  drive_id?: string;

  // Tier 1 & 2: Player attribution
  ball_carrier_id?: string;
  qb_id?: string;
  target_id?: string;
  play_type?: string;
  direction?: string;

  // Tier 3: Offensive Line
  lt_id?: string;
  lt_block_result?: string;
  lg_id?: string;
  lg_block_result?: string;
  c_id?: string;
  c_block_result?: string;
  rg_id?: string;
  rg_block_result?: string;
  rt_id?: string;
  rt_block_result?: string;

  // Tier 3: Defensive tracking
  tackler_ids?: string[];
  missed_tackle_ids?: string[];
  pressure_player_ids?: string[];
  sack_player_id?: string;
  coverage_player_id?: string;
  coverage_result?: string;
  is_tfl?: boolean;
  is_sack?: boolean;
  is_forced_fumble?: boolean;
  is_pbu?: boolean;
  is_interception?: boolean;
  qb_decision_grade?: number;

  // Special Teams tracking
  special_teams_unit?: SpecialTeamsUnit;
  kicker_id?: string;
  kick_result?: KickResult;
  kick_distance?: number;
  returner_id?: string;
  return_yards?: number;
  is_fair_catch?: boolean;
  is_touchback?: boolean;
  is_muffed?: boolean;
  punter_id?: string;
  punt_type?: PuntType;
  gunner_tackle_id?: string;
  kickoff_type?: KickoffType;
  long_snapper_id?: string;
  snap_quality?: SnapQuality;
  holder_id?: string;
  coverage_tackler_id?: string;
  penalty_on_play?: boolean;
  penalty_type?: string;
  penalty_yards?: number;
  penalty_on_us?: boolean;
  penalty_declined?: boolean;

  // Scoring fields
  scoring_type?: string;
  scoring_points?: number;
}

// Tagging mode: offense, defense, or special teams
type TaggingMode = 'offense' | 'defense' | 'specialTeams';

interface PlayTagForm {
  play_code?: string;
  opponent_play_type?: string;
  player_id?: string;
  opponent_player_number?: string;
  formation?: string;
  result_type?: string;
  resulted_in_first_down?: boolean;
  down?: number;
  distance?: number;
  yard_line?: number;
  hash_mark?: string;
  yards_gained?: number;
  notes?: string;
  drive_id?: string;
  new_drive_number?: number;
  new_drive_quarter?: number;

  // Context
  quarter?: number;

  // Tier 1 & 2: Player attribution
  ball_carrier_id?: string;
  qb_id?: string;
  target_id?: string;
  play_type?: string;
  direction?: string;

  // Tier 3: Offensive Line
  lt_id?: string;
  lt_block_result?: string;
  lg_id?: string;
  lg_block_result?: string;
  c_id?: string;
  c_block_result?: string;
  rg_id?: string;
  rg_block_result?: string;
  rt_id?: string;
  rt_block_result?: string;

  // Tier 3: Defensive tracking
  tackler_ids?: string;
  missed_tackle_ids?: string;
  pressure_player_ids?: string;
  sack_player_id?: string;
  coverage_player_id?: string;
  coverage_result?: string;
  is_tfl?: boolean;
  is_sack?: boolean;
  is_forced_fumble?: boolean;
  is_pbu?: boolean;
  is_interception?: boolean;
  qb_decision_grade?: number;

  // Player Attribution for Big Plays
  forced_fumble_player_id?: string;
  interception_player_id?: string;

  // Multi-Player Defensive Tracking (NEW)
  dl_run_defense_players?: string;
  dl_run_defense_data?: string;
  dl_pass_rush_data?: string;
  lb_run_stop_players?: string;
  lb_run_stop_data?: string;
  lb_pass_coverage_players?: string;
  lb_pass_coverage_data?: string;
  db_run_support_players?: string;
  db_run_support_data?: string;
  db_pass_coverage_players?: string;
  db_pass_coverage_data?: string;

  // Special Teams fields
  special_teams_unit?: SpecialTeamsUnit;
  kicker_id?: string;
  kick_result?: KickResult;
  kick_distance?: number;
  returner_id?: string;
  return_yards?: number;
  is_fair_catch?: boolean;
  is_touchback?: boolean;
  is_muffed?: boolean;
  punter_id?: string;
  punt_type?: PuntType;
  gunner_tackle_id?: string;
  kickoff_type?: KickoffType;
  long_snapper_id?: string;
  snap_quality?: SnapQuality;
  holder_id?: string;
  coverage_tackler_id?: string;
  blocker_id?: string; // For FG Block plays
  penalty_on_play?: boolean;
  penalty_type?: string;
  penalty_yards?: number;
  penalty_on_us?: string; // Radio buttons return strings
  penalty_declined?: boolean; // When true, penalty doesn't affect next play calculations

  // Scoring fields (all tiers)
  scoring_type?: string;
  scoring_points?: number;
  opponent_scored?: boolean; // True when opponent scores on our play (e.g., punt returned for TD)
}

const DOWNS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' }
];

const HASH_MARKS = COMMON_ATTRIBUTES.hash.map(h => ({
  value: h.toLowerCase(),
  label: h
}));

const PLAY_TYPES = [
  { value: 'run', label: 'Run' },
  { value: 'pass', label: 'Pass' },
  { value: 'screen', label: 'Screen' },
  { value: 'rpo', label: 'RPO' },
  { value: 'trick', label: 'Trick Play' }
];

const DIRECTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'middle', label: 'Middle' },
  { value: 'right', label: 'Right' }
];

const BLOCK_RESULTS = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'neutral', label: 'Neutral' }
];

const COVERAGE_RESULTS = [
  { value: 'win', label: 'Win (Coverage held)' },
  { value: 'loss', label: 'Loss (Completion/TD)' },
  { value: 'neutral', label: 'Neutral' }
];

const QB_DECISION_GRADES = [
  { value: 0, label: '0 - Bad Decision' },
  { value: 1, label: '1 - OK Decision' },
  { value: 2, label: '2 - Great Decision' }
];

export default function GameFilmPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const driveService = new DriveService();
  const videoRef = useRef<HTMLVideoElement>(null);

  const teamId = params.teamId as string;
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [plays, setPlays] = useState<Play[]>([]);
  const [playInstances, setPlayInstances] = useState<PlayInstance[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [formations, setFormations] = useState<string[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [currentDrive, setCurrentDrive] = useState<Drive | null>(null);
  const [driveAssignMode, setDriveAssignMode] = useState<'current' | 'new' | 'select'>('current');

  // Video selection and combining
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [showCombineModal, setShowCombineModal] = useState(false);

  // Camera state
  const [cameraLimit, setCameraLimit] = useState<number>(1);
  const [showCameraUpload, setShowCameraUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSyncSeek, setPendingSyncSeek] = useState<number | null>(null); // Time to seek after camera switch
  const [shouldResumePlayback, setShouldResumePlayback] = useState(false); // Whether to auto-play after camera switch

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [timelineDurationMs, setTimelineDurationMs] = useState<number>(0); // Total game timeline duration
  const [videoOffsetMs, setVideoOffsetMs] = useState<number>(0); // Current video's position in game timeline
  const [clipDurationMs, setClipDurationMs] = useState<number>(0); // Current clip's duration in timeline
  const [offsetDataVideoId, setOffsetDataVideoId] = useState<string | null>(null); // Track which video the offset data belongs to
  const [targetGameTimeMs, setTargetGameTimeMs] = useState<number | null>(null); // Target game time we're trying to view (for camera switch coverage check)
  const [pendingCameraId, setPendingCameraId] = useState<string | null>(null); // Track which camera we're switching to (for race condition handling)
  const [gameTimelinePositionMs, setGameTimelinePositionMs] = useState<number>(0); // Actual timeline playhead position (not capped by video duration)
  const [timelineLanes, setTimelineLanes] = useState<CameraLane[]>([]); // Timeline lanes data (for multi-clip camera switching)
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false); // Loading state for camera switch
  const lastCameraSwitchTime = useRef<number>(0); // Debounce rapid camera clicks
  const deferredCameraSwitch = useRef<{ videoId: string; gameTime?: number } | null>(null); // Store pending camera switch when video not loaded yet
  const seekLockRef = useRef<boolean>(false); // Prevents onTimeUpdate from overwriting gameTimelinePositionMs after programmatic seek
  const [currentLaneNumber, setCurrentLaneNumber] = useState<number>(1); // Which camera lane is active (persists across clip switches)
  const virtualPlaybackRef = useRef<NodeJS.Timeout | null>(null); // Timer for advancing timeline during coverage gaps
  const virtualPlaybackTargetRef = useRef<number | null>(null); // Target time for virtual playback
  const [isVirtuallyPlaying, setIsVirtuallyPlaying] = useState(false); // Whether we're in virtual playback mode (no video coverage)
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<PlayInstance | null>(null);
  const [tagStartTime, setTagStartTime] = useState<number>(0);
  const [tagEndTime, setTagEndTime] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadDetails, setUploadDetails] = useState<{
    speed: string;
    remaining: string;
    uploaded: string;
    total: string;
  } | null>(null);
  const [isSettingEndTime, setIsSettingEndTime] = useState(false);
  const [taggingMode, setTaggingMode] = useState<TaggingMode>('offense');
  const [analyticsTier, setAnalyticsTier] = useState<string>('premium');
  const [selectedTab, setSelectedTab] = useState<'context' | 'players' | 'ol' | 'defense' | 'specialTeams'>('context');
  const [selectedSpecialTeamsUnit, setSelectedSpecialTeamsUnit] = useState<SpecialTeamsUnit | ''>('');
  const [aiPredictions, setAiPredictions] = useState<AITagPredictions | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // Track which fields were AI-filled and their confidence levels
  const [aiFilledFields, setAiFilledFields] = useState<Record<string, number>>({});

  /**
   * Get CSS classes for AI-filled fields based on confidence level
   * Green (80+): High confidence
   * Yellow (60-79): Medium confidence
   * Red (<60): Low confidence
   */
  const getAIConfidenceClass = (fieldName: string): string => {
    const confidence = aiFilledFields[fieldName];
    if (confidence === undefined) return '';

    if (confidence >= 80) {
      return 'ring-2 ring-green-400 bg-green-50';
    } else if (confidence >= 60) {
      return 'ring-2 ring-yellow-400 bg-yellow-50';
    } else {
      return 'ring-2 ring-red-400 bg-red-50';
    }
  };

  // Helper for backwards compatibility - is it a defensive play (opponent has the ball)?
  const isTaggingOpponent = taggingMode === 'defense';

  // Helper function to check if a field should be visible for the current tagging tier
  const isFieldVisible = (field: string): boolean => {
    if (!taggingTier) return false; // No tier set, hide all advanced fields
    const unitType = taggingMode === 'specialTeams' ? 'specialTeams' : (taggingMode === 'defense' ? 'defense' : 'offense');
    return isFieldVisibleForTier(field, taggingTier, unitType);
  };
  const [selectedTacklers, setSelectedTacklers] = useState<string[]>([]);
  const [primaryTacklerId, setPrimaryTacklerId] = useState<string>('');

  // Filter state
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterOffenseDefense, setFilterOffenseDefense] = useState<string>('all');
  const [filterDrive, setFilterDrive] = useState<string>('all');

  // Marker state
  const [markers, setMarkers] = useState<VideoTimelineMarker[]>([]);
  const [showMarkerPanel, setShowMarkerPanel] = useState(false);
  const [markersCollapsed, setMarkersCollapsed] = useState(false);
  const [showPeriodMarkerMenu, setShowPeriodMarkerMenu] = useState(false);
  const [showAddMarkerMenu, setShowAddMarkerMenu] = useState(false);
  const [editingMarker, setEditingMarker] = useState<VideoTimelineMarker | null>(null);
  const markerService = new VideoMarkerService();

  // Tagging Tier state
  const [taggingTier, setTaggingTier] = useState<TaggingTier | null>(null);
  const [showTierSelector, setShowTierSelector] = useState(false);
  const [showTierUpgrade, setShowTierUpgrade] = useState(false);

  // Quarter Scores & Film Analysis Status
  const [quarterScores, setQuarterScores] = useState<GameScoreBreakdown | null>(null);
  const [scoreMismatch, setScoreMismatch] = useState<ScoreMismatchResult | null>(null);
  const [filmAnalysisStatus, setFilmAnalysisStatus] = useState<FilmAnalysisStatus>('not_started');
  const [showTaggingCompleteModal, setShowTaggingCompleteModal] = useState(false);
  const [finalScoreInputs, setFinalScoreInputs] = useState<{ teamScore: string; opponentScore: string }>({ teamScore: '', opponentScore: '' });

  // Auto-population state for down/distance/yard_line
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<string[]>([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayTagForm>();

  // ============================================================================
  // AUTO-POPULATION HELPER FUNCTIONS
  // ============================================================================

  interface PlayContext {
    down: number;
    distance: number;
    yard_line: number | undefined;
    hash_mark?: string;
    isAutoPopulated: boolean;
    possessionChanged: boolean;
  }

  interface PossessionChangeResult {
    changed: boolean;
    isAfterScore: boolean;
  }

  // Detect if the previous play resulted in a possession change
  function detectPossessionChange(play: PlayInstance): PossessionChangeResult {
    // After scoring - don't suggest yard line (varies by kickoff position)
    if (play.scoring_type && ['touchdown', 'field_goal', 'safety'].includes(play.scoring_type)) {
      return { changed: true, isAfterScore: true };
    }

    // Turnover (interception, fumble lost)
    if (play.result_type && ['pass_interception', 'fumble_lost'].includes(play.result_type)) {
      return { changed: true, isAfterScore: false };
    }

    // Special teams plays that change possession
    const possessionChangingUnits: SpecialTeamsUnit[] = ['punt', 'kickoff', 'punt_return', 'kick_return'];
    if (play.special_teams_unit && possessionChangingUnits.includes(play.special_teams_unit)) {
      return { changed: true, isAfterScore: false };
    }

    return { changed: false, isAfterScore: false };
  }

  // Calculate next distance accounting for yards gained and penalties
  function calculateNextDistance(play: PlayInstance): { distance: number; isFirstDown: boolean } {
    const baseDistance = (play.distance || 10) - (play.yards_gained || 0);

    // Handle penalties (only if not declined)
    if (play.penalty_on_play && play.penalty_type && !play.penalty_declined) {
      const penaltyDef = PENALTY_TYPES.find(p => p.value === play.penalty_type);
      const penaltyYards = play.penalty_yards || penaltyDef?.yards || 0;
      const isAutoFirstDown = penaltyDef?.auto_first === true;

      if (play.penalty_on_us) {
        // Penalty on our team - adds to distance
        return {
          distance: baseDistance + penaltyYards,
          isFirstDown: false
        };
      } else {
        // Penalty on opponent
        if (isAutoFirstDown) {
          return { distance: 10, isFirstDown: true };
        }
        const adjustedDistance = baseDistance - penaltyYards;
        if (adjustedDistance <= 0) {
          return { distance: 10, isFirstDown: true };
        }
        return { distance: adjustedDistance, isFirstDown: false };
      }
    }

    // Check if gained enough for first down
    if (baseDistance <= 0) {
      return { distance: 10, isFirstDown: true };
    }

    return { distance: baseDistance, isFirstDown: false };
  }

  // Calculate next yard line based on previous play outcome
  function calculateNextYardLine(play: PlayInstance): number {
    let yardLine = (play.yard_line || 20) + (play.yards_gained || 0);

    // Adjust for penalties (only if not declined)
    if (play.penalty_on_play && play.penalty_yards && !play.penalty_declined) {
      if (play.penalty_on_us) {
        yardLine -= play.penalty_yards; // Move backward
      } else {
        yardLine += play.penalty_yards; // Move forward
      }
    }

    // Clamp to valid field position (1-99)
    return Math.max(1, Math.min(99, yardLine));
  }

  // Calculate yard line after possession change (flip the field)
  function calculateYardLineAfterPossessionChange(play: PlayInstance): number {
    const endYardLine = calculateNextYardLine(play);
    return 100 - endYardLine;
  }

  // Main function to calculate next play context
  function calculateNextPlayContext(previousPlay: PlayInstance | null): PlayContext | null {
    if (!previousPlay) return null;

    // Detect possession change
    const { changed: possessionChanged, isAfterScore } = detectPossessionChange(previousPlay);

    if (possessionChanged) {
      return {
        down: 1,
        distance: 10,
        // Don't suggest yard line after scores (kickoff position varies)
        yard_line: isAfterScore ? undefined : calculateYardLineAfterPossessionChange(previousPlay),
        isAutoPopulated: true,
        possessionChanged: true
      };
    }

    // Check if previous play resulted in first down
    if (previousPlay.resulted_in_first_down) {
      return {
        down: 1,
        distance: 10,
        yard_line: calculateNextYardLine(previousPlay),
        isAutoPopulated: true,
        possessionChanged: false
      };
    }

    // Normal progression
    const nextDown = (previousPlay.down || 1) + 1;

    // If it was 4th down and not converted, possession change
    if (nextDown > 4) {
      return {
        down: 1,
        distance: 10,
        yard_line: calculateYardLineAfterPossessionChange(previousPlay),
        isAutoPopulated: true,
        possessionChanged: true
      };
    }

    // Calculate distance with penalty adjustments
    const { distance, isFirstDown } = calculateNextDistance(previousPlay);

    if (isFirstDown) {
      return {
        down: 1,
        distance: 10,
        yard_line: calculateNextYardLine(previousPlay),
        isAutoPopulated: true,
        possessionChanged: false
      };
    }

    return {
      down: nextDown,
      distance: Math.max(1, distance),
      yard_line: calculateNextYardLine(previousPlay),
      hash_mark: previousPlay.direction, // Suggest hash based on previous play direction
      isAutoPopulated: true,
      possessionChanged: false
    };
  }

  // Get the previous play based on timestamp
  function getPreviousPlay(): PlayInstance | null {
    if (playInstances.length === 0) return null;

    // Find plays before current timestamp, get the most recent one
    const previousPlays = playInstances
      .filter(p => p.timestamp_start < tagStartTime)
      .sort((a, b) => b.timestamp_start - a.timestamp_start);

    return previousPlays[0] || null;
  }

  // Helper for input styling - highlights auto-populated fields
  function getFieldClassName(fieldName: string, baseClass: string): string {
    const isAutoPopulated = autoPopulatedFields.includes(fieldName);
    return `${baseClass} ${isAutoPopulated ? 'bg-blue-50 border-blue-300' : ''}`;
  }

  // Clear auto-populated indicator when user manually changes value
  function handleFieldChange(fieldName: string) {
    setAutoPopulatedFields(prev => prev.filter(f => f !== fieldName));
  }

  // Cleanup virtual playback timer on unmount
  useEffect(() => {
    return () => {
      if (virtualPlaybackRef.current) {
        clearInterval(virtualPlaybackRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchVideos();
      fetchDrives();
      fetchCameraLimit();
    }
  }, [gameId]);

  useEffect(() => {
    if (game?.team_id) {
      fetchPlays();
      fetchPlayers();
      fetchFormations();
      fetchAnalyticsTier();
    }
  }, [game]);

  // Fetch all play instances when timeline is loaded (use timeline videos, not orphaned videos)
  useEffect(() => {
    if (timelineLanes.length > 0) {
      // Get unique video IDs from timeline lanes (not from videos state which may have orphaned videos)
      const timelineVideoIds = [...new Set(timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
      if (timelineVideoIds.length > 0) {
        fetchPlayInstances(timelineVideoIds);
      }
    }
  }, [timelineLanes]);

  useEffect(() => {
    // Check if selectedVideo is still in the videos array (handles deleted videos)
    const selectedVideoInArray = selectedVideo && videos.find(v => v.id === selectedVideo.id);

    // A video is valid if it exists in the array AND has a url or file_path
    const selectedVideoIsValid = selectedVideoInArray && (selectedVideoInArray.url || selectedVideoInArray.file_path);

    if (selectedVideoIsValid) {
      // Selected video is valid, load it
      loadVideo(selectedVideoInArray);
      fetchMarkers(selectedVideoInArray.id);
    } else if (videos.length > 0) {
      // Find the first video with a valid URL/file_path (skip orphaned records)
      const validVideo = videos.find(v => v.url || v.file_path);
      if (validVideo) {
        console.log('[TagPage] Selecting valid video:', validVideo.id, validVideo.name);
        setSelectedVideo(validVideo);
      } else {
        // No valid videos available
        console.log('[TagPage] No valid videos found (all missing URLs)');
        setSelectedVideo(null);
      }
    } else if (selectedVideo) {
      // Videos array is empty but we have a stale selection, clear it
      console.log('[TagPage] Clearing stale selectedVideo - no videos available');
      setSelectedVideo(null);
    }
  }, [selectedVideo, videos]);

  // Process deferred camera switch when videos array updates
  useEffect(() => {
    if (!deferredCameraSwitch.current) return;

    const { videoId, gameTime } = deferredCameraSwitch.current;
    const video = videos.find(v => v.id === videoId);

    if (video) {
      console.log('[TagPage] Processing deferred camera switch:', videoId);
      // Clear the deferred switch before calling handleCameraSwitch to avoid infinite loop
      deferredCameraSwitch.current = null;
      // Call handleCameraSwitch now that the video is in the array
      handleCameraSwitch(videoId, gameTime);
    }
  }, [videos]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      // Save position when video pauses
      if (selectedVideo && gameId) {
        filmSessionService.savePosition(gameId, selectedVideo.id, video.currentTime * 1000).catch(console.error);
      }
    };
    const handleLoadedMetadata = () => {
      // Just set the duration - the separate seek useEffect handles pending seeks
      setVideoDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [selectedVideo, gameId]);

  // Apply pending seek when video duration becomes available
  // This handles cached videos where loadedmetadata might not fire again
  useEffect(() => {
    if (pendingSyncSeek === null) return;
    if (videoDuration <= 0) return;
    if (!videoRef.current) return;

    console.log('[CameraSwitch] Applying pending seek:', {
      pendingSyncSeek,
      videoDuration,
      currentTime: videoRef.current.currentTime,
      readyState: videoRef.current.readyState,
      targetGameTimeMs,
      videoOffsetMs,
    });

    // Check if video is ready for seeking (readyState >= 1 means metadata is loaded)
    if (videoRef.current.readyState < 1) {
      console.warn('[CameraSwitch] Video not ready for seeking, readyState:', videoRef.current.readyState);
      // Don't clear pendingSyncSeek - the effect will re-run when videoDuration changes again
      return;
    }

    // Apply the seek
    const seekedTime = Math.max(0, Math.min(pendingSyncSeek, videoDuration));
    console.log('[CameraSwitch] Seeking to:', seekedTime, 'seconds');
    videoRef.current.currentTime = seekedTime;

    // Verify the seek worked
    console.log('[CameraSwitch] After seek, currentTime is:', videoRef.current.currentTime);

    // Update state to match the seeked position
    setCurrentTime(seekedTime);

    // Use targetGameTimeMs directly - it's the exact game time the user wanted
    // Don't calculate from videoOffsetMs as it might be stale
    if (targetGameTimeMs !== null) {
      console.log('[CameraSwitch] Setting gameTimelinePositionMs from targetGameTimeMs:', targetGameTimeMs);
      setGameTimelinePositionMs(targetGameTimeMs);
    } else {
      // Fallback: calculate from offset (might be inaccurate if offset is stale)
      console.log('[CameraSwitch] Fallback: calculating gameTimelinePositionMs from videoOffsetMs:', videoOffsetMs + (seekedTime * 1000));
      setGameTimelinePositionMs(videoOffsetMs + (seekedTime * 1000));
    }

    // CRITICAL: Lock to prevent onTimeUpdate from immediately overwriting gameTimelinePositionMs
    // This fixes the race condition where onTimeUpdate fires right after the seek
    // and incorrectly sets the position based on the seeked video time (which may be clamped)
    seekLockRef.current = true;
    console.log('[CameraSwitch] Setting seek lock to prevent onTimeUpdate overwrite');
    setTimeout(() => {
      seekLockRef.current = false;
      console.log('[CameraSwitch] Seek lock cleared');
    }, 500); // Hold lock for 500ms to ensure state settles

    setPendingSyncSeek(null);

    // NOTE: Don't clear isSwitchingCamera here!
    // The coverage check effect will clear it after verifying the offset data is correct.
    // This prevents the overlay from flashing briefly during the transition.

    // Resume playback if needed
    if (shouldResumePlayback) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked by browser, that's ok
      });
      setShouldResumePlayback(false);
    }
  }, [pendingSyncSeek, videoDuration, shouldResumePlayback, videoOffsetMs, targetGameTimeMs]);

  // Load quarter scores and check for mismatch when game is loaded
  useEffect(() => {
    if (gameId && game) {
      loadQuarterScoresAndMismatch();
    }
  }, [gameId, game]);

  // Clear targetGameTimeMs if the camera switch resulted in valid coverage
  // This handles the case where we switch to a camera that DOES have coverage at the target time
  useEffect(() => {
    if (targetGameTimeMs === null) return;
    if (pendingCameraId === null) return;

    // CRITICAL: Only check coverage if we're looking at the NEW camera's data
    // This prevents the race condition where we check against the OLD camera's offset
    if (selectedVideo?.id !== pendingCameraId) {
      console.log('[CameraSwitch] Waiting for new camera to be selected...', {
        selectedVideoId: selectedVideo?.id,
        pendingCameraId,
      });
      return;
    }

    // ALSO check that the offset data belongs to the NEW camera
    // This prevents checking coverage with stale offset data
    if (offsetDataVideoId !== pendingCameraId) {
      console.log('[CameraSwitch] Waiting for offset data to update...', {
        offsetDataVideoId,
        pendingCameraId,
        currentOffsetMs: videoOffsetMs,
        currentDurationMs: clipDurationMs,
      });
      return;
    }

    // Use timeline clip data if available, otherwise fall back to video's sync_offset_seconds
    const syncOffsetMs = (selectedVideo?.sync_offset_seconds || 0) * 1000;
    const videoStartMs = clipDurationMs > 0 ? videoOffsetMs : syncOffsetMs;

    // CRITICAL: Use the MINIMUM of clip duration (from timeline) and actual video duration
    // This handles data mismatches where timeline might say 30 min but actual video is 194 seconds
    // In such cases, the actual video length is the real coverage limit
    const actualVideoDurationMs = videoDuration > 0 ? videoDuration * 1000 : 0;
    let effectiveDurationMs: number;
    if (clipDurationMs > 0 && actualVideoDurationMs > 0) {
      // Use the smaller of the two - actual video is the hard limit
      effectiveDurationMs = Math.min(clipDurationMs, actualVideoDurationMs);
    } else if (clipDurationMs > 0) {
      effectiveDurationMs = clipDurationMs;
    } else {
      effectiveDurationMs = actualVideoDurationMs;
    }
    const videoEndMs = videoStartMs + effectiveDurationMs;

    console.log('[CameraSwitch] Checking coverage for NEW camera (data verified):', {
      targetGameTimeMs,
      videoOffsetMs,
      clipDurationMs,
      actualVideoDurationMs,
      effectiveDurationMs,
      syncOffsetMs,
      videoStartMs,
      videoEndMs,
      videoDuration,
      selectedVideoId: selectedVideo?.id,
      pendingCameraId,
      offsetDataVideoId,
    });

    // If we don't have enough data yet, wait
    // CRITICAL: Wait for actual video duration before making coverage decisions
    // This prevents making decisions based on stale or missing video duration data
    if (videoEndMs === 0 || videoDuration <= 0) {
      console.log('[CameraSwitch] Waiting for video duration...', { videoEndMs, videoDuration });
      return;
    }

    // If target game time is within coverage, clear it (no overlay needed)
    if (targetGameTimeMs >= videoStartMs && targetGameTimeMs < videoEndMs) {
      console.log('[CameraSwitch] Target is within coverage, clearing overlay and resuming playback');
      setTargetGameTimeMs(null);
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      // Auto-play since we're switching to a camera with valid coverage
      // (user was previously watching video before hitting "no coverage")
      setShouldResumePlayback(true);
      // Also try to play immediately in case video already loaded
      if (videoRef.current && videoRef.current.paused && videoRef.current.readyState >= 2) {
        videoRef.current.play().catch(() => {
          // Autoplay might be blocked, that's ok
        });
      }
    } else {
      console.log('[CameraSwitch] Target is OUTSIDE coverage, should show overlay');
      // Clear pendingCameraId but keep targetGameTimeMs for the overlay
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      // IMPORTANT: Cancel any pending playback since we're showing the overlay
      setShouldResumePlayback(false);
      // Pause video immediately
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [targetGameTimeMs, pendingCameraId, videoOffsetMs, clipDurationMs, videoDuration, selectedVideo?.id, selectedVideo?.sync_offset_seconds, offsetDataVideoId]);

  // Pause video when showing "No film available" overlay to prevent playback in background
  useEffect(() => {
    if (!videoRef.current) return;

    // Determine if we should pause due to overlay showing
    const isCheckingCoverage = pendingCameraId !== null;
    const isShowingNoFilmOverlay = targetGameTimeMs !== null && pendingCameraId === null;

    if (isCheckingCoverage || isShowingNoFilmOverlay) {
      // Pause the video when overlay is showing
      if (!videoRef.current.paused) {
        console.log('[VideoOverlay] Pausing video due to overlay:', {
          isCheckingCoverage,
          isShowingNoFilmOverlay,
          pendingCameraId,
          targetGameTimeMs,
        });
        videoRef.current.pause();
      }
    }
  }, [pendingCameraId, targetGameTimeMs]);

  // Close period marker menu and add marker menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showPeriodMarkerMenu && !target.closest('[data-period-menu]')) {
        setShowPeriodMarkerMenu(false);
      }
      if (showAddMarkerMenu && !target.closest('[data-add-marker-menu]')) {
        setShowAddMarkerMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showPeriodMarkerMenu, showAddMarkerMenu]);

  async function loadQuarterScoresAndMismatch() {
    try {
      const [scores, mismatch] = await Promise.all([
        gameScoreService.getQuarterScores(gameId),
        gameScoreService.checkScoreMismatch(gameId)
      ]);
      setQuarterScores(scores);
      setScoreMismatch(mismatch);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  }

  // Handler for resuming to saved position
  const handleResumePosition = (videoId: string, positionMs: number) => {
    // Find the video and switch to it
    const video = videos.find(v => v.id === videoId);
    if (video) {
      setSelectedVideo(video);
      // Set pending seek to resume position (convert ms to seconds)
      setPendingSyncSeek(positionMs / 1000);
    }
  };

  // Handler for score mismatch resolution
  const handleScoreMismatchResolve = async (action: 'use_calculated' | 'use_manual' | 'review') => {
    if (action === 'review') {
      // Scroll to play list or show marker panel
      setShowMarkerPanel(true);
    } else {
      // Reload scores after resolution
      await loadQuarterScoresAndMismatch();
    }
  };

  async function fetchGame() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!error && data) {
      setGame(data);
      if (data.is_opponent_game) {
        setTaggingMode('defense');
      }
      // Set tagging tier from game data
      if (data.tagging_tier) {
        setTaggingTier(data.tagging_tier as TaggingTier);
      } else {
        // No tier set yet - will show selector when user tries to tag
        setTaggingTier(null);
      }
      // Set film analysis status from game data
      if (data.film_analysis_status) {
        setFilmAnalysisStatus(data.film_analysis_status as FilmAnalysisStatus);
      }
    }
  }

  async function fetchVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('game_id', gameId)
      .order('camera_order', { ascending: true }); // Order by camera_order for multi-camera

    if (!error && data) {
      // Generate signed URLs for videos that have file_path but no url
      const videosWithUrls = await Promise.all(
        data.map(async (video) => {
          if (video.file_path && !video.url) {
            console.log('Generating signed URL for:', video.file_path);
            const { data: urlData, error: urlError } = await supabase.storage
              .from('game_videos')
              .createSignedUrl(video.file_path, 3600); // 1 hour expiry

            if (urlError) {
              console.error('Error generating signed URL:', urlError);
            }

            return {
              ...video,
              url: urlData?.signedUrl || video.url
            };
          }
          return video;
        })
      );
      console.log('Videos with URLs:', videosWithUrls);
      setVideos(videosWithUrls);
    } else if (error) {
      console.error('Error fetching videos:', error);
    }
  }

  async function fetchCameraLimit() {
    try {
      const response = await fetch(`/api/teams/${teamId}/games/${gameId}/cameras`);
      if (response.ok) {
        const data = await response.json();
        setCameraLimit(data.cameraLimit || 1);
      }
    } catch (error) {
      console.error('Error fetching camera limit:', error);
    }
  }


  async function fetchPlays() {
    if (!game?.team_id) return;

    const { data, error } = await supabase
      .from('playbook_plays')
      .select('play_code, play_name, attributes')
      .eq('team_id', game.team_id)
      .eq('is_archived', false)
      .order('play_code', { ascending: true });

    if (!error && data) {
      setPlays(data);
    }
  }

  async function fetchPlayers() {
    if (!game?.team_id) return;

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', game.team_id)
      .eq('is_active', true)
      .order('jersey_number', { ascending: true });

    if (!error && data) {
      setPlayers(data);
    }
  }

  async function fetchFormations() {
    if (!game?.team_id) return;

    const { data } = await supabase
      .from('playbook_plays')
      .select('attributes')
      .eq('team_id', game.team_id);

    if (data) {
      const formationSet = new Set<string>();
      data.forEach(play => {
        if (play.attributes?.formation) {
          formationSet.add(play.attributes.formation);
        }
      });
      setFormations(Array.from(formationSet).sort());
    }
  }

  async function fetchAnalyticsTier() {
    if (!game?.team_id) return;

    try {
      const { data, error } = await supabase
        .from('team_analytics_config')
        .select('tier')
        .eq('team_id', game.team_id)
        .single();

      if (data?.tier) {
        setAnalyticsTier(data.tier);
      } else {
        // Default to premium for testing (migration 025 not run yet)
        setAnalyticsTier('premium');
      }
    } catch (err) {
      console.log('Analytics tier table not found, defaulting to premium');
      // Fallback if table doesn't exist (migration 025 not run)
      setAnalyticsTier('premium');
    }
  }

  async function fetchDrives() {
    try {
      const drivesData = await driveService.getDrivesForGame(gameId);
      setDrives(drivesData);

      // Set current drive to the most recent active drive
      if (drivesData.length > 0) {
        const activeDrive = drivesData.find(d => d.result === 'end_half');
        setCurrentDrive(activeDrive || drivesData[drivesData.length - 1]);
      } else {
        setDriveAssignMode('new'); // First drive - auto-set to new mode
      }
    } catch (error) {
      console.error('Error fetching drives:', error);
    }
  }

  // Marker functions
  async function fetchMarkers(videoId: string) {
    try {
      const markersData = await markerService.getMarkersForVideo(videoId);
      setMarkers(markersData);
    } catch (error) {
      console.error('Error fetching markers:', error);
    }
  }

  const handleMarkerClick = (marker: VideoTimelineMarker) => {
    // Open the edit modal for this marker
    setEditingMarker(marker);
  };

  const handleMarkerSeekTo = (timeMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeMs / 1000;
    }
  };

  const handleUpdateMarker = async (markerId: string, updates: { label?: string; virtual_timestamp_start_ms?: number }) => {
    try {
      await markerService.updateMarker(markerId, updates);
      // Refresh markers list
      if (selectedVideo) {
        const updatedMarkers = await markerService.getMarkersForVideo(selectedVideo.id);
        setMarkers(updatedMarkers);
      }
    } catch (error) {
      console.error('Error updating marker:', error);
      alert('Failed to update marker');
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    try {
      await markerService.deleteMarker(markerId);
      // Refresh markers list
      if (selectedVideo) {
        const updatedMarkers = await markerService.getMarkersForVideo(selectedVideo.id);
        setMarkers(updatedMarkers);
      }
    } catch (error) {
      console.error('Error deleting marker:', error);
      alert('Failed to delete marker');
    }
  };

  // Quick add period marker (quarter start/end, game markers)
  const handleQuickPeriodMarker = async (markerType: MarkerType, quarter?: number, label?: string) => {
    if (!selectedVideo) return;

    // Check for duplicate period markers
    const isDuplicate = markers.some(m => {
      // For quarter_end markers, check if same quarter already marked
      if (markerType === 'quarter_end' && m.marker_type === 'quarter_end' && m.quarter === quarter) {
        return true;
      }
      // For halftime, game_start, game_end - only one allowed
      if (['halftime', 'game_start', 'game_end'].includes(markerType) && m.marker_type === markerType) {
        return true;
      }
      // For overtime start, check if same OT period already marked
      if (markerType === 'overtime' && m.marker_type === 'overtime' && m.quarter === quarter) {
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      alert(`A "${label}" marker already exists. Delete the existing one first if you want to change it.`);
      setShowPeriodMarkerMenu(false);
      return;
    }

    try {
      const timestampMs = Math.floor(currentTime * 1000);

      await markerService.createMarker({
        video_id: selectedVideo.id,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label || undefined,
        quarter: quarter
      });

      await fetchMarkers(selectedVideo.id);
      setShowPeriodMarkerMenu(false);
    } catch (error) {
      console.error('Error adding period marker:', error);
    }
  };

  // Quick add non-period marker (big play, turnover, timeout, custom)
  const handleQuickAddMarker = async (markerType: MarkerType, label: string) => {
    if (!selectedVideo) return;

    try {
      const timestampMs = Math.floor(currentTime * 1000);

      await markerService.createMarker({
        video_id: selectedVideo.id,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label
      });

      await fetchMarkers(selectedVideo.id);
      setShowAddMarkerMenu(false);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  };

  const handleCreateMarker = async (markerType: MarkerType, label?: string, quarter?: number) => {
    if (!selectedVideo) return;

    try {
      const timestampMs = Math.floor(currentTime * 1000); // Convert seconds to milliseconds

      await markerService.createMarker({
        video_id: selectedVideo.id,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label,
        quarter: quarter
      });

      await fetchMarkers(selectedVideo.id);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  };

  // Tagging Tier functions
  const handleTierSelect = async (tier: TaggingTier) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ tagging_tier: tier })
        .eq('id', gameId);

      if (error) throw error;

      setTaggingTier(tier);
      setShowTierSelector(false);
      // Refresh game data
      fetchGame();
    } catch (error) {
      console.error('Error setting tagging tier:', error);
      alert('Failed to set tagging tier. Please try again.');
    }
  };

  const handleTierUpgrade = async (newTier: TaggingTier) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ tagging_tier: newTier })
        .eq('id', gameId);

      if (error) throw error;

      setTaggingTier(newTier);
      setShowTierUpgrade(false);
      // Refresh game data
      fetchGame();
    } catch (error) {
      console.error('Error upgrading tagging tier:', error);
      alert('Failed to upgrade tagging tier. Please try again.');
    }
  };

  const handleJumpToMarker = (timestampMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampMs / 1000; // Convert milliseconds to seconds
    }
  };

  /**
   * Determine the quarter based on current timestamp and quarter markers
   * Returns the quarter number (1-4, 5+ for OT) or undefined if no markers exist
   */
  const getQuarterFromTimestamp = (timestampMs: number): number | undefined => {
    // Get quarter-related markers sorted by timestamp
    const quarterMarkers = markers
      .filter(m => ['game_start', 'quarter_start', 'quarter_end', 'halftime', 'game_end'].includes(m.marker_type))
      .sort((a, b) => a.virtual_timestamp_start_ms - b.virtual_timestamp_start_ms);

    if (quarterMarkers.length === 0) {
      return undefined; // No markers, can't determine quarter
    }

    // Find which quarter the timestamp falls in
    // Logic: timestamp is in quarter N if it's after the Q(N-1) end marker and before Q(N) end marker
    let currentQuarter = 1; // Default to Q1

    for (const marker of quarterMarkers) {
      if (timestampMs < marker.virtual_timestamp_start_ms) {
        // We're before this marker, so we're in the current quarter
        break;
      }

      // Update quarter based on marker type
      if (marker.marker_type === 'quarter_end' && marker.quarter) {
        // After Q1 end = Q2, after Q2 end = Q3, etc.
        currentQuarter = marker.quarter + 1;
      } else if (marker.marker_type === 'quarter_start' && marker.quarter) {
        currentQuarter = marker.quarter;
      } else if (marker.marker_type === 'halftime') {
        // After halftime = Q3
        currentQuarter = 3;
      }
    }

    // Cap at reasonable values (1-10 for up to OT6)
    return Math.min(Math.max(currentQuarter, 1), 10);
  };

  async function fetchPlayInstances(videoIds: string[]) {
    if (videoIds.length === 0) {
      setPlayInstances([]);
      return;
    }

    const { data, error } = await supabase
      .from('play_instances')
      .select('*')
      .in('video_id', videoIds)
      .order('timestamp_start', { ascending: true });

    if (!error && data) {
      const instancesWithNames = await Promise.all(
        data.map(async (instance) => {
          if (instance.play_code && !instance.is_opponent_play) {
            const { data: playData } = await supabase
              .from('playbook_plays')
              .select('play_name')
              .eq('play_code', instance.play_code)
              .eq('team_id', instance.team_id)
              .single();

            return {
              ...instance,
              play_name: playData?.play_name || instance.play_code
            };
          }
          return {
            ...instance,
            play_name: instance.play_code || 'Unknown Play'
          };
        })
      );
      setPlayInstances(instancesWithNames);

      // Auto-fix: If there are plays but status is still 'not_started', update to 'in_progress'
      if (instancesWithNames.length > 0 && filmAnalysisStatus === 'not_started') {
        await filmSessionService.updateAnalysisStatus(gameId, 'in_progress');
        setFilmAnalysisStatus('in_progress');
      }
    }
  }

  async function loadVideo(video: Video) {
    // If it's a virtual video, we don't need to load a URL
    if (video.is_virtual) {
      setVideoUrl(''); // Clear URL for virtual videos
      return;
    }

    if (!video.file_path) return;

    const { data } = await supabase.storage
      .from('game_videos')
      .createSignedUrl(video.file_path, 3600);

    if (data?.signedUrl) {
      setVideoUrl(data.signedUrl);
    }
  }

  // Video selection handlers
  function handleToggleVideoSelection(videoId: string) {
    const newSelection = new Set(selectedVideoIds);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideoIds(newSelection);
  }

  function handleCombineVideos() {
    if (selectedVideoIds.size === 0) return;
    setShowCombineModal(true);
  }

  // Camera sync handler
  async function handleSyncCamera(cameraId: string, offsetSeconds: number) {
    try {
      const response = await fetch(`/api/teams/${teamId}/videos/${cameraId}/sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_offset_seconds: offsetSeconds }),
      });

      if (response.ok) {
        // Update local state
        setVideos(prev => prev.map(v =>
          v.id === cameraId ? { ...v, sync_offset_seconds: offsetSeconds } : v
        ));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update sync');
      }
    } catch (error) {
      console.error('Error syncing camera:', error);
      alert('Failed to update sync offset');
    }
  }

  // ========== LANE INITIALIZATION ==========
  // Initialize currentLaneNumber from the selected video when timelineLanes loads
  // This ensures auto-continuation works correctly when page loads with a pre-selected video
  useEffect(() => {
    if (timelineLanes.length > 0 && selectedVideo) {
      const laneForVideo = findLaneForVideo(timelineLanes, selectedVideo.id);
      if (laneForVideo !== null && laneForVideo !== currentLaneNumber) {
        console.log('[LaneInit] Initializing currentLaneNumber from selected video:', {
          selectedVideoId: selectedVideo.id,
          foundLane: laneForVideo,
          previousLane: currentLaneNumber,
        });
        setCurrentLaneNumber(laneForVideo);
      }
    }
  }, [timelineLanes, selectedVideo?.id, currentLaneNumber]);

  // ========== VIRTUAL PLAYBACK (for coverage gaps) ==========

  // Stop any active virtual playback
  function stopVirtualPlayback() {
    if (virtualPlaybackRef.current) {
      clearInterval(virtualPlaybackRef.current);
      virtualPlaybackRef.current = null;
    }
    virtualPlaybackTargetRef.current = null;
    setIsVirtuallyPlaying(false);
  }

  // Start virtual playback (timeline advances without video) until targetMs or a clip is reached
  function startVirtualPlayback(startMs: number, targetMs: number | null) {
    stopVirtualPlayback(); // Clear any existing

    if (targetMs === null) {
      // No target - just show gap, don't advance
      return;
    }

    console.log('[VirtualPlayback] Starting from', startMs, 'to', targetMs);
    virtualPlaybackTargetRef.current = targetMs;
    setIsVirtuallyPlaying(true);

    const startTime = Date.now();
    const startPosition = startMs;

    virtualPlaybackRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newPosition = startPosition + elapsed;

      setGameTimelinePositionMs(newPosition);

      // Check if we've reached a clip on the current lane
      const activeClipInfo = findActiveClipForTime(timelineLanes, currentLaneNumber, newPosition);

      if (activeClipInfo.clip) {
        // Reached a clip - stop virtual playback and load it
        stopVirtualPlayback();
        console.log('[VirtualPlayback] Reached clip:', activeClipInfo.clip.videoId);
        handleCameraSwitch(activeClipInfo.clip.videoId, newPosition);
      } else if (newPosition >= targetMs) {
        // Passed target with no clip - stop
        stopVirtualPlayback();
        console.log('[VirtualPlayback] Reached target, no clip found');
      }
    }, 100); // Update every 100ms
  }

  // Handle camera switch with sync - calculates synced timestamp when switching between cameras
  // Optional overrideGameTime parameter allows caller to specify exact target time (avoids state timing issues)
  function handleCameraSwitch(newCameraId: string, overrideGameTime?: number) {
    // Stop any virtual playback when switching cameras
    stopVirtualPlayback();
    // Debounce rapid clicks (500ms) to prevent double-click issues
    const now = Date.now();
    if (now - lastCameraSwitchTime.current < 500) {
      console.log('[CameraSwitch] Ignoring rapid click, debouncing');
      return;
    }
    lastCameraSwitchTime.current = now;

    console.log('[CameraSwitch] handleCameraSwitch called:', {
      newCameraId,
      overrideGameTime,
      currentSelectedVideoId: selectedVideo?.id,
      currentTargetGameTimeMs: targetGameTimeMs,
      currentPendingCameraId: pendingCameraId,
      timelineLanesCount: timelineLanes.length,
    });

    // First, calculate the game time we want to view (needed before finding correct clip)
    let gameTimeToView: number;
    // If caller provided an explicit target time, use it (avoids React state timing issues)
    if (overrideGameTime !== undefined) {
      gameTimeToView = overrideGameTime;
    } else if (targetGameTimeMs !== null) {
      gameTimeToView = targetGameTimeMs;
    } else if (gameTimelinePositionMs > 0) {
      gameTimeToView = gameTimelinePositionMs;
    } else if (selectedVideo && videoRef.current) {
      gameTimeToView = videoOffsetMs + (videoRef.current.currentTime * 1000);
    } else {
      gameTimeToView = 0;
    }

    console.log('[CameraSwitch] Target game time to view:', gameTimeToView);

    // Find which lane the clicked video belongs to
    let targetLane: CameraLane | undefined;

    // Debug: Log all lanes and their clips
    if (timelineLanes.length === 0) {
      console.warn('[CameraSwitch] WARNING: timelineLanes is empty! Clip-finding will be skipped.');
    } else {
      console.log('[CameraSwitch] Available lanes:', timelineLanes.map(l => ({
        lane: l.lane,
        label: l.label,
        clips: l.clips.map(c => ({
          videoId: c.videoId,
          start: c.lanePositionMs,
          end: c.lanePositionMs + c.durationMs,
        }))
      })));
    }

    for (const lane of timelineLanes) {
      const hasVideo = lane.clips.some(c => c.videoId === newCameraId);
      if (hasVideo) {
        targetLane = lane;
        break;
      }
    }

    if (!targetLane) {
      console.warn('[CameraSwitch] Could not find lane for videoId:', newCameraId);
    } else {
      // Update current lane number (persists across clip switches on same lane)
      setCurrentLaneNumber(targetLane.lane);
    }

    // If the lane has multiple clips, find the clip that covers the target game time
    let actualVideoId = newCameraId;
    let actualClipLanePositionMs: number | null = null; // Track clip position for seek calculation

    if (targetLane && targetLane.clips.length > 1) {
      console.log('[CameraSwitch] Lane has multiple clips:', {
        lane: targetLane.lane,
        label: targetLane.label,
        clipCount: targetLane.clips.length,
        clips: targetLane.clips.map(c => ({
          videoId: c.videoId,
          start: c.lanePositionMs,
          end: c.lanePositionMs + c.durationMs,
        })),
      });

      // Find the clip that covers the target game time
      let foundCoveringClip = false;
      for (const clip of targetLane.clips) {
        const clipStart = clip.lanePositionMs;
        const clipEnd = clip.lanePositionMs + clip.durationMs;

        if (gameTimeToView >= clipStart && gameTimeToView < clipEnd) {
          console.log('[CameraSwitch] Found covering clip:', {
            videoId: clip.videoId,
            clipStart,
            clipEnd,
            gameTimeToView,
          });
          actualVideoId = clip.videoId;
          actualClipLanePositionMs = clipStart;
          foundCoveringClip = true;
          break;
        }
      }

      // If no clip covers the target time, find the closest clip
      // so the "No film available" message shows relevant timing
      if (!foundCoveringClip && targetLane.clips.length > 0) {
        let closestClip = targetLane.clips[0];
        let closestDistance = Infinity;

        for (const clip of targetLane.clips) {
          const clipStart = clip.lanePositionMs;
          const clipEnd = clip.lanePositionMs + clip.durationMs;

          // Calculate distance to clip (0 if inside, otherwise distance to nearest edge)
          let distance: number;
          if (gameTimeToView < clipStart) {
            distance = clipStart - gameTimeToView;
          } else if (gameTimeToView >= clipEnd) {
            distance = gameTimeToView - clipEnd;
          } else {
            distance = 0; // Inside clip (shouldn't happen since we checked above)
          }

          if (distance < closestDistance) {
            closestDistance = distance;
            closestClip = clip;
          }
        }

        console.log('[CameraSwitch] No covering clip found, using closest:', {
          videoId: closestClip.videoId,
          clipStart: closestClip.lanePositionMs,
          clipEnd: closestClip.lanePositionMs + closestClip.durationMs,
          gameTimeToView,
          distance: closestDistance,
        });
        actualVideoId = closestClip.videoId;
        actualClipLanePositionMs = closestClip.lanePositionMs;
      }

      if (actualVideoId !== newCameraId) {
        console.log('[CameraSwitch] Using different clip on same lane:', {
          originalClickedVideoId: newCameraId,
          actualVideoId,
        });
      }
    } else if (targetLane && targetLane.clips.length === 1) {
      // Single clip lane - still need to get the lane position for seek calculation
      actualClipLanePositionMs = targetLane.clips[0].lanePositionMs;
    }

    let newCamera = videos.find(v => v.id === actualVideoId);
    if (!newCamera) {
      // Video not in local array yet (race condition after upload)
      // Store the deferred switch and refresh videos
      console.log('[CameraSwitch] Camera not found in local array, deferring switch and fetching videos:', actualVideoId);
      deferredCameraSwitch.current = { videoId: actualVideoId, gameTime: overrideGameTime };
      fetchVideos();
      return;
    }

    // If clicking the same camera while "No film available" overlay is showing, dismiss it
    if (selectedVideo?.id === actualVideoId && targetGameTimeMs !== null) {
      console.log('[CameraSwitch] Same camera clicked while overlay showing, dismissing overlay');
      setTargetGameTimeMs(null);
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      return;
    }

    // If clicking the same camera (no overlay), do nothing
    if (selectedVideo?.id === actualVideoId) {
      console.log('[CameraSwitch] Same camera clicked, ignoring');
      return;
    }

    // If there's already a pending camera switch, log but continue (allows interrupting)
    if (pendingCameraId !== null) {
      console.log('[CameraSwitch] Interrupting pending switch from:', pendingCameraId);
    }

    // If we have a current video playing and sync offsets are set, calculate the synced time
    if (selectedVideo && videoRef.current) {
      // Show loading state - only when actually SWITCHING cameras (not initial selection)
      setIsSwitchingCamera(true);

      // CRITICAL: Reset video duration to prevent stale data from previous video
      // causing wrong coverage calculations in the overlay
      setVideoDuration(0);
      const currentVideoTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      const currentOffset = selectedVideo.sync_offset_seconds || 0;
      const newOffset = newCamera.sync_offset_seconds || 0;

      console.log('[CameraSwitch] Switching cameras:', {
        gameTimeToView,
        currentVideoId: selectedVideo.id,
        newCameraId: actualVideoId,
        newCameraLabel: newCamera.camera_label,
        actualClipLanePositionMs,
      });
      setTargetGameTimeMs(gameTimeToView);
      setPendingCameraId(actualVideoId); // Track which camera we're switching to

      // Calculate the seek time for the new video
      let seekTime: number;
      if (actualClipLanePositionMs !== null) {
        // For timeline clips, calculate based on clip's position in the timeline
        // seekTime = (gameTimeToView - clipStartPosition) / 1000
        seekTime = (gameTimeToView - actualClipLanePositionMs) / 1000;
        console.log('[CameraSwitch] Timeline seek calculation:', {
          gameTimeToView,
          actualClipLanePositionMs,
          seekTime,
        });
      } else {
        // Fallback: Use old sync_offset based calculation
        // Formula: new_time = current_time + current_offset - new_offset
        seekTime = currentVideoTime + currentOffset - newOffset;
        console.log('[CameraSwitch] Sync offset seek calculation:', {
          currentVideoTime,
          currentOffset,
          newOffset,
          seekTime,
        });
      }

      // Set the pending seek time (will be applied when new video loads)
      setPendingSyncSeek(Math.max(0, seekTime));

      // Remember if we should resume playback after the new video loads
      // Auto-play when:
      // 1. Video was already playing, OR
      // 2. We're switching FROM a "no coverage" overlay (targetGameTimeMs was set), OR
      // 3. Current video is at boundaries (start/end) showing "no film" overlay
      const wasShowingNoFilmOverlay = targetGameTimeMs !== null;
      const atBoundary = videoRef.current && videoDuration > 0 &&
        (videoRef.current.currentTime <= 0.5 || videoRef.current.currentTime >= videoDuration - 0.5);
      setShouldResumePlayback(wasPlaying || wasShowingNoFilmOverlay || atBoundary);
    }

    setSelectedVideo(newCamera);
  }

  // Trigger camera upload from CameraRow
  function handleAddCameraClick() {
    fileInputRef.current?.click();
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!game) {
      alert('Game data not loaded. Please refresh the page and try again.');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeGB = fileSizeMB / 1024;
    const MAX_FILE_SIZE_GB = 5;

    // Check file size limit (5GB max)
    if (fileSizeGB > MAX_FILE_SIZE_GB) {
      alert(`File size (${fileSizeGB.toFixed(1)}GB) exceeds maximum allowed (${MAX_FILE_SIZE_GB}GB).\n\nFor videos over 50 minutes, we recommend compressing to 10-12 Mbps bitrate using:\n• HandBrake (free, handbrake.fr)\n• Your video editing software's export settings`);
      return;
    }

    // Show warning for large files (over 1GB)
    if (fileSizeGB > 1) {
      if (!confirm(`This file is ${fileSizeGB.toFixed(1)}GB. Large files may take a while to upload.\n\nEstimated upload time: ${Math.ceil(fileSizeMB / 10)} - ${Math.ceil(fileSizeMB / 5)} minutes on a good connection.\n\nContinue?`)) {
        return;
      }
    }

    setUploadingVideo(true);
    setUploadProgress(0);
    setUploadDetails(null);
    setUploadStatus('Checking upload permissions...');

    try {
      // Step 1: Pre-flight check with our API (quota, rate limits, file type validation)
      setUploadProgress(2);
      const preflightResponse = await fetch(`/api/teams/${teamId}/videos/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          gameId: game.id,
        }),
      });

      const preflightData = await preflightResponse.json();

      if (!preflightResponse.ok || !preflightData.allowed) {
        const errorMessage = preflightData.message || preflightData.error || 'Upload not allowed';

        // Show user-friendly error based on reason
        if (preflightData.details?.reason === 'quota_exceeded') {
          alert(`Storage quota exceeded.\n\nYou've used ${preflightData.details.used_formatted} of ${preflightData.details.quota_formatted}.\n\nPlease delete some videos to free up space.`);
        } else if (preflightData.details?.reason === 'rate_limited') {
          alert(`Upload rate limit exceeded.\n\nYou've made ${preflightData.details.uploads_this_hour} uploads in the last hour.\nMaximum allowed: ${preflightData.details.max_uploads_per_hour}\n\nPlease wait before uploading more videos.`);
        } else if (preflightData.details?.reason === 'file_too_large') {
          alert(`File is too large.\n\nMaximum file size: ${preflightData.details.max_file_size_formatted}\nYour file: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        } else if (preflightData.details?.reason === 'invalid_file_type') {
          alert(`Invalid file type.\n\nOnly video files are allowed: ${preflightData.details.allowed_extensions?.join(', ')}`);
        } else if (preflightData.details?.reason === 'camera_limit' || preflightData.error === 'camera_limit') {
          alert(`Camera limit reached.\n\nYour plan allows ${preflightData.details?.limit || cameraLimit} camera angle${(preflightData.details?.limit || cameraLimit) === 1 ? '' : 's'} per game.\n\nUpgrade your plan to add more cameras.`);
        } else {
          alert(`Upload not allowed: ${errorMessage}`);
        }
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        setUploadDetails(null);
        return;
      }

      const { uploadId, storagePath } = preflightData;

      // Step 2: Upload to Supabase Storage using resumable upload for large files
      setUploadProgress(5);
      const fileSizeDisplay = fileSizeGB >= 1 ? `${fileSizeGB.toFixed(1)} GB` : `${fileSizeMB.toFixed(1)} MB`;
      setUploadStatus(`Uploading ${file.name} (${fileSizeDisplay})...`);

      // Use resumable upload utility (TUS protocol for files > 100MB)
      const uploadResult = await uploadFile(
        supabase,
        'game_videos',
        storagePath,
        file,
        {
          onProgress: (progress: UploadProgress) => {
            // Map upload progress to 5-90% range (leave room for finalization)
            const mappedProgress = 5 + Math.round(progress.percentage * 0.85);
            setUploadProgress(mappedProgress);

            // Update detailed progress info
            setUploadDetails({
              speed: formatSpeed(progress.speed),
              remaining: progress.remainingTime > 0 ? formatTime(progress.remainingTime) : 'calculating...',
              uploaded: formatBytes(progress.bytesUploaded),
              total: formatBytes(progress.bytesTotal),
            });

            // Update status with progress details
            if (progress.percentage < 100) {
              setUploadStatus(`Uploading: ${progress.percentage}% • ${formatSpeed(progress.speed)}`);
            }
          },
          onError: async (error: Error) => {
            console.error('Upload error:', error);

            // Report upload failure to our API
            await fetch(`/api/teams/${teamId}/videos/upload?uploadId=${uploadId}&reason=storage_error`, {
              method: 'DELETE',
            });

            alert(`Error uploading video: ${error.message}\n\nIf uploading a large file (>1GB), please:\n1. Check your internet connection and try again\n2. Or compress the video to 10-12 Mbps using HandBrake (free)`);
            setUploadingVideo(false);
            setUploadProgress(0);
            setUploadStatus('');
            setUploadDetails(null);
          },
        }
      );

      if (!uploadResult.success) {
        // Error already handled in onError callback
        if (uploadResult.error) {
          console.error('Upload failed:', uploadResult.error);
        }
        return;
      }

      // Step 3: Complete the upload (creates video record and updates storage tracking)
      setUploadProgress(92);
      setUploadStatus('Finalizing upload...');
      setUploadDetails(null);

      const completeResponse = await fetch(`/api/teams/${teamId}/videos/upload`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          storagePath,
          gameId: game.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        console.error('Complete upload error:', completeData);
        alert('Video uploaded but record creation failed. Please refresh the page.');
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        return;
      }

      setUploadProgress(100);
      setUploadStatus('Upload complete!');

      if (completeData.video) {
        setVideos([completeData.video, ...videos]);
        setSelectedVideo(completeData.video);

        // Show success with storage info (brief delay to show 100%)
        setTimeout(() => {
          const storage = completeData.storage;
          if (storage && storage.quota_used_percent >= 80) {
            alert(`Video uploaded successfully!\n\nWarning: You've used ${storage.quota_used_percent}% of your storage quota.`);
          }
          setUploadingVideo(false);
          setUploadProgress(0);
          setUploadStatus('');
          setUploadDetails(null);
        }, 500);
      } else {
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        setUploadDetails(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading video. Please try again or use a smaller file.');
      setUploadingVideo(false);
      setUploadProgress(0);
      setUploadStatus('');
      setUploadDetails(null);
    }
  }

  function handleMarkPlayStart() {
    if (!videoRef.current) return;

    // Check if tagging tier is set - if not, show the tier selector
    if (!taggingTier) {
      setShowTierSelector(true);
      return;
    }

    setTagStartTime(videoRef.current.currentTime);
    setTagEndTime(null);
    setIsSettingEndTime(true);
    if (videoRef.current.paused) {
      videoRef.current.play();
    }
  }

  function handleMarkPlayEnd() {
    if (!videoRef.current) return;
    setTagEndTime(videoRef.current.currentTime);
    setIsSettingEndTime(false);
    setSelectedTacklers([]);
    setPrimaryTacklerId('');

    // Auto-populate quarter from markers based on tag start time
    const timestampMs = Math.floor(tagStartTime * 1000);
    const autoQuarter = getQuarterFromTimestamp(timestampMs);
    if (autoQuarter) {
      setValue('quarter', autoQuarter);
    }

    // Auto-populate down, distance, yard_line from previous play
    const previousPlay = getPreviousPlay();
    const context = calculateNextPlayContext(previousPlay);

    if (context) {
      const fieldsToPopulate: string[] = [];

      setValue('down', context.down);
      fieldsToPopulate.push('down');

      setValue('distance', context.distance);
      fieldsToPopulate.push('distance');

      if (context.yard_line !== undefined) {
        setValue('yard_line', context.yard_line);
        fieldsToPopulate.push('yard_line');
      }

      if (context.hash_mark) {
        setValue('hash_mark', context.hash_mark);
        fieldsToPopulate.push('hash_mark');
      }

      setAutoPopulatedFields(fieldsToPopulate);
    } else {
      // No previous play - clear auto-populated state
      setAutoPopulatedFields([]);
    }

    // Auto-calculate next drive number for "Start New Drive"
    // Drives are tracked separately per team (offense vs defense)
    const possessionType = isTaggingOpponent ? 'defense' : 'offense';
    const teamDrives = drives.filter(d => d.possession_type === possessionType);
    const maxDriveNum = teamDrives.length > 0
      ? Math.max(...teamDrives.map(d => d.drive_number || 0))
      : 0;
    setValue('new_drive_number', maxDriveNum + 1);

    setShowTagModal(true);
    videoRef.current.pause();
  }

  function handleEditInstance(instance: PlayInstance) {
    setEditingInstance(instance);
    setTagStartTime(instance.timestamp_start);
    setTagEndTime(instance.timestamp_end || null);
    // Determine tagging mode based on instance data
    if (instance.special_teams_unit) {
      setTaggingMode('specialTeams');
      setSelectedSpecialTeamsUnit(instance.special_teams_unit);
    } else if (instance.is_opponent_play) {
      setTaggingMode('defense');
    } else {
      setTaggingMode('offense');
    }
    
    if (instance.is_opponent_play) {
      setValue('opponent_play_type', instance.play_code);
      const playerMatch = instance.notes?.match(/Player: (#?\d+)/);
      if (playerMatch) {
        setValue('opponent_player_number', playerMatch[1]);
      }
    } else {
      setValue('play_code', instance.play_code);
      setValue('player_id', instance.player_id);
    }
    
    setValue('formation', instance.formation);
    // Database column is 'result', UI form field is 'result_type'
    setValue('result_type', instance.result || instance.result_type);
    setValue('resulted_in_first_down', instance.resulted_in_first_down);
    setValue('down', instance.down);
    setValue('distance', instance.distance);
    setValue('yard_line', instance.yard_line);
    setValue('hash_mark', instance.hash_mark || '');
    setValue('yards_gained', instance.yards_gained);
    setValue('notes', instance.notes || '');

    // Context fields
    setValue('quarter', instance.quarter);

    // Tier 1 & 2: Player attribution
    setValue('qb_id', instance.qb_id);
    setValue('ball_carrier_id', instance.ball_carrier_id);
    setValue('target_id', instance.target_id);
    setValue('play_type', instance.play_type);
    setValue('direction', instance.direction);

    // Tier 3: Offensive Line
    setValue('lt_id', instance.lt_id);
    setValue('lt_block_result', instance.lt_block_result);
    setValue('lg_id', instance.lg_id);
    setValue('lg_block_result', instance.lg_block_result);
    setValue('c_id', instance.c_id);
    setValue('c_block_result', instance.c_block_result);
    setValue('rg_id', instance.rg_id);
    setValue('rg_block_result', instance.rg_block_result);
    setValue('rt_id', instance.rt_id);
    setValue('rt_block_result', instance.rt_block_result);

    // Tier 3: Defensive tracking
    // Populate tackler selection state (first ID is primary)
    if (instance.tackler_ids && instance.tackler_ids.length > 0) {
      setSelectedTacklers(instance.tackler_ids);
      setPrimaryTacklerId(instance.tackler_ids[0]); // First tackler is primary
    } else {
      setSelectedTacklers([]);
      setPrimaryTacklerId('');
    }

    setValue('tackler_ids', instance.tackler_ids?.join(', ') || '');
    setValue('missed_tackle_ids', instance.missed_tackle_ids?.join(',') || '');
    setValue('pressure_player_ids', instance.pressure_player_ids?.join(',') || '');
    setValue('sack_player_id', instance.sack_player_id);
    setValue('coverage_player_id', instance.coverage_player_id);
    setValue('coverage_result', instance.coverage_result);
    setValue('is_tfl', instance.is_tfl);
    setValue('is_sack', instance.is_sack);
    setValue('is_forced_fumble', instance.is_forced_fumble);
    setValue('is_pbu', instance.is_pbu);
    setValue('is_interception', instance.is_interception);
    setValue('qb_decision_grade', instance.qb_decision_grade);

    // Penalty fields
    setValue('penalty_on_play', instance.penalty_on_play);
    setValue('penalty_type', instance.penalty_type);
    setValue('penalty_yards', instance.penalty_yards);
    setValue('penalty_on_us', instance.penalty_on_us ? 'true' : 'false');
    setValue('penalty_declined', instance.penalty_declined);

    // Clear auto-populated state when editing (values came from DB, not calculated)
    setAutoPopulatedFields([]);

    setShowTagModal(true);
  }

  /**
   * Handle AI predictions received from the AI tagging button
   * Applies predictions to form fields with any confidence (shows color indicator)
   * Color scale: Green (80+), Yellow (60-79), Red (<60)
   */
  function handleAIPredictions(predictions: AITagPredictions, predictionId: string) {
    console.log('[AI Tagging] Received predictions:', predictions);
    console.log('[AI Tagging] Current tagging mode:', taggingMode, 'isTaggingOpponent:', isTaggingOpponent);
    setAiPredictions(predictions);
    setAiError(null);

    // Track which fields were AI-filled and their confidence
    const filledFields: Record<string, number> = {};

    // Helper to set field and track confidence
    const setFieldWithConfidence = (fieldName: string, value: unknown, confidence: number) => {
      setValue(fieldName as keyof PlayTagForm, value as never);
      filledFields[fieldName] = confidence;
      console.log(`[AI Tagging] Set ${fieldName} = ${value} (confidence: ${confidence})`);
    };

    // Play type - different field for opponent vs own team
    if (predictions.play_type?.value !== undefined) {
      const confidence = predictions.play_type.confidence ?? 0;
      if (isTaggingOpponent) {
        // Map AI play type to opponent play type options
        const aiPlayType = predictions.play_type.value.toLowerCase();
        const yardsGained = predictions.yards_gained?.value ?? 0;
        let opponentPlayType = '';

        if (aiPlayType === 'run' || aiPlayType.includes('run')) {
          opponentPlayType = 'Other Run';
        } else if (aiPlayType === 'pass' || aiPlayType.includes('pass')) {
          if (yardsGained <= 5) opponentPlayType = 'Quick Pass (0-5 yds)';
          else if (yardsGained <= 10) opponentPlayType = 'Short Pass (6-10 yds)';
          else if (yardsGained <= 20) opponentPlayType = 'Medium Pass (11-20 yds)';
          else opponentPlayType = 'Deep Pass (20+ yds)';
        } else if (aiPlayType.includes('screen')) {
          opponentPlayType = 'Screen';
        } else if (aiPlayType.includes('rpo')) {
          opponentPlayType = 'RPO';
        }

        if (opponentPlayType) {
          setFieldWithConfidence('opponent_play_type', opponentPlayType, confidence);
        }
      } else {
        setFieldWithConfidence('play_type', predictions.play_type.value, confidence);
      }
    }

    // Direction
    if (predictions.direction?.value !== undefined) {
      setFieldWithConfidence('direction', predictions.direction.value, predictions.direction.confidence ?? 0);
    }

    // Result and yards
    if (predictions.result?.value !== undefined) {
      setFieldWithConfidence('result_type', predictions.result.value, predictions.result.confidence ?? 0);
    }
    if (predictions.yards_gained?.value !== undefined) {
      setFieldWithConfidence('yards_gained', predictions.yards_gained.value, predictions.yards_gained.confidence ?? 0);
    }

    // Formation
    if (predictions.formation?.value !== undefined) {
      setFieldWithConfidence('formation', predictions.formation.value, predictions.formation.confidence ?? 0);
    }

    // Context fields
    if (predictions.down?.value !== undefined) {
      setFieldWithConfidence('down', predictions.down.value, predictions.down.confidence ?? 0);
    }
    if (predictions.distance?.value !== undefined) {
      setFieldWithConfidence('distance', predictions.distance.value, predictions.distance.confidence ?? 0);
    }
    if (predictions.hash?.value !== undefined) {
      setFieldWithConfidence('hash_mark', predictions.hash.value, predictions.hash.confidence ?? 0);
    }

    // Situational flags (only for own team)
    if (!isTaggingOpponent) {
      if (predictions.motion?.value !== undefined) {
        setFieldWithConfidence('has_motion', predictions.motion.value, predictions.motion.confidence ?? 0);
      }
      if (predictions.play_action?.value !== undefined) {
        setFieldWithConfidence('is_play_action', predictions.play_action.value, predictions.play_action.confidence ?? 0);
      }
    }

    // Special teams fields
    if (predictions.special_teams_unit?.value !== undefined) {
      setSelectedSpecialTeamsUnit(predictions.special_teams_unit.value as SpecialTeamsUnit);
      setTaggingMode('specialTeams');
      filledFields['special_teams_unit'] = predictions.special_teams_unit.confidence ?? 0;
    }
    if (predictions.kick_result?.value !== undefined) {
      setFieldWithConfidence('kick_result', predictions.kick_result.value, predictions.kick_result.confidence ?? 0);
    }
    if (predictions.kick_distance?.value !== undefined) {
      setFieldWithConfidence('kick_distance', predictions.kick_distance.value, predictions.kick_distance.confidence ?? 0);
    }
    if (predictions.return_yards?.value !== undefined) {
      setFieldWithConfidence('return_yards', predictions.return_yards.value, predictions.return_yards.confidence ?? 0);
    }
    if (predictions.is_touchback?.value !== undefined) {
      setFieldWithConfidence('is_touchback', predictions.is_touchback.value, predictions.is_touchback.confidence ?? 0);
    }
    if (predictions.is_fair_catch?.value !== undefined) {
      setFieldWithConfidence('is_fair_catch', predictions.is_fair_catch.value, predictions.is_fair_catch.confidence ?? 0);
    }

    // Update the filled fields state to trigger UI update
    setAiFilledFields(filledFields);
    console.log('[AI Tagging] Filled fields with confidence:', filledFields);
  }

  function handleAIError(error: string) {
    console.error('[AI Tagging] Error:', error);
    setAiError(error);
    setAiPredictions(null);
    setAiFilledFields({});
  }

  async function onSubmitTag(values: PlayTagForm) {
    if (!selectedVideo || !game?.team_id) return;

    try {
      // Handle drive creation/assignment
      let driveId: string | undefined;

      if (driveAssignMode === 'new' && values.new_drive_number && values.new_drive_quarter && values.yard_line) {
        // Create new drive - use play's yard line as starting position
        // Auto-detect possession type: defense if tagging opponent play, offense otherwise
        const newDrive = await driveService.createDrive({
          gameId: gameId,
          teamId: game.team_id,
          driveNumber: values.new_drive_number,
          quarter: values.new_drive_quarter,
          startYardLine: values.yard_line,
          possessionType: isTaggingOpponent ? 'defense' : 'offense'
        });
        driveId = newDrive.id;
        setCurrentDrive(newDrive);
        await fetchDrives(); // Refresh drive list
      } else if (driveAssignMode === 'current' && currentDrive) {
        driveId = currentDrive.id;
      } else if (driveAssignMode === 'select' && values.drive_id) {
        driveId = values.drive_id;
      }

      // Prepare tackler_ids array with primary tackler first
      let tacklerIdsArray: string[] | undefined;
      if (isTaggingOpponent && selectedTacklers.length > 0) {
        // Put primary tackler first, then others
        tacklerIdsArray = primaryTacklerId
          ? [primaryTacklerId, ...selectedTacklers.filter(id => id !== primaryTacklerId)]
          : selectedTacklers;
      }

      const instanceData = {
        video_id: selectedVideo.id,
        camera_id: selectedVideo.id, // Camera selected when tagging (same as video_id for now)
        team_id: game.team_id,
        drive_id: driveId,
        timestamp_start: tagStartTime,
        timestamp_end: tagEndTime || undefined,
        is_opponent_play: isTaggingOpponent,

        play_code: taggingMode === 'specialTeams'
          ? `ST-${selectedSpecialTeamsUnit?.toUpperCase() || 'UNKNOWN'}`
          : isTaggingOpponent
            ? (values.opponent_play_type || 'Unknown')
            : (values.play_code || ''),

        formation: values.formation || undefined,
        // IMPORTANT: Database column is 'result', not 'result_type'
        // The form uses result_type for UI, but we map it to result for the database
        result: values.result_type || undefined,
        resulted_in_first_down: values.resulted_in_first_down || false,
        // Turnovers determined by Result dropdown ONLY (not checkboxes)
        is_turnover: values.result_type === 'pass_interception' ||
                     values.result_type === 'fumble_lost',
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

        // Context fields
        quarter: values.quarter ? parseInt(String(values.quarter)) : undefined,

        // Tier 1 & 2: Player attribution (Offense only)
        qb_id: !isTaggingOpponent ? (values.qb_id || undefined) : undefined,
        ball_carrier_id: !isTaggingOpponent ? (values.ball_carrier_id || undefined) : undefined,
        target_id: !isTaggingOpponent ? (values.target_id || undefined) : undefined,
        play_type: !isTaggingOpponent ? (values.play_type || undefined) : undefined,
        direction: !isTaggingOpponent ? (values.direction || undefined) : undefined,

        // Tier 3: Offensive Line (Offense only)
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

        // Tier 3: Defensive tracking (Defense only)
        // Use selectedTacklers state instead of parsing text input
        tackler_ids: tacklerIdsArray,
        missed_tackle_ids: isTaggingOpponent && values.missed_tackle_ids
          ? values.missed_tackle_ids.split(',').map(jersey => {
              const trimmed = jersey.trim().replace('#', '');
              const player = players.find(p => p.jersey_number === trimmed);
              return player?.id;
            }).filter(id => id)
          : undefined,
        pressure_player_ids: isTaggingOpponent && values.pressure_player_ids
          ? values.pressure_player_ids.split(',').map(jersey => {
              const trimmed = jersey.trim().replace('#', '');
              const player = players.find(p => p.jersey_number === trimmed);
              return player?.id;
            }).filter(id => id)
          : undefined,
        sack_player_id: isTaggingOpponent ? (values.sack_player_id || undefined) : undefined,
        coverage_player_id: isTaggingOpponent ? (values.coverage_player_id || undefined) : undefined,
        coverage_result: isTaggingOpponent ? (values.coverage_result || undefined) : undefined,
        is_tfl: isTaggingOpponent ? (values.is_tfl || false) : undefined,
        is_sack: isTaggingOpponent ? (values.is_sack || false) : undefined,
        is_forced_fumble: isTaggingOpponent ? (values.is_forced_fumble || false) : undefined,
        is_pbu: isTaggingOpponent ? (values.is_pbu || false) : undefined,
        // Auto-set is_interception based on Result dropdown
        is_interception: isTaggingOpponent ? (values.result_type === 'pass_interception') : undefined,
        qb_decision_grade: isTaggingOpponent && values.qb_decision_grade !== undefined
          ? parseInt(String(values.qb_decision_grade))
          : undefined,

        // ======================================================================
        // SPECIAL TEAMS TRACKING
        // ======================================================================
        special_teams_unit: taggingMode === 'specialTeams' ? (selectedSpecialTeamsUnit || undefined) : undefined,

        // Kicking plays (Kickoff, Punt, FG, PAT)
        kicker_id: taggingMode === 'specialTeams' && ['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
          ? (values.kicker_id || undefined) : undefined,
        kick_result: taggingMode === 'specialTeams' ? (values.kick_result || undefined) : undefined,
        kick_distance: taggingMode === 'specialTeams' && values.kick_distance
          ? parseInt(String(values.kick_distance)) : undefined,

        // Return plays (Kick Return, Punt Return)
        returner_id: taggingMode === 'specialTeams' && ['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit)
          ? (values.returner_id || undefined) : undefined,
        return_yards: taggingMode === 'specialTeams' && values.return_yards
          ? parseInt(String(values.return_yards)) : undefined,
        is_fair_catch: taggingMode === 'specialTeams' ? (values.is_fair_catch || false) : undefined,
        is_touchback: taggingMode === 'specialTeams' ? (values.is_touchback || false) : undefined,
        is_muffed: taggingMode === 'specialTeams' ? (values.is_muffed || false) : undefined,

        // Punt specific
        punter_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
          ? (values.punter_id || undefined) : undefined,
        punt_type: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
          ? (values.punt_type || undefined) : undefined,
        gunner_tackle_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'punt'
          ? (values.coverage_tackler_id || undefined) : undefined,

        // Kickoff specific
        kickoff_type: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'kickoff'
          ? (values.kickoff_type || undefined) : undefined,

        // Long snapper tracking (Punt, FG, PAT)
        long_snapper_id: taggingMode === 'specialTeams' && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
          ? (values.long_snapper_id || undefined) : undefined,
        snap_quality: taggingMode === 'specialTeams' && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
          ? (values.snap_quality || undefined) : undefined,

        // Holder tracking (FG/PAT)
        holder_id: taggingMode === 'specialTeams' && ['field_goal', 'pat'].includes(selectedSpecialTeamsUnit)
          ? (values.holder_id || undefined) : undefined,

        // Coverage tracking - for kickoffs
        coverage_tackler_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'kickoff'
          ? (values.coverage_tackler_id || undefined) : undefined,

        // FG Block - who blocked the kick
        blocker_id: taggingMode === 'specialTeams' && selectedSpecialTeamsUnit === 'fg_block'
          ? (values.blocker_id || undefined) : undefined,

        // ======================================================================
        // SCORING TRACKING (All modes)
        // ======================================================================
        scoring_type: values.scoring_type || undefined,
        scoring_points: values.scoring_type
          ? (SCORING_TYPES.find(s => s.value === values.scoring_type)?.points || 0)
          : undefined,
        // Also update is_touchdown for backward compatibility
        is_touchdown: values.scoring_type === 'touchdown',
        // Opponent scored flag (for special teams: punt/kickoff returned for TD)
        opponent_scored: values.opponent_scored || false,

        // ======================================================================
        // PENALTY TRACKING (All modes)
        // ======================================================================
        penalty_on_play: values.penalty_type ? true : false,
        penalty_type: values.penalty_type || undefined,
        penalty_yards: values.penalty_yards
          ? parseInt(String(values.penalty_yards))
          : (values.penalty_type ? (PENALTY_TYPES.find(p => p.value === values.penalty_type)?.yards || 0) : undefined),
        penalty_on_us: values.penalty_type ? values.penalty_on_us === 'true' : undefined,
        penalty_declined: values.penalty_declined || false
      };

      // Clean instanceData: convert undefined and empty strings to null for Supabase
      // This prevents CHECK constraint violations when empty strings are sent
      const cleanedData = Object.fromEntries(
        Object.entries(instanceData).map(([key, value]) => [
          key,
          value === undefined || value === '' ? null : value
        ])
      );

      let playInstanceId: string;

      if (editingInstance) {
        const { error } = await supabase
          .from('play_instances')
          .update(cleanedData)
          .eq('id', editingInstance.id);

        if (error) throw error;
        playInstanceId = editingInstance.id;

        // Clear existing participations when editing
        await supabase
          .from('player_participation')
          .delete()
          .eq('play_instance_id', playInstanceId);

        // Recalculate drive stats if drive changed
        if (driveId && editingInstance.drive_id !== driveId) {
          // Recalc old drive if it existed
          if (editingInstance.drive_id) {
            await driveService.recalculateDriveStats(editingInstance.drive_id);
          }
          // Recalc new drive
          await driveService.recalculateDriveStats(driveId);
        } else if (driveId) {
          // Same drive, just recalc it
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

        // Recalculate drive stats after adding new play
        if (driveId) {
          await driveService.recalculateDriveStats(driveId);
        }
      }

      // ======================================================================
      // JUNCTION TABLE: Write player participations
      // ======================================================================
      const participations: any[] = [];

      // OFFENSIVE LINE (Tier 3) - Convert OL columns to junction table
      if (!isTaggingOpponent) {
        const olPositions = [
          { id: values.lt_id, pos: 'ol_lt', result: values.lt_block_result },
          { id: values.lg_id, pos: 'ol_lg', result: values.lg_block_result },
          { id: values.c_id, pos: 'ol_c', result: values.c_block_result },
          { id: values.rg_id, pos: 'ol_rg', result: values.rg_block_result },
          { id: values.rt_id, pos: 'ol_rt', result: values.rt_block_result }
        ];

        olPositions.forEach(({ id, pos, result }) => {
          if (id) {
            participations.push({
              play_instance_id: playInstanceId,
              player_id: id,
              team_id: game.team_id,
              participation_type: pos,
              phase: 'offense',
              result: result || null
            });
          }
        });

        // ======================================================================
        // OFFENSIVE PLAYER PARTICIPATIONS (Unified Model)
        // Write passer, rusher, receiver to player_participation table
        // ======================================================================

        // Prepare denormalized result fields for offensive participations
        const yardsGained = values.yards_gained ? parseInt(String(values.yards_gained)) : null;
        const isTouchdown = values.scoring_type === 'touchdown';
        const isFirstDown = values.resulted_in_first_down || false;
        const isTurnover = values.result_type === 'pass_interception' || values.result_type === 'fumble_lost';

        // Determine if this is a special teams play
        const isSpecialTeamsPlay = taggingMode === 'specialTeams' ||
          ['kick', 'punt', 'pat', 'two_point'].includes(values.play_type || '');

        // Passer (QB)
        if (values.qb_id) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.qb_id,
            team_id: game.team_id,
            participation_type: 'passer',
            phase: 'offense',
            yards_gained: yardsGained,
            is_touchdown: isTouchdown,
            is_first_down: isFirstDown,
            is_turnover: isTurnover
          });
        }

        // Rusher (Ball Carrier) - or Returner for special teams
        if (values.ball_carrier_id) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.ball_carrier_id,
            team_id: game.team_id,
            participation_type: isSpecialTeamsPlay ? 'returner' : 'rusher',
            phase: isSpecialTeamsPlay ? 'special_teams' : 'offense',
            yards_gained: yardsGained,
            is_touchdown: isTouchdown,
            is_first_down: isFirstDown,
            is_turnover: isTurnover
          });
        }

        // Receiver (Target)
        if (values.target_id) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.target_id,
            team_id: game.team_id,
            participation_type: 'receiver',
            phase: 'offense',
            yards_gained: yardsGained,
            is_touchdown: isTouchdown,
            is_first_down: isFirstDown,
            is_turnover: isTurnover
          });
        }
      }

      // DEFENSIVE TRACKING (Tier 3)
      if (isTaggingOpponent) {
        // Tackles - primary vs assists
        if (tacklerIdsArray && tacklerIdsArray.length > 0) {
          tacklerIdsArray.forEach((tacklerId: string) => {
            participations.push({
              play_instance_id: playInstanceId,
              player_id: tacklerId,
              team_id: game.team_id,
              participation_type: tacklerId === primaryTacklerId ? 'primary_tackle' : 'assist_tackle',
              phase: 'defense',
              result: 'made'
            });
          });
        }

        // Missed tackles (NEW - now using UUIDs directly)
        if (values.missed_tackle_ids) {
          const missedIds = values.missed_tackle_ids.split(',').filter(Boolean);

          missedIds.forEach(playerId => {
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'missed_tackle',
              phase: 'defense',
              result: 'missed'
            });
          });
        }

        // Pressures (NEW - now using UUIDs directly)
        if (values.pressure_player_ids) {
          const pressureIds = values.pressure_player_ids.split(',').filter(Boolean);

          pressureIds.forEach(playerId => {
            // Determine result: sack, hurry, or hit
            let result = 'hurry'; // default
            if (values.sack_player_id === playerId) {
              result = 'sack';
            }
            // You can add logic for 'hit' if you have that field

            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'pressure',
              phase: 'defense',
              result
            });
          });
        }

        // Coverage
        if (values.coverage_player_id) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.coverage_player_id,
            team_id: game.team_id,
            participation_type: 'coverage_assignment',
            phase: 'defense',
            result: values.coverage_result || null
          });
        }

        // DL Run Defense (NEW - multi-player tracking)
        if (values.dl_run_defense_players && values.dl_run_defense_data) {
          const playerIds = values.dl_run_defense_players.split(',').filter(Boolean);
          const playerDataMap = JSON.parse(values.dl_run_defense_data || '{}');

          playerIds.forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'dl_run_defense',
              phase: 'defense',
              result: data.result || null,
              metadata: {
                gap_assignment: data.gap || null,
                double_teamed: data.doubleTeamed || false
              }
            });
          });
        }

        // DL Pass Rush (NEW - metadata for existing pressure tracking)
        if (values.dl_pass_rush_data) {
          const playerDataMap = JSON.parse(values.dl_pass_rush_data || '{}');

          // Update existing pressure participations with DL-specific metadata
          Object.keys(playerDataMap).forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            // Find the pressure participation for this player and add metadata
            const pressureParticipation = participations.find(
              p => p.player_id === playerId && p.participation_type === 'pressure'
            );
            if (pressureParticipation) {
              pressureParticipation.metadata = {
                rush_technique: data.rushTechnique || null,
                gap: data.gap || null,
                qb_impact: data.qbImpact || false
              };
            }
          });
        }

        // LB Run Stop (NEW - multi-player tracking)
        if (values.lb_run_stop_players && values.lb_run_stop_data) {
          const playerIds = values.lb_run_stop_players.split(',').filter(Boolean);
          const playerDataMap = JSON.parse(values.lb_run_stop_data || '{}');

          playerIds.forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'lb_run_stop',
              phase: 'defense',
              result: data.result || null,
              metadata: {
                gap_assignment: data.gap || null,
                scrape_exchange: data.scrapeExchange || false
              }
            });
          });
        }

        // LB Pass Coverage (NEW - multi-player tracking)
        if (values.lb_pass_coverage_players && values.lb_pass_coverage_data) {
          const playerIds = values.lb_pass_coverage_players.split(',').filter(Boolean);
          const playerDataMap = JSON.parse(values.lb_pass_coverage_data || '{}');

          playerIds.forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'lb_pass_coverage',
              phase: 'defense',
              result: data.result || null,
              metadata: {
                coverage_zone: data.zone || null
              }
            });
          });
        }

        // DB Run Support (NEW - multi-player tracking)
        if (values.db_run_support_players && values.db_run_support_data) {
          const playerIds = values.db_run_support_players.split(',').filter(Boolean);
          const playerDataMap = JSON.parse(values.db_run_support_data || '{}');

          playerIds.forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'db_run_support',
              phase: 'defense',
              result: data.result || null,
              metadata: {
                force_contain: data.forceContain || false,
                alley_fill: data.alleyFill || false
              }
            });
          });
        }

        // DB Pass Coverage (NEW - multi-player tracking)
        if (values.db_pass_coverage_players && values.db_pass_coverage_data) {
          const playerIds = values.db_pass_coverage_players.split(',').filter(Boolean);
          const playerDataMap = JSON.parse(values.db_pass_coverage_data || '{}');

          playerIds.forEach((playerId: string) => {
            const data = playerDataMap[playerId] || {};
            participations.push({
              play_instance_id: playInstanceId,
              player_id: playerId,
              team_id: game.team_id,
              participation_type: 'db_pass_coverage',
              phase: 'defense',
              result: data.result || null,
              metadata: {
                coverage_zone: data.zone || null,
                alignment: data.alignment || null
              }
            });
          });
        }
      }

      // Add interception participation (from "Intercepted By" dropdown)
      if (values.interception_player_id) {
        participations.push({
          play_instance_id: playInstanceId,
          player_id: values.interception_player_id,
          team_id: game.team_id,
          participation_type: 'interception',
          phase: 'defense',
          result: 'interception',
          metadata: {}
        });
      }

      // Add forced fumble participation (from "Forced By" dropdown)
      if (values.forced_fumble_player_id) {
        participations.push({
          play_instance_id: playInstanceId,
          player_id: values.forced_fumble_player_id,
          team_id: game.team_id,
          participation_type: 'forced_fumble',
          result: 'forced_fumble',
          metadata: {}
        });
      }

      // ======================================================================
      // SPECIAL TEAMS PLAYER PARTICIPATIONS
      // Write kicker, punter, long_snapper, holder, coverage to player_participation
      // ======================================================================
      if (taggingMode === 'specialTeams' && selectedSpecialTeamsUnit) {
        // Prepare special teams result fields
        const stYards = values.return_yards ? parseInt(String(values.return_yards)) :
                        values.kick_distance ? parseInt(String(values.kick_distance)) : null;
        const stTouchdown = values.scoring_type === 'touchdown';
        const stTurnover = values.is_muffed || false;

        // Kicker (for kickoff, field_goal, pat)
        if (values.kicker_id && ['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.kicker_id,
            team_id: game.team_id,
            participation_type: 'kicker',
            phase: 'special_teams',
            yards_gained: values.kick_distance ? parseInt(String(values.kick_distance)) : null,
            is_touchdown: false, // Kicker doesn't score the TD on returns
            result: values.kick_result || null,
            metadata: {
              kick_type: selectedSpecialTeamsUnit,
              kickoff_type: values.kickoff_type || null
            }
          });
        }

        // Punter (for punt)
        if (values.punter_id && selectedSpecialTeamsUnit === 'punt') {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.punter_id,
            team_id: game.team_id,
            participation_type: 'punter',
            phase: 'special_teams',
            yards_gained: values.kick_distance ? parseInt(String(values.kick_distance)) : null,
            result: values.kick_result || null,
            metadata: {
              punt_type: values.punt_type || null
            }
          });
        }

        // Long Snapper (for punt, field_goal, pat)
        if (values.long_snapper_id && ['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.long_snapper_id,
            team_id: game.team_id,
            participation_type: 'long_snapper',
            phase: 'special_teams',
            result: values.snap_quality || null,
            metadata: {}
          });
        }

        // Holder (for field_goal, pat)
        if (values.holder_id && ['field_goal', 'pat'].includes(selectedSpecialTeamsUnit)) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.holder_id,
            team_id: game.team_id,
            participation_type: 'holder',
            phase: 'special_teams',
            result: values.kick_result || null,
            metadata: {}
          });
        }

        // Returner (for kick_return, punt_return) - using returner_id field
        if (values.returner_id && ['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit)) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.returner_id,
            team_id: game.team_id,
            participation_type: 'returner',
            phase: 'special_teams',
            yards_gained: values.return_yards ? parseInt(String(values.return_yards)) : null,
            is_touchdown: stTouchdown,
            is_turnover: stTurnover,
            result: values.kick_result || null,
            metadata: {
              is_fair_catch: values.is_fair_catch || false,
              is_touchback: values.is_touchback || false,
              is_muffed: values.is_muffed || false
            }
          });
        }

        // Coverage Tackler / Gunner (for kickoff, punt coverage)
        if (values.coverage_tackler_id && ['kickoff', 'punt'].includes(selectedSpecialTeamsUnit)) {
          participations.push({
            play_instance_id: playInstanceId,
            player_id: values.coverage_tackler_id,
            team_id: game.team_id,
            participation_type: selectedSpecialTeamsUnit === 'punt' ? 'gunner' : 'coverage_tackle',
            phase: 'special_teams',
            result: 'tackle',
            metadata: {}
          });
        }
      }

      // Batch insert all participations
      if (participations.length > 0) {
        const { error: participationError } = await supabase
          .from('player_participation')
          .insert(participations);

        if (participationError) {
          console.error('Failed to save player participations:', participationError);
          // Don't throw - play instance is saved, participations are supplementary
        }
      }

      // Refresh drives to show updated play counts
      await fetchDrives();

      // Show success notification
      alert(editingInstance ? 'Play updated successfully!' : 'Play saved successfully!');

      // Auto-update film analysis status to 'in_progress' if not started
      if (filmAnalysisStatus === 'not_started') {
        await filmSessionService.updateAnalysisStatus(gameId, 'in_progress');
        setFilmAnalysisStatus('in_progress');
      }

      setShowTagModal(false);
      setEditingInstance(null);
      setSelectedTacklers([]);
      setPrimaryTacklerId('');
      reset();
      // Refresh all plays for the game (use timeline video IDs)
      const timelineVideoIds = [...new Set(timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
      fetchPlayInstances(timelineVideoIds);
    } catch (error: any) {
      alert('Error saving play: ' + error.message);
    }
  }

  // Tackler selection handlers
  function toggleTackler(playerId: string) {
    setSelectedTacklers(prev => {
      if (prev.includes(playerId)) {
        // Removing - clear primary if this was the primary
        if (primaryTacklerId === playerId) {
          setPrimaryTacklerId('');
        }
        return prev.filter(id => id !== playerId);
      } else {
        // Adding - if first tackler, make them primary
        const newSelection = [...prev, playerId];
        if (newSelection.length === 1) {
          setPrimaryTacklerId(playerId);
        }
        return newSelection;
      }
    });
  }

  function setPrimaryTackler(playerId: string) {
    setPrimaryTacklerId(playerId);
  }

  /**
   * Jump to a play timestamp, accounting for sync offset if viewing on a different camera
   * @param timestamp - The timestamp on the original camera where the play was tagged
   * @param endTimestamp - Optional end timestamp
   * @param sourceCameraId - The camera_id where this play was originally tagged (defaults to video_id)
   */
  function jumpToPlay(timestamp: number, endTimestamp?: number, sourceCameraId?: string) {
    if (videoRef.current && selectedVideo) {
      // Calculate synced timestamp if we're viewing on a different camera
      let syncedTimestamp = timestamp;
      let syncedEndTimestamp = endTimestamp;

      if (sourceCameraId && sourceCameraId !== selectedVideo.id) {
        // Find source and target camera sync offsets
        const sourceCamera = videos.find(v => v.id === sourceCameraId);
        const targetCamera = selectedVideo;

        if (sourceCamera && targetCamera) {
          const sourceOffset = sourceCamera.sync_offset_seconds || 0;
          const targetOffset = targetCamera.sync_offset_seconds || 0;

          // Convert: source_timestamp + source_offset = absolute_time
          // target_timestamp = absolute_time - target_offset
          syncedTimestamp = timestamp + sourceOffset - targetOffset;
          if (endTimestamp) {
            syncedEndTimestamp = endTimestamp + sourceOffset - targetOffset;
          }
        }
      }

      // Clamp to valid range
      syncedTimestamp = Math.max(0, syncedTimestamp);
      videoRef.current.currentTime = syncedTimestamp;
      videoRef.current.play();

      if (syncedEndTimestamp) {
        const checkTime = setInterval(() => {
          if (videoRef.current && videoRef.current.currentTime >= syncedEndTimestamp!) {
            videoRef.current.pause();
            clearInterval(checkTime);
          }
        }, 100);
      }
    }
  }

  async function deletePlayInstance(instanceId: string) {
    if (!confirm('Delete this play tag? This cannot be undone.')) return;

    try {
      // Get the play instance to find its drive_id before deleting
      const { data: playInstance } = await supabase
        .from('play_instances')
        .select('drive_id')
        .eq('id', instanceId)
        .single();

      const { error } = await supabase
        .from('play_instances')
        .delete()
        .eq('id', instanceId);

      if (error) throw error;

      // Recalculate drive stats if the play was part of a drive
      if (playInstance?.drive_id) {
        await driveService.recalculateDriveStats(playInstance.drive_id);
        await fetchDrives(); // Refresh drives to show updated play counts
      }

      // Refresh all plays for the game (use timeline video IDs)
      const timelineVideoIds = [...new Set(timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
      fetchPlayInstances(timelineVideoIds);
    } catch (error: any) {
      alert('Error deleting play: ' + error.message);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getPlayColor(index: number): string {
    const colors = ['#000000', '#374151', '#6B7280', '#9CA3AF', '#1F2937', '#4B5563', '#111827', '#030712'];
    return colors[index % colors.length];
  }

  function getDownLabel(value: string): string {
    const down = DOWNS.find(d => d.value === value);
    return down?.label || value;
  }

  function getHashLabel(value: string): string {
    const hash = HASH_MARKS.find(h => h.value === value);
    return hash?.label || value;
  }

  // Helper to render player options with preferred players first, then other players
  function renderPlayerOptions(
    preferredFilter: (p: any) => boolean,
    preferredLabel: string = 'Preferred',
    showPosition: boolean = true,
    excludeIds: string[] = []
  ) {
    const availablePlayers = players.filter(p => !excludeIds.includes(p.id));
    const preferredPlayers = availablePlayers.filter(preferredFilter);
    const otherPlayers = availablePlayers.filter(p => !preferredFilter(p));

    return (
      <>
        {preferredPlayers.length > 0 && (
          <optgroup label={preferredLabel}>
            {preferredPlayers.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}{showPosition ? ` (${getPositionDisplay(player)})` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {otherPlayers.length > 0 && (
          <optgroup label="Other Players">
            {otherPlayers.map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number} {player.first_name} {player.last_name}{showPosition ? ` (${getPositionDisplay(player)})` : ''}
              </option>
            ))}
          </optgroup>
        )}
      </>
    );
  }

  if (!game) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push(`/teams/${teamId}/film`)}
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 mb-4 font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to All Games</span>
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-gray-900">{game.name}</h1>
                  {taggingTier && (
                    <TierBadge
                      tier={taggingTier}
                      size="md"
                      showUpgradeHint={taggingTier !== 'comprehensive'}
                      onClick={taggingTier !== 'comprehensive' ? () => setShowTierUpgrade(true) : undefined}
                    />
                  )}
                </div>
                {game.opponent && (
                  <p className="text-lg text-gray-600 mt-1">vs {game.opponent}</p>
                )}
                <p className="text-gray-500">
                  {game.date ? new Date(game.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'No date set'}
                </p>
              </div>
            </div>
          </div>

          {/* Quarter Scores, Analysis Status, and Resume Button */}
          <div className="mb-6 space-y-4">
            {/* Resume Button */}
            <ResumeTaggingButton
              gameId={gameId}
              currentVideoId={selectedVideo?.id}
              currentPositionMs={currentTime * 1000}
              onResume={handleResumePosition}
            />

            {/* Score Mismatch Warning */}
            {scoreMismatch && scoreMismatch.has_mismatch && !scoreMismatch.mismatch_acknowledged && (
              <ScoreMismatchWarning
                gameId={gameId}
                mismatchResult={scoreMismatch}
                onResolve={handleScoreMismatchResolve}
                onDismiss={() => setScoreMismatch(prev => prev ? { ...prev, mismatch_acknowledged: true } : null)}
                context="film_tagging"
              />
            )}

            {/* Compact Score & Analysis Status Bar */}
            <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
              {/* Score Summary */}
              <div className="flex items-center gap-4">
                {(() => {
                  const teamScore = quarterScores?.calculated?.team?.total ?? quarterScores?.manual?.team?.total;
                  const oppScore = quarterScores?.calculated?.opponent?.total ?? quarterScores?.manual?.opponent?.total;
                  const hasScore = teamScore !== undefined && teamScore !== null;

                  return hasScore ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Score:</span>
                      <span className="font-semibold text-gray-900">{teamScore}</span>
                      <span className="text-gray-400">-</span>
                      <span className="font-semibold text-gray-900">{oppScore ?? 0}</span>
                      {quarterScores?.source === 'manual' && (
                        <span className="text-xs text-gray-500">(manual)</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No score yet</span>
                  );
                })()}
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-sm text-gray-600">{playInstances.length} {playInstances.length === 1 ? 'play' : 'plays'} tagged</span>
                <div className="h-4 w-px bg-gray-300" />
                {/* Storage Usage Indicator */}
                <div className="w-48">
                  <StorageUsageCard teamId={teamId} compact />
                </div>
              </div>

              {/* Film Tagging Status */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    filmAnalysisStatus === 'complete' ? 'bg-green-500' :
                    filmAnalysisStatus === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">
                    {filmAnalysisStatus === 'complete' ? 'Tagging Complete' :
                     filmAnalysisStatus === 'in_progress' ? 'Tagging In Progress' : 'Not Started'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Initialize score inputs from game data when opening modal
                    setFinalScoreInputs({
                      teamScore: game?.team_score?.toString() ?? '',
                      opponentScore: game?.opponent_score?.toString() ?? ''
                    });
                    setShowTaggingCompleteModal(true);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filmAnalysisStatus === 'complete'
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {filmAnalysisStatus === 'complete' ? 'Tagging Complete ✓' : 'Mark Tagging Complete'}
                </button>
              </div>
            </div>
          </div>

          {/* Timeline with Swimlanes - Unified Camera Management */}
          <div className="mb-6">
            <TagPageFilmBridge
              gameId={gameId}
              teamId={teamId}
              gameName={game?.name || ''}
              currentTimeSeconds={gameTimelinePositionMs / 1000}
              isPlaying={isPlaying}
              selectedVideoId={selectedVideo?.id || null}
              videos={videos}
              onTimeChange={(secs) => {
                // secs is the game timeline position in seconds (from the timeline ruler)
                const newGameTimeMs = secs * 1000;
                setGameTimelinePositionMs(newGameTimeMs);

                // Clear any stale targetGameTimeMs when user drags to a new position
                if (targetGameTimeMs !== null && Math.abs(newGameTimeMs - targetGameTimeMs) > 1000) {
                  setTargetGameTimeMs(null);
                  setPendingCameraId(null);
                  setIsSwitchingCamera(false);
                }

                // ========== AUTO-SWITCH CLIPS ==========
                // Check if we need to switch to a different clip on the current lane
                if (timelineLanes.length > 0 && selectedVideo) {
                  const activeClipInfo = findActiveClipForTime(timelineLanes, currentLaneNumber, newGameTimeMs);

                  if (activeClipInfo.clip && activeClipInfo.clip.videoId !== selectedVideo.id) {
                    // Different clip covers this time - auto-switch to it
                    console.log('[AutoSwitch] Timeline drag - switching to clip:', activeClipInfo.clip.videoId);
                    handleCameraSwitch(activeClipInfo.clip.videoId, newGameTimeMs);
                    return; // handleCameraSwitch will handle seeking
                  }

                  if (activeClipInfo.isInGap) {
                    // We're in a gap - if playing, start virtual playback
                    if (isPlaying && activeClipInfo.nextClipStartMs !== null) {
                      console.log('[AutoSwitch] Dragged to gap, starting virtual playback');
                      startVirtualPlayback(newGameTimeMs, activeClipInfo.nextClipStartMs);
                    }
                    // Let the overlay show "no film available"
                    return;
                  }
                }

                // Same clip - just seek within current video
                const videoRelativeTime = secs - (videoOffsetMs / 1000);

                if (videoRef.current && videoRelativeTime >= 0) {
                  const clampedVideoTime = Math.min(videoRelativeTime, videoRef.current.duration || Infinity);
                  videoRef.current.currentTime = clampedVideoTime;
                  setCurrentTime(clampedVideoTime);
                } else {
                  setCurrentTime(Math.max(0, videoRelativeTime));
                }
              }}
              onCameraChange={handleCameraSwitch}
              onPlayStateChange={setIsPlaying}
              onTimelineDurationChange={setTimelineDurationMs}
              onVideoOffsetChange={(offsetMs, durationMs, videoId) => {
                console.log('[TagPage] onVideoOffsetChange called:', { offsetMs, durationMs, videoId });
                setVideoOffsetMs(offsetMs);
                setClipDurationMs(durationMs);
                setOffsetDataVideoId(videoId);
              }}
              onTimelineLanesChange={setTimelineLanes}
            >
              <TagPageUnifiedTimeline
                videos={videos}
                markers={markers}
                onUploadComplete={fetchVideos}
                onMarkerClick={handleMarkerClick}
              />
            </TagPageFilmBridge>

            {/* Hidden file input for camera upload (fallback) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />

            {/* Director's Cut - shown when multiple cameras exist */}
            {videos.filter(v => !v.is_virtual).length > 1 && (
              <div className="mt-3 flex justify-end">
                <DirectorsCut
                  gameId={gameId}
                  teamId={teamId}
                  cameras={videos.filter(v => !v.is_virtual).map(v => ({
                    id: v.id,
                    name: v.name,
                    camera_label: v.camera_label || null,
                    camera_order: v.camera_order || 1,
                    sync_offset_seconds: v.sync_offset_seconds || 0,
                    url: v.url,
                  }))}
                  currentTime={currentTime}
                  selectedCameraId={selectedVideo?.id || null}
                  onCameraSwitch={handleCameraSwitch}
                  isPlaying={isPlaying}
                  videoRef={videoRef}
                />
              </div>
            )}
          </div>

          {/* Virtual/Combined Videos List (if any) */}
          {videos.filter(v => v.is_virtual).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Combined Videos</h3>
              <div className="flex gap-2 flex-wrap">
                {videos.filter(v => v.is_virtual).map((video) => (
                  <button
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedVideo?.id === video.id
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {video.virtual_name || video.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Player */}
            <div className="lg:col-span-2 space-y-6">
              {selectedVideo ? (
                selectedVideo.is_virtual ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      {selectedVideo.virtual_name || selectedVideo.name}
                    </h2>

                    <VirtualVideoPlayer
                      videoGroupId={selectedVideo.video_group_id || selectedVideo.id}
                      onTimeUpdate={(virtualTime, totalDuration) => {
                        setCurrentTime(virtualTime / 1000); // Convert ms to seconds
                        setVideoDuration(totalDuration / 1000);
                      }}
                      onPlayStateChange={(playing) => {
                        setIsPlaying(playing);
                      }}
                      className="w-full h-[600px]"
                    />

                    {/* Play Tagging Controls */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          Current Time: <span className="text-gray-900">{formatTime(currentTime)}</span>
                          {videoDuration > 0 && <span className="text-gray-500"> / {formatTime(videoDuration)}</span>}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!isSettingEndTime ? (
                            <button
                              onClick={handleMarkPlayStart}
                              className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                            >
                              ▶ Mark Start
                            </button>
                          ) : (
                            <>
                              <div className="px-4 py-2 bg-yellow-50 text-yellow-800 rounded font-semibold text-sm border border-yellow-200">
                                Recording from {formatTime(tagStartTime)}
                              </div>
                              <button
                                onClick={handleMarkPlayEnd}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ■ Mark End
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : videoUrl ? (
                  <>
                    {/* Consolidated Marker Strip */}
                    {videoDuration > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Flag size={14} className="text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Game Markers</span>
                            {markers.length > 0 && (
                              <span className="text-xs text-gray-500">({markers.length})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Period Marker Dropdown */}
                            <div className="relative" data-period-menu>
                              <button
                                onClick={() => {
                                  setShowAddMarkerMenu(false);
                                  setShowPeriodMarkerMenu(!showPeriodMarkerMenu);
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                                title="Mark quarter or game period"
                              >
                                <Flag size={12} />
                                Mark Period
                              </button>
                              {showPeriodMarkerMenu && (
                                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                  <div className="p-2">
                                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">GAME</p>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('game_start', 1, 'Game Start')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-green-500" />
                                      Start of Game
                                    </button>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('game_end', undefined, 'Game End')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      End of Game
                                    </button>
                                  </div>
                                  <div className="border-t p-2">
                                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">QUARTERS</p>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('quarter_end', 1, 'End Q1')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                                    >
                                      End of Q1
                                    </button>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('halftime', 2, 'Halftime')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 rounded"
                                    >
                                      Halftime (End Q2)
                                    </button>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('quarter_end', 3, 'End Q3')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                                    >
                                      End of Q3
                                    </button>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('quarter_end', 4, 'End Q4')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                                    >
                                      End of Q4
                                    </button>
                                  </div>
                                  <div className="border-t p-2">
                                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">OVERTIME</p>
                                    <button
                                      onClick={() => handleQuickPeriodMarker('overtime', 5, 'OT Start')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 rounded"
                                    >
                                      Start of Overtime
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Add Marker Dropdown */}
                            <div className="relative" data-add-marker-menu>
                              <button
                                onClick={() => {
                                  setShowPeriodMarkerMenu(false);
                                  setShowAddMarkerMenu(!showAddMarkerMenu);
                                }}
                                className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                                title="Add markers (big play, timeout, etc.)"
                              >
                                + Add Marker
                              </button>
                              {showAddMarkerMenu && (
                                <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                  <div className="p-2">
                                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">MARKERS</p>
                                    <button
                                      onClick={() => handleQuickAddMarker('big_play', 'Big Play')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                      Big Play
                                    </button>
                                    <button
                                      onClick={() => handleQuickAddMarker('turnover', 'Turnover')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      Turnover
                                    </button>
                                    <button
                                      onClick={() => handleQuickAddMarker('timeout', 'Timeout')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      Timeout
                                    </button>
                                    <button
                                      onClick={() => handleQuickAddMarker('custom', 'Custom')}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                                      Custom
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Visual Marker Timeline - uses game timeline duration to match top ruler */}
                        <VideoTimelineMarkers
                          markers={markers}
                          currentTimeMs={currentTime * 1000}
                          durationMs={timelineDurationMs > 0 ? timelineDurationMs : videoDuration * 1000}
                          onMarkerClick={handleMarkerClick}
                        />
                      </div>
                    )}

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedVideo.name}</h2>

                      {/* Camera Selector - right above video for easy switching */}
                      <TimelineCameraSelector
                        gameId={gameId}
                        selectedCameraId={selectedVideo?.id || null}
                        onCameraSwitch={handleCameraSwitch}
                      />

                      {/* Video with "No film available" overlay */}
                      <div className="relative">
                        <video
                          ref={videoRef}
                          src={videoUrl}
                          controls
                          preload="metadata"
                          className="w-full rounded-lg bg-black"
                          style={{ maxHeight: '600px' }}
                          onTimeUpdate={(e) => {
                            const video = e.target as HTMLVideoElement;
                            setCurrentTime(video.currentTime);

                            // Don't update game timeline position during camera switch
                            // (the seek effect will set it correctly after seeking)
                            // ALSO check seekLockRef to prevent race condition where onTimeUpdate
                            // fires right after seek and overwrites the correct gameTimelinePositionMs
                            if (isSwitchingCamera || pendingSyncSeek !== null || seekLockRef.current) {
                              return;
                            }

                            // Only update game timeline position when video is NOT at its end
                            // (to avoid overwriting timeline position when user drags past video end)
                            const isAtVideoEnd = video.duration > 0 && video.currentTime >= video.duration - 0.5;
                            if (!isAtVideoEnd) {
                              setGameTimelinePositionMs(videoOffsetMs + (video.currentTime * 1000));
                            }
                          }}
                          onLoadedMetadata={(e) => {
                            const video = e.target as HTMLVideoElement;
                            setVideoDuration(video.duration);
                          }}
                          onCanPlay={() => {
                            // Video is ready to play - only clear loading if no pending operations
                            // Let the coverage check effect clear it when all data is verified
                            if (pendingSyncSeek === null && pendingCameraId === null) {
                              setIsSwitchingCamera(false);
                            }
                          }}
                          onEnded={() => {
                            // Video ended - find next clip on same camera lane
                            console.log('[VideoEnded] Video playback ended');

                            if (!selectedVideo || timelineLanes.length === 0) {
                              console.log('[VideoEnded] No selected video or timeline lanes');
                              return;
                            }

                            // Find which lane the current video is on (directly from data, not state)
                            let videoLane: CameraLane | undefined;
                            let currentClip: TimelineClip | undefined;

                            for (const lane of timelineLanes) {
                              const clip = lane.clips.find(c => c.videoId === selectedVideo.id);
                              if (clip) {
                                videoLane = lane;
                                currentClip = clip;
                                break;
                              }
                            }

                            console.log('[VideoEnded] Found current clip:', {
                              lane: videoLane?.lane,
                              label: videoLane?.label,
                              clipId: currentClip?.id,
                              clipStart: currentClip?.lanePositionMs,
                              clipDuration: currentClip?.durationMs,
                              allClipsOnLane: videoLane?.clips.map(c => ({
                                videoId: c.videoId,
                                start: c.lanePositionMs,
                                end: c.lanePositionMs + c.durationMs,
                              }))
                            });

                            if (!videoLane || !currentClip) {
                              console.log('[VideoEnded] Could not find current clip in timeline');
                              return;
                            }

                            // Find the next clip on this lane (starts after current clip)
                            const currentClipEnd = currentClip.lanePositionMs + currentClip.durationMs;
                            const otherClips = videoLane.clips.filter(c => c.videoId !== selectedVideo.id);
                            const nextClip = otherClips
                              .filter(c => c.lanePositionMs >= currentClipEnd - 1000) // Small tolerance for back-to-back clips
                              .sort((a, b) => a.lanePositionMs - b.lanePositionMs)[0];

                            console.log('[VideoEnded] Looking for next clip:', {
                              currentClipEnd,
                              otherClipsCount: otherClips.length,
                              nextClip: nextClip ? {
                                videoId: nextClip.videoId,
                                start: nextClip.lanePositionMs,
                              } : null
                            });

                            if (nextClip) {
                              // Auto-switch to next clip on same camera
                              console.log('[VideoEnded] Auto-continuing to next clip:', nextClip.videoId);
                              setGameTimelinePositionMs(nextClip.lanePositionMs);
                              handleCameraSwitch(nextClip.videoId, nextClip.lanePositionMs);
                            } else {
                              // No more clips on this camera - stop
                              console.log('[VideoEnded] No more clips on this camera');
                              setGameTimelinePositionMs(currentClipEnd);
                            }
                          }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => {
                            setIsPlaying(false);
                            // Stop virtual playback when user pauses
                            stopVirtualPlayback();
                          }}
                        />

                        {/* Loading overlay - shows while switching cameras */}
                        {isSwitchingCamera && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-10">
                            <div className="text-center p-8">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-3" />
                              <div className="text-white text-lg font-semibold">
                                Loading camera...
                              </div>
                            </div>
                          </div>
                        )}

                        {/* "No film available" overlay - shows when game time is outside video coverage */}
                        {timelineDurationMs > 0 && !isSwitchingCamera && (() => {
                          // If we're waiting for coverage check (camera just switched), show loading overlay
                          if (pendingCameraId !== null) {
                            return (
                              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                                <div className="text-center p-8">
                                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-3" />
                                  <div className="text-white text-lg font-semibold">
                                    Checking coverage...
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Need video duration to calculate coverage
                          if (videoDuration <= 0) return null;

                          // Use timeline clip data if available, otherwise fall back to video's sync_offset_seconds
                          const syncOffsetMs = (selectedVideo?.sync_offset_seconds || 0) * 1000;
                          const videoStartMs = clipDurationMs > 0 ? videoOffsetMs : syncOffsetMs;
                          // CRITICAL: Use the MINIMUM of clip duration and actual video duration
                          // This handles data mismatches where timeline says 30 min but video is only 194s
                          const actualVideoDurationMs = videoDuration * 1000;
                          const effectiveDurationMs = clipDurationMs > 0
                            ? Math.min(clipDurationMs, actualVideoDurationMs)
                            : actualVideoDurationMs;
                          const videoEndMs = videoStartMs + effectiveDurationMs;

                          // Check if we just switched cameras and the target game time is outside coverage
                          if (targetGameTimeMs !== null) {
                            const targetOutsideCoverage = targetGameTimeMs < videoStartMs || targetGameTimeMs >= videoEndMs;
                            if (targetOutsideCoverage) {
                              return (
                                <div
                                  className="absolute inset-0 bg-black flex items-center justify-center rounded-lg cursor-pointer"
                                  onClick={() => setTargetGameTimeMs(null)}
                                  title="Click to dismiss and view available footage"
                                >
                                  <div className="text-center p-8">
                                    <div className="text-white text-lg font-semibold mb-2">
                                      No film available for this part of the game
                                    </div>
                                    <div className="text-gray-300 text-sm mb-4">
                                      This camera only covers {formatTime(videoStartMs / 1000)} - {formatTime(videoEndMs / 1000)} in the game timeline.
                                    </div>
                                    <div className="text-gray-400 text-sm mb-4">
                                      You were viewing {formatTime(targetGameTimeMs / 1000)} in the game.
                                    </div>
                                    <div className="text-gray-400 text-sm">
                                      Choose a different camera or click to dismiss.
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            // Note: If target is within coverage, the useEffect will clear it
                          }

                          // ========== SIMPLIFIED OVERLAY LOGIC ==========
                          // Navigation between clips is now AUTOMATIC via:
                          // - onTimeChange: auto-switches when user drags timeline
                          // - onEnded: auto-continues to next clip when video ends
                          // - Virtual playback: keeps timeline moving through gaps

                          // Check if we're in a gap (using findActiveClipForTime)
                          const activeClipInfo = timelineLanes.length > 0
                            ? findActiveClipForTime(timelineLanes, currentLaneNumber, gameTimelinePositionMs)
                            : null;

                          // Show gap overlay if in virtual playback mode or timeline is in a gap
                          if (isVirtuallyPlaying || (activeClipInfo && activeClipInfo.isInGap)) {
                            return (
                              <div className="absolute inset-0 bg-black flex items-center justify-center rounded-lg">
                                <div className="text-center p-8">
                                  <div className="text-white text-lg font-semibold mb-2">
                                    No film available at this time
                                  </div>
                                  <div className="text-gray-300 text-sm mb-2">
                                    Game time: {formatTime(gameTimelinePositionMs / 1000)}
                                  </div>
                                  {activeClipInfo?.nextClipStartMs && (
                                    <div className="text-gray-400 text-sm mb-4">
                                      {isVirtuallyPlaying
                                        ? `Playing... next clip at ${formatTime(activeClipInfo.nextClipStartMs / 1000)}`
                                        : `Next clip starts at ${formatTime(activeClipInfo.nextClipStartMs / 1000)}`
                                      }
                                    </div>
                                  )}
                                  {isVirtuallyPlaying && (
                                    <div className="mt-4">
                                      <div className="inline-block animate-pulse w-2 h-2 bg-white rounded-full mr-2" />
                                      <span className="text-gray-300 text-sm">Timeline advancing...</span>
                                    </div>
                                  )}
                                  {!isVirtuallyPlaying && (
                                    <div className="text-gray-500 text-sm mt-4">
                                      Drag timeline or choose a different camera
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </div>

                    <div className="mt-4 space-y-4">
                      {/* Play Instances Timeline - synced with game timeline */}
                      {videoDuration > 0 && (() => {
                        // Calculate game timeline values
                        const gameDurationMs = timelineDurationMs > 0 ? timelineDurationMs : videoDuration * 1000;
                        const gameTimeMs = videoOffsetMs + (currentTime * 1000);
                        const gameDurationSec = gameDurationMs / 1000;

                        // Calculate video's coverage area on the timeline
                        const videoStartPercent = (videoOffsetMs / gameDurationMs) * 100;
                        const videoEndPercent = ((videoOffsetMs + (videoDuration * 1000)) / gameDurationMs) * 100;
                        const videoWidthPercent = videoEndPercent - videoStartPercent;

                        return (
                          <div className="space-y-2">
                            <div className="relative h-12 bg-gray-100 rounded overflow-hidden border border-gray-200">
                              {/* Video coverage area indicator */}
                              {timelineDurationMs > 0 && videoWidthPercent < 100 && (
                                <div
                                  className="absolute top-0 bottom-0 bg-blue-50 border-x border-blue-200"
                                  style={{
                                    left: `${videoStartPercent}%`,
                                    width: `${videoWidthPercent}%`,
                                  }}
                                />
                              )}

                              {/* Playhead - positioned at game time */}
                              <div
                                className="absolute top-0 bottom-0 w-1 bg-red-500 z-20"
                                style={{ left: `${(gameTimeMs / gameDurationMs) * 100}%` }}
                              />

                              {/* Play instances - positioned at game time */}
                              {playInstances.map((instance, index) => {
                                // Convert video timestamps to game timestamps
                                const instanceGameStartMs = videoOffsetMs + (instance.timestamp_start * 1000);
                                const instanceGameEndMs = instance.timestamp_end
                                  ? videoOffsetMs + (instance.timestamp_end * 1000)
                                  : instanceGameStartMs + 1000;

                                const startPercent = (instanceGameStartMs / gameDurationMs) * 100;
                                const endPercent = (instanceGameEndMs / gameDurationMs) * 100;
                                const width = Math.max(endPercent - startPercent, 0.5);

                                return (
                                  <div
                                    key={instance.id}
                                    className="absolute top-0 bottom-0 opacity-70 hover:opacity-100 cursor-pointer group transition-opacity"
                                    style={{
                                      left: `${startPercent}%`,
                                      width: `${width}%`,
                                      backgroundColor: getPlayColor(index)
                                    }}
                                    onClick={() => jumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined, instance.camera_id || instance.video_id)}
                                  >
                                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-30">
                                      {instance.play_code} - {formatTime(instance.timestamp_start)}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Time labels - show game duration */}
                              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-600 pointer-events-none">
                                <span>0:00</span>
                                <span>{formatTime(gameDurationSec)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Controls */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          Current Time: <span className="text-gray-900">{formatTime(currentTime)}</span>
                          {videoDuration > 0 && <span className="text-gray-500"> / {formatTime(videoDuration)}</span>}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!isSettingEndTime ? (
                            <>
                              <button
                                onClick={handleMarkPlayStart}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ▶ Mark Start
                              </button>

                              {/* Marker controls moved to marker strip above video */}
                            </>
                          ) : (
                            <>
                              <div className="px-4 py-2 bg-yellow-50 text-yellow-800 rounded font-semibold text-sm border border-yellow-200">
                                Recording from {formatTime(tagStartTime)}
                              </div>
                              <button
                                onClick={handleMarkPlayEnd}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ■ Mark End
                              </button>
                            </>
                          )}

                          {/* Help tooltip */}
                          <div className="relative group">
                            <button
                              type="button"
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label="How to tag plays"
                            >
                              <HelpCircle size={20} />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <p className="font-semibold mb-2">How to Tag Plays:</p>
                              <ol className="list-decimal list-inside space-y-1 text-gray-200">
                                <li>Click "Mark Start" at the beginning</li>
                                <li>Let the play run</li>
                                <li>Click "Mark End" when finished</li>
                                <li>Fill in details and save</li>
                              </ol>
                              <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marker Panel */}
                  {showMarkerPanel && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <button
                        type="button"
                        onClick={() => setMarkersCollapsed(!markersCollapsed)}
                        className="w-full flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">Video Markers</h3>
                          <span className="text-sm text-gray-600">({markers.length})</span>
                        </div>
                        {markersCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      {!markersCollapsed && (
                        <div className="mt-4">
                          <MarkerList
                            markers={markers}
                            onJumpToMarker={handleJumpToMarker}
                            onDeleteMarker={handleDeleteMarker}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 text-lg mb-4">No video for this game yet</p>
                    <div className="text-center">
                      <label className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 cursor-pointer font-semibold transition-colors">
                        Upload Video
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-4">No videos for this game yet</p>
                  <div className="text-center">
                    <label className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 cursor-pointer font-semibold transition-colors">
                      Upload Video
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Tagged Plays List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Filters */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Quarter Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Quarter
                    </label>
                    <select
                      value={filterQuarter}
                      onChange={(e) => setFilterQuarter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="all">All Quarters</option>
                      <option value="1">1st Quarter</option>
                      <option value="2">2nd Quarter</option>
                      <option value="3">3rd Quarter</option>
                      <option value="4">4th Quarter</option>
                      <option value="OT">Overtime</option>
                    </select>
                  </div>

                  {/* Offense/Defense/Special Teams Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Play Type
                    </label>
                    <select
                      value={filterOffenseDefense}
                      onChange={(e) => setFilterOffenseDefense(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="all">All Plays</option>
                      <option value="offense">Our Offense</option>
                      <option value="defense">Our Defense (Opponent Plays)</option>
                      <option value="specialTeams">Special Teams</option>
                    </select>
                  </div>

                  {/* Drive Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Drive
                    </label>
                    <select
                      value={filterDrive}
                      onChange={(e) => setFilterDrive(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="all">All Drives</option>
                      {drives.map((drive) => (
                        <option key={drive.id} value={drive.id}>
                          Drive #{drive.drive_number} - Q{drive.quarter} - {drive.possession_type === 'offense' ? '🟢 OFF' : '🔴 DEF'} ({drive.result})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(filterQuarter !== 'all' || filterOffenseDefense !== 'all' || filterDrive !== 'all') && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        setFilterQuarter('all');
                        setFilterOffenseDefense('all');
                        setFilterDrive('all');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tagged Plays ({(() => {
                  const filtered = playInstances.filter(instance => {
                    // Quarter filter
                    if (filterQuarter !== 'all' && String(instance.quarter) !== filterQuarter) {
                      return false;
                    }

                    // Offense/Defense/Special Teams filter
                    if (filterOffenseDefense === 'offense' && (instance.is_opponent_play || instance.special_teams_unit)) {
                      return false;
                    }
                    if (filterOffenseDefense === 'defense' && (!instance.is_opponent_play || instance.special_teams_unit)) {
                      return false;
                    }
                    if (filterOffenseDefense === 'specialTeams' && !instance.special_teams_unit) {
                      return false;
                    }

                    // Drive filter
                    if (filterDrive !== 'all' && instance.drive_id !== filterDrive) {
                      return false;
                    }

                    return true;
                  });
                  return filtered.length;
                })()})
              </h3>
              
              {(() => {
                const filteredPlays = playInstances.filter(instance => {
                  // Quarter filter
                  if (filterQuarter !== 'all' && String(instance.quarter) !== filterQuarter) {
                    return false;
                  }

                  // Offense/Defense/Special Teams filter
                  if (filterOffenseDefense === 'offense' && (instance.is_opponent_play || instance.special_teams_unit)) {
                    return false;
                  }
                  if (filterOffenseDefense === 'defense' && (!instance.is_opponent_play || instance.special_teams_unit)) {
                    return false;
                  }
                  if (filterOffenseDefense === 'specialTeams' && !instance.special_teams_unit) {
                    return false;
                  }

                  // Drive filter
                  if (filterDrive !== 'all' && instance.drive_id !== filterDrive) {
                    return false;
                  }

                  return true;
                });

                if (filteredPlays.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <p className="text-gray-600 text-sm">
                        {playInstances.length === 0 ? (
                          <>
                            No plays tagged yet.<br/>
                            Use "Mark Start/End" to tag plays.
                          </>
                        ) : (
                          'No plays match the selected filters.'
                        )}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3">
                      {filteredPlays.map((instance, index) => (
                      <div
                        key={instance.id}
                        className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500">
                                #{index + 1}
                              </span>
                              <span className="font-semibold text-gray-900">{instance.play_code}</span>
                              {instance.special_teams_unit && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                  {SPECIAL_TEAMS_UNITS.find(u => u.value === instance.special_teams_unit)?.label || 'Special Teams'}
                                </span>
                              )}
                              {instance.is_opponent_play && !instance.special_teams_unit && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                                  Opponent
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{instance.play_name}</p>
                          </div>

                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditInstance(instance)}
                              className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deletePlayInstance(instance.id)}
                              className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="text-xs space-y-1 text-gray-700 mb-2">
                          <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-200">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-medium">
                              {formatTime(instance.timestamp_start)}
                              {instance.timestamp_end && ` - ${formatTime(instance.timestamp_end)}`}
                              {instance.timestamp_end && (
                                <span className="text-gray-500 ml-1">
                                  ({Math.round(instance.timestamp_end - instance.timestamp_start)}s)
                                </span>
                              )}
                            </span>
                          </div>

                          {instance.down && instance.distance && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Situation:</span>
                              <span className="font-medium">
                                {getDownLabel(String(instance.down))} & {instance.distance}
                              </span>
                            </div>
                          )}

                          {(instance.result || instance.result_type) && (
                            <div className="bg-white rounded px-2 py-1 border border-gray-200">
                              <span className="text-gray-600">Result:</span>
                              <span className="text-gray-900 font-medium ml-1">
                                {RESULT_TYPES.find(r => r.value === (instance.result || instance.result_type))?.label || (instance.result || instance.result_type)}
                              </span>
                            </div>
                          )}

                          {instance.yards_gained !== null && instance.yards_gained !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Yards:</span>
                              <span className={`font-medium ${instance.yards_gained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {instance.yards_gained > 0 ? '+' : ''}{instance.yards_gained}
                              </span>
                            </div>
                          )}

                          {instance.notes && (
                            <div className="text-gray-700 mt-1 text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                              {instance.notes}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => jumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined, instance.camera_id || instance.video_id)}
                          className="w-full relative overflow-hidden rounded hover:opacity-90 transition-opacity group bg-gray-900"
                        >
                          <div className="w-full h-24 flex items-center justify-center">
                            <div className="bg-white bg-opacity-90 rounded-full p-2 group-hover:bg-opacity-100 transition-all">
                              <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                    </div>

                  </div>
                );
              })()}

              {/* Resume from here button */}
              {playInstances.length > 0 && (
                <button
                  onClick={() => {
                    // Find the last play by timestamp
                    const sortedPlays = [...playInstances].sort((a, b) =>
                      (b.timestamp_end || b.timestamp_start) - (a.timestamp_end || a.timestamp_start)
                    );
                    const lastPlay = sortedPlays[0];
                    if (lastPlay && videoRef.current) {
                      const lastPlayEndTime = lastPlay.timestamp_end || lastPlay.timestamp_start;
                      videoRef.current.currentTime = lastPlayEndTime;
                      videoRef.current.pause();
                    }
                  }}
                  className="w-full mt-4 px-4 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume Tagging
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tag Play Modal - Split Screen */}
      {showTagModal && selectedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => {
            setShowTagModal(false);
            setEditingInstance(null);
            setIsSettingEndTime(false);
            setTaggingMode('offense');
            setSelectedSpecialTeamsUnit('');
            setSelectedTacklers([]);
            setPrimaryTacklerId('');
            setAiPredictions(null);
            setAiFilledFields({});
            setAiError(null);
            reset();
          }}
        >
          <div
            className="bg-white rounded-lg w-[95vw] h-[90vh] max-w-[1800px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingInstance ? 'Edit Play Tag' : 'Tag Play'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {formatTime(tagStartTime)}
                  {tagEndTime && ` - ${formatTime(tagEndTime)}`}
                  {tagEndTime && (
                    <span className="text-gray-900 ml-1">
                      ({Math.round(tagEndTime - tagStartTime)}s)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* AI Tagging Button */}
                {tagEndTime && selectedVideo && (
                  <div className="flex flex-col items-end">
                    <AITaggingButton
                      teamId={teamId}
                      videoId={selectedVideo.id}
                      clipStartSeconds={tagStartTime}
                      clipEndSeconds={tagEndTime}
                      tier={taggingTier || 'quick'}
                      taggingMode={taggingMode as TaggingMode}
                      onPredictionsReceived={handleAIPredictions}
                      onError={handleAIError}
                      disabled={!tagEndTime || (tagEndTime - tagStartTime) < 2}
                    />
                    {aiError && (
                      <p className="text-xs text-red-500 mt-1">{aiError}</p>
                    )}
                    {aiPredictions?.reasoning && (
                      <p className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={aiPredictions.reasoning}>
                        AI: {aiPredictions.reasoning}
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setEditingInstance(null);
                    setIsSettingEndTime(false);
                    setTaggingMode('offense');
                    setSelectedSpecialTeamsUnit('');
                    setSelectedTacklers([]);
                    setPrimaryTacklerId('');
                    setAiPredictions(null);
                    setAiFilledFields({});
                    setAiError(null);
                    reset();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Split Content: Video + Form */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Video Player */}
              {selectedVideo.url ? (
                <VideoClipPlayer
                  videoUrl={selectedVideo.url}
                  startTime={tagStartTime}
                  endTime={tagEndTime || tagStartTime + 10}
                />
              ) : (
                <div className="w-full lg:w-[45%] bg-gray-800 flex items-center justify-center p-6">
                  <div className="text-center text-gray-400">
                    <p className="text-sm">No video URL available</p>
                    <p className="text-xs mt-2">Please upload video or check storage</p>
                  </div>
                </div>
              )}

              {/* Right: Form */}
              <div className="w-full lg:w-[55%] flex flex-col bg-white overflow-y-auto px-8 py-6">
                <form onSubmit={handleSubmit(onSubmitTag)} className="space-y-4">
                  {/* Toggle: Offense vs Defense vs Special Teams */}
            <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {game.is_opponent_game ? 'Tagging Opponent:' : 'Tagging:'}
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setTaggingMode('offense');
                    setSelectedSpecialTeamsUnit('');
                  }}
                  className={taggingMode === 'offense'
                    ? 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                    : 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
                  }
                >
                  Offense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTaggingMode('defense');
                    setSelectedSpecialTeamsUnit('');
                  }}
                  className={taggingMode === 'defense'
                    ? 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                    : 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
                  }
                >
                  Defense
                </button>
                <button
                  type="button"
                  onClick={() => setTaggingMode('specialTeams')}
                  className={taggingMode === 'specialTeams'
                    ? 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                    : 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
                  }
                >
                  Special Teams
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {game.is_opponent_game
                  ? 'Offense = opponent offense, Defense = opponent defense'
                  : taggingMode === 'specialTeams'
                    ? 'Special Teams = kickoffs, punts, field goals, PATs'
                    : 'Offense = your offense, Defense = opponent plays (what your defense faced)'
                }
              </p>
            </div>

            {/* Special Teams Unit Selection */}
            {taggingMode === 'specialTeams' && (
              <div className="mb-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Special Teams Unit
                </label>
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
            )}

            {/* Drive Context - For Offense, Defense, and applicable Special Teams */}
            {!game.is_opponent_game && taggingMode !== 'specialTeams' && (
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
                      <input
                        type="radio"
                        checked={driveAssignMode === 'current'}
                        onChange={() => setDriveAssignMode('current')}
                        className="w-4 h-4 text-gray-900"
                      />
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
                        // Auto-calculate next drive number (per team)
                        const possessionType = isTaggingOpponent ? 'defense' : 'offense';
                        const teamDrives = drives.filter(d => d.possession_type === possessionType);
                        const maxDriveNum = teamDrives.length > 0
                          ? Math.max(...teamDrives.map(d => d.drive_number || 0))
                          : 0;
                        setValue('new_drive_number', maxDriveNum + 1);
                      }}
                      className="w-4 h-4 text-gray-900"
                    />
                    <span className="text-sm font-medium text-gray-900">Start New Drive</span>
                  </label>

                  {drives.length > 1 && (
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={driveAssignMode === 'select'}
                        onChange={() => setDriveAssignMode('select')}
                        className="w-4 h-4 text-gray-900"
                      />
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
                        <input
                          {...register('new_drive_number')}
                          type="number"
                          min="1"
                          defaultValue={drives.length + 1}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                        <select
                          {...register('new_drive_quarter')}
                          defaultValue="1"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        >
                          <option value="1">1st</option>
                          <option value="2">2nd</option>
                          <option value="3">3rd</option>
                          <option value="4">4th</option>
                          <option value="5">OT</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">Starting yard line will be set from play's yard line below</p>
                  </div>
                )}

                {/* Select Different Drive */}
                {driveAssignMode === 'select' && (
                  <div className="mt-3">
                    <select
                      {...register('drive_id')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">Select drive...</option>
                      {drives
                        .filter(drive => drive.possession_type === (isTaggingOpponent ? 'defense' : 'offense'))
                        .map(drive => (
                          <option key={drive.id} value={drive.id}>
                            Drive #{drive.drive_number} - Q{drive.quarter} - {drive.possession_type.toUpperCase()} ({drive.plays_count} plays)
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Situational Context - Down & Distance - VISIBLE FOR OFFENSE/DEFENSE */}
            {taggingMode !== 'specialTeams' && (
            <div className="mb-4 bg-white rounded p-3 border border-gray-200">
              <label className="block text-xs font-semibold text-gray-900 mb-2">Situation</label>

              {/* Down & Distance */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Down</label>
                  <select
                    {...register('down', {
                      onChange: (e) => {
                        handleFieldChange('down');
                        const down = parseInt(e.target.value || '0');

                        // Auto-set distance to 10 for 1st down
                        if (down === 1) {
                          setValue('distance', 10);
                          setValue('resulted_in_first_down', false);
                        } else {
                          // Recalculate first down when down changes
                          const yards = parseInt(String(watch('yards_gained') || '0'));
                          const distance = parseInt(String(watch('distance') || '0'));

                          if (!isNaN(yards) && !isNaN(distance)) {
                            setValue('resulted_in_first_down', yards >= distance);
                          }
                        }
                      }
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Distance</label>
                  <input
                    {...register('distance', {
                      onChange: () => {
                        handleFieldChange('distance');
                        // Recalculate first down when distance changes
                        const yards = parseInt(String(watch('yards_gained') || '0'));
                        const distance = parseInt(String(watch('distance') || '0'));
                        const down = parseInt(String(watch('down') || '0'));

                        if (!isNaN(yards) && !isNaN(distance) && down > 1) {
                          setValue('resulted_in_first_down', yards >= distance);
                        } else if (down === 1) {
                          setValue('resulted_in_first_down', false);
                        }
                      }
                    })}
                    type="number"
                    min="1"
                    max="99"
                    placeholder="10"
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
                    {...register('yard_line', {
                      onChange: () => handleFieldChange('yard_line')
                    })}
                    type="number"
                    min="0"
                    max="100"
                    placeholder="25"
                    className={getFieldClassName('yard_line', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = own goal, 50 = midfield, 100 = opp goal</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hash Mark</label>
                  <select
                    {...register('hash_mark', {
                      onChange: () => handleFieldChange('hash_mark')
                    })}
                    className={getFieldClassName('hash_mark', 'w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900')}
                  >
                    <option value="">-</option>
                    {HASH_MARKS.map(hash => (
                      <option key={hash.value} value={hash.value}>{hash.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto-populated fields legend */}
              {autoPopulatedFields.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                  <span className="inline-block w-3 h-3 bg-blue-50 border border-blue-300 rounded"></span>
                  <span>Auto-calculated from previous play</span>
                </div>
              )}
            </div>
            )}

            {/* Special Teams Form Section */}
            {taggingMode === 'specialTeams' && selectedSpecialTeamsUnit && (
              <div className="mb-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  {SPECIAL_TEAMS_UNITS.find(u => u.value === selectedSpecialTeamsUnit)?.label} Details
                </label>

                {/* Kickoff & Field Goal & PAT: Kicker Selection */}
                {['kickoff', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Kicker</label>
                    <select
                      {...register('kicker_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select kicker...</option>
                      {renderPlayerOptions(p => playerHasPosition(p, 'K'), 'Kickers')}
                    </select>
                  </div>
                )}

                {/* Punt: Punter Selection */}
                {selectedSpecialTeamsUnit === 'punt' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Punter</label>
                    <select
                      {...register('punter_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select punter...</option>
                      {renderPlayerOptions(p => playerHasPosition(p, 'P'), 'Punters')}
                    </select>
                  </div>
                )}

                {/* Return plays: Returner Selection */}
                {['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit) && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Returner</label>
                    <select
                      {...register('returner_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select returner...</option>
                      {renderPlayerOptions(p => playerHasPosition(p, 'KR') || playerHasPosition(p, 'PR'), 'Returners')}
                    </select>
                  </div>
                )}

                {/* FG Block: Blocker Selection */}
                {selectedSpecialTeamsUnit === 'fg_block' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Blocked By</label>
                    <select
                      {...register('blocker_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select player who blocked...</option>
                      {renderPlayerOptions(p => playerHasPosition(p, ['DL', 'LB', 'DE', 'DT', 'NT']), 'Defensive Players')}
                    </select>
                  </div>
                )}

                {/* Kickoff Type */}
                {selectedSpecialTeamsUnit === 'kickoff' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Kickoff Type</label>
                    <select
                      {...register('kickoff_type')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select type...</option>
                      {KICKOFF_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Punt Type */}
                {selectedSpecialTeamsUnit === 'punt' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Punt Type</label>
                    <select
                      {...register('punt_type')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select type...</option>
                      {PUNT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Kick Result - Based on Unit */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Result</label>
                  <select
                    {...register('kick_result', {
                      onChange: (e) => {
                        const result = e.target.value;
                        // Auto-populate scoring based on result and unit type
                        // Punt/Kickoff = we're kicking, opponent returns = opponent scores
                        // Punt Return/Kick Return = we're returning = we score
                        const isKickingUnit = ['punt', 'kickoff'].includes(selectedSpecialTeamsUnit);
                        const isReturningUnit = ['punt_return', 'kick_return'].includes(selectedSpecialTeamsUnit);

                        if (result === 'returned_td' || result === 'blocked_td') {
                          setValue('scoring_type', 'touchdown');
                          setValue('scoring_points', 6);
                          // Opponent scores when they return our punt/kickoff for TD
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
                          // Clear scoring for non-scoring results
                          setValue('scoring_type', '');
                          setValue('scoring_points', undefined);
                          setValue('opponent_scored', false);
                        }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select result...</option>
                    {getKickResultsForUnit(selectedSpecialTeamsUnit).map(result => (
                      <option key={result.value} value={result.value}>{result.label}</option>
                    ))}
                  </select>
                </div>

                {/* Distance/Yards Fields */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Kick Distance for FG/Punt/Kickoff */}
                  {['field_goal', 'punt', 'kickoff'].includes(selectedSpecialTeamsUnit) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {selectedSpecialTeamsUnit === 'field_goal' ? 'FG Distance (yds)' :
                         selectedSpecialTeamsUnit === 'punt' ? 'Gross Punt Yards' : 'Kickoff Distance'}
                      </label>
                      <input
                        {...register('kick_distance')}
                        type="number"
                        min="0"
                        max="99"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        placeholder={selectedSpecialTeamsUnit === 'field_goal' ? '35' : '45'}
                      />
                    </div>
                  )}

                  {/* Return Yards */}
                  {['kick_return', 'punt_return', 'fg_block'].includes(selectedSpecialTeamsUnit) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Return Yards</label>
                      <input
                        {...register('return_yards')}
                        type="number"
                        min="-99"
                        max="109"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        placeholder="25"
                      />
                    </div>
                  )}
                </div>


                {/* Long Snapper - For Punt, FG, PAT */}
                {['punt', 'field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Long Snapper</label>
                      <select
                        {...register('long_snapper_id')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">Select...</option>
                        {renderPlayerOptions(p => playerHasPosition(p, 'LS'), 'Long Snappers')}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Snap Quality</label>
                      <select
                        {...register('snap_quality')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">Select...</option>
                        {SNAP_QUALITY_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Holder - For FG, PAT */}
                {['field_goal', 'pat'].includes(selectedSpecialTeamsUnit) && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Holder</label>
                    <select
                      {...register('holder_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select holder...</option>
                      {renderPlayerOptions(p => playerHasPosition(p, 'H') || playerHasPosition(p, 'P') || playerHasPosition(p, 'QB'), 'Holders')}
                    </select>
                  </div>
                )}

                {/* Coverage Tackler - For Kickoff, Punt */}
                {['kickoff', 'punt'].includes(selectedSpecialTeamsUnit) && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {selectedSpecialTeamsUnit === 'punt' ? 'Gunner/Coverage Tackler' : 'Coverage Tackler'}
                    </label>
                    <select
                      {...register('coverage_tackler_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">Select tackler...</option>
                      {players.map(player => (
                        <option key={player.id} value={player.id}>
                          #{player.jersey_number} {getPlayerDisplayName(player)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scoring Section - For scoring plays */}
                <div className="mt-4 pt-3 border-t border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-900">Scoring</label>
                    {watch('opponent_scored') && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                        Opponent Scores
                      </span>
                    )}
                    {watch('scoring_type') && !watch('opponent_scored') && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                        Your Team Scores
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Score Type</label>
                      <select
                        {...register('scoring_type', {
                          onChange: (e) => {
                            const selectedType = SCORING_TYPES.find(s => s.value === e.target.value);
                            if (selectedType) {
                              setValue('scoring_points', selectedType.points);
                            } else {
                              setValue('scoring_points', undefined);
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">No Score</option>
                        {SCORING_TYPES.map(score => (
                          <option key={score.value} value={score.value}>
                            {score.label} ({score.points} pts)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Points</label>
                      <input
                        {...register('scoring_points')}
                        type="number"
                        min="0"
                        max="8"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-gray-50"
                        readOnly
                      />
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

                {/* Penalty Section */}
                <div className="mt-4 pt-3 border-t border-amber-200">
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      {...register('penalty_on_play')}
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300"
                    />
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
                                if (selectedPenalty) {
                                  setValue('penalty_yards', selectedPenalty.yards);
                                }
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          >
                            <option value="">Select penalty...</option>
                            {PENALTY_TYPES.map((penalty) => (
                              <option key={penalty.value} value={penalty.value}>
                                {penalty.label} ({penalty.yards > 0 ? `${penalty.yards} yds` : 'Spot foul'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Yards</label>
                          <input
                            {...register('penalty_yards')}
                            type="number"
                            min="0"
                            max="99"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-gray-700">Penalty On:</span>
                        <label className="flex items-center gap-1">
                          <input
                            {...register('penalty_on_us')}
                            type="radio"
                            value="true"
                            className="text-gray-900"
                          />
                          <span className="text-xs text-gray-700">Our Team</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            {...register('penalty_on_us')}
                            type="radio"
                            value="false"
                            className="text-gray-900"
                          />
                          <span className="text-xs text-gray-700">Opponent</span>
                        </label>
                      </div>
                      <label className="flex items-center gap-2 mt-2">
                        <input
                          {...register('penalty_declined')}
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-gray-600"
                        />
                        <span className="text-xs text-gray-600">Penalty Declined</span>
                      </label>
                      {watch('penalty_declined') && (
                        <p className="text-xs text-gray-500 italic">
                          Penalty will not affect next play calculations
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Field Position & Quarter for Special Teams */}
            {taggingMode === 'specialTeams' && selectedSpecialTeamsUnit && (
              <div className="mb-4 bg-white rounded p-3 border border-gray-200">
                {/* Only show yard line for punt, punt_return, field_goal, fg_block - not for kickoff, kick_return, pat */}
                {['punt', 'punt_return', 'field_goal', 'fg_block'].includes(selectedSpecialTeamsUnit) ? (
                  <>
                    <label className="block text-xs font-semibold text-gray-900 mb-2">Field Position</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Yard Line</label>
                        <input
                          {...register('yard_line')}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="25"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {['punt_return'].includes(selectedSpecialTeamsUnit) ? 'Where return ended' :
                           '0 = own goal, 50 = midfield'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                        <select
                          {...register('quarter')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          <option value="1">Q1</option>
                          <option value="2">Q2</option>
                          <option value="3">Q3</option>
                          <option value="4">Q4</option>
                          <option value="5">OT</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  /* For kickoff, kick_return, pat - just show Quarter */
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                    <select
                      {...register('quarter')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">-</option>
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                      <option value="5">OT</option>
                    </select>
                  </div>
                )}
              </div>
            )}

              {/* Play Selection - CONDITIONAL - Hide for Special Teams */}
              {taggingMode !== 'specialTeams' && (isTaggingOpponent ? (
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
                      {OPPONENT_PLAY_TYPES.run.map(play => (
                        <option key={play} value={play}>{play}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Pass Plays">
                      {OPPONENT_PLAY_TYPES.pass.map(play => (
                        <option key={play} value={play}>{play}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Special Teams">
                      {OPPONENT_PLAY_TYPES.special.map(play => (
                        <option key={play} value={play}>{play}</option>
                      ))}
                    </optgroup>
                  </select>
                  {errors.opponent_play_type && <p className="text-red-600 text-sm mt-1">{errors.opponent_play_type.message}</p>}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Play <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('play_code', { required: !isTaggingOpponent && 'Please select a play' })}
                    onChange={(e) => {
                      const selectedPlay = plays.find(p => p.play_code === e.target.value);
                      if (selectedPlay?.attributes) {
                        const attrs = selectedPlay.attributes;

                        // Auto-fill formation
                        if (attrs.formation) {
                          setValue('formation', attrs.formation);
                        }

                        // Auto-fill play type (Run/Pass/Screen/etc)
                        if (attrs.playType) {
                          // Map playType to form value format (case-insensitive)
                          const playType = attrs.playType.toLowerCase();
                          if (playType.includes('run')) {
                            setValue('play_type', 'run');
                          } else if (playType.includes('pass')) {
                            setValue('play_type', 'pass');
                          } else if (playType.includes('screen')) {
                            setValue('play_type', 'screen');
                          } else if (playType.includes('rpo')) {
                            setValue('play_type', 'rpo');
                          } else if (playType.includes('trick')) {
                            setValue('play_type', 'trick');
                          }
                        }

                        // Auto-fill direction if available
                        // Direction can come from targetHole or explicit direction attribute
                        if (attrs.targetHole) {
                          // Convert targetHole to direction
                          const hole = attrs.targetHole.toLowerCase();
                          if (hole.includes('left') || hole === '0' || hole === '2' || hole === '4') {
                            setValue('direction', 'left');
                          } else if (hole.includes('right') || hole === '1' || hole === '3' || hole === '5') {
                            setValue('direction', 'right');
                          } else if (hole === '6' || hole === '7' || hole === '8' || hole === '9' || hole.includes('middle')) {
                            setValue('direction', 'middle');
                          }
                        }

                        // Auto-fill QB for pass plays
                        // Check if this is a non-QB passer (trick play like halfback pass)
                        if (attrs.playType?.toLowerCase().includes('pass')) {
                          // If ballCarrier is specified and it's not QB, this is a trick play pass
                          // The ballCarrier field in playbook indicates who has/throws the ball
                          if (attrs.ballCarrier && !attrs.ballCarrier.toUpperCase().includes('QB')) {
                            // Try to find a player at the ballCarrier position
                            const passerPosition = attrs.ballCarrier.toUpperCase();
                            const potentialPasser = players.find(p =>
                              playerHasPosition(p, passerPosition) ||
                              playerHasPosition(p, ['RB', 'FB']) && passerPosition.includes('RB') ||
                              playerHasPosition(p, ['X', 'Y', 'Z']) && passerPosition.includes('WR')
                            );
                            if (potentialPasser) {
                              setValue('qb_id', potentialPasser.id);
                            }
                          } else {
                            // Normal pass play - try to auto-select QB
                            const qb = players.find(p => playerHasPosition(p, 'QB'));
                            if (qb) {
                              setValue('qb_id', qb.id);
                            }
                          }
                        } else {
                          // For run plays, clear QB (it's a run, not a pass)
                          setValue('qb_id', '');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select play...</option>
                    {plays.map(play => (
                      <option key={play.play_code} value={play.play_code}>
                        {play.play_code} - {play.play_name}
                      </option>
                    ))}
                  </select>
                  {errors.play_code && <p className="text-red-600 text-sm mt-1">{errors.play_code.message}</p>}
                </div>
              ))}

              {/* Opponent Player Number - Only for Defense */}
              {isTaggingOpponent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opponent Player Number
                  </label>
                  <input
                    {...register('opponent_player_number')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    placeholder="e.g., #24"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional - jersey number of ball carrier</p>
                </div>
              )}

              {/* Formation - Only for Offense/Defense, not Special Teams */}
              {taggingMode !== 'specialTeams' && (
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
              )}

              {/* Player Performance Section - Only for Offense, not Special Teams */}
              {taggingMode === 'offense' && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Player Performance</h4>

                  {/* Play Type & Direction (Standard+) */}
                  {isFieldVisible('play_type') && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Play Type</label>
                        <select
                          {...register('play_type')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
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
                    {/* QB (Standard+) */}
                    {isFieldVisible('qb_id') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">QB</label>
                        <select
                          {...register('qb_id')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          {renderPlayerOptions(p => playerHasPosition(p, 'QB'), 'Quarterbacks', false)}
                        </select>
                      </div>
                    )}

                    {/* Ball Carrier - Show for Run, RPO, and Trick plays */}
                    {(['run', 'rpo', 'trick', ''].includes(watch('play_type') || '')) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Ball Carrier {watch('play_type') === 'run' && <span className="text-red-600">*</span>}
                        </label>
                        <select
                          {...register('ball_carrier_id')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          {renderPlayerOptions(p => playerHasPosition(p, ['QB', 'RB', 'FB', 'WR']), 'Ball Carriers')}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Who had the ball (RB on runs)</p>
                      </div>
                    )}

                    {/* Target - Show for Pass, Screen, RPO, and Trick plays */}
                    {(['pass', 'screen', 'rpo', 'trick', ''].includes(watch('play_type') || '')) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Target {['pass', 'screen'].includes(watch('play_type') || '') && <span className="text-red-600">*</span>}
                        </label>
                        <select
                          {...register('target_id')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
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
              )}

              {/* Advanced Offensive Position Performance (Comprehensive) - Only for Offense, not Special Teams */}
              {taggingMode === 'offense' && isFieldVisible('qb_decision_grade') && (
                <div className="space-y-3">
                  <QBPerformanceSection register={register} />
                  <RBPerformanceSection register={register} />
                  <WRPerformanceSection register={register} />
                  <OLPerformanceSection register={register} players={players} />
                </div>
              )}

              {/* Basic Defensive Tracking (Quick/Standard) - Only for Defense, not Special Teams */}
              {taggingMode === 'defense' && taggingTier && taggingTier !== 'comprehensive' && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Defensive Players</h4>
                  <p className="text-xs text-gray-600 mb-3">Track which of your players made tackles on this opponent play</p>

                  <div className="space-y-3">
                    {/* Tacklers - Multi-Select with Primary Designation */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Tacklers {selectedTacklers.length > 0 && <span className="text-gray-500">({selectedTacklers.length} selected)</span>}
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Select all players involved in the tackle. Designate one as primary.</p>

                      <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                        {players.filter(p => playerInPositionGroup(p, 'defense')).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No defensive players found</div>
                        ) : (
                          players.filter(p => playerInPositionGroup(p, 'defense')).map(player => {
                            const isSelected = selectedTacklers.includes(player.id);
                            const isPrimary = primaryTacklerId === player.id;

                            return (
                              <div
                                key={player.id}
                                className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                                  isSelected ? 'bg-blue-50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTackler(player.id)}
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label className="flex-1 text-sm text-gray-900 cursor-pointer" onClick={() => toggleTackler(player.id)}>
                                  #{player.jersey_number} {player.first_name} {player.last_name}
                                </label>
                                {isSelected && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="primary-tackler"
                                      checked={isPrimary}
                                      onChange={() => setPrimaryTackler(player.id)}
                                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
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
                  </div>
                </div>
              )}

              {/* Advanced Defensive Performance (Comprehensive) - Only for Defense, not Special Teams */}
              {taggingMode === 'defense' && taggingTier === 'comprehensive' && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Defensive Stats (Comprehensive)</h4>

                  <div className="space-y-3">
                    {/* Tacklers - Multi-Select with Primary Designation */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Tacklers {selectedTacklers.length > 0 && <span className="text-gray-500">({selectedTacklers.length} selected)</span>}
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Select all players involved in the tackle. Designate one as primary.</p>

                      <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                        {players.filter(p => playerInPositionGroup(p, 'defense')).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No defensive players found</div>
                        ) : (
                          players.filter(p => playerInPositionGroup(p, 'defense')).map(player => {
                            const isSelected = selectedTacklers.includes(player.id);
                            const isPrimary = primaryTacklerId === player.id;

                            return (
                              <div
                                key={player.id}
                                className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                                  isSelected ? 'bg-blue-50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTackler(player.id)}
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label className="flex-1 text-sm text-gray-900 cursor-pointer" onClick={() => toggleTackler(player.id)}>
                                  #{player.jersey_number} {player.first_name} {player.last_name}
                                </label>
                                {isSelected && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="primary-tackler-advanced"
                                      checked={isPrimary}
                                      onChange={() => setPrimaryTackler(player.id)}
                                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
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

                    {/* Missed Tackles - NEW */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Missed Tackles {watch('missed_tackle_ids')?.split(',').filter(Boolean).length > 0 && (
                          <span className="text-gray-500">
                            ({watch('missed_tackle_ids')?.split(',').filter(Boolean).length} players)
                          </span>
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
                              <label
                                key={player.id}
                                className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                                  isSelected ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const currentIds = watch('missed_tackle_ids')?.split(',').filter(Boolean) || [];
                                    const newIds = e.target.checked
                                      ? [...currentIds, player.id]
                                      : currentIds.filter(id => id !== player.id);
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

                    {/* Pressure Players & Sacks - NEW (Pass Plays Only) */}
                    {watch('opponent_play_type')?.toLowerCase().includes('pass') && (
                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-700">Pass Rush</label>

                        {/* Pressure Players */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Pressured QB {watch('pressure_player_ids')?.split(',').filter(Boolean).length > 0 && (
                              <span className="text-gray-500">
                                ({watch('pressure_player_ids')?.split(',').filter(Boolean).length} players)
                              </span>
                            )}
                          </label>
                          <p className="text-xs text-gray-500 mb-2">Players who hurried, hit, or sacked the QB</p>

                          <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto">
                            {players.filter(p => playerInPositionGroup(p, 'defense')).length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-500">No defensive players found</div>
                            ) : (
                              players.filter(p => playerInPositionGroup(p, 'defense')).map(player => {
                                const pressureIds = watch('pressure_player_ids')?.split(',').filter(Boolean) || [];
                                const isSelected = pressureIds.includes(player.id);

                                return (
                                  <label
                                    key={player.id}
                                    className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                                      isSelected ? 'bg-red-50' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const currentIds = watch('pressure_player_ids')?.split(',').filter(Boolean) || [];
                                        const newIds = e.target.checked
                                          ? [...currentIds, player.id]
                                          : currentIds.filter(id => id !== player.id);
                                        setValue('pressure_player_ids', newIds.join(','));

                                        // If unchecking and this was the sack player, clear sack player
                                        if (!e.target.checked && watch('sack_player_id') === player.id) {
                                          setValue('sack_player_id', '');
                                        }
                                      }}
                                      className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
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

                        {/* Sack Player - Only show if pressures selected */}
                        {watch('pressure_player_ids')?.split(',').filter(Boolean).length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Sack (if QB was sacked)
                            </label>
                            <select
                              {...register('sack_player_id')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                            >
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

                    {/* Coverage Tracking - NEW (Pass Plays Only) */}
                    {watch('opponent_play_type')?.toLowerCase().includes('pass') && (
                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-700">Coverage</label>

                        {/* Coverage Player */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Player in Coverage
                          </label>
                          <p className="text-xs text-gray-500 mb-2">Defender assigned to cover the target/zone</p>
                          <select
                            {...register('coverage_player_id')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                          >
                            <option value="">-</option>
                            {players
                              .filter(p => playerInPositionGroup(p, 'defense'))
                              .map(player => (
                                <option key={player.id} value={player.id}>
                                  #{player.jersey_number} {player.first_name} {player.last_name} ({getPositionDisplay(player)})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Coverage Result - Only show if coverage player selected */}
                        {watch('coverage_player_id') && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Coverage Result
                            </label>
                            <p className="text-xs text-gray-500 mb-2">What happened on this coverage assignment?</p>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  {...register('coverage_result')}
                                  type="radio"
                                  value="target_allowed"
                                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900">Target Allowed <span className="text-xs text-gray-500">(ball thrown at receiver)</span></span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  {...register('coverage_result')}
                                  type="radio"
                                  value="completion_allowed"
                                  className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                                />
                                <span className="text-sm text-gray-900">Completion Allowed <span className="text-xs text-gray-500">(receiver caught it)</span></span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  {...register('coverage_result')}
                                  type="radio"
                                  value="incompletion"
                                  className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-900">Incompletion <span className="text-xs text-gray-500">(pass defended/dropped)</span></span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  {...register('coverage_result')}
                                  type="radio"
                                  value="interception"
                                  className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-900">Interception <span className="text-xs text-gray-500">(INT by coverage player)</span></span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  {...register('coverage_result')}
                                  type="radio"
                                  value="pass_breakup"
                                  className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-900">Pass Breakup <span className="text-xs text-gray-500">(PBU by coverage player)</span></span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Position-Specific Defensive Performance (Tier 3) */}
                    <div className="space-y-3 pt-4">
                      <DLPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
                      <LBPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
                      <DBPerformanceSection register={register} watch={watch} setValue={setValue} players={players} />
                    </div>

                    {/* Defensive Events - Keep these as quick checkboxes */}
                    <div className="pt-4 border-t border-gray-200">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Big Plays</label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center space-x-2">
                          <input
                            {...register('is_tfl')}
                            type="checkbox"
                            className="w-4 h-4 text-red-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">Tackle for Loss</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            {...register('is_sack')}
                            type="checkbox"
                            className="w-4 h-4 text-red-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">Sack</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            {...register('is_forced_fumble')}
                            type="checkbox"
                            className="w-4 h-4 text-red-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">Forced Fumble</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            {...register('is_pbu')}
                            type="checkbox"
                            className="w-4 h-4 text-red-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">Pass Breakup</span>
                        </label>
                        {/* Interception removed - use "Pass - Interception" in Result dropdown instead */}
                      </div>

                      {/* Player Attribution for Big Plays */}
                      {watch('is_forced_fumble') && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Forced By <span className="text-red-600">*</span>
                          </label>
                          <select
                            {...register('forced_fumble_player_id')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                          >
                            <option value="">Select player...</option>
                            {players
                              ?.filter(p => ['DL', 'LB', 'DB', 'S', 'CB'].some(pos => p.primary_position?.includes(pos)))
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

              {/* QB Evaluation - For evaluating opposing QB (shows for defensive plays only) */}
              {isTaggingOpponent && watch('opponent_play_type')?.toLowerCase().includes('pass') && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900">Opponent QB Evaluation</label>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">QB Decision Grade</label>
                    <select
                      {...register('qb_decision_grade')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="">-</option>
                      {QB_DECISION_GRADES.map(grade => (
                        <option key={grade.value} value={grade.value}>{grade.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Grade the opponent QB's decision-making on this play</p>
                  </div>
                </div>
              )}

              {/* Result Type - Only for Offense/Defense, Special Teams uses kick_result */}
              {taggingMode !== 'specialTeams' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Result <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('result_type', { required: taggingMode !== 'specialTeams' ? 'Please select result' : false })}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('result_type')}`}
                  >
                    <option value="">Select result...</option>
                    {RESULT_TYPES.map(result => (
                      <option key={result.value} value={result.value}>{result.label}</option>
                    ))}
                  </select>
                  {errors.result_type && <p className="text-red-600 text-sm mt-1">{errors.result_type.message}</p>}
                </div>
              )}

              {/* Intercepted By - shows when Pass-Interception is selected */}
              {isTaggingOpponent && watch('result_type') === 'pass_interception' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intercepted By <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('interception_player_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select player...</option>
                    {players
                      ?.filter(p => ['DL', 'LB', 'DB', 'S', 'CB'].some(pos => p.primary_position?.includes(pos)))
                      .map(player => (
                        <option key={player.id} value={player.id}>
                          #{player.jersey_number} {player.first_name} {player.last_name} ({player.primary_position})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select the defensive player who intercepted the pass</p>
                </div>
              )}

              {/* Yards Gained - Only for Offense/Defense, Special Teams uses return_yards/kick_distance */}
              {taggingMode !== 'specialTeams' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yards Gained</label>
                  <input
                    {...register('yards_gained', {
                      onChange: (e) => {
                        const yards = parseInt(e.target.value);
                        const distance = parseInt(String(watch('distance') || '0'));
                        const down = parseInt(String(watch('down') || '0'));

                        // Only auto-check first down if:
                        // 1. It's 2nd, 3rd, or 4th down (not 1st down - you can't result in first down if already on 1st)
                        // 2. Yards gained >= distance needed
                        if (!isNaN(yards) && !isNaN(distance) && down > 1) {
                          setValue('resulted_in_first_down', yards >= distance);
                        } else if (down === 1) {
                          // If it's 1st down, this play can't "result in" a first down
                          setValue('resulted_in_first_down', false);
                        }
                      }
                    })}
                    type="number"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 ${getAIConfidenceClass('yards_gained')}`}
                    placeholder="Negative for loss, positive for gain"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-checks if down is 2nd-4th and yards ≥ distance</p>
                </div>
              )}

              {/* First Down Checkbox - Only for Offense/Defense */}
              {taggingMode !== 'specialTeams' && (
                <div className="flex items-center space-x-2">
                  <input
                    {...register('resulted_in_first_down')}
                    type="checkbox"
                    id="first-down"
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded"
                  />
                  <label htmlFor="first-down" className="text-sm font-medium text-gray-700">
                    Resulted in First Down
                  </label>
                </div>
              )}

              {/* Score - For all tiers, visible for offense/defense */}
              {taggingMode !== 'specialTeams' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                  <select
                    {...register('scoring_type', {
                      onChange: (e) => {
                        const selectedType = SCORING_TYPES.find(s => s.value === e.target.value);
                        if (selectedType) {
                          setValue('scoring_points', selectedType.points);
                        } else {
                          setValue('scoring_points', undefined);
                        }
                      }
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
              )}

              {/* Penalty - For all tiers, visible for offense/defense */}
              {taggingMode !== 'specialTeams' && (
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
                      }
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

                  {/* Penalty details - only show when penalty is selected */}
                  {watch('penalty_type') && (
                    <div className="pl-4 border-l-2 border-yellow-400 space-y-2">
                      <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700">Penalty On:</label>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-1">
                            <input
                              {...register('penalty_on_us')}
                              type="radio"
                              value="true"
                              className="text-gray-900"
                            />
                            <span className="text-sm text-gray-700">Our Team</span>
                          </label>
                          <label className="flex items-center space-x-1">
                            <input
                              {...register('penalty_on_us')}
                              type="radio"
                              value="false"
                              className="text-gray-900"
                            />
                            <span className="text-sm text-gray-700">Opponent</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Penalty Yards</label>
                          <input
                            {...register('penalty_yards')}
                            type="number"
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md text-gray-900"
                            placeholder="Yards"
                          />
                        </div>
                        <label className="flex items-center gap-2 mt-4">
                          <input
                            {...register('penalty_declined')}
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-gray-600"
                          />
                          <span className="text-sm text-gray-600">Declined</span>
                        </label>
                      </div>
                      {watch('penalty_declined') && (
                        <p className="text-xs text-gray-500 italic">
                          Penalty will not affect next play's down, distance, or field position
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="Optional notes..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTagModal(false);
                    setEditingInstance(null);
                    setIsSettingEndTime(false);
                    setTaggingMode('offense');
                    setSelectedSpecialTeamsUnit('');
                    setSelectedTacklers([]);
                    setPrimaryTacklerId('');
                    reset();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-semibold"
                >
                  {editingInstance ? 'Update Play' : 'Tag Play'}
                </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combine Videos Modal */}
      {showCombineModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCombineModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <CombineVideosModal
            gameId={gameId}
            selectedVideos={videos.filter(v => selectedVideoIds.has(v.id))}
            onCombined={(virtualVideoId) => {
              setShowCombineModal(false);
              setSelectedVideoIds(new Set()); // Clear selection
              fetchVideos(); // Refresh video list
              // Auto-select the newly created virtual video
              setTimeout(() => {
                const virtualVideo = videos.find(v => v.id === virtualVideoId);
                if (virtualVideo) {
                  setSelectedVideo(virtualVideo);
                }
              }, 500);
            }}
            onClose={() => setShowCombineModal(false)}
          />
          </div>
        </div>
      )}

      {/* Edit Marker Modal */}
      <EditMarkerModal
        isOpen={editingMarker !== null}
        marker={editingMarker}
        currentVideoTimeMs={currentTime * 1000}
        onClose={() => setEditingMarker(null)}
        onUpdate={handleUpdateMarker}
        onDelete={handleDeleteMarker}
        onSeekTo={handleMarkerSeekTo}
      />

      {/* Tagging Tier Selector Modal */}
      <TierSelectorModal
        isOpen={showTierSelector}
        onSelect={handleTierSelect}
        gameName={game?.name}
      />

      {/* Tagging Tier Upgrade Modal */}
      {taggingTier && (
        <TierUpgradeModal
          isOpen={showTierUpgrade}
          currentTier={taggingTier}
          playsTaggedCount={playInstances.length}
          onConfirm={handleTierUpgrade}
          onCancel={() => setShowTierUpgrade(false)}
        />
      )}

      {/* Film Tagging Complete Confirmation Modal */}
      {showTaggingCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {filmAnalysisStatus === 'complete' ? 'Edit Film Tagging?' : 'Mark Film Tagging Complete?'}
            </h3>

            {filmAnalysisStatus !== 'complete' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Important:</strong> By marking film tagging complete, you are confirming this game is ready for analytics.
                </p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Current Status:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• {playInstances.length} plays tagged</li>
                <li>• {(() => {
                  const count = new Set(timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId))).size;
                  return `${count} video${count !== 1 ? 's' : ''} on timeline`;
                })()}</li>
              </ul>
            </div>

            {/* Final Score Input - only show when marking complete */}
            {filmAnalysisStatus !== 'complete' && (
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Final Score <span className="text-red-500">*</span>
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Your Team</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={finalScoreInputs.teamScore}
                      onChange={(e) => setFinalScoreInputs(prev => ({ ...prev, teamScore: e.target.value }))}
                      placeholder="0"
                      className={`w-full px-3 py-2 text-center text-lg font-semibold border rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 ${
                        finalScoreInputs.teamScore === '' ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <span className="text-gray-400 text-lg font-medium pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{game?.opponent || 'Opponent'}</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={finalScoreInputs.opponentScore}
                      onChange={(e) => setFinalScoreInputs(prev => ({ ...prev, opponentScore: e.target.value }))}
                      placeholder="0"
                      className={`w-full px-3 py-2 text-center text-lg font-semibold border rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 ${
                        finalScoreInputs.opponentScore === '' ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
                {(finalScoreInputs.teamScore === '' || finalScoreInputs.opponentScore === '') && (
                  <p className="mt-2 text-xs text-red-600">Please enter the final score for both teams</p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600 mb-4">
              {filmAnalysisStatus === 'complete'
                ? 'This will allow you to continue tagging plays. While editing, analytics for this game will be hidden until you mark it complete again.'
                : 'Game analytics and season totals will only include games marked as complete. You can edit later if you need to make changes.'}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTaggingCompleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const newStatus = filmAnalysisStatus === 'complete' ? 'in_progress' : 'complete';

                  // Save scores when marking complete
                  if (newStatus === 'complete') {
                    const teamScore = parseInt(finalScoreInputs.teamScore, 10);
                    const opponentScore = parseInt(finalScoreInputs.opponentScore, 10);
                    await filmSessionService.updateGameScore(gameId, teamScore, opponentScore);

                    // Update local game state with new scores
                    if (game) {
                      setGame({
                        ...game,
                        team_score: teamScore,
                        opponent_score: opponentScore,
                        game_result: teamScore > opponentScore ? 'win' : teamScore < opponentScore ? 'loss' : 'tie'
                      });
                    }
                  }

                  await filmSessionService.updateAnalysisStatus(gameId, newStatus);
                  setFilmAnalysisStatus(newStatus);
                  if (newStatus === 'complete') {
                    loadQuarterScoresAndMismatch();
                  }
                  setShowTaggingCompleteModal(false);
                }}
                disabled={filmAnalysisStatus !== 'complete' && (finalScoreInputs.teamScore === '' || finalScoreInputs.opponentScore === '')}
                className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${
                  filmAnalysisStatus === 'complete'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : filmAnalysisStatus !== 'complete' && (finalScoreInputs.teamScore === '' || finalScoreInputs.opponentScore === '')
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {filmAnalysisStatus === 'complete' ? 'Resume Editing' : 'Mark Tagging Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}