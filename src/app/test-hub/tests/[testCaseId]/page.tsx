'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, CheckCircle, Copy } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { TestChecklist } from '@/components/test-hub/TestChecklist';
import { TimeTracker } from '@/components/test-hub/TimeTracker';
import { TestAIAssistant } from '@/components/test-hub/TestAIAssistant';

// ============================================
// TYPES
// ============================================

type StepType = 'setup' | 'test';
type StepStatus = 'pending' | 'pass' | 'fail' | 'skip';

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  category: string;
  precondition: string | null;
  suite_id: string;
}

interface TestStep {
  id: string;
  test_case_id: string;
  step_type: StepType;
  display_order: number;
  instruction: string;
  expected_outcome: string | null;
}

interface TestSession {
  id: string;
  test_case_id: string;
  tester_id: string;
  status: string;
}

interface StepCompletion {
  id: string;
  status: StepStatus;
  notes: string | null;
  flagged_issue: boolean;
}

// ============================================
// COMPONENT
// ============================================

export default function TestSessionPage({
  params,
}: {
  params: Promise<{ testCaseId: string }>;
}) {
  const { testCaseId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [session, setSession] = useState<TestSession | null>(null);
  const [completions, setCompletions] = useState<Map<string, StepCompletion>>(
    new Map()
  );
  const [completing, setCompleting] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [accounts, setAccounts] = useState<Array<{
    label: string;
    email: string;
    password: string;
    account_type: string;
  }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/test-hub');
        return;
      }

      // Fetch test case
      const { data: tc, error: tcError } = await supabase
        .from('test_cases')
        .select('id, title, description, category, precondition, suite_id')
        .eq('id', testCaseId)
        .single();

      if (tcError || !tc) {
        router.push('/test-hub');
        return;
      }

      setTestCase(tc);

      // Fetch test accounts for this suite
      if (tc.suite_id) {
        const { data: accountsData } = await supabase
          .from('test_accounts')
          .select('label, email, password, account_type')
          .eq('suite_id', tc.suite_id)
          .order('created_at');
        setAccounts((accountsData ?? []) as typeof accounts);
      }

      // Fetch steps ordered by type then display_order
      const { data: stepsData, error: stepsError } = await supabase
        .from('test_steps')
        .select('*')
        .eq('test_case_id', testCaseId)
        .order('step_type')
        .order('display_order');

      if (stepsError) throw new Error(`Failed to fetch steps: ${stepsError.message}`);

      setSteps(stepsData ?? []);

      // Fetch active session for this user
      const { data: sessionData, error: sessionError } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('test_case_id', testCaseId)
        .eq('tester_id', user.id)
        .eq('status', 'active')
        .single();

      if (sessionError || !sessionData) {
        // No active session — redirect back to test hub
        router.push('/test-hub');
        return;
      }

      setSession(sessionData);

      // Fetch completions for this session
      const { data: completionsData, error: completionsError } = await supabase
        .from('test_step_completions')
        .select('*')
        .eq('session_id', sessionData.id);

      if (completionsError) throw new Error(`Failed to fetch completions: ${completionsError.message}`);

      const completionsMap = new Map<string, StepCompletion>();
      for (const c of completionsData ?? []) {
        completionsMap.set(c.step_id, {
          id: c.id,
          status: c.status as StepStatus,
          notes: c.notes ?? null,
          flagged_issue: c.flagged_issue ?? false,
        });
      }
      setCompletions(completionsMap);
    } finally {
      setLoading(false);
    }
  }, [testCaseId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStepUpdate = useCallback(
    async (
      stepId: string,
      data: { status: string; notes?: string; flagged_issue?: boolean }
    ) => {
      // Optimistic update
      setCompletions((prev) => {
        const next = new Map(prev);
        const existing = next.get(stepId);
        next.set(stepId, {
          id: existing?.id ?? '',
          status: data.status as StepStatus,
          notes: data.notes ?? existing?.notes ?? null,
          flagged_issue: data.flagged_issue ?? existing?.flagged_issue ?? false,
        });
        return next;
      });

      if (!session) return;

      // Persist
      await fetch(`/api/test-hub/sessions/${session.id}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    [session]
  );

  async function handleComplete() {
    if (!session) return;
    setCompleting(true);
    try {
      const res = await fetch(
        `/api/test-hub/sessions/${session.id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: sessionNotes.trim() || undefined }),
        }
      );
      if (res.ok) {
        router.push('/test-hub');
      }
    } finally {
      setCompleting(false);
    }
  }

  // Determine whether all test steps have a non-pending completion
  const testSteps = steps.filter((s) => s.step_type === 'test');
  const allTestStepsCompleted =
    testSteps.length > 0 &&
    testSteps.every((s) => {
      const c = completions.get(s.id);
      return c && c.status !== 'pending';
    });

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!session || !testCase) {
    // Already redirecting
    return null;
  }

  return (
    <div>
      {/* Top banner */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/test-hub')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Back to Test Hub"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {testCase.title}
            </h1>
          </div>
          <TimeTracker sessionId={session.id} />
        </div>
      </div>

      {/* Two-column body */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: checklist + complete button */}
        <div className="lg:col-span-3">
          {accounts.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Test Credentials</p>
              <div className="space-y-2">
                {accounts.map((acc, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded p-2 border border-blue-100">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{acc.account_type}</span>
                    <span className="text-sm text-gray-700">{acc.label}</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">{acc.email}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(acc.email)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy email"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">{acc.password}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(acc.password)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy password"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {testCase.precondition && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Before you begin</p>
              <p className="text-sm text-amber-700">{testCase.precondition}</p>
            </div>
          )}
          <TestChecklist
            steps={steps}
            sessionId={session.id}
            completions={completions}
            onUpdate={handleStepUpdate}
          />

          {/* Session notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Summarize what you found, any issues, or general feedback..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <button
            onClick={handleComplete}
            disabled={!allTestStepsCompleted || completing}
            className={`w-full py-3 rounded-lg font-medium transition-colors mt-4 flex items-center justify-center gap-2 ${
              allTestStepsCompleted && !completing
                ? 'bg-black text-white hover:bg-gray-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {completing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Complete Session
          </button>
        </div>

        {/* Right: AI assistant */}
        <div className="lg:col-span-2">
          <div style={{ height: 'calc(100vh - 12rem)' }}>
            <TestAIAssistant
              testCaseId={testCase.id}
              sessionId={session.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
