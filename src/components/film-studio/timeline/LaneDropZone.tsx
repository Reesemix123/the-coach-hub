'use client';

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react';
import { Upload, Check, X, Edit2, Plus, Loader2, Link2 } from 'lucide-react';
import { SUGGESTED_LANE_LABELS } from '@/types/timeline';

interface LaneDropZoneProps {
  laneNumber: number;
  laneLabel: string;
  clipCount: number;
  isUploading: boolean;
  uploadProgress: number;
  canSync: boolean;  // True if there are other lanes with clips to sync against
  onUploadStart: (file: File) => void;
  onLabelChange: (label: string) => void;
  onAddVideoClick: () => void;
  onSyncClick?: () => void;  // Open sync modal for this lane
  addButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function LaneDropZone({
  laneNumber,
  laneLabel,
  clipCount,
  isUploading,
  uploadProgress,
  canSync,
  onUploadStart,
  onLabelChange,
  onAddVideoClick,
  onSyncClick,
  addButtonRef,
}: LaneDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(laneLabel);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when prop changes
  useEffect(() => {
    setLabelValue(laneLabel);
  }, [laneLabel]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer?.files || []);
      const videoFile = files.find((f) => f.type.startsWith('video/'));

      if (videoFile) {
        onUploadStart(videoFile);
      }
    },
    [onUploadStart]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('video/')) {
        onUploadStart(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onUploadStart]
  );

  const handleLabelSubmit = useCallback(() => {
    if (labelValue.trim()) {
      onLabelChange(labelValue.trim());
    }
    setIsEditingLabel(false);
    setShowLabelDropdown(false);
  }, [labelValue, onLabelChange]);

  const handleLabelCancel = useCallback(() => {
    setLabelValue(laneLabel);
    setIsEditingLabel(false);
    setShowLabelDropdown(false);
  }, [laneLabel]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setLabelValue(suggestion);
      onLabelChange(suggestion);
      setIsEditingLabel(false);
      setShowLabelDropdown(false);
    },
    [onLabelChange]
  );

  return (
    <div
      className={`
        w-40 flex-shrink-0 border-r border-gray-200 p-2
        flex flex-col justify-center relative
        transition-colors duration-150
        ${isDragOver
          ? 'bg-blue-50 border-blue-300'
          : isUploading
          ? 'bg-gray-100'
          : 'bg-gray-50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
          <Loader2 size={20} className="text-blue-500 animate-spin mb-1" />
          <span className="text-xs text-blue-600 font-medium">
            {Math.round(uploadProgress)}%
          </span>
        </div>
      )}

      {/* Drag over indicator */}
      {isDragOver && !isUploading && (
        <div className="absolute inset-0 bg-blue-100/80 flex flex-col items-center justify-center z-10 border-2 border-dashed border-blue-400 rounded">
          <Upload size={20} className="text-blue-500 mb-1" />
          <span className="text-xs text-blue-600 font-medium">Drop video</span>
        </div>
      )}

      {/* Label editing or display */}
      {isEditingLabel ? (
        <div className="relative">
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onFocus={() => setShowLabelDropdown(true)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSubmit();
              if (e.key === 'Escape') handleLabelCancel();
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleLabelSubmit}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleLabelCancel}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
            >
              <X size={14} />
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showLabelDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
              {SUGGESTED_LANE_LABELS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-700 truncate flex-1">
            {laneLabel}
          </span>
          <button
            onClick={() => setIsEditingLabel(true)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            title="Edit label"
          >
            <Edit2 size={12} />
          </button>
          {/* Add video button */}
          <button
            ref={addButtonRef}
            onClick={onAddVideoClick}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded flex items-center gap-0.5"
            title="Add existing video to this lane"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Clip count and actions */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {clipCount} clip{clipCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Sync button - only show if lane has clips and can sync with others */}
          {canSync && clipCount > 0 && onSyncClick && (
            <button
              onClick={onSyncClick}
              className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-1.5 py-0.5 rounded transition-colors"
              title="Sync clips with other camera angles"
            >
              <Link2 size={12} />
              <span>Sync</span>
            </button>
          )}
          {!isUploading && !isDragOver && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 hover:border-blue-300 transition-colors font-medium"
              title="Upload video to this camera"
            >
              <Upload size={12} />
              <span>Upload</span>
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

export default LaneDropZone;
