'use client';

// src/app/admin/testing/page.tsx
// Admin Testing Dashboard — invite testers, view metrics, coverage breakdown,
// active checkouts, tester roster, and recent test activity.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import {
  Users,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Loader2,
  X,
  UserMinus,
  ExternalLink,
  BarChart3,
  Clock,
  ShieldCheck,
  Play,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TesterRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_active_at: string | null;
  tests_completed: number;
  issues_flagged: number;
  current_checkout: string | null;
  pass_rate: number | null;
}

interface ActivityRow {
  id: string;
  tester_name: string | null;
  tester_email: string | null;
  test_case_title: string | null;
  test_case_id: string | null;
  completed_at: string | null;
  issues_count: number;
  pass_count: number;
  total_steps: number;
}

interface MetricsStats {
  total_testers: number;
  active_sessions: number;
  tests_completed: number;
  open_issues: number;
}

interface CoverageTotals {
  total_features: number;
  covered: number;
  pending_review: number;
  not_covered: number;
  coverage_percentage: number;
}

interface CategoryCoverage {
  category_id: string;
  category_name: string;
  total: number;
  covered: number;
  pending_review: number;
  not_covered: number;
}

interface ActiveCheckout {
  session_id: string;
  tester_name: string | null;
  tester_email: string | null;
  test_case_title: string;
  test_case_category: string;
  suite_name: string;
  checked_out_at: string;
  active_testing_seconds: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(dateString: string | null): string {
  if (!dateString) return 'Never';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function categoryPctColor(pct: number): string {
  if (pct > 75) return 'text-green-600';
  if (pct >= 25) return 'text-amber-600';
  return 'text-red-600';
}

// ============================================================================
// Component
// ============================================================================

export default function AdminTestingPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [testers, setTesters] = useState<TesterRow[]>([]);
  const [testersLoading, setTestersLoading] = useState(true);

  const [stats, setStats] = useState<MetricsStats>({
    total_testers: 0,
    active_sessions: 0,
    tests_completed: 0,
    open_issues: 0,
  });

  const [coverage, setCoverage] = useState<CoverageTotals | null>(null);
  const [coverageByCategory, setCoverageByCategory] = useState<CategoryCoverage[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(true);

  const [checkouts, setCheckouts] = useState<ActiveCheckout[]>([]);
  const [checkoutsLoading, setCheckoutsLoading] = useState(true);
  // Per-row confirmation state for Release button: sessionId → boolean
  const [releaseConfirm, setReleaseConfirm] = useState<Record<string, boolean>>({});
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const [removingId, setRemovingId] = useState<string | null>(null);

  // Row 2 metric: verified (active test cases with 2+ distinct testers)
  const [verifiedCount, setVerifiedCount] = useState(0);
  // Row 2 metric: active test case count
  const [activeCaseCount, setActiveCaseCount] = useState(0);

  // ------------------------------------------------------------------
  // Fetch testers + stats
  // ------------------------------------------------------------------
  const fetchTesters = useCallback(async () => {
    setTestersLoading(true);
    try {
      const res = await fetch('/api/admin/testing/testers');
      if (!res.ok) throw new Error('Failed to fetch testers');
      const data = await res.json();
      const testerList: TesterRow[] = data.testers ?? [];
      setTesters(testerList);

      const totalCompleted = testerList.reduce(
        (sum, t) => sum + (t.tests_completed ?? 0),
        0
      );
      const totalIssues = testerList.reduce(
        (sum, t) => sum + (t.issues_flagged ?? 0),
        0
      );

      setStats((prev) => ({
        ...prev,
        total_testers: testerList.length,
        tests_completed: totalCompleted,
        open_issues: totalIssues,
      }));
    } catch (err) {
      console.error('Error fetching testers:', err);
    } finally {
      setTestersLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Fetch coverage data
  // ------------------------------------------------------------------
  const fetchCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try {
      const res = await fetch('/api/admin/testing/coverage');
      if (!res.ok) throw new Error('Failed to fetch coverage');
      const data = await res.json();
      setCoverage(data.totals ?? null);
      setCoverageByCategory(data.by_category ?? []);
    } catch (err) {
      console.error('Error fetching coverage:', err);
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Fetch active checkouts
  // ------------------------------------------------------------------
  const fetchCheckouts = useCallback(async () => {
    setCheckoutsLoading(true);
    try {
      const res = await fetch('/api/admin/testing/active-checkouts');
      if (!res.ok) throw new Error('Failed to fetch checkouts');
      const data = await res.json();
      setCheckouts(data.checkouts ?? []);
    } catch (err) {
      console.error('Error fetching active checkouts:', err);
    } finally {
      setCheckoutsLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Fetch active sessions count + recent activity + verified count
  // ------------------------------------------------------------------
  const fetchActivityData = useCallback(async () => {
    setActivityLoading(true);
    try {
      const supabase = createClient();

      // Run independent queries in parallel
      const [
        activeSessionsResult,
        recentSessionsResult,
        allCompletedResult,
        activeCasesResult,
      ] = await Promise.all([
        supabase.from('test_sessions').select('id').eq('status', 'active'),
        supabase
          .from('test_sessions')
          .select('id, completed_at, tester_id, test_case_id, test_cases ( title )')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20),
        supabase
          .from('test_sessions')
          .select('test_case_id, tester_id')
          .eq('status', 'completed'),
        supabase.from('test_cases').select('id').eq('status', 'active'),
      ]);

      // Active sessions count
      setStats((prev) => ({
        ...prev,
        active_sessions: activeSessionsResult.data?.length ?? 0,
      }));

      // Active test case count (Row 2 metric)
      const activeCases = activeCasesResult.data ?? [];
      setActiveCaseCount(activeCases.length);

      // Verified count: active test cases completed by 2+ distinct testers
      const caseTesters = new Map<string, Set<string>>();
      for (const s of allCompletedResult.data ?? []) {
        const existing = caseTesters.get(s.test_case_id) ?? new Set<string>();
        existing.add(s.tester_id);
        caseTesters.set(s.test_case_id, existing);
      }
      const activeCaseIds = new Set(activeCases.map((c) => c.id));
      const verified = [...caseTesters.entries()].filter(
        ([caseId, testers]) => activeCaseIds.has(caseId) && testers.size >= 2
      ).length;
      setVerifiedCount(verified);

      // Recent activity rows
      const recentSessions = recentSessionsResult.data ?? [];
      if (recentSessions.length === 0) {
        setActivity([]);
        return;
      }

      const sessionIds = recentSessions.map((s) => s.id);
      const testerIds = [...new Set(recentSessions.map((s) => s.tester_id))];

      // Fetch profiles and step completions in parallel
      const [profilesResult, stepCompletionsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', testerIds),
        supabase
          .from('test_step_completions')
          .select('session_id, status, flagged_issue')
          .in('session_id', sessionIds),
      ]);

      const profileMap = new Map<string, { email: string | null; full_name: string | null }>();
      for (const p of profilesResult.data ?? []) {
        profileMap.set(p.id, { email: p.email, full_name: p.full_name });
      }

      // Aggregate step completions per session: pass count, total, flagged count
      interface StepAgg {
        passCount: number;
        total: number;
        flaggedCount: number;
      }
      const stepAgg = new Map<string, StepAgg>();
      for (const step of stepCompletionsResult.data ?? []) {
        const agg = stepAgg.get(step.session_id) ?? { passCount: 0, total: 0, flaggedCount: 0 };
        agg.total += 1;
        if (step.status === 'pass') agg.passCount += 1;
        if (step.flagged_issue) agg.flaggedCount += 1;
        stepAgg.set(step.session_id, agg);
      }

      const rows: ActivityRow[] = recentSessions.map((s) => {
        const profile = profileMap.get(s.tester_id);
        const testCase = Array.isArray(s.test_cases)
          ? (s.test_cases[0] as { title: string } | null)
          : (s.test_cases as { title: string } | null);
        const agg = stepAgg.get(s.id);
        return {
          id: s.id,
          tester_name: profile?.full_name ?? null,
          tester_email: profile?.email ?? null,
          test_case_title: testCase?.title ?? null,
          test_case_id: s.test_case_id ?? null,
          completed_at: s.completed_at ?? null,
          issues_count: agg?.flaggedCount ?? 0,
          pass_count: agg?.passCount ?? 0,
          total_steps: agg?.total ?? 0,
        };
      });

      setActivity(rows);
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTesters();
    fetchCoverage();
    fetchCheckouts();
    fetchActivityData();
  }, [fetchTesters, fetchCoverage, fetchCheckouts, fetchActivityData]);

  // ------------------------------------------------------------------
  // Clear invite result after 5 seconds
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!inviteResult) return;
    const timer = setTimeout(() => setInviteResult(null), 5000);
    return () => clearTimeout(timer);
  }, [inviteResult]);

  // ------------------------------------------------------------------
  // Invite handler
  // ------------------------------------------------------------------
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);

    try {
      const res = await fetch('/api/admin/testing/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteResult({ type: 'error', message: data.error || 'Failed to send invite' });
      } else {
        setInviteResult({ type: 'success', message: data.message || 'Invite sent.' });
        setInviteEmail('');
        await fetchTesters();
      }
    } catch {
      setInviteResult({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setInviting(false);
    }
  }

  // ------------------------------------------------------------------
  // Remove tester handler
  // ------------------------------------------------------------------
  async function handleRemoveTester(userId: string, displayName: string) {
    if (!confirm(`Remove tester access for ${displayName}? They will no longer be able to access the Test Hub.`)) {
      return;
    }
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/admin/testing/testers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_tester: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Failed to remove tester:', data.error);
        return;
      }
      await fetchTesters();
    } catch (err) {
      console.error('Error removing tester:', err);
    } finally {
      setRemovingId(null);
    }
  }

  // ------------------------------------------------------------------
  // Release checkout handler
  // ------------------------------------------------------------------
  async function handleReleaseCheckout(sessionId: string) {
    const alreadyConfirmed = releaseConfirm[sessionId];

    if (!alreadyConfirmed) {
      setReleaseConfirm((prev) => ({ ...prev, [sessionId]: true }));
      return;
    }

    setReleasingId(sessionId);
    try {
      const res = await fetch(
        `/api/admin/testing/active-checkouts/${sessionId}/release`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json();
        console.error('Failed to release checkout:', data.error);
        return;
      }
      setReleaseConfirm((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      await fetchCheckouts();
    } catch (err) {
      console.error('Error releasing checkout:', err);
    } finally {
      setReleasingId(null);
    }
  }

  // ============================================================================
  // Render helpers
  // ============================================================================

  const row1MetricCards = [
    {
      label: 'Total Testers',
      value: stats.total_testers,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active Sessions',
      value: stats.active_sessions,
      icon: Activity,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Tests Completed',
      value: stats.tests_completed,
      icon: CheckCircle2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Open Issues',
      value: stats.open_issues,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const featuresCoveredLabel = coverage
    ? `${coverage.covered} of ${coverage.total_features} (${coverage.coverage_percentage}%)`
    : '—';

  const row2MetricCards = [
    {
      label: 'Features Covered',
      value: featuresCoveredLabel,
      icon: BarChart3,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      isString: true,
    },
    {
      label: 'Test Cases Active',
      value: activeCaseCount,
      icon: Play,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      isString: false,
    },
    {
      label: 'Verified (2+ Testers)',
      value: verifiedCount,
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      isString: false,
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Testing</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage beta testers, review activity, and track flagged issues.
            </p>
          </div>
          <Link
            href="/admin/testing/issues"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            View Issues
            {stats.open_issues > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {stats.open_issues}
              </span>
            )}
          </Link>
        </div>

        {/* Invite Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Tester</h2>

          {inviteResult && (
            <div
              className={`flex items-start gap-3 px-4 py-3 rounded-lg mb-4 ${
                inviteResult.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <span className={`text-sm ${inviteResult.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {inviteResult.message}
              </span>
              <button
                onClick={() => setInviteResult(null)}
                className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleInvite} className="flex items-center gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="tester@example.com"
              required
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              Send Invite
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            The user must already have an account. If not, they will receive a sign-up invite link.
          </p>
        </div>

        {/* Row 1 Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {row1MetricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-semibold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Row 2 Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {row2MetricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                {coverageLoading && card.label === 'Features Covered' ? (
                  <div className="h-9 flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                  </div>
                ) : (
                  <p className={`font-semibold text-gray-900 ${card.isString ? 'text-xl' : 'text-3xl'}`}>
                    {card.value}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Coverage Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Coverage</h2>

          {coverageLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : coverage ? (
            <>
              {/* Stacked progress bar */}
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex mb-3">
                {coverage.total_features > 0 && (
                  <>
                    <div
                      className="bg-green-500 h-full transition-all"
                      style={{ width: `${(coverage.covered / coverage.total_features) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400 h-full transition-all"
                      style={{ width: `${(coverage.pending_review / coverage.total_features) * 100}%` }}
                    />
                  </>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Covered</span>
                  <span className="text-sm font-medium text-gray-900">{coverage.covered}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Pending Review</span>
                  <span className="text-sm font-medium text-gray-900">{coverage.pending_review}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Not Covered</span>
                  <span className="text-sm font-medium text-gray-900">{coverage.not_covered}</span>
                </div>
              </div>

              {/* Category table */}
              {coverageByCategory.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[2fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <span>Category</span>
                    <span className="text-right">Total</span>
                    <span className="text-right">Covered</span>
                    <span className="text-right">Pending</span>
                    <span className="text-right">Not Covered</span>
                    <span className="text-right">Coverage %</span>
                  </div>
                  {coverageByCategory.map((cat) => {
                    const pct = cat.total > 0 ? Math.round((cat.covered / cat.total) * 100) : 0;
                    return (
                      <div
                        key={cat.category_id}
                        className="grid grid-cols-[2fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 last:border-0 items-center"
                      >
                        <span className="text-sm text-gray-900">{cat.category_name}</span>
                        <span className="text-sm text-gray-500 text-right">{cat.total}</span>
                        <span className="text-sm text-gray-900 text-right font-medium">{cat.covered}</span>
                        <span className="text-sm text-gray-500 text-right">{cat.pending_review}</span>
                        <span className="text-sm text-gray-500 text-right">{cat.not_covered}</span>
                        <span className={`text-sm font-semibold text-right ${categoryPctColor(pct)}`}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Coverage data unavailable.</p>
          )}
        </div>

        {/* Active Checkouts */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Active Checkouts</h2>
            {checkouts.length > 0 && (
              <span className="ml-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {checkouts.length}
              </span>
            )}
          </div>

          {checkoutsLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : checkouts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">No active checkouts right now.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_2fr_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Tester</span>
                <span>Test Case</span>
                <span>Suite</span>
                <span className="text-right">Checked Out</span>
                <span className="text-right">Active Time</span>
                <span className="text-right">Action</span>
              </div>

              {checkouts.map((co) => {
                const isConfirming = !!releaseConfirm[co.session_id];
                const isReleasing = releasingId === co.session_id;
                const testerLabel = co.tester_name || co.tester_email || 'Unknown';

                return (
                  <div
                    key={co.session_id}
                    className="grid grid-cols-[1fr_2fr_1fr_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
                  >
                    <span className="text-sm text-gray-900 truncate">{testerLabel}</span>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-900 truncate">
                        {co.test_case_title || '—'}
                      </span>
                      {co.test_case_category && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 flex-shrink-0">
                          {co.test_case_category}
                        </span>
                      )}
                    </div>

                    <span className="text-sm text-gray-500 truncate">
                      {co.suite_name || '—'}
                    </span>

                    <span className="text-sm text-gray-500 whitespace-nowrap text-right">
                      {formatRelative(co.checked_out_at)}
                    </span>

                    <span className="text-sm text-gray-900 font-medium whitespace-nowrap text-right">
                      {formatDuration(co.active_testing_seconds)}
                    </span>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleReleaseCheckout(co.session_id)}
                        disabled={isReleasing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
                          isConfirming
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isReleasing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isConfirming ? (
                          'Are you sure?'
                        ) : (
                          'Release'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Testers Table */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Active Testers</h2>
          </div>

          {testersLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : testers.length === 0 ? (
            <div className="py-16 text-center">
              <FlaskConical className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No testers yet.</p>
              <p className="text-gray-400 text-xs mt-1">Send an invite above to get started.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_1fr_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Name</span>
                <span>Email</span>
                <span className="text-right">Joined</span>
                <span className="text-right">Last Active</span>
                <span className="text-right">Tests Done</span>
                <span>Currently Testing</span>
                <span className="text-right">Pass Rate</span>
                <span className="text-right">Action</span>
              </div>

              {testers.map((tester) => {
                const displayName = tester.full_name || tester.email || 'Unknown';
                return (
                  <div
                    key={tester.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto_1fr_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {tester.full_name || '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-gray-600 truncate">
                        {tester.email ?? '—'}
                      </span>
                      <Link
                        href={`/admin/users?search=${encodeURIComponent(tester.email ?? '')}`}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                        title="View in Users"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <span className="text-sm text-gray-500 text-right whitespace-nowrap">
                      {formatDate(tester.created_at)}
                    </span>

                    <span className="text-sm text-gray-500 text-right whitespace-nowrap">
                      {formatRelative(tester.last_active_at)}
                    </span>

                    <span className="text-sm text-gray-900 font-medium text-right">
                      {tester.tests_completed}
                      {tester.issues_flagged > 0 && (
                        <span className="ml-1.5 text-xs text-amber-600">
                          ({tester.issues_flagged} issues)
                        </span>
                      )}
                    </span>

                    <span className="text-sm text-gray-600 truncate">
                      {tester.current_checkout ?? '—'}
                    </span>

                    <span className="text-sm text-right whitespace-nowrap font-medium text-gray-900">
                      {tester.pass_rate !== null ? `${tester.pass_rate}%` : '—'}
                    </span>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveTester(tester.id, displayName)}
                        disabled={removingId === tester.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {removingId === tester.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="w-3.5 h-3.5" />
                        )}
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>

          {activityLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : activity.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 text-sm">No completed sessions yet.</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Tester</span>
                <span>Test Case</span>
                <span className="text-right">Completed</span>
              </div>

              {activity.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_2fr_auto] gap-4 px-6 py-3.5 border-b border-gray-100 last:border-0 items-start"
                >
                  <span className="text-sm text-gray-900 truncate">
                    {row.tester_name || row.tester_email || 'Unknown'}
                  </span>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    {row.test_case_id ? (
                      <Link
                        href={`/test-hub/tests/${row.test_case_id}`}
                        className="text-sm text-gray-600 hover:text-gray-900 hover:underline truncate"
                      >
                        {row.test_case_title || '—'}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-600 truncate">
                        {row.test_case_title || '—'}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      {row.total_steps > 0 && (
                        <span className="text-xs text-gray-400">
                          {row.pass_count}/{row.total_steps} passed
                        </span>
                      )}
                      {row.issues_count > 0 && (
                        <span className="inline-flex items-center text-xs text-amber-600 font-medium">
                          ({row.issues_count} {row.issues_count === 1 ? 'issue' : 'issues'})
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-sm text-gray-400 whitespace-nowrap text-right">
                    {formatRelative(row.completed_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
