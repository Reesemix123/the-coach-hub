// /api/cron/ai-credits - Scheduled job for AI credit maintenance
// NOTE: This cron job is legacy and may be deprecated.
// The original AI credits system (video minutes, text actions) has been simplified.
// This file is kept for reference but the ai_powered tier no longer exists.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables not configured');
    }
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return supabaseAdmin;
}

/**
 * GET /api/cron/ai-credits
 * Called by cron scheduler to check for any credit-related maintenance
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
    message: 'AI credits cron job executed',
    warnings_checked: 0,
    errors: [] as string[]
  };

  try {
    // Check for any credit warnings (if the function exists)
    const { data: warningResults, error: warningError } = await getSupabaseAdmin()
      .rpc('check_credit_warnings');

    if (warningError) {
      // Function may not exist - that's OK
      console.log('Credit warnings check skipped:', warningError.message);
    } else if (warningResults) {
      results.warnings_checked = warningResults.filter(
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
 */
export async function POST(request: NextRequest) {
  // Verify cron secret OR admin auth
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // Allow cron secret
  if (cronSecret === expectedSecret) {
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

  // Just run the same logic as GET
  return GET(request);
}
