'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DriveService } from '@/lib/services/drive.service';
import { gameScoreService, type ScoreMismatchResult } from '@/lib/services/game-score.service';
import { filmSessionService } from '@/lib/services/film-session.service';
import type { TaggingTier, GameScoreBreakdown, FilmAnalysisStatus } from '@/types/football';
import type { useFilmStateBridge } from '@/components/film/context';

// ============================================
// TYPES
// ============================================

interface UseFilmDataFetchingOptions {
  gameId: string;
  teamId: string;
  bridge: ReturnType<typeof useFilmStateBridge>;
  filmAnalysisStatus: FilmAnalysisStatus;
  onTaggingTierChange: (tier: TaggingTier | null) => void;
  onFilmAnalysisStatusChange: (status: FilmAnalysisStatus) => void;
  onQuarterScoresChange: (scores: GameScoreBreakdown | null) => void;
  onScoreMismatchChange: (mismatch: ScoreMismatchResult | null) => void;
}

// ============================================
// HOOK
// ============================================

export function useFilmDataFetching({
  gameId,
  teamId,
  bridge,
  filmAnalysisStatus,
  onTaggingTierChange,
  onFilmAnalysisStatusChange,
  onQuarterScoresChange,
  onScoreMismatchChange,
}: UseFilmDataFetchingOptions) {
  const supabase = createClient();
  const driveService = new DriveService();
  const game = bridge.state.data.game;

  // ========== FETCH FUNCTIONS ==========

  async function fetchGame() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!error && data) {
      bridge.setGame(data);
      // Set tagging tier from game data
      if (data.tagging_tier) {
        onTaggingTierChange(data.tagging_tier as TaggingTier);
      } else {
        // No tier set yet - will show selector when user tries to tag
        onTaggingTierChange(null);
      }
      // Set film analysis status from game data
      if (data.film_analysis_status) {
        onFilmAnalysisStatusChange(data.film_analysis_status as FilmAnalysisStatus);
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
      bridge.setVideos(videosWithUrls);
    } else if (error) {
      console.error('Error fetching videos:', error);
    }
  }

  async function fetchCameraLimit() {
    try {
      const response = await fetch(`/api/teams/${teamId}/games/${gameId}/cameras`);
      if (response.ok) {
        const data = await response.json();
        bridge.setCameraLimit(data.cameraLimit || 1);
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
      bridge.setPlays(data);
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
      bridge.setPlayers(data);
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
      data.forEach((play: { attributes?: { formation?: string } }) => {
        if (play.attributes?.formation) {
          formationSet.add(play.attributes.formation);
        }
      });
      bridge.setFormations(Array.from(formationSet).sort());
    }
  }

  async function fetchDrives() {
    try {
      const drivesData = await driveService.getDrivesForGame(gameId);
      bridge.setDrives(drivesData);

      // Set current drive to the most recent active drive
      if (drivesData.length > 0) {
        const activeDrive = drivesData.find((d: { result?: string }) => d.result === 'end_half');
        bridge.setCurrentDrive(activeDrive || drivesData[drivesData.length - 1]);
      }
    } catch (error) {
      console.error('Error fetching drives:', error);
    }
  }

  async function fetchPlayInstances(videoIds: string[]) {
    if (videoIds.length === 0) {
      bridge.setPlayInstances([]);
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
      bridge.setPlayInstances(instancesWithNames);

      // Auto-fix: If there are plays but status is still 'not_started', update to 'in_progress'
      if (instancesWithNames.length > 0 && filmAnalysisStatus === 'not_started') {
        await filmSessionService.updateAnalysisStatus(gameId, 'in_progress');
        onFilmAnalysisStatusChange('in_progress');
      }
    }
  }

  async function loadQuarterScoresAndMismatch() {
    try {
      const [scores, mismatch] = await Promise.all([
        gameScoreService.getQuarterScores(gameId),
        gameScoreService.checkScoreMismatch(gameId)
      ]);
      onQuarterScoresChange(scores);
      onScoreMismatchChange(mismatch);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  }

  // ========== DATA FETCHING EFFECTS ==========

  // Initial load when game ID is available
  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchVideos();
      fetchDrives();
      fetchCameraLimit();
    }
  }, [gameId]);

  // Load team-scoped data when game loads
  useEffect(() => {
    if (game?.team_id) {
      fetchPlays();
      fetchPlayers();
      fetchFormations();
    }
  }, [game]);

  // Load quarter scores when game loads
  useEffect(() => {
    if (gameId && game) {
      loadQuarterScoresAndMismatch();
    }
  }, [gameId, game]);

  return {
    fetchGame,
    fetchVideos,
    fetchDrives,
    fetchPlayInstances,
    loadQuarterScoresAndMismatch,
  };
}
