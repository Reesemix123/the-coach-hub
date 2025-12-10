'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface Camera {
  id: string;
  name: string;
  camera_label: string | null;
  camera_order: number;
  sync_offset_seconds: number;
  thumbnail_url: string | null;
  upload_status: 'pending' | 'processing' | 'ready' | 'failed';
  duration_seconds: number | null;
  url?: string;
}

interface SyncModalProps {
  cameras: Camera[];
  onClose: () => void;
  onSyncCamera: (cameraId: string, offsetSeconds: number) => void;
}

type SyncStep = 'mark-primary' | 'sync-secondary';

export function SyncModal({ cameras, onClose, onSyncCamera }: SyncModalProps) {
  const sortedCameras = [...cameras].sort((a, b) => a.camera_order - b.camera_order);
  const primaryCamera = sortedCameras.find(c => c.camera_order === 1);
  const secondaryCameras = sortedCameras.filter(c => c.camera_order !== 1);

  const [step, setStep] = useState<SyncStep>('mark-primary');
  const [primaryMark, setPrimaryMark] = useState<number | null>(null);
  const [activeSyncCameraId, setActiveSyncCameraId] = useState<string | null>(null);
  const [isPrimaryPlaying, setIsPrimaryPlaying] = useState(false);
  const [isSecondaryPlaying, setIsSecondaryPlaying] = useState(false);
  const [primaryCurrentTime, setPrimaryCurrentTime] = useState(0);
  const [secondaryCurrentTime, setSecondaryCurrentTime] = useState(0);

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const activeSyncCamera = secondaryCameras.find(c => c.id === activeSyncCameraId);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format offset with sign
  const formatOffset = (seconds: number): string => {
    if (seconds === 0) return '0s';
    const sign = seconds > 0 ? '+' : '';
    return `${sign}${seconds}s`;
  };

  // Handle primary video time updates
  useEffect(() => {
    const video = primaryVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setPrimaryCurrentTime(video.currentTime);
    const handlePlay = () => setIsPrimaryPlaying(true);
    const handlePause = () => setIsPrimaryPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  // Handle secondary video time updates
  useEffect(() => {
    const video = secondaryVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setSecondaryCurrentTime(video.currentTime);
    const handlePlay = () => setIsSecondaryPlaying(true);
    const handlePause = () => setIsSecondaryPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [activeSyncCameraId]);

  const togglePrimaryPlay = () => {
    if (primaryVideoRef.current) {
      if (isPrimaryPlaying) {
        primaryVideoRef.current.pause();
      } else {
        primaryVideoRef.current.play();
      }
    }
  };

  const toggleSecondaryPlay = () => {
    if (secondaryVideoRef.current) {
      if (isSecondaryPlaying) {
        secondaryVideoRef.current.pause();
      } else {
        secondaryVideoRef.current.play();
      }
    }
  };

  const seekPrimary = (delta: number) => {
    if (primaryVideoRef.current) {
      primaryVideoRef.current.currentTime = Math.max(0, primaryVideoRef.current.currentTime + delta);
    }
  };

  const seekSecondary = (delta: number) => {
    if (secondaryVideoRef.current) {
      secondaryVideoRef.current.currentTime = Math.max(0, secondaryVideoRef.current.currentTime + delta);
    }
  };

  const handleMarkPrimary = () => {
    if (primaryVideoRef.current) {
      primaryVideoRef.current.pause();
      setPrimaryMark(Math.floor(primaryVideoRef.current.currentTime));
      setStep('sync-secondary');
    }
  };

  const handleStartSyncCamera = (cameraId: string) => {
    setActiveSyncCameraId(cameraId);
    setIsSecondaryPlaying(false);
    setSecondaryCurrentTime(0);
  };

  const handleCancelSyncCamera = () => {
    setActiveSyncCameraId(null);
    setIsSecondaryPlaying(false);
  };

  const handleSaveCameraSync = () => {
    if (activeSyncCameraId && primaryMark !== null && secondaryVideoRef.current) {
      // Calculate offset: secondary_mark - primary_mark
      // Positive = secondary starts after primary
      // Negative = secondary starts before primary
      const secondaryMark = Math.floor(secondaryVideoRef.current.currentTime);
      const offset = secondaryMark - primaryMark;
      onSyncCamera(activeSyncCameraId, offset);
      setActiveSyncCameraId(null);
    }
  };

  const handleResetPrimaryMark = () => {
    setPrimaryMark(null);
    setStep('mark-primary');
    setActiveSyncCameraId(null);
  };

  const getCameraSyncStatus = (camera: Camera): 'synced' | 'not-synced' => {
    // A camera is considered synced if it has a non-null offset that was set
    // For now, we'll consider any camera with offset !== 0 as explicitly synced
    // or if offset is 0 and it's been through the sync flow
    return camera.sync_offset_seconds !== 0 ? 'synced' : 'not-synced';
  };

  if (!primaryCamera) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md mx-4">
          <p className="text-gray-900">No primary camera found.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-black text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Sync Cameras</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Mark Primary */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'mark-primary' ? 'bg-black text-white' : 'bg-green-500 text-white'
              }`}>
                {primaryMark !== null ? <Check size={14} /> : '1'}
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                Mark a moment on the Primary Camera
              </h3>
              {primaryMark !== null && (
                <button
                  onClick={handleResetPrimaryMark}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>

            {primaryMark !== null ? (
              // Show frozen frame indicator
              <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-4">
                <div className="w-32 h-20 bg-gray-900 rounded flex items-center justify-center text-white text-sm">
                  {formatTime(primaryMark)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {primaryCamera.camera_label || 'Primary Camera'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Marked at {formatTime(primaryMark)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Find this same moment on each secondary camera below
                  </p>
                </div>
              </div>
            ) : (
              // Show video player for marking
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="aspect-video relative">
                  {primaryCamera.url ? (
                    <video
                      ref={primaryVideoRef}
                      src={primaryCamera.url}
                      className="w-full h-full object-contain"
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      No video URL available
                    </div>
                  )}

                  {/* Time overlay */}
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded-lg">
                    <span className="text-white text-lg font-mono">
                      {formatTime(primaryCurrentTime)}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="p-4 bg-gray-800">
                  <p className="text-gray-300 text-sm mb-3 text-center">
                    Find a recognizable moment (snap, whistle, big play) and mark it
                  </p>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <button
                      onClick={() => seekPrimary(-5)}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      5s
                    </button>
                    <button
                      onClick={() => seekPrimary(-1)}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      1s
                    </button>
                    <button
                      onClick={togglePrimaryPlay}
                      className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200"
                    >
                      {isPrimaryPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                    </button>
                    <button
                      onClick={() => seekPrimary(1)}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                    >
                      1s
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => seekPrimary(5)}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                    >
                      5s
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <button
                    onClick={handleMarkPrimary}
                    className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    Mark This Moment: {formatTime(primaryCurrentTime)}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Sync Secondary Cameras */}
          {step === 'sync-secondary' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Find that same moment on each camera
                </h3>
              </div>

              {/* Active sync camera (expanded view) */}
              {activeSyncCamera && (
                <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
                  <div className="p-3 bg-gray-800 flex items-center justify-between">
                    <span className="text-white font-medium">
                      {activeSyncCamera.camera_label || `Camera ${activeSyncCamera.camera_order}`}
                    </span>
                    <button
                      onClick={handleCancelSyncCamera}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="aspect-video relative">
                    {activeSyncCamera.url ? (
                      <video
                        ref={secondaryVideoRef}
                        src={activeSyncCamera.url}
                        className="w-full h-full object-contain"
                        playsInline
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No video URL available
                      </div>
                    )}

                    {/* Time overlay */}
                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded-lg">
                      <span className="text-white text-lg font-mono">
                        {formatTime(secondaryCurrentTime)}
                      </span>
                    </div>

                    {/* Reference time reminder */}
                    <div className="absolute top-4 right-4 bg-yellow-500 px-3 py-1.5 rounded-lg">
                      <span className="text-black text-sm font-medium">
                        Primary: {formatTime(primaryMark || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="p-4 bg-gray-800">
                    <p className="text-gray-300 text-sm mb-3 text-center">
                      Find the same moment you marked on the primary camera ({formatTime(primaryMark || 0)})
                    </p>

                    <div className="flex items-center justify-center gap-2 mb-4">
                      <button
                        onClick={() => seekSecondary(-5)}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                      >
                        <ChevronLeft size={16} />
                        5s
                      </button>
                      <button
                        onClick={() => seekSecondary(-1)}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                      >
                        <ChevronLeft size={16} />
                        1s
                      </button>
                      <button
                        onClick={toggleSecondaryPlay}
                        className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200"
                      >
                        {isSecondaryPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                      </button>
                      <button
                        onClick={() => seekSecondary(1)}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                      >
                        1s
                        <ChevronRight size={16} />
                      </button>
                      <button
                        onClick={() => seekSecondary(5)}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1"
                      >
                        5s
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <button
                      onClick={handleSaveCameraSync}
                      className="w-full py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-400 transition-colors"
                    >
                      Mark & Save Sync
                    </button>
                  </div>
                </div>
              )}

              {/* Secondary camera thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {secondaryCameras.map((camera) => {
                  const isActive = camera.id === activeSyncCameraId;
                  const syncStatus = getCameraSyncStatus(camera);
                  const isSynced = syncStatus === 'synced';

                  if (isActive) return null; // Don't show thumbnail for active camera

                  return (
                    <div
                      key={camera.id}
                      className={`rounded-lg overflow-hidden border-2 ${
                        isSynced ? 'border-green-500' : 'border-gray-200'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative h-20 bg-gray-900 flex items-center justify-center">
                        {camera.thumbnail_url ? (
                          <img
                            src={camera.thumbnail_url}
                            alt={camera.camera_label || camera.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-600 text-xl">
                            {camera.camera_order}
                          </span>
                        )}

                        {/* Sync status badge */}
                        {isSynced && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info and action */}
                      <div className="p-2 bg-white">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {camera.camera_label || `Camera ${camera.camera_order}`}
                        </p>
                        {isSynced ? (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-green-600 font-medium">
                              {formatOffset(camera.sync_offset_seconds)}
                            </span>
                            <button
                              onClick={() => handleStartSyncCamera(camera.id)}
                              className="text-[10px] text-gray-500 hover:text-gray-700"
                            >
                              Re-sync
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartSyncCamera(camera.id)}
                            className="w-full mt-1 py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors"
                          >
                            Sync
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default SyncModal;
