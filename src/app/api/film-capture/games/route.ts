/**
 * API: GET /api/film-capture/games
 * Lists film capture games for the current user.
 *
 * Query params:
 *   tab=mine|shared|all  — scope (admin only for 'all')
 *   sport_id             — filter by sport
 *   search               — search opponent (ilike)
 *   sort=newest|oldest   — default newest
 *   page, per_page       — pagination
 *
 * API: POST /api/film-capture/games
 * Creates a new film capture game.
 *
 * Body (JSON): { sport_id, game_date, opponent?, age_group?, title? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'mine';
    const sportId = searchParams.get('sport_id') || '';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = profile?.is_platform_admin === true;

    const serviceClient = createServiceClient();

    let query = serviceClient
      .from('film_capture_games')
      .select('*, sports(name, icon)', { count: 'exact' })
      .order('game_date', { ascending: sort === 'oldest' });

    // Scoping
    if (tab === 'mine') {
      query = query.eq('uploader_id', user.id);
    } else if (tab === 'shared') {
      // Resolve game IDs accessible via shared captures
      const { data: sharedCaptures } = await serviceClient
        .from('film_capture_shares')
        .select('capture_id')
        .eq('shared_with_user_id', user.id);

      if (!sharedCaptures || sharedCaptures.length === 0) {
        return NextResponse.json({ games: [], total: 0, page, per_page: perPage, total_pages: 0 });
      }

      const captureIds = sharedCaptures.map(s => s.capture_id);
      const { data: captures } = await serviceClient
        .from('film_captures')
        .select('game_id')
        .in('id', captureIds)
        .not('game_id', 'is', null);

      const gameIds = [...new Set((captures ?? []).map(c => c.game_id).filter(Boolean))];
      if (gameIds.length === 0) {
        return NextResponse.json({ games: [], total: 0, page, per_page: perPage, total_pages: 0 });
      }
      query = query.in('id', gameIds);
    } else if (tab === 'all' && isAdmin) {
      // No additional filter — admin sees everything
    } else {
      // Fallback: scope to own games
      query = query.eq('uploader_id', user.id);
    }

    // Filters
    if (sportId) query = query.eq('sport_id', sportId);
    if (search) query = query.ilike('opponent', `%${search}%`);

    // Pagination
    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data: games, error, count } = await query;
    if (error) {
      console.error('[film-capture/games] List failed:', error);
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }

    const total = count ?? 0;

    // Aggregate clip counts per game
    const gameIds = (games ?? []).map(g => g.id);
    const clipCounts = new Map<string, number>();
    if (gameIds.length > 0) {
      const { data: clips } = await serviceClient
        .from('film_captures')
        .select('game_id')
        .in('game_id', gameIds);

      for (const clip of clips ?? []) {
        if (clip.game_id) {
          clipCounts.set(clip.game_id, (clipCounts.get(clip.game_id) ?? 0) + 1);
        }
      }
    }

    // Uploader names for admin 'all' view
    const uploaderNames = new Map<string, string>();
    if (isAdmin && tab === 'all') {
      const uploaderIds = [...new Set((games ?? []).map(g => g.uploader_id))];
      if (uploaderIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uploaderIds);
        for (const p of profiles ?? []) {
          uploaderNames.set(p.id, p.full_name || p.email || p.id);
        }
      }
    }

    const enriched = (games ?? []).map((g: Record<string, unknown>) => {
      const sport = Array.isArray(g.sports) ? g.sports[0] : g.sports;
      return {
        id: g.id,
        sport_id: g.sport_id,
        sport_name: (sport as { name?: string } | null)?.name ?? 'Unknown',
        sport_icon: (sport as { icon?: string | null } | null)?.icon ?? null,
        game_date: g.game_date,
        opponent: g.opponent,
        age_group: g.age_group,
        title: g.title,
        uploader_id: g.uploader_id,
        uploader_role: g.uploader_role,
        created_at: g.created_at,
        updated_at: g.updated_at,
        clip_count: clipCounts.get(g.id as string) ?? 0,
        uploader_name: uploaderNames.get(g.uploader_id as string) ?? null,
      };
    });

    return NextResponse.json({
      games: enriched,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('[film-capture/games] GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify film_capture_access for coaches or parents
    const [{ data: coachProfile }, { data: parentProfile }] = await Promise.all([
      supabase.from('profiles').select('film_capture_access').eq('id', user.id).maybeSingle(),
      supabase.from('parent_profiles').select('film_capture_access').eq('user_id', user.id).maybeSingle(),
    ]);

    const uploaderRole = coachProfile?.film_capture_access
      ? 'coach'
      : parentProfile?.film_capture_access
        ? 'parent'
        : null;

    if (!uploaderRole) {
      return NextResponse.json({ error: 'Film capture access not granted' }, { status: 403 });
    }

    const body = await request.json();
    const { sport_id, game_date, opponent, age_group, title } = body;

    if (!sport_id) return NextResponse.json({ error: 'sport_id is required' }, { status: 400 });
    if (!game_date) return NextResponse.json({ error: 'game_date is required' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: game, error } = await serviceClient
      .from('film_capture_games')
      .insert({
        sport_id,
        game_date,
        opponent: opponent?.trim() || null,
        age_group: age_group || null,
        title: title?.trim() || null,
        uploader_id: user.id,
        uploader_role: uploaderRole,
      })
      .select()
      .single();

    if (error) {
      console.error('[film-capture/games] Create failed:', error);
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    console.error('[film-capture/games] POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
