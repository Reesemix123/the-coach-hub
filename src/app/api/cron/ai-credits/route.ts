// /api/cron/ai-credits - Scheduled job for AI credit maintenance
// Handles:
// - Creating new credit periods for teams with expired periods
// - Checking and creating credit warning alerts
// - Should be called via cron job (e.g., Vercel cron, external scheduler)

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use service role for cron jobs (no user auth)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/cron/ai-credits
 * Called by cron scheduler to:
 * 1. Create new credit periods for teams whose periods have ended
 * 2. Check all teams for credit warnings (80%+ usage)
 *
 * Security: Requires CRON_SECRET header to match env variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron not configured' },
      { status: 500 }
    );
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const results = {
    periods_created: 0,
    warnings_created: 0,
    errors: [] as string[]
  };

  try {
    // =========================================================================
    // Step 1: Find teams with expired credit periods and active subscriptions
    // =========================================================================
    const now = new Date();

    // Get all active AI-powered subscriptions
    const { data: activeSubscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('team_id, tier, current_period_end')
      .eq('tier', 'ai_powered')
      .in('status', ['active', 'trialing']);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      results.errors.push(`Failed to fetch subscriptions: ${subError.message}`);
    } else if (activeSubscriptions) {
      // Check each team for expired credit period
      for (const sub of activeSubscriptions) {
        // Get current credit period
        const { data: currentPeriod } = await supabaseAdmin
          .from('ai_credits')
          .select('*')
          .eq('team_id', sub.team_id)
          .lte('period_start', now.toISOString())
          .gte('period_end', now.toISOString())
          .order('period_start', { ascending: false })
          .limit(1)
          .single();

        // If no current period, create one
        if (!currentPeriod) {
          // Determine period based on subscription's billing cycle
          // Default to monthly period starting now
          const periodStart = new Date();
          periodStart.setHours(0, 0, 0, 0);

          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Get tier config for credit allocation
          const { data: tierConfig } = await supabaseAdmin
            .from('platform_config')
            .select('value')
            .eq('key', `tier_config_${sub.tier}`)
            .single();

          const creditsAllowed = tierConfig?.value?.ai_credits || 1000;

          const { error: insertError } = await supabaseAdmin
            .from('ai_credits')
            .insert({
              team_id: sub.team_id,
              credits_allowed: creditsAllowed,
              credits_used: 0,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString()
            });

          if (insertError) {
            console.error(`Failed to create credit period for team ${sub.team_id}:`, insertError);
            results.errors.push(`Failed to create period for team ${sub.team_id}`);
          } else {
            results.periods_created++;
          }
        }
      }
    }

    // =========================================================================
    // Step 2: Check all teams for credit warnings
    // =========================================================================
    const { data: warningResults, error: warningError } = await supabaseAdmin
      .rpc('check_credit_warnings');

    if (warningError) {
      console.error('Error checking credit warnings:', warningError);
      results.errors.push(`Failed to check warnings: ${warningError.message}`);
    } else if (warningResults) {
      results.warnings_created = warningResults.filter(
        (r: { alert_id: string | null }) => r.alert_id !== null
      ).length;
    }

  } catch (error) {
    console.error('Cron job error:', error);
    results.errors.push(`Unexpected error: ${error}`);
  }

  // Return results
  return NextResponse.json({
    success: results.errors.length === 0,
    timestamp: new Date().toISOString(),
    ...results
  });
}

/**
 * POST /api/cron/ai-credits
 * Manual trigger for testing (requires admin auth)
 *
 * Request body:
 * {
 *   action: 'check_warnings' | 'reset_periods' | 'all'
 * }
 */
export async function POST(request: NextRequest) {
  // Verify cron secret OR admin auth
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // Allow cron secret
  if (cronSecret === expectedSecret) {
    // Re-use GET logic
    return GET(request);
  }

  // Otherwise require admin auth
  const supabase = await (await import('@/utils/supabase/server')).createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check if user is platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  // Parse action
  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    body = { action: 'all' };
  }

  const action = body.action || 'all';
  const results = {
    action,
    periods_created: 0,
    warnings_created: 0,
    errors: [] as string[]
  };

  try {
    if (action === 'check_warnings' || action === 'all') {
      const { data: warningResults, error: warningError } = await supabaseAdmin
        .rpc('check_credit_warnings');

      if (warningError) {
        results.errors.push(`Warning check failed: ${warningError.message}`);
      } else if (warningResults) {
        results.warnings_created = warningResults.filter(
          (r: { alert_id: string | null }) => r.alert_id !== null
        ).length;
      }
    }

    if (action === 'reset_periods' || action === 'all') {
      // This would trigger period reset logic
      // For now, just document that it's available
      // Actual reset happens via Stripe webhook on subscription renewal
      results.errors.push('Period reset is handled by Stripe webhook');
    }

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`);
  }

  return NextResponse.json({
    success: results.errors.length === 0,
    ...results
  });
}
