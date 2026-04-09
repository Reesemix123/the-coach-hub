'use client';

// src/components/test-hub/admin/SuitesTab.tsx
// Admin Suites Tab — invite card, metrics, coverage, active checkouts,
// suites table, testers table, and recent activity feed.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Plus, X, Mail, RefreshCw } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// ============================================
// TYPES
// ============================================

interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  sport: string | null;
  status: 'draft' | 'active' | 'archived' | 'pending_review';
  created_at: string;
  case_count: number;
  pending_count: number;
}

type SuiteStatus = 'draft' | 'active' | 'archived' | 'pending_review';
type StatusFilter = 'all' | SuiteStatus;

interface CoverageData {
  totals: {
    total_features: number;
    covered: number;
    pending_review: number;
    not_covered: number;
    coverage_percentage: number;
  };
  by_category: CategoryCoverage[];
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

interface Tester {
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

interface ActivityItem {
  id: string;
  action: string;
  resource_type: string;
  resource_name: string | null;
  created_at: string;
  admin_email: string;
}

// ============================================
// PROPS
// ============================================

export interface SuitesTabProps {
  /** Called after a new suite is created — lets parent switch to Generate tab with suite pre-selected. */
  onSuiteCreated: (suiteId: string, suiteName: string) => void;
}

// ============================================
// HELPERS
// ============================================

function getSuiteBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'draft':
      return 'bg-gray-100 text-gray-600';
    case 'archived':
      return 'bg-red-100 text-red-600';
    case 'pending_review':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getSuiteStatusLabel(status: string): string {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    'testing.tester_invited': 'Invited tester',
    'testing.tester_granted': 'Granted tester access',
    'testing.tester_revoked': 'Revoked tester access',
    'testing.session_released': 'Released session',
  };
  return map[action] ?? action;
}

// ============================================
// COMPONENT
// ============================================

export function SuitesTab({ onSuiteCreated }: SuitesTabProps) {
  // --- Suites state ---
  const [loading, setLoading] = useState(true);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewSuiteForm, setShowNewSuiteForm] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

