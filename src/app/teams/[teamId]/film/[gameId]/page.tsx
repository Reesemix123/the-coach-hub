'use client';

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from '@/components/AuthGuard';
import { useForm } from "react-hook-form";
import { createClient } from '@/utils/supabase/client';
import { COMMON_ATTRIBUTES, OPPONENT_PLAY_TYPES } from '@/config/footballConfig';
import { RESULT_TYPES } from '@/types/football';
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
}

interface Play {
  play_code: string;
  play_name: string;
  attributes: any;
}

interface PlayInstance {
  id: string;
  video_id: string;
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
}

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

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<PlayInstance | null>(null);
  const [tagStartTime, setTagStartTime] = useState<number>(0);
  const [tagEndTime, setTagEndTime] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isSettingEndTime, setIsSettingEndTime] = useState(false);
  const [isTaggingOpponent, setIsTaggingOpponent] = useState(false);
  const [analyticsTier, setAnalyticsTier] = useState<string>('hs_advanced');
  const [selectedTab, setSelectedTab] = useState<'context' | 'players' | 'ol' | 'defense'>('context');
  const [selectedTacklers, setSelectedTacklers] = useState<string[]>([]);
  const [primaryTacklerId, setPrimaryTacklerId] = useState<string>('');

  // Filter state
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterOffenseDefense, setFilterOffenseDefense] = useState<string>('all');
  const [filterDrive, setFilterDrive] = useState<string>('all');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayTagForm>();

  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchVideos();
      fetchDrives();
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
    const handleLoadedMetadata = () => setVideoDuration(video.duration);

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
  }, [selectedVideo]);

  async function fetchGame() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!error && data) {
      setGame(data);
      if (data.is_opponent_game) {
        setIsTaggingOpponent(true);
      }
    }
  }

  async function fetchVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

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
        // Default to hs_advanced for testing (migration 025 not run yet)
        setAnalyticsTier('hs_advanced');
      }
    } catch (err) {
      console.log('Analytics tier table not found, defaulting to hs_advanced');
      // Fallback if table doesn't exist (migration 025 not run)
      setAnalyticsTier('hs_advanced');
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

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !game) return;

    // Check file size and show warning for very large files
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 2000) {
      if (!confirm(`This file is ${fileSizeMB.toFixed(0)}MB. Large files may take a while to upload. Continue?`)) {
        return;
      }
    }

    setUploadingVideo(true);

    try {
      const fileName = `${game.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      // Use resumable upload for files larger than 50MB
      // This uses TUS protocol which supports chunked uploads
      const uploadOptions = fileSizeMB > 50 ? {
        cacheControl: '3600',
        upsert: false,
        duplex: 'half' as RequestDuplex
      } : {};

      const { error: uploadError } = await supabase.storage
        .from('game_videos')
        .upload(fileName, file, uploadOptions);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert(`Error uploading video: ${uploadError.message}\n\nFor files larger than 50MB, you may need to:\n1. Check your Supabase project settings\n2. Or compress the video before uploading`);
        setUploadingVideo(false);
        return;
      }

      const { data: videoData } = await supabase
        .from('videos')
        .insert([{
          name: file.name,
          file_path: fileName,
          game_id: game.id
        }])
        .select()
        .single();

      if (videoData) {
        setVideos([videoData, ...videos]);
        setSelectedVideo(videoData);
        alert('Video uploaded successfully!');
      }

      setUploadingVideo(false);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading video. Please try again or use a smaller file.');
      setUploadingVideo(false);
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
    setIsTaggingOpponent(instance.is_opponent_play || false);
    
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
    setValue('missed_tackle_ids', instance.missed_tackle_ids?.join(', ') || '');
    setValue('pressure_player_ids', instance.pressure_player_ids?.join(', ') || '');
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
        team_id: game.team_id,
        drive_id: driveId,
        timestamp_start: tagStartTime,
        timestamp_end: tagEndTime || undefined,
        is_opponent_play: isTaggingOpponent,

        play_code: isTaggingOpponent
          ? (values.opponent_play_type || 'Unknown')
          : (values.play_code || ''),

        player_id: isTaggingOpponent ? undefined : (values.player_id || undefined),

        formation: values.formation || undefined,
        result_type: values.result_type || undefined,
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
        is_interception: isTaggingOpponent ? (values.is_interception || false) : undefined,
        qb_decision_grade: isTaggingOpponent && values.qb_decision_grade !== undefined
          ? parseInt(String(values.qb_decision_grade))
          : undefined
      };

      if (editingInstance) {
        const { error } = await supabase
          .from('play_instances')
          .update(instanceData)
          .eq('id', editingInstance.id);

        if (error) throw error;

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
        const { error } = await supabase
          .from('play_instances')
          .insert([instanceData]);

        if (error) throw error;

        // Recalculate drive stats after adding new play
        if (driveId) {
          await driveService.recalculateDriveStats(driveId);
        }
      }

      // Refresh drives to show updated play counts
      await fetchDrives();

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

  function jumpToPlay(timestamp: number, endTimestamp?: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
      
      if (endTimestamp) {
        const checkTime = setInterval(() => {
          if (videoRef.current && videoRef.current.currentTime >= endTimestamp) {
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
                <label className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer font-semibold transition-colors">
                  {uploadingVideo ? 'Uploading...' : '+ Add Video'}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    disabled={uploadingVideo}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Unified Video List */}
          {videos.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Videos ({videos.length})
                </h2>
                {selectedVideoIds.size > 0 && (
                  <button
                    onClick={handleCombineVideos}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    Combine {selectedVideoIds.size} Videos
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {videos.map((video) => {
                  const isSelected = selectedVideoIds.has(video.id);
                  const isActive = selectedVideo?.id === video.id;

                  return (
                    <div
                      key={video.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Checkbox */}
                      {!video.is_virtual && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleVideoSelection(video.id)}
                          className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black cursor-pointer"
                        />
                      )}

                      {/* Video info and select button */}
                      <button
                        onClick={() => setSelectedVideo(video)}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0 text-2xl">
                          {video.is_virtual ? '🎬' : '📹'}
                        </div>

                        {/* Name and metadata */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            isActive ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {video.virtual_name || video.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {video.is_virtual
                              ? `Combined from ${video.video_count} videos`
                              : new Date(video.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Active indicator */}
                        {isActive && (
                          <div className="flex-shrink-0 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                            Playing
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
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
                      />

                    <div className="mt-4 space-y-4">
                      {/* Timeline */}
                      {videoDuration > 0 && (
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
                                onClick={() => jumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined)}
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
                      )}

                      {/* Controls */}
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

                  {/* Offense/Defense Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Offense/Defense
                    </label>
                    <select
                      value={filterOffenseDefense}
                      onChange={(e) => setFilterOffenseDefense(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                    >
                      <option value="all">All Plays</option>
                      <option value="offense">Our Offense</option>
                      <option value="defense">Our Defense (Opponent Plays)</option>
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

                    // Offense/Defense filter
                    if (filterOffenseDefense === 'offense' && instance.is_opponent_play) {
                      return false;
                    }
                    if (filterOffenseDefense === 'defense' && !instance.is_opponent_play) {
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

                  // Offense/Defense filter
                  if (filterOffenseDefense === 'offense' && instance.is_opponent_play) {
                    return false;
                  }
                  if (filterOffenseDefense === 'defense' && !instance.is_opponent_play) {
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
                            {instance.is_opponent_play && (
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
                        onClick={() => jumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined)}
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
            setIsTaggingOpponent(false);
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
                  setIsTaggingOpponent(false);
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
                  {/* Toggle: Offense vs Defense */}
            <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {game.is_opponent_game ? 'Tagging Opponent:' : 'Tagging:'}
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTaggingOpponent(false)}
                  className={isTaggingOpponent
                    ? 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
                    : 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                  }
                >
                  Offense
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaggingOpponent(true)}
                  className={!isTaggingOpponent
                    ? 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
                    : 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                  }
                >
                  Defense
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {game.is_opponent_game
                  ? 'Offense = opponent offense, Defense = opponent defense'
                  : 'Offense = your offense, Defense = opponent plays (what your defense faced)'
                }
              </p>
            </div>

            {/* Drive Context - For Both Offense and Defense */}
            {!game.is_opponent_game && (
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

            {/* Situational Context - Down & Distance - VISIBLE FOR ALL */}
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

              {/* Play Selection - CONDITIONAL */}
              {isTaggingOpponent ? (
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
              )}

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

              {/* Formation */}
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

              {/* Player Performance Section (All Tiers) - Only for Offense */}
              {!isTaggingOpponent && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Player Performance</h4>

                  {/* Play Type & Direction (Tier 2+) */}
                  {(analyticsTier === 'hs_basic' || analyticsTier === 'hs_advanced') && (
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
                    {(analyticsTier === 'hs_basic' || analyticsTier === 'hs_advanced') && (
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
                    {(analyticsTier === 'hs_basic' || analyticsTier === 'hs_advanced') && (
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

              {/* Advanced Offensive Position Performance (Tier 3) - Only for Offense */}
              {!isTaggingOpponent && analyticsTier === 'hs_advanced' && (
                <div className="space-y-3">
                  <QBPerformanceSection register={register} />
                  <RBPerformanceSection register={register} />
                  <WRPerformanceSection register={register} />
                  <OLPerformanceSection register={register} players={players} />
                </div>
              )}

              {/* Basic Defensive Tracking (All Tiers) - Only for Defense */}
              {isTaggingOpponent && (analyticsTier === 'little_league' || analyticsTier === 'hs_basic') && (
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

              {/* Advanced Defensive Performance (Tier 3) - Only for Defense */}
              {isTaggingOpponent && analyticsTier === 'hs_advanced' && (
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

                    {/* Position-Specific Defensive Performance (Tier 3) */}
                    <div className="space-y-3 pt-4">
                      <DLPerformanceSection register={register} players={players} />
                      <LBPerformanceSection register={register} players={players} />
                      <DBPerformanceSection register={register} players={players} />
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
                        <label className="flex items-center space-x-2">
                          <input
                            {...register('is_interception')}
                            type="checkbox"
                            className="w-4 h-4 text-red-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">Interception</span>
                        </label>
                      </div>
                    </div>

                    {/* QB Decision Grade (for opponent QB evaluation) */}
                    <div className="pt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Opponent QB Decision Grade</label>
                      <select
                        {...register('qb_decision_grade')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">-</option>
                        {QB_DECISION_GRADES.map(grade => (
                          <option key={grade.value} value={grade.value}>{grade.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Grade the opponent QB's decision-making</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Result Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result <span className="text-red-600">*</span>
                </label>
                <select
                  {...register('result_type', { required: 'Please select result' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">Select result...</option>
                  {RESULT_TYPES.map(result => (
                    <option key={result.value} value={result.value}>{result.label}</option>
                  ))}
                </select>
                {errors.result_type && <p className="text-red-600 text-sm mt-1">{errors.result_type.message}</p>}
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

              {/* First Down Checkbox */}
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
                    setIsTaggingOpponent(false);
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
    </AuthGuard>
  );
}