'use client';

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from '@/components/AuthGuard';
import { useForm } from "react-hook-form";
import { createClient } from '@/utils/supabase/client';
import { COMMON_ATTRIBUTES, OPPONENT_PLAY_TYPES } from '@/config/footballConfig';
import {
  RESULT_TYPES,
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
import AddMarkerModal from '@/components/film/AddMarkerModal';
import CameraRow from '@/components/film/CameraRow';
import DirectorsCut from '@/components/film/DirectorsCut';
import { VideoMarkerService } from '@/lib/services/video-marker.service';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { Flag } from 'lucide-react';
import { uploadFile, formatBytes, formatTime, formatSpeed, type UploadProgress } from '@/lib/utils/resumable-upload';

interface Game {
  id: string;
  name: string;
  opponent?: string;
  date?: string;
  team_id: string;
  is_opponent_game?: boolean;
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
  { value: 'trick', label: 'Trick Play' },
  { value: 'kick', label: 'Kick' },
  { value: 'pat', label: 'PAT' },
  { value: 'two_point', label: '2-Point Conversion' }
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

  // Helper for backwards compatibility - is it a defensive play (opponent has the ball)?
  const isTaggingOpponent = taggingMode === 'defense';
  const [selectedTacklers, setSelectedTacklers] = useState<string[]>([]);
  const [primaryTacklerId, setPrimaryTacklerId] = useState<string>('');

  // Filter state
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterOffenseDefense, setFilterOffenseDefense] = useState<string>('all');
  const [filterDrive, setFilterDrive] = useState<string>('all');

  // Marker state
  const [markers, setMarkers] = useState<VideoTimelineMarker[]>([]);
  const [showMarkerPanel, setShowMarkerPanel] = useState(false);
  const [showAddMarkerModal, setShowAddMarkerModal] = useState(false);
  const markerService = new VideoMarkerService();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayTagForm>();

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

  useEffect(() => {
    if (selectedVideo) {
      loadVideo(selectedVideo);
      fetchPlayInstances(selectedVideo.id);
      fetchMarkers(selectedVideo.id);
    } else if (videos.length > 0) {
      setSelectedVideo(videos[0]);
    }
  }, [selectedVideo, videos]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      // If there's a pending seek from camera switch, apply it now
      if (pendingSyncSeek !== null) {
        video.currentTime = Math.max(0, Math.min(pendingSyncSeek, video.duration));
        setPendingSyncSeek(null);
        // Resume playback if the video was playing before the switch
        if (shouldResumePlayback) {
          video.play();
          setShouldResumePlayback(false);
        }
      }
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
  }, [selectedVideo, pendingSyncSeek, shouldResumePlayback]);

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
    if (videoRef.current) {
      // Convert milliseconds to seconds
      videoRef.current.currentTime = marker.virtual_timestamp_start_ms / 1000;
    }
  };

  const handleAddMarkerAtCurrentTime = () => {
    setShowAddMarkerModal(true);
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

  const handleDeleteMarker = async (markerId: string) => {
    if (!selectedVideo) return;

    try {
      await markerService.deleteMarker(markerId);
      await fetchMarkers(selectedVideo.id);
    } catch (error) {
      console.error('Error deleting marker:', error);
    }
  };

  const handleJumpToMarker = (timestampMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampMs / 1000; // Convert milliseconds to seconds
    }
  };

  async function fetchPlayInstances(videoId: string) {
    const { data, error } = await supabase
      .from('play_instances')
      .select('*')
      .eq('video_id', videoId)
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

  // Handle camera switch with sync - calculates synced timestamp when switching between cameras
  function handleCameraSwitch(newCameraId: string) {
    const newCamera = videos.find(v => v.id === newCameraId);
    if (!newCamera) return;

    // If we have a current video playing and sync offsets are set, calculate the synced time
    if (selectedVideo && videoRef.current) {
      const currentVideoTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      const currentOffset = selectedVideo.sync_offset_seconds || 0;
      const newOffset = newCamera.sync_offset_seconds || 0;

      // Convert current time to "absolute" time, then to new camera's time
      // Formula: new_time = current_time + current_offset - new_offset
      const syncedTime = currentVideoTime + currentOffset - newOffset;

      // Set the pending seek time (will be applied when new video loads)
      setPendingSyncSeek(Math.max(0, syncedTime));

      // Remember if we should resume playback after the new video loads
      setShouldResumePlayback(wasPlaying);
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
    setValue('result_type', instance.result_type);
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

    setShowTagModal(true);
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
        result_type: values.result_type || undefined,
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

        // Penalty tracking (special teams)
        penalty_on_play: taggingMode === 'specialTeams' ? (values.penalty_on_play || false) : undefined,
        penalty_type: taggingMode === 'specialTeams' && values.penalty_on_play ? (values.penalty_type || undefined) : undefined,
        penalty_yards: taggingMode === 'specialTeams' && values.penalty_on_play && values.penalty_yards
          ? parseInt(String(values.penalty_yards)) : undefined
      };

      let playInstanceId: string;

      if (editingInstance) {
        const { error } = await supabase
          .from('play_instances')
          .update(instanceData)
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
          .insert([instanceData])
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
              result: result || null
            });
          }
        });
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

      setShowTagModal(false);
      setEditingInstance(null);
      setSelectedTacklers([]);
      setPrimaryTacklerId('');
      reset();
      fetchPlayInstances(selectedVideo.id);
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

      if (selectedVideo) {
        fetchPlayInstances(selectedVideo.id);
      }
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
                <h1 className="text-3xl font-semibold text-gray-900">{game.name}</h1>
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

              <div>
                {uploadingVideo ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-64">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-right">
                        {uploadProgress}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{uploadStatus}</p>
                    {uploadDetails && (
                      <div className="flex gap-4 text-xs text-gray-400">
                        <span>{uploadDetails.uploaded} / {uploadDetails.total}</span>
                        <span>{uploadDetails.speed}</span>
                        {uploadDetails.remaining !== 'calculating...' && (
                          <span>{uploadDetails.remaining} remaining</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer font-semibold transition-colors">
                    + Add Video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Camera Row - Multi-Camera View */}
          <div className="mb-6">
            <CameraRow
              cameras={videos.filter(v => !v.is_virtual).map(v => ({
                id: v.id,
                name: v.name,
                camera_label: v.camera_label || null,
                camera_order: v.camera_order || 1,
                sync_offset_seconds: v.sync_offset_seconds || 0,
                thumbnail_url: v.thumbnail_url || null,
                upload_status: v.upload_status || 'ready',
                duration_seconds: v.duration_seconds || null,
                url: v.url,
              }))}
              selectedCameraId={selectedVideo?.id || null}
              onSelectCamera={handleCameraSwitch}
              onAddCamera={handleAddCameraClick}
              onSyncCamera={handleSyncCamera}
              cameraLimit={cameraLimit}
              currentCameraCount={videos.filter(v => !v.is_virtual).length}
              isUploading={uploadingVideo}
              uploadProgress={uploadProgress}
            />
            {/* Hidden file input for camera upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />

            {/* Director's Cut - placed below CameraRow when multiple cameras exist */}
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
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedVideo.name}</h2>

                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: '600px' }}
                        onTimeUpdate={(e) => {
                          const video = e.target as HTMLVideoElement;
                          setCurrentTime(video.currentTime);
                        }}
                        onLoadedMetadata={(e) => {
                          const video = e.target as HTMLVideoElement;
                          setVideoDuration(video.duration);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />

                    <div className="mt-4 space-y-4">
                      {/* Timeline */}
                      {videoDuration > 0 && (
                        <div className="space-y-2">
                          {/* Video Markers */}
                          <VideoTimelineMarkers
                            markers={markers}
                            currentTimeMs={currentTime * 1000}
                            durationMs={videoDuration * 1000}
                            onMarkerClick={handleMarkerClick}
                          />

                          <div className="relative h-12 bg-gray-100 rounded overflow-hidden border border-gray-200">
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-red-500 z-20"
                              style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                            />

                            {playInstances.map((instance, index) => {
                            const startPercent = (instance.timestamp_start / videoDuration) * 100;
                            const endPercent = instance.timestamp_end 
                              ? (instance.timestamp_end / videoDuration) * 100 
                              : startPercent + 1;
                            const width = endPercent - startPercent;
                            
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
                          
                          <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-600 pointer-events-none">
                            <span>0:00</span>
                            <span>{formatTime(videoDuration)}</span>
                          </div>
                        </div>
                        </div>
                      )}

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
                              <button
                                onClick={handleAddMarkerAtCurrentTime}
                                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-semibold transition-colors flex items-center gap-2"
                                title="Add marker at current time"
                              >
                                <Flag size={16} />
                                Add Marker
                              </button>
                              <button
                                onClick={() => setShowMarkerPanel(!showMarkerPanel)}
                                className={`px-4 py-3 rounded-md font-semibold transition-colors flex items-center gap-2 ${
                                  showMarkerPanel
                                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                                title="Toggle marker panel"
                              >
                                <Flag size={16} />
                                Markers {markers.length > 0 && `(${markers.length})`}
                              </button>
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
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-gray-50 border-l-4 border-gray-900 p-4 rounded">
                    <h4 className="font-semibold text-gray-900 mb-2">How to Tag Plays:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      <li>Click "Mark Start" at the beginning of a play</li>
                      <li>Let the video play through the entire play</li>
                      <li>Click "Mark End" when the play finishes</li>
                      <li>Fill in play details and save</li>
                    </ol>
                  </div>

                  {/* Marker Panel */}
                  {showMarkerPanel && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Video Markers</h3>
                        <span className="text-sm text-gray-600">{markers.length} marker{markers.length !== 1 ? 's' : ''}</span>
                      </div>
                      <MarkerList
                        markers={markers}
                        onJumpToMarker={handleJumpToMarker}
                        onDeleteMarker={handleDeleteMarker}
                      />
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
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
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
                        
                        {instance.result_type && (
                          <div className="bg-white rounded px-2 py-1 border border-gray-200">
                            <span className="text-gray-600">Result:</span> 
                            <span className="text-gray-900 font-medium ml-1">
                              {RESULT_TYPES.find(r => r.value === instance.result_type)?.label || instance.result_type}
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
                );
              })()}
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
              <button
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
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                      onChange={() => setDriveAssignMode('new')}
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
                      onChange: () => {
                        // Recalculate first down when down changes
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
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
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
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-3">Yards needed for 1st down or TD</p>

              {/* Yard Line & Hash Mark */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Yard Line</label>
                  <input
                    {...register('yard_line')}
                    type="number"
                    min="0"
                    max="100"
                    placeholder="25"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = own goal, 50 = midfield, 100 = opp goal</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hash Mark</label>
                  <select
                    {...register('hash_mark')}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                  >
                    <option value="">-</option>
                    {HASH_MARKS.map(hash => (
                      <option key={hash.value} value={hash.value}>{hash.label}</option>
                    ))}
                  </select>
                </div>
              </div>
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
                      {players
                        .filter(p => playerHasPosition(p, 'K'))
                        .map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      <optgroup label="All Players">
                        {players.map(player => (
                          <option key={`all-${player.id}`} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </optgroup>
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
                      {players
                        .filter(p => playerHasPosition(p, 'P'))
                        .map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      <optgroup label="All Players">
                        {players.map(player => (
                          <option key={`all-${player.id}`} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </optgroup>
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
                      {players
                        .filter(p => playerHasPosition(p, 'KR') || playerHasPosition(p, 'PR'))
                        .map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      <optgroup label="All Players">
                        {players.map(player => (
                          <option key={`all-${player.id}`} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </optgroup>
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
                      {players
                        .filter(p => playerHasPosition(p, ['DL', 'LB', 'DE', 'DT', 'NT']))
                        .map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      <optgroup label="All Players">
                        {players.map(player => (
                          <option key={`all-${player.id}`} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </optgroup>
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
                    {...register('kick_result')}
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

                {/* Return Options: Fair Catch, Touchback, Muffed */}
                {['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit) && (
                  <div className="flex flex-wrap gap-4 mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        {...register('is_fair_catch')}
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Fair Catch</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        {...register('is_touchback')}
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Touchback</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        {...register('is_muffed')}
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Muffed</span>
                    </label>
                  </div>
                )}

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
                        {players
                          .filter(p => playerHasPosition(p, 'LS'))
                          .map(player => (
                            <option key={player.id} value={player.id}>
                              #{player.jersey_number} {getPlayerDisplayName(player)}
                            </option>
                          ))}
                        <optgroup label="All Players">
                          {players.map(player => (
                            <option key={`all-${player.id}`} value={player.id}>
                              #{player.jersey_number} {getPlayerDisplayName(player)}
                            </option>
                          ))}
                        </optgroup>
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
                      {players
                        .filter(p => playerHasPosition(p, 'H') || playerHasPosition(p, 'P') || playerHasPosition(p, 'QB'))
                        .map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      <optgroup label="All Players">
                        {players.map(player => (
                          <option key={`all-${player.id}`} value={player.id}>
                            #{player.jersey_number} {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </optgroup>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Type</label>
                        <input
                          {...register('penalty_type')}
                          type="text"
                          placeholder="e.g., Holding"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Yards</label>
                        <input
                          {...register('penalty_yards')}
                          type="number"
                          min="0"
                          max="99"
                          placeholder="10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Yard Line for Special Teams */}
            {taggingMode === 'specialTeams' && selectedSpecialTeamsUnit && (
              <div className="mb-4 bg-white rounded p-3 border border-gray-200">
                <label className="block text-xs font-semibold text-gray-900 mb-2">Field Position</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Yard Line</label>
                    <input
                      {...register('yard_line')}
                      type="number"
                      min="0"
                      max="100"
                      placeholder={selectedSpecialTeamsUnit === 'kickoff' ? '35' : '25'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedSpecialTeamsUnit === 'kickoff' ? 'Where ball was kicked from' :
                       ['kick_return', 'punt_return'].includes(selectedSpecialTeamsUnit) ? 'Where return ended' :
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    placeholder="e.g., Shotgun Spread, I-Formation"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from playbook when available</p>
                </div>
              )}

              {/* Player Performance Section (All Tiers) - Only for Offense, not Special Teams */}
              {taggingMode === 'offense' && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Player Performance</h4>

                  {/* Play Type & Direction (Tier 2+) */}
                  {(analyticsTier === 'plus' || analyticsTier === 'premium') && (
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
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
                        <select
                          {...register('direction')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          {DIRECTIONS.map(dir => (
                            <option key={dir.value} value={dir.value}>{dir.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Player Attribution */}
                  <div className="space-y-2">
                    {/* QB (Tier 2+) */}
                    {(analyticsTier === 'plus' || analyticsTier === 'premium') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">QB</label>
                        <select
                          {...register('qb_id')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          {players.filter(p => playerHasPosition(p, 'QB')).map(player => (
                            <option key={player.id} value={player.id}>
                              #{player.jersey_number} {player.first_name} {player.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Ball Carrier (All Tiers) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Ball Carrier <span className="text-red-600">*</span>
                      </label>
                      <select
                        {...register('ball_carrier_id')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">-</option>
                        {players.map(player => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {player.first_name} {player.last_name} ({getPositionDisplay(player)})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Who had the ball (RB on runs, WR on catches)</p>
                    </div>

                    {/* Target (Tier 2+) */}
                    {(analyticsTier === 'plus' || analyticsTier === 'premium') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Target (Pass Plays)</label>
                        <select
                          {...register('target_id')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                        >
                          <option value="">-</option>
                          {players.filter(p => playerHasPosition(p, ['WR', 'TE', 'RB'])).map(player => (
                            <option key={player.id} value={player.id}>
                              #{player.jersey_number} {player.first_name} {player.last_name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Intended receiver (even if incomplete)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advanced Offensive Position Performance (Tier 3) - Only for Offense, not Special Teams */}
              {taggingMode === 'offense' && analyticsTier === 'premium' && (
                <div className="space-y-3">
                  <QBPerformanceSection register={register} />
                  <RBPerformanceSection register={register} />
                  <WRPerformanceSection register={register} />
                  <OLPerformanceSection register={register} players={players} />
                </div>
              )}

              {/* Basic Defensive Tracking (All Tiers) - Only for Defense, not Special Teams */}
              {taggingMode === 'defense' && (analyticsTier === 'basic' || analyticsTier === 'plus') && (
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

              {/* Advanced Defensive Performance (Tier 3) - Only for Defense, not Special Teams */}
              {taggingMode === 'defense' && analyticsTier === 'premium' && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Defensive Stats (Tier 3)</h4>

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
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

      {/* Add Marker Modal */}
      <AddMarkerModal
        isOpen={showAddMarkerModal}
        onClose={() => setShowAddMarkerModal(false)}
        onAdd={handleCreateMarker}
        currentTimestamp={`${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`}
      />
    </AuthGuard>
  );
}