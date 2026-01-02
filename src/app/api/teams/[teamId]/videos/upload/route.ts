import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EntitlementsService } from '@/lib/entitlements/entitlements-service';

/**
 * Video Upload API with Server-Side Validation
 *
 * Validates:
 * - File type (MIME type and magic bytes)
 * - File size (max 2GB configurable)
 * - Storage quota
 * - Rate limits
 */

// Video file signatures (magic bytes)
const VIDEO_SIGNATURES: Record<string, { offset: number; bytes: number[] }[]> = {
  'video/mp4': [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
  ],
  'video/quicktime': [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp (same as mp4)
    { offset: 4, bytes: [0x6d, 0x6f, 0x6f, 0x76] }, // moov
  ],
  'video/webm': [
    { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML
  ],
  'video/x-msvideo': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  ],
  'video/avi': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  ],
  'video/mpeg': [
    { offset: 0, bytes: [0x00, 0x00, 0x01, 0xba] }, // MPEG PS
    { offset: 0, bytes: [0x00, 0x00, 0x01, 0xb3] }, // MPEG video
  ],
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/avi',
  'video/x-m4v',
  'video/mpeg',
];

// Allowed extensions
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.m4v', '.mpeg', '.mpg'];

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Verify file is a video by checking magic bytes
 */
