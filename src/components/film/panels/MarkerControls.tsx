'use client';

import React, { memo } from 'react';
import { Flag } from 'lucide-react';
import VideoTimelineMarkers from '@/components/film/VideoTimelineMarkers';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';

// ============================================
// TYPES
// ============================================

export interface MarkerControlsProps {
  markers: VideoTimelineMarker[];
  currentTimeMs: number;
  durationMs: number;
  showPeriodMarkerMenu: boolean;
  showAddMarkerMenu: boolean;
  onTogglePeriodMenu: () => void;
  onToggleAddMenu: () => void;
  onQuickPeriodMarker: (type: MarkerType, quarter?: number, label?: string) => void;
  onQuickAddMarker: (type: MarkerType, label: string) => void;
  onMarkerClick: (marker: VideoTimelineMarker) => void;
}

// ============================================
// COMPONENT
// ============================================

export const MarkerControls = memo(function MarkerControls({
  markers,
  currentTimeMs,
  durationMs,
  showPeriodMarkerMenu,
  showAddMarkerMenu,
  onTogglePeriodMenu,
  onToggleAddMenu,
  onQuickPeriodMarker,
  onQuickAddMarker,
  onMarkerClick,
}: MarkerControlsProps) {
  return (
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
              onClick={onTogglePeriodMenu}
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
                    onClick={() => onQuickPeriodMarker('game_start', 1, 'Game Start')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 rounded flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Start of Game
                  </button>
                  <button
                    onClick={() => onQuickPeriodMarker('game_end', undefined, 'Game End')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 rounded flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    End of Game
                  </button>
                </div>
                <div className="border-t p-2">
                  <p className="text-xs font-semibold text-gray-500 px-2 mb-1">QUARTERS</p>
                  <button
                    onClick={() => onQuickPeriodMarker('quarter_end', 1, 'End Q1')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                  >
                    End of Q1
                  </button>
                  <button
                    onClick={() => onQuickPeriodMarker('halftime', 2, 'Halftime')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 rounded"
                  >
                    Halftime (End Q2)
                  </button>
                  <button
                    onClick={() => onQuickPeriodMarker('quarter_end', 3, 'End Q3')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                  >
                    End of Q3
                  </button>
                  <button
                    onClick={() => onQuickPeriodMarker('quarter_end', 4, 'End Q4')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded"
                  >
                    End of Q4
                  </button>
                </div>
                <div className="border-t p-2">
                  <p className="text-xs font-semibold text-gray-500 px-2 mb-1">OVERTIME</p>
                  <button
                    onClick={() => onQuickPeriodMarker('overtime', 5, 'OT Start')}
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
              onClick={onToggleAddMenu}
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
                    onClick={() => onQuickAddMarker('big_play', 'Big Play')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 rounded flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Big Play
                  </button>
                  <button
                    onClick={() => onQuickAddMarker('turnover', 'Turnover')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 rounded flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Turnover
                  </button>
                  <button
                    onClick={() => onQuickAddMarker('timeout', 'Timeout')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 rounded flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Timeout
                  </button>
                  <button
                    onClick={() => onQuickAddMarker('custom', 'Custom')}
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
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        onMarkerClick={onMarkerClick}
      />
    </div>
  );
});

export default MarkerControls;
