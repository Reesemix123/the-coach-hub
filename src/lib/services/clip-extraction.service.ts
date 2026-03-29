/**
 * Clip Extraction Service
 *
 * Extracts a short clip from a full game film in Supabase Storage using FFmpeg,
 * then uploads it to Mux for parent-facing delivery via signed playback URLs.
 *
 * Core architectural principle: Full game film never goes to Mux. Only short
 * extracted clips (10-30 seconds) are sent to Mux at the moment a coach
 * explicitly shares a specific play with parents.
 *
 * Camera handling: A play tagged on Camera 2 is extracted from Camera 2's file.
 * The play's video_id identifies the correct camera. Timestamps on play_instances
 * are already relative to that video file — no sync offset adjustment is needed
 * for extraction (offsets are only relevant when jumping between cameras in the
 * film room UI, not when reading from the source file).
 *
 * Timeout: This service is designed to run inside a Vercel serverless function
 * with maxDuration: 300. Direct seek (-ss before -i) with stream copy (-c copy)
 * on a 10-30 second clip completes in <30 seconds even for 4-8 GB source files.
 * TODO: Move to a dedicated background worker when user volume grows.
 */

import { spawn } from 'child_process';
import Mux from '@mux/mux-node';
import { createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum clip output size in bytes (200 MB). Fail cleanly if exceeded. */
const MAX_CLIP_BYTES = 200 * 1024 * 1024;

/** How long the Supabase Storage signed URL is valid (seconds). */
const STORAGE_URL_EXPIRY_SECONDS = 900; // 15 minutes

// ---------------------------------------------------------------------------
// Mux client (reuse pattern from video.service.ts)
// ---------------------------------------------------------------------------

let muxClient: Mux | null = null;

function getMuxClient(): Mux {
  if (!muxClient) {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!tokenId || !tokenSecret) {
      throw new Error(
        'Mux credentials not configured (MUX_TOKEN_ID, MUX_TOKEN_SECRET)',
      );
    }

    muxClient = new Mux({ tokenId, tokenSecret });
  }
  return muxClient;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractResult {
  assetId: string;
  clipDurationSeconds: number;
  clipSizeBytes: number;
}

/**
 * Internal result type returned by `_extractAndUploadToMux`.
 * Callers are responsible for persisting these values to the appropriate table.
 */
interface _ExtractUploadResult {
  /** The Mux upload ID (maps to asset later via webhook). */
  uploadId: string;
  /** Same as uploadId initially — webhook maps to real asset. */
  assetId: string;
  clipDurationSeconds: number;
  clipSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Private core: FFmpeg extraction + Mux upload
// ---------------------------------------------------------------------------

/**
 * Fetches the video record, generates a signed Storage URL, runs FFmpeg to
 * extract the clip, checks the output buffer size, and uploads the result to
 * Mux with a signed playback policy.
 *
 * This function does NOT read or write any database tables other than the
 * `videos` table (read-only). All status tracking is the caller's responsibility.
 *
 * @param playInstanceId  - Used only for log messages
 * @param videoId         - The `video_id` from the play/clip record
 * @param timestampStart  - Clip start position in seconds (relative to video file)
 * @param timestampEnd    - Clip end position in seconds, or null (defaults to start + 15s)
 * @returns Upload ID, asset ID, clip duration, and clip size
 */
async function _extractAndUploadToMux(
  playInstanceId: string,
  videoId: string,
  timestampStart: number,
  timestampEnd: number | null,
): Promise<_ExtractUploadResult> {
  const supabase = createServiceClient();

  // -------------------------------------------------------------------------
  // 1. Fetch the camera file (video record)
  // -------------------------------------------------------------------------

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id, file_path, game_id')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {
    throw new Error(`Video record not found for video_id: ${videoId}`);
  }

  if (!video.file_path) {
    throw new Error(`Video ${video.id} has no file_path in Supabase Storage`);
  }

  // -------------------------------------------------------------------------
  // 2. Generate signed Supabase Storage URL
  // -------------------------------------------------------------------------

  const { data: signedUrlData, error: urlError } = await supabase
    .storage
    .from('game_videos')
    .createSignedUrl(video.file_path, STORAGE_URL_EXPIRY_SECONDS);

  if (urlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Failed to generate signed URL for ${video.file_path}: ${urlError?.message ?? 'unknown'}`,
    );
  }

  const sourceUrl = signedUrlData.signedUrl;

  // -------------------------------------------------------------------------
  // 3. Compute clip bounds
  // -------------------------------------------------------------------------

  const startSec = timestampStart;
  const endSec = timestampEnd ?? startSec + 15;
  const clipDuration = endSec - startSec;

  // -------------------------------------------------------------------------
  // 4. Run FFmpeg extraction
  // -------------------------------------------------------------------------

  const clipBuffer = await runFFmpegExtraction(sourceUrl, startSec, endSec);
  const clipSizeBytes = clipBuffer.length;

  console.log(
    `[clip-extraction] Play ${playInstanceId}: duration=${clipDuration}s, size=${(clipSizeBytes / 1024 / 1024).toFixed(1)}MB`,
  );

  // -------------------------------------------------------------------------
  // 5. Buffer size safety check
  // -------------------------------------------------------------------------

  if (clipSizeBytes > MAX_CLIP_BYTES) {
    const errorMsg = `Clip exceeds safe buffer size: ${(clipSizeBytes / 1024 / 1024).toFixed(1)}MB > ${MAX_CLIP_BYTES / 1024 / 1024}MB limit (duration: ${clipDuration}s)`;
    console.error(`[clip-extraction] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // -------------------------------------------------------------------------
  // 6. Upload to Mux
  // -------------------------------------------------------------------------

  const mux = getMuxClient();

  // Create a Mux upload URL, then PUT the clip buffer to it
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || '*',
    new_asset_settings: {
      playback_policy: ['signed'],
      encoding_tier: 'baseline',
    },
    timeout: 300,
  });

  // Upload the clip buffer directly to the Mux upload URL
  const uploadResponse = await fetch(upload.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: new Uint8Array(clipBuffer),
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Mux upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
    );
  }

  const uploadId = upload.id; // Upload ID — Mux webhook will map this to the asset

  return {
    uploadId,
    assetId: uploadId,
    clipDurationSeconds: clipDuration,
    clipSizeBytes,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a clip from a game film and upload it to Mux.
 *
 * 1. Reads the play's timestamps and camera file from the database
 * 2. Generates a short-lived signed URL for the camera file
 * 3. Runs FFmpeg with direct seek + stream copy (fast, no re-encoding)
 * 4. Uploads the extracted buffer to Mux with signed playback policy
 * 5. Updates the play record with the Mux asset ID
 *
 * @param playInstanceId - The play to extract a clip for
 * @returns The Mux asset ID and clip metadata
 * @throws If the play is not found, timestamps are missing, or extraction fails
 */
export async function extractAndUploadClip(
  playInstanceId: string,
): Promise<ExtractResult> {
  const supabase = createServiceClient();

  // -------------------------------------------------------------------------
  // 1. Fetch play instance
  // -------------------------------------------------------------------------

  const { data: play, error: playError } = await supabase
    .from('play_instances')
    .select('id, video_id, timestamp_start, timestamp_end, team_id')
    .eq('id', playInstanceId)
    .single();

  if (playError || !play) {
    throw new Error(`Play instance not found: ${playInstanceId}`);
  }

  if (play.timestamp_start == null) {
    throw new Error(`Play ${playInstanceId} has no timestamp_start`);
  }

  // Validate clip bounds before kicking off extraction
  const startSec = play.timestamp_start;
  const endSec = play.timestamp_end ?? startSec + 15;
  const clipDuration = endSec - startSec;

  if (clipDuration <= 0) {
    throw new Error(
      `Invalid clip duration: start=${startSec}, end=${endSec}`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Update play status → extracting
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({
      mux_clip_status: 'extracting',
      mux_clip_error: null,
    })
    .eq('id', playInstanceId);

  // -------------------------------------------------------------------------
  // 3. Run FFmpeg extraction + Mux upload
  // -------------------------------------------------------------------------

  let result: _ExtractUploadResult;

  try {
    result = await _extractAndUploadToMux(
      playInstanceId,
      play.video_id,
      play.timestamp_start,
      play.timestamp_end,
    );
  } catch (err) {
    await supabase
      .from('play_instances')
      .update({
        mux_clip_status: 'errored',
        mux_clip_error: err instanceof Error ? err.message : 'Extraction failed',
      })
      .eq('id', playInstanceId);

    throw err;
  }

  // -------------------------------------------------------------------------
  // 4. Update play status → uploading (between extraction and Mux confirmation)
  //    Note: _extractAndUploadToMux completes both steps atomically, so this
  //    transition is a post-hoc intermediate state written before the final
  //    pending update — preserved for parity with the original implementation.
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({ mux_clip_status: 'uploading' })
    .eq('id', playInstanceId);

  // -------------------------------------------------------------------------
  // 5. Update play record → pending (waiting for Mux encoding)
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({
      mux_clip_asset_id: result.assetId,
      mux_clip_status: 'pending',
      mux_clip_error: null,
    })
    .eq('id', playInstanceId);

  return {
    assetId: result.assetId,
    clipDurationSeconds: result.clipDurationSeconds,
    clipSizeBytes: result.clipSizeBytes,
  };
}

/**
 * Extract a clip for a player profile and upload it to Mux.
 *
 * Uses the timestamps from the associated play instance but writes status
 * and asset IDs to the `player_clips` table rather than `play_instances`.
 *
 * @param playerClipId   - The player_clips row to update
 * @param playInstanceId - The play instance to read timestamps from
 * @returns The Mux asset ID and clip metadata
 * @throws If the play instance is not found, timestamps are missing, or extraction fails
 */
export async function extractAndUploadPlayerClip(
  playerClipId: string,
  playInstanceId: string,
): Promise<ExtractResult> {
  const supabase = createServiceClient();

  // -------------------------------------------------------------------------
  // 1. Fetch play instance for timestamps and video reference
  // -------------------------------------------------------------------------

  const { data: play, error: playError } = await supabase
    .from('play_instances')
    .select('id, video_id, timestamp_start, timestamp_end')
    .eq('id', playInstanceId)
    .single();

  if (playError || !play) {
    throw new Error(`Play instance not found: ${playInstanceId}`);
  }

  if (play.timestamp_start == null) {
    throw new Error(`Play ${playInstanceId} has no timestamp_start`);
  }

  // -------------------------------------------------------------------------
  // 2. Update player clip status → extracting
  // -------------------------------------------------------------------------

  await supabase
    .from('player_clips')
    .update({ mux_clip_status: 'extracting' })
    .eq('id', playerClipId);

  // -------------------------------------------------------------------------
  // 3. Run FFmpeg extraction + Mux upload
  // -------------------------------------------------------------------------

  let result: _ExtractUploadResult;

  try {
    result = await _extractAndUploadToMux(
      playInstanceId,
      play.video_id,
      play.timestamp_start,
      play.timestamp_end,
    );
  } catch (err) {
    await supabase
      .from('player_clips')
      .update({
        mux_clip_status: 'errored',
        mux_clip_error: err instanceof Error ? err.message : 'Extraction failed',
      })
      .eq('id', playerClipId);

    throw err;
  }

  // -------------------------------------------------------------------------
  // 4. Update player clip record → pending (waiting for Mux encoding)
  // -------------------------------------------------------------------------

  await supabase
    .from('player_clips')
    .update({
      mux_upload_id: result.uploadId,
      mux_asset_id: result.assetId,
      mux_clip_status: 'pending',
    })
    .eq('id', playerClipId);

  return {
    assetId: result.assetId,
    clipDurationSeconds: result.clipDurationSeconds,
    clipSizeBytes: result.clipSizeBytes,
  };
}

// ---------------------------------------------------------------------------
// FFmpeg Extraction (Private)
// ---------------------------------------------------------------------------

/**
 * Runs FFmpeg to extract a clip segment from a video URL.
 *
 * Uses direct seek (-ss before -i) so FFmpeg skips directly to the start
 * position without reading the entire file. Uses stream copy (-c copy) to
 * avoid re-encoding — fast and preserves original quality.
 *
 * Output is collected via pipe (stdout) to avoid temp files on disk.
 *
 * @param sourceUrl - Signed URL to the full game film
 * @param startSec - Start position in seconds
 * @param endSec   - End position in seconds
 * @returns Buffer containing the extracted MP4 clip
 */
function runFFmpegExtraction(
  sourceUrl: string,
  startSec: number,
  endSec: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Resolve FFmpeg binary path from the installed package
    let ffmpegPath: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const installer = require('@ffmpeg-installer/ffmpeg');
      ffmpegPath = installer.path;
    } catch {
      // Fallback: assume ffmpeg is on PATH (works in many environments)
      ffmpegPath = 'ffmpeg';
    }

    const duration = endSec - startSec;

    const args = [
      '-ss', startSec.toString(),   // Seek to start BEFORE opening input (fast)
      '-t', duration.toString(),     // Duration of clip
      '-i', sourceUrl,               // Input: signed Supabase Storage URL
      '-c', 'copy',                  // Stream copy — no re-encoding
      '-movflags', 'frag_keyframe+empty_moov', // Fragmented MP4 for piped output
      '-f', 'mp4',                   // Output format
      '-loglevel', 'error',          // Suppress verbose output
      'pipe:1',                      // Output to stdout
    ];

    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let stderrOutput = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;

      // Safety valve: stop collecting if we're way over the limit
      if (totalBytes > MAX_CLIP_BYTES * 1.5) {
        proc.kill('SIGTERM');
        reject(
          new Error(
            `FFmpeg output exceeded safety limit during extraction: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
          ),
        );
        return;
      }

      chunks.push(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `FFmpeg exited with code ${code}: ${stderrOutput.slice(0, 500)}`,
          ),
        );
        return;
      }

      if (chunks.length === 0) {
        reject(new Error('FFmpeg produced no output'));
        return;
      }

      resolve(Buffer.concat(chunks));
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}