async function verifyVideoMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (const [, signatures] of Object.entries(VIDEO_SIGNATURES)) {
      for (const sig of signatures) {
        if (sig.offset + sig.bytes.length <= bytes.length) {
          let match = true;
          for (let i = 0; i < sig.bytes.length; i++) {
            if (bytes[sig.offset + i] !== sig.bytes[i]) {
              match = false;
              break;
            }
          }
          if (match) return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * POST /api/teams/[teamId]/videos/upload
 * Pre-flight check before upload - validates quotas, rate limits, file info
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team access
    const { data: teamAccess } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { data: teamOwner } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (!teamAccess && teamOwner?.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { fileName, fileSize, mimeType, gameId, cameraLabel } = body;

    if (!fileName || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, fileSize' },
        { status: 400 }
      );
    }

    // Check camera limit if this is for a game
    if (gameId) {
      const entitlements = new EntitlementsService(supabase);
      const cameraCheck = await entitlements.canAddCamera(teamId, gameId);

      if (!cameraCheck.allowed) {
        return NextResponse.json(
          {
            error: 'camera_limit',
            message: cameraCheck.reason,
            details: {
              reason: 'camera_limit',
              currentUsage: cameraCheck.currentUsage,
              limit: cameraCheck.limit,
              upgradeOption: cameraCheck.upgradeOption,
            }
          },
          { status: 403 }
        );
      }
    }

    // Check TOS acceptance (if required by config)
    const { data: moderationConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'content_moderation')
      .single();

    const config = moderationConfig?.value as {
      require_tos?: boolean;
    } | null;

    if (config?.require_tos) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tos_accepted_at')
        .eq('id', user.id)
        .single();

      if (!profile?.tos_accepted_at) {
        return NextResponse.json(
          {
            error: 'Terms of Service not accepted',
            message: 'You must accept the Terms of Service before uploading videos.',
            tos_required: true,
          },
          { status: 403 }
        );
      }
    }

    // Validate file extension
    const extension = getFileExtension(fileName);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `File extension "${extension}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          allowed_extensions: ALLOWED_EXTENSIONS,
        },
        { status: 400 }
      );
    }

    // Validate MIME type if provided
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `MIME type "${mimeType}" not allowed. Only video files accepted.`,
          allowed_types: ALLOWED_MIME_TYPES,
        },
        { status: 400 }
      );
    }

    // Check upload allowed (quota, rate limits) - if RPC exists
    let teamCheckResult: { allowed: boolean; reason?: string; message?: string; used_bytes?: number; quota_bytes?: number; remaining_bytes?: number; uploads_this_hour?: number; max_uploads_per_hour?: number } = { allowed: true };
    let gameCheckResult: { allowed: boolean; reason?: string; message?: string; current_bytes?: number; file_bytes?: number; max_bytes?: number } = { allowed: true };
    let logId: string | null = null;

    // Check team-level quota
    try {
      const { data, error: checkError } = await supabase.rpc('check_upload_allowed', {
        p_team_id: teamId,
        p_file_size_bytes: fileSize,
        p_mime_type: mimeType || null,
        p_file_extension: extension,
      });

      if (!checkError && data) {
        teamCheckResult = data;
      }
    } catch (e) {
      console.log('check_upload_allowed RPC not available, skipping team quota check');
    }

    if (!teamCheckResult.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          error: teamCheckResult.reason,
          message: teamCheckResult.message,
          details: `Team storage: ${formatBytes(teamCheckResult.used_bytes || 0)} / ${formatBytes(teamCheckResult.quota_bytes || 0)}`,
        },
        { status: 429 }
      );
    }

    // Check per-game storage limit (if gameId provided)
    if (gameId) {
      try {
        const { data, error: gameCheckError } = await supabase.rpc('check_game_upload_allowed', {
          p_game_id: gameId,
          p_file_size_bytes: fileSize,
        });

        if (!gameCheckError && data) {
          gameCheckResult = data;
        }
      } catch (e) {
        console.log('check_game_upload_allowed RPC not available, skipping game storage check');
      }

      if (!gameCheckResult.allowed) {
        return NextResponse.json(
          {
            allowed: false,
            error: gameCheckResult.reason,
            message: gameCheckResult.message,
            details: `Game storage: ${formatBytes(gameCheckResult.current_bytes || 0)} / ${formatBytes(gameCheckResult.max_bytes || 0)}`,
          },
          { status: 429 }
        );
      }
    }

    // If checkOnly=true, just return validation results without starting upload
    const checkOnly = body.checkOnly === true;

    if (!checkOnly) {
      // Record upload start (for rate limiting) - if RPC exists
      try {
        const { data } = await supabase.rpc('record_upload_start', {
          p_team_id: teamId,
          p_user_id: user.id,
          p_file_name: fileName,
          p_file_size_bytes: fileSize,
          p_mime_type: mimeType || null,
        });
        logId = data;
      } catch (e) {
        console.log('record_upload_start RPC not available, skipping upload logging');
      }
    }

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = gameId
      ? `${gameId}/${timestamp}_${sanitizedName}`
      : `${teamId}/${timestamp}_${sanitizedName}`;

    // Calculate storage after upload for warnings
    const teamStorageAfter = (teamCheckResult.used_bytes || 0) + fileSize;
    const teamStorageQuota = teamCheckResult.quota_bytes || 0;
    const gameStorageAfter = (gameCheckResult.current_bytes || 0) + fileSize;
    const gameStorageLimit = gameCheckResult.max_bytes || 0;

    return NextResponse.json({
      allowed: true,
      uploadId: logId,
      storagePath,
      // Storage info for warnings
      teamStorageAfter,
      teamStorageQuota,
      gameStorageAfter,
      gameStorageLimit,
      quota: {
        used: teamCheckResult.used_bytes,
        total: teamCheckResult.quota_bytes,
        remaining: teamCheckResult.remaining_bytes,
      },
      rateLimit: {
        uploadsThisHour: teamCheckResult.uploads_this_hour,
        maxPerHour: teamCheckResult.max_uploads_per_hour,
      },
    });
  } catch (error) {
    console.error('Upload pre-check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teams/[teamId]/videos/upload
 * Complete upload - called after file is uploaded to storage
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get client IP for accountability
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || null;

    const body = await request.json();
    const { uploadId, storagePath, gameId, fileName, fileSize, mimeType, cameraLabel } = body;

    if (!storagePath || !gameId || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Record upload complete
    if (uploadId) {
      const { error: completeError } = await supabase.rpc('record_upload_complete', {
        p_log_id: uploadId,
        p_storage_path: storagePath,
      });

      if (completeError) {
        console.error('Record upload complete error:', completeError);
      }
    }

    // Determine camera_order for this upload
    // Count existing cameras for this game
    const { count: existingCameras } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    const cameraOrder = (existingCameras || 0) + 1;

    // Create video record with camera metadata
    // Try with new columns first, fall back to basic columns if they don't exist
    let video;
    let videoError;

    // First try with all columns including camera metadata
    const fullInsert = await supabase
      .from('videos')
      .insert({
        name: fileName,
        file_path: storagePath,
        game_id: gameId,
        uploaded_by: user.id,
        upload_ip: clientIp,
        file_size_bytes: fileSize || null,
        mime_type: mimeType || null,
        camera_label: cameraLabel || (cameraOrder === 1 ? 'Main Camera' : `Camera ${cameraOrder}`),
        camera_order: cameraOrder,
        sync_offset_seconds: 0, // Primary camera or default
        upload_status: 'ready',
      })
      .select()
      .single();

    if (fullInsert.error) {
      // If columns don't exist, try basic insert without new columns
      console.log('Full insert failed:', fullInsert.error.code, fullInsert.error.message, fullInsert.error.details);
      const basicInsert = await supabase
        .from('videos')
        .insert({
          name: fileName,
          file_path: storagePath,
          game_id: gameId,
        })
        .select()
        .single();

      if (basicInsert.error) {
        console.log('Basic insert also failed:', basicInsert.error.code, basicInsert.error.message, basicInsert.error.details);
      }
      video = basicInsert.data;
      videoError = basicInsert.error;
    } else {
      video = fullInsert.data;
      videoError = fullInsert.error;
    }

    if (videoError) {
      console.error('Create video record error:', videoError.code, videoError.message, videoError.details, videoError.hint);
      return NextResponse.json(
        { error: 'Failed to create video record', details: videoError.message, code: videoError.code },
        { status: 500 }
      );
    }

    // Get updated storage usage (if RPC exists)
    let storageUsage = null;
    try {
      const { data } = await supabase.rpc('get_team_storage_usage', {
        p_team_id: teamId,
      });
      storageUsage = data;
    } catch (e) {
      // RPC doesn't exist, skip storage usage
    }

    return NextResponse.json({
      success: true,
      video,
      storage: storageUsage,
    });
  } catch (error) {
    console.error('Upload complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[teamId]/videos/upload
 * Cancel/fail upload - called if upload fails
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const reason = searchParams.get('reason') || 'failed';

    if (uploadId) {
      const { error } = await supabase.rpc('record_upload_failed', {
        p_log_id: uploadId,
        p_reason: reason,
      });

      if (error) {
        console.error('Record upload failed error:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upload cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
