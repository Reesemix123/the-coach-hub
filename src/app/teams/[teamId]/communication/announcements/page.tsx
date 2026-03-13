'use client';

import React, { use, useState, useEffect } from 'react';
import { Bell, Plus, Users, Clock, Loader2, Eye } from 'lucide-react';
import { AnnouncementCard } from '@/components/communication/announcements/AnnouncementCard';
import { AnnouncementForm } from '@/components/communication/announcements/AnnouncementForm';
import { ReadReceiptModal } from '@/components/communication/announcements/ReadReceiptModal';
import { Announcement } from '@/types/communication';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

interface AnnouncementReadStats {
  [announcementId: string]: {
    read_count: number;
    total_recipients: number;
  };
}

export default function CoachAnnouncementsPage({ params }: PageProps) {
  const { teamId } = use(params);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readStats, setReadStats] = useState<AnnouncementReadStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, [teamId]);

  async function fetchAnnouncements() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communication/announcements?teamId=${teamId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const fetchedAnnouncements: Announcement[] = data.announcements || [];
      setAnnouncements(fetchedAnnouncements);

      // Fetch read stats for each announcement
      if (fetchedAnnouncements.length > 0) {
        fetchReadStats(fetchedAnnouncements.map(a => a.id));
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReadStats(announcementIds: string[]) {
    const stats: AnnouncementReadStats = {};

    // Fetch stats in parallel (max 10 at a time)
    const batchSize = 10;
    for (let i = 0; i < announcementIds.length; i += batchSize) {
      const batch = announcementIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const response = await fetch(`/api/communication/announcements/${id}/stats`);
          if (response.ok) {
            const data = await response.json();
            return { id, read_count: data.read_count, total_recipients: data.total_recipients };
          }
          return { id, read_count: 0, total_recipients: 0 };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          stats[result.value.id] = {
            read_count: result.value.read_count,
            total_recipients: result.value.total_recipients,
          };
        }
      });
    }

    setReadStats(stats);
  }

  function handleSuccess() {
    setShowForm(false);
    fetchAnnouncements();
  }

  const selectedAnnouncement = selectedAnnouncementId
    ? announcements.find(a => a.id === selectedAnnouncementId)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-gray-700" />
              <h1 className="text-2xl font-semibold text-gray-900">
                Team Announcements
              </h1>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              New Announcement
            </button>
          </div>
          <p className="text-gray-600">
            Send updates and important information to parents
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* New Announcement Form */}
        {showForm && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Announcement
            </h2>
            <AnnouncementForm
              teamId={teamId}
              onSuccess={handleSuccess}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              No Announcements Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Get started by sending your first team announcement
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create First Announcement
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const stats = readStats[announcement.id];
              return (
                <div key={announcement.id} className="relative">
                  <AnnouncementCard
                    announcement={announcement}
                    isRead={true}
                    showReadReceipts={true}
                  />
                  {/* Read receipt overlay */}
                  <button
                    onClick={() => setSelectedAnnouncementId(announcement.id)}
                    className="absolute bottom-4 right-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>
                      {stats
                        ? `${stats.read_count} of ${stats.total_recipients} read`
                        : 'Loading...'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats Summary */}
        {announcements.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Bell className="w-4 h-4" />
                <span className="text-sm font-medium">Total Sent</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {announcements.length}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Avg. Read Rate</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {calculateAverageReadRate(announcements, readStats)}%
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Last Sent</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatLastSent(announcements[0]?.created_at)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Read Receipt Modal */}
      <ReadReceiptModal
        announcementId={selectedAnnouncementId || ''}
        announcementTitle={selectedAnnouncement?.title || ''}
        isOpen={!!selectedAnnouncementId}
        onClose={() => setSelectedAnnouncementId(null)}
      />
    </div>
  );
}

function calculateAverageReadRate(
  announcements: Announcement[],
  readStats: AnnouncementReadStats
): number {
  const announcementsWithStats = announcements.filter(a => readStats[a.id]);
  if (announcementsWithStats.length === 0) return 0;

  const totalRate = announcementsWithStats.reduce((sum, announcement) => {
    const stats = readStats[announcement.id];
    if (!stats || stats.total_recipients === 0) return sum;
    return sum + (stats.read_count / stats.total_recipients) * 100;
  }, 0);

  return Math.round(totalRate / announcementsWithStats.length);
}

function formatLastSent(timestamp: string | undefined): string {
  if (!timestamp) return 'N/A';

  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