  // --- Coverage state ---
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);

  // --- Active checkouts state ---
  const [checkoutsLoading, setCheckoutsLoading] = useState(true);
  const [checkouts, setCheckouts] = useState<ActiveCheckout[]>([]);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // --- Testers state ---
  const [testersLoading, setTestersLoading] = useState(true);
  const [testers, setTesters] = useState<Tester[]>([]);

  // --- Invite state ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ message: string; isError: boolean } | null>(null);

  // --- Recent activity state ---
  const [activityLoading, setActivityLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchSuites = useCallback(async () => {
    try {
      const supabase = createClient();

      const { data: suitesData, error: suitesError } = await supabase
        .from('test_suites')
        .select('*')
        .order('created_at', { ascending: false });

      if (suitesError) throw new Error(`Failed to fetch suites: ${suitesError.message}`);

      const { data: casesData } = await supabase
        .from('test_cases')
        .select('suite_id, status');

      const { data: sessionsData } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('status', 'active');

      setActiveSessions(sessionsData?.length ?? 0);

      const casesBySuite = new Map<string, { total: number; pending: number }>();
      for (const c of casesData ?? []) {
        const existing = casesBySuite.get(c.suite_id) ?? { total: 0, pending: 0 };
        existing.total += 1;
        if (c.status === 'pending_review') existing.pending += 1;
        casesBySuite.set(c.suite_id, existing);
      }

      const pendingCount = (casesData ?? []).filter(c => c.status === 'pending_review').length;
      setPendingTotal(pendingCount);

      const enrichedSuites: TestSuite[] = (suitesData ?? []).map(s => ({
        ...s,
        case_count: casesBySuite.get(s.id)?.total ?? 0,
        pending_count: casesBySuite.get(s.id)?.pending ?? 0,
      }));

      setSuites(enrichedSuites);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/testing/coverage');
      if (res.ok) {
        const data = await res.json() as CoverageData;
        setCoverage(data);
      }
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  const fetchCheckouts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/testing/active-checkouts');
      if (res.ok) {
        const data = await res.json() as { checkouts: ActiveCheckout[] };
        setCheckouts(data.checkouts ?? []);
      }
    } finally {
      setCheckoutsLoading(false);
    }
  }, []);

  const fetchTesters = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/testing/testers');
      if (res.ok) {
        const data = await res.json() as { testers: Tester[] };
        setTesters(data.testers ?? []);
      }
    } finally {
      setTestersLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      // Query audit_logs for testing-related actions
      const supabase = createClient();
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_name, created_at, admin_email')
        .ilike('action', 'testing.%')
        .order('created_at', { ascending: false })
        .limit(20);

      setActivity((data ?? []) as ActivityItem[]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuites();
    fetchCoverage();
    fetchCheckouts();
    fetchTesters();
    fetchActivity();
  }, [fetchSuites, fetchCoverage, fetchCheckouts, fetchTesters, fetchActivity]);

  // ============================================
  // HANDLERS
  // ============================================

  async function handleCreateSuite() {
    if (!newSuiteName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/test-hub/suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSuiteName.trim(),
          description: newSuiteDesc.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Failed to create suite');
      }

      const newSuite = await res.json() as { id: string; name: string };

      setNewSuiteName('');
      setNewSuiteDesc('');
      setShowNewSuiteForm(false);

      // Refresh suites list
      await fetchSuites();

      // Notify parent to switch to Generate tab with this suite pre-selected
      onSuiteCreated(newSuite.id, newSuite.name);
    } finally {
      setCreating(false);
    }
  }

  async function handleRelease(sessionId: string) {
    setReleasingId(sessionId);
    try {
      const res = await fetch(
        `/api/admin/testing/active-checkouts/${sessionId}/release`,
        { method: 'POST' }
      );
      if (res.ok) {
        setCheckouts(prev => prev.filter(c => c.session_id !== sessionId));
        setActiveSessions(prev => Math.max(0, prev - 1));
      }
    } finally {
      setReleasingId(null);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/admin/testing/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setInviteResult({ message: data.message ?? 'Invite sent.', isError: false });
        setInviteEmail('');
        // Refresh testers list in case the user already exists
        fetchTesters();
      } else {
        setInviteResult({ message: data.error ?? 'Invite failed.', isError: true });
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeTester(userId: string) {
    try {
      const res = await fetch(`/api/admin/testing/testers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_tester: false }),
      });
      if (res.ok) {
        setTesters(prev => prev.filter(t => t.id !== userId));
      }
    } catch {
      // Non-critical — show no UI error, tester list will reflect actual state on next refresh
    }
  }

  // ============================================
  // DERIVED VALUES
  // ============================================

  const filteredSuites =
    statusFilter === 'all'
      ? suites
      : suites.filter(s => s.status === statusFilter);

  const totalCases = suites.reduce((sum, s) => sum + s.case_count, 0);

  const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* ---- Invite Card ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Mail size={20} className="text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Invite a Tester</h3>
            <p className="text-sm text-gray-500 mb-4">
              Send a beta-tester invite. New accounts receive a magic-link email; existing accounts
              get tester access granted immediately.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => {
                  setInviteEmail(e.target.value);
                  setInviteResult(null);
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
                placeholder="tester@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting && <Loader2 size={14} className="animate-spin" />}
                Send Invite
              </button>
            </div>
            {inviteResult && (
              <p className={`mt-2 text-sm ${inviteResult.isError ? 'text-red-600' : 'text-green-700'}`}>
                {inviteResult.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- 4 Operational Metric Cards ---- */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-4 uppercase tracking-wide text-xs">
          Overview
        </h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Total Suites</p>
            <p className="text-3xl font-semibold text-gray-900">{suites.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Active Cases</p>
            <p className="text-3xl font-semibold text-gray-900">{totalCases}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Pending Review</p>
            <p className="text-3xl font-semibold text-gray-900">{pendingTotal}</p>
            {pendingTotal > 0 && (
              <Link
                href="/test-hub/admin/review"
                className="mt-1 text-xs text-yellow-700 hover:underline"
              >
                Review queue
              </Link>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Active Sessions</p>
            <p className="text-3xl font-semibold text-gray-900">{activeSessions}</p>
          </div>
        </div>
      </div>

      {/* ---- 3 Coverage Metric Cards + Progress Bar ---- */}
      <div>
        <h2 className="text-xs font-semibold text-gray-700 mb-4 uppercase tracking-wide">
          Feature Coverage
        </h2>
        {coverageLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading coverage...
          </div>
        ) : coverage ? (
          <>
            {/* 3 coverage cards */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Covered</p>
                <p className="text-3xl font-semibold text-green-700">{coverage.totals.covered}</p>
                <p className="text-xs text-gray-400 mt-1">of {coverage.totals.total_features} features</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Pending Review</p>
                <p className="text-3xl font-semibold text-yellow-600">{coverage.totals.pending_review}</p>
                <p className="text-xs text-gray-400 mt-1">awaiting approval</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Not Covered</p>
                <p className="text-3xl font-semibold text-gray-900">{coverage.totals.not_covered}</p>
                <p className="text-xs text-gray-400 mt-1">features without tests</p>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Overall coverage</p>
                <p className="text-sm font-semibold text-gray-900">
                  {coverage.totals.coverage_percentage}%
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${coverage.totals.coverage_percentage}%` }}
                />
              </div>
            </div>

            {/* Per-category table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Category</span>
                <span className="text-center">Total</span>
                <span className="text-center">Covered</span>
                <span className="text-center">Pending</span>
                <span className="text-right">Not Covered</span>
              </div>
              {coverage.by_category.map(cat => {
                const pct = cat.total > 0 ? Math.round((cat.covered / cat.total) * 100) : 0;
                return (
                  <div
                    key={cat.category_id}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 last:border-0 items-center"
                  >
                    <div>
                      <span className="text-sm text-gray-900 font-medium">{cat.category_name}</span>
                      <div className="mt-1 w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-green-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 text-center">{cat.total}</span>
                    <span className="text-sm text-green-700 font-medium text-center">{cat.covered}</span>
                    <span className="text-sm text-yellow-600 text-center">{cat.pending_review}</span>
                    <span className="text-sm text-gray-500 text-right">{cat.not_covered}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Coverage data unavailable.</p>
        )}
      </div>

      {/* ---- Active Checkouts Table ---- */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Active Checkouts
          </h2>
          <button
            onClick={() => { setCheckoutsLoading(true); fetchCheckouts(); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
        {checkoutsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading checkouts...
          </div>
        ) : checkouts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">No active checkouts right now.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Tester</span>
              <span>Test Case</span>
              <span className="text-center">Suite</span>
              <span className="text-center">Time</span>
              <span className="text-right">Action</span>
            </div>
            {checkouts.map(checkout => (
              <div
                key={checkout.session_id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {checkout.tester_name ?? checkout.tester_email ?? 'Unknown'}
                  </p>
                  {checkout.tester_name && checkout.tester_email && (
                    <p className="text-xs text-gray-500">{checkout.tester_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-900">{checkout.test_case_title}</p>
                  <span className="text-xs text-gray-400 capitalize">{checkout.test_case_category}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-600">{checkout.suite_name || '—'}</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-mono text-gray-700">
                    {formatSeconds(checkout.active_testing_seconds)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleRelease(checkout.session_id)}
                    disabled={releasingId === checkout.session_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {releasingId === checkout.session_id && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Suites Table ---- */}
      <div>
        {/* Filter tabs + New Suite button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewSuiteForm(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors"
          >
            <Plus size={16} />
            New Suite
          </button>
        </div>

        {/* Inline new suite form */}
        {showNewSuiteForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Create Test Suite</h3>
              <button
                onClick={() => setShowNewSuiteForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suite Name
                </label>
                <input
                  type="text"
                  value={newSuiteName}
                  onChange={e => setNewSuiteName(e.target.value)}
                  placeholder="e.g. Core Features v1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newSuiteDesc}
                  onChange={e => setNewSuiteDesc(e.target.value)}
                  rows={2}
                  placeholder="Brief description of what this suite covers"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCreateSuite}
                  disabled={creating || !newSuiteName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewSuiteForm(false);
                    setNewSuiteName('');
                    setNewSuiteDesc('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suites list */}
        <div className="bg-white rounded-xl border border-gray-200">
          {filteredSuites.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-sm">
                {statusFilter === 'all'
                  ? 'No test suites yet. Create one to get started.'
                  : `No ${statusFilter} suites found.`}
              </p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Suite</span>
                <span className="text-center">Sport</span>
                <span className="text-center">Status</span>
                <span className="text-center">Cases</span>
                <span className="text-right">Action</span>
              </div>

              {filteredSuites.map(suite => (
                <div
                  key={suite.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
                >
                  <div>
                    <Link
                      href={`/test-hub/admin/suites/${suite.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {suite.name}
                    </Link>
                    {suite.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">
                        {suite.description}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center">
                    {suite.sport ? (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                        {suite.sport}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSuiteBadgeClass(suite.status)}`}
                    >
                      {getSuiteStatusLabel(suite.status)}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-sm text-gray-900 font-medium">{suite.case_count}</span>
                    {suite.pending_count > 0 && (
                      <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                        {suite.pending_count} pending
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/test-hub/admin/suites/${suite.id}`}
                      className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Testers Table ---- */}
      <div>
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Testers
        </h2>
        {testersLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading testers...
          </div>
        ) : testers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">
              No testers yet. Use the invite card above to add the first tester.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Tester</span>
              <span className="text-center">Completed</span>
              <span className="text-center">Issues</span>
              <span className="text-center">Pass Rate</span>
              <span className="text-center">Last Active</span>
              <span className="text-right">Action</span>
            </div>
            {testers.map(tester => (
              <div
                key={tester.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {tester.full_name ?? tester.email ?? 'Unknown'}
                  </p>
                  {tester.full_name && tester.email && (
                    <p className="text-xs text-gray-500">{tester.email}</p>
                  )}
                  {tester.current_checkout && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Testing: {tester.current_checkout}
                    </p>
                  )}
                </div>
                <span className="text-sm text-gray-900 text-center">{tester.tests_completed}</span>
                <span className="text-sm text-center">
                  {tester.issues_flagged > 0 ? (
                    <span className="text-red-600 font-medium">{tester.issues_flagged}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </span>
                <span className="text-sm text-center">
                  {tester.pass_rate !== null ? (
                    <span className={tester.pass_rate >= 80 ? 'text-green-700 font-medium' : 'text-yellow-600 font-medium'}>
                      {tester.pass_rate}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </span>
                <span className="text-xs text-gray-500 text-center">
                  {formatRelativeTime(tester.last_active_at)}
                </span>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleRevokeTester(tester.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Recent Activity Feed ---- */}
      <div>
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Recent Activity
        </h2>
        {activityLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading activity...
          </div>
        ) : activity.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">No testing activity recorded yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {activity.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-gray-900">
                      {formatActionLabel(item.action)}
                    </span>
                    {item.resource_name && (
                      <span className="text-sm text-gray-500"> — {item.resource_name}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-2">by {item.admin_email}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {formatRelativeTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
