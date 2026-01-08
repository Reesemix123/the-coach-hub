/**
 * VideoMarkerService
 *
 * Service for managing video timeline markers (quarter starts, halftime, etc.)
 * Used by the film tagging page and timeline editor.
 *
 * Features:
 * - CRUD operations for markers
 * - Quarter detection at timestamp
 * - Auto-generation of quarter markers
 * - Inference from tagged plays
 *
 * @module lib/services/video-marker.service
 * @since Phase 2 - Film System Refactor (enhanced)
 */

import { createClient } from '@/utils/supabase/client';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';

export interface CreateMarkerParams {
  video_id: string;
  timestamp_start_ms: number;
  timestamp_end_ms?: number;
  marker_type: MarkerType;
  label?: string;
  quarter?: number;
  color?: string;
  notes?: string;
}

export class VideoMarkerService {
  private supabase = createClient();

  /**
   * Get all markers for a video
   */
  async getMarkersForVideo(videoId: string): Promise<VideoTimelineMarker[]> {
    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .select('*')
      .eq('video_id', videoId)
      .order('virtual_timestamp_start_ms', { ascending: true });

    if (error) {
      console.error('Error fetching markers:', error);
      throw new Error(`Failed to fetch markers: ${error.message}`);
    }

    return (data as VideoTimelineMarker[]) || [];
  }

  /**
   * Get markers by type for a video
   */
  async getMarkersByType(
    videoId: string,
    markerType: MarkerType
  ): Promise<VideoTimelineMarker[]> {
    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .select('*')
      .eq('video_id', videoId)
      .eq('marker_type', markerType)
      .order('virtual_timestamp_start_ms', { ascending: true});

    if (error) {
      console.error('Error fetching markers by type:', error);
      throw new Error(`Failed to fetch markers: ${error.message}`);
    }

    return (data as VideoTimelineMarker[]) || [];
  }

  /**
   * Create a new marker
   */
  async createMarker(params: CreateMarkerParams): Promise<VideoTimelineMarker> {
    const { data: { user } } = await this.supabase.auth.getUser();

    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .insert([{
        video_id: params.video_id,
        virtual_timestamp_start_ms: params.timestamp_start_ms,
        virtual_timestamp_end_ms: params.timestamp_end_ms,
        marker_type: params.marker_type,
        label: params.label,
        quarter: params.quarter,
        color: params.color,
        notes: params.notes,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating marker:', error);
      throw new Error(`Failed to create marker: ${error.message}`);
    }

    return data as VideoTimelineMarker;
  }

  /**
   * Update an existing marker
   */
  async updateMarker(
    markerId: string,
    updates: Partial<VideoTimelineMarker>
  ): Promise<VideoTimelineMarker> {
    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', markerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating marker:', error);
      throw new Error(`Failed to update marker: ${error.message}`);
    }

    return data as VideoTimelineMarker;
  }

  /**
   * Delete a marker
   */
  async deleteMarker(markerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('video_timeline_markers')
      .delete()
      .eq('id', markerId);

    if (error) {
      console.error('Error deleting marker:', error);
      throw new Error(`Failed to delete marker: ${error.message}`);
    }
  }

  /**
   * Get the quarter at a specific timestamp based on markers
   */
  async getQuarterAtTimestamp(
    videoId: string,
    timestampMs: number
  ): Promise<number | null> {
    const markers = await this.getMarkersByType(videoId, 'quarter_start');

    if (markers.length === 0) return null;

    // Find the last quarter start marker before this timestamp
    let currentQuarter = 1;
    for (const marker of markers) {
      if (marker.virtual_timestamp_start_ms <= timestampMs && marker.quarter) {
        currentQuarter = marker.quarter;
      }
    }

    return currentQuarter;
  }

