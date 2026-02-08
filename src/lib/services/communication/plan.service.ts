/**
 * Communication Plan Service
 * Handles plan purchases, status, and video credit management
 */

import { createClient } from '@/utils/supabase/client';
import type {
  TeamCommunicationPlan,
  VideoTopupPurchase,
  PlanTier,
  PlanStatus,
  VideoCredits,
  PLAN_TIER_LIMITS,
  PLAN_TIER_PRICES,
} from '@/types/communication';

// ======================
// PLAN RETRIEVAL
// ======================

export async function getActivePlan(teamId: string): Promise<TeamCommunicationPlan | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_communication_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    throw error;
  }

  return data;
}

export async function getPlanHistory(teamId: string): Promise<TeamCommunicationPlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_communication_plans')
    .select('*')
    .eq('team_id', teamId)
    .order('activated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPlanById(planId: string): Promise<TeamCommunicationPlan | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_communication_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

// ======================
// PLAN STATUS
// ======================

export interface PlanStatusInfo {
  hasActivePlan: boolean;
  plan: TeamCommunicationPlan | null;
  isInGracePeriod: boolean;
  isLimitedMode: boolean;
  isExpiringSoon: boolean; // Within 30 days
  daysUntilExpiration: number | null;
  parentCount: number;
  parentLimit: number | null;
  isAtParentLimit: boolean;
  videoCredits: VideoCredits;
}

export async function getPlanStatus(teamId: string): Promise<PlanStatusInfo> {
  const supabase = createClient();

  const plan = await getActivePlan(teamId);

  if (!plan) {
    return {
      hasActivePlan: false,
      plan: null,
      isInGracePeriod: false,
      isLimitedMode: false,
      isExpiringSoon: false,
      daysUntilExpiration: null,
      parentCount: 0,
      parentLimit: null,
      isAtParentLimit: false,
      videoCredits: { base_remaining: 0, topup_remaining: 0, total_remaining: 0 },
    };
  }

  // Get parent count
  const { count: parentCount } = await supabase
    .from('team_parent_access')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  // Get video credits
  const credits = await getRemainingVideoCredits(teamId);

  // Calculate days until expiration
  const expiresAt = new Date(plan.expires_at);
  const now = new Date();
  const daysUntilExpiration = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    hasActivePlan: true,
    plan,
    isInGracePeriod: plan.coach_override_status === 'grace_period',
    isLimitedMode: plan.coach_override_status === 'limited',
    isExpiringSoon: daysUntilExpiration <= 30 && daysUntilExpiration > 0,
    daysUntilExpiration: daysUntilExpiration > 0 ? daysUntilExpiration : 0,
    parentCount: parentCount || 0,
    parentLimit: plan.max_parents,
    isAtParentLimit: plan.max_parents !== null && (parentCount || 0) >= plan.max_parents,
    videoCredits: credits,
  };
}

// ======================
// PLAN PURCHASE
// ======================

export interface CreatePlanInput {
  teamId: string;
  planTier: PlanTier;
  stripePaymentId: string;
  stripeProductId?: string;
}

