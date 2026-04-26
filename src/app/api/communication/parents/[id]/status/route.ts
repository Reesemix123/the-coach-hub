/**
 * API: /api/communication/parents/[id]/status
 * PATCH - Update parent's team access status (e.g., remove from team)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, status } = body

    if (!teamId || !status) {
      return NextResponse.json({ error: 'teamId and status are required' }, { status: 400 })
    }

    if (!['active', 'removed'].includes(status)) {
      return NextResponse.json({ error: 'status must be "active" or "removed"' }, { status: 400 })
    }

    // Verify caller is team owner, coach, or team_admin
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const isOwner = team.user_id === user.id
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role || '')

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update the parent's access status
    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('team_parent_access')
      .update({ status })
      .eq('team_id', teamId)
      .eq('parent_id', parentId)

    if (error) {
      console.error('Failed to update parent status:', error)
      return NextResponse.json({ error: 'Failed to update parent status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error updating parent status:', err)
    return NextResponse.json({ error: 'Failed to update parent status' }, { status: 500 })
  }
}
