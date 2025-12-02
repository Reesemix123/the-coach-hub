// /api/admin/billing/retry-payment/[invoiceId] - Retry Payment API
// Initiates a payment retry for a failed invoice via Stripe
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

interface RouteParams {
  params: Promise<{ invoiceId: string }>;
}

/**
 * POST /api/admin/billing/retry-payment/[invoiceId]
 * Retries payment for a failed Stripe invoice
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { invoiceId } = await params;
  const supabase = auth.serviceClient;

  try {
    // Get invoice from database
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        organization_id,
        stripe_invoice_id,
        status,
        amount_cents,
        organizations (
          name
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Invoice already paid' },
        { status: 400 }
      );
    }

    // Check if we have a Stripe invoice ID
    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { success: false, error: 'No Stripe invoice ID - cannot retry payment' },
        { status: 400 }
      );
    }

    // Check for Stripe API key
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // Log the attempt even if we can't process it
      await logAdminAction(
        auth.admin.id,
        auth.admin.email,
        'billing.payment_retry_attempted',
        'invoice',
        invoice.id,
        invoice.stripe_invoice_id,
        {
          error: 'Stripe not configured',
          amount_cents: invoice.amount_cents
        }
      );

      return NextResponse.json(
        { success: false, error: 'Stripe payment processing not configured' },
        { status: 503 }
      );
    }

    // Import Stripe dynamically to avoid errors if not installed
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);

      // Retrieve the invoice from Stripe
      const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);

      if (stripeInvoice.status === 'paid') {
        // Update our database if Stripe shows paid
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', invoice.id);

        return NextResponse.json({
          success: true,
          message: 'Invoice was already paid in Stripe'
        });
      }

      if (stripeInvoice.status === 'void') {
        return NextResponse.json(
          { success: false, error: 'Invoice has been voided' },
          { status: 400 }
        );
      }

      // Attempt to pay the invoice
      const paidInvoice = await stripe.invoices.pay(invoice.stripe_invoice_id);

      // Update invoice status in database
      if (paidInvoice.status === 'paid') {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', invoice.id);

        // Also update subscription status if applicable
        if (paidInvoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', paidInvoice.subscription);
        }
      }

      // Log the successful retry
      await logAdminAction(
        auth.admin.id,
        auth.admin.email,
        'billing.payment_retried',
        'invoice',
        invoice.id,
        invoice.stripe_invoice_id,
        {
          amount_cents: invoice.amount_cents,
          organization_name: (invoice.organizations as { name: string } | null)?.name,
          result: paidInvoice.status
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Payment retry initiated',
        status: paidInvoice.status
      });

    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe error';

      // Log the failed retry
      await logAdminAction(
        auth.admin.id,
        auth.admin.email,
        'billing.payment_retry_failed',
        'invoice',
        invoice.id,
        invoice.stripe_invoice_id,
        {
          amount_cents: invoice.amount_cents,
          error: errorMessage
        }
      );

      return NextResponse.json(
        { success: false, error: `Payment retry failed: ${errorMessage}` },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error retrying payment:', error);
    return NextResponse.json(
      { error: 'Failed to retry payment' },
      { status: 500 }
    );
  }
}
