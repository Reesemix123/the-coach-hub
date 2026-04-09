'use client';

// src/components/test-hub/admin/SuitesTab.tsx
// Admin Suites Tab — collapsible sections for invite, metrics, coverage, active checkouts,
// suites (with inline expansion), testers, and recent activity feed.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Plus, X, Mail, RefreshCw, ChevronRight, ChevronUp, ChevronDown, Bot } from 'lucide-react';
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

interface SuiteTestCase {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  display_order: number;
  auto_generated: boolean;
  steps: SuiteTestStep[];
}

interface SuiteTestStep {
  id: string;
  step_type: 'setup' | 'test';
  display_order: number;
  instruction: string;
  expected_outcome: string | null;
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

function getCategoryBadgeClass(cat: string): string {
  const map: Record<string, string> = {
    teams: 'bg-blue-100 text-blue-700',
    film: 'bg-purple-100 text-purple-700',
    playbook: 'bg-green-100 text-green-700',
    analytics: 'bg-orange-100 text-orange-700',
    general: 'bg-gray-100 text-gray-600',
  };
  return map[cat] ?? 'bg-gray-100 text-gray-600';
}

function formatCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    teams: 'Teams',
    film: 'Film',
    playbook: 'Playbook',
    analytics: 'Analytics',
    'communication-hub': 'Communication',
    subscriptions: 'Subscriptions',
    roles: 'Roles',
    practice: 'Practice',
    'game-week': 'Game Planning',
    'player-profiles': 'Players',
    general: 'General',
  };
  return map[cat] ?? cat;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-600',
};

// ============================================
// COMPONENT
// ============================================

