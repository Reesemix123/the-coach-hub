'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { VideoMarkerService } from '@/lib/services/video-marker.service';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';

// ============================================
// TYPES
// ============================================

export interface UseMarkersOptions {
  selectedVideoId: string | null;
  currentTime: number;                    // seconds, for marker creation
  onSeekTo: (seconds: number) => void;    // callback for videoRef seeking
}

export interface UseMarkersReturn {
  // Data
  markers: VideoTimelineMarker[];
  editingMarker: VideoTimelineMarker | null;
  setEditingMarker: (m: VideoTimelineMarker | null) => void;

  // UI toggles
  showPeriodMarkerMenu: boolean;
  setShowPeriodMarkerMenu: (v: boolean) => void;
  showAddMarkerMenu: boolean;
  setShowAddMarkerMenu: (v: boolean) => void;

  // Operations
  fetchMarkers: (videoId: string) => Promise<void>;
  handleMarkerClick: (marker: VideoTimelineMarker) => void;
  handleMarkerSeekTo: (timeMs: number) => void;
  handleUpdateMarker: (id: string, updates: { label?: string; virtual_timestamp_start_ms?: number }) => Promise<void>;
  handleDeleteMarker: (id: string) => Promise<void>;
  handleQuickPeriodMarker: (type: MarkerType, quarter?: number, label?: string) => Promise<void>;
  handleQuickAddMarker: (type: MarkerType, label: string) => Promise<void>;
  handleCreateMarker: (type: MarkerType, label?: string, quarter?: number) => Promise<void>;
  handleJumpToMarker: (timestampMs: number) => void;

  // Derived
  getQuarterFromTimestamp: (timestampMs: number) => number | undefined;
}

// ============================================
// HOOK
// ============================================

