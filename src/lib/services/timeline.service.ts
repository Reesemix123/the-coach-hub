// Timeline Service - CRUD operations for multi-clip camera timelines

import { createClient } from '@/utils/supabase/client';
import type {
  GameTimeline,
  CameraLane,
  TimelineClip,
  CreateClipData,
  MoveClipData,
  TrimClipData,
  DEFAULT_LANE_LABELS,
} from '@/types/timeline';

/**
 * Result of a clip validation check
 */
export interface ClipValidationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  currentLaneSeconds?: number;
  clipSeconds?: number;
  maxCameraSeconds?: number;
}

/**
 * TimelineService handles all CRUD operations for the multi-clip camera timeline feature
 */
export class TimelineService {
  private supabase = createClient();

  /**
   * Get or create a timeline for a game
   */
  async getOrCreateTimeline(gameId: string, teamId: string): Promise<GameTimeline> {
    // First, check if a timeline exists for this game
    console.log('[TimelineService] getOrCreateTimeline:', { gameId, teamId });

    // Use limit(1) to get the first matching timeline (handles duplicates gracefully)
    const { data: existingGroups, error: groupError } = await this.supabase
      .from('video_groups')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_timeline_mode', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (groupError) {
      console.error('[TimelineService] video_groups query error:', groupError);
    }

    const existingGroup = existingGroups?.[0];

    if (existingGroup) {
      console.log('[TimelineService] Found existing timeline group:', existingGroup.id);
      return this.loadTimeline(existingGroup.id, gameId);
    }

    console.log('[TimelineService] No existing timeline found, creating new one...');