  /**
   * Auto-generate quarter markers based on video duration
   * Divides video evenly into quarters
   */
  async autoGenerateQuarterMarkers(
    videoId: string,
    videoDurationMs: number,
    numberOfQuarters: number = 4
  ): Promise<VideoTimelineMarker[]> {
    const quarterDuration = videoDurationMs / numberOfQuarters;
    const markers: VideoTimelineMarker[] = [];

    for (let q = 1; q <= numberOfQuarters; q++) {
      const startTime = Math.floor((q - 1) * quarterDuration);
      const endTime = Math.floor(q * quarterDuration);

      // Quarter start marker
      const startMarker = await this.createMarker({
        video_id: videoId,
        timestamp_start_ms: startTime,
        marker_type: 'quarter_start',
        label: `Q${q} Start`,
        quarter: q
      });
      markers.push(startMarker);

      // Quarter end marker
      const endMarker = await this.createMarker({
        video_id: videoId,
        timestamp_start_ms: endTime,
        marker_type: 'quarter_end',
        label: `Q${q} End`,
        quarter: q
      });
      markers.push(endMarker);

      // Halftime marker (after Q2)
      if (q === 2) {
        const halftimeMarker = await this.createMarker({
          video_id: videoId,
          timestamp_start_ms: endTime,
          marker_type: 'halftime',
          label: 'Halftime'
        });
        markers.push(halftimeMarker);
      }
    }

    return markers;
  }

  /**
   * Infer quarter markers from tagged play instances
   * Uses the quarter field from existing play tags
   */
  async inferQuarterMarkersFromPlays(
    videoId: string
  ): Promise<VideoTimelineMarker[]> {
    // Get all play instances for this video with quarter data
    const { data: plays, error } = await this.supabase
      .from('play_instances')
      .select('quarter, timestamp_start')
      .eq('video_id', videoId)
      .not('quarter', 'is', null)
      .order('timestamp_start', { ascending: true });

    if (error || !plays || plays.length === 0) {
      console.error('Error fetching plays for marker inference:', error);
      return [];
    }

    // Find first play of each quarter
    const quarterStarts = new Map<number, number>();

    for (const play of plays) {
      if (!quarterStarts.has(play.quarter!)) {
        quarterStarts.set(play.quarter!, play.timestamp_start);
      }
    }

    // Create markers
    const markers: VideoTimelineMarker[] = [];
    for (const [quarter, timestampSec] of quarterStarts.entries()) {
      const timestampMs = timestampSec * 1000; // Convert to milliseconds

      const marker = await this.createMarker({
        video_id: videoId,
        timestamp_start_ms: timestampMs,
        marker_type: 'quarter_start',
        label: `Q${quarter} Start`,
        quarter: quarter
      });
      markers.push(marker);
    }

    return markers;
  }

  /**
   * Delete all markers for a video
   * Useful before regenerating markers
   */
  async deleteAllMarkersForVideo(videoId: string): Promise<void> {
    const { error } = await this.supabase
      .from('video_timeline_markers')
      .delete()
      .eq('video_id', videoId);

    if (error) {
      console.error('Error deleting markers:', error);
      throw new Error(`Failed to delete markers: ${error.message}`);
    }
  }

  /**
   * Get markers within a time range
   */
  async getMarkersInRange(
    videoId: string,
    startMs: number,
    endMs: number
  ): Promise<VideoTimelineMarker[]> {
    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .select('*')
      .eq('video_id', videoId)
      .gte('virtual_timestamp_start_ms', startMs)
      .lte('virtual_timestamp_start_ms', endMs)
      .order('virtual_timestamp_start_ms', { ascending: true });

    if (error) {
      console.error('Error fetching markers in range:', error);
      throw new Error(`Failed to fetch markers: ${error.message}`);
    }

    return (data as VideoTimelineMarker[]) || [];
  }
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: VideoMarkerService | null = null;

/**
 * Get the default VideoMarkerService instance
 */
export function getVideoMarkerService(): VideoMarkerService {
  if (!defaultInstance) {
    defaultInstance = new VideoMarkerService();
  }
  return defaultInstance;
}

export default VideoMarkerService;
