// /api/admin/billing/failed-payments - Failed Payments API
// Returns list of failed invoice payments for admin action
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface FailedPayment {
  id: string;
  organization_id: string;
  organization_name: string;
  owner_email: string;
  team_name: string | null;
  amount: number;
  failed_at: string;
  stripe_invoice_id: string | null;
  last_error: string | null;
}

interface FailedPaymentsResponse {
  failed_payments: FailedPayment[];
}

/**
 * GET /api/admin/billing/failed-payments
 * Returns list of failed invoice payments
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;

  try {
    // Get failed invoices with organization info
    // Status 'open' with past due_date or explicit 'uncollectible' status indicates failed payment
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        organization_id,
        stripe_invoice_id,
        amount_cents,
        status,
        invoice_date,
        due_date,
        created_at,
        organizations!inner (
          id,
          name,
          owner_user_id
        )
      `)
      .in('status', ['open', 'uncollectible'])
      .order('created_at', { ascending: false });

    if (invoiceError) throw invoiceError;

    // Also check for past_due subscriptions
    const { data: pastDueSubs, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        team_id,
        tier,
        status,
        updated_at,
        teams!inner (
          id,
          name,
          organization_id,
          organizations (
            id,
            name,
            owner_user_id
          )
        )
      `)
      .eq('status', 'past_due');

    if (subError) throw subError;

    // Collect all owner_user_ids to fetch emails in a single query
    const ownerIds = new Set<string>();
    for (const invoice of invoices || []) {
      const org = invoice.organizations as { owner_user_id: string };
      if (org?.owner_user_id) ownerIds.add(org.owner_user_id);
    }
    for (const sub of pastDueSubs || []) {
      const team = sub.teams as { organizations?: { owner_user_id: string } | null };
      if (team?.organizations?.owner_user_id) ownerIds.add(team.organizations.owner_user_id);
    }

    // Fetch owner emails from profiles
    const ownerEmails: Record<string, string> = {};
    if (ownerIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(ownerIds));

      for (const profile of profiles || []) {
        ownerEmails[profile.id] = profile.email;
      }
    }

    const failedPayments: FailedPayment[] = [];

    // Process failed invoices
    for (const invoice of invoices || []) {
      // Check if due_date has passed for 'open' invoices
      if (invoice.status === 'open' && invoice.due_date) {
        const dueDate = new Date(invoice.due_date);
        if (dueDate > new Date()) continue; // Not past due yet
      }

      const org = invoice.organizations as {
        id: string;
        name: string;
        owner_user_id: string;
      };

      failedPayments.push({
        id: invoice.id,
        organization_id: invoice.organization_id,
        organization_name: org?.name || 'Unknown',
        owner_email: ownerEmails[org?.owner_user_id] || 'Unknown',
        team_name: null, // Invoices are at org level
        amount: Math.round(invoice.amount_cents / 100),
        failed_at: invoice.due_date || invoice.created_at,
        stripe_invoice_id: invoice.stripe_invoice_id,
        last_error: invoice.status === 'uncollectible' ? 'payment_failed' : 'past_due'
      });
    }

    // Process past_due subscriptions (these may not have invoices yet)
    for (const sub of pastDueSubs || []) {
      const team = sub.teams as {
        id: string;
        name: string;
        organization_id: string | null;
        organizations: {
          id: string;
          name: string;
          owner_user_id: string;
        } | null;
      };

      // Skip if we already have a failed invoice for this org
      const orgId = team?.organization_id || team?.organizations?.id;
      if (orgId && failedPayments.some(fp => fp.organization_id === orgId)) {
        continue;
      }

      failedPayments.push({
        id: sub.id,
        organization_id: orgId || '',
        organization_name: team?.organizations?.name || 'Unknown',
        owner_email: ownerEmails[team?.organizations?.owner_user_id || ''] || 'Unknown',
        team_name: team?.name || 'Unknown',
        amount: 0, // Unknown until invoice is created
        failed_at: sub.updated_at,
        stripe_invoice_id: null,
        last_error: 'subscription_past_due'
      });
    }

    // Sort by failed_at descending
    failedPayments.sort((a, b) =>
      new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime()
    );

    const response: FailedPaymentsResponse = {
      failed_payments: failedPayments
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching failed payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch failed payments' },
      { status: 500 }
    );
  }
}
