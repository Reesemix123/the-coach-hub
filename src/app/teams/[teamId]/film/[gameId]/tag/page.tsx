'use client';

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';
import VirtualVideoPlayer from '@/components/VirtualVideoPlayer';
import MarkerList from '@/components/film/MarkerList';
import EditMarkerModal from '@/components/film/EditMarkerModal';
import { TagPageFilmBridge } from '@/components/film/TagPageFilmBridge';
import { TagPageUnifiedTimeline } from '@/components/film/TagPageUnifiedTimeline';
import { TimelineCameraSelector } from '@/components/film/TimelineCameraSelector';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

// Dynamic imports for modals and features (loaded on demand)
const CombineVideosModal = dynamic(() => import('@/components/CombineVideosModal'), { ssr: false });
const DirectorsCut = dynamic(() => import('@/components/film/DirectorsCut'), { ssr: false });
const TierSelectorModal = dynamic(() => import('@/components/film/TierSelectorModal').then(mod => ({ default: mod.TierSelectorModal })), { ssr: false });
const TierUpgradeModal = dynamic(() => import('@/components/film/TierUpgradeModal').then(mod => ({ default: mod.TierUpgradeModal })), { ssr: false });
import { VideoErrorBoundary } from '@/components/film/VideoErrorBoundary';
import { FilmProvider, useFilmStateBridge } from '@/components/film/context';
import { TaggingPanel } from '@/components/film/panels/TaggingPanel';
import { useMarkers } from '@/components/film/panels/hooks/useMarkers';
import { useFilmDataFetching } from '@/components/film/panels/hooks/useFilmDataFetching';
import { useVideoManagement } from '@/components/film/panels/hooks/useVideoManagement';
import { useVideoUpload } from '@/components/film/panels/hooks/useVideoUpload';
import { usePlayTagging } from '@/components/film/panels/hooks/usePlayTagging';
import { useGameScoring } from '@/components/film/panels/hooks/useGameScoring';
import { useTimelinePlayback, type VideoElementCallbacks } from '@/components/film/panels/hooks/useTimelinePlayback';
import { MarkerControls } from '@/components/film/panels/MarkerControls';
import { CoverageOverlays } from '@/components/film/panels/CoverageOverlays';
import { PlayTimelineBar } from '@/components/film/panels/PlayTimelineBar';
import { PlayListPanel } from '@/components/film/panels/PlayListPanel';
import { TaggingCompleteModal } from '@/components/film/panels/TaggingCompleteModal';
import { FilmPageHeader } from '@/components/film/panels/FilmPageHeader';
import { StatusBar } from '@/components/film/panels/StatusBar';


export default function GameFilmPage() {
  return (
    <AuthGuard>
      <FilmProvider>
        <GameFilmPageInner />
      </FilmProvider>
    </AuthGuard>
  );
}

