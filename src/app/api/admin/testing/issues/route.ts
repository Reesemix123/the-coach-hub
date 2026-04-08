// /api/admin/testing/issues - List Flagged Issues API
// Returns all flagged test step completions, enriched with step, test case,
// and tester information. Supports filtering by status, category, and tester.
// Requires platform admin authentication.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface StepCompletion {
  id: string;
  session_id: string;
  step_id: string;
  flagged_issue: boolean;
  notes: string | null;
  resolution_status: string | null;
  admin_notes: string | null;
  completed_at: string | null;
}

interface TestStep {
  id: string;
  test_case_id: string;
  instruction: string | null;
  expected_outcome: string | null;
}

interface TestSession {
  id: string;
  tester_id: string;
}

interface TesterProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface TestCase {
  id: string;
  title: string | null;
  category: string | null;
}

/**
 * GET /api/admin/testing/issues
 * Returns all flagged test step completions with enriched context.
 *
 * Query params:
 * - status: 'open' | 'resolved' | 'wont_fix' (optional filter)
 * - category: string (optional — filters by test case category)
 * - testerId: string (optional — filters by tester user ID)
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { serviceClient } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');
    const testerIdFilter = searchParams.get('testerId');

    // Step 1: Fetch all flagged step completions
    let completionsQuery = serviceClient
      .from('test_step_completions')
      .select('id, session_id, step_id, flagged_issue, notes, resolution_status, admin_notes, completed_at')
      .eq('flagged_issue', true)
      .order('completed_at', { ascending: false });

    if (statusFilter) {
      completionsQuery = completionsQuery.eq('resolution_status', statusFilter);
    }

    const { data: completions, error: completionsError } = await completionsQuery;

    if (completionsError) {
      console.error('Failed to fetch flagged completions:', completionsError);
      return NextResponse.json(
        { error: 'Failed to fetch issues' },
        { status: 500 }
      );
    }

    const completionList = (completions ?? []) as StepCompletion[];

    if (completionList.length === 0) {
      return NextResponse.json({ issues: [] });
    }

    const stepIds = [...new Set(completionList.map((c) => c.step_id))];
    const sessionIds = [...new Set(completionList.map((c) => c.session_id))];

    // Step 2: Fetch test steps
    const { data: steps } = await serviceClient
      .from('test_steps')
      .select('id, test_case_id, instruction, expected_outcome')
      .in('id', stepIds);

    const stepList = (steps ?? []) as TestStep[];
    const stepMap = new Map<string, TestStep>();
    for (const step of stepList) {
      stepMap.set(step.id, step);
    }

    // Step 3: Fetch sessions to get tester IDs
    const { data: sessions } = await serviceClient
      .from('test_sessions')
      .select('id, tester_id')
      .in('id', sessionIds);

    const sessionList = (sessions ?? []) as TestSession[];
    const sessionMap = new Map<string, TestSession>();
    for (const session of sessionList) {
      sessionMap.set(session.id, session);
    }

    let testerIds = [...new Set(sessionList.map((s) => s.tester_id))];

    // Apply tester filter before profile fetch if provided
    if (testerIdFilter) {
      testerIds = testerIds.filter((id) => id === testerIdFilter);
    }

    // Step 4: Fetch tester profiles
    let profileMap = new Map<string, TesterProfile>();
    if (testerIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, email, full_name')
        .in('id', testerIds);

      for (const profile of (profiles ?? []) as TesterProfile[]) {
        profileMap.set(profile.id, profile);
      }
    }

    // Step 5: Fetch test cases (via step → test_case_id)
    const testCaseIds = [...new Set(stepList.map((s) => s.test_case_id))];
    let testCaseMap = new Map<string, TestCase>();

    if (testCaseIds.length > 0) {
      let testCasesQuery = serviceClient
        .from('test_cases')
        .select('id, title, category')
        .in('id', testCaseIds);

      if (categoryFilter) {
        testCasesQuery = testCasesQuery.eq('category', categoryFilter);
      }

      const { data: testCases } = await testCasesQuery;

      for (const tc of (testCases ?? []) as TestCase[]) {
        testCaseMap.set(tc.id, tc);
      }
    }

    // Step 6: Combine everything
    const issues = completionList
      .map((completion) => {
        const step = stepMap.get(completion.step_id);
        const session = sessionMap.get(completion.session_id);
        const tester = session ? profileMap.get(session.tester_id) : undefined;
        const testCase = step ? testCaseMap.get(step.test_case_id) : undefined;

        // Skip records that were filtered out by category or tester
        if (!testCase) return null;
        if (testerIdFilter && session?.tester_id !== testerIdFilter) return null;

        return {
          completion_id: completion.id,
          step_instruction: step?.instruction ?? null,
          step_expected_outcome: step?.expected_outcome ?? null,
          test_case_title: testCase.title ?? null,
          test_case_category: testCase.category ?? null,
          tester_name: tester?.full_name ?? null,
          tester_email: tester?.email ?? null,
          notes: completion.notes,
          resolution_status: completion.resolution_status ?? 'open',
          admin_notes: completion.admin_notes,
          flagged_at: completion.completed_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ issues });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: 'Server error while fetching issues' },
      { status: 500 }
    );
  }
}
