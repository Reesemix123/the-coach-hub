'use client';

import { useState, useEffect, useRef } from 'react';
import { Film, Circle, Square, Play, Trash2, X } from 'lucide-react';

interface Camera {
  id: string;
  name: string;
  camera_label: string | null;
  camera_order: number;
  sync_offset_seconds: number;
  url?: string;
}

interface CameraSelection {
  id: string;
  game_id: string;
  camera_id: string;
  start_seconds: number;
  end_seconds: number | null;
  videos?: {
    id: string;
    name: string;
    camera_label: string | null;
    camera_order: number;
    sync_offset_seconds: number;
  };
}

interface DirectorsCutProps {
  gameId: string;
  teamId: string;
  cameras: Camera[];
  currentTime: number;
  selectedCameraId: string | null;
  onCameraSwitch: (cameraId: string) => void;
  isPlaying: boolean;
}

export function DirectorsCut({
  gameId,
  teamId,
  cameras,
  currentTime,
  selectedCameraId,
  onCameraSwitch,
  isPlaying,
}: DirectorsCutProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [selections, setSelections] = useState<CameraSelection[]>([]);
  const [hasSelections, setHasSelections] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const lastRecordedCameraRef = useRef<string | null>(null);
  const lastPlaybackSwitchTimeRef = useRef<number>(-1);

  // Fetch existing camera selections on mount
  useEffect(() => {
    fetchSelections();
  }, [gameId, teamId]);

  // Handle recording: when camera changes during recording, save the selection
  useEffect(() => {
    if (isRecording && selectedCameraId && selectedCameraId !== lastRecordedCameraRef.current) {
      recordCameraSelection(selectedCameraId, currentTime);
      lastRecordedCameraRef.current = selectedCameraId;
    }
  }, [isRecording, selectedCameraId, currentTime]);

  // Handle playback: auto-switch cameras based on selections
  useEffect(() => {
    if (!isPlaybackMode || !isPlaying || selections.length === 0) return;

    // Find which camera should be playing at current time
    const activeSelection = selections.find(
      (s) => s.start_seconds <= currentTime && (s.end_seconds === null || s.end_seconds > currentTime)
    );

    if (activeSelection && activeSelection.camera_id !== selectedCameraId) {
      // Avoid rapid switching - only switch if we haven't switched in the last 0.5 seconds
      if (currentTime - lastPlaybackSwitchTimeRef.current > 0.5) {
        lastPlaybackSwitchTimeRef.current = currentTime;
        onCameraSwitch(activeSelection.camera_id);
      }
    }
  }, [isPlaybackMode, isPlaying, currentTime, selections, selectedCameraId, onCameraSwitch]);

  async function fetchSelections() {
    try {
      const response = await fetch(`/api/teams/${teamId}/games/${gameId}/camera-selections`);
      if (response.ok) {
        const data = await response.json();
        setSelections(data.selections || []);
        setHasSelections(data.hasSelections || false);
      }
    } catch (error) {
      console.error('Error fetching camera selections:', error);
    }
  }

  async function recordCameraSelection(cameraId: string, startTime: number) {
    try {
      const response = await fetch(`/api/teams/${teamId}/games/${gameId}/camera-selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_id: cameraId,
          start_seconds: startTime,
        }),
      });

      if (response.ok) {
        // Refresh selections
        fetchSelections();
      }
    } catch (error) {
      console.error('Error recording camera selection:', error);
    }
  }

  async function clearSelections() {
    if (!confirm('Clear all camera selections? This will reset your Director\'s Cut.')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams/${teamId}/games/${gameId}/camera-selections`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSelections([]);
        setHasSelections(false);
        setIsRecording(false);
        setIsPlaybackMode(false);
        lastRecordedCameraRef.current = null;
      }
    } catch (error) {
      console.error('Error clearing camera selections:', error);
    }
  }

  function startRecording() {
    setIsRecording(true);
    setIsPlaybackMode(false);
    lastRecordedCameraRef.current = selectedCameraId;
    // Record the initial camera selection
    if (selectedCameraId) {
      recordCameraSelection(selectedCameraId, currentTime);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    fetchSelections(); // Refresh to get the complete list
  }

  function startPlayback() {
    setIsPlaybackMode(true);
    setIsRecording(false);
    lastPlaybackSwitchTimeRef.current = -1;
  }

  function stopPlayback() {
    setIsPlaybackMode(false);
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCameraLabel = (cameraId: string): string => {
    const camera = cameras.find((c) => c.id === cameraId);
    return camera?.camera_label || camera?.name || 'Unknown';
  };

  // Don't show if only 1 camera
  if (cameras.length < 2) {
    return null;
  }

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          showPanel || isRecording || isPlaybackMode
            ? 'bg-purple-100 text-purple-700 border border-purple-300'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Film size={14} />
        Director's Cut
        {isRecording && (
          <span className="flex items-center gap-1 text-red-600">
            <Circle size={8} className="fill-red-600 animate-pulse" />
            REC
          </span>
        )}
        {isPlaybackMode && (
          <span className="flex items-center gap-1 text-green-600">
            <Play size={10} className="fill-green-600" />
            AUTO
          </span>
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 shadow-lg z-40">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Director's Cut</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Recording Controls */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Record your camera angle choices as you watch, then play back your custom cut.
              </p>

              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isPlaybackMode}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Circle size={12} className="fill-white" />
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900"
                  >
                    <Square size={12} className="fill-white" />
                    Stop Recording
                  </button>
                )}

                {hasSelections && !isRecording && (
                  <>
                    {!isPlaybackMode ? (
                      <button
                        onClick={startPlayback}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600"
                      >
                        <Play size={12} className="fill-white" />
                        Play Cut
                      </button>
                    ) : (
                      <button
                        onClick={stopPlayback}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700"
                      >
                        <Square size={12} />
                        Stop Auto
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-xs text-red-700">
                  <strong>Recording:</strong> Switch cameras while watching. Your selections are being saved automatically.
                </p>
              </div>
            )}

            {/* Playback Status */}
            {isPlaybackMode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <p className="text-xs text-green-700">
                  <strong>Auto-switching:</strong> Cameras will switch automatically based on your recorded selections.
                </p>
              </div>
            )}

            {/* Selections Timeline */}
            {hasSelections && selections.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">
                    Selections ({selections.length})
                  </span>
                  <button
                    onClick={clearSelections}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={12} />
                    Clear All
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selections.map((selection, index) => {
                    const isActive =
                      selection.start_seconds <= currentTime &&
                      (selection.end_seconds === null || selection.end_seconds > currentTime);

                    return (
                      <div
                        key={selection.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                          isActive ? 'bg-purple-100 border border-purple-300' : 'bg-gray-50'
                        }`}
                      >
                        <span className="font-mono text-gray-500">
                          {formatTime(selection.start_seconds)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="font-mono text-gray-500">
                          {selection.end_seconds ? formatTime(selection.end_seconds) : 'End'}
                        </span>
                        <span className={`ml-auto font-medium ${isActive ? 'text-purple-700' : 'text-gray-700'}`}>
                          {getCameraLabel(selection.camera_id)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasSelections && !isRecording && (
              <div className="text-center py-4 text-gray-500 text-xs">
                No camera selections yet. Start recording to create your Director's Cut.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DirectorsCut;
