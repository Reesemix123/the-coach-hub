/**
 * Scoreboard OCR Service
 *
 * Uses Gemini to read scoreboard/down marker information from the designated
 * scoreboard camera at a specific timestamp. Returns structured game state
 * data that can auto-populate play metadata fields.
 *
 * Uses the existing Gemini File Manager for cached uploads — the scoreboard
 * camera video is uploaded once and reused for all OCR reads in the same game.
 *
 * Each field is returned with a confidence score (0-100). The caller applies
 * threshold filtering:
 *   - Score, down, distance: confidence > 70
 *   - Quarter, clock: confidence > 50
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceClient } from '@/utils/supabase/server';
import { getOrUploadVideo } from './gemini-file-manager';
import { getScoreboardCamera } from '@/lib/services/camera-role.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldReading {
  value: number | string;
  confidence: number;
}

export interface ScoreboardReading {
  quarter?: FieldReading;
  clock?: FieldReading;
  homeScore?: FieldReading;
  awayScore?: FieldReading;
  down?: FieldReading;
  distance?: FieldReading;
}

export interface ScoreboardOCRResult {
  success: boolean;
  reading?: ScoreboardReading;
  error?: string;
  latencyMs?: number;
  model?: string;
  cameraUsed?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_ID = 'gemini-2.5-flash';

const SCOREBOARD_PROMPT = `You are reading a football game scoreboard from video footage. This is youth or high school football — the scoreboard may be a physical board, digital display, or field marker.

Analyze the video segment and extract the current game state displayed on the scoreboard or visible markers. Return ONLY a JSON object with these fields:

{
  "quarter": { "value": <number 1-4, or 5 for overtime>, "confidence": <number 0-100> },
  "clock": { "value": "<MM:SS format>", "confidence": <number 0-100> },
  "home_score": { "value": <number>, "confidence": <number 0-100> },
  "away_score": { "value": <number>, "confidence": <number 0-100> },
  "down": { "value": <number 1-4>, "confidence": <number 0-100> },
  "distance": { "value": <number>, "confidence": <number 0-100> }
}

RULES:
- If a field is not visible or unreadable, OMIT it entirely from the response.
- Do NOT guess — only return what you can clearly read.
- Low-quality, distant, or shaky footage is expected. Be conservative with confidence.
- The clock format is always MM:SS (e.g., "7:34", "0:45", "12:00").
- Down is 1-4. Distance is yards to first down.
- Return ONLY the JSON object, no other text.`;

// Buffer seconds around the target timestamp for the video segment
const BUFFER_BEFORE_SECONDS = 3;
const BUFFER_AFTER_SECONDS = 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the scoreboard from the designated scoreboard camera at a specific
 * point in the game.
 *
 * @param gameId - The game to read from
 * @param timestampSeconds - The video timestamp to read (typically the play start time)
 * @returns Structured scoreboard reading with per-field confidence scores
 */
export async function readScoreboard(
  gameId: string,
  timestampSeconds: number,
): Promise<ScoreboardOCRResult> {
  const startTime = Date.now();

  try {
    // 1. Find the scoreboard camera
    const camera = await getScoreboardCamera(gameId);

    if (!camera) {
      return {
        success: false,
        error: 'No cameras found for this game',
        latencyMs: Date.now() - startTime,
      };
    }

    if (!camera.filePath) {
      return {
        success: false,
        error: 'Scoreboard camera has no video file',
        latencyMs: Date.now() - startTime,
      };
    }

    // 2. Generate signed URL for the camera file
    const supabase = createServiceClient();
    const { data: signedUrlData, error: urlError } = await supabase
      .storage
      .from('game_videos')
      .createSignedUrl(camera.filePath, 900); // 15 minutes

    if (urlError || !signedUrlData?.signedUrl) {
      return {
        success: false,
        error: `Failed to access camera file: ${urlError?.message ?? 'unknown'}`,
        latencyMs: Date.now() - startTime,
      };
    }

    // 3. Get or upload video to Gemini (uses cache if available)
    const { fileUri } = await getOrUploadVideo(
      camera.videoId,
      signedUrlData.signedUrl,
      'video/mp4',
    );

    // 4. Calculate the segment window (5-10 seconds around the timestamp)
    // Apply sync offset if the scoreboard camera is offset from the primary
    const adjustedTimestamp = timestampSeconds + camera.syncOffsetSeconds;
    const segmentStart = Math.max(0, adjustedTimestamp - BUFFER_BEFORE_SECONDS);
    const segmentEnd = adjustedTimestamp + BUFFER_AFTER_SECONDS;

    // 5. Call Gemini
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'GOOGLE_AI_API_KEY not configured',
        latencyMs: Date.now() - startTime,
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri,
        },
        // @ts-expect-error - videoMetadata is supported but not in types yet
        videoMetadata: {
          startOffset: { seconds: Math.floor(segmentStart) },
          endOffset: { seconds: Math.ceil(segmentEnd) },
        },
      },
      { text: SCOREBOARD_PROMPT },
    ]);

    const response = result.response;
    const text = response.text();

    // 6. Parse JSON response
    let raw: Record<string, { value: number | string; confidence: number }>;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      raw = JSON.parse(jsonStr);
    } catch {
      return {
        success: false,
        error: `Failed to parse Gemini response: ${text.substring(0, 200)}`,
        latencyMs: Date.now() - startTime,
        model: MODEL_ID,
      };
    }

    // 7. Map to structured reading
    const reading: ScoreboardReading = {};

    if (raw.quarter) reading.quarter = { value: raw.quarter.value, confidence: raw.quarter.confidence };
    if (raw.clock) reading.clock = { value: raw.clock.value, confidence: raw.clock.confidence };
    if (raw.home_score) reading.homeScore = { value: raw.home_score.value, confidence: raw.home_score.confidence };
    if (raw.away_score) reading.awayScore = { value: raw.away_score.value, confidence: raw.away_score.confidence };
    if (raw.down) reading.down = { value: raw.down.value, confidence: raw.down.confidence };
    if (raw.distance) reading.distance = { value: raw.distance.value, confidence: raw.distance.confidence };

    return {
      success: true,
      reading,
      latencyMs: Date.now() - startTime,
      model: MODEL_ID,
      cameraUsed: camera.cameraLabel || `Camera ${camera.cameraOrder}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Scoreboard OCR failed',
      latencyMs: Date.now() - startTime,
      model: MODEL_ID,
    };
  }
}
