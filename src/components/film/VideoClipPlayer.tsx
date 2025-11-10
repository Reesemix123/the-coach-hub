'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Repeat, ChevronLeft, ChevronRight, Volume2, VolumeX, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface VideoClipPlayerProps {
  videoUrl: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
}

export function VideoClipPlayer({ videoUrl, startTime, endTime }: VideoClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const hasInitializedTimeRef = useRef(false);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const clipDuration = endTime - startTime;

  // Initialize video to start time and wait for it to be ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state when video changes
    setIsPlaying(false);
    hasInitializedTimeRef.current = false;

    const handleCanPlay = () => {
      console.log('Video canplay event - readyState:', video.readyState);
      // Only set currentTime once to avoid infinite loop
      if (!hasInitializedTimeRef.current) {
        console.log('Setting initial start time:', startTime);
        video.currentTime = startTime;
        hasInitializedTimeRef.current = true;
      }
      setIsVideoReady(true);
    };

    const handleLoadedMetadata = () => {
      console.log('Video loadedmetadata - duration:', video.duration);
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e, video.error);
    };

    const handlePause = () => {
      console.log('Video paused event fired');
    };

    const handlePlay = () => {
      console.log('Video play event fired');
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);

    // If video is already ready
    if (video.readyState >= 2 && !hasInitializedTimeRef.current) {
      console.log('Video already ready - readyState:', video.readyState);
      video.currentTime = startTime;
      hasInitializedTimeRef.current = true;
      setIsVideoReady(true);
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
    };
  }, [startTime, videoUrl]);

  // Handle playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle mute/unmute
  useEffect(() => {
    if (videoRef.current) {
      console.log('Setting video muted to:', isMuted);
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Ensure video is muted on mount for autoplay
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      console.log('Initial mute set on mount');
    }
  }, []);

  // No longer using useEffect for play/pause - handled manually in togglePlayPause

  // Monitor time and loop clip
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    const time = videoRef.current.currentTime;
    const video = videoRef.current;
    setCurrentTime(time);

    // Log only once per second to avoid spam
    const currentSecond = Math.floor(time);
    if (time > 0 && Math.abs(time - currentSecond) < 0.1) {
      console.log('Time update:', time.toFixed(2), 'sec | paused:', video.paused, '| isPlaying state:', isPlaying);
    }

    // Loop back to start when reaching end
    if (time >= endTime) {
      console.log('Reached end of clip, looping back to start');
      videoRef.current.currentTime = startTime;
      if (isLooping) {
        // Continue playing on loop
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Loop play interrupted:', error);
          });
        }
      } else {
        // Stop at end if not looping
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }

    // Safety: if somehow before start, jump to start
    if (time < startTime) {
      console.log('Before start time, jumping to start');
      videoRef.current.currentTime = startTime;
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      if (isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Play after restart interrupted:', error);
          });
        }
      }
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) {
      console.log('No video element');
      return;
    }
    if (!isVideoReady) {
      console.log('Video not ready yet');
      return;
    }

    console.log('Toggle play/pause - State says playing:', isPlaying, '| Video.paused:', video.paused);
    console.log('Video properties:', {
      currentTime: video.currentTime,
      duration: video.duration,
      readyState: video.readyState,
      networkState: video.networkState,
      muted: video.muted,
      paused: video.paused
    });

    if (isPlaying) {
      // Pause
      console.log('Pausing video');
      video.pause();
      setIsPlaying(false);
    } else {
      // Play
      console.log('Attempting to play video from', video.currentTime);
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Play promise resolved - video.paused:', video.paused);
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('Play failed:', error);
            setIsPlaying(false);
          });
      } else {
        console.log('Play returned undefined (older browser)');
        setIsPlaying(true);
      }
    }
  };

  const handleFrameStep = (direction: 'forward' | 'backward') => {
    if (!videoRef.current) return;

    // Step by 1/30th second (assuming 30fps)
    const frameStep = 1 / 30;
    const newTime = direction === 'forward'
      ? Math.min(videoRef.current.currentTime + frameStep, endTime)
      : Math.max(videoRef.current.currentTime - frameStep, startTime);

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;

    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 4)); // Max 4x zoom
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 1)); // Min 1x (normal)
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Pan/drag controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full lg:w-[45%] bg-gray-900 flex flex-col p-6">
      {/* Video Element */}
      <div
        ref={videoContainerRef}
        className="flex-1 flex items-center justify-center mb-4 overflow-hidden rounded-lg relative bg-black"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full shadow-2xl"
          onTimeUpdate={handleTimeUpdate}
          playsInline
          preload="auto"
          style={{
            transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
        />

        {/* Zoom indicator */}
        {zoom > 1 && (
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            Drag to pan
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Playback Buttons */}
        <div className="flex items-center justify-center gap-3">
          {/* Frame Step Backward */}
          <button
            onClick={() => handleFrameStep('backward')}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            title="Previous Frame"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            title="Restart Clip"
          >
            <RotateCcw size={20} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            disabled={!isVideoReady}
            className={`p-4 rounded-full transition-colors ${
              isVideoReady
                ? 'bg-white hover:bg-gray-200 text-gray-900'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            title={!isVideoReady ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          {/* Loop Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-lg transition-colors ${
              isLooping
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
            title={isLooping ? 'Loop On' : 'Loop Off'}
          >
            <Repeat size={20} />
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          {/* Frame Step Forward */}
          <button
            onClick={() => handleFrameStep('forward')}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            title="Next Frame"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className={`p-2 rounded-lg transition-colors ${
              zoom <= 1
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>

          <div className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm font-medium min-w-[60px] text-center">
            {zoom.toFixed(1)}x
          </div>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            className={`p-2 rounded-lg transition-colors ${
              zoom >= 4
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>

          <button
            onClick={handleResetZoom}
            disabled={zoom === 1}
            className={`p-2 rounded-lg transition-colors ${
              zoom === 1
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title="Reset Zoom"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Playback Speed */}
        <div className="flex items-center justify-center gap-2">
          {[0.25, 0.5, 1, 1.5, 2].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                playbackSpeed === speed
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            min={startTime}
            max={endTime}
            step={0.033} // ~30fps precision
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime - startTime)}</span>
            <span>{formatTime(clipDuration)}</span>
          </div>
        </div>

        {/* Clip Info */}
        <div className="text-center text-sm text-gray-400">
          Clip: {formatTime(startTime)} - {formatTime(endTime)}
        </div>
      </div>
    </div>
  );
}
