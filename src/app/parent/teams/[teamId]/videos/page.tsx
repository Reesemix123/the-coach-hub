'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { Video, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VideoCard } from '@/components/communication/videos/VideoCard';
import type { SharedVideo } from '@/types/communication';

// The GET /api/communication/videos response shape for parents includes view
// tracking fields added dynamically by getVideosForParent in the video service.
type VideoWithViewStatus = SharedVideo & {
  viewed_at: string | null;
  view_count: number;
  thumbnail_url?: string | null;
};

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function ParentVideosPage({ params }: PageProps) {
  const { teamId } = use(params);
  const router = useRouter();

  const [videos, setVideos] = useState<VideoWithViewStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communication/videos?teamId=${teamId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  function handleWatch(videoId: string) {
    router.push(`/parent/teams/${teamId}/videos/${videoId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/parent/teams/${teamId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex items-center gap-3 mb-1">
            <Video className="w-8 h-8 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Videos</h1>
          </div>
          <p className="text-gray-600">
            Game film and highlights shared by your coaching staff
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {videos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
            <p className="text-gray-600">
              Your coaching staff hasn&apos;t shared any videos yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                isCoachView={false}
                onWatch={handleWatch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
