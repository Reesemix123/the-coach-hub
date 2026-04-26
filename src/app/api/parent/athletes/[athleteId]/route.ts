/**
 * API: GET /api/parent/athletes/[athleteId]
 *
 * Returns the athlete profile and all of their seasons (across teams/sports/years).
 * `athleteId` is the athlete_profile_id.
 *
 * Auth: parent must own the profile (created_by_parent_id) OR be linked to it
 * via player_parent_links → athlete_seasons.roster_id.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ athleteId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { athleteId } = await context.params

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
      .select('id, athlete_first_name, athlete_last_name, profile_photo_url, graduation_year, created_by_parent_id')
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

    const { data: seasons } = await serviceClient
      .from('athlete_seasons')
      .select('id, season_year, sport, position, jersey_number, teams(id, name)')
      .eq('athlete_profile_id', athleteId)
      .order('season_year', { ascending: false })

    const seasonsResp = (seasons ?? []).map((s) => {
      const team = s.teams as unknown as { id: string; name: string } | null
      return {
        id: s.id,
        year: s.season_year,
        sport: s.sport,
        teamName: team?.name ?? '',
        position: s.position,
        jerseyNumber: s.jersey_number,
      }
    })

    return NextResponse.json({
      profile: {
        id: profile.id,
        firstName: profile.athlete_first_name,
        lastName: profile.athlete_last_name,
        photoUrl: profile.profile_photo_url,
        graduationYear: profile.graduation_year,
      },
      seasons: seasonsResp,
    })
  } catch (error) {
    console.error('[athlete-profile] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
