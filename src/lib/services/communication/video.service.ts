/**
 * Video Sharing Service
 * Handles Mux integration, video sharing, and playback for the Communication Hub.
 */

import Mux from '@mux/mux-node';
import { createClient } from '@/utils/supabase/server';
import type {
  SharedVideo,
  VideoShareTarget,
  VideoShareType,
  NotificationChannel,
  MuxAssetStatus,
} from '@/types/communication';

// Suppress unused-import warning — VideoShareTarget is part of the public API surface
// exported from this module for consumers that need the type.
export type { VideoShareTarget };

// ============================================================================
// Mux Client (Lazy Initialization)
// ============================================================================

let muxClient: Mux | null = null;

/**
 * Returns a lazily-initialized Mux client.
 * Signing key credentials are embedded so mux.jwt can sign tokens directly.
 * Throws if required environment variables are missing.
 */
function getMuxClient(): Mux {
  if (!muxClient) {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!tokenId || !tokenSecret) {
      throw new Error('Mux credentials not configured (MUX_TOKEN_ID, MUX_TOKEN_SECRET)');
    }

    muxClient = new Mux({
      tokenId,
      tokenSecret,
      // jwtSigningKey / jwtPrivateKey are read automatically from
      // MUX_SIGNING_KEY / MUX_PRIVATE_KEY env vars by the SDK.
      // We do NOT pass them here so that getSignedPlaybackUrl can validate
      // their presence explicitly and surface a clear error message.
    });
  }
  return muxClient;
}

// ============================================================================
// Types
// ============================================================================

export interface CreateUploadInput {
  teamId: string;
  coachId: string;
  title: string;
  description?: string;
  coachNotes?: string;
  shareType: VideoShareType;
  notificationChannel: NotificationChannel;
  sourceFilmId?: string;
  sourceTagId?: string;
}

export interface CreateUploadResult {
  uploadUrl: string;
  uploadId: string;
  sharedVideoId: string;
}

export interface PublishVideoInput {
  videoId: string;
  coachId: string;
  confirmationText: string;
}

export interface ShareWithPlayerInput {
  videoId: string;
  playerId: string;
  teamId: string;
}

/**
 * Remaining video credits for a team, returned in camelCase for TypeScript consumers.
 * The underlying DB function returns snake_case columns; this interface normalizes them.
 */
export interface VideoCredits {
  baseRemaining: number;
  topupRemaining: number;
  totalRemaining: number;
}

// ============================================================================
// Upload & Asset Management
// ============================================================================

/**
 * Create a Mux direct upload URL and a shared_videos record.
 * The coach uploads directly to Mux via the returned URL.
 * Mux webhooks will update asset status when encoding completes.
 *
 * @param input - Upload parameters including team, coach, and share metadata
 * @returns Upload URL, upload ID, and the new shared_videos row ID
 */
