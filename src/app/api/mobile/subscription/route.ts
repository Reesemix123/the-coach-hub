/**
 * API: GET /api/mobile/subscription
 *
 * Consolidated endpoint for mobile SubscriptionContext.
 * Returns coach subscription, comm hub plan, and parent access in one call.
 * Role detection is handled separately by /api/mobile/role + RoleContext.
 *
 * Query params:
 *   - teamId (required for coach subscription + comm plan)
 *   - athleteId (optional, for parent access check)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import type { SubscriptionTier, SubscriptionStatus } from '@/types/admin'
import type { PlanTier } from '@/types/communication'

// Normalize legacy tier names to current naming
function normalizeTier(raw: string): SubscriptionTier {
  const map: Record<string, SubscriptionTier> = {
    little_league: 'basic',
    hs_basic: 'plus',
    hs_advanced: 'premium',
    basic: 'basic',
    plus: 'plus',
    premium: 'premium',
  }
  return map[raw] || 'basic'
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('teamId')

  // --- Coach subscription ---
  let coachTier: SubscriptionTier | null = null
  let coachStatus: SubscriptionStatus | null = null
  let billingWaived = false

  if (teamId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_waived')
      .eq('team_id', teamId)
      .single()

    if (sub) {
      coachTier = normalizeTier(sub.tier || 'plus')
      coachStatus = (sub.status as SubscriptionStatus) || 'none'
      billingWaived = sub.billing_waived || false
    } else {
      coachTier = null
      coachStatus = 'none'
    }
  }

  // --- Comm Hub plan ---
  let commPlan: PlanTier | null = null

  if (teamId) {
    const { data: plan } = await supabase
      .from('team_communication_plans')
      .select('plan_tier, status, expires_at')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (plan) {
      commPlan = plan.plan_tier as PlanTier
    }
  }

  // --- Parent access ---
  let parentHasAccess = false
  let parentAccessSource: 'comm_hub' | 'self_subscribed' | 'none' | null = null

  const athleteId = searchParams.get('athleteId')
  if (athleteId) {
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (parentProfile) {
      const serviceClient = createServiceClient()

      // Check self-subscribed first
      const { data: selfSub } = await serviceClient
        .from('parent_profile_subscriptions')
        .select('id')
        .eq('parent_id', parentProfile.id)
        .eq('athlete_profile_id', athleteId)
        .eq('status', 'active')
        .maybeSingle()

      if (selfSub) {
        parentHasAccess = true
        parentAccessSource = 'self_subscribed'
      } else {
        // Check comm hub plan access
        const { data: commAccess } = await serviceClient
          .from('athlete_seasons')
          .select(`
            team_id,
            team_communication_plans!inner(status, expires_at),
            team_parent_access!inner(status)
          `)
          .eq('athlete_profile_id', athleteId)
          .eq('team_communication_plans.status', 'active')
          .eq('team_parent_access.parent_id', parentProfile.id)
          .eq('team_parent_access.status', 'active')
          .gt('team_communication_plans.expires_at', new Date().toISOString())
          .limit(1)
          .maybeSingle()

        if (commAccess) {
          parentHasAccess = true
          parentAccessSource = 'comm_hub'
        } else {
          parentAccessSource = 'none'
        }
      }
    }
  }

  return NextResponse.json({
    coachTier,
    coachStatus,
    billingWaived,
    commPlan,
    parentHasAccess,
    parentAccessSource,
  })
}
