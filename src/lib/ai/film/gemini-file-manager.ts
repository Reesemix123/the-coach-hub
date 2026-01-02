// src/lib/ai/film/gemini-file-manager.ts
// Manages video uploads to Gemini File API with caching

import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { createClient } from '@/utils/supabase/server';

// Cache entry from database
interface GeminiCacheEntry {
  id: string;
  video_id: string;
  file_uri: string;
  expires_at: string;
}

/**
 * Get or upload a video to Gemini File API
 * Returns the file_uri for use in generateContent calls
 */
export async function getOrUploadVideo(
  videoId: string,
  videoUrl: string,
  mimeType: string = 'video/mp4'
): Promise<{ fileUri: string; cached: boolean; uploadTimeMs?: number }> {
  const supabase = await createClient();

  // Check cache first
  const { data: cached } = await supabase
    .from('gemini_file_cache')
    .select('file_uri, expires_at')
    .eq('video_id', videoId)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return {
      fileUri: cached.file_uri,
      cached: true,
    };
  }

  // Need to upload - fetch video and upload to Gemini
  const startTime = Date.now();

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable not set');
  }

  const fileManager = new GoogleAIFileManager(apiKey);

  // Fetch video from Supabase Storage
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
  }

  const videoBlob = await videoResponse.blob();
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

  // Upload to Gemini File API
  // Note: For large files, we'd use resumable upload, but for typical game clips
  // the standard upload should work fine
  const uploadResult = await fileManager.uploadFile(videoBuffer, {
    mimeType,
    displayName: `video-${videoId}`,
  });

  // Wait for file to be processed
  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === FileState.PROCESSING) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error('Gemini file processing failed');
  }

  const uploadTimeMs = Date.now() - startTime;
  const fileUri = file.uri;

  // Cache the file_uri (expires in 47 hours, 1 hour buffer before Gemini's 48-hour limit)
  const expiresAt = new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString();

  await supabase.from('gemini_file_cache').upsert({
    video_id: videoId,
    file_uri: fileUri,
    file_name: file.name,
    mime_type: mimeType,
    uploaded_at: new Date().toISOString(),
    expires_at: expiresAt,
    file_size_bytes: videoBuffer.length,
    upload_duration_ms: uploadTimeMs,
  });

  return {
    fileUri,
    cached: false,
    uploadTimeMs,
  };
}

/**
 * Check if a video is already cached in Gemini
 */
export async function isVideoCached(videoId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('gemini_file_cache')
    .select('expires_at')
    .eq('video_id', videoId)
    .single();

  if (!data) return false;

  return new Date(data.expires_at) > new Date();
}

/**
 * Invalidate cache for a video (e.g., if video was re-uploaded)
 */
export async function invalidateVideoCache(videoId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.from('gemini_file_cache').delete().eq('video_id', videoId);
}

/**
 * Clean up expired cache entries
 * This should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredCache(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('cleanup_expired_gemini_cache');

  if (error) {
    console.error('Failed to cleanup expired Gemini cache:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get cache statistics for a team
 */
export async function getCacheStats(teamId: string): Promise<{
  cachedVideos: number;
  totalSizeBytes: number;
  oldestEntry: Date | null;
}> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('gemini_file_cache')
    .select(`
      id,
      file_size_bytes,
      uploaded_at,
      videos!inner(game_id, games!inner(team_id))
    `)
    .eq('videos.games.team_id', teamId);

  if (!data || data.length === 0) {
    return {
      cachedVideos: 0,
      totalSizeBytes: 0,
      oldestEntry: null,
    };
  }

  const totalSize = data.reduce(
    (sum, entry) => sum + (entry.file_size_bytes || 0),
    0
  );
  const oldest = data.reduce((min, entry) => {
    const date = new Date(entry.uploaded_at);
    return !min || date < min ? date : min;
  }, null as Date | null);

  return {
    cachedVideos: data.length,
    totalSizeBytes: totalSize,
    oldestEntry: oldest,
  };
}
