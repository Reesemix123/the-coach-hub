// /api/admin/testing/active-checkouts - Active Test Session Checkouts API
// Returns all currently active test sessions enriched with tester info,
// test case details, suite name, and elapsed active testing time.
// Requires platform admin authentication.

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface ActiveSession {
  id: string;
  test_case_id: string;
  tester_id: string;
  checked_out_at: string;
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
  suite_id: string | null;
}

interface TestSuite {
  id: string;
  name: string | null;
}

interface TimeLogRow {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

/**
 * GET /api/admin/testing/active-checkouts
 * Returns all active test sessions with enriched context and elapsed
 * active testing time computed from time_logs.
 *
 * active_testing_seconds:
 *   - Sum of (ended_at - started_at) for all completed time log entries
 *   - Plus (now - started_at) for the currently active log (is_active = true)
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { serviceClient } = auth;

  try {
    // 1. Fetch all active sessions
    const { data: sessions, error: sessionsError } = await serviceClient
      .from('test_sessions')
      .select('id, test_case_id, tester_id, checked_out_at')
      .eq('status', 'active');

    if (sessionsError) {
      console.error('Failed to fetch active sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch active sessions' },
        { status: 500 }
      );
    }

    const sessionList = (sessions ?? []) as ActiveSession[];

    if (sessionList.length === 0) {
      return NextResponse.json({ checkouts: [] });
    }

    const testerIds = [...new Set(sessionList.map((s) => s.tester_id))];
    const testCaseIds = [...new Set(sessionList.map((s) => s.test_case_id))];
    const sessionIds = sessionList.map((s) => s.id);

    // 2. Fetch tester profiles
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', testerIds);

    const profileMap = new Map<string, TesterProfile>();
    for (const p of (profiles ?? []) as TesterProfile[]) {
      profileMap.set(p.id, p);
    }

    // 3. Fetch test cases
    const { data: testCases } = await serviceClient
      .from('test_cases')
      .select('id, title, category, suite_id')
      .in('id', testCaseIds);

    const testCaseMap = new Map<string, TestCase>();
    for (const tc of (testCases ?? []) as TestCase[]) {
      testCaseMap.set(tc.id, tc);
    }

    // 4. Fetch suite names via test_cases.suite_id
    const suiteIds = [
      ...new Set(
        (testCases ?? [])
          .map((tc) => (tc as TestCase).suite_id)
          .filter((id): id is string => !!id)
      ),
    ];

    const suiteMap = new Map<string, string>();
    if (suiteIds.length > 0) {
      const { data: suites } = await serviceClient
        .from('test_suites')
        .select('id, name')
        .in('id', suiteIds);

      for (const suite of (suites ?? []) as TestSuite[]) {
        suiteMap.set(suite.id, suite.name ?? '');
      }
    }

    // 5. Fetch all time logs for these sessions to compute active testing time
    const { data: timeLogs } = await serviceClient
      .from('time_logs')
      .select('session_id, started_at, ended_at, is_active')
      .in('session_id', sessionIds);

    const timeLogList = (timeLogs ?? []) as TimeLogRow[];

    // Group time logs by session ID
    const timeLogsBySession = new Map<string, TimeLogRow[]>();
    for (const log of timeLogList) {
      const existing = timeLogsBySession.get(log.session_id) ?? [];
      existing.push(log);
      timeLogsBySession.set(log.session_id, existing);
    }

    /**
     * Compute total active testing seconds for a session.
     * Completed logs: sum (ended_at - started_at).
     * Active log: add (now - started_at).
     */
    function computeActiveSeconds(logs: TimeLogRow[]): number {
      const now = Date.now();
      let totalMs = 0;

      for (const log of logs) {
        const startMs = new Date(log.started_at).getTime();
        if (isNaN(startMs)) continue;

        if (log.is_active) {
          totalMs += now - startMs;
        } else if (log.ended_at) {
          const endMs = new Date(log.ended_at).getTime();
          if (!isNaN(endMs) && endMs > startMs) {
            totalMs += endMs - startMs;
          }
        }
      }

      return Math.round(totalMs / 1000);
    }

    // 6. Assemble the enriched checkout records
    const checkouts = sessionList.map((session) => {
      const tester = profileMap.get(session.tester_id);
      const testCase = testCaseMap.get(session.test_case_id);
      const suiteId = testCase?.suite_id ?? null;
      const suiteName = suiteId ? (suiteMap.get(suiteId) ?? '') : '';
      const logs = timeLogsBySession.get(session.id) ?? [];

      return {
        session_id: session.id,
        tester_name: tester?.full_name ?? null,
        tester_email: tester?.email ?? null,
        test_case_title: testCase?.title ?? '',
        test_case_category: testCase?.category ?? '',
        suite_name: suiteName,
        checked_out_at: session.checked_out_at,
        active_testing_seconds: computeActiveSeconds(logs),
      };
    });

    return NextResponse.json({ checkouts });
  } catch (error) {
    console.error('Error fetching active checkouts:', error);
    return NextResponse.json(
      { error: 'Server error while fetching active checkouts' },
      { status: 500 }
    );
  }
}
