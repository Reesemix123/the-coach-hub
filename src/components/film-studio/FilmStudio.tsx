'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFilmStudio, FilmStudioProvider } from './context/FilmStudioContext';
import { UnifiedTimeline } from './timeline/UnifiedTimeline';
import { CompactVideoPlayer } from './layout/CompactVideoPlayer';
import { SliceModal } from './layout/SliceModal';
import { DirectorsCutControls } from './directors-cut/DirectorsCutControls';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertCircle, Tag, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';

// Storage warning thresholds
const WARNING_THRESHOLD_PERCENT = 80;
const CRITICAL_THRESHOLD_PERCENT = 95;

interface AvailableVideo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationMs: number;
  cameraOrder: number;
  cameraLabel: string | null;
}

interface FilmStudioContentProps {
  gameName: string;
  opponent?: string;
  gameDate?: string;
}

function FilmStudioContent({ gameName, opponent, gameDate }: FilmStudioContentProps) {
  const {
    state,
    dispatch,
    switchCamera,
    seekTo,
    togglePlayback,
    setPlaying,
    startRecording,
    stopRecording,
    clearCameraSelections,
    loadCameras,
    loadTimeline,
    markSliceStart,
    markSliceEnd,
    clearSlice,
    saveSlice,
    timelineService,
  } = useFilmStudio();

  const supabase = createClient();

  const [availableVideos, setAvailableVideos] = useState<AvailableVideo[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<{
    type: 'warning' | 'error';
    title: string;
    message: string;
    details?: string;
    onConfirm?: () => void;
  } | null>(null);

  const {
    gameId,
    teamId,
    timeline,
    cameras,
    primaryCameraId,
    currentTimeMs,
    isPlaying,
    isRecording,
    isPlaybackMode,
    cameraSelections,
    isSlicing,
    sliceStartTimeMs,
    showSliceModal,
    isLoading,
    error,
  } = state;

  // Load available videos
  useEffect(() => {
    const loadVideos = async () => {
      if (!gameId) return;
      try {
        const videos = await timelineService.getAvailableVideos(gameId);
        setAvailableVideos(videos);
      } catch (err) {
        console.error('Failed to load videos:', err);
      }
    };
    loadVideos();
  }, [gameId, timeline, timelineService]);

  // Generate signed URL for active camera
  useEffect(() => {
    const generateSignedUrl = async () => {
      console.log('[FilmStudio] generateSignedUrl called:', {
        primaryCameraId,
        camerasCount: cameras.length,
        cameraIds: cameras.map(c => c.id),
      });

      // Use primaryCameraId if set, otherwise use first camera
      const cameraIdToUse = primaryCameraId || (cameras.length > 0 ? cameras[0].id : null);

      if (!cameraIdToUse) {
        console.log('[FilmStudio] No camera available, setting signedUrl to null');
        setSignedUrl(null);
        return;
      }

      // If no primaryCameraId but we have cameras, auto-select the first one
      if (!primaryCameraId && cameras.length > 0) {
        console.log('[FilmStudio] Auto-selecting first camera:', cameras[0].id);
        dispatch({ type: 'SET_PRIMARY_CAMERA', cameraId: cameras[0].id });
      }

      const camera = cameras.find((c) => c.id === cameraIdToUse);
      console.log('[FilmStudio] Found camera:', camera ? { id: camera.id, label: camera.label, url: camera.url?.substring(0, 50) } : null);

      if (!camera?.url) {
        console.log('[FilmStudio] No camera URL, setting signedUrl to null');
        setSignedUrl(null);
        return;
      }

      // Extract file path from URL (assuming Supabase storage URL format)
      const urlParts = camera.url.split('/game_videos/');
      if (urlParts.length < 2) {
        // Direct URL, use as-is
        setSignedUrl(camera.url);
        return;
      }

      const filePath = urlParts[1];

      try {
        const { data, error } = await supabase.storage
          .from('game_videos')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error('Failed to generate signed URL:', err);
        setSignedUrl(camera.url); // Fall back to original URL
      }
    };

    generateSignedUrl();
  }, [primaryCameraId, cameras, supabase, dispatch]);

  // Calculate total duration
  const totalDurationMs = useMemo(() => {
    if (timeline && timeline.totalDurationMs > 0) {
      return timeline.totalDurationMs;
    }
    // Use longest camera duration
    const maxCameraDuration = cameras.reduce(
      (max, cam) => Math.max(max, cam.durationMs),
      0
    );
    return maxCameraDuration > 0 ? maxCameraDuration : 5 * 60 * 1000; // Default 5 min
  }, [timeline, cameras]);

  // Handle time updates from video player
  const handleTimeUpdate = useCallback(
    (timeMs: number) => {
      dispatch({ type: 'UPDATE_CURRENT_TIME', timeMs });
    },
    [dispatch]
  );

  // Handle camera switch
  const handleCameraSwitch = useCallback(
    (cameraId: string) => {
      switchCamera(cameraId);
    },
    [switchCamera]
  );

  // Handle recording toggle
  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Format bytes to human-readable string
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Perform the actual upload (called after validation)
  const performUpload = useCallback(
    async (file: File, lane: number) => {
      console.log('[FilmStudio] Upload starting:', { fileName: file.name, fileSize: file.size, lane });
      dispatch({ type: 'START_UPLOAD', lane });
      dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 0, status: 'Reading video...' });

      try {
        // Extract video duration before uploading
        const durationSeconds = await new Promise<number>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';

          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const duration = Math.round(video.duration);
            console.log('[FilmStudio] Video duration:', duration, 'seconds', `(${Math.round(duration / 60)} minutes)`);
            resolve(duration);
          };

          video.onerror = () => {
            window.URL.revokeObjectURL(video.src);
            console.warn('[FilmStudio] Could not read video duration, using default');
            resolve(0); // Default to 0 if we can't read it
          };

          video.src = URL.createObjectURL(file);
        });

        // Create a unique file path
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${teamId}/${gameId}/${timestamp}_${sanitizedName}`;

        console.log('[FilmStudio] Uploading to path:', filePath);

        // Get auth session first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No auth session - please log in again');
        }

        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 0, status: 'Uploading...' });

        // Upload to Supabase storage using XMLHttpRequest for progress tracking
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const uploadUrl = `${supabaseUrl}/storage/v1/object/game_videos/${filePath}`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          // Track upload progress - show full 0-100% for file transfer
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              console.log('[FilmStudio] Upload progress:', progress + '%');
              dispatch({
                type: 'UPDATE_UPLOAD_PROGRESS',
                progress,
                status: `Uploading... ${progress}%`,
              });
            }
          });

          xhr.addEventListener('load', () => {
            console.log('[FilmStudio] XHR load event, status:', xhr.status);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              console.error('[FilmStudio] Upload error response:', xhr.status, xhr.responseText);
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', (e) => {
            console.error('[FilmStudio] Upload network error:', e);
            reject(new Error('Upload failed due to network error'));
          });

          xhr.open('POST', uploadUrl);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('x-upsert', 'false');
          xhr.send(file);
        });

        console.log('[FilmStudio] Upload complete, creating video record');
        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 100, status: 'Processing...' });

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('game_videos')
          .getPublicUrl(filePath);

        // Get lane label from current state
        const currentLaneLabel = state.timeline?.lanes.find(l => l.lane === lane)?.label || `Camera ${lane}`;

        // Create video record and get its ID
        const { data: insertedVideo, error: insertError } = await supabase
          .from('videos')
          .insert({
            name: file.name,
            file_path: filePath,
            url: urlData.publicUrl,
            game_id: gameId,
            camera_order: lane,
            camera_label: currentLaneLabel,
            upload_status: 'ready',
            is_virtual: false,
            duration_seconds: durationSeconds > 0 ? durationSeconds : null,
          })
          .select('id, duration_seconds')
          .single();

        console.log('[FilmStudio] Video inserted with duration:', insertedVideo?.duration_seconds, 'seconds');

        if (insertError) {
          console.error('[FilmStudio] Insert error:', insertError);
          throw insertError;
        }

        console.log('[FilmStudio] Video record created:', insertedVideo?.id);

        // Add the video as a clip to the timeline
        if (state.timeline?.videoGroupId && insertedVideo?.id) {
          // Calculate position: place after the last clip in this lane
          const laneData = state.timeline.lanes.find(l => l.lane === lane);
          let positionMs = 0;

          if (laneData && laneData.clips.length > 0) {
            // Find the end of the last clip in this lane
            const lastClipEnd = Math.max(
              ...laneData.clips.map(c => c.lanePositionMs + c.durationMs)
            );
            positionMs = lastClipEnd;
            console.log('[FilmStudio] Placing clip after existing clips at:', positionMs, 'ms');
          }

          await timelineService.addClip(
            state.timeline.videoGroupId,
            {
              videoId: insertedVideo.id,
              cameraLane: lane,
              positionMs,
              label: currentLaneLabel,
            },
            gameId,
            false // Skip validation for newly uploaded video
          );
          console.log('[FilmStudio] Video added to timeline at position:', positionMs);
        }

        // Reload cameras, videos, and timeline
        await loadCameras();
        await loadTimeline();
        const videos = await timelineService.getAvailableVideos(gameId);
        setAvailableVideos(videos);

        console.log('[FilmStudio] Upload complete!');
        dispatch({ type: 'COMPLETE_UPLOAD' });
      } catch (err) {
        console.error('[FilmStudio] Upload failed:', err);
        dispatch({ type: 'CANCEL_UPLOAD' });
      }
    },
    [dispatch, gameId, teamId, supabase, loadCameras, loadTimeline, timelineService, state.timeline]
  );

  // Handle upload start for a lane (validates storage before uploading)
  const handleUploadStart = useCallback(
    async (file: File, lane: number) => {
      console.log('[FilmStudio] Validating upload:', { fileName: file.name, fileSize: file.size, lane });

      try {
        // Call the validation API
        const response = await fetch(`/api/teams/${teamId}/videos/upload?gameId=${gameId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            checkOnly: true, // Just validate, don't start upload
          }),
        });

        const validation = await response.json();

        if (!response.ok || !validation.allowed) {
          // Upload blocked - show error
          setUploadWarning({
            type: 'error',
            title: 'Cannot Upload Video',
            message: validation.error || validation.message || 'Storage limit exceeded',
            details: validation.details,
          });
          return;
        }

        // Check if upload would bring storage close to limit
        const { teamStorageAfter, teamStorageQuota, gameStorageAfter, gameStorageLimit } = validation;

        // Calculate percentages
        const teamPercentAfter = teamStorageQuota > 0 ? (teamStorageAfter / teamStorageQuota) * 100 : 0;
        const gamePercentAfter = gameStorageLimit > 0 ? (gameStorageAfter / gameStorageLimit) * 100 : 0;

        // Check for warnings
        if (teamPercentAfter >= CRITICAL_THRESHOLD_PERCENT || gamePercentAfter >= CRITICAL_THRESHOLD_PERCENT) {
          // Critical warning - ask for confirmation
          setUploadWarning({
            type: 'warning',
            title: 'Storage Almost Full',
            message: `This upload will use ${Math.round(Math.max(teamPercentAfter, gamePercentAfter))}% of your storage limit.`,
            details: teamPercentAfter >= CRITICAL_THRESHOLD_PERCENT
              ? `Team storage: ${formatBytes(teamStorageAfter)} / ${formatBytes(teamStorageQuota)}`
              : `Game storage: ${formatBytes(gameStorageAfter)} / ${formatBytes(gameStorageLimit)}`,
            onConfirm: () => {
              setUploadWarning(null);
              performUpload(file, lane);
            },
          });
          return;
        }

        if (teamPercentAfter >= WARNING_THRESHOLD_PERCENT || gamePercentAfter >= WARNING_THRESHOLD_PERCENT) {
          // Warning - show but continue
          console.log('[FilmStudio] Storage warning:', { teamPercentAfter, gamePercentAfter });
        }

        // Proceed with upload
        performUpload(file, lane);
      } catch (err) {
        console.error('[FilmStudio] Validation error:', err);
        // On validation error, proceed with upload (fail open)
        performUpload(file, lane);
      }
    },
    [teamId, gameId, performUpload]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Failed to load film studio
        </h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Warning/Error Modal */}
      {uploadWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3">
              {uploadWarning.type === 'error' ? (
                <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${uploadWarning.type === 'error' ? 'text-red-900' : 'text-amber-900'}`}>
                  {uploadWarning.title}
                </h3>
                <p className="mt-1 text-gray-600">{uploadWarning.message}</p>
                {uploadWarning.details && (
                  <p className="mt-2 text-sm text-gray-500">{uploadWarning.details}</p>
                )}
              </div>
              <button
                onClick={() => setUploadWarning(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              {uploadWarning.onConfirm ? (
                <>
                  <button
                    onClick={() => setUploadWarning(null)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadWarning.onConfirm}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    Upload Anyway
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setUploadWarning(null)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{gameName}</h1>
          {opponent && (
            <p className="text-gray-500">
              vs {opponent}
              {gameDate && ` · ${new Date(gameDate).toLocaleDateString()}`}
            </p>
          )}
        </div>
        <Link
          href={`/teams/${teamId}/film/${gameId}/tag`}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Tag size={16} />
          Tag Plays
        </Link>
      </div>

      {/* Main content - Timeline on top */}
      <UnifiedTimeline
        availableVideos={availableVideos}
        onUploadStart={handleUploadStart}
      />

      {/* Video player and Director's Cut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video player - 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <CompactVideoPlayer
            videoUrl={signedUrl}
            currentTimeMs={currentTimeMs}
            totalDurationMs={totalDurationMs}
            isPlaying={isPlaying}
            cameras={cameras}
            activeCameraId={primaryCameraId}
            isRecording={isRecording}
            isSlicing={isSlicing}
            sliceStartTimeMs={sliceStartTimeMs}
            onMarkStart={markSliceStart}
            onMarkEnd={markSliceEnd}
            onTimeUpdate={handleTimeUpdate}
            onPlayPause={togglePlayback}
            onSeek={seekTo}
            onCameraSwitch={handleCameraSwitch}
            onRecordToggle={cameras.length > 1 ? handleRecordToggle : undefined}
          />
        </div>

        {/* Director's Cut panel - 1/3 width on large screens */}
        {cameras.length > 1 && (
          <div className="lg:col-span-1">
            <DirectorsCutControls
              cameras={cameras}
              cameraSelections={cameraSelections}
              isRecording={isRecording}
              isPlaybackMode={isPlaybackMode}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onStartPlayback={() => dispatch({ type: 'START_PLAYBACK_MODE' })}
              onStopPlayback={() => dispatch({ type: 'STOP_PLAYBACK_MODE' })}
              onClearSelections={clearCameraSelections}
            />
          </div>
        )}
      </div>

      {/* Slice Modal */}
      {showSliceModal && sliceStartTimeMs !== null && state.sliceEndTimeMs !== null && (
        <SliceModal
          isOpen={showSliceModal}
          startTimeMs={sliceStartTimeMs}
          endTimeMs={state.sliceEndTimeMs}
          gameId={gameId}
          teamId={teamId}
          onSave={saveSlice}
          onCancel={clearSlice}
        />
      )}
    </div>
  );
}

// Main exported component with provider wrapper
interface FilmStudioProps {
  gameId: string;
  teamId: string;
  gameName?: string;
  opponent?: string;
  gameDate?: string;
}

export function FilmStudio({
  gameId,
  teamId,
  gameName = 'Game Film',
  opponent,
  gameDate,
}: FilmStudioProps) {
  return (
    <FilmStudioProvider gameId={gameId} teamId={teamId} gameName={gameName}>
      <FilmStudioContent
        gameName={gameName}
        opponent={opponent}
        gameDate={gameDate}
      />
    </FilmStudioProvider>
  );
}

export default FilmStudio;
