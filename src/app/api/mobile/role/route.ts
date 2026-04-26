/**
 * API: GET /api/mobile/role
 *
 * Returns role data for the authenticated user:
 * - isCoach: true if user owns or is a member of any team
 * - isParent: true if user has a parent_profiles row
 * - coachTeams: teams they coach (owned + memberships)
 * - parentAthletes: athletes linked via parent profile
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface CoachTeam {
  id: string
  name: string
  level: string
}

interface ParentAthlete {
  id: string
  name: string
  teamName: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Coach: check teams (ownership + memberships) ---
  const [{ data: ownedTeams }, { data: memberships }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, level')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_memberships')
      .select('team_id, teams(id, name, level)')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const coachTeams: CoachTeam[] = (ownedTeams ?? []).map(t => ({
    id: t.id,
    name: t.name,
    level: t.level ?? '',
  }))

  if (memberships) {
    for (const m of memberships) {
      const t = m.teams as unknown as { id: string; name: string; level: string } | null
      if (t && !coachTeams.some(existing => existing.id === t.id)) {
        coachTeams.push({ id: t.id, name: t.name, level: t.level ?? '' })
      }
    }
  }

  const isCoach = coachTeams.length > 0

  // --- Parent: check parent_profiles ---
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isParent = !!parentProfile
  const parentAthletes: ParentAthlete[] = []

  if (parentProfile) {
    // Get linked athletes via player_parent_links → players → teams
    const { data: links } = await supabase
      .from('player_parent_links')
      .select('player_id, players(id, first_name, last_name, team_id, teams(name))')
      .eq('parent_id', parentProfile.id)

    if (links) {
      for (const link of links) {
        const p = link.players as unknown as {
          id: string
          first_name: string
          last_name: string
          team_id: string
          teams: { name: string } | null
        } | null
        if (p) {
          parentAthletes.push({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim(),
            teamName: p.teams?.name ?? '',
          })
        }
      }
    }
  }

  return NextResponse.json({
    isCoach,
    isParent,
    coachTeams,
    parentAthletes,
  })
}
