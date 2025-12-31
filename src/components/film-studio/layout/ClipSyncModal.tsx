'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Check, Anchor, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { CameraLane } from '@/types/timeline';
import { formatTimeMs } from '@/types/timeline';

// Create supabase client outside component to avoid recreation on each render
const supabase = createClient();

interface ClipSyncModalProps {
  currentLane: CameraLane;
  allLanes: CameraLane[];
  currentTimeMs: number;
  onClose: () => void;
  onSyncClips: (updates: Array<{ clipId: string; newPositionMs: number }>) => Promise<void>;
}

// Camera with the relevant clip for the sync point
interface CameraAtSyncPoint {
  lane: number;
  laneLabel: string;
  clipId: string;
  clipName: string;
  videoUrl: string;
  clipStartMs: number;      // When this clip starts on timeline
  clipEndMs: number;        // When this clip ends on timeline
  clipDurationMs: number;
  originalPositionMs: number;
  offsetMs: number;
  isAnchor: boolean;
  // Position within the clip at sync point
  syncPointInClipMs: number;
}

export function ClipSyncModal({
  currentLane,
  allLanes,
  currentTimeMs,
  onClose,
  onSyncClips,
}: ClipSyncModalProps) {
  // Step 1: Pick sync point, Step 2: Adjust cameras
  const [step, setStep] = useState<'pick-time' | 'adjust'>('pick-time');
  const [syncTimeMs, setSyncTimeMs] = useState(currentTimeMs);

  // Cameras at the sync point (one per lane that has coverage)
  const [cameras, setCameras] = useState<CameraAtSyncPoint[]>([]);
  const [anchorLane, setAnchorLane] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [failedClipIds, setFailedClipIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Video refs for each camera
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Calculate total timeline duration
  const totalDurationMs = Math.max(
    ...allLanes.flatMap(lane =>
      lane.clips.map(clip => clip.lanePositionMs + clip.durationMs)
    ),
    0
  );

  // Find which clip (if any) covers a given time for each lane
  const findClipsAtTime = useCallback((timeMs: number): CameraAtSyncPoint[] => {
    const result: CameraAtSyncPoint[] = [];

    for (const lane of allLanes) {
      // Find the clip that covers this time
      const clip = lane.clips.find(c => {
        const clipEnd = c.lanePositionMs + c.durationMs;
        return timeMs >= c.lanePositionMs && timeMs < clipEnd;
      });

      if (clip) {
        result.push({
          lane: lane.lane,
          laneLabel: lane.label,
          clipId: clip.id,
          clipName: clip.videoName,
          videoUrl: clip.videoUrl,
          clipStartMs: clip.lanePositionMs,
          clipEndMs: clip.lanePositionMs + clip.durationMs,
          clipDurationMs: clip.durationMs,
          originalPositionMs: clip.lanePositionMs,
          offsetMs: 0,
          isAnchor: false,
          syncPointInClipMs: timeMs - clip.lanePositionMs,
        });
      }
    }

    return result;
  }, [allLanes]);

  // When sync time changes in step 1, update preview of which cameras have coverage
  const camerasAtSyncTime = findClipsAtTime(syncTimeMs);

  // Proceed to step 2
  const handleConfirmSyncTime = useCallback(() => {
    const foundCameras = findClipsAtTime(syncTimeMs);

    if (foundCameras.length < 2) {
      alert('Need at least 2 cameras with footage at this time to sync.');
      return;
    }

    // Set first camera (from current lane if available) as anchor
    const anchorCamera = foundCameras.find(c => c.lane === currentLane.lane) || foundCameras[0];
    setAnchorLane(anchorCamera.lane);

    setCameras(foundCameras.map(cam => ({
      ...cam,
      isAnchor: cam.lane === anchorCamera.lane,
    })));

    setStep('adjust');
  }, [syncTimeMs, findClipsAtTime, currentLane.lane]);

  // Generate signed URLs for cameras
  useEffect(() => {
    if (step !== 'adjust') return;

    const generateUrls = async () => {
      for (const camera of cameras) {
        // Skip if already have URL, no source URL, or previously failed
        if (signedUrls[camera.clipId] || !camera.videoUrl || failedClipIds.has(camera.clipId)) continue;

        let finalUrl = camera.videoUrl;

        if (camera.videoUrl.includes('/object/public/')) {
          finalUrl = camera.videoUrl;
        } else if (camera.videoUrl.includes('/game_videos/')) {
          const urlParts = camera.videoUrl.split('/game_videos/');
          if (urlParts.length >= 2) {
            const filePath = urlParts[1].split('?')[0];
            try {
              const { data, error } = await supabase.storage
                .from('game_videos')
                .createSignedUrl(filePath, 3600);
              if (!error && data?.signedUrl) {
                finalUrl = data.signedUrl;
              }
            } catch (err) {
              console.log('[ClipSyncModal] Signed URL error:', err);
            }
          }
        }

        if (finalUrl) {
          setSignedUrls(prev => ({ ...prev, [camera.clipId]: finalUrl }));
        }
      }
    };

    if (cameras.length > 0) {
      generateUrls();
    }
  }, [step, cameras, signedUrls, failedClipIds]);

  // Seek videos to correct position when offset changes or videos load
  const seekVideoToSyncPoint = useCallback((camera: CameraAtSyncPoint) => {
    const video = videoRefs.current[camera.clipId];
    if (!video || !signedUrls[camera.clipId]) return;

    // For anchor: show the sync point within the clip
    // For others: show sync point adjusted by offset
    let targetTimeInClip: number;

    if (camera.isAnchor) {
      targetTimeInClip = camera.syncPointInClipMs;
    } else {
      // If offset is positive, this camera is ahead, so show earlier in clip
      // If offset is negative, this camera is behind, so show later in clip
      targetTimeInClip = camera.syncPointInClipMs - camera.offsetMs;
    }

    // Clamp to valid range
    targetTimeInClip = Math.max(0, Math.min(targetTimeInClip, camera.clipDurationMs));

    const targetSeconds = targetTimeInClip / 1000;

    if (Math.abs(video.currentTime - targetSeconds) > 0.05) {
      video.currentTime = targetSeconds;
    }
  }, [signedUrls]);

  // Seek all videos when cameras or offsets change
  useEffect(() => {
    if (step !== 'adjust' || isPlaying) return;

    cameras.forEach(camera => {
      seekVideoToSyncPoint(camera);
    });
  }, [step, cameras, seekVideoToSyncPoint, isPlaying]);

  // Update anchor
  const handleSetAnchor = useCallback((lane: number) => {
    setAnchorLane(lane);
    setCameras(prev => prev.map(cam => ({
      ...cam,
      isAnchor: cam.lane === lane,
      offsetMs: cam.lane === lane ? 0 : cam.offsetMs,
    })));
  }, []);

  // Update offset for a camera and seek video
  const updateOffset = useCallback((clipId: string, deltaMs: number) => {
    setCameras(prev => {
      const updated = prev.map(cam =>
        cam.clipId === clipId && !cam.isAnchor
          ? { ...cam, offsetMs: cam.offsetMs + deltaMs }
          : cam
      );
      return updated;
    });
  }, []);

  // Set absolute offset
  const setOffset = useCallback((clipId: string, offsetMs: number) => {
    setCameras(prev => prev.map(cam =>
      cam.clipId === clipId && !cam.isAnchor
        ? { ...cam, offsetMs }
        : cam
    ));
  }, []);

  // Reset offset
  const resetOffset = useCallback((clipId: string) => {
    setCameras(prev => prev.map(cam =>
      cam.clipId === clipId ? { ...cam, offsetMs: 0 } : cam
    ));
  }, []);

  // Reset all
  const resetAllOffsets = useCallback(() => {
    setCameras(prev => prev.map(cam => ({ ...cam, offsetMs: 0 })));
  }, []);

  // Play/pause
  const togglePlayback = useCallback(() => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);

    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        if (newPlaying) {
          video.play();
        } else {
          video.pause();
          // When pausing, seek back to sync point
          cameras.forEach(cam => seekVideoToSyncPoint(cam));
        }
      }
    });
  }, [isPlaying, cameras, seekVideoToSyncPoint]);

  // Video loaded - seek to sync point
  const handleVideoLoaded = useCallback((camera: CameraAtSyncPoint) => {
    seekVideoToSyncPoint(camera);
  }, [seekVideoToSyncPoint]);

  // Handle video load error - mark URL as failed
  const handleVideoError = useCallback((camera: CameraAtSyncPoint) => {
    console.error('[ClipSyncModal] Video failed to load:', camera.clipId, camera.clipName);
    // Mark as failed to prevent retries
    setFailedClipIds(prev => new Set([...prev, camera.clipId]));
    // Remove the failed URL from state to stop retry attempts
    setSignedUrls(prev => {
      const next = { ...prev };
      delete next[camera.clipId];
      return next;
    });
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    const updates = cameras
      .filter(cam => !cam.isAnchor && cam.offsetMs !== 0)
      .map(cam => ({
        clipId: cam.clipId,
        newPositionMs: Math.max(0, cam.originalPositionMs + cam.offsetMs),
      }));

    if (updates.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSyncClips(updates);
      onClose();
    } catch (err) {
      console.error('Failed to sync clips:', err);
    } finally {
      setIsSaving(false);
    }
  }, [cameras, onSyncClips, onClose]);

  const adjustedCount = cameras.filter(cam => !cam.isAnchor && cam.offsetMs !== 0).length;
  const gridCols = cameras.length <= 2 ? 'grid-cols-2' : cameras.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3';

  // Step 1: Pick sync time
  if (step === 'pick-time') {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sync Cameras
              </h2>
              <p className="text-sm text-gray-500">
                Step 1: Choose a point in the game to sync
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Clock size={16} />
                Select sync point on timeline
              </label>

              {/* Time slider */}
              <div className="mb-2">
                <input
                  type="range"
                  min={0}
                  max={totalDurationMs}
                  step={1000}
                  value={syncTimeMs}
                  onChange={(e) => setSyncTimeMs(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Time display */}
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatTimeMs(0)}</span>
                <span className="font-semibold text-blue-600 text-lg">
                  {formatTimeMs(syncTimeMs)}
                </span>
                <span>{formatTimeMs(totalDurationMs)}</span>
              </div>
            </div>

            {/* Preview which cameras have coverage */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Cameras with footage at {formatTimeMs(syncTimeMs)}:
              </p>

              {camerasAtSyncTime.length === 0 ? (
                <p className="text-sm text-red-500">
                  No cameras have footage at this time. Move the slider to find a point where cameras overlap.
                </p>
              ) : (
                <div className="space-y-2">
                  {camerasAtSyncTime.map(cam => (
                    <div
                      key={cam.clipId}
                      className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200"
                    >
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium text-gray-800">{cam.laneLabel}</span>
                      <span className="text-sm text-gray-500 truncate">{cam.clipName}</span>
                    </div>
                  ))}
                </div>
              )}

              {camerasAtSyncTime.length === 1 && (
                <p className="text-sm text-yellow-600 mt-2">
                  Only 1 camera has footage here. Move to a point where at least 2 cameras overlap.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSyncTime}
              disabled={camerasAtSyncTime.length < 2}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue with {camerasAtSyncTime.length} cameras
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Adjust cameras
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Sync Cameras at {formatTimeMs(syncTimeMs)}
            </h2>
            <p className="text-sm text-gray-500">
              Adjust each camera to match the anchor. Videos show the sync point.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('pick-time')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Clock size={14} />
              Change Time
            </button>
            {adjustedCount > 0 && (
              <button
                onClick={resetAllOffsets}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RotateCcw size={14} />
                Reset All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Camera Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className={`grid ${gridCols} gap-4`}>
            {cameras.map((camera) => {
              const hasUrl = !!signedUrls[camera.clipId];

              return (
                <div
                  key={camera.clipId}
                  className={`rounded-lg overflow-hidden ${
                    camera.isAnchor
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Camera Header */}
                  <button
                    onClick={() => handleSetAnchor(camera.lane)}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      camera.isAnchor
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {camera.isAnchor && <Anchor size={14} />}
                      <span className="font-semibold text-sm">{camera.laneLabel}</span>
                    </div>
                    <p className="text-xs opacity-80 truncate">{camera.clipName}</p>
                  </button>

                  {/* Video */}
                  <div className="aspect-video bg-black relative">
                    {hasUrl ? (
                      <video
                        ref={el => { videoRefs.current[camera.clipId] = el; }}
                        src={signedUrls[camera.clipId]}
                        className="w-full h-full object-contain"
                        onLoadedData={() => handleVideoLoaded(camera)}
                        onError={() => handleVideoError(camera)}
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                        {failedClipIds.has(camera.clipId)
                          ? 'Video failed to load'
                          : camera.videoUrl
                            ? 'Loading...'
                            : 'No video'}
                      </div>
                    )}

                    {/* Time indicator overlay */}
                    {hasUrl && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {camera.isAnchor
                          ? `Sync point: ${formatTimeMs(camera.syncPointInClipMs)}`
                          : `Showing: ${formatTimeMs(Math.max(0, camera.syncPointInClipMs - camera.offsetMs))}`
                        }
                      </div>
                    )}
                  </div>

                  {/* Controls (only for non-anchor cameras) */}
                  {!camera.isAnchor && (
                    <div className="p-2 bg-gray-100">
                      {/* Offset display */}
                      <div className="flex items-center justify-center mb-2">
                        <span className={`px-3 py-1 rounded text-sm font-mono ${
                          camera.offsetMs !== 0
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {camera.offsetMs >= 0 ? '+' : ''}{(camera.offsetMs / 1000).toFixed(1)}s
                        </span>
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min={-30000}
                        max={30000}
                        step={100}
                        value={camera.offsetMs}
                        onChange={(e) => setOffset(camera.clipId, parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />

                      {/* Fine-tune buttons */}
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <button
                          onClick={() => updateOffset(camera.clipId, -1000)}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          -1s
                        </button>
                        <button
                          onClick={() => updateOffset(camera.clipId, -100)}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          -.1s
                        </button>
                        <button
                          onClick={() => resetOffset(camera.clipId)}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                          title="Reset"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          onClick={() => updateOffset(camera.clipId, 100)}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          +.1s
                        </button>
                        <button
                          onClick={() => updateOffset(camera.clipId, 1000)}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          +1s
                        </button>
                      </div>

                      {/* Help text */}
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Adjust until this matches the anchor
                      </p>
                    </div>
                  )}

                  {/* Anchor badge */}
                  {camera.isAnchor && (
                    <div className="px-3 py-2 bg-blue-100 text-blue-700 text-xs text-center">
                      <Anchor size={12} className="inline mr-1" />
                      Anchor - Other cameras sync to this frame
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayback}
              disabled={cameras.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Pause' : 'Play All'}
            </button>
            <p className="text-sm text-gray-500">
              {adjustedCount > 0
                ? `${adjustedCount} camera${adjustedCount !== 1 ? 's' : ''} adjusted`
                : 'Adjust cameras to sync with anchor'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || adjustedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={18} />
              {isSaving ? 'Saving...' : 'Apply Sync'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClipSyncModal;