export async function createVideoUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
  const mux = getMuxClient();
  const supabase = await createClient();

  // Create a Mux direct upload. The asset is created by Mux once the upload completes.
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || '*',
    new_asset_settings: {
      playback_policy: ['signed'],
      encoding_tier: 'baseline',
    },
  });

  // Store a placeholder record. The webhook handler will update mux_asset_id
  // and mux_playback_id once Mux fires the video.asset.ready event.
  const { data: sharedVideo, error } = await supabase
    .from('shared_videos')
    .insert({
      team_id: input.teamId,
      coach_id: input.coachId,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      coach_notes: input.coachNotes?.trim() ?? null,
      mux_asset_id: upload.id, // Temporary: upload ID until webhook provides asset ID
      mux_playback_id: '',      // Will be set by the Mux webhook handler
      mux_asset_status: 'preparing' satisfies MuxAssetStatus,
      share_type: input.shareType,
      notification_channel: input.notificationChannel,
      source_film_id: input.sourceFilmId ?? null,
      source_tag_id: input.sourceTagId ?? null,
      publish_confirmed: false,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create shared video record: ${error.message}`);
  }

  return {
    uploadUrl: upload.url!,
    uploadId: upload.id,
    sharedVideoId: sharedVideo.id,
  };
}

/**
 * Create a Mux asset from an existing URL (e.g., sourced from game film storage).
 * Use this when the video content already exists and does not need a direct upload flow.
 *
 * @param url - Publicly accessible URL of the source video
 * @param input - Metadata for the shared_videos record
 * @returns The new shared_videos row ID
 */
export async function createAssetFromUrl(
  url: string,
  input: CreateUploadInput,
): Promise<string> {
  const mux = getMuxClient();
  const supabase = await createClient();

  const asset = await mux.video.assets.create({
    input: [{ url }],
    playback_policy: ['signed'],
    encoding_tier: 'baseline',
  } as any);

  const playbackId = asset.playback_ids?.[0]?.id ?? '';

  const { data: sharedVideo, error } = await supabase
    .from('shared_videos')
    .insert({
      team_id: input.teamId,
      coach_id: input.coachId,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      coach_notes: input.coachNotes?.trim() ?? null,
      mux_asset_id: asset.id!,
      mux_playback_id: playbackId,
      mux_asset_status: (asset.status === 'ready' ? 'ready' : 'preparing') satisfies MuxAssetStatus,
      duration_seconds: asset.duration ? Math.round(asset.duration) : null,
      share_type: input.shareType,
      notification_channel: input.notificationChannel,
      source_film_id: input.sourceFilmId ?? null,
      source_tag_id: input.sourceTagId ?? null,
      publish_confirmed: false,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create shared video record: ${error.message}`);
  }

  return sharedVideo.id;
}

/**
 * Update a shared_videos record when a Mux webhook reports an asset status change.
 * Called exclusively by the Mux webhook handler — do not call from UI code.
 *
 * @param muxAssetId - The Mux asset ID from the webhook payload
 * @param status - The new asset status
 * @param playbackId - Mux playback ID (provided when status becomes 'ready')
 * @param duration - Asset duration in seconds (provided when status becomes 'ready')
 */
export async function updateAssetStatus(
  muxAssetId: string,
  status: MuxAssetStatus,
  playbackId?: string,
  duration?: number,
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { mux_asset_status: status };

  if (playbackId) {
    updates.mux_playback_id = playbackId;
  }

  if (duration !== undefined) {
    updates.duration_seconds = Math.round(duration);
  }

  const { error } = await supabase
    .from('shared_videos')
    .update(updates)
    .eq('mux_asset_id', muxAssetId);

  if (error) {
    console.error(`Failed to update asset status for ${muxAssetId}:`, error);
  }
}

/**
 * Retrieve raw Mux asset details from the Mux API.
 *
 * @param assetId - The Mux asset ID
 */
export async function getMuxAsset(assetId: string) {
  const mux = getMuxClient();
  return mux.video.assets.retrieve(assetId);
}

/**
 * Delete a Mux asset. Errors are logged but not re-thrown so that
 * partial failures (e.g., asset already deleted) do not block record cleanup.
 *
 * @param assetId - The Mux asset ID to delete
 */
export async function deleteMuxAsset(assetId: string): Promise<void> {
  const mux = getMuxClient();
  try {
    await mux.video.assets.delete(assetId);
  } catch (err) {
    console.error(`Failed to delete Mux asset ${assetId}:`, err);
  }
}

// ============================================================================
// Signed Playback URLs
// ============================================================================

/**
 * Generate a signed HLS playback URL for a Mux video.
 * All parent-facing videos MUST use signed URLs — never expose unsigned playback IDs.
 *
 * Requires MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE environment variables.
 * MUX_SIGNING_KEY_PRIVATE must be the base64-encoded RSA private key from the Mux dashboard.
 *
 * @param playbackId - The Mux playback ID
 * @param expirationHours - Token lifetime in hours (default: 24)
 * @returns Signed HLS stream URL
 */
