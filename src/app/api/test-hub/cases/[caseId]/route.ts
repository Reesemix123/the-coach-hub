/**
 * API: GET /api/test-hub/cases/[caseId]
 * Returns a single test case with its setup and test steps.
 * Admin only.
 *
 * API: PATCH /api/test-hub/cases/[caseId]
 * Updates test case metadata (title, description, category, status, suite_id).
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { CaseStatus } from '@/types/test-hub';

interface RouteContext {
  params: Promise<{ caseId: string }>;
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
// GET — single test case with its steps
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: testCase, error: caseError } = await supabase
      .from('test_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const { data: steps, error: stepsError } = await supabase
      .from('test_steps')
      .select('*')
      .eq('test_case_id', caseId)
      .order('display_order', { ascending: true });

    if (stepsError) {
      console.error('Failed to fetch test steps:', stepsError);
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
    }

    return NextResponse.json({ ...testCase, steps: steps ?? [] });
  } catch (error) {
    console.error('GET /api/test-hub/cases/[caseId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update test case fields
// ---------------------------------------------------------------------------

interface UpdateCaseBody {
  title?: string;
  description?: string;
  category?: string;
  status?: CaseStatus;
  suite_id?: string;
  source_feature_key?: string | null;
}

const VALID_STATUSES: CaseStatus[] = ['draft', 'pending_review', 'active', 'archived'];

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return authError;

    const body: UpdateCaseBody = await request.json();

    // Build update object from only the provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
      }
      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    if (body.category !== undefined) {
      updates.category = body.category;
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

    if (body.suite_id !== undefined) {
      updates.suite_id = body.suite_id;
    }

    if (body.source_feature_key !== undefined) {
      updates.source_feature_key = body.source_feature_key;
    }

    const { data: testCase, error: updateError } = await supabase
      .from('test_cases')
      .update(updates)
      .eq('id', caseId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update test case:', updateError);
      return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
    }

    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('PATCH /api/test-hub/cases/[caseId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
