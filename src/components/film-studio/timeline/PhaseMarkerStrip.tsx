'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, PlayCircle, Flag, Clock, StopCircle } from 'lucide-react';
import { DraggablePhaseMarker } from './DraggablePhaseMarker';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { timeToPixels, pixelsToTime, formatTimeMs } from '@/types/timeline';

// Game phase marker types
const PHASE_MARKER_TYPES: { type: MarkerType; label: string; icon: React.ReactNode }[] = [
  { type: 'game_start', label: 'Game Start', icon: <PlayCircle size={14} /> },
  { type: 'quarter_start', label: 'Q1 Start', icon: <Flag size={14} /> },
  { type: 'quarter_start', label: 'Q2 Start', icon: <Flag size={14} /> },
  { type: 'halftime', label: 'Halftime', icon: <Clock size={14} /> },
  { type: 'quarter_start', label: 'Q3 Start', icon: <Flag size={14} /> },
  { type: 'quarter_start', label: 'Q4 Start', icon: <Flag size={14} /> },
  { type: 'game_end', label: 'Game End', icon: <StopCircle size={14} /> },
];

interface PhaseMarkerStripProps {
  markers: VideoTimelineMarker[];
  durationMs: number;
  zoomLevel: number;
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
  onMarkerDragEnd?: (markerId: string, newPositionMs: number) => void;
  onMarkerAdd?: (type: MarkerType, positionMs: number, label?: string) => void;
  onMarkerDelete?: (markerId: string) => void;
}

export function PhaseMarkerStrip({
  markers,
  durationMs,
  zoomLevel,
  selectedMarkerId,
  onMarkerSelect,
  onMarkerDragEnd,
  onMarkerAdd,
  onMarkerDelete,
}: PhaseMarkerStripProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPosition, setAddMenuPosition] = useState({ x: 0, timeMs: 0 });
  const stripRef = useRef<HTMLDivElement>(null);

  // Handle click on empty area to add a marker
  const handleStripClick = useCallback(
    (e: React.MouseEvent) => {
      if (!stripRef.current || !onMarkerAdd) return;

      const rect = stripRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const timeMs = pixelsToTime(clickX, zoomLevel);

      setAddMenuPosition({ x: clickX, timeMs });
      setShowAddMenu(true);
    },
    [zoomLevel, onMarkerAdd]
  );

  const handleAddMarker = useCallback(
    (type: MarkerType, label: string) => {
      onMarkerAdd?.(type, addMenuPosition.timeMs, label);
      setShowAddMenu(false);
    },
    [onMarkerAdd, addMenuPosition.timeMs]
  );

  // Calculate strip width
  const stripWidth = timeToPixels(durationMs, zoomLevel);

  return (
    <div className="relative">
      {/* Strip background */}
      <div
        ref={stripRef}
        className="h-10 bg-gradient-to-b from-gray-50 to-gray-100 border-b border-gray-200 relative overflow-visible cursor-crosshair"
        style={{ width: Math.max(stripWidth, 600) }}
        onClick={handleStripClick}
      >
        {/* Hint text when no markers */}
        {markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
            Click to add game phase markers
          </div>
        )}

        {/* Render markers */}
        {markers.map((marker) => (
          <DraggablePhaseMarker
            key={marker.id}
            marker={marker}
            zoomLevel={zoomLevel}
            isSelected={selectedMarkerId === marker.id}
            onSelect={() => onMarkerSelect?.(marker.id)}
            onDelete={() => onMarkerDelete?.(marker.id)}
          />
        ))}
      </div>

      {/* Add marker menu */}
      {showAddMenu && onMarkerAdd && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowAddMenu(false)}
          />

          {/* Menu */}
          <div
            className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48"
            style={{
              left: addMenuPosition.x,
              top: '100%',
              transform: 'translateX(-50%)',
              marginTop: 4,
            }}
          >
            <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
              Add marker at {formatTimeMs(addMenuPosition.timeMs)}
            </div>

            <div className="max-h-48 overflow-y-auto">
              {PHASE_MARKER_TYPES.map((item, index) => (
                <button
                  key={`${item.type}-${index}`}
                  onClick={() => handleAddMarker(item.type, item.label)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Quick add button (fixed position) */}
      {onMarkerAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Add at beginning if no markers, otherwise at current playhead
            const position = markers.length === 0 ? 0 : durationMs / 2;
            setAddMenuPosition({ x: timeToPixels(position, zoomLevel), timeMs: position });
            setShowAddMenu(true);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1"
          title="Add phase marker"
        >
          <Plus size={12} className="text-gray-600" />
          <span className="text-xs text-gray-600 font-medium">Add Marker</span>
        </button>
      )}
    </div>
  );
}

export default PhaseMarkerStrip;
