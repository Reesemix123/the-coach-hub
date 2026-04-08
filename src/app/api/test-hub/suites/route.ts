/**
 * API: GET /api/test-hub/suites
 * Returns all test suites with per-suite test case counts.
 * Admin only.
 *
 * API: POST /api/test-hub/suites
 * Creates a new test suite.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SuiteStatus } from '@/types/test-hub';

// ---------------------------------------------------------------------------
// Shared admin auth helper
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return { user: null, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, supabase, error: null };
}

// ---------------------------------------------------------------------------
// GET — list all suites with case counts
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: suites, error: suitesError } = await supabase
      .from('test_suites')
      .select('*')
      .order('created_at', { ascending: false });

    if (suitesError) {
      console.error('Failed to fetch test suites:', suitesError);
      return NextResponse.json({ error: 'Failed to fetch suites' }, { status: 500 });
    }

    if (!suites || suites.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch case counts for all suites in two queries (total and pending_review)
    const suiteIds = suites.map((s) => s.id);

    const { data: allCases } = await supabase
      .from('test_cases')
      .select('suite_id, status')
      .in('suite_id', suiteIds);

    const caseCountMap: Record<string, number> = {};
    const pendingCountMap: Record<string, number> = {};

    for (const tc of allCases ?? []) {
      caseCountMap[tc.suite_id] = (caseCountMap[tc.suite_id] ?? 0) + 1;
      if (tc.status === 'pending_review') {
        pendingCountMap[tc.suite_id] = (pendingCountMap[tc.suite_id] ?? 0) + 1;
      }
    }

    const result = suites.map((suite) => ({
      ...suite,
      case_count: caseCountMap[suite.id] ?? 0,
      pending_count: pendingCountMap[suite.id] ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/test-hub/suites error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new suite
// ---------------------------------------------------------------------------

interface CreateSuiteBody {
  name: string;
  description?: string;
  sport?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase, error: authError } = await requireAdmin();
    if (authError || !user) return authError!;

    const body: CreateSuiteBody = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data: suite, error: insertError } = await supabase
      .from('test_suites')
      .insert({
        name: body.name.trim(),
        description: body.description ?? null,
        sport: body.sport ?? 'football',
        status: 'draft' as SuiteStatus,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create test suite:', insertError);
      return NextResponse.json({ error: 'Failed to create suite' }, { status: 500 });
    }

    return NextResponse.json(suite, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-hub/suites error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
