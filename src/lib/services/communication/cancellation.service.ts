/**
 * Cancellation Service
 * Manages the communication plan lifecycle: active → grace period → limited mode.
 *
 * State machine:
 *   active          — plan is valid and not expired
 *   grace_period    — plan expired; 30-day window where all features still work
 *   limited         — grace period ended; coach cannot create content, parents can still view
 *   no_plan         — no plan record exists at all
 *
 * Transitions are written back to `team_communication_plans` so the DB stays
 * authoritative. Callers should treat the returned status as the source of
 * truth rather than reading `coach_override_status` directly.
 */

import { createClient } from '@/utils/supabase/server';
import type { CoachOverrideStatus } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

export interface PlanLifecycleStatus {
  /** Current lifecycle state. */
  status: 'active' | 'grace_period' | 'limited' | 'no_plan';
  /** Days remaining in the current state (null when not applicable). */
  daysRemaining: number | null;
  /** ISO timestamp when the grace period ends (null when not in grace period). */
  gracePeriodEndsAt: string | null;
  /** Whether the coach can create new announcements, videos, or reports. */
  canCreateContent: boolean;
  /** Whether parents can view existing content. */
  canViewContent: boolean;
  /** Human-readable message to surface in the UI. null when no message needed. */
  message: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const GRACE_PERIOD_DAYS = 30;
const EXPIRY_WARNING_DAYS = 14;
const MS_PER_DAY = 86_400_000;

// ============================================================================
// Helpers
// ============================================================================

function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.ceil((date.getTime() - from.getTime()) / MS_PER_DAY);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns the current lifecycle status of a team's communication plan.
 *
 * This function also performs lazy state transitions: if the plan has expired
 * but hasn't been moved to grace_period yet, it will do so. If the grace
 * period has ended, it will move the plan to limited/expired. These writes
 * are fire-and-forget within the same request — callers always receive the
 * freshly computed status.
 *
 * @param teamId - The team identifier to check.
 * @returns A PlanLifecycleStatus describing what the team can currently do.
 */
export async function getPlanLifecycleStatus(teamId: string): Promise<PlanLifecycleStatus> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('team_communication_plans')
    .select(
      'id, status, expires_at, coach_override_status, grace_period_ends_at'
    )
    .eq('team_id', teamId)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── No plan ──────────────────────────────────────────────────────────────
  if (!plan) {
    return {
      status: 'no_plan',
      daysRemaining: null,
      gracePeriodEndsAt: null,
      canCreateContent: false,
      canViewContent: false,
      message: 'No communication plan. Purchase a plan to get started.',
    };
  }

  const now = new Date();
  const expiresAt = new Date(plan.expires_at);
  const overrideStatus = plan.coach_override_status as CoachOverrideStatus | null;

  // ── Already limited (grace period previously ended) ───────────────────────
  if (overrideStatus === 'limited' || plan.status === 'expired') {
    return buildLimitedStatus();
  }

  // ── Plan is actively valid ─────────────────────────────────────────────────
  if (plan.status === 'active' && expiresAt > now) {
    // If already in grace_period override but plan hasn't expired yet — this
    // is an edge case from manual admin overrides. Respect the override.
    if (overrideStatus === 'grace_period' && plan.grace_period_ends_at) {
      return buildGracePeriodStatus(plan.grace_period_ends_at, now);
    }

    const daysLeft = daysUntil(expiresAt, now);
    return {
      status: 'active',
      daysRemaining: daysLeft,
      gracePeriodEndsAt: null,
      canCreateContent: true,
      canViewContent: true,
      message:
        daysLeft <= EXPIRY_WARNING_DAYS
          ? `Plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep all features.`
          : null,
    };
  }

  // ── Grace period already set and still active ─────────────────────────────
  if (overrideStatus === 'grace_period' && plan.grace_period_ends_at) {
    const gracePeriodEnds = new Date(plan.grace_period_ends_at);

    if (gracePeriodEnds > now) {
      return buildGracePeriodStatus(plan.grace_period_ends_at, now);
    }

    // Grace period just ended — transition to limited.
    await supabase
      .from('team_communication_plans')
      .update({
        status: 'expired',
        coach_override_status: 'limited' as CoachOverrideStatus,
      })
      .eq('id', plan.id);

    return buildLimitedStatus();
  }

  // ── Plan expired but no grace period transition yet ───────────────────────
  if (plan.status === 'active' && expiresAt <= now) {
    const gracePeriodEnd = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY);

    await supabase
      .from('team_communication_plans')
      .update({
        coach_override_status: 'grace_period' as CoachOverrideStatus,
        grace_period_ends_at: gracePeriodEnd.toISOString(),
      })
      .eq('id', plan.id);

    const daysLeft = daysUntil(gracePeriodEnd, now);
    return {
      status: 'grace_period',
      daysRemaining: daysLeft,
      gracePeriodEndsAt: gracePeriodEnd.toISOString(),
      canCreateContent: true,
      canViewContent: true,
      message: `Your plan expired. You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} to renew before features are limited.`,
    };
  }

  // ── Catch-all: treat as limited to be safe ────────────────────────────────
  return buildLimitedStatus();
}

/**
 * Guard for API routes that create content (announcements, videos, reports).
 * Returns true only when the plan is active or in grace period.
 *
 * @param teamId - The team identifier to check.
 */
export async function canCreateContent(teamId: string): Promise<boolean> {
  const status = await getPlanLifecycleStatus(teamId);
  return status.canCreateContent;
}

// ============================================================================
// Private helpers
// ============================================================================

function buildGracePeriodStatus(
  gracePeriodEndsAt: string,
  now: Date
): PlanLifecycleStatus {
  const gracePeriodEnds = new Date(gracePeriodEndsAt);
  const daysLeft = daysUntil(gracePeriodEnds, now);
  return {
    status: 'grace_period',
    daysRemaining: daysLeft,
    gracePeriodEndsAt,
    canCreateContent: true,
    canViewContent: true,
    message: `Your plan expired. Grace period ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to avoid losing access.`,
  };
}

function buildLimitedStatus(): PlanLifecycleStatus {
  return {
    status: 'limited',
    daysRemaining: null,
    gracePeriodEndsAt: null,
    canCreateContent: false,
    canViewContent: true,
    message:
      'Your plan has expired. Parents can still view existing content. Purchase a new plan to restore full access.',
  };
}
