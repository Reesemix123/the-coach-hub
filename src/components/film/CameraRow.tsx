'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Play, Check, Clock, Settings2, X, GripVertical, Link2 } from 'lucide-react';
import { SyncModal } from './SyncModal';

interface Camera {
  id: string;
  name: string;
  camera_label: string | null;
  camera_order: number;
  sync_offset_seconds: number;
  thumbnail_url: string | null;
  upload_status: 'pending' | 'processing' | 'ready' | 'failed';
  duration_seconds: number | null;
  is_primary_camera?: boolean;
  url?: string;
}

interface CameraRowProps {
  cameras: Camera[];
  selectedCameraId: string | null;
  onSelectCamera: (cameraId: string) => void;
  onAddCamera: () => void;
  onSyncCamera: (cameraId: string, offsetSeconds: number) => void;
  onReorderCameras?: (cameraIds: string[]) => void;
  cameraLimit: number;
  currentCameraCount: number;
  isUploading?: boolean;
  uploadProgress?: number;
}

export function CameraRow({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onAddCamera,
  onSyncCamera,
  onReorderCameras,
  cameraLimit,
  currentCameraCount,
  isUploading = false,
  uploadProgress = 0,
}: CameraRowProps) {
  const [showSyncModal, setShowSyncModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort cameras by camera_order
  const sortedCameras = [...cameras].sort((a, b) => a.camera_order - b.camera_order);

  const canAddMore = currentCameraCount < cameraLimit;
  const hasSecondaryCameras = sortedCameras.length > 1;

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatOffset = (seconds: number): string => {
    if (seconds === 0) return 'Synced';
    const sign = seconds > 0 ? '+' : '';
    return `${sign}${seconds}s`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Camera Angles ({currentCameraCount}/{cameraLimit})
        </h3>
        <div className="flex items-center gap-2">
          {hasSecondaryCameras && (
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Link2 size={14} />
              Sync Cameras
            </button>
          )}
          {canAddMore && !isUploading && (
            <button
              onClick={onAddCamera}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} />
              Add Camera
            </button>
          )}
          {!canAddMore && (
            <span className="text-xs text-gray-500">
              Upgrade for more cameras
            </span>
          )}
        </div>
      </div>

      {/* Camera thumbnails row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300"
      >
        {sortedCameras.map((camera) => {
          const isSelected = selectedCameraId === camera.id;
          const isPrimary = camera.camera_order === 1;
          const isReady = camera.upload_status === 'ready';

          return (
            <div
              key={camera.id}
              className={`relative flex-shrink-0 w-40 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => isReady && onSelectCamera(camera.id)}
            >
              {/* Thumbnail area */}
              <div className="relative h-24 bg-gray-900">
                {camera.thumbnail_url ? (
                  <img
                    src={camera.thumbnail_url}
                    alt={camera.camera_label || camera.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-gray-600 text-2xl">
                      {isPrimary ? '1' : camera.camera_order}
                    </div>
                  </div>
                )}

                {/* Status overlay */}
                {!isReady && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    {camera.upload_status === 'processing' && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-white text-xs">Processing</span>
                      </div>
                    )}
                    {camera.upload_status === 'pending' && (
                      <div className="flex flex-col items-center gap-1">
                        <Clock size={24} className="text-white" />
                        <span className="text-white text-xs">Pending</span>
                      </div>
                    )}
                    {camera.upload_status === 'failed' && (
                      <div className="flex flex-col items-center gap-1">
                        <X size={24} className="text-red-400" />
                        <span className="text-red-400 text-xs">Failed</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && isReady && (
                  <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Play size={12} className="text-white ml-0.5" />
                  </div>
                )}

                {/* Primary badge */}
                {isPrimary && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded">
                    PRIMARY
                  </div>
                )}

                {/* Sync button (non-primary only) */}
                {!isPrimary && isReady && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSyncModal(true);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
                    title="Sync cameras"
                  >
                    <Link2 size={12} className="text-white" />
                  </button>
                )}
              </div>

              {/* Camera info */}
              <div className="p-2 bg-white">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {camera.camera_label || `Camera ${camera.camera_order}`}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-500">
                    {formatDuration(camera.duration_seconds)}
                  </span>
                  {!isPrimary && camera.sync_offset_seconds !== 0 && (
                    <span className="text-[10px] text-orange-600 font-medium">
                      {formatOffset(camera.sync_offset_seconds)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Upload progress placeholder */}
        {isUploading && (
          <div className="relative flex-shrink-0 w-40 rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
            <div className="h-24 bg-gray-100 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 text-xs">{uploadProgress}%</span>
              </div>
            </div>
            <div className="p-2 bg-white">
              <div className="text-xs font-medium text-gray-500">Uploading...</div>
              <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Add camera button (empty state) */}
        {canAddMore && !isUploading && sortedCameras.length === 0 && (
          <button
            onClick={onAddCamera}
            className="flex-shrink-0 w-40 h-36 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <Plus size={24} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">Add Camera</span>
          </button>
        )}
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <SyncModal
          cameras={cameras}
          onClose={() => setShowSyncModal(false)}
          onSyncCamera={onSyncCamera}
        />
      )}
    </div>
  );
}

export default CameraRow;
