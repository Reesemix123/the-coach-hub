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
import path from 'path';
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

interface ExtractResult {
  assetId: string;
  clipDurationSeconds: number;
  clipSizeBytes: number;
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

  // Default end time: start + 15 seconds if not set
  const startSec = play.timestamp_start;
  const endSec = play.timestamp_end ?? startSec + 15;
  const clipDuration = endSec - startSec;

  if (clipDuration <= 0) {
    throw new Error(
      `Invalid clip duration: start=${startSec}, end=${endSec}`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Fetch the camera file (video record)
  // -------------------------------------------------------------------------

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id, file_path, game_id')
    .eq('id', play.video_id)
    .single();

  if (videoError || !video) {
    throw new Error(`Video record not found for video_id: ${play.video_id}`);
  }

  if (!video.file_path) {
    throw new Error(`Video ${video.id} has no file_path in Supabase Storage`);
  }

  // -------------------------------------------------------------------------
  // 3. Generate signed Supabase Storage URL
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
  // 4. Update play status → extracting
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({
      mux_clip_status: 'extracting',
      mux_clip_error: null,
    })
    .eq('id', playInstanceId);

  // -------------------------------------------------------------------------
  // 5. Run FFmpeg extraction
  // -------------------------------------------------------------------------

  let clipBuffer: Buffer;

  try {
    clipBuffer = await runFFmpegExtraction(sourceUrl, startSec, endSec);
  } catch (err) {
    // Update status to errored
    await supabase
      .from('play_instances')
      .update({
        mux_clip_status: 'errored',
        mux_clip_error: err instanceof Error ? err.message : 'FFmpeg extraction failed',
      })
      .eq('id', playInstanceId);

    throw err;
  }

  const clipSizeBytes = clipBuffer.length;

  console.log(
    `[clip-extraction] Play ${playInstanceId}: duration=${clipDuration}s, size=${(clipSizeBytes / 1024 / 1024).toFixed(1)}MB`,
  );

  // -------------------------------------------------------------------------
  // 6. Buffer size safety check
  // -------------------------------------------------------------------------

  if (clipSizeBytes > MAX_CLIP_BYTES) {
    const errorMsg = `Clip exceeds safe buffer size: ${(clipSizeBytes / 1024 / 1024).toFixed(1)}MB > ${MAX_CLIP_BYTES / 1024 / 1024}MB limit (duration: ${clipDuration}s)`;
    console.error(`[clip-extraction] ${errorMsg}`);

    await supabase
      .from('play_instances')
      .update({
        mux_clip_status: 'errored',
        mux_clip_error: errorMsg,
      })
      .eq('id', playInstanceId);

    throw new Error(errorMsg);
  }

  // -------------------------------------------------------------------------
  // 7. Upload to Mux
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({ mux_clip_status: 'uploading' })
    .eq('id', playInstanceId);

  let assetId: string;

  try {
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

    assetId = upload.id; // Upload ID — Mux webhook will map this to the asset

  } catch (err) {
    await supabase
      .from('play_instances')
      .update({
        mux_clip_status: 'errored',
        mux_clip_error: err instanceof Error ? err.message : 'Mux upload failed',
      })
      .eq('id', playInstanceId);

    throw err;
  }

  // -------------------------------------------------------------------------
  // 8. Update play record → pending (waiting for Mux encoding)
  // -------------------------------------------------------------------------

  await supabase
    .from('play_instances')
    .update({
      mux_clip_asset_id: assetId,
      mux_clip_status: 'pending',
      mux_clip_error: null,
    })
    .eq('id', playInstanceId);

  return { assetId, clipDurationSeconds: clipDuration, clipSizeBytes };
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
