'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Check } from 'lucide-react';
import type { CameraInfo } from '../context/FilmStudioContext';

interface CameraSyncModalProps {
  cameras: CameraInfo[];
  primaryCameraId: string | null;
  currentTimeMs: number;
  onClose: () => void;
  onUpdateSync: (cameraId: string, offsetSeconds: number) => Promise<void>;
}

export function CameraSyncModal({
  cameras,
  primaryCameraId,
  currentTimeMs,
  onClose,
  onUpdateSync,
}: CameraSyncModalProps) {
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(
    cameras.find((c) => c.id !== primaryCameraId)?.id || null
  );
  const [offset, setOffset] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const primaryCamera = cameras.find((c) => c.id === primaryCameraId);
  const selectedCamera = cameras.find((c) => c.id === selectedCameraId);

  // Initialize offset from selected camera
  useEffect(() => {
    if (selectedCamera) {
      setOffset(selectedCamera.syncOffsetSeconds);
    }
  }, [selectedCamera]);

  // Seek both videos to current time when modal opens
  useEffect(() => {
    if (primaryVideoRef.current && primaryCamera) {
      const primaryTime = currentTimeMs / 1000;
      primaryVideoRef.current.currentTime = primaryTime;
    }
  }, [currentTimeMs, primaryCamera]);

  // Apply offset to secondary video
  useEffect(() => {
    if (secondaryVideoRef.current && primaryVideoRef.current) {
      const primaryTime = primaryVideoRef.current.currentTime;
      secondaryVideoRef.current.currentTime = Math.max(0, primaryTime - offset);
    }
  }, [offset]);

  const handleOffsetChange = useCallback((delta: number) => {
    setOffset((prev) => Math.round((prev + delta) * 10) / 10);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedCameraId) return;

    setIsSaving(true);
    try {
      await onUpdateSync(selectedCameraId, offset);
      onClose();
    } catch (err) {
      console.error('Failed to save sync:', err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedCameraId, offset, onUpdateSync, onClose]);

  const handleReset = useCallback(() => {
    setOffset(0);
  }, []);

  const togglePreview = useCallback(() => {
    if (previewPlaying) {
      primaryVideoRef.current?.pause();
      secondaryVideoRef.current?.pause();
    } else {
      primaryVideoRef.current?.play();
      secondaryVideoRef.current?.play();
    }
    setPreviewPlaying(!previewPlaying);
  }, [previewPlaying]);

  // Sync secondary video time with primary
  const handlePrimaryTimeUpdate = useCallback(() => {
    if (primaryVideoRef.current && secondaryVideoRef.current) {
      const primaryTime = primaryVideoRef.current.currentTime;
      const targetTime = Math.max(0, primaryTime - offset);

      // Only adjust if significantly out of sync
      if (Math.abs(secondaryVideoRef.current.currentTime - targetTime) > 0.1) {
        secondaryVideoRef.current.currentTime = targetTime;
      }
    }
  }, [offset]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Sync Cameras
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Camera selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Camera to sync
            </label>
            <div className="flex gap-2 flex-wrap">
              {cameras
                .filter((c) => c.id !== primaryCameraId)
                .map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setSelectedCameraId(cam.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCameraId === cam.id
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Video preview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Primary camera */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">
                {primaryCamera?.label || 'Primary'} (Reference)
              </p>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {primaryCamera?.url ? (
                  <video
                    ref={primaryVideoRef}
                    src={primaryCamera.url}
                    className="w-full h-full object-contain"
                    onTimeUpdate={handlePrimaryTimeUpdate}
                    muted
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    No video
                  </div>
                )}
              </div>
            </div>

            {/* Secondary camera */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">
                {selectedCamera?.label || 'Select a camera'} (Offset: {offset >= 0 ? '+' : ''}{offset.toFixed(1)}s)
              </p>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {selectedCamera?.url ? (
                  <video
                    ref={secondaryVideoRef}
                    src={selectedCamera.url}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Select a camera
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Offset controls */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-4">
              {/* Coarse adjustment */}
              <button
                onClick={() => handleOffsetChange(-1)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                -1s
              </button>
              <button
                onClick={() => handleOffsetChange(-0.1)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                -0.1s
              </button>

              {/* Current offset display */}
              <div className="px-6 py-2 bg-black text-white rounded-lg font-mono text-lg min-w-[100px] text-center">
                {offset >= 0 ? '+' : ''}{offset.toFixed(1)}s
              </div>

              <button
                onClick={() => handleOffsetChange(0.1)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                +0.1s
              </button>
              <button
                onClick={() => handleOffsetChange(1)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                +1s
              </button>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Reset to 0"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-2">
              Positive offset = camera is ahead (started earlier). Negative = camera is behind.
            </p>
          </div>

          {/* Preview playback */}
          <div className="flex items-center justify-center mb-4">
            <button
              onClick={togglePreview}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {previewPlaying ? <Pause size={18} /> : <Play size={18} />}
              {previewPlaying ? 'Pause Preview' : 'Play Preview'}
            </button>
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
            onClick={handleSave}
            disabled={!selectedCameraId || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={18} />
            {isSaving ? 'Saving...' : 'Save Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CameraSyncModal;
