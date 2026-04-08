// /api/admin/testing/testers - List Testers API
// Returns all tester profiles enriched with session stats and activity data.
// Requires platform admin authentication.

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface TesterProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_tester: boolean;
  created_at: string;
  last_active_at: string | null;
}

interface SessionRecord {
  tester_id: string;
  status: string;
}

interface StepCompletion {
  session_id: string;
  flagged_issue: boolean;
}

interface ActiveSession {
  tester_id: string;
  test_case_id: string;
}

interface TestCase {
  id: string;
  title: string;
}

interface StepCompletionResult {
  session_id: string;
  status: string;
}

interface SessionIdRecord {
  id: string;
  tester_id: string;
}

interface TimeLogRecord {
  tester_id: string;
  started_at: string;
}

/**
 * GET /api/admin/testing/testers
 * Returns all profiles where is_tester = true, enriched with:
 * - tests_completed: number of sessions with status = 'completed'
 * - issues_flagged: number of step completions with flagged_issue = true
 * - last_active_at: most recent time log entry for the tester
 * - current_checkout: title of the test case currently checked out (active session), or null
 * - pass_rate: percentage of non-pending step completions with status = 'pass', or null if none
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { serviceClient } = auth;

  try {
    // Fetch all tester profiles
    const { data: testers, error: testersError } = await serviceClient
      .from('profiles')
      .select('id, email, full_name, is_tester, created_at, last_active_at')
      .eq('is_tester', true)
      .order('created_at', { ascending: false });

    if (testersError) {
      console.error('Failed to fetch testers:', testersError);
      return NextResponse.json(
        { error: 'Failed to fetch testers' },
        { status: 500 }
      );
    }

    const testerList = (testers ?? []) as TesterProfile[];

    if (testerList.length === 0) {
      return NextResponse.json({ testers: [] });
    }

    const testerIds = testerList.map((t) => t.id);

    // Fetch all sessions for these testers (status for completed count)
    const { data: sessionCounts } = await serviceClient
      .from('test_sessions')
      .select('tester_id, status')
      .in('tester_id', testerIds);

    // Fetch all session IDs for these testers (to map flagged issues)
    const { data: sessions } = await serviceClient
      .from('test_sessions')
      .select('id, tester_id')
      .in('tester_id', testerIds);

    const sessionList = (sessions ?? []) as SessionIdRecord[];
    const sessionIds = sessionList.map((s) => s.id);

    // Fetch flagged step completions, active sessions, and pass-rate completions in parallel
    let flaggedCompletions: StepCompletion[] = [];
    let activeSessionRows: ActiveSession[] = [];
    let stepCompletionResults: StepCompletionResult[] = [];

    if (sessionIds.length > 0) {
      const [flaggedResult, activeResult, stepResult] = await Promise.all([
        serviceClient
          .from('test_step_completions')
          .select('session_id, flagged_issue')
          .eq('flagged_issue', true)
          .in('session_id', sessionIds),
        serviceClient
          .from('test_sessions')
          .select('tester_id, test_case_id')
          .eq('status', 'active')
          .in('tester_id', testerIds),
        serviceClient
          .from('test_step_completions')
          .select('session_id, status')
          .neq('status', 'pending')
          .in('session_id', sessionIds),
      ]);

      flaggedCompletions = (flaggedResult.data ?? []) as StepCompletion[];
      activeSessionRows = (activeResult.data ?? []) as ActiveSession[];
      stepCompletionResults = (stepResult.data ?? []) as StepCompletionResult[];
    }

    // Resolve test_case titles for active checkouts
    const activeCaseIds = [...new Set(activeSessionRows.map((s) => s.test_case_id))];
    let testCaseMap = new Map<string, string>();
    if (activeCaseIds.length > 0) {
      const { data: testCases } = await serviceClient
        .from('test_cases')
        .select('id, title')
        .in('id', activeCaseIds);
      for (const tc of (testCases ?? []) as TestCase[]) {
        testCaseMap.set(tc.id, tc.title);
      }
    }

    // Fetch latest time log entry per tester for "last active" override
    const { data: timeLogs } = await serviceClient
      .from('time_logs')
      .select('tester_id, started_at')
      .in('tester_id', testerIds)
      .order('started_at', { ascending: false });

    const timeLogList = (timeLogs ?? []) as TimeLogRecord[];

    // Build a map: sessionId → tester_id
    const sessionToTester = new Map<string, string>();
    for (const s of sessionList) {
      sessionToTester.set(s.id, s.tester_id);
    }

    // Build a map: tester_id → current checkout title (first active session wins)
    const currentCheckoutMap = new Map<string, string>();
    for (const active of activeSessionRows) {
      if (!currentCheckoutMap.has(active.tester_id)) {
        const title = testCaseMap.get(active.test_case_id) ?? null;
        if (title) {
          currentCheckoutMap.set(active.tester_id, title);
        }
      }
    }

    // Build pass-rate maps: tester_id → { total, passCount }
    const passRateTotals = new Map<string, { total: number; passCount: number }>();
    for (const completion of stepCompletionResults) {
      const testerId = sessionToTester.get(completion.session_id);
      if (!testerId) continue;
      const current = passRateTotals.get(testerId) ?? { total: 0, passCount: 0 };
      current.total += 1;
      if (completion.status === 'pass') {
        current.passCount += 1;
      }
      passRateTotals.set(testerId, current);
    }

    // Build stats maps keyed by tester_id
    const completedCount = new Map<string, number>();
    const issuesCount = new Map<string, number>();
    const lastActiveMap = new Map<string, string>();

    for (const session of (sessionCounts ?? []) as SessionRecord[]) {
      if (session.status === 'completed') {
        completedCount.set(
          session.tester_id,
          (completedCount.get(session.tester_id) ?? 0) + 1
        );
      }
    }

    for (const completion of flaggedCompletions) {
      const testerId = sessionToTester.get(completion.session_id);
      if (testerId) {
        issuesCount.set(testerId, (issuesCount.get(testerId) ?? 0) + 1);
      }
    }

    // Use the most recent started_at from time_logs as the activity signal
    // (only set the first occurrence per tester since results are DESC ordered)
    for (const log of timeLogList) {
      if (!lastActiveMap.has(log.tester_id)) {
        lastActiveMap.set(log.tester_id, log.started_at);
      }
    }

    const enrichedTesters = testerList.map((tester) => {
      const passRateData = passRateTotals.get(tester.id);
      const pass_rate =
        passRateData && passRateData.total > 0
          ? Math.round((passRateData.passCount / passRateData.total) * 100)
          : null;

      return {
        id: tester.id,
        email: tester.email,
        full_name: tester.full_name,
        created_at: tester.created_at,
        last_active_at: lastActiveMap.get(tester.id) ?? tester.last_active_at ?? null,
        tests_completed: completedCount.get(tester.id) ?? 0,
        issues_flagged: issuesCount.get(tester.id) ?? 0,
        current_checkout: currentCheckoutMap.get(tester.id) ?? null,
        pass_rate,
      };
    });

    return NextResponse.json({ testers: enrichedTesters });
  } catch (error) {
    console.error('Error fetching testers:', error);
    return NextResponse.json(
      { error: 'Server error while fetching testers' },
      { status: 500 }
    );
  }
}
