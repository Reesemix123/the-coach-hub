'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Loader2, Clock, Users, User } from 'lucide-react';
import Link from 'next/link';
import { VideoPlayer } from '@/components/communication/videos/VideoPlayer';
import type { SharedVideo } from '@/types/communication';

interface PageProps {
  params: Promise<{ teamId: string; videoId: string }>;
}

/**
 * Parent-facing video watch page.
 *
 * Fetches the video record plus a short-lived signed Mux playback URL from
 * the API. View tracking is handled server-side in the GET handler — the
 * component does not need to call a separate tracking endpoint.
 */
export default function ParentVideoWatchPage({ params }: PageProps) {
  const { teamId, videoId } = use(params);

  const [video, setVideo] = useState<SharedVideo | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communication/videos/${videoId}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Video not found' : 'Failed to load video');
      }

      const data = await response.json();
      setVideo(data.video);
      setPlaybackUrl(data.playback_url ?? null);
      setThumbnailUrl(data.thumbnail_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-gray-600 mb-4">{error ?? 'Video not found'}</p>
          <Link
            href={`/parent/teams/${teamId}/videos`}
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/parent/teams/${teamId}/videos`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Videos
        </Link>

        {/* Player */}
        <VideoPlayer
          playbackUrl={playbackUrl}
          thumbnailUrl={thumbnailUrl}
          title={video.title}
        />

        {/* Video details card */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>

            <span
              className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                video.share_type === 'team'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-purple-50 text-purple-700'
              }`}
            >
              {video.share_type === 'team' ? (
                <Users className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {video.share_type === 'team' ? 'Team Video' : 'For You'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(video.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            {video.duration_seconds !== null && (
              <span>{formatDuration(video.duration_seconds)}</span>
            )}
          </div>

          {video.description && (
            <p className="text-gray-600 mb-4">{video.description}</p>
          )}

          {/* Coach notes */}
          {video.coach_notes && (
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Coach&apos;s Notes
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {video.coach_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
