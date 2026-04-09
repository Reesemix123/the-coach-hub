'use client';

// src/app/test-hub/admin/suites/[suiteId]/page.tsx
// Suite Detail - view and manage all test cases within a single suite

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// ============================================
// TYPES
// ============================================

interface Suite {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
}

interface TestCase {
  id: string;
  title: string;
  category: string;
  status: 'draft' | 'active' | 'archived' | 'pending_review';
  display_order: number;
  auto_generated: boolean;
}

type StatusFilter = 'all' | 'active' | 'pending_review' | 'draft' | 'archived';

// ============================================
// HELPERS
// ============================================

function getSuiteBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-gray-100 text-gray-600';
    case 'archived': return 'bg-red-100 text-red-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getCaseBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-gray-100 text-gray-600';
    case 'archived': return 'bg-red-100 text-red-600';
    case 'pending_review': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getCaseBadgeLabel(status: string): string {
  switch (status) {
    case 'pending_review': return 'Pending Review';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getCategoryBadgeClass(category: string): string {
  const map: Record<string, string> = {
    teams: 'bg-blue-100 text-blue-700',
    film: 'bg-purple-100 text-purple-700',
    playbook: 'bg-green-100 text-green-700',
    analytics: 'bg-orange-100 text-orange-700',
    general: 'bg-gray-100 text-gray-600',
  };
  return map[category] ?? 'bg-gray-100 text-gray-600';
}

function formatCategoryLabel(category: string): string {
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
  return map[category] ?? category;
}

// ============================================
// COMPONENT
// ============================================

export default function SuiteDetailPage({
  params,
}: {
  params: Promise<{ suiteId: string }>;
}) {
  const { suiteId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [suite, setSuite] = useState<Suite | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [allSuites, setAllSuites] = useState<Suite[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [moving, setMoving] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [archivingSuite, setArchivingSuite] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedStatus, setEditedStatus] = useState<Suite['status']>('draft');
  const [savingMeta, setSavingMeta] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_platform_admin) {
        router.push('/test-hub');
        return;
      }

      // Fetch suite
      const { data: suiteData, error: suiteError } = await supabase
        .from('test_suites')
        .select('id, name, description, status')
        .eq('id', suiteId)
        .single();

      if (suiteError || !suiteData) {
        router.push('/test-hub/admin');
        return;
      }

      setSuite(suiteData as Suite);
      setEditedName(suiteData.name);
      setEditedStatus(suiteData.status as Suite['status']);

      // Fetch cases ordered by display_order
      const { data: casesData, error: casesError } = await supabase
        .from('test_cases')
        .select('id, title, category, status, display_order, auto_generated')
        .eq('suite_id', suiteId)
        .order('display_order', { ascending: true });

      if (casesError) throw new Error(`Failed to fetch cases: ${casesError.message}`);

      setCases((casesData ?? []) as TestCase[]);

      // Fetch all suites for "move to" dropdown
      const { data: suitesData } = await supabase
        .from('test_suites')
        .select('id, name, description, status')
        .order('created_at', { ascending: false });

      setAllSuites((suitesData ?? []) as Suite[]);
    } finally {
      setLoading(false);
    }
  }, [suiteId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const current = cases[index];
    const above = cases[index - 1];

    await fetch(`/api/test-hub/cases/${current.id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: above.display_order }),
    });
    await fetch(`/api/test-hub/cases/${above.id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: current.display_order }),
    });

    // Optimistic local swap
    setCases(prev => {
      const next = [...prev];
      next[index] = { ...current, display_order: above.display_order };
      next[index - 1] = { ...above, display_order: current.display_order };
      return next.sort((a, b) => a.display_order - b.display_order);
    });
  }

  async function handleMoveDown(index: number) {
    if (index === cases.length - 1) return;
    const current = cases[index];
    const below = cases[index + 1];

    await fetch(`/api/test-hub/cases/${current.id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: below.display_order }),
    });
    await fetch(`/api/test-hub/cases/${below.id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: current.display_order }),
    });

    setCases(prev => {
      const next = [...prev];
      next[index] = { ...current, display_order: below.display_order };
      next[index + 1] = { ...below, display_order: current.display_order };
      return next.sort((a, b) => a.display_order - b.display_order);
    });
  }

  async function handleMoveToSuite(caseId: string, newSuiteId: string) {
    if (!newSuiteId || newSuiteId === suiteId) return;
    setMoving(caseId);
    try {
      const res = await fetch(`/api/test-hub/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite_id: newSuiteId }),
      });

      if (res.ok) {
        setCases(prev => prev.filter(c => c.id !== caseId));
      }
    } finally {
      setMoving(null);
    }
  }

  async function handleApproveCase(caseId: string) {
    setApprovingId(caseId);
    try {
      const res = await fetch(`/api/test-hub/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (res.ok) {
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: 'active' } : c));
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function handleArchiveSuite() {
    if (!suite) return;
    setArchivingSuite(true);
    try {
      const res = await fetch(`/api/test-hub/suites/${suiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (res.ok) {
        setSuite(prev => prev ? { ...prev, status: 'archived' } : null);
      }
    } finally {
      setArchivingSuite(false);
    }
  }

  async function handleSaveMeta() {
    if (!suite) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/test-hub/suites/${suiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName, status: editedStatus }),
      });

      if (res.ok) {
        setSuite(prev => prev ? { ...prev, name: editedName, status: editedStatus } : null);
        setEditingName(false);
      }
    } finally {
      setSavingMeta(false);
    }
  }

  const hasActiveCases = cases.some(c => c.status === 'active');

  const filteredCases =
    statusFilter === 'all'
      ? cases
      : cases.filter(c => c.status === statusFilter);

  const statusCounts: Record<StatusFilter, number> = {
    all: cases.length,
    active: cases.filter(c => c.status === 'active').length,
    pending_review: cases.filter(c => c.status === 'pending_review').length,
    draft: cases.filter(c => c.status === 'draft').length,
    archived: cases.filter(c => c.status === 'archived').length,
  };

  const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ];

  const otherSuites = allSuites.filter(s => s.id !== suiteId);

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!suite) return null;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-3">
            <Link
              href="/test-hub/admin"
              className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
              aria-label="Back to admin"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Link href="/test-hub/admin" className="hover:text-gray-700 transition-colors">
                  Admin
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">{suite?.name || 'Suite'}</span>
              </div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    className="text-2xl font-semibold border border-gray-300 rounded-lg px-3 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <select
                    value={editedStatus}
                    onChange={e => setEditedStatus(e.target.value as Suite['status'])}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    onClick={handleSaveMeta}
                    disabled={savingMeta || !editedName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {savingMeta && <Loader2 size={13} className="animate-spin" />}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setEditedName(suite.name);
                      setEditedStatus(suite.status);
                    }}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-gray-900">{suite.name}</h1>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSuiteBadgeClass(suite.status)}`}>
                    {suite.status.charAt(0).toUpperCase() + suite.status.slice(1)}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {cases.length} test case{cases.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {suite.status !== 'archived' && !hasActiveCases && (
            <button
              onClick={handleArchiveSuite}
              disabled={archivingSuite}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {archivingSuite && <Loader2 size={14} className="animate-spin" />}
              Archive Suite
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-4">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  statusFilter === opt.value
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {statusCounts[opt.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Cases table */}
        <div className="bg-white rounded-xl border border-gray-200">
          {filteredCases.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500">
                {statusFilter === 'all'
                  ? 'No test cases in this suite yet.'
                  : `No ${statusFilter} test cases.`}
              </p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>#</span>
                <span>Title</span>
                <span className="text-center">Category</span>
                <span className="text-center">Status</span>
                <span className="text-center">Approve</span>
                <span className="text-center">Move To</span>
                <span className="text-right">Reorder</span>
              </div>

              {filteredCases.map((tc, idx) => {
                const actualIndex = cases.indexOf(tc);
                return (
                  <div
                    key={tc.id}
                    className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center"
                  >
                    {/* Display order */}
                    <span className="text-xs text-gray-400 font-mono">
                      {tc.display_order}
                    </span>

                    {/* Title */}
                    <div>
                      <span className="text-sm font-medium text-gray-900">{tc.title}</span>
                      {tc.auto_generated && (
                        <span className="ml-2 bg-purple-100 text-purple-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                          AI
                        </span>
                      )}
                    </div>

                    {/* Category */}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(tc.category)}`}>
                      {formatCategoryLabel(tc.category)}
                    </span>

                    {/* Status */}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCaseBadgeClass(tc.status)}`}>
                      {getCaseBadgeLabel(tc.status)}
                    </span>

                    {/* Approve button */}
                    <div className="flex justify-center">
                      {tc.status === 'pending_review' ? (
                        <button
                          onClick={() => handleApproveCase(tc.id)}
                          disabled={approvingId === tc.id}
                          className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {approvingId === tc.id ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>

                    {/* Move to suite dropdown */}
                    <div className="flex justify-center">
                      {moving === tc.id ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <select
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) {
                              handleMoveToSuite(tc.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                          disabled={otherSuites.length === 0}
                        >
                          <option value="" disabled>
                            {otherSuites.length === 0 ? 'No other suites' : 'Move to...'}
                          </option>
                          {otherSuites.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Reorder arrows */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleMoveUp(actualIndex)}
                        disabled={actualIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move up"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveDown(actualIndex)}
                        disabled={actualIndex === cases.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move down"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
