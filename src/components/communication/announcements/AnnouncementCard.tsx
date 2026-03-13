'use client';

import React, { memo } from 'react';
import { Clock, Users, AlertCircle } from 'lucide-react';
import { Announcement, AnnouncementPriority, PositionGroup } from '@/types/communication';

interface AnnouncementCardProps {
  announcement: Announcement;
  isRead: boolean;
  onMarkRead?: () => void;
  showReadReceipts?: boolean;
}

const PRIORITY_CONFIG: Record<AnnouncementPriority, { color: string; bgColor: string; label: string }> = {
  normal: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Normal' },
  important: { color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Important' },
  urgent: { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Urgent' },
};

const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  offense: 'Offense',
  defense: 'Defense',
  special_teams: 'Special Teams',
};

export const AnnouncementCard = memo(function AnnouncementCard({
  announcement,
  isRead,
  onMarkRead,
  showReadReceipts = false,
}: AnnouncementCardProps) {
  const priorityConfig = PRIORITY_CONFIG[announcement.priority];

  const handleClick = () => {
    if (!isRead && onMarkRead) {
      onMarkRead();
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
      onClick={handleClick}
    >
      {/* Unread indicator (parent view) */}
      {!isRead && !showReadReceipts && (
        <div className="absolute left-0 top-6 w-2 h-2 bg-blue-500 rounded-full -ml-1" />
      )}

      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {/* Priority badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
            >
              {announcement.priority === 'urgent' && <AlertCircle className="w-3 h-3" />}
              {priorityConfig.label}
            </span>

            {/* Position group tag */}
            {announcement.target_position_group && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <Users className="w-3 h-3" />
                {POSITION_GROUP_LABELS[announcement.target_position_group]}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {announcement.title}
          </h3>
        </div>
      </div>

      <p className="text-gray-600 whitespace-pre-wrap mb-4">
        {announcement.body}
      </p>

      {/* Attachments */}
      {announcement.attachments && announcement.attachments.length > 0 && (
        <div className="mb-4 space-y-1">
          {announcement.attachments.map((attachment, index) => (
            <a
              key={index}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              📎 {attachment.name}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{formatTimestamp(announcement.created_at)}</span>
        </div>

        {showReadReceipts && (
          <div className="text-gray-500">
            {/* Placeholder for read receipt count - will be populated by parent component */}
          </div>
        )}
      </div>
    </div>
  );
});

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}
