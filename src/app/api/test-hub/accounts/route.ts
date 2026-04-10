/**
 * API: POST /api/test-hub/accounts
 * Creates one or more test accounts for a suite.
 * Coach accounts automatically get an empty team. Accounts are created serially.
 * Admin only.
 *
 * Body: { suiteId: string, accounts: Array<{ type: 'coach' | 'parent', label: string }> }
 * Returns: { accounts: TestAccount[] } with status 201
 *
 * API: GET /api/test-hub/accounts?suiteId=<uuid>
 * Returns all test accounts for a suite.
 * Tester + admin access (RLS handles enforcement).
 *
 * Returns: { accounts: TestAccount[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import type { TestAccount, TestAccountType } from '@/types/test-hub';

// ---------------------------------------------------------------------------
// Request body shapes
// ---------------------------------------------------------------------------

interface AccountSpec {
  type: TestAccountType;
  label: string;
}

interface CreateAccountsBody {
  suiteId: string;
  accounts: AccountSpec[];
}

// ---------------------------------------------------------------------------
// GET handler — list accounts for a suite
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const suiteId = searchParams.get('suiteId');

    if (!suiteId) {
      return NextResponse.json({ error: 'suiteId query param is required' }, { status: 400 });
    }

    // RLS on test_accounts allows both testers and admins to select — no admin check needed here
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('test_accounts')
      .select('*')
      .eq('suite_id', suiteId)
      .order('created_at');

    if (error) {
      console.error('Failed to fetch test accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    return NextResponse.json({ accounts: accounts ?? [] });
  } catch (error) {
    console.error('GET /api/test-hub/accounts error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST handler — create test accounts
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate body
    const body: CreateAccountsBody = await request.json();

    if (!body.suiteId || typeof body.suiteId !== 'string') {
      return NextResponse.json({ error: 'suiteId is required' }, { status: 400 });
    }

    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      return NextResponse.json({ error: 'accounts must be a non-empty array' }, { status: 400 });
    }

    // Validate email base env var up front before doing any work
    const emailBase = process.env.TEST_ACCOUNT_EMAIL_BASE;
    if (!emailBase) {
      return NextResponse.json({ error: 'TEST_ACCOUNT_EMAIL_BASE not configured' }, { status: 500 });
    }

    const serviceClient = createServiceClient();

    // Fetch the suite name once for use in team naming
    const { data: suite } = await serviceClient
      .from('test_suites')
      .select('name')
      .eq('id', body.suiteId)
      .single();

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    const [localPart, domain] = emailBase.split('@');
    const created: TestAccount[] = [];

    // Process accounts serially — auth user creation should not be parallelized
    for (const account of body.accounts) {
      if (!account.type || !['coach', 'parent'].includes(account.type)) {
        return NextResponse.json(
          { error: `Invalid account type: ${account.type}` },
          { status: 400 }
        );
      }

      if (!account.label || typeof account.label !== 'string' || account.label.trim() === '') {
        return NextResponse.json({ error: 'Each account must have a label' }, { status: 400 });
      }

      // Generate unique email using a short UUID slice
      const shortId = crypto.randomUUID().slice(0, 6);
      const email = `${localPart}+${account.type}-${shortId}@${domain}`;
      const password = `test${account.type}`;

      // 1. Create the auth user
      const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        throw new Error(`Failed to create auth user: ${authError?.message ?? 'unknown error'}`);
      }

      // 2. Optionally create a team for coach accounts
      let teamId: string | null = null;
      let teamName: string | null = null;

      if (account.type === 'coach') {
        teamName = `${suite.name} Team`;

        const { data: team } = await serviceClient
          .from('teams')
          .insert({
            name: teamName,
            sport: 'football',
            level: 'Youth',
            colors: { primary: '#000000', secondary: '#FFFFFF' },
            user_id: authUser.user.id,
            default_tier: 'basic',
          })
          .select('id')
          .single();

        teamId = team?.id ?? null;
      }

      // 3. Insert into test_accounts
      const { data: testAccount, error: insertError } = await serviceClient
        .from('test_accounts')
        .insert({
          suite_id: body.suiteId,
          auth_user_id: authUser.user.id,
          account_type: account.type,
          label: account.label.trim(),
          email,
          password,
          team_id: teamId,
          team_name: teamName,
        })
        .select()
        .single();

      if (insertError || !testAccount) {
        throw new Error(`Failed to insert test account: ${insertError?.message ?? 'unknown error'}`);
      }

      created.push(testAccount as TestAccount);
    }

    return NextResponse.json({ accounts: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-hub/accounts error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
