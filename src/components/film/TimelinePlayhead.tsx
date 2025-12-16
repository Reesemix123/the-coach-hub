'use client';

import { timeToPixels } from '@/types/timeline';

interface TimelinePlayheadProps {
  positionMs: number;
  zoomLevel: number;
  height: number;
}

export function TimelinePlayhead({
  positionMs,
  zoomLevel,
  height,
}: TimelinePlayheadProps) {
  const left = timeToPixels(positionMs, zoomLevel);

  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{
        left,
        height,
      }}
    >
      {/* Vertical line */}
      <div className="w-0.5 h-full bg-red-500" />

      {/* Top triangle indicator */}
      <div
        className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '8px solid #ef4444',
        }}
      />

      {/* Bottom triangle indicator */}
      <div
        className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: '8px solid #ef4444',
        }}
      />
    </div>
  );
}

export default TimelinePlayhead;