    // Create a new timeline
    const { data: newGroup, error } = await this.supabase
      .from('video_groups')
      .insert({
        name: `Timeline for game ${gameId}`,
        team_id: teamId,
        group_type: 'sequence',
        is_timeline_mode: true,
        game_id: gameId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create timeline: ${error.message}`);
    }

    // Auto-populate with existing videos for this game
    const { data: existingVideos } = await this.supabase
      .from('videos')
      .select('id, name, duration_seconds, camera_label, camera_order, url')
      .eq('game_id', gameId)
      .order('camera_order', { ascending: true });

    if (existingVideos && existingVideos.length > 0) {
      // Create video_group_members for each existing video
      const members = existingVideos.map((video, index) => ({
        video_group_id: newGroup.id,
        video_id: video.id,
        camera_lane: video.camera_order || index + 1,
        camera_label: video.camera_label || video.name || `Camera ${index + 1}`,
        lane_position_ms: 0,
        start_offset_ms: 0,
        end_offset_ms: (video.duration_seconds || 0) * 1000,
      }));

      await this.supabase
        .from('video_group_members')
        .insert(members);

      // Return the populated timeline
      return this.loadTimeline(newGroup.id, gameId);
    }

    return {
      gameId,
      videoGroupId: newGroup.id,
      totalDurationMs: 0,
      lanes: [],
      isTimelineMode: true,
    };
  }

  /**
   * Load an existing timeline with all its clips
   */
  async loadTimeline(videoGroupId: string, gameId: string): Promise<GameTimeline> {
    console.log('[TimelineService] loadTimeline called:', { videoGroupId, gameId });

    // Fetch all clips using the helper function
    const { data: clips, error } = await this.supabase
      .rpc('get_timeline_clips', { p_video_group_id: videoGroupId });

    console.log('[TimelineService] RPC result:', { clipsCount: clips?.length, error: error?.message });

    if (error) {
      console.error('Error loading timeline clips:', error);
      // Fallback to manual query if function doesn't exist
      return this.loadTimelineManual(videoGroupId, gameId);
    }

    // Group clips by lane
    const lanesMap = new Map<number, TimelineClip[]>();

    for (const clip of clips || []) {
      const timelineClip: TimelineClip = {
        id: clip.member_id,
        videoId: clip.video_id,
        videoName: clip.video_name,
        videoUrl: clip.video_url,
        cameraLane: clip.camera_lane,
        lanePositionMs: clip.lane_position_ms,
        durationMs: clip.duration_ms,
        startOffsetMs: clip.start_offset_ms,
        endOffsetMs: clip.end_offset_ms,
        thumbnailUrl: clip.thumbnail_url,
      };

      if (!lanesMap.has(clip.camera_lane)) {
        lanesMap.set(clip.camera_lane, []);
      }
      lanesMap.get(clip.camera_lane)!.push(timelineClip);
    }

    // Build lanes array
    const lanes: CameraLane[] = [];
    for (const [laneNum, laneClips] of lanesMap) {
      // Find label from first clip or use default
      const label = clips?.find(c => c.camera_lane === laneNum)?.camera_label
        || `Camera ${laneNum}`;

      lanes.push({
        lane: laneNum,
        label,
        clips: laneClips.sort((a, b) => a.lanePositionMs - b.lanePositionMs),
        syncOffsetMs: 0,
      });
    }

    // Calculate total duration
    const totalDurationMs = this.calculateTotalDuration(lanes);

    console.log('[TimelineService] loadTimeline returning:', {
      gameId,
      videoGroupId,
      totalDurationMs,
      lanesCount: lanes.length,
      lanes: lanes.map(l => ({ lane: l.lane, label: l.label, clipsCount: l.clips.length })),
    });

    return {
      gameId,
      videoGroupId,
      totalDurationMs,
      lanes: lanes.sort((a, b) => a.lane - b.lane),
      isTimelineMode: true,
    };
  }

  /**
   * Fallback manual query if RPC function doesn't exist
   */
  private async loadTimelineManual(videoGroupId: string, gameId: string): Promise<GameTimeline> {
    const { data: members } = await this.supabase
      .from('video_group_members')
      .select(`
        id,
        video_id,
        camera_lane,
        lane_position_ms,
        camera_label,
        start_offset_ms,
        end_offset_ms,
        videos (
          id,
          name,
          url,
          thumbnail_url,
          duration_seconds
        )
      `)
      .eq('video_group_id', videoGroupId)
      .order('camera_lane')
      .order('lane_position_ms');

    const lanesMap = new Map<number, TimelineClip[]>();

    for (const member of members || []) {
      const video = member.videos as any;
      const durationMs = video?.duration_seconds
        ? (member.end_offset_ms
            ? member.end_offset_ms - (member.start_offset_ms || 0)
            : video.duration_seconds * 1000)
        : 0;

      const clip: TimelineClip = {
        id: member.id,
        videoId: member.video_id,
        videoName: video?.name || 'Unknown',
        videoUrl: video?.url || '',
        cameraLane: member.camera_lane || 1,
        lanePositionMs: member.lane_position_ms || 0,
        durationMs,
        startOffsetMs: member.start_offset_ms || 0,
        endOffsetMs: member.end_offset_ms,
        thumbnailUrl: video?.thumbnail_url,
      };

      const lane = member.camera_lane || 1;
      if (!lanesMap.has(lane)) {
        lanesMap.set(lane, []);
      }
      lanesMap.get(lane)!.push(clip);
    }

    const lanes: CameraLane[] = [];
    for (const [laneNum, laneClips] of lanesMap) {
      const label = members?.find(m => m.camera_lane === laneNum)?.camera_label
        || `Camera ${laneNum}`;

      lanes.push({
        lane: laneNum,
        label,
        clips: laneClips.sort((a, b) => a.lanePositionMs - b.lanePositionMs),
        syncOffsetMs: 0,
      });
    }

    return {
      gameId,
      videoGroupId,
      totalDurationMs: this.calculateTotalDuration(lanes),
      lanes: lanes.sort((a, b) => a.lane - b.lane),
      isTimelineMode: true,
    };
  }

  /**
   * Validate if adding a clip to a lane is allowed based on per-camera duration limits
   */
  async validateClipAddition(
    gameId: string,
    cameraLane: number,
    videoId: string
  ): Promise<ClipValidationResult> {
    // Call the database function to check limits
    const { data, error } = await this.supabase.rpc('check_timeline_clip_allowed', {
      p_game_id: gameId,
      p_camera_lane: cameraLane,
      p_video_id: videoId,
    });

    if (error) {
      console.error('Failed to validate clip addition:', error);
      // Allow if check fails (fail open for now)
      return { allowed: true };
    }

    return {
      allowed: data.allowed,
      reason: data.reason,
      message: data.message,
      currentLaneSeconds: data.current_lane_seconds,
      clipSeconds: data.clip_seconds,
      maxCameraSeconds: data.max_camera_seconds,
    };
  }

  /**
   * Add a clip to a lane
   */
  async addClip(
    videoGroupId: string,
    data: CreateClipData,
    gameId?: string,
    validateLimits: boolean = true
  ): Promise<TimelineClip> {
    // Get video info first
    const { data: video, error: videoError } = await this.supabase
      .from('videos')
      .select('name, url, thumbnail_url, duration_seconds, game_id')
      .eq('id', data.videoId)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
    }

    // Validate per-camera duration limits if requested
    if (validateLimits) {
      const actualGameId = gameId || video.game_id;
      if (actualGameId) {
        const validation = await this.validateClipAddition(
          actualGameId,
          data.cameraLane,
          data.videoId
        );

        if (!validation.allowed) {
          throw new Error(validation.message || 'Camera duration limit would be exceeded');
        }
      }
    }

    // Insert the clip
    const { data: member, error } = await this.supabase
      .from('video_group_members')
      .insert({
        video_group_id: videoGroupId,
        video_id: data.videoId,
        camera_lane: data.cameraLane,
        lane_position_ms: data.positionMs,
        camera_label: data.label,
        sequence_order: 0, // Not used in timeline mode
        include_audio: true,
        audio_volume: 1.0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add clip: ${error.message}`);
    }

