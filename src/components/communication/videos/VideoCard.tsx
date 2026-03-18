'use client';

import React, { memo } from 'react';
import { Video, Clock, Users, User, Check, AlertCircle, Loader2, Eye } from 'lucide-react';

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    description: string | null;
    coach_notes: string | null;
    share_type: 'team' | 'individual';
    mux_asset_status: string;
    duration_seconds: number | null;
    publish_confirmed: boolean;
    created_at: string;
    thumbnail_url?: string | null;
    viewed_at?: string | null;
    view_count?: number;
  };
  isCoachView?: boolean;
  onPublish?: (videoId: string) => void;
  onWatch?: (videoId: string) => void;
  onDelete?: (videoId: string) => void;
}

type StatusKey = 'preparing' | 'ready' | 'errored';

interface StatusConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  animate: boolean;
}

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  preparing: { icon: Loader2, label: 'Processing', color: 'text-amber-600', animate: true },
  ready: { icon: Check, label: 'Ready', color: 'text-green-600', animate: false },
  errored: { icon: AlertCircle, label: 'Error', color: 'text-red-600', animate: false },
};

const FALLBACK_STATUS: StatusConfig = {
  icon: Loader2,
  label: 'Unknown',
  color: 'text-gray-500',
  animate: false,
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VideoCard = memo(function VideoCard({
  video,
  isCoachView = false,
  onPublish,
  onWatch,
  onDelete,
}: VideoCardProps) {
  const statusConfig =
    STATUS_CONFIG[video.mux_asset_status as StatusKey] ?? FALLBACK_STATUS;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail / Placeholder */}
      <div
        className="relative aspect-video bg-gray-900 cursor-pointer group"
        onClick={() => onWatch?.(video.id)}
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-12 h-12 text-gray-600" />
          </div>
        )}

        {/* Duration badge */}
        {video.duration_seconds && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(video.duration_seconds)}
          </div>
        )}

        {/* Play overlay */}
        {video.mux_asset_status === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
              {/* Triangle play icon drawn with borders to avoid extra dependencies */}
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-gray-900 border-b-[10px] border-b-transparent ml-1" />
            </div>
          </div>
        )}

        {/* View count (parent view) */}
        {!isCoachView && video.view_count !== undefined && video.view_count > 0 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {video.view_count}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{video.title}</h3>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              video.share_type === 'team' ? 'text-blue-600' : 'text-purple-600'
            }`}
          >
            {video.share_type === 'team' ? (
              <Users className="w-3.5 h-3.5" />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
            {video.share_type === 'team' ? 'Team' : 'Individual'}
          </span>
        </div>

        {video.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{video.description}</p>
        )}

        {video.coach_notes && !isCoachView && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Coach&apos;s Notes</p>
            <p className="text-sm text-gray-700">{video.coach_notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          {/* Status */}
          <div className={`flex items-center gap-1.5 ${statusConfig.color}`}>
            <StatusIcon
              className={`w-4 h-4 ${statusConfig.animate ? 'animate-spin' : ''}`}
            />
            <span className="font-medium">{statusConfig.label}</span>
            {!video.publish_confirmed &&
              video.mux_asset_status === 'ready' &&
              isCoachView && (
                <span className="text-amber-600 ml-1">· Unpublished</span>
              )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">{formatTimestamp(video.created_at)}</span>
          </div>
        </div>

        {/* Coach Actions */}
        {isCoachView && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            {!video.publish_confirmed && video.mux_asset_status === 'ready' && (
              <button
                onClick={() => onPublish?.(video.id)}
                className="flex-1 px-3 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Publish
              </button>
            )}
            {video.mux_asset_status === 'ready' && (
              <button
                onClick={() => onWatch?.(video.id)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Preview
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(video.id)}
                className="px-3 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
