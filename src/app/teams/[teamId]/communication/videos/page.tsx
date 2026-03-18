'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { Video, Plus, Loader2, ChevronLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { VideoCard } from '@/components/communication/videos/VideoCard';
import { VideoUploadForm } from '@/components/communication/videos/VideoUploadForm';
import { PublishVideoModal } from '@/components/communication/videos/PublishVideoModal';

interface SharedVideoWithThumb {
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
}

interface VideoCredits {
  baseRemaining: number;
  topupRemaining: number;
  totalRemaining: number;
}

interface PlayerOption {
  id: string;
  name: string;
  jersey_number: number | null;
}

/**
 * Shape returned by /api/communication/parents/roster for players in the team.
 * Only the fields we need for player selection in the publish modal.
 */
interface RosterPlayer {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface RosterResponse {
  players?: RosterPlayer[];
}

interface VideosResponse {
  videos?: SharedVideoWithThumb[];
  credits?: VideoCredits | null;
}

interface PublishPayload {
  confirmationText: string;
  coachNotes: string;
  notificationChannel: string;
  playerId?: string;
}

interface PublishErrorResponse {
  error?: string;
}

interface TopupResponse {
  url?: string;
  error?: string;
}

export default function CoachVideosPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const [videos, setVideos] = useState<SharedVideoWithThumb[]>([]);
  const [credits, setCredits] = useState<VideoCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [publishVideoId, setPublishVideoId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/communication/videos?teamId=${teamId}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json() as VideosResponse;
      setVideos(data.videos || []);
      setCredits(data.credits ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchPlayers = useCallback(async () => {
    try {
      // Use the existing roster endpoint which returns the team's players list
      const response = await fetch(
        `/api/communication/parents/roster?teamId=${teamId}`
      );
      if (!response.ok) return;
      const data = await response.json() as RosterResponse;
      setPlayers(
        (data.players || []).map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          jersey_number: p.jersey_number,
        }))
      );
    } catch {
      // Player list is non-critical — publish modal degrades gracefully
    }
  }, [teamId]);

  useEffect(() => {
    fetchVideos();
    fetchPlayers();
  }, [fetchVideos, fetchPlayers]);

  async function handlePublish(data: PublishPayload) {
    const response = await fetch(
      `/api/communication/videos/${publishVideoId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json() as PublishErrorResponse;
      throw new Error(errorData.error || 'Failed to publish');
    }

    setPublishVideoId(null);
    fetchVideos();
  }

  async function handleDelete(videoId: string) {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const response = await fetch(`/api/communication/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      fetchVideos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete video');
    }
  }

  async function handleTopup() {
    try {
      const response = await fetch('/api/communication/videos/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      if (!response.ok) {
        const data = await response.json() as TopupResponse;
        throw new Error(data.error || 'Failed to create checkout');
      }

      const { url } = await response.json() as TopupResponse;
      if (url) window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start checkout');
    }
  }

  const publishVideo = publishVideoId
    ? videos.find((v) => v.id === publishVideoId) ?? null
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/teams/${teamId}/communication/announcements`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back to communication hub"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Video Sharing</h1>
              <p className="text-gray-600 mt-1">
                Share game film and highlights with parents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Credits Display */}
            {credits !== null && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
                <Video className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {credits.totalRemaining} video
                  {credits.totalRemaining !== 1 ? 's' : ''} remaining
                </span>
                {credits.totalRemaining <= 2 && (
                  <button
                    onClick={handleTopup}
                    className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    + Add More
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Upload Video
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Upload Form */}
        {showUploadForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Upload New Video
            </h2>
            <VideoUploadForm
              teamId={teamId}
              onSuccess={() => {
                setShowUploadForm(false);
                fetchVideos();
              }}
              onCancel={() => setShowUploadForm(false)}
            />
          </div>
        )}

        {/* Top-up Banner (when no credits remain) */}
        {credits !== null && credits.totalRemaining === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-amber-900">
                No video credits remaining
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Purchase a 5-video top-up pack to continue sharing team videos.
              </p>
            </div>
            <button
              onClick={handleTopup}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy 5-Pack ($39)
            </button>
          </div>
        )}

        {/* Videos Grid */}
        {videos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
            <p className="text-gray-600 mb-6">
              Upload your first video to share with parents
            </p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Upload First Video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                isCoachView={true}
                onPublish={(id) => setPublishVideoId(id)}
                onWatch={(id) =>
                  window.open(
                    `/teams/${teamId}/communication/videos/${id}`,
                    '_blank'
                  )
                }
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Publish Modal */}
      {publishVideo && (
        <PublishVideoModal
          isOpen={!!publishVideoId}
          onClose={() => setPublishVideoId(null)}
          onPublish={handlePublish}
          video={publishVideo}
          credits={credits}
          players={players}
        />
      )}
    </div>
  );
}
