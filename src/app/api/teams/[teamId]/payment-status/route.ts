// /api/teams/:teamId/payment-status - Get payment status for warning banners
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const GRACE_PERIOD_DAYS = 7;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Get subscription with payment status fields
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('status, billing_waived, past_due_since, payment_suspended')
    .eq('team_id', teamId)
    .single();

  if (subError || !subscription) {
    return NextResponse.json({
      status: 'none',
      gracePeriodDaysRemaining: null,
      pastDueSince: null
    });
  }

  // If billing is waived, always current
  if (subscription.billing_waived) {
    return NextResponse.json({
      status: 'current',
      gracePeriodDaysRemaining: null,
      pastDueSince: null
    });
  }

  // If payment is suspended, return suspended status
  if (subscription.payment_suspended) {
    return NextResponse.json({
      status: 'suspended',
      gracePeriodDaysRemaining: 0,
      pastDueSince: subscription.past_due_since
    });
  }

  // If past_due, calculate grace period remaining
  if (subscription.status === 'past_due' && subscription.past_due_since) {
    const pastDueDate = new Date(subscription.past_due_since);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - pastDueDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysPassed);

    // If grace period expired, mark as suspended
    if (daysRemaining === 0) {
      // Update the subscription to mark as suspended
      await supabase
        .from('subscriptions')
        .update({
          payment_suspended: true,
          payment_suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('team_id', teamId);

      return NextResponse.json({
        status: 'suspended',
        gracePeriodDaysRemaining: 0,
        pastDueSince: subscription.past_due_since
      });
    }

    return NextResponse.json({
      status: 'past_due',
      gracePeriodDaysRemaining: daysRemaining,
      pastDueSince: subscription.past_due_since
    });
  }

  // Otherwise, payment is current
  return NextResponse.json({
    status: 'current',
    gracePeriodDaysRemaining: null,
    pastDueSince: null
  });
}
