/**
 * API: GET /api/parent/athletes/[athleteId]/reports?seasonId=
 *
 * Returns published reports for an athlete in a given season.
 * Stats snapshots are always returned (the "baseball card front" stays visible
 * even without a subscription). Narrative text is redacted when access is gated.
 *
 * Auth: parent must own or be linked to the athlete profile.
 * Access: parent_can_access_athlete_content() controls whether ai_narrative_parent
 * is included in the response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ athleteId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { athleteId } = await context.params
    const seasonId = request.nextUrl.searchParams.get('seasonId')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!parentProfile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('athlete_profiles')
      .select('id, created_by_parent_id')
      .eq('id', athleteId)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (profile.created_by_parent_id !== parentProfile.id) {
      const { data: athleteSeasons } = await serviceClient
        .from('athlete_seasons')
        .select('roster_id')
        .eq('athlete_profile_id', athleteId)
      const rosterIds = (athleteSeasons ?? []).map((s) => s.roster_id)
      if (rosterIds.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      const { data: link } = await serviceClient
        .from('player_parent_links')
        .select('id')
        .eq('parent_id', parentProfile.id)
        .in('player_id', rosterIds)
        .limit(1)
      if (!link || link.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    const { data: hasAccess } = await serviceClient.rpc(
      'parent_can_access_athlete_content',
      { p_athlete_profile_id: athleteId, p_parent_id: parentProfile.id }
    )

    let query = serviceClient
      .from('player_reports')
      .select(
        'id, athlete_season_id, game_id, sport, report_type, stats_snapshot, ai_narrative_parent, published_at, created_at'
      )
      .eq('athlete_profile_id', athleteId)
      .eq('is_published_to_parent', true)
      .order('created_at', { ascending: false })

    if (seasonId) {
      query = query.eq('athlete_season_id', seasonId)
    }

    const { data: reports, error: reportsError } = await query
    if (reportsError) {
      console.error('[athlete-reports] Failed to fetch reports:', reportsError)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    const gameIds = [
      ...new Set(
        (reports ?? [])
          .map((r) => r.game_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const gameMap = new Map<string, { opponent: string; date: string | null }>()
    if (gameIds.length > 0) {
      const { data: games } = await serviceClient
        .from('games')
        .select('id, opponent, date')
        .in('id', gameIds)
      for (const g of games ?? []) {
        gameMap.set(g.id, { opponent: g.opponent ?? 'Unknown', date: g.date })
      }
    }

    const result = (reports ?? []).map((r) => {
      const game = r.game_id ? gameMap.get(r.game_id) : null
      return {
        id: r.id,
        seasonId: r.athlete_season_id,
        gameId: r.game_id,
        opponent: game?.opponent ?? null,
        gameDate: game?.date ?? null,
        reportType: r.report_type,
        statsSnapshot: r.stats_snapshot,
        aiNarrativeParent: hasAccess ? r.ai_narrative_parent : null,
        publishedAt: r.published_at,
        createdAt: r.created_at,
        locked: !hasAccess,
      }
    })

    return NextResponse.json({ reports: result, locked: !hasAccess })
  } catch (error) {
    console.error('[athlete-reports] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
