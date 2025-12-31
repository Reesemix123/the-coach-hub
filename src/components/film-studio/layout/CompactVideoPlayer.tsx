'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Circle,
  Scissors,
  Square,
} from 'lucide-react';
import { formatTimeMs } from '@/types/timeline';
import type { CameraInfo } from '../context/FilmStudioContext';

interface CompactVideoPlayerProps {
  videoUrl: string | null;
  currentTimeMs: number;
  totalDurationMs: number;
  isPlaying: boolean;
  cameras: CameraInfo[];
  activeCameraId: string | null;
  isRecording?: boolean;
  // Film slicing props
  isSlicing?: boolean;
  sliceStartTimeMs?: number | null;
  onMarkStart?: () => void;
  onMarkEnd?: () => void;
  onTimeUpdate: (timeMs: number) => void;
  onPlayPause: () => void;
  onSeek: (timeMs: number) => void;
  onCameraSwitch: (cameraId: string) => void;
  onRecordToggle?: () => void;
}

// Available playback speeds
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function CompactVideoPlayer({
  videoUrl,
  currentTimeMs,
  totalDurationMs,
  isPlaying,
  cameras,
  activeCameraId,
  isRecording = false,
  isSlicing = false,
  sliceStartTimeMs,
  onMarkStart,
  onMarkEnd,
  onTimeUpdate,
  onPlayPause,
  onSeek,
  onCameraSwitch,
  onRecordToggle,
}: CompactVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Sync video element with current time from context
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      const video = videoRef.current;
      const targetTime = currentTimeMs / 1000;

      // Only seek if difference is significant (avoid jitter)
      if (Math.abs(video.currentTime - targetTime) > 0.5) {
        video.currentTime = targetTime;
      }
    }
  }, [currentTimeMs, videoUrl]);

  // Sync play state
  useEffect(() => {
    console.log('[CompactVideoPlayer] Play state sync:', { isPlaying, hasVideoUrl: !!videoUrl, hasVideoRef: !!videoRef.current, isVideoReady });
    if (videoRef.current && videoUrl && isVideoReady) {
      if (isPlaying && videoRef.current.paused) {
        console.log('[CompactVideoPlayer] Attempting to play video');
        videoRef.current.play().catch((err) => {
          console.error('[CompactVideoPlayer] Failed to play:', err.message);
        });
      } else if (!isPlaying && !videoRef.current.paused) {
        console.log('[CompactVideoPlayer] Pausing video');
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl, isVideoReady]);

  // Sync playback speed to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, videoUrl]);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeedMenu]);

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Reset video ready state when URL changes
  useEffect(() => {
    setIsVideoReady(false);
  }, [videoUrl]);

  const handleCanPlay = useCallback(() => {
    console.log('[CompactVideoPlayer] Video can play');
    setIsVideoReady(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime * 1000);
    }
  }, [onTimeUpdate]);

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTimeMs - 5000)); // Skip back 5 seconds
  }, [currentTimeMs, onSeek]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(totalDurationMs, currentTimeMs + 5000)); // Skip forward 5 seconds
  }, [currentTimeMs, totalDurationMs, onSeek]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(percent * totalDurationMs);
    },
    [totalDurationMs, onSeek]
  );

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, []);

  const progressPercent =
    totalDurationMs > 0 ? (currentTimeMs / totalDurationMs) * 100 : 0;

  // Format sync offset for display
  const formatOffset = (seconds: number): string => {
    const sign = seconds >= 0 ? '+' : '';
    return `${sign}${seconds.toFixed(1)}s`;
  };

  return (
    <div
      ref={containerRef}
      className={`bg-black overflow-hidden shadow-lg ${
        isFullscreen ? 'rounded-none' : 'rounded-xl'
      }`}
    >
      {/* Video Container */}
      <div className={`relative bg-gray-900 ${
        isFullscreen
          ? 'w-full h-full'
          : 'aspect-video max-h-[400px]'
      }`}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onCanPlay={handleCanPlay}
            onClick={onPlayPause}
            playsInline
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <span>Select a camera to play</span>
          </div>
        )}

        {/* Overlay Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
          {/* Progress Bar */}
          <div
            className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-white rounded-full relative transition-all group-hover:h-1.5"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Playhead knob */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Camera Switcher Pills */}
          {cameras.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {cameras.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => onCameraSwitch(cam.id)}
                  className={`
                    px-3 py-1.5 text-xs rounded-full whitespace-nowrap
                    transition-all duration-200 flex-shrink-0
                    ${
                      cam.id === activeCameraId
                        ? 'bg-white text-black font-medium'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }
                  `}
                >
                  {cam.label}
                  {cam.syncOffsetSeconds !== 0 && (
                    <span className="ml-1 opacity-60 text-[10px]">
                      {formatOffset(cam.syncOffsetSeconds)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Transport Controls */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={onPlayPause}
              className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Skip buttons */}
            <button
              onClick={handleSkipBack}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              title="Back 5 seconds"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={handleSkipForward}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              title="Forward 5 seconds"
            >
              <SkipForward size={18} />
            </button>

            {/* Time display */}
            <span className="text-white font-mono text-sm tabular-nums">
              {formatTimeMs(currentTimeMs)} / {formatTimeMs(totalDurationMs)}
            </span>

            {/* Film Slicing Controls - only show when video is loaded */}
            {onMarkStart && onMarkEnd && (
              <div className="flex items-center gap-1 ml-2">
                {!isSlicing ? (
                  <button
                    onClick={onMarkStart}
                    disabled={!videoUrl}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      videoUrl
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    title={videoUrl ? "Mark start of play" : "Load a video first"}
                  >
                    <Scissors size={14} />
                    Mark Start
                  </button>
                ) : (
                  <>
                    {/* Recording indicator */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-300 animate-pulse">
                      <Circle size={8} className="fill-yellow-400" />
                      From {formatTimeMs(sliceStartTimeMs || 0)}
                    </div>
                    <button
                      onClick={onMarkEnd}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                      title="Mark end of play"
                    >
                      <Square size={14} className="fill-white" />
                      Mark End
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Recording indicator */}
            {onRecordToggle && (
              <button
                onClick={onRecordToggle}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-200
                  ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }
                `}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                <Circle
                  size={10}
                  className={isRecording ? 'fill-white' : ''}
                />
                {isRecording ? 'REC' : "Director's Cut"}
              </button>
            )}

            {/* Playback Speed */}
            <div className="relative" ref={speedMenuRef}>
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  playbackSpeed !== 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title="Playback speed"
              >
                {playbackSpeed}x
              </button>

              {/* Speed menu dropdown */}
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-gray-900 rounded-lg shadow-xl border border-white/20 overflow-hidden min-w-[80px]">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-purple-600 text-white'
                          : 'text-white hover:bg-white/20'
                      }`}
                    >
                      {speed}x {speed === 1 && '(Normal)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              title="Fullscreen"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>

        {/* Center play button (when paused and not hovering) */}
        {!isPlaying && videoUrl && (
          <button
            onClick={onPlayPause}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-white/20 rounded-full hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            <Play size={32} className="text-white ml-1" />
          </button>
        )}
      </div>
    </div>
  );
}

export default CompactVideoPlayer;
