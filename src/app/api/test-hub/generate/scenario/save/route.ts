/**
 * API: POST /api/test-hub/generate/scenario/save
 * Persists a scenario suite preview (from /scenario) to the database.
 * Creates a test_suite, a test_case, and all test_steps in one transaction.
 * Admin only.
 *
 * Body: {
 *   suiteName: string,
 *   precondition: string,
 *   category: string,
 *   setupSteps: Array<{ instruction: string; expected_outcome: string | null }>,
 *   testSteps: Array<{ instruction: string; expected_outcome: string | null }>,
 * }
 * Returns: { success: true, suiteId: string, caseId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepInput {
  instruction: string;
  expected_outcome: string | null;
}

interface SaveScenarioBody {
  suiteName?: unknown;
  precondition?: unknown;
  category?: unknown;
  setupSteps?: unknown;
  testSteps?: unknown;
}

// ---------------------------------------------------------------------------
// Route handler
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
    const body = await request.json() as SaveScenarioBody;
    const { suiteName, precondition, category, setupSteps, testSteps } = body;

    if (!suiteName || typeof suiteName !== 'string' || !suiteName.trim()) {
      return NextResponse.json({ error: 'suiteName is required' }, { status: 400 });
    }

    if (!precondition || typeof precondition !== 'string' || !precondition.trim()) {
      return NextResponse.json({ error: 'precondition is required' }, { status: 400 });
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    if (!Array.isArray(setupSteps)) {
      return NextResponse.json({ error: 'setupSteps must be an array' }, { status: 400 });
    }

    if (!Array.isArray(testSteps) || testSteps.length === 0) {
      return NextResponse.json({ error: 'testSteps must be a non-empty array' }, { status: 400 });
    }

    // Use service client for all inserts — admin is verified above
    const serviceClient = createServiceClient();

    // 1. Create test_suite
    const { data: suite, error: suiteError } = await serviceClient
      .from('test_suites')
      .insert({
        name: suiteName.trim(),
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (suiteError || !suite) {
      console.error('[scenario/save] Failed to create suite:', suiteError);
      return NextResponse.json({ error: 'Failed to create test suite' }, { status: 500 });
    }

    // 2. Create test_case
    const { data: testCase, error: caseError } = await serviceClient
      .from('test_cases')
      .insert({
        suite_id: suite.id,
        title: suiteName.trim(),
        description: precondition.trim(),
        category: category.trim(),
        precondition: precondition.trim(),
        status: 'pending_review',
        auto_generated: true,
      })
      .select('id')
      .single();

    if (caseError || !testCase) {
      console.error('[scenario/save] Failed to create test case:', caseError);
      return NextResponse.json({ error: 'Failed to create test case' }, { status: 500 });
    }

    // 3. Build step rows — setup steps first, then test steps
    const typedSetupSteps = setupSteps as StepInput[];
    const typedTestSteps = testSteps as StepInput[];

    const stepRows = [
      ...typedSetupSteps.map((step, i) => ({
        test_case_id: testCase.id,
        step_type: 'setup' as const,
        display_order: i + 1,
        instruction: step.instruction,
        expected_outcome: step.expected_outcome ?? null,
      })),
      ...typedTestSteps.map((step, i) => ({
        test_case_id: testCase.id,
        step_type: 'test' as const,
        display_order: i + 1,
        instruction: step.instruction,
        expected_outcome: step.expected_outcome ?? null,
      })),
    ];

    if (stepRows.length > 0) {
      const { error: stepsError } = await serviceClient
        .from('test_steps')
        .insert(stepRows);

      if (stepsError) {
        console.error('[scenario/save] Failed to create steps:', stepsError);
        return NextResponse.json({ error: 'Failed to create test steps' }, { status: 500 });
      }
    }

    return NextResponse.json(
      { success: true, suiteId: suite.id, caseId: testCase.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/test-hub/generate/scenario/save error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
