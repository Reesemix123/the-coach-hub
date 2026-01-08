'use client';

/**
 * TaggingFormContainer
 *
 * Container component for the play tagging modal.
 * Provides the modal structure, header, and video preview area.
 *
 * @module components/film/panels/TaggingFormContainer
 * @since Phase 3 - Component Decomposition
 */

import React, { type ReactNode } from 'react';
import { VideoClipPlayer } from '@/components/film/VideoClipPlayer';
import type { Video, PlayInstance } from '@/types/football';

// ============================================
// TYPES
// ============================================

export interface TaggingFormContainerProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Start timestamp for the tag */
  tagStartTime: number;
  /** End timestamp (optional) */
  tagEndTime: number | null;
  /** Play instance being edited (null for new) */
  editingInstance: PlayInstance | null;
  /** Selected video for preview */
  selectedVideo: Video | null;
  /** Header content (AI button, etc.) */
  headerActions?: ReactNode;
  /** Form content */
  children: ReactNode;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format seconds to MM:SS display
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// COMPONENT
// ============================================

/**
 * TaggingFormContainer - Modal container for play tagging
 */
export function TaggingFormContainer({
  isOpen,
  onClose,
  tagStartTime,
  tagEndTime,
  editingInstance,
  selectedVideo,
  headerActions,
  children,
}: TaggingFormContainerProps) {
  if (!isOpen || !selectedVideo) {
    return null;
  }

  const duration = tagEndTime ? Math.round(tagEndTime - tagStartTime) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-[95vw] h-[90vh] max-w-[1800px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {editingInstance ? 'Edit Play Tag' : 'Tag Play'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {formatTime(tagStartTime)}
              {tagEndTime && ` - ${formatTime(tagEndTime)}`}
              {duration !== null && (
                <span className="text-gray-900 ml-1">({duration}s)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {headerActions}

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Split Content: Video + Form */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Video Player */}
          {selectedVideo.url ? (
            <VideoClipPlayer
              videoUrl={selectedVideo.url}
              startTime={tagStartTime}
              endTime={tagEndTime || tagStartTime + 10}
            />
          ) : (
            <div className="w-full lg:w-[45%] bg-gray-800 flex items-center justify-center p-6">
              <div className="text-center text-gray-400">
                <p className="text-sm">No video URL available</p>
                <p className="text-xs mt-2">Please upload video or check storage</p>
              </div>
            </div>
          )}

          {/* Right: Form */}
          <div className="w-full lg:w-[55%] flex flex-col bg-white overflow-y-auto px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * TaggingFormSection - Section wrapper for form groups
 */
export function TaggingFormSection({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      {title && (
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{title}</h4>
      )}
      {description && (
        <p className="text-xs text-gray-600 mb-3">{description}</p>
      )}
      {children}
    </div>
  );
}

/**
 * TaggingFormRow - Row wrapper for inline form fields
 */
export function TaggingFormRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>{children}</div>
  );
}

/**
 * TaggingFormField - Wrapper for individual form fields
 */
export function TaggingFormField({
  label,
  required = false,
  error,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 min-w-[140px] ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default TaggingFormContainer;
