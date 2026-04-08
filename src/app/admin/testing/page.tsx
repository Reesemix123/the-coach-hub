'use client';

// src/app/admin/testing/page.tsx
// Admin Testing Dashboard — invite testers, view metrics, manage tester roster,
// and browse recent test activity.

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
}

interface ActivityRow {
  id: string;
  tester_name: string | null;
  tester_email: string | null;
  test_case_title: string | null;
  completed_at: string | null;
}

interface MetricsStats {
  total_testers: number;
  active_sessions: number;
  tests_completed: number;
  open_issues: number;
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

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const [removingId, setRemovingId] = useState<string | null>(null);

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

      // Derive some stats from the tester list
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
  // Fetch active sessions count + recent activity via Supabase direct
  // ------------------------------------------------------------------
  const fetchActivityData = useCallback(async () => {
    setActivityLoading(true);
    try {
      const supabase = createClient();

      // Active sessions count
      const { data: activeSessions } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('status', 'active');

      setStats((prev) => ({
        ...prev,
        active_sessions: activeSessions?.length ?? 0,
      }));

      // Last 20 completed sessions with tester name + test case title
      const { data: recentSessions } = await supabase
        .from('test_sessions')
        .select(`
          id,
          completed_at,
          tester_id,
          test_case_id,
          test_cases ( title )
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (!recentSessions || recentSessions.length === 0) {
        setActivity([]);
        return;
      }

      // Collect tester IDs and fetch profiles
      const testerIds = [...new Set(recentSessions.map((s) => s.tester_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', testerIds);

      const profileMap = new Map<string, { email: string | null; full_name: string | null }>();
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { email: p.email, full_name: p.full_name });
      }

      const rows: ActivityRow[] = recentSessions.map((s) => {
        const profile = profileMap.get(s.tester_id);
        const testCase = Array.isArray(s.test_cases)
          ? (s.test_cases[0] as { title: string } | null)
          : (s.test_cases as { title: string } | null);
        return {
          id: s.id,
          tester_name: profile?.full_name ?? null,
          tester_email: profile?.email ?? null,
          test_case_title: testCase?.title ?? null,
          completed_at: s.completed_at ?? null,
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
    fetchActivityData();
  }, [fetchTesters, fetchActivityData]);

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

  // ============================================================================
  // Render
  // ============================================================================

  const metricCards = [
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

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {metricCards.map((card) => {
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
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Name</span>
                <span>Email</span>
                <span className="text-right">Joined</span>
                <span className="text-right">Last Active</span>
                <span className="text-right">Tests Done</span>
                <span className="text-right">Action</span>
              </div>

              {testers.map((tester) => {
                const displayName = tester.full_name || tester.email || 'Unknown';
                return (
                  <div
                    key={tester.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
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
                  className="grid grid-cols-[1fr_2fr_auto] gap-4 px-6 py-3.5 border-b border-gray-100 last:border-0 items-center"
                >
                  <span className="text-sm text-gray-900 truncate">
                    {row.tester_name || row.tester_email || 'Unknown'}
                  </span>
                  <span className="text-sm text-gray-600 truncate">
                    {row.test_case_title || '—'}
                  </span>
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
