import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import type { FilmCaptureWithSport } from '@/types/film-capture';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);

    // 'tab' drives the view: mine | shared | all
    // Legacy 'all=true' param is treated as tab=all for backwards compatibility.
    const rawTab = searchParams.get('tab');
    const legacyAll = searchParams.get('all') === 'true';
    const requestedTab = rawTab ?? (legacyAll ? 'all' : 'mine');

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

    // Resolve admin status when the 'all' tab is requested
    let isAdmin = false;
    if (requestedTab === 'all') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();
      isAdmin = profile?.is_platform_admin === true;

      // Non-admins requesting tab=all fall back to tab=mine
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const serviceClient = createServiceClient();

    // -------------------------------------------------------------------------
    // tab=shared — query captures shared with the current user
    // -------------------------------------------------------------------------
    if (requestedTab === 'shared') {
      // Find all capture_ids shared with this user
      const { data: shareRows, error: shareError } = await serviceClient
        .from('film_capture_shares')
        .select('capture_id, shared_by_user_id, shared_at')
        .eq('shared_with_user_id', user.id)
        .order('shared_at', { ascending: sort === 'oldest' });

      if (shareError) {
        console.error('[film-capture] Shared tab fetch failed:', shareError);
        return NextResponse.json({ error: 'Failed to fetch shared captures' }, { status: 500 });
      }

      if (!shareRows || shareRows.length === 0) {
        return NextResponse.json({ captures: [], total: 0, page, per_page: perPage, total_pages: 1 });
      }

      const captureIds = shareRows.map(s => s.capture_id);

      // Build a lookup: captureId -> { shared_by_user_id, shared_at }
      const shareMetaMap = new Map(
        shareRows.map(s => [s.capture_id, { sharedByUserId: s.shared_by_user_id, sharedAt: s.shared_at }])
      );

      // Fetch the actual captures
      let captureQuery = serviceClient
        .from('film_captures')
        .select('*, sports(name, icon)', { count: 'exact' })
        .in('id', captureIds)
        .order('created_at', { ascending: sort === 'oldest' });

      if (sportIdFilter) captureQuery = captureQuery.eq('sport_id', sportIdFilter);
      if (ageGroupFilter) captureQuery = captureQuery.eq('age_group', ageGroupFilter);
      if (search) captureQuery = captureQuery.ilike('opponent', `%${search}%`);

      captureQuery = captureQuery.range(from, to);

      const { data: captures, error: captureError, count } = await captureQuery;

      if (captureError) {
        console.error('[film-capture] Shared captures fetch failed:', captureError);
        return NextResponse.json({ error: 'Failed to fetch captures' }, { status: 500 });
      }

      // Resolve sharer names
      const sharerIds = [...new Set(shareRows.map(s => s.shared_by_user_id))];
      const [{ data: sharerProfiles }, { data: sharerParents }] = await Promise.all([
        serviceClient.from('profiles').select('id, full_name, email').in('id', sharerIds),
        serviceClient.from('parent_profiles').select('user_id, first_name, last_name').in('user_id', sharerIds),
      ]);

      const sharerNameMap = new Map<string, string>();
      for (const p of sharerProfiles ?? []) {
        sharerNameMap.set(p.id, (p.full_name as string | null) || (p.email as string | null) || p.id);
      }
      for (const p of sharerParents ?? []) {
        sharerNameMap.set(p.user_id, `${p.first_name} ${p.last_name}`.trim());
      }

      // Generate signed URLs and build enriched list
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

          const meta = shareMetaMap.get(c.id as string);

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
            uploader_name: null,
            shared_by_name: meta ? (sharerNameMap.get(meta.sharedByUserId) ?? null) : null,
            shared_at: meta?.sharedAt ?? null,
          };
        })
      );

      const total = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / perPage));

      return NextResponse.json({ captures: enriched, total, page, per_page: perPage, total_pages: totalPages });
    }

    // -------------------------------------------------------------------------
    // tab=mine (default) or tab=all (admin)
    // -------------------------------------------------------------------------
    let query = serviceClient
      .from('film_captures')
      .select('*, sports(name, icon)', { count: 'exact' })
      .order('created_at', { ascending: sort === 'oldest' });

    // Scope to current user unless admin viewing all
    if (!isAdmin) {
      query = query.eq('uploader_id', user.id);
    }

    if (sportIdFilter) query = query.eq('sport_id', sportIdFilter);
    if (ageGroupFilter) query = query.eq('age_group', ageGroupFilter);
    if (uploaderIdFilter && isAdmin) query = query.eq('uploader_id', uploaderIdFilter);
    if (search) query = query.ilike('opponent', `%${search}%`);

    query = query.range(from, to);

    const { data: captures, error, count } = await query;

    if (error) {
      console.error('[film-capture] List failed:', error);
      return NextResponse.json({ error: 'Failed to fetch captures' }, { status: 500 });
    }

    // Build uploader name map for admin view
    let uploaderNameMap: Map<string, string> = new Map();
    if (isAdmin && (captures ?? []).length > 0) {
      const uploaderIds = [...new Set((captures ?? []).map((c: Record<string, unknown>) => c.uploader_id as string))];
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uploaderIds);
      for (const p of profiles ?? []) {
        uploaderNameMap.set(p.id, (p.full_name as string | null) || (p.email as string | null) || p.id);
      }
    }

    // Build share count map for "mine" tab
    let shareCountMap: Map<string, number> = new Map();
    if (requestedTab === 'mine' && (captures ?? []).length > 0) {
      const captureIds = (captures ?? []).map((c: Record<string, unknown>) => c.id as string);
      const { data: shareRows } = await serviceClient
        .from('film_capture_shares')
        .select('capture_id')
        .in('capture_id', captureIds);

      for (const row of shareRows ?? []) {
        shareCountMap.set(row.capture_id, (shareCountMap.get(row.capture_id) ?? 0) + 1);
      }
    }

    // Generate signed URLs and build enriched list
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
        const captureId = c.id as string;

        return {
          id: captureId,
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
          share_count: shareCountMap.get(captureId) ?? 0,
        };
      })
    );

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return NextResponse.json({ captures: enriched, total, page, per_page: perPage, total_pages: totalPages });
  } catch (error) {
    console.error('[film-capture] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
