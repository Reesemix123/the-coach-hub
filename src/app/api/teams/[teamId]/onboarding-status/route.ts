/**
 * API: GET /api/teams/[teamId]/onboarding-status
 *
 * Returns lightweight counts the mobile coach onboarding checklist needs:
 * how many players are on the roster, how many parents have active access,
 * and how many scheduled events exist (games + team_events combined).
 *
 * Auth: coach must own the team or have an active team_memberships row.
 * Service client is used for the team_parent_access count to dodge known
 * RLS recursion in that table.
 */

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ teamId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { teamId } = await context.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify coach owns the team or is an active member
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single()
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const isOwner = team.user_id === user.id
    if (!isOwner) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const serviceClient = createServiceClient()

    const [playersRes, parentsRes, gamesRes, eventsRes] = await Promise.all([
      supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId),
      // team_parent_access has known RLS recursion — service client only
      serviceClient
        .from('team_parent_access')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'active'),
      supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId),
      supabase
        .from('team_events')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId),
    ])

    const playerCount = playersRes.count ?? 0
    const parentCount = parentsRes.count ?? 0
    const eventCount = (gamesRes.count ?? 0) + (eventsRes.count ?? 0)

    return NextResponse.json({ playerCount, parentCount, eventCount })
  } catch (error) {
    console.error('[onboarding-status] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