export async function createPlan(input: CreatePlanInput): Promise<TeamCommunicationPlan> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error('Not authenticated');

  // Determine purchaser role
  const { data: membership } = await supabase
    .from('team_memberships')
    .select('role')
    .eq('team_id', input.teamId)
    .eq('user_id', user.user.id)
    .eq('is_active', true)
    .single();

  const { data: team } = await supabase
    .from('teams')
    .select('user_id')
    .eq('id', input.teamId)
    .single();

  let purchaserRole: 'owner' | 'coach' | 'team_admin' = 'coach';
  if (team?.user_id === user.user.id) {
    purchaserRole = 'owner';
  } else if (membership?.role === 'team_admin') {
    purchaserRole = 'team_admin';
  }

  // Get tier limits
  const tierLimits: Record<PlanTier, number | null> = {
    rookie: 20,
    varsity: 40,
    all_conference: 60,
    all_state: null,
  };

  const { data, error } = await supabase
    .from('team_communication_plans')
    .insert({
      team_id: input.teamId,
      purchased_by: user.user.id,
      purchaser_role: purchaserRole,
      stripe_payment_id: input.stripePaymentId,
      stripe_product_id: input.stripeProductId,
      plan_tier: input.planTier,
      max_parents: tierLimits[input.planTier],
      max_team_videos: 10,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================
// PLAN UPGRADE
// ======================

export async function upgradePlan(
  currentPlanId: string,
  newTier: PlanTier,
  stripePaymentId: string
): Promise<TeamCommunicationPlan> {
  const supabase = createClient();

  const currentPlan = await getPlanById(currentPlanId);
  if (!currentPlan) throw new Error('Current plan not found');

  // Get tier limits
  const tierLimits: Record<PlanTier, number | null> = {
    rookie: 20,
    varsity: 40,
    all_conference: 60,
    all_state: null,
  };

  // Update current plan with new tier
  const { data, error } = await supabase
    .from('team_communication_plans')
    .update({
      plan_tier: newTier,
      max_parents: tierLimits[newTier],
      stripe_payment_id: stripePaymentId, // New prorated payment
    })
    .eq('id', currentPlanId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================
// VIDEO CREDITS
// ======================

export async function getRemainingVideoCredits(teamId: string): Promise<VideoCredits> {
  const supabase = createClient();

  // Use the database function
  const { data, error } = await supabase.rpc('get_remaining_video_credits', {
    p_team_id: teamId,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return { base_remaining: 0, topup_remaining: 0, total_remaining: 0 };
  }

  return data[0];
}

export async function canShareTeamVideo(teamId: string): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('can_share_team_video', {
    p_team_id: teamId,
  });

  if (error) throw error;
  return data === true;
}

export async function consumeVideoCredit(teamId: string): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('consume_video_credit', {
    p_team_id: teamId,
  });

  if (error) throw error;
  return data === true;
}

// ======================
// VIDEO TOP-UPS
// ======================

export async function purchaseTopup(
  teamId: string,
  stripePaymentId: string
): Promise<VideoTopupPurchase> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error('Not authenticated');

  const plan = await getActivePlan(teamId);
  if (!plan) throw new Error('No active communication plan');

  const { data, error } = await supabase
    .from('video_topup_purchases')
    .insert({
      team_id: teamId,
      communication_plan_id: plan.id,
      purchased_by: user.user.id,
      stripe_payment_id: stripePaymentId,
      videos_added: 5,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTopupHistory(teamId: string): Promise<VideoTopupPurchase[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('video_topup_purchases')
    .select('*')
    .eq('team_id', teamId)
    .order('purchased_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ======================
// COACH STATUS MANAGEMENT
// ======================

export async function setGracePeriod(planId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('team_communication_plans')
    .update({
      coach_override_status: 'grace_period',
      grace_period_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
    })
    .eq('id', planId);

  if (error) throw error;
}

export async function setLimitedMode(planId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('team_communication_plans')
    .update({
      coach_override_status: 'limited',
      grace_period_ends_at: null,
    })
    .eq('id', planId);

  if (error) throw error;
}

export async function restoreFullAccess(planId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('team_communication_plans')
    .update({
      coach_override_status: null,
      grace_period_ends_at: null,
    })
    .eq('id', planId);

  if (error) throw error;
}

// ======================
// PLAN EXPIRATION
// ======================

export async function expirePlan(planId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('team_communication_plans')
    .update({ status: 'expired' })
    .eq('id', planId);

  if (error) throw error;
}

export async function getExpiringPlans(daysAhead: number = 30): Promise<TeamCommunicationPlan[]> {
  const supabase = createClient();

  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('team_communication_plans')
    .select('*')
    .eq('status', 'active')
    .gt('expires_at', now)
    .lt('expires_at', futureDate);

  if (error) throw error;
  return data || [];
}

export async function getExpiredPlansForCleanup(): Promise<TeamCommunicationPlan[]> {
  const supabase = createClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('team_communication_plans')
    .select('*')
    .eq('status', 'active')
    .lt('expires_at', now);

  if (error) throw error;
  return data || [];
}