export function useMarkers({ selectedVideoId, currentTime, onSeekTo }: UseMarkersOptions): UseMarkersReturn {
  // State
  const [markers, setMarkers] = useState<VideoTimelineMarker[]>([]);
  const [showPeriodMarkerMenu, setShowPeriodMarkerMenu] = useState(false);
  const [showAddMarkerMenu, setShowAddMarkerMenu] = useState(false);
  const [editingMarker, setEditingMarker] = useState<VideoTimelineMarker | null>(null);
  const markerService = useMemo(() => new VideoMarkerService(), []);

  // Close menus on outside click
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

  // Fetch markers for a video
  const fetchMarkers = useCallback(async (videoId: string) => {
    try {
      const markersData = await markerService.getMarkersForVideo(videoId);
      setMarkers(markersData);
    } catch (error) {
      console.error('Error fetching markers:', error);
    }
  }, [markerService]);

  // Click a marker → open edit modal
  const handleMarkerClick = useCallback((marker: VideoTimelineMarker) => {
    setEditingMarker(marker);
  }, []);

  // Seek to marker time
  const handleMarkerSeekTo = useCallback((timeMs: number) => {
    onSeekTo(timeMs / 1000);
  }, [onSeekTo]);

  // Update marker label or timestamp
  const handleUpdateMarker = useCallback(async (markerId: string, updates: { label?: string; virtual_timestamp_start_ms?: number }) => {
    try {
      await markerService.updateMarker(markerId, updates);
      if (selectedVideoId) {
        const updatedMarkers = await markerService.getMarkersForVideo(selectedVideoId);
        setMarkers(updatedMarkers);
      }
    } catch (error) {
      console.error('Error updating marker:', error);
      alert('Failed to update marker');
    }
  }, [markerService, selectedVideoId]);

  // Delete a marker
  const handleDeleteMarker = useCallback(async (markerId: string) => {
    try {
      await markerService.deleteMarker(markerId);
      if (selectedVideoId) {
        const updatedMarkers = await markerService.getMarkersForVideo(selectedVideoId);
        setMarkers(updatedMarkers);
      }
    } catch (error) {
      console.error('Error deleting marker:', error);
      alert('Failed to delete marker');
    }
  }, [markerService, selectedVideoId]);

  // Quick add period marker (quarter start/end, game markers)
  const handleQuickPeriodMarker = useCallback(async (markerType: MarkerType, quarter?: number, label?: string) => {
    if (!selectedVideoId) return;

    // Check for duplicate period markers
    const isDuplicate = markers.some(m => {
      if (markerType === 'quarter_end' && m.marker_type === 'quarter_end' && m.quarter === quarter) {
        return true;
      }
      if (['halftime', 'game_start', 'game_end'].includes(markerType) && m.marker_type === markerType) {
        return true;
      }
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
        video_id: selectedVideoId,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label || undefined,
        quarter: quarter
      });

      await fetchMarkers(selectedVideoId);
      setShowPeriodMarkerMenu(false);
    } catch (error) {
      console.error('Error adding period marker:', error);
    }
  }, [selectedVideoId, markers, currentTime, markerService, fetchMarkers]);

  // Quick add non-period marker (big play, turnover, timeout, custom)
  const handleQuickAddMarker = useCallback(async (markerType: MarkerType, label: string) => {
    if (!selectedVideoId) return;

    try {
      const timestampMs = Math.floor(currentTime * 1000);

      await markerService.createMarker({
        video_id: selectedVideoId,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label
      });

      await fetchMarkers(selectedVideoId);
      setShowAddMarkerMenu(false);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  }, [selectedVideoId, currentTime, markerService, fetchMarkers]);

  // Generic marker creation
  const handleCreateMarker = useCallback(async (markerType: MarkerType, label?: string, quarter?: number) => {
    if (!selectedVideoId) return;

    try {
      const timestampMs = Math.floor(currentTime * 1000);

      await markerService.createMarker({
        video_id: selectedVideoId,
        timestamp_start_ms: timestampMs,
        marker_type: markerType,
        label: label,
        quarter: quarter
      });

      await fetchMarkers(selectedVideoId);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  }, [selectedVideoId, currentTime, markerService, fetchMarkers]);

  // Jump to marker timestamp
  const handleJumpToMarker = useCallback((timestampMs: number) => {
    onSeekTo(timestampMs / 1000);
  }, [onSeekTo]);

  // Determine quarter from timestamp based on marker positions
  const getQuarterFromTimestamp = useCallback((timestampMs: number): number | undefined => {
    const quarterMarkers = markers
      .filter(m => ['game_start', 'quarter_start', 'quarter_end', 'halftime', 'game_end'].includes(m.marker_type))
      .sort((a, b) => a.virtual_timestamp_start_ms - b.virtual_timestamp_start_ms);

    if (quarterMarkers.length === 0) {
      return undefined;
    }

    let currentQuarter = 1;

    for (const marker of quarterMarkers) {
      if (timestampMs < marker.virtual_timestamp_start_ms) {
        break;
      }

      if (marker.marker_type === 'quarter_end' && marker.quarter) {
        currentQuarter = marker.quarter + 1;
      } else if (marker.marker_type === 'quarter_start' && marker.quarter) {
        currentQuarter = marker.quarter;
      } else if (marker.marker_type === 'halftime') {
        currentQuarter = 3;
      }
    }

    return Math.min(Math.max(currentQuarter, 1), 10);
  }, [markers]);

  return {
    markers,
    editingMarker,
    setEditingMarker,
    showPeriodMarkerMenu,
    setShowPeriodMarkerMenu,
    showAddMarkerMenu,
    setShowAddMarkerMenu,
    fetchMarkers,
    handleMarkerClick,
    handleMarkerSeekTo,
    handleUpdateMarker,
    handleDeleteMarker,
    handleQuickPeriodMarker,
    handleQuickAddMarker,
    handleCreateMarker,
    handleJumpToMarker,
    getQuarterFromTimestamp,
  };
}