function GameFilmPageInner() {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const teamId = params.teamId as string;
  const gameId = params.gameId as string;

  // ========== CONTEXT BRIDGE ==========
  const bridge = useFilmStateBridge();

  // Destructure shared state from context (source of truth)
  const { game, videos, plays, playInstances, players, drives } = bridge.state.data;
  const { selectedVideo, videoUrl, videoLoadError, currentTime, videoDuration, urlRefreshAttempted } = bridge.state.playback;
  const { showTagModal, editingInstance, tagStartTime, tagEndTime, currentDrive } = bridge.state.tagging;

  // Local-only state (not shared via context)
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [showCombineModal, setShowCombineModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMarkerPanel, setShowMarkerPanel] = useState(true);
  const [markersCollapsed, setMarkersCollapsed] = useState(false);


  // ========== VIDEO ELEMENT CALLBACKS ==========
  const videoCallbacks: VideoElementCallbacks = {
    seekVideo: (seconds: number) => { if (videoRef.current) { videoRef.current.currentTime = seconds; } },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getReadyState: () => videoRef.current?.readyState ?? 0,
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    isPaused: () => videoRef.current?.paused ?? true,
    isAvailable: () => !!videoRef.current,
  };

  // ========== GAME SCORING HOOK ==========
  const dataFetchingRef = useRef<import('@/components/film/panels/hooks/useGameScoring').DataFetchingRef | null>(null);
  const gameScoring = useGameScoring({
    gameId,
    bridge,
    dataFetchingRef,
    onShowMarkerPanel: () => setShowMarkerPanel(true),
  });

  // ========== DATA FETCHING HOOK ==========
  const dataFetching = useFilmDataFetching({
    gameId,
    teamId,
    bridge,
    filmAnalysisStatus: gameScoring.filmAnalysisStatus,
    onTaggingTierChange: gameScoring.setTaggingTier,
    onFilmAnalysisStatusChange: gameScoring.setFilmAnalysisStatus,
    onQuarterScoresChange: gameScoring.setQuarterScores,
    onScoreMismatchChange: gameScoring.setScoreMismatch,
  });

  // Populate the ref so gameScoring can call dataFetching functions
  dataFetchingRef.current = {
    fetchGame: dataFetching.fetchGame,
    loadQuarterScoresAndMismatch: dataFetching.loadQuarterScoresAndMismatch,
  };

  // ========== TIMELINE PLAYBACK HOOK ==========
  const timelinePlayback = useTimelinePlayback({
    selectedVideo,
    videos,
    videoDuration,
    currentTime,
    videoCallbacks,
    setCurrentTime: bridge.setCurrentTime,
    setSelectedVideo: bridge.setSelectedVideo,
    setVideoDuration: bridge.setVideoDuration,
    fetchVideos: dataFetching.fetchVideos,
  });

  // ========== MARKERS HOOK ==========
  const markerHook = useMarkers({
    selectedVideoId: selectedVideo?.id || null,
    currentTime,
    onSeekTo: (seconds: number) => { if (videoRef.current) videoRef.current.currentTime = seconds; },
  });

  // ========== SYNC HOOK OUTPUTS TO CONTEXT ==========
  useEffect(() => { bridge.setTimelineLanes(timelinePlayback.timelineLanes); }, [timelinePlayback.timelineLanes]);
  useEffect(() => { bridge.setGameTimelinePositionMs(timelinePlayback.gameTimelinePositionMs); }, [timelinePlayback.gameTimelinePositionMs]);
  useEffect(() => { bridge.setIsPlaying(timelinePlayback.isPlaying); }, [timelinePlayback.isPlaying]);
  useEffect(() => { bridge.setMarkers(markerHook.markers); }, [markerHook.markers]);

  // Fetch play instances when timeline lanes change
  useEffect(() => {
    if (timelinePlayback.timelineLanes.length > 0) {
      const timelineVideoIds = [...new Set(timelinePlayback.timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
      if (timelineVideoIds.length > 0) {
        dataFetching.fetchPlayInstances(timelineVideoIds);
      }
    }
  }, [timelinePlayback.timelineLanes]);

  // ========== VIDEO MANAGEMENT HOOK ==========
  const videoManagement = useVideoManagement({
    gameId,
    teamId,
    bridge,
    videoRef,
    onIsPlayingChange: timelinePlayback.setIsPlaying,
    onFetchMarkers: markerHook.fetchMarkers,
  });

  // ========== VIDEO UPLOAD HOOK ==========
  const videoUpload = useVideoUpload({
    teamId,
    bridge,
    fileInputRef,
  });

  // ========== PLAY TAGGING HOOK ==========
  const playTagging = usePlayTagging({
    bridge,
    videoRef,
    taggingTier: gameScoring.taggingTier,
    timelineLanes: timelinePlayback.timelineLanes,
    onShowTierSelector: () => gameScoring.setShowTierSelector(true),
    onFetchDrives: dataFetching.fetchDrives,
    onFetchPlayInstances: dataFetching.fetchPlayInstances,
  });

  // Handler for resuming to saved position
  const handleResumePosition = (videoId: string, positionMs: number) => {
    // Find the video and switch to it
    const video = videos.find(v => v.id === videoId);
    if (video) {
      bridge.setSelectedVideo(video);
      // Set pending seek to resume position (convert ms to seconds)
      timelinePlayback.setPendingSyncSeek(positionMs / 1000);
    }
  };





  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getDownLabel(value: string): string {
    const labels: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' };
    return labels[value] || value;
  }


  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <FilmPageHeader
            gameName={game.name}
            opponent={game.opponent}
            gameDate={game.date}
            taggingTier={gameScoring.taggingTier}
            onBackClick={() => router.push(`/teams/${teamId}/film`)}
            onTierUpgradeClick={() => gameScoring.setShowTierUpgrade(true)}
          />

          {/* Quarter Scores, Analysis Status, and Resume Button */}
          <StatusBar
            gameId={gameId}
            teamId={teamId}
            currentVideoId={selectedVideo?.id}
            currentPositionMs={currentTime * 1000}
            onResume={handleResumePosition}
            scoreMismatch={gameScoring.scoreMismatch}
            onScoreMismatchResolve={gameScoring.handleScoreMismatchResolve}
            onDismissScoreMismatch={gameScoring.dismissScoreMismatch}
            quarterScores={gameScoring.quarterScores}
            playsTaggedCount={playInstances.length}
            filmAnalysisStatus={gameScoring.filmAnalysisStatus}
            onOpenCompleteModal={gameScoring.openCompleteModal}
          />

          {/* Timeline with Swimlanes - Unified Camera Management */}
          <div className="mb-6">
            <TagPageFilmBridge
              gameId={gameId}
              teamId={teamId}
              gameName={game?.name || ''}
              currentTimeSeconds={timelinePlayback.gameTimelinePositionMs / 1000}
              isPlaying={timelinePlayback.isPlaying}
              selectedVideoId={selectedVideo?.id || null}
              videos={videos}
              onTimeChange={timelinePlayback.handleTimelineSeek}
              onCameraChange={timelinePlayback.handleCameraSwitch}
              onPlayStateChange={timelinePlayback.setIsPlaying}
              onTimelineDurationChange={timelinePlayback.setTimelineDurationMs}
              onVideoOffsetChange={timelinePlayback.handleVideoOffsetChange}
              onTimelineLanesChange={timelinePlayback.setTimelineLanes}
            >
              <TagPageUnifiedTimeline
                videos={videos}
                markers={markerHook.markers}
                onUploadComplete={dataFetching.fetchVideos}
                onMarkerClick={markerHook.handleMarkerClick}
              />
            </TagPageFilmBridge>

            {/* Hidden file input for camera upload (fallback) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={videoUpload.handleVideoUpload}
              className="hidden"
            />

            {/* Director's Cut - shown when multiple cameras exist */}
            {videos.filter(v => !v.is_virtual).length > 1 && (
              <div className="mt-3 flex justify-end">
                <DirectorsCut
                  gameId={gameId}
                  teamId={teamId}
                  cameras={videos.filter(v => !v.is_virtual).map(v => ({
                    id: v.id,
                    name: v.name,
                    camera_label: v.camera_label || null,
                    camera_order: v.camera_order || 1,
                    sync_offset_seconds: v.sync_offset_seconds || 0,
                    url: v.url,
                  }))}
                  currentTime={currentTime}
                  selectedCameraId={selectedVideo?.id || null}
                  onCameraSwitch={timelinePlayback.handleCameraSwitch}
                  isPlaying={timelinePlayback.isPlaying}
                  videoRef={videoRef}
                />
              </div>
            )}
          </div>

          {/* Virtual/Combined Videos List (if any) */}
          {videos.filter(v => v.is_virtual).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Combined Videos</h3>
              <div className="flex gap-2 flex-wrap">
                {videos.filter(v => v.is_virtual).map((video) => (
                  <button
                    key={video.id}
                    onClick={() => bridge.setSelectedVideo(video)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedVideo?.id === video.id
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {video.virtual_name || video.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Player */}
            <div className="lg:col-span-2 space-y-6">
              {selectedVideo ? (
                selectedVideo.is_virtual ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      {selectedVideo.virtual_name || selectedVideo.name}
                    </h2>

                    <VirtualVideoPlayer
                      videoGroupId={selectedVideo.video_group_id || selectedVideo.id}
                      onTimeUpdate={(virtualTime, totalDuration) => {
                        bridge.setCurrentTime(virtualTime / 1000); // Convert ms to seconds
                        bridge.setVideoDuration(totalDuration / 1000);
                      }}
                      onPlayStateChange={(playing) => {
                        timelinePlayback.setIsPlaying(playing);
                      }}
                      className="w-full h-[600px]"
                    />

                    {/* Play Tagging Controls */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          Current Time: <span className="text-gray-900">{formatTime(currentTime)}</span>
                          {videoDuration > 0 && <span className="text-gray-500"> / {formatTime(videoDuration)}</span>}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!playTagging.isSettingEndTime ? (
                            <button
                              onClick={playTagging.handleMarkPlayStart}
                              className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                            >
                              ▶ Mark Start
                            </button>
                          ) : (
                            <>
                              <div className="px-4 py-2 bg-yellow-50 text-yellow-800 rounded font-semibold text-sm border border-yellow-200">
                                Recording from {formatTime(tagStartTime)}
                              </div>
                              <button
                                onClick={playTagging.handleMarkPlayEnd}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ■ Mark End
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : videoUrl ? (
                  <>
                    {/* Game Markers */}
                    {videoDuration > 0 && (
                      <MarkerControls
                        markers={markerHook.markers}
                        currentTimeMs={currentTime * 1000}
                        durationMs={timelinePlayback.timelineDurationMs > 0 ? timelinePlayback.timelineDurationMs : videoDuration * 1000}
                        showPeriodMarkerMenu={markerHook.showPeriodMarkerMenu}
                        showAddMarkerMenu={markerHook.showAddMarkerMenu}
                        onTogglePeriodMenu={() => {
                          markerHook.setShowAddMarkerMenu(false);
                          markerHook.setShowPeriodMarkerMenu(!markerHook.showPeriodMarkerMenu);
                        }}
                        onToggleAddMenu={() => {
                          markerHook.setShowPeriodMarkerMenu(false);
                          markerHook.setShowAddMarkerMenu(!markerHook.showAddMarkerMenu);
                        }}
                        onQuickPeriodMarker={markerHook.handleQuickPeriodMarker}
                        onQuickAddMarker={markerHook.handleQuickAddMarker}
                        onMarkerClick={markerHook.handleMarkerClick}
                      />
                    )}

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedVideo.name}</h2>

                      {/* Camera Selector - right above video for easy switching */}
                      {/* First try timeline-based camera selector */}
                      <TimelineCameraSelector
                        gameId={gameId}
                        selectedCameraId={selectedVideo?.id || null}
                        onCameraSwitch={timelinePlayback.handleCameraSwitch}
                      />
                      {/* Fallback: Simple camera selector when multiple videos exist */}
                      {/* Always show when 2+ non-virtual videos - allows quick camera switching */}
                      {videos.filter(v => !v.is_virtual).length > 1 && (
                        <div className="flex gap-2 mb-4 flex-wrap">
                          {videos.filter(v => !v.is_virtual).map((video) => (
                            <button
                              key={video.id}
                              onClick={() => {
                                bridge.setSelectedVideo(video);
                                videoManagement.loadVideo(video);
                              }}
                              className={`
                                px-3 py-1.5 text-sm rounded-full transition-all duration-200
                                ${selectedVideo?.id === video.id
                                  ? 'bg-black text-white font-medium'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }
                              `}
                            >
                              {video.camera_label || video.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Video with "No film available" overlay */}
                      <VideoErrorBoundary
                        videoId={selectedVideo?.id}
                        videoName={selectedVideo?.name}
                        gameId={gameId}
                        cameraLabel={selectedVideo?.camera_label || undefined}
                        onReload={() => {
                          if (selectedVideo) {
                            videoManagement.loadVideo(selectedVideo);
                          }
                        }}
                      >
                      <div className="relative">
                        <video
                          ref={videoRef}
                          src={videoUrl}
                          controls
                          preload="metadata"
                          className="w-full rounded-lg bg-black"
                          style={{ maxHeight: '600px' }}
                          onTimeUpdate={(e) => {
                            const video = e.target as HTMLVideoElement;
                            bridge.setCurrentTime(video.currentTime);
                            if (timelinePlayback.isSwitchingCamera || timelinePlayback.pendingSyncSeek !== null || timelinePlayback.seekLockRef.current) {
                              return;
                            }
                            const isAtVideoEnd = video.duration > 0 && video.currentTime >= video.duration - 0.5;
                            if (!isAtVideoEnd) {
                              timelinePlayback.setGameTimelinePositionMs(timelinePlayback.videoOffsetMs + (video.currentTime * 1000));
                            }
                          }}
                          onLoadedMetadata={(e) => {
                            const video = e.target as HTMLVideoElement;
                            bridge.setVideoDuration(video.duration);
                          }}
                          onCanPlay={() => {
                            if (timelinePlayback.pendingSyncSeek === null && timelinePlayback.pendingCameraId === null) {
                              timelinePlayback.setIsSwitchingCamera(false);
                            }
                          }}
                          onError={(e) => {
                            // Handle video load errors with URL refresh attempt
                            const video = e.target as HTMLVideoElement;
                            const error = video.error;
                            console.error('[Video Error]', {
                              code: error?.code,
                              message: error?.message,
                              networkState: video.networkState,
                              readyState: video.readyState,
                              src: video.src?.substring(0, 100) + '...',
                              urlRefreshAttempted,
                            });

                            // Check if this might be an expired URL error (network errors often indicate this)
                            // Error codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
                            const isNetworkOrSrcError = error?.code === 2 || error?.code === 4;

                            // If we haven't tried refreshing the URL yet, attempt it
                            if (!urlRefreshAttempted && selectedVideo && isNetworkOrSrcError) {
                              console.log('[Video Error] Attempting URL refresh before showing error');
                              bridge.setUrlRefreshAttempted(true);
                              videoManagement.loadVideo(selectedVideo);
                              return; // Don't show error yet, wait for refresh result
                            }

                            // Either we already tried refreshing or it's a different error type
                            // Clear the URL to stop retry attempts
                            if (videoUrl) {
                              console.error('[Video Error] Clearing video URL to prevent retry loop');
                              bridge.setVideoUrl('');
                              bridge.setVideoLoadError(
                                urlRefreshAttempted
                                  ? 'Failed to load video after refresh. The file may be missing or corrupted.'
                                  : 'Failed to load video. The file may be missing or corrupted.'
                              );
                            }
                            timelinePlayback.setIsSwitchingCamera(false);
                          }}
                          onEnded={() => {
                            console.log('[VideoEnded] Video playback ended');
                            if (!selectedVideo || timelinePlayback.timelineLanes.length === 0) return;
                            let videoLane: any;
                            let currentClip: any;
                            for (const lane of timelinePlayback.timelineLanes) {
                              const clip = lane.clips.find((c: any) => c.videoId === selectedVideo.id);
                              if (clip) { videoLane = lane; currentClip = clip; break; }
                            }
                            if (!videoLane || !currentClip) return;
                            const currentClipEnd = currentClip.lanePositionMs + currentClip.durationMs;
                            const otherClips = videoLane.clips.filter((c: any) => c.videoId !== selectedVideo.id);
                            const nextClip = otherClips
                              .filter((c: any) => c.lanePositionMs >= currentClipEnd - 1000)
                              .sort((a: any, b: any) => a.lanePositionMs - b.lanePositionMs)[0];
                            if (nextClip) {
                              console.log('[VideoEnded] Auto-continuing to next clip:', nextClip.videoId);
                              timelinePlayback.setGameTimelinePositionMs(nextClip.lanePositionMs);
                              timelinePlayback.handleCameraSwitch(nextClip.videoId, nextClip.lanePositionMs);
                            } else {
                              console.log('[VideoEnded] No more clips on this camera');
                              timelinePlayback.setGameTimelinePositionMs(currentClipEnd);
                            }
                          }}
                          onPlay={() => timelinePlayback.setIsPlaying(true)}
                          onPause={() => {
                            timelinePlayback.setIsPlaying(false);
                            timelinePlayback.stopVirtualPlayback();
                          }}
                        />

                        {/* Loading overlay - shows while switching cameras */}
                        {timelinePlayback.isSwitchingCamera && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-10">
                            <div className="text-center p-8">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-3" />
                              <div className="text-white text-lg font-semibold">
                                Loading camera...
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Video load error overlay */}
                        {videoLoadError && (
                          <div className="absolute inset-0 bg-black/90 flex items-center justify-center rounded-lg">
                            <div className="text-center p-8">
                              <div className="text-red-400 text-lg font-semibold mb-2">
                                Video Load Error
                              </div>
                              <div className="text-gray-300 text-sm mb-4 max-w-md">
                                {videoLoadError}
                              </div>
                              <button
                                onClick={() => {
                                  bridge.setVideoLoadError(null);
                                  if (selectedVideo) {
                                    videoManagement.loadVideo(selectedVideo);
                                  }
                                }}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                              >
                                Try Again
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Coverage overlays */}
                        <CoverageOverlays
                          timelineDurationMs={timelinePlayback.timelineDurationMs}
                          isSwitchingCamera={timelinePlayback.isSwitchingCamera}
                          pendingCameraId={timelinePlayback.pendingCameraId}
                          videoDuration={videoDuration}
                          videoOffsetMs={timelinePlayback.videoOffsetMs}
                          clipDurationMs={timelinePlayback.clipDurationMs}
                          selectedVideoSyncOffset={selectedVideo?.sync_offset_seconds || 0}
                          targetGameTimeMs={timelinePlayback.targetGameTimeMs}
                          gameTimelinePositionMs={timelinePlayback.gameTimelinePositionMs}
                          timelineLanes={timelinePlayback.timelineLanes}
                          currentLaneNumber={timelinePlayback.currentLaneNumber}
                          isVirtuallyPlaying={timelinePlayback.isVirtuallyPlaying}
                          onDismissOverlay={() => timelinePlayback.setTargetGameTimeMs(null)}
                        />
                      </div>
                      </VideoErrorBoundary>

                    <div className="mt-4 space-y-4">
                      {/* Play Instances Timeline */}
                      {videoDuration > 0 && (
                        <PlayTimelineBar
                          playInstances={playInstances}
                          videoDuration={videoDuration}
                          timelineDurationMs={timelinePlayback.timelineDurationMs}
                          videoOffsetMs={timelinePlayback.videoOffsetMs}
                          gameTimelinePositionMs={timelinePlayback.gameTimelinePositionMs}
                          onJumpToPlay={playTagging.jumpToPlay}
                        />
                      )}

                      {/* Controls */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          Current Time: <span className="text-gray-900">{formatTime(currentTime)}</span>
                          {videoDuration > 0 && <span className="text-gray-500"> / {formatTime(videoDuration)}</span>}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!playTagging.isSettingEndTime ? (
                            <>
                              <button
                                onClick={playTagging.handleMarkPlayStart}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ▶ Mark Start
                              </button>

                              {/* Marker controls moved to marker strip above video */}
                            </>
                          ) : (
                            <>
                              <div className="px-4 py-2 bg-yellow-50 text-yellow-800 rounded font-semibold text-sm border border-yellow-200">
                                Recording from {formatTime(tagStartTime)}
                              </div>
                              <button
                                onClick={playTagging.handleMarkPlayEnd}
                                className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-semibold transition-colors"
                              >
                                ■ Mark End
                              </button>
                            </>
                          )}

                          {/* Help tooltip */}
                          <div className="relative group">
                            <button
                              type="button"
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label="How to tag plays"
                            >
                              <HelpCircle size={20} />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <p className="font-semibold mb-2">How to Tag Plays:</p>
                              <ol className="list-decimal list-inside space-y-1 text-gray-200">
                                <li>Click "Mark Start" at the beginning</li>
                                <li>Let the play run</li>
                                <li>Click "Mark End" when finished</li>
                                <li>Fill in details and save</li>
                              </ol>
                              <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marker Panel */}
                  {showMarkerPanel && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <button
                        type="button"
                        onClick={() => setMarkersCollapsed(!markersCollapsed)}
                        className="w-full flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">Video Markers</h3>
                          <span className="text-sm text-gray-600">({markerHook.markers.length})</span>
                        </div>
                        {markersCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      {!markersCollapsed && (
                        <div className="mt-4">
                          <MarkerList
                            markers={markerHook.markers}
                            onJumpToMarker={markerHook.handleJumpToMarker}
                            onDeleteMarker={markerHook.handleDeleteMarker}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 text-lg mb-4">No video for this game yet</p>
                    <div className="text-center">
                      <label className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 cursor-pointer font-semibold transition-colors">
                        Upload Video
                        <input
                          type="file"
                          accept="video/*"
                          onChange={videoUpload.handleVideoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-4">No videos for this game yet</p>
                  <p className="text-gray-500 text-sm">
                    Use the <strong>Upload</strong> button in the Timeline above to add video
                  </p>
                </div>
              )}
            </div>

            {/* Tagged Plays List */}
            <PlayListPanel
              playInstances={playInstances}
              drives={drives}
              formatTime={formatTime}
              getDownLabel={getDownLabel}
              onEditInstance={playTagging.handleEditInstance}
              onDeleteInstance={playTagging.deletePlayInstance}
              onJumpToPlay={playTagging.jumpToPlay}
              videoRef={videoRef}
            />
          </div>
        </div>
      </div>

      {/* Tag Play Modal */}
      <TaggingPanel
        isOpen={showTagModal}
        onClose={() => {
          bridge.setShowTagModal(false);
          bridge.setEditingInstance(null);
          playTagging.cancelTagging();
        }}
        tagStartTime={tagStartTime}
        tagEndTime={tagEndTime}
        editingInstance={editingInstance}
        game={game}
        selectedVideo={selectedVideo}
        players={players}
        plays={plays}
        drives={drives}
        currentDrive={currentDrive}
        taggingTier={gameScoring.taggingTier}
        onSaveComplete={() => {
          const timelineVideoIds = [...new Set(timelinePlayback.timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
          dataFetching.fetchPlayInstances(timelineVideoIds);
        }}
        onDriveCreated={(drive) => bridge.setCurrentDrive(drive)}
        fetchDrives={dataFetching.fetchDrives}
        filmAnalysisStatus={gameScoring.filmAnalysisStatus}
        onStatusChange={gameScoring.setFilmAnalysisStatus}
        teamId={teamId}
        gameId={gameId}
        previousPlay={playTagging.getPreviousPlay()}
        quarterFromTimestamp={markerHook.getQuarterFromTimestamp(Math.floor(tagStartTime * 1000)) ?? null}
      />


      {/* Combine Videos Modal */}
      {showCombineModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCombineModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <CombineVideosModal
            gameId={gameId}
            selectedVideos={videos.filter(v => selectedVideoIds.has(v.id))}
            onCombined={(virtualVideoId) => {
              setShowCombineModal(false);
              setSelectedVideoIds(new Set()); // Clear selection
              dataFetching.fetchVideos(); // Refresh video list
              // Auto-select the newly created virtual video
              setTimeout(() => {
                const virtualVideo = videos.find(v => v.id === virtualVideoId);
                if (virtualVideo) {
                  bridge.setSelectedVideo(virtualVideo);
                }
              }, 500);
            }}
            onClose={() => setShowCombineModal(false)}
          />
          </div>
        </div>
      )}

      {/* Edit Marker Modal */}
      <EditMarkerModal
        isOpen={markerHook.editingMarker !== null}
        marker={markerHook.editingMarker}
        currentVideoTimeMs={currentTime * 1000}
        onClose={() => markerHook.setEditingMarker(null)}
        onUpdate={markerHook.handleUpdateMarker}
        onDelete={markerHook.handleDeleteMarker}
        onSeekTo={markerHook.handleMarkerSeekTo}
      />

      {/* Tagging Tier Selector Modal */}
      <TierSelectorModal
        isOpen={gameScoring.showTierSelector}
        onSelect={gameScoring.handleTierSelect}
        gameName={game?.name}
      />

      {/* Tagging Tier Upgrade Modal */}
      {gameScoring.taggingTier && (
        <TierUpgradeModal
          isOpen={gameScoring.showTierUpgrade}
          currentTier={gameScoring.taggingTier}
          playsTaggedCount={playInstances.length}
          onConfirm={gameScoring.handleTierUpgrade}
          onCancel={() => gameScoring.setShowTierUpgrade(false)}
        />
      )}

      {/* Film Tagging Complete Confirmation Modal */}
      <TaggingCompleteModal
        isOpen={gameScoring.showTaggingCompleteModal}
        filmAnalysisStatus={gameScoring.filmAnalysisStatus}
        finalScoreInputs={gameScoring.finalScoreInputs}
        onFinalScoreChange={gameScoring.setFinalScoreInputs}
        playsTaggedCount={playInstances.length}
        videosOnTimelineCount={new Set(timelinePlayback.timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId))).size}
        opponentName={game?.opponent}
        onClose={gameScoring.closeCompleteModal}
        onConfirm={gameScoring.handleConfirmComplete}
      />
    </>
  );
}

