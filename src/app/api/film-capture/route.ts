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

    // Parse filters
    const sportIdFilter = searchParams.get('sport_id') || null;
    const ageGroupFilter = searchParams.get('age_group') || null;
    const uploaderIdFilter = searchParams.get('uploader_id') || null;
    const search = searchParams.get('search') || null;
    const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Check admin status when 'all' mode is requested
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

    // Build query with exact count for pagination
    let query = serviceClient
      .from('film_captures')
      .select('*, sports(name, icon)', { count: 'exact' })
      .order('created_at', { ascending: sort === 'oldest' });

    if (!isAdmin || !showAll) {
      query = query.eq('uploader_id', user.id);
    }

    if (sportIdFilter) {
      query = query.eq('sport_id', sportIdFilter);
    }

    if (ageGroupFilter) {
      query = query.eq('age_group', ageGroupFilter);
    }

    if (uploaderIdFilter && isAdmin) {
      query = query.eq('uploader_id', uploaderIdFilter);
    }

    if (search) {
      query = query.ilike('opponent', `%${search}%`);
    }

    // Apply pagination
    query = query.range(from, to);

    const { data: captures, error, count } = await query;

    if (error) {
      console.error('[film-capture] List failed:', error);
      return NextResponse.json({ error: 'Failed to fetch captures' }, { status: 500 });
    }

    // Build uploader name map for admin view
    let uploaderNameMap: Map<string, string> = new Map();
    if (isAdmin && showAll && (captures ?? []).length > 0) {
      const uploaderIds = [...new Set((captures ?? []).map((c: Record<string, unknown>) => c.uploader_id as string))];
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uploaderIds);
      for (const profile of profiles ?? []) {
        uploaderNameMap.set(profile.id, profile.full_name || profile.email || profile.id);
      }
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

        const uploaderId = c.uploader_id as string;

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
          uploader_id: uploaderId,
          uploader_role: c.uploader_role as 'coach' | 'parent',
          created_at: c.created_at as string,
          updated_at: c.updated_at as string,
          playback_url: playbackUrl,
          uploader_name: uploaderNameMap.size > 0 ? (uploaderNameMap.get(uploaderId) ?? null) : null,
        };
      })
    );

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return NextResponse.json({
      captures: enriched,
      total,
      page,
      per_page: perPage,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error('[film-capture] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
