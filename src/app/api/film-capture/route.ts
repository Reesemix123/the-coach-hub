import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import type { FilmCaptureWithSport } from '@/types/film-capture';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';

    // Check if admin when 'all' mode is requested
    let isAdmin = false;
    if (showAll) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();
      isAdmin = profile?.is_platform_admin === true;
    }

    const serviceClient = createServiceClient();

    // Build query — scope to current user unless admin requests all
    type CaptureQuery = ReturnType<typeof serviceClient.from>;
    let query = serviceClient
      .from('film_captures')
      .select('*, sports(name, icon)')
      .order('created_at', { ascending: false });

    if (!isAdmin || !showAll) {
      query = query.eq('uploader_id', user.id);
    }

    const { data: captures, error } = await query;

    if (error) {
      console.error('[film-capture] List failed:', error);
      return NextResponse.json({ error: 'Failed to fetch captures' }, { status: 500 });
    }

    // Generate signed URLs for playback (1-hour expiry)
    const enriched: FilmCaptureWithSport[] = await Promise.all(
      (captures ?? []).map(async (c: Record<string, unknown>) => {
        const sport = Array.isArray(c.sports) ? c.sports[0] : c.sports;
        let playbackUrl: string | null = null;

        const { data: signedData } = await serviceClient.storage
          .from('film_captures')
          .createSignedUrl(c.storage_path as string, 3600);

        if (signedData?.signedUrl) {
          playbackUrl = signedData.signedUrl;
        }

        return {
          id: c.id as string,
          sport_id: c.sport_id as string,
          sport_name: (sport as { name?: string } | null)?.name ?? 'Unknown',
          sport_icon: (sport as { icon?: string } | null)?.icon ?? null,
          game_date: c.game_date as string,
          opponent: (c.opponent as string) ?? null,
          age_group: (c.age_group as string) ?? null,
          storage_path: c.storage_path as string,
          file_name: c.file_name as string,
          file_size_bytes: (c.file_size_bytes as number) ?? null,
          mime_type: (c.mime_type as string) ?? null,
          uploader_id: c.uploader_id as string,
          uploader_role: c.uploader_role as 'coach' | 'parent',
          created_at: c.created_at as string,
          updated_at: c.updated_at as string,
          playback_url: playbackUrl,
        };
      })
    );

    return NextResponse.json({ captures: enriched });
  } catch (error) {
    console.error('[film-capture] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
