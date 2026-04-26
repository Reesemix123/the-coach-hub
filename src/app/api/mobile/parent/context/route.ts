/**
 * API: GET /api/mobile/parent/context
 *
 * Returns parent's teams and athletes for the mobile ParentContext.
 * One call replaces multiple queries that the PWA layout does server-side.
 */

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get parent profile
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!parentProfile) {
    return NextResponse.json({ error: 'Not a parent' }, { status: 403 })
  }

  const parentName = `${parentProfile.first_name} ${parentProfile.last_name}`.trim()

  // Get teams via team_parent_access
  const { data: teamAccess } = await supabase
    .from('team_parent_access')
    .select('team_id, teams(id, name)')
    .eq('parent_id', parentProfile.id)
    .eq('status', 'active')

  const teams: { id: string; name: string }[] = []
  if (teamAccess) {
    for (const row of teamAccess) {
      const t = row.teams as unknown as { id: string; name: string } | null
      if (t) teams.push({ id: t.id, name: t.name })
    }
  }

  // Get athletes via player_parent_links → players → teams
  const { data: links } = await supabase
    .from('player_parent_links')
    .select('player_id, players(id, first_name, last_name, team_id, teams(id, name))')
    .eq('parent_id', parentProfile.id)

  const athletes: { id: string; name: string; teamId: string; teamName: string; athleteProfileId: string | null }[] = []
  if (links) {
    for (const link of links) {
      const p = link.players as unknown as {
        id: string
        first_name: string
        last_name: string
        team_id: string
        teams: { id: string; name: string } | null
      } | null
      if (p) {
        athletes.push({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          teamId: p.team_id,
          teamName: p.teams?.name ?? '',
          athleteProfileId: null,
        })
      }
    }
  }

  // Resolve athleteProfileId for each roster player via athlete_seasons.
  // Uses service client because athlete_seasons RLS is coach/owner-scoped;
  // the parent has already proven access via player_parent_links above.
  if (athletes.length > 0) {
    const rosterIds = athletes.map((a) => a.id)
    const serviceClient = createServiceClient()
    const { data: seasons } = await serviceClient
      .from('athlete_seasons')
      .select('roster_id, athlete_profile_id, season_year')
      .in('roster_id', rosterIds)
      .order('season_year', { ascending: false })

    const profileByRosterId = new Map<string, string>()
    for (const s of seasons ?? []) {
      if (!profileByRosterId.has(s.roster_id)) {
        profileByRosterId.set(s.roster_id, s.athlete_profile_id)
      }
    }

    for (const a of athletes) {
      a.athleteProfileId = profileByRosterId.get(a.id) ?? null
    }
  }

  return NextResponse.json({ parentName, teams, athletes })
}
