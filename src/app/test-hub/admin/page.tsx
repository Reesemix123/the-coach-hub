'use client';

// src/app/test-hub/admin/page.tsx
// Test Hub Admin Dashboard - Overview of all test suites and key metrics

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
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

// ============================================
// COMPONENT
// ============================================

export default function TestHubAdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewSuiteForm, setShowNewSuiteForm] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

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

      // Fetch all suites
      const { data: suitesData, error: suitesError } = await supabase
        .from('test_suites')
        .select('*')
        .order('created_at', { ascending: false });

      if (suitesError) throw new Error(`Failed to fetch suites: ${suitesError.message}`);

      // Fetch all test cases to count per suite
      const { data: casesData } = await supabase
        .from('test_cases')
        .select('suite_id, status');

      // Fetch active sessions count
      const { data: sessionsData } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('status', 'active');

      setActiveSessions(sessionsData?.length ?? 0);

      // Build counts map
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
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create suite');
      }

      setNewSuiteName('');
      setNewSuiteDesc('');
      setShowNewSuiteForm(false);
      await fetchData();
    } finally {
      setCreating(false);
    }
  }

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

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Test Hub Admin</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage test suites, generate AI test cases, and review the queue.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/test-hub/admin/review"
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              Review Queue
              {pendingTotal > 0 && (
                <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {pendingTotal}
                </span>
              )}
            </Link>
            <Link
              href="/test-hub/admin/generate"
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors"
            >
              Generate Tests
            </Link>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
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
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Active Sessions</p>
            <p className="text-3xl font-semibold text-gray-900">{activeSessions}</p>
          </div>
        </div>

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
              {/* Table header */}
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
                  {/* Name + description */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{suite.name}</p>
                    {suite.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">
                        {suite.description}
                      </p>
                    )}
                  </div>

                  {/* Sport badge */}
                  <div className="flex justify-center">
                    {suite.sport ? (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                        {suite.sport}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="flex justify-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSuiteBadgeClass(suite.status)}`}
                    >
                      {getSuiteStatusLabel(suite.status)}
                    </span>
                  </div>

                  {/* Case counts */}
                  <div className="text-center">
                    <span className="text-sm text-gray-900 font-medium">{suite.case_count}</span>
                    {suite.pending_count > 0 && (
                      <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                        {suite.pending_count} pending
                      </span>
                    )}
                  </div>

                  {/* View link */}
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
    </div>
  );
}
