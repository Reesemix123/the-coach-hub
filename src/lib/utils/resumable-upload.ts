// src/lib/utils/resumable-upload.ts
// Resumable upload utility using TUS protocol for large files

import * as tus from 'tus-js-client';
import { SupabaseClient } from '@supabase/supabase-js';

// Threshold for using resumable uploads (100MB)
const RESUMABLE_UPLOAD_THRESHOLD = 100 * 1024 * 1024;

export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

export interface UploadCallbacks {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
}

export interface ResumableUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to Supabase Storage
 * Uses TUS resumable upload for files > 100MB, standard upload otherwise
 */
export async function uploadFile(
  supabase: SupabaseClient,
  bucketName: string,
  filePath: string,
  file: File,
  callbacks: UploadCallbacks = {}
): Promise<ResumableUploadResult> {
  const useResumable = file.size > RESUMABLE_UPLOAD_THRESHOLD;

  if (useResumable) {
    return resumableUpload(supabase, bucketName, filePath, file, callbacks);
  } else {
    return standardUpload(supabase, bucketName, filePath, file, callbacks);
  }
}

/**
 * Standard upload for smaller files
 */
async function standardUpload(
  supabase: SupabaseClient,
  bucketName: string,
  filePath: string,
  file: File,
  callbacks: UploadCallbacks
): Promise<ResumableUploadResult> {
  try {
    // Report initial progress
    callbacks.onProgress?.({
      bytesUploaded: 0,
      bytesTotal: file.size,
      percentage: 0,
      speed: 0,
      remainingTime: 0,
    });

    const startTime = Date.now();

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      callbacks.onError?.(new Error(error.message));
      return { success: false, error: error.message };
    }

    const elapsedTime = (Date.now() - startTime) / 1000;
    const speed = file.size / elapsedTime;

    // Report completion
    callbacks.onProgress?.({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percentage: 100,
      speed,
      remainingTime: 0,
    });

    const url = data?.path || filePath;
    callbacks.onSuccess?.(url);
    return { success: true, url };
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Upload failed');
    callbacks.onError?.(error);
    return { success: false, error: error.message };
  }
}

/**
 * Resumable upload using TUS protocol for large files
 */
async function resumableUpload(
  supabase: SupabaseClient,
  bucketName: string,
  filePath: string,
  file: File,
  callbacks: UploadCallbacks
): Promise<ResumableUploadResult> {
  return new Promise(async (resolve) => {
    try {
      // Get the Supabase project URL and key
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      // Get the current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || supabaseKey;

      // Construct the TUS endpoint
      const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

      let lastBytesUploaded = 0;
      let lastTime = Date.now();
      let speedSamples: number[] = [];

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000, 10000], // Retry delays in ms
        chunkSize: 6 * 1024 * 1024, // 6MB chunks (Supabase recommended)
        headers: {
          authorization: `Bearer ${accessToken}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucketName,
          objectName: filePath,
          contentType: file.type || 'video/mp4',
          cacheControl: '3600',
        },

        onError: (error) => {
          console.error('TUS upload error:', error);
          callbacks.onError?.(error);
          resolve({ success: false, error: error.message });
        },

        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const bytesDiff = bytesUploaded - lastBytesUploaded;

          // Calculate speed (bytes per second)
          let speed = 0;
          if (timeDiff > 0) {
            speed = bytesDiff / timeDiff;
            speedSamples.push(speed);
            // Keep only last 5 samples for smoothing
            if (speedSamples.length > 5) {
              speedSamples.shift();
            }
          }

          // Average speed for smoother display
          const avgSpeed = speedSamples.length > 0
            ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
            : 0;

          // Calculate remaining time
          const remainingBytes = bytesTotal - bytesUploaded;
          const remainingTime = avgSpeed > 0 ? remainingBytes / avgSpeed : 0;

          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);

          callbacks.onProgress?.({
            bytesUploaded,
            bytesTotal,
            percentage,
            speed: avgSpeed,
            remainingTime,
          });

          lastBytesUploaded = bytesUploaded;
          lastTime = now;
        },

        onSuccess: () => {
          callbacks.onProgress?.({
            bytesUploaded: file.size,
            bytesTotal: file.size,
            percentage: 100,
            speed: 0,
            remainingTime: 0,
          });

          callbacks.onSuccess?.(filePath);
          resolve({ success: true, url: filePath });
        },
      });

      // Check for previous uploads to resume
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        console.log('Resuming previous upload...');
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      // Start the upload
      upload.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload initialization failed');
      console.error('Upload initialization error:', error);
      callbacks.onError?.(error);
      resolve({ success: false, error: error.message });
    }
  });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format seconds to human readable time
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format speed to human readable string
 */
export function formatSpeed(bytesPerSecond: number): string {
  const bitsPerSecond = bytesPerSecond * 8;
  if (bitsPerSecond < 1000000) {
    return `${(bitsPerSecond / 1000).toFixed(1)} Kbps`;
  } else {
    return `${(bitsPerSecond / 1000000).toFixed(1)} Mbps`;
  }
}