export async function getSignedPlaybackUrl(
  playbackId: string,
  expirationHours: number = 24,
): Promise<string> {
  const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
  const signingKeyPrivate = process.env.MUX_SIGNING_KEY_PRIVATE;

  if (!signingKeyId || !signingKeyPrivate) {
    throw new Error(
      'Mux signing keys not configured (MUX_SIGNING_KEY_ID, MUX_SIGNING_KEY_PRIVATE)',
    );
  }

  const mux = getMuxClient();

  // The SDK accepts the base64-encoded private key directly via keySecret.
  const token = await mux.jwt.signPlaybackId(playbackId, {
    keyId: signingKeyId,
    keySecret: signingKeyPrivate,
    expiration: `${expirationHours}h`,
    type: 'video',
  });

  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}

/**
 * Generate a signed thumbnail URL for a Mux video.
 *
 * @param playbackId - The Mux playback ID
 * @param options - Optional time offset, width, and height overrides
 * @returns Signed thumbnail URL
 */
export async function getSignedThumbnailUrl(
  playbackId: string,
  options: { time?: number; width?: number; height?: number } = {},
): Promise<string> {
  const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
  const signingKeyPrivate = process.env.MUX_SIGNING_KEY_PRIVATE;

  if (!signingKeyId || !signingKeyPrivate) {
    throw new Error('Mux signing keys not configured (MUX_SIGNING_KEY_ID, MUX_SIGNING_KEY_PRIVATE)');
  }

  const mux = getMuxClient();

  const token = await mux.jwt.signPlaybackId(playbackId, {
    keyId: signingKeyId,
    keySecret: signingKeyPrivate,
    expiration: '24h',
    type: 'thumbnail',
  });

  const params = new URLSearchParams({ token });
  if (options.time !== undefined) params.set('time', options.time.toString());
  if (options.width) params.set('width', options.width.toString());
  if (options.height) params.set('height', options.height.toString());

  return `https://image.mux.com/${playbackId}/thumbnail.jpg?${params.toString()}`;
}

// ============================================================================
// Video Sharing (Team & Individual)
// ============================================================================

/**
 * Publish a video after coach confirmation.
 * For team videos, consumes one video credit (FIFO via DB function).
 * Creates an audit record in video_publish_confirmations before marking the video live.
 *
 * @param input - Video ID, coach ID, and the coach's typed confirmation text
 * @throws If the video is not found, already published, or no credits remain
 */
export async function publishVideo(input: PublishVideoInput): Promise<void> {
  const supabase = await createClient();

  const { data: video, error: fetchError } = await supabase
    .from('shared_videos')
    .select('id, team_id, share_type, publish_confirmed')
    .eq('id', input.videoId)
    .single();

  if (fetchError || !video) {
    throw new Error('Video not found');
  }

  if (video.publish_confirmed) {
    throw new Error('Video is already published');
  }

  // Team videos require a credit. Individual shares do not consume credits.
  if (video.share_type === 'team') {
    const { data: creditConsumed, error: creditError } = await supabase
      .rpc('consume_video_credit', { p_team_id: video.team_id });

    if (creditError) {
      throw new Error(`Failed to consume video credit: ${creditError.message}`);
    }

    if (!creditConsumed) {
      throw new Error(
        'No video credits remaining. Purchase a top-up pack to continue sharing.',
      );
    }
  }

  // Audit record — must succeed before marking the video published.
  const { error: confirmError } = await supabase
    .from('video_publish_confirmations')
    .insert({
      video_id: input.videoId,
      coach_id: input.coachId,
      confirmation_text: input.confirmationText,
    });

  if (confirmError) {
    throw new Error(`Failed to create confirmation record: ${confirmError.message}`);
  }

  const { error: updateError } = await supabase
    .from('shared_videos')
    .update({
      publish_confirmed: true,
      publish_confirmed_at: new Date().toISOString(),
    })
    .eq('id', input.videoId);

  if (updateError) {
    throw new Error(`Failed to publish video: ${updateError.message}`);
  }
}

/**
 * Share an individual video with all parents linked to a specific player.
 * Creates video_share_targets rows (upserted to avoid duplicates).
 *
 * @param input - Video ID, player ID, and team ID for scoping the parent lookup
 * @returns Number of parents the video was shared with
 */
