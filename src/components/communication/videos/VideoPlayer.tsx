'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  title: string;
  onPlay?: () => void;
}

/**
 * HLS video player for Mux signed stream URLs.
 *
 * Uses native HLS support in Safari. Falls back to hls.js for all other
 * browsers via dynamic import so the library is only loaded when needed.
 * The component renders a "processing" state when no playback URL is available.
 */
export function VideoPlayer({
  playbackUrl,
  thumbnailUrl,
  title,
  onPlay,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (!playbackUrl || !videoRef.current) return;

    const video = videoRef.current;
    let destroyed = false;

    // Safari supports HLS natively — no library needed.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;

      const onMetadata = () => {
        if (!destroyed) setLoading(false);
      };
      const onError = () => {
        if (!destroyed) setError('Failed to load video');
      };

      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('error', onError);

      return () => {
        destroyed = true;
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('error', onError);
      };
    }

    // All other browsers: load hls.js dynamically.
    let hlsInstance: import('hls.js').default | null = null;

    import('hls.js').then(({ default: Hls }) => {
      if (destroyed) return;

      if (!Hls.isSupported()) {
        setError('Your browser does not support video playback');
        setLoading(false);
        return;
      }

      hlsInstance = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsInstance.loadSource(playbackUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!destroyed) setLoading(false);
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (destroyed) return;
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          setError('Failed to load video. The playback URL may have expired.');
          setLoading(false);
        }
      });
    }).catch(() => {
      if (!destroyed) {
        setError('Failed to load video player');
        setLoading(false);
      }
    });

    return () => {
      destroyed = true;
      hlsInstance?.destroy();
    };
  }, [playbackUrl]);

  function handlePlay() {
    if (!hasPlayed) {
      setHasPlayed(true);
      onPlay?.();
    }
  }

  // Video is still being encoded by Mux — no URL yet.
  if (!playbackUrl) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Video is processing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center px-6">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        poster={thumbnailUrl ?? undefined}
        title={title}
        onPlay={handlePlay}
      />
    </div>
  );
}