    return {
      id: member.id,
      videoId: data.videoId,
      videoName: video.name,
      videoUrl: video.url,
      cameraLane: data.cameraLane,
      lanePositionMs: data.positionMs,
      durationMs: (video.duration_seconds || 0) * 1000,
      startOffsetMs: 0,
      endOffsetMs: null,
      thumbnailUrl: video.thumbnail_url,
    };
  }

  /**
   * Move a clip to a new position or lane
   */
  async moveClip(data: MoveClipData, gameId?: string, validateLimits: boolean = true): Promise<void> {
    console.log('[TimelineService] moveClip called:', data);

    // If moving to a different lane, validate per-camera limits
    if (validateLimits && gameId && data.originalLane !== undefined && data.originalLane !== data.newLane) {
      // Get the video ID for this clip
      const { data: member, error: memberError } = await this.supabase
        .from('video_group_members')
        .select('video_id')
        .eq('id', data.clipId)
        .single();

      if (memberError || !member) {
        throw new Error('Clip not found');
      }

      const validation = await this.validateClipAddition(
        gameId,
        data.newLane,
        member.video_id
      );

      if (!validation.allowed) {
        throw new Error(validation.message || 'Moving this clip would exceed the camera duration limit');
      }
    }

    console.log('[TimelineService] Updating video_group_members:', {
      clipId: data.clipId,
      camera_lane: data.newLane,
      lane_position_ms: data.newPositionMs,
    });

    const { error } = await this.supabase
      .from('video_group_members')
      .update({
        camera_lane: data.newLane,
        lane_position_ms: data.newPositionMs,
      })
      .eq('id', data.clipId);

    if (error) {
      console.error('[TimelineService] moveClip update error:', error);
      throw new Error(`Failed to move clip: ${error.message}`);
    }

    console.log('[TimelineService] moveClip update succeeded');
  }

  /**
   * Remove a clip from the timeline
   * Also deletes the underlying video and storage file
   */
  async removeClip(clipId: string): Promise<void> {
    // Get the video_id from this clip before we delete it
    const { data: clip, error: clipError } = await this.supabase
      .from('video_group_members')
      .select('video_id')
      .eq('id', clipId)
      .single();

    if (clipError) {
      throw new Error(`Failed to find clip: ${clipError.message}`);
    }

    const videoId = clip.video_id;

    // Delete the video_group_member (clip reference)
    const { error } = await this.supabase
      .from('video_group_members')
      .delete()
      .eq('id', clipId);

    if (error) {
      throw new Error(`Failed to remove clip: ${error.message}`);
    }

    // Delete the video and storage file
    if (videoId) {
      console.log('[TimelineService] Deleting video and storage:', videoId);

      try {
        const response = await fetch(`/api/videos/${videoId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[TimelineService] Video deletion failed:', errorData);
        } else {
          console.log('[TimelineService] Video fully deleted:', videoId);
        }
      } catch (err) {
        console.error('[TimelineService] Error calling video deletion API:', err);
      }
    }
  }

  /**
   * Update clip trim points
   */
  async trimClip(data: TrimClipData): Promise<void> {
    const { error } = await this.supabase
      .from('video_group_members')
      .update({
        start_offset_ms: data.startOffsetMs,
        end_offset_ms: data.endOffsetMs,
      })
      .eq('id', data.clipId);

    if (error) {
      throw new Error(`Failed to trim clip: ${error.message}`);
    }
  }

  /**
   * Update lane label - syncs both video_group_members and videos tables
   */
  async updateLaneLabel(
    videoGroupId: string,
    lane: number,
    label: string
  ): Promise<void> {
    // First, get the video IDs for this lane so we can sync the videos table
    const { data: members, error: fetchError } = await this.supabase
      .from('video_group_members')
      .select('video_id')
      .eq('video_group_id', videoGroupId)
      .eq('camera_lane', lane);

    if (fetchError) {
      console.error('Failed to fetch lane members:', fetchError);
    }

    // Update video_group_members
    const { error } = await this.supabase
      .from('video_group_members')
      .update({ camera_label: label })
      .eq('video_group_id', videoGroupId)
      .eq('camera_lane', lane);

    if (error) {
      throw new Error(`Failed to update lane label: ${error.message}`);
    }

    // Also update the videos table for each video in this lane (sync Camera View)
    if (members && members.length > 0) {
      const videoIds = members.map(m => m.video_id);
      const { error: videoError } = await this.supabase
        .from('videos')
        .update({ camera_label: label })
        .in('id', videoIds);

      if (videoError) {
        console.error('Failed to sync video labels:', videoError);
        // Don't throw - the primary update succeeded
      }
    }
  }

  /**
   * Get available videos for a game that can be added to the timeline
   * Includes camera_order and camera_label for grouping by camera lane
   */
  async getAvailableVideos(gameId: string): Promise<Array<{
    id: string;
    name: string;
    url: string;
    thumbnailUrl: string | null;
    durationMs: number;
    cameraOrder: number;
    cameraLabel: string | null;
  }>> {
    const { data: videos, error } = await this.supabase
      .from('videos')
      .select('id, name, url, thumbnail_url, duration_seconds, camera_order, camera_label')
      .eq('game_id', gameId)
      .eq('is_virtual', false)
      .order('camera_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }

    return (videos || []).map(v => ({
      id: v.id,
      name: v.name,
      url: v.url,
      thumbnailUrl: v.thumbnail_url,
      durationMs: (v.duration_seconds || 0) * 1000,
      cameraOrder: v.camera_order || 1,
      cameraLabel: v.camera_label,
    }));
  }

  /**
   * Check if a clip would overlap with existing clips
   */
  async checkOverlap(
    videoGroupId: string,
    cameraLane: number,
    positionMs: number,
    durationMs: number,
    excludeClipId?: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('check_clip_overlap', {
        p_video_group_id: videoGroupId,
        p_camera_lane: cameraLane,
        p_position_ms: positionMs,
        p_duration_ms: durationMs,
        p_exclude_member_id: excludeClipId || null,
      });

    if (error) {
      console.error('Overlap check failed:', error);
      return false; // Assume no overlap if check fails
    }

    return data === true;
  }

  /**
   * Calculate the total duration of a timeline
   */
  calculateTotalDuration(lanes: CameraLane[]): number {
    let maxEnd = 0;

    for (const lane of lanes) {
      for (const clip of lane.clips) {
        const clipEnd = clip.lanePositionMs + clip.durationMs;
        if (clipEnd > maxEnd) {
          maxEnd = clipEnd;
        }
      }
    }

    return maxEnd;
  }

  /**
   * Update the cached total duration in the database
   */
  async updateTotalDuration(videoGroupId: string, durationMs: number): Promise<void> {
    await this.supabase
      .from('video_groups')
      .update({ total_duration_ms: durationMs })
      .eq('id', videoGroupId);
  }

  /**
   * Find the next available position in a lane (after all existing clips)
   */
  findNextAvailablePosition(lane: CameraLane): number {
    if (lane.clips.length === 0) {
      return 0;
    }

    let maxEnd = 0;
    for (const clip of lane.clips) {
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd;
      }
    }

    return maxEnd;
  }

  /**
   * Get the next available lane number (first unused or next after max)
   */
  getNextAvailableLane(lanes: CameraLane[]): number {
    if (lanes.length === 0) return 1;

    const usedLanes = new Set(lanes.map(l => l.lane));
    for (let i = 1; i <= 5; i++) {
      if (!usedLanes.has(i)) return i;
    }

    return Math.min(5, Math.max(...lanes.map(l => l.lane)) + 1);
  }
}

// Export singleton instance
export const timelineService = new TimelineService();
