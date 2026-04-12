/**
 * API: GET /api/film-capture/games/[gameId]/clips
 * Returns all clips belonging to a game, ordered by clip_order then created_at.
 * Each clip is enriched with a 1-hour signed playback URL from Supabase Storage.
 *
 * Access: uploader, admin, or any user who has a share on at least one clip in the game.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { gameId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Verify the game exists and the caller is allowed to see it
    const { data: game, error: gameError } = await serviceClient
      .from('film_capture_games')
      .select('id, uploader_id')
      .eq('id', gameId)
      .maybeSingle();

    if (gameError) {
      console.error('[film-capture/games/clips] Game lookup failed:', gameError);
      return NextResponse.json({ error: 'Failed to look up game' }, { status: 500 });
    }

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const isOwner = game.uploader_id === user.id;

    if (!isOwner) {
      // Check admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .maybeSingle();

      const isAdmin = profile?.is_platform_admin === true;

      if (!isAdmin) {
        // Check whether the user has a share on any clip in this game
        const { data: gameClipIds } = await serviceClient
          .from('film_captures')
          .select('id')
          .eq('game_id', gameId);

        const clipIds = (gameClipIds ?? []).map(c => c.id);
        const { data: sharedClip } = clipIds.length > 0
          ? await serviceClient
              .from('film_capture_shares')
              .select('id')
              .eq('shared_with_user_id', user.id)
              .in('capture_id', clipIds)
              .limit(1)
              .maybeSingle()
          : { data: null };

        if (!sharedClip) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Fetch clips ordered by clip_order, then insertion order
    const { data: clips, error } = await serviceClient
      .from('film_captures')
      .select('*')
      .eq('game_id', gameId)
      .order('clip_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[film-capture/games/clips] Fetch failed:', error);
      return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
    }

    // Generate signed playback URLs (1 hour TTL)
    const enriched = await Promise.all(
      (clips ?? []).map(async (clip) => {
        let playback_url: string | null = null;

        const { data: signedData } = await serviceClient.storage
          .from('film_captures')
          .createSignedUrl(clip.storage_path, 3600);

        if (signedData?.signedUrl) {
          playback_url = signedData.signedUrl;
        }

        return { ...clip, playback_url };
      })
    );

    return NextResponse.json({ clips: enriched });
  } catch (error) {
    console.error('[film-capture/games/clips] GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
