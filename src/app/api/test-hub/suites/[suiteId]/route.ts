/**
 * API: GET /api/test-hub/suites/[suiteId]
 * Returns a single suite with its test cases.
 * Admin only.
 *
 * API: PATCH /api/test-hub/suites/[suiteId]
 * Updates a suite's name, description, or status.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SuiteStatus } from '@/types/test-hub';

interface RouteContext {
  params: Promise<{ suiteId: string }>;
}

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
// GET — single suite with its test cases
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { suiteId } = await context.params;
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: suite, error: suiteError } = await supabase
      .from('test_suites')
      .select('*')
      .eq('id', suiteId)
      .single();

    if (suiteError || !suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    const { data: cases, error: casesError } = await supabase
      .from('test_cases')
      .select('*')
      .eq('suite_id', suiteId)
      .order('display_order', { ascending: true });

    if (casesError) {
      console.error('Failed to fetch test cases for suite:', casesError);
      return NextResponse.json({ error: 'Failed to fetch test cases' }, { status: 500 });
    }

    return NextResponse.json({ ...suite, cases: cases ?? [] });
  } catch (error) {
    console.error('GET /api/test-hub/suites/[suiteId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update suite fields
// ---------------------------------------------------------------------------

interface UpdateSuiteBody {
  name?: string;
  description?: string;
  status?: SuiteStatus;
}

const VALID_STATUSES: SuiteStatus[] = ['draft', 'active', 'archived'];

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { suiteId } = await context.params;
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return authError;

    const body: UpdateSuiteBody = await request.json();

    // Build update object from only the provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    const { data: suite, error: updateError } = await supabase
      .from('test_suites')
      .update(updates)
      .eq('id', suiteId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update test suite:', updateError);
      return NextResponse.json({ error: 'Failed to update suite' }, { status: 500 });
    }

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    return NextResponse.json(suite);
  } catch (error) {
    console.error('PATCH /api/test-hub/suites/[suiteId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
