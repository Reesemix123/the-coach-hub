/**
 * API: PATCH /api/teams/[teamId]/archive
 *
 * Soft-archives a team. Sets teams.deleted_at = NOW(). Does NOT cascade —
 * child rows (players, games, drives, parent access, etc.) remain in the
 * database. RLS hides the archived team from non-admin reads, which in
 * turn hides all dependent data from the user.
 *
 * Auth: requesting user must be the team creator (teams.user_id) or have
 * an active team_memberships row with role='owner'. Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ teamId: string }>
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const { teamId } = await context.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the team and the requester's relationship to it.
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id, deleted_at')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isCreator = team.user_id === user.id

    let isOwnerMember = false
    if (!isCreator) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      isOwnerMember = membership?.role === 'owner'
    }

    if (!isCreator && !isOwnerMember) {
      return NextResponse.json(
        { error: 'Only the team owner can archive this team.' },
        { status: 403 },
      )
    }

    // Idempotent: if already archived, return the existing timestamp.
    if (team.deleted_at) {
      return NextResponse.json({ archived: true, archivedAt: team.deleted_at })
    }

    const archivedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('teams')
      .update({ deleted_at: archivedAt })
      .eq('id', teamId)
      .is('deleted_at', null)

    if (updateError) {
      console.error('[archive-team] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to archive team' }, { status: 500 })
    }

    return NextResponse.json({ archived: true, archivedAt })
  } catch (error) {
    console.error('[archive-team] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
