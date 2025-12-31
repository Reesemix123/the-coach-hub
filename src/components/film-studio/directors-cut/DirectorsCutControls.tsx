'use client';

import { useState, useCallback } from 'react';
import { Circle, Play, Trash2, Film, ChevronDown, ChevronUp } from 'lucide-react';
import { formatTimeMs } from '@/types/timeline';
import type { CameraInfo, CameraSelection } from '../context/FilmStudioContext';

interface DirectorsCutControlsProps {
  cameras: CameraInfo[];
  cameraSelections: CameraSelection[];
  isRecording: boolean;
  isPlaybackMode: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStartPlayback: () => void;
  onStopPlayback: () => void;
  onClearSelections: () => void;
}

export function DirectorsCutControls({
  cameras,
  cameraSelections,
  isRecording,
  isPlaybackMode,
  onStartRecording,
  onStopRecording,
  onStartPlayback,
  onStopPlayback,
  onClearSelections,
}: DirectorsCutControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show if there are multiple cameras
  if (cameras.length < 2) {
    return null;
  }

  const hasSelections = cameraSelections.length > 0;

  // Get camera label by ID
  const getCameraLabel = (cameraId: string): string => {
    const camera = cameras.find((c) => c.id === cameraId);
    return camera?.label || 'Unknown';
  };

  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  }, [isRecording, onStartRecording, onStopRecording]);

  const handlePlaybackToggle = useCallback(() => {
    if (isPlaybackMode) {
      onStopPlayback();
    } else {
      onStartPlayback();
    }
  }, [isPlaybackMode, onStartPlayback, onStopPlayback]);

  const handleClear = useCallback(() => {
    if (confirm('Clear all camera selections? This cannot be undone.')) {
      onClearSelections();
    }
  }, [onClearSelections]);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Film size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Director&apos;s Cut
          </span>
          {hasSelections && (
            <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
              {cameraSelections.length} cuts
            </span>
          )}
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <Circle size={8} className="fill-red-500 animate-pulse" />
              REC
            </span>
          )}
          {isPlaybackMode && (
            <span className="text-xs text-green-600 font-medium">AUTO</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 space-y-3">
          {/* Description */}
          <p className="text-xs text-gray-500">
            Record your camera selections as you watch. During playback, cameras
            will switch automatically at your recorded timestamps.
          </p>

          {/* Controls */}
          <div className="flex gap-2">
            {/* Recording button */}
            <button
              onClick={handleRecordToggle}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              `}
              disabled={isPlaybackMode}
            >
              <Circle
                size={12}
                className={isRecording ? 'fill-white' : ''}
              />
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {/* Playback button */}
            {hasSelections && (
              <button
                onClick={handlePlaybackToggle}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${
                    isPlaybackMode
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}
                disabled={isRecording}
              >
                <Play size={14} className={isPlaybackMode ? 'fill-white' : ''} />
                {isPlaybackMode ? 'Stop Auto' : 'Play Cut'}
              </button>
            )}
          </div>

          {/* Selections list */}
          {hasSelections && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Camera Selections</span>
                <button
                  onClick={handleClear}
                  className="text-red-500 hover:text-red-600 flex items-center gap-1"
                  disabled={isRecording || isPlaybackMode}
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto bg-white border border-gray-100 rounded">
                {cameraSelections.map((selection, index) => (
                  <div
                    key={selection.id}
                    className="px-2 py-1.5 text-xs flex items-center justify-between border-b border-gray-50 last:border-b-0"
                  >
                    <span className="font-medium text-gray-700">
                      {getCameraLabel(selection.camera_id)}
                    </span>
                    <span className="text-gray-500 tabular-nums">
                      {formatTimeMs(selection.start_seconds * 1000)}
                      {selection.end_seconds !== null && (
                        <> → {formatTimeMs(selection.end_seconds * 1000)}</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status messages */}
          {isRecording && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
              Recording... Switch cameras while playing to record your selections.
            </div>
          )}
          {isPlaybackMode && (
            <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded">
              Auto-switching cameras based on your recorded selections.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DirectorsCutControls;
