'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { TestCaseCard } from '@/components/test-hub/TestCaseCard';

// ============================================
// CONSTANTS
// ============================================

const CATEGORY_ORDER = [
  'teams',
  'film',
  'playbook',
  'analytics',
  'communication-hub',
  'subscriptions',
  'roles',
  'practice',
  'game-week',
  'player-profiles',
  'general',
];

const CATEGORY_LABELS: Record<string, string> = {
  teams: 'Teams & Roster',
  film: 'Game Film',
  playbook: 'Playbook',
  analytics: 'Analytics',
  'communication-hub': 'Communication Hub',
  subscriptions: 'Subscriptions',
  roles: 'Roles & Permissions',
  practice: 'Practice',
  'game-week': 'Game Planning',
  'player-profiles': 'Player Profiles',
  general: 'General',
};

// ============================================
// TYPES
// ============================================

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  category: string;
  suite_name: string;
  display_order: number;
  status: string;
}

interface TestSession {
  id: string;
  test_case_id: string;
  tester_id: string;
  status: string;
}

type SessionStatus = 'available' | 'in-progress' | 'checked-out' | 'completed';

// ============================================
// HELPERS
// ============================================

function getSessionStatus(
  testCaseId: string,
  sessions: TestSession[],
  userId: string
): SessionStatus {
  const mySessions = sessions.filter(
    (s) => s.test_case_id === testCaseId && s.tester_id === userId
  );
  const myCompleted = mySessions.some((s) => s.status === 'completed');
  if (myCompleted) return 'completed';

  const myActive = mySessions.some((s) => s.status === 'active');
  if (myActive) return 'in-progress';

  const otherActive = sessions.some(
    (s) =>
      s.test_case_id === testCaseId &&
      s.status === 'active' &&
      s.tester_id !== userId
  );
  if (otherActive) return 'checked-out';

  return 'available';
}

// ============================================
// COMPONENT
// ============================================

export default function TestHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      // Fetch active test cases with suite names
      const { data: cases, error: casesError } = await supabase
        .from('test_cases')
        .select('*, test_suites!inner(name)')
        .eq('status', 'active')
        .eq('test_suites.status', 'active')
        .order('display_order');

      if (casesError) throw new Error(`Failed to fetch test cases: ${casesError.message}`);

      const activeCases: TestCase[] = (cases ?? []).map((tc) => ({
        id: tc.id,
        title: tc.title,
        description: tc.description,
        category: tc.category,
        // Supabase returns the joined table as an object or array depending on cardinality
        suite_name:
          Array.isArray(tc.test_suites)
            ? (tc.test_suites[0]?.name ?? '')
            : ((tc.test_suites as { name: string } | null)?.name ?? ''),
        display_order: tc.display_order,
        status: tc.status,
      }));

      setTestCases(activeCases);

      if (activeCases.length === 0) {
        setSessions([]);
        return;
      }

      const activeCaseIds = activeCases.map((tc) => tc.id);

      // Fetch sessions for these test cases
      const { data: sessionData, error: sessionsError } = await supabase
        .from('test_sessions')
        .select('id, test_case_id, tester_id, status')
        .in('test_case_id', activeCaseIds)
        .in('status', ['active', 'completed']);

      if (sessionsError) throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);

      setSessions(sessionData ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCheckout(testCaseId: string) {
    const res = await fetch('/api/test-hub/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testCaseId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'ALREADY_CHECKED_OUT') {
        await fetchData();
        return;
      }
      throw new Error(data.error || 'Failed to checkout');
    }

    router.push(`/test-hub/tests/${testCaseId}`);
  }

  function handleResume(testCaseId: string) {
    router.push(`/test-hub/tests/${testCaseId}`);
  }

  // Build groups ordered by CATEGORY_ORDER
  const groupedByCategory = testCases.reduce<Record<string, TestCase[]>>(
    (acc, tc) => {
      const key = tc.category;
      if (!acc[key]) acc[key] = [];
      acc[key].push(tc);
      return acc;
    },
    {}
  );

  // Include any categories not in CATEGORY_ORDER at the end
  const allCategories = [
    ...CATEGORY_ORDER,
    ...Object.keys(groupedByCategory).filter(
      (c) => !CATEGORY_ORDER.includes(c)
    ),
  ].filter((c) => groupedByCategory[c]?.length > 0);

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Test Cases</h1>
        <p className="text-sm text-gray-500 mt-1">
          {testCases.length} active test case{testCases.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Empty state */}
      {testCases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle size={48} className="text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">You're all caught up</h3>
          <p className="text-sm text-gray-500">Check back soon for new test cases.</p>
        </div>
      )}

      {/* Category groups */}
      {allCategories.map((category) => {
        const cases = groupedByCategory[category];
        const label = CATEGORY_LABELS[category] ?? category;

        return (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">{label}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((tc) => (
                <TestCaseCard
                  key={tc.id}
                  testCase={tc}
                  sessionStatus={
                    userId
                      ? getSessionStatus(tc.id, sessions, userId)
                      : 'available'
                  }
                  onCheckout={handleCheckout}
                  onResume={handleResume}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