export async function shareWithPlayer(input: ShareWithPlayerInput): Promise<number> {
  const supabase = await createClient();

  const { data: parentLinks, error: linksError } = await supabase
    .from('player_parent_links')
    .select(`
      parent_id,
      players!inner (team_id)
    `)
    .eq('player_id', input.playerId)
    .eq('players.team_id', input.teamId);

  if (linksError) {
    throw new Error(`Failed to fetch player parents: ${linksError.message}`);
  }

  if (!parentLinks || parentLinks.length === 0) {
    return 0;
  }

  const targets = parentLinks.map(link => ({
    video_id: input.videoId,
    player_id: input.playerId,
    parent_id: link.parent_id,
  }));

  const { error: insertError } = await supabase
    .from('video_share_targets')
    .upsert(targets, { onConflict: 'video_id,parent_id', ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Failed to create share targets: ${insertError.message}`);
  }

  return targets.length;
}

/**
 * Share a team video with all active parents on the team.
 * Creates video_share_targets rows for every active team_parent_access entry.
 *
 * @param videoId - The shared_videos row ID
 * @param teamId - The team to broadcast to
 * @returns Number of parents the video was shared with
 */
export async function shareWithTeam(videoId: string, teamId: string): Promise<number> {
  const supabase = await createClient();

  const { data: parentAccess, error: accessError } = await supabase
    .from('team_parent_access')
    .select('parent_id')
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (accessError) {
    throw new Error(`Failed to fetch team parents: ${accessError.message}`);
  }

  if (!parentAccess || parentAccess.length === 0) {
    return 0;
  }

  const targets = parentAccess.map(record => ({
    video_id: videoId,
    parent_id: record.parent_id,
  }));

  const { error: insertError } = await supabase
    .from('video_share_targets')
    .upsert(targets, { onConflict: 'video_id,parent_id', ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Failed to create share targets: ${insertError.message}`);
  }

  return targets.length;
}

// ============================================================================
// Video Credit Management
// ============================================================================

/**
 * Check whether a team has at least one video credit available.
 * Returns false on DB errors to prevent accidental gating.
 *
 * @param teamId - The team to check
 */
export async function canShareTeamVideo(teamId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('can_share_team_video', { p_team_id: teamId });

  if (error) {
    console.error('Failed to check video credit:', error);
    return false;
  }

  return !!data;
}

/**
 * Get remaining video credits for a team, broken down by base plan and top-up packs.
 * Returns zeros on DB errors so callers can degrade gracefully.
 *
 * @param teamId - The team to query
 */
export async function getRemainingCredits(teamId: string): Promise<VideoCredits> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_remaining_video_credits', {
    p_team_id: teamId,
  });

  if (error || !data || data.length === 0) {
    return { baseRemaining: 0, topupRemaining: 0, totalRemaining: 0 };
  }

  const row = data[0];
  return {
    baseRemaining: row.base_remaining ?? 0,
    topupRemaining: row.topup_remaining ?? 0,
    totalRemaining: row.total_remaining ?? 0,
  };
}

// ============================================================================
// Video Retrieval
// ============================================================================

/**
 * Get all shared videos for a team (coach dashboard view).
 * Results are ordered newest-first.
 *
 * @param teamId - The team to query
 * @param options - Optional filters for share type and pagination limit
 */
export async function getTeamVideos(
  teamId: string,
  options: { limit?: number; shareType?: VideoShareType } = {},
): Promise<SharedVideo[]> {
  const supabase = await createClient();

  let query = supabase
    .from('shared_videos')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (options.shareType) {
    query = query.eq('share_type', options.shareType);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get a single shared video by its ID.
 * Returns null if the video does not exist.
 *
 * @param videoId - The shared_videos row ID
 */
export async function getVideoById(videoId: string): Promise<SharedVideo | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shared_videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Row not found
    throw new Error(`Failed to fetch video: ${error.message}`);
  }

  return data;
}

