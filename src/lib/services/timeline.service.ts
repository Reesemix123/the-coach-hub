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
 * TimelineService handles all CRUD operations for the multi-clip camera timeline feature
 */
export class TimelineService {
  private supabase = createClient();

  /**
   * Get or create a timeline for a game
   */
  async getOrCreateTimeline(gameId: string, teamId: string): Promise<GameTimeline> {
    // First, check if a timeline exists for this game
    const { data: existingGroup } = await this.supabase
      .from('video_groups')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_timeline_mode', true)
      .single();

    if (existingGroup) {
      return this.loadTimeline(existingGroup.id, gameId);
    }

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
    // Fetch all clips using the helper function
    const { data: clips, error } = await this.supabase
      .rpc('get_timeline_clips', { p_video_group_id: videoGroupId });

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
   * Add a clip to a lane
   */
  async addClip(
    videoGroupId: string,
    data: CreateClipData
  ): Promise<TimelineClip> {
    // Get video info first
    const { data: video, error: videoError } = await this.supabase
      .from('videos')
      .select('name, url, thumbnail_url, duration_seconds')
      .eq('id', data.videoId)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
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
  async moveClip(data: MoveClipData): Promise<void> {
    const { error } = await this.supabase
      .from('video_group_members')
      .update({
        camera_lane: data.newLane,
        lane_position_ms: data.newPositionMs,
      })
      .eq('id', data.clipId);

    if (error) {
      throw new Error(`Failed to move clip: ${error.message}`);
    }
  }

  /**
   * Remove a clip from the timeline
   */
  async removeClip(clipId: string): Promise<void> {
    const { error } = await this.supabase
      .from('video_group_members')
      .delete()
      .eq('id', clipId);

    if (error) {
      throw new Error(`Failed to remove clip: ${error.message}`);
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
   * Update lane label
   */
  async updateLaneLabel(
    videoGroupId: string,
    lane: number,
    label: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('video_group_members')
      .update({ camera_label: label })
      .eq('video_group_id', videoGroupId)
      .eq('camera_lane', lane);

    if (error) {
      throw new Error(`Failed to update lane label: ${error.message}`);
    }
  }

  /**
   * Get available videos for a game that can be added to the timeline
   */
  async getAvailableVideos(gameId: string): Promise<Array<{
    id: string;
    name: string;
    url: string;
    thumbnailUrl: string | null;
    durationMs: number;
  }>> {
    const { data: videos, error } = await this.supabase
      .from('videos')
      .select('id, name, url, thumbnail_url, duration_seconds')
      .eq('game_id', gameId)
      .eq('is_virtual', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }

    return (videos || []).map(v => ({
      id: v.id,
      name: v.name,
      url: v.url,
      thumbnailUrl: v.thumbnail_url,
      durationMs: (v.duration_seconds || 0) * 1000,
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
