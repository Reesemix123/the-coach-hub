'use client';

import { useState, type RefObject } from 'react';
import { createClient } from '@/utils/supabase/client';
import { uploadFile, formatBytes, formatTime, formatSpeed, type UploadProgress } from '@/lib/utils/resumable-upload';
import type { useFilmStateBridge } from '@/components/film/context';

// ============================================
// TYPES
// ============================================

interface UseVideoUploadOptions {
  teamId: string;
  bridge: ReturnType<typeof useFilmStateBridge>;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

// ============================================
// HOOK
// ============================================

export function useVideoUpload({
  teamId,
  bridge,
  fileInputRef,
}: UseVideoUploadOptions) {
  const supabase = createClient();
  const { game, videos } = bridge.state.data;
  const { cameraLimit } = bridge.state.ui;

  // Upload state
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadDetails, setUploadDetails] = useState<{
    speed: string;
    remaining: string;
    uploaded: string;
    total: string;
  } | null>(null);

  function handleAddCameraClick() {
    fileInputRef.current?.click();
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!game) {
      alert('Game data not loaded. Please refresh the page and try again.');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeGB = fileSizeMB / 1024;
    const MAX_FILE_SIZE_GB = 5;

    // Check file size limit (5GB max)
    if (fileSizeGB > MAX_FILE_SIZE_GB) {
      alert(`File size (${fileSizeGB.toFixed(1)}GB) exceeds maximum allowed (${MAX_FILE_SIZE_GB}GB).\n\nFor videos over 50 minutes, we recommend compressing to 10-12 Mbps bitrate using:\n• HandBrake (free, handbrake.fr)\n• Your video editing software's export settings`);
      return;
    }

    // Show warning for large files (over 1GB)
    if (fileSizeGB > 1) {
      if (!confirm(`This file is ${fileSizeGB.toFixed(1)}GB. Large files may take a while to upload.\n\nEstimated upload time: ${Math.ceil(fileSizeMB / 10)} - ${Math.ceil(fileSizeMB / 5)} minutes on a good connection.\n\nContinue?`)) {
        return;
      }
    }

    setUploadingVideo(true);
    setUploadProgress(0);
    setUploadDetails(null);
    setUploadStatus('Checking upload permissions...');

    try {
      // Step 1: Pre-flight check with our API (quota, rate limits, file type validation)
      setUploadProgress(2);
      const preflightResponse = await fetch(`/api/teams/${teamId}/videos/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          gameId: game.id,
        }),
      });

      const preflightData = await preflightResponse.json();

      if (!preflightResponse.ok || !preflightData.allowed) {
        const errorMessage = preflightData.message || preflightData.error || 'Upload not allowed';

        // Show user-friendly error based on reason
        if (preflightData.details?.reason === 'quota_exceeded') {
          alert(`Storage quota exceeded.\n\nYou've used ${preflightData.details.used_formatted} of ${preflightData.details.quota_formatted}.\n\nPlease delete some videos to free up space.`);
        } else if (preflightData.details?.reason === 'rate_limited') {
          alert(`Upload rate limit exceeded.\n\nYou've made ${preflightData.details.uploads_this_hour} uploads in the last hour.\nMaximum allowed: ${preflightData.details.max_uploads_per_hour}\n\nPlease wait before uploading more videos.`);
        } else if (preflightData.details?.reason === 'file_too_large') {
          alert(`File is too large.\n\nMaximum file size: ${preflightData.details.max_file_size_formatted}\nYour file: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        } else if (preflightData.details?.reason === 'invalid_file_type') {
          alert(`Invalid file type.\n\nOnly video files are allowed: ${preflightData.details.allowed_extensions?.join(', ')}`);
        } else if (preflightData.details?.reason === 'camera_limit' || preflightData.error === 'camera_limit') {
          alert(`Camera limit reached.\n\nYour plan allows ${preflightData.details?.limit || cameraLimit} camera angle${(preflightData.details?.limit || cameraLimit) === 1 ? '' : 's'} per game.\n\nUpgrade your plan to add more cameras.`);
        } else {
          alert(`Upload not allowed: ${errorMessage}`);
        }
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        setUploadDetails(null);
        return;
      }

      const { uploadId, storagePath } = preflightData;

      // Step 2: Upload to Supabase Storage using resumable upload for large files
      setUploadProgress(5);
      const fileSizeDisplay = fileSizeGB >= 1 ? `${fileSizeGB.toFixed(1)} GB` : `${fileSizeMB.toFixed(1)} MB`;
      setUploadStatus(`Uploading ${file.name} (${fileSizeDisplay})...`);

      // Use resumable upload utility (TUS protocol for files > 100MB)
      const uploadResult = await uploadFile(
        supabase,
        'game_videos',
        storagePath,
        file,
        {
          onProgress: (progress: UploadProgress) => {
            // Map upload progress to 5-90% range (leave room for finalization)
            const mappedProgress = 5 + Math.round(progress.percentage * 0.85);
            setUploadProgress(mappedProgress);

            // Update detailed progress info
            setUploadDetails({
              speed: formatSpeed(progress.speed),
              remaining: progress.remainingTime > 0 ? formatTime(progress.remainingTime) : 'calculating...',
              uploaded: formatBytes(progress.bytesUploaded),
              total: formatBytes(progress.bytesTotal),
            });

            // Update status with progress details
            if (progress.percentage < 100) {
              setUploadStatus(`Uploading: ${progress.percentage}% • ${formatSpeed(progress.speed)}`);
            }
          },
          onError: async (error: Error) => {
            console.error('Upload error:', error);

            // Report upload failure to our API
            await fetch(`/api/teams/${teamId}/videos/upload?uploadId=${uploadId}&reason=storage_error`, {
              method: 'DELETE',
            });

            alert(`Error uploading video: ${error.message}\n\nIf uploading a large file (>1GB), please:\n1. Check your internet connection and try again\n2. Or compress the video to 10-12 Mbps using HandBrake (free)`);
            setUploadingVideo(false);
            setUploadProgress(0);
            setUploadStatus('');
            setUploadDetails(null);
          },
        }
      );

      if (!uploadResult.success) {
        // Error already handled in onError callback
        if (uploadResult.error) {
          console.error('Upload failed:', uploadResult.error);
        }
        return;
      }

      // Step 3: Complete the upload (creates video record and updates storage tracking)
      setUploadProgress(92);
      setUploadStatus('Finalizing upload...');
      setUploadDetails(null);

      const completeResponse = await fetch(`/api/teams/${teamId}/videos/upload`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          storagePath,
          gameId: game.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        console.error('Complete upload error:', completeData);
        alert('Video uploaded but record creation failed. Please refresh the page.');
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        return;
      }

      setUploadProgress(100);
      setUploadStatus('Upload complete!');

      if (completeData.video) {
        bridge.setVideos([completeData.video, ...videos]);
        bridge.setSelectedVideo(completeData.video);

        // Show success with storage info (brief delay to show 100%)
        setTimeout(() => {
          const storage = completeData.storage;
          if (storage && storage.quota_used_percent >= 80) {
            alert(`Video uploaded successfully!\n\nWarning: You've used ${storage.quota_used_percent}% of your storage quota.`);
          }
          setUploadingVideo(false);
          setUploadProgress(0);
          setUploadStatus('');
          setUploadDetails(null);
        }, 500);
      } else {
        setUploadingVideo(false);
        setUploadProgress(0);
        setUploadStatus('');
        setUploadDetails(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading video. Please try again or use a smaller file.');
      setUploadingVideo(false);
      setUploadProgress(0);
      setUploadStatus('');
      setUploadDetails(null);
    }
  }

  return {
    uploadingVideo,
    uploadProgress,
    uploadStatus,
    uploadDetails,
    handleAddCameraClick,
    handleVideoUpload,
  };
}