/**
 * Get all videos visible to a parent for a given team.
 * Includes published team-wide videos and individual videos explicitly shared with them.
 * Attaches view tracking data (viewed_at, view_count) to each result.
 *
 * @param teamId - The team context
 * @param parentId - The parent whose visible videos to retrieve
 */
export async function getVideosForParent(
  teamId: string,
  parentId: string,
): Promise<Array<SharedVideo & { viewed_at: string | null; view_count: number }>> {
  const supabase = await createClient();

  // 1. All published, ready team-wide videos for this team
  const { data: teamVideos } = await supabase
    .from('shared_videos')
    .select('*')
    .eq('team_id', teamId)
    .eq('share_type', 'team')
    .eq('publish_confirmed', true)
    .eq('mux_asset_status', 'ready')
    .order('created_at', { ascending: false });

  // 2. Individual video share targets for this parent
  const { data: individualTargets } = await supabase
    .from('video_share_targets')
    .select(`
      viewed_at,
      view_count,
      shared_videos!inner (*)
    `)
    .eq('parent_id', parentId);

  // 3. View status for team videos (the parent may have a target row already)
  const teamVideoIds = (teamVideos ?? []).map(v => v.id);

  const { data: teamViewStatuses } = teamVideoIds.length > 0
    ? await supabase
        .from('video_share_targets')
        .select('video_id, viewed_at, view_count')
        .eq('parent_id', parentId)
        .in('video_id', teamVideoIds)
    : { data: [] };

  const viewMap = new Map(
    (teamViewStatuses ?? []).map(vs => [vs.video_id, vs]),
  );

  // 4. Build the combined list
  const allVideos: Array<SharedVideo & { viewed_at: string | null; view_count: number }> = [];
  const teamVideoIdSet = new Set(teamVideoIds);

  for (const video of teamVideos ?? []) {
    const viewStatus = viewMap.get(video.id);
    allVideos.push({
      ...video,
      viewed_at: viewStatus?.viewed_at ?? null,
      view_count: viewStatus?.view_count ?? 0,
    });
  }

  // Add individually shared videos not already present (dedup + filter for ready/published)
  for (const target of individualTargets ?? []) {
    const video = target.shared_videos as unknown as SharedVideo;
    if (
      video &&
      !teamVideoIdSet.has(video.id) &&
      video.publish_confirmed &&
      video.mux_asset_status === 'ready'
    ) {
      allVideos.push({
        ...video,
        viewed_at: target.viewed_at,
        view_count: target.view_count,
      });
    }
  }

  // Sort newest-first
  allVideos.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return allVideos;
}

/**
 * Record a video view by a parent.
 * Creates a share target row for team videos on first view (lazy creation).
 * Delegates view count increment to the record_video_view DB function.
 *
 * @param videoId - The shared_videos row ID
 * @param parentId - The parent who viewed the video
 */
export async function recordVideoView(videoId: string, parentId: string): Promise<void> {
  const supabase = await createClient();

  // Ensure a share target exists for team videos viewed for the first time
  const { data: existing } = await supabase
    .from('video_share_targets')
    .select('id')
    .eq('video_id', videoId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from('video_share_targets')
      .insert({ video_id: videoId, parent_id: parentId });
  }

  const { error } = await supabase.rpc('record_video_view', {
    p_video_id: videoId,
    p_parent_id: parentId,
  });

  if (error) {
    // Non-fatal: log and continue. View tracking should not block playback.
    console.error('Failed to record video view:', error);
  }
}

/**
 * Delete a shared video record and its associated Mux asset.
 * Mux deletion is attempted first; DB deletion proceeds regardless of Mux outcome.
 *
 * @param videoId - The shared_videos row ID to delete
 */
export async function deleteSharedVideo(videoId: string): Promise<void> {
  const supabase = await createClient();

  const { data: video } = await supabase
    .from('shared_videos')
    .select('mux_asset_id')
    .eq('id', videoId)
    .single();

  if (video?.mux_asset_id) {
    await deleteMuxAsset(video.mux_asset_id);
  }

  const { error } = await supabase
    .from('shared_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    throw new Error(`Failed to delete video: ${error.message}`);
  }
}
