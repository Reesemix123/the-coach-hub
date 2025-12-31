'use client';

import { useState } from 'react';
import { X, Trash2, Clock, MapPin } from 'lucide-react';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { MARKER_COLORS, MARKER_LABELS } from '@/types/football';

interface EditMarkerModalProps {
  isOpen: boolean;
  marker: VideoTimelineMarker | null;
  currentVideoTimeMs: number;
  onClose: () => void;
  onUpdate: (markerId: string, updates: { label?: string; virtual_timestamp_start_ms?: number }) => void;
  onDelete: (markerId: string) => void;
  onSeekTo: (timeMs: number) => void;
}

export default function EditMarkerModal({
  isOpen,
  marker,
  currentVideoTimeMs,
  onClose,
  onUpdate,
  onDelete,
  onSeekTo
}: EditMarkerModalProps) {
  const [label, setLabel] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset state when marker changes
  if (marker && label === '' && marker.label) {
    setLabel(marker.label);
  }

  if (!isOpen || !marker) return null;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (marker) {
      onUpdate(marker.id, { label: label || undefined });
    }
    handleClose();
  };

  const handleMoveToCurrentTime = () => {
    if (marker) {
      onUpdate(marker.id, { virtual_timestamp_start_ms: currentVideoTimeMs });
    }
    handleClose();
  };

  const handleDelete = () => {
    if (marker) {
      onDelete(marker.id);
    }
    handleClose();
  };

  const handleClose = () => {
    setLabel('');
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleGoToMarker = () => {
    if (marker) {
      onSeekTo(marker.virtual_timestamp_start_ms);
    }
  };

  const color = marker.color || MARKER_COLORS[marker.marker_type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-lg font-semibold text-gray-900">Edit Marker</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Marker Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Type</div>
                <div className="font-medium text-gray-900">
                  {MARKER_LABELS[marker.marker_type]}
                  {marker.quarter && ` (Q${marker.quarter})`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">Timestamp</div>
                <button
                  onClick={handleGoToMarker}
                  className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Clock size={14} />
                  {formatTime(marker.virtual_timestamp_start_ms)}
                </button>
              </div>
            </div>
          </div>

          {/* Label Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={MARKER_LABELS[marker.marker_type]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          {/* Move to Current Time */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-900">Move Marker</div>
                <div className="text-sm text-blue-700">
                  Current video time: {formatTime(currentVideoTimeMs)}
                </div>
              </div>
              <button
                onClick={handleMoveToCurrentTime}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <MapPin size={14} />
                Move Here
              </button>
            </div>
          </div>

          {/* Delete Section */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-3 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Delete Marker
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm font-medium text-red-900 mb-3">
                Are you sure you want to delete this marker?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