export function SuitesTab({ onSuiteCreated }: SuitesTabProps) {
  // --- Collapsible sections state ---
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

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

  // --- Inline suite expansion state ---
  const [expandedSuiteId, setExpandedSuiteId] = useState<string | null>(null);
  const [suiteCases, setSuiteCases] = useState<SuiteTestCase[]>([]);
  const [suiteCasesLoading, setSuiteCasesLoading] = useState(false);
  const [suiteStatusFilter, setSuiteStatusFilter] = useState<'all' | string>('all');
  const [approvingCaseId, setApprovingCaseId] = useState<string | null>(null);
  const [expandedCaseSteps, setExpandedCaseSteps] = useState<Set<string>>(new Set());

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
  // COLLAPSIBLE SECTION HELPERS
  // ============================================

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function CollapsibleSection({
    id,
    title,
    badge,
    children,
  }: {
    id: string;
    title: string;
    badge?: number;
    children: React.ReactNode;
  }) {
    const isOpen = openSections.has(id);
    return (
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {badge !== undefined && badge > 0 && (
              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <ChevronRight
            size={20}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>
        {isOpen && <div className="px-6 pb-6">{children}</div>}
      </div>
    );
  }

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
  // INLINE SUITE EXPANSION HANDLERS
  // ============================================

  async function handleExpandSuite(suiteId: string) {
    if (expandedSuiteId === suiteId) {
      setExpandedSuiteId(null);
      return;
    }
    setExpandedSuiteId(suiteId);
    setSuiteStatusFilter('all');
    setSuiteCasesLoading(true);
    try {
      const supabase = createClient();
      const { data: casesData } = await supabase
        .from('test_cases')
        .select('*')
        .eq('suite_id', suiteId)
        .order('display_order');

      const caseIds = (casesData ?? []).map(c => c.id);
      let stepsData: Record<string, unknown>[] = [];
      if (caseIds.length > 0) {
        const { data } = await supabase
          .from('test_steps')
          .select('*')
          .in('test_case_id', caseIds)
          .order('step_type')
          .order('display_order');
        stepsData = data ?? [];
      }

      const stepsByCase = new Map<string, SuiteTestStep[]>();
      for (const step of stepsData) {
        const caseId = step.test_case_id as string;
        const existing = stepsByCase.get(caseId) ?? [];
        existing.push(step as unknown as SuiteTestStep);
        stepsByCase.set(caseId, existing);
      }

      const cases: SuiteTestCase[] = (casesData ?? []).map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        display_order: c.display_order,
        auto_generated: c.auto_generated ?? false,
        steps: stepsByCase.get(c.id) ?? [],
      }));

      setSuiteCases(cases);
      // Default all case step sections to open
      setExpandedCaseSteps(new Set(cases.map(c => c.id)));
    } finally {
      setSuiteCasesLoading(false);
    }
  }

  async function handleApproveSuiteCase(caseId: string) {
    setApprovingCaseId(caseId);
    try {
      const res = await fetch(`/api/test-hub/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (res.ok) {
        setSuiteCases(prev =>
          prev.map(c => (c.id === caseId ? { ...c, status: 'active' } : c))
        );
      }
    } finally {
      setApprovingCaseId(null);
    }
  }

  async function handleMoveSuiteCase(caseId: string, newSuiteId: string) {
    const res = await fetch(`/api/test-hub/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite_id: newSuiteId }),
    });
    if (res.ok) {
      setSuiteCases(prev => prev.filter(c => c.id !== caseId));
      fetchSuites();
    }
  }

  async function handleReorderSuiteCase(caseId: string, direction: 'up' | 'down') {
    const filtered =
      suiteStatusFilter === 'all'
        ? suiteCases
        : suiteCases.filter(c => c.status === suiteStatusFilter);
    const idx = filtered.findIndex(c => c.id === caseId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === filtered.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const current = filtered[idx];
    const neighbor = filtered[swapIdx];

    // Optimistic swap
    setSuiteCases(prev =>
      prev.map(c => {
        if (c.id === current.id) return { ...c, display_order: neighbor.display_order };
        if (c.id === neighbor.id) return { ...c, display_order: current.display_order };
        return c;
      })
    );

    await Promise.all([
      fetch(`/api/test-hub/cases/${current.id}/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: neighbor.display_order }),
      }),
      fetch(`/api/test-hub/cases/${neighbor.id}/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: current.display_order }),
      }),
    ]);
  }

  function toggleCaseSteps(caseId: string) {
    setExpandedCaseSteps(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

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

      await fetchSuites();
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
      // Non-critical — tester list will reflect actual state on next refresh
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

  const SUITE_CASE_STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ];

  const filteredSuiteCases =
    suiteStatusFilter === 'all'
      ? suiteCases
      : suiteCases.filter(c => c.status === suiteStatusFilter);

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
    <div>

      {/* ---- 1. Invite Tester ---- */}
      <CollapsibleSection id="invite" title="Invite Tester">
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
      </CollapsibleSection>

      {/* ---- 2. Metrics ---- */}
      <CollapsibleSection id="metrics" title="Metrics">
        {/* 4 operational metric cards */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</p>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Total Suites</p>
              <p className="text-3xl font-semibold text-gray-900">{suites.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Active Cases</p>
              <p className="text-3xl font-semibold text-gray-900">{totalCases}</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
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
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Active Sessions</p>
              <p className="text-3xl font-semibold text-gray-900">{activeSessions}</p>
            </div>
          </div>
        </div>

        {/* 3 coverage metric cards */}
        {coverageLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading coverage...
          </div>
        ) : coverage ? (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Feature Coverage
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Covered</p>
                <p className="text-3xl font-semibold text-green-700">{coverage.totals.covered}</p>
                <p className="text-xs text-gray-400 mt-1">of {coverage.totals.total_features} features</p>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Pending Review</p>
                <p className="text-3xl font-semibold text-yellow-600">{coverage.totals.pending_review}</p>
                <p className="text-xs text-gray-400 mt-1">awaiting approval</p>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Not Covered</p>
                <p className="text-3xl font-semibold text-gray-900">{coverage.totals.not_covered}</p>
                <p className="text-xs text-gray-400 mt-1">features without tests</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Coverage data unavailable.</p>
        )}
      </CollapsibleSection>

      {/* ---- 3. Coverage Breakdown ---- */}
      <CollapsibleSection id="coverage" title="Coverage Breakdown">
        {coverageLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading coverage...
          </div>
        ) : coverage ? (
          <>
            {/* Overall progress bar */}
            <div className="mb-6">
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
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
      </CollapsibleSection>

      {/* ---- 4. Active Checkouts ---- */}
      <CollapsibleSection id="checkouts" title="Active Checkouts" badge={checkouts.length}>
        <div className="flex justify-end mb-4">
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
          <div className="bg-gray-50 rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">No active checkouts right now.</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
      </CollapsibleSection>

      {/* ---- 5. Test Suites ---- */}
      <CollapsibleSection id="suites" title="Test Suites" badge={suites.length}>
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
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-4">
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

        {/* Suites list with inline expansion */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
                <span className="text-right">Detail</span>
              </div>

              {filteredSuites.map(suite => (
                <div key={suite.id}>
                  {/* Suite row */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 items-center">
                    <div>
                      <button
                        onClick={() => handleExpandSuite(suite.id)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {suite.name}
                      </button>
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
                      <button
                        onClick={() => handleExpandSuite(suite.id)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                      >
                        {expandedSuiteId === suite.id ? 'Collapse' : 'Expand'}
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${expandedSuiteId === suite.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Inline expanded suite detail */}
                  {expandedSuiteId === suite.id && (
                    <div className="border-b border-gray-100 bg-white">
                      {suiteCasesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 px-8 py-6">
                          <Loader2 size={16} className="animate-spin" /> Loading cases...
                        </div>
                      ) : (
                        <div className="px-8 py-4">
                          {/* Case status filter tabs */}
                          <div className="flex items-center gap-1 mb-4 flex-wrap">
                            {SUITE_CASE_STATUS_OPTIONS.map(opt => {
                              const count =
                                opt.value === 'all'
                                  ? suiteCases.length
                                  : suiteCases.filter(c => c.status === opt.value).length;
                              if (opt.value !== 'all' && count === 0) return null;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => setSuiteStatusFilter(opt.value)}
                                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                                    suiteStatusFilter === opt.value
                                      ? 'bg-gray-900 text-white'
                                      : 'text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {opt.label}
                                  {count > 0 && (
                                    <span className="ml-1.5 opacity-70">{count}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Cases list */}
                          {filteredSuiteCases.length === 0 ? (
                            <p className="text-sm text-gray-500 py-4">
                              {suiteStatusFilter === 'all'
                                ? 'No test cases in this suite.'
                                : `No ${suiteStatusFilter.replace('_', ' ')} cases.`}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {filteredSuiteCases
                                .slice()
                                .sort((a, b) => a.display_order - b.display_order)
                                .map((tc, idx) => {
                                  const stepsOpen = expandedCaseSteps.has(tc.id);
                                  const isFirst = idx === 0;
                                  const isLast = idx === filteredSuiteCases.length - 1;
                                  return (
                                    <div
                                      key={tc.id}
                                      className="border border-gray-200 rounded-lg overflow-hidden"
                                    >
                                      {/* Case header row */}
                                      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                                        {/* Chevron to toggle steps */}
                                        <button
                                          onClick={() => toggleCaseSteps(tc.id)}
                                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                        >
                                          <ChevronRight
                                            size={14}
                                            className={`transition-transform ${stepsOpen ? 'rotate-90' : ''}`}
                                          />
                                        </button>

                                        {/* Title */}
                                        <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">
                                          {tc.title}
                                        </span>

                                        {/* AI badge */}
                                        {tc.auto_generated && (
                                          <span className="flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                                            <Bot size={10} />
                                            AI
                                          </span>
                                        )}

                                        {/* Category badge */}
                                        <span
                                          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getCategoryBadgeClass(tc.category)}`}
                                        >
                                          {formatCategoryLabel(tc.category)}
                                        </span>

                                        {/* Status badge */}
                                        <span
                                          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[tc.status] ?? 'bg-gray-100 text-gray-600'}`}
                                        >
                                          {getSuiteStatusLabel(tc.status)}
                                        </span>

                                        {/* Approve button */}
                                        {tc.status === 'pending_review' && (
                                          <button
                                            onClick={() => handleApproveSuiteCase(tc.id)}
                                            disabled={approvingCaseId === tc.id}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                          >
                                            {approvingCaseId === tc.id && (
                                              <Loader2 size={10} className="animate-spin" />
                                            )}
                                            Approve
                                          </button>
                                        )}

                                        {/* Move To dropdown */}
                                        <select
                                          defaultValue=""
                                          onChange={e => {
                                            if (e.target.value) {
                                              handleMoveSuiteCase(tc.id, e.target.value);
                                              e.target.value = '';
                                            }
                                          }}
                                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 flex-shrink-0"
                                        >
                                          <option value="" disabled>Move to...</option>
                                          {suites
                                            .filter(s => s.id !== expandedSuiteId)
                                            .map(s => (
                                              <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>

                                        {/* Reorder arrows */}
                                        <div className="flex flex-col flex-shrink-0">
                                          <button
                                            onClick={() => handleReorderSuiteCase(tc.id, 'up')}
                                            disabled={isFirst}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                          >
                                            <ChevronUp size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleReorderSuiteCase(tc.id, 'down')}
                                            disabled={isLast}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                          >
                                            <ChevronDown size={12} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Steps */}
                                      {stepsOpen && tc.steps.length > 0 && (
                                        <div className="px-4 pb-3 pt-2 space-y-2">
                                          {/* Setup steps */}
                                          {tc.steps.filter(s => s.step_type === 'setup').length > 0 && (
                                            <div>
                                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                                Setup
                                              </p>
                                              <div className="space-y-1.5">
                                                {tc.steps
                                                  .filter(s => s.step_type === 'setup')
                                                  .sort((a, b) => a.display_order - b.display_order)
                                                  .map(step => (
                                                    <div key={step.id} className="flex gap-3 text-sm">
                                                      <span className="text-gray-400 flex-shrink-0 w-4 text-right">
                                                        {step.display_order}.
                                                      </span>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-gray-700">{step.instruction}</p>
                                                        {step.expected_outcome && (
                                                          <p className="text-xs text-gray-400 mt-0.5">
                                                            Expected: {step.expected_outcome}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Test steps */}
                                          {tc.steps.filter(s => s.step_type === 'test').length > 0 && (
                                            <div>
                                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                                Test Steps
                                              </p>
                                              <div className="space-y-1.5">
                                                {tc.steps
                                                  .filter(s => s.step_type === 'test')
                                                  .sort((a, b) => a.display_order - b.display_order)
                                                  .map(step => (
                                                    <div key={step.id} className="flex gap-3 text-sm">
                                                      <span className="text-gray-400 flex-shrink-0 w-4 text-right">
                                                        {step.display_order}.
                                                      </span>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-gray-700">{step.instruction}</p>
                                                        {step.expected_outcome && (
                                                          <p className="text-xs text-gray-400 mt-0.5">
                                                            Expected: {step.expected_outcome}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {stepsOpen && tc.steps.length === 0 && (
                                        <p className="px-4 pb-3 pt-2 text-xs text-gray-400">
                                          No steps defined for this case.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ---- 6. Active Testers ---- */}
      <CollapsibleSection id="testers" title="Active Testers" badge={testers.length}>
        {testersLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading testers...
          </div>
        ) : testers.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">
              No testers yet. Use the Invite Tester section above to add the first tester.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
      </CollapsibleSection>

      {/* ---- 7. Recent Activity ---- */}
      <CollapsibleSection id="activity" title="Recent Activity">
        {activityLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading activity...
          </div>
        ) : activity.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">No testing activity recorded yet.</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
      </CollapsibleSection>

    </div>
  );
}
