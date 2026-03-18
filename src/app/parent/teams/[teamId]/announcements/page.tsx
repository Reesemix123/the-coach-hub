'use client';

import React, { use, useState, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { AnnouncementCard } from '@/components/communication/announcements/AnnouncementCard';
import { AnnouncementWithReadStatus } from '@/types/communication';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function ParentAnnouncementsPage({ params }: PageProps) {
  const { teamId } = use(params);
  const [announcements, setAnnouncements] = useState<AnnouncementWithReadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, [teamId]);

  async function fetchAnnouncements() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communication/announcements?teamId=${teamId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(announcementId: string) {
    try {
      const response = await fetch(`/api/communication/announcements/${announcementId}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state
      setAnnouncements((prev) =>
        prev.map((announcement) =>
          announcement.id === announcementId
            ? { ...announcement, is_read: true, read_at: new Date().toISOString() }
            : announcement
        )
      );
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  }

  const unreadCount = announcements.filter((a) => !a.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-8 h-8 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-gray-600">Updates from your child&apos;s coaching staff</p>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              No Announcements Yet
            </h2>
            <p className="text-gray-600">
              Your coach hasn&apos;t sent any announcements yet. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Unread announcements first */}
            {announcements
              .filter((a) => !a.is_read)
              .map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  isRead={false}
                  onMarkRead={() => markAsRead(announcement.id)}
                />
              ))}

            {/* Divider if there are both read and unread */}
            {unreadCount > 0 && announcements.length > unreadCount && (
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-50 px-4 text-sm text-gray-500">
                    Read announcements
                  </span>
                </div>
              </div>
            )}

            {/* Read announcements */}
            {announcements
              .filter((a) => a.is_read)
              .map((announcement) => (
                <div key={announcement.id} className="opacity-75">
                  <AnnouncementCard
                    announcement={announcement}
                    isRead={true}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Quick tip for parents */}
        {announcements.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>Tip:</strong> Tap any announcement to mark it as read. You&apos;ll receive notifications for new announcements based on your preferences.
            </p>
          </div>
        )}
    </div>
  );
}
