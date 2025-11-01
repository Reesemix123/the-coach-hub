'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { VideoGroupMemberWithVideo, Video } from '@/types/football';

interface VirtualSegment {
  video: Video;
  member: VideoGroupMemberWithVideo;
  virtualStart: number; // Start time in virtual timeline (ms)
  virtualEnd: number; // End time in virtual timeline (ms)
  duration: number; // Actual duration of this segment (ms)
}

interface VirtualVideoPlayerProps {
  videoGroupId: string;
  onTimeUpdate?: (virtualTime: number, totalDuration: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export default function VirtualVideoPlayer({
  videoGroupId,
  onTimeUpdate,
  onPlayStateChange,
  className = '',
}: VirtualVideoPlayerProps) {
  const [segments, setSegments] = useState<VirtualSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [virtualTime, setVirtualTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();

  // Fetch video group and build virtual timeline
  useEffect(() => {
    fetchVideoGroup();
  }, [videoGroupId]);

  async function fetchVideoGroup() {
    try {
      setLoading(true);
      setError(null);

      // Fetch group members with videos
      const { data: members, error: membersError } = await supabase
        .from('video_group_members')
        .select('*, videos(*)')
        .eq('video_group_id', videoGroupId)
        .order('sequence_order', { ascending: true });

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setError('No videos in this group');
        setLoading(false);
        return;
      }

      // Build virtual timeline segments
      let virtualPosition = 0;
      const virtualSegments: VirtualSegment[] = [];

      for (const member of members) {
        const video = Array.isArray(member.videos) ? member.videos[0] : member.videos;

        if (!video) continue;

        // Calculate segment duration (with trim offsets)
        // For now, we'll need to load video metadata to get duration
        // In production, store duration in database
        const duration = 600000; // Placeholder: 10 minutes in ms
        const startOffset = member.start_offset_ms || 0;
        const endOffset = member.end_offset_ms || duration;
        const segmentDuration = endOffset - startOffset;

        virtualSegments.push({
          video,
          member,
          virtualStart: virtualPosition,
          virtualEnd: virtualPosition + segmentDuration,
          duration: segmentDuration,
        });

        virtualPosition += segmentDuration;
      }

      setSegments(virtualSegments);
      setTotalDuration(virtualPosition);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching video group:', err);
      setError('Failed to load video group');
      setLoading(false);
    }
  }

  // Update virtual time as video plays
  useEffect(() => {
    if (!videoRef.current || segments.length === 0) return;

    const video = videoRef.current;
    const handleTimeUpdate = () => {
      const currentSegment = segments[currentSegmentIndex];
      if (!currentSegment) return;

      const videoTime = video.currentTime * 1000; // Convert to ms
      const startOffset = currentSegment.member.start_offset_ms || 0;
      const segmentTime = videoTime - startOffset;
      const newVirtualTime = currentSegment.virtualStart + segmentTime;

      setVirtualTime(newVirtualTime);
      onTimeUpdate?.(newVirtualTime, totalDuration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [currentSegmentIndex, segments, totalDuration, onTimeUpdate]);

  // Handle video ended - switch to next segment
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const handleEnded = () => {
      if (currentSegmentIndex < segments.length - 1) {
        // Move to next segment
        setCurrentSegmentIndex(currentSegmentIndex + 1);
        setIsPlaying(true);
      } else {
        // Reached end of all videos
        setIsPlaying(false);
        onPlayStateChange?.(false);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [currentSegmentIndex, segments.length, onPlayStateChange]);

  // Load current video
  useEffect(() => {
    if (!videoRef.current || segments.length === 0) return;

    const currentSegment = segments[currentSegmentIndex];
    if (!currentSegment) return;

    const video = videoRef.current;
    video.src = currentSegment.video.url || '';
    video.playbackRate = playbackRate;

    const startOffset = currentSegment.member.start_offset_ms || 0;
    video.currentTime = startOffset / 1000;

    if (isPlaying) {
      video.play().catch(err => console.error('Play error:', err));
    }

    // Preload next video
    if (currentSegmentIndex < segments.length - 1 && nextVideoRef.current) {
      const nextSegment = segments[currentSegmentIndex + 1];
      nextVideoRef.current.src = nextSegment.video.url || '';
    }
  }, [currentSegmentIndex, segments, playbackRate]);

  // Seek to virtual time
  const seekToVirtualTime = useCallback((targetVirtualTime: number) => {
    if (segments.length === 0) return;

    // Find which segment contains this virtual time
    const segmentIndex = segments.findIndex(
      seg => targetVirtualTime >= seg.virtualStart && targetVirtualTime < seg.virtualEnd
    );

    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    const offsetIntoSegment = targetVirtualTime - segment.virtualStart;
    const startOffset = segment.member.start_offset_ms || 0;
    const actualTime = (startOffset + offsetIntoSegment) / 1000;

    setCurrentSegmentIndex(segmentIndex);

    if (videoRef.current) {
      videoRef.current.currentTime = actualTime;
    }
  }, [segments]);

  // Play/pause controls
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      videoRef.current.play().catch(err => console.error('Play error:', err));
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }
  }, [isPlaying, onPlayStateChange]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }, []);

  // Format time display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`bg-black flex items-center justify-center ${className}`}>
        <div className="text-white text-lg">Loading videos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-black flex items-center justify-center ${className}`}>
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  const currentSegment = segments[currentSegmentIndex];

  return (
    <div className={`relative bg-black ${className}`}>
      {/* Main Video */}
      <video
        ref={videoRef}
        className="w-full h-full"
        onClick={togglePlay}
      />

      {/* Preload Next Video (Hidden) */}
      <video ref={nextVideoRef} className="hidden" preload="auto" />

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
        {/* Progress Bar */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={totalDuration}
            value={virtualTime}
            onChange={(e) => seekToVirtualTime(Number(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(virtualTime / totalDuration) * 100}%, #4b5563 ${(virtualTime / totalDuration) * 100}%, #4b5563 100%)`
            }}
          />

          {/* Segment Markers */}
          <div className="relative h-2 mt-1">
            {segments.map((seg, idx) => (
              <div
                key={idx}
                className="absolute h-full border-l border-gray-400"
                style={{
                  left: `${(seg.virtualStart / totalDuration) * 100}%`,
                }}
                title={`Video ${idx + 1}: ${seg.video.name}`}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="hover:text-blue-400 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <div className="text-sm">
              {formatTime(virtualTime)} / {formatTime(totalDuration)}
            </div>

            {/* Current Segment Indicator */}
            <div className="text-xs text-gray-400">
              Video {currentSegmentIndex + 1} of {segments.length}
              {currentSegment && ` - ${currentSegment.video.name}`}
            </div>
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Speed:</span>
            <select
              value={playbackRate}
              onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
              className="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
