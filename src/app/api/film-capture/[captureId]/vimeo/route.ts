/**
 * API: /api/film-capture/[captureId]/vimeo
 *
 * POST — Send a film capture to the authenticated user's connected Vimeo account.
 *
 * Access rules:
 * - User must have film_capture_access on their coach or parent profile.
 * - User must be the capture uploader, a platform admin, or have an active
 *   film_capture_shares record granting them access to this capture.
 *
 * Body (JSON):
 *   title?          — Vimeo video title (defaults to sport + opponent + date)
 *   description?    — Vimeo video description (optional)
 *   privacySetting? — 'public' | 'unlisted' | 'private' (defaults to 'unlisted')
 *
 * Returns: { shareId: string } — the external_video_shares row ID for status polling.
 *
 * Note: Requires migration 174 to be applied before 'film_capture' is a valid
 * source_type in external_video_shares.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  uploadToVimeo,
  getVimeoAccessToken,
} from '@/lib/services/communication/vimeo.service';
import type { PrivacySetting } from '@/types/communication';

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { captureId } = await context.params;

    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify film_capture_access on coach or parent profile
    const [{ data: coachProfile }, { data: parentProfile }] = await Promise.all([
      supabase
        .from('profiles')
        .select('film_capture_access')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('parent_profiles')
        .select('film_capture_access')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (!coachProfile?.film_capture_access && !parentProfile?.film_capture_access) {
      return NextResponse.json({ error: 'Film capture access not granted' }, { status: 403 });
    }

    // 3. Verify Vimeo connection before doing any heavy work
    const token = await getVimeoAccessToken(user.id);
    if (!token) {
      return NextResponse.json({ error: 'Vimeo account not connected' }, { status: 400 });
    }

    // 4. Fetch capture details — service client bypasses RLS for ownership check below
    const serviceClient = createServiceClient();
    const { data: capture } = await serviceClient
      .from('film_captures')
      .select('id, storage_path, file_name, sport_id, opponent, game_date, uploader_id, sports(name)')
      .eq('id', captureId)
      .single();

    if (!capture) {
      return NextResponse.json({ error: 'Capture not found' }, { status: 404 });
    }

    // 5. Authorize — owner, platform admin, or explicitly shared
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.is_platform_admin === true;

    if (capture.uploader_id !== user.id && !isAdmin) {
      const { data: share } = await serviceClient
        .from('film_capture_shares')
        .select('id')
        .eq('capture_id', captureId)
        .eq('shared_with_user_id', user.id)
        .maybeSingle();

      if (!share) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 6. Parse and validate request body
    const body = await request.json() as {
      title?: string;
      description?: string;
      privacySetting?: PrivacySetting;
    };

    const { title, description, privacySetting } = body;

    // 7. Generate a signed URL for Vimeo to pull the video from (4-hour TTL)
    const { data: signedData } = await serviceClient.storage
      .from('film_captures')
      .createSignedUrl(capture.storage_path, 4 * 60 * 60);

    if (!signedData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to generate video URL' }, { status: 500 });
    }

    // 8. Build a default title from capture metadata
    const sport = Array.isArray(capture.sports) ? capture.sports[0] : capture.sports;
    const sportName = (sport as { name: string } | null)?.name ?? 'Film';
    const defaultTitle = capture.opponent
      ? `${sportName} vs ${capture.opponent} — ${new Date(capture.game_date as string).toLocaleDateString()}`
      : `${sportName} — ${new Date(capture.game_date as string).toLocaleDateString()}`;

    // 9. Delegate to Vimeo service
    // Note: source_type 'film_capture' requires migration 174 to be applied.
    // The cast is intentional — the TypeScript union will be updated once the
    // migration has been deployed to all environments.
    const shareId = await uploadToVimeo({
      coachId: user.id,
      teamId: '',  // Film captures are not team-scoped
      sourceType: 'film_capture' as Parameters<typeof uploadToVimeo>[0]['sourceType'],
      sourceId: captureId,
      title: title?.trim() || defaultTitle,
      description: description ?? 'Uploaded from Youth Coach Hub Film Capture',
      privacySetting: privacySetting ?? 'unlisted',
      confirmationText: 'Uploaded via Film Capture',
      videoUrl: signedData.signedUrl,
    });

    return NextResponse.json({ shareId }, { status: 201 });
  } catch (error) {
    console.error('[film-capture/vimeo] Error:', error);
    return NextResponse.json({ error: 'Failed to send to Vimeo' }, { status: 500 });
  }
}
