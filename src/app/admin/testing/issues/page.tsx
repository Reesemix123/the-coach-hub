'use client';

// src/app/admin/testing/issues/page.tsx
// Admin view of all flagged test issues with filtering, resolution toggle,
// and inline admin notes.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

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

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  teams: 'bg-blue-100 text-blue-700',
  film: 'bg-purple-100 text-purple-700',
  playbook: 'bg-indigo-100 text-indigo-700',
  analytics: 'bg-cyan-100 text-cyan-700',
  'communication-hub': 'bg-teal-100 text-teal-700',
  subscriptions: 'bg-green-100 text-green-700',
  roles: 'bg-orange-100 text-orange-700',
  practice: 'bg-yellow-100 text-yellow-700',
  'game-week': 'bg-red-100 text-red-700',
  'player-profiles': 'bg-pink-100 text-pink-700',
  general: 'bg-gray-100 text-gray-600',
};

type ResolutionStatus = 'open' | 'resolved' | 'wont_fix';
type StatusFilter = 'all' | ResolutionStatus;

// ============================================================================
// Types
// ============================================================================

interface Issue {
  completion_id: string;
  step_instruction: string | null;
  step_expected_outcome: string | null;
  test_case_title: string | null;
  test_case_category: string | null;
  tester_name: string | null;
  tester_email: string | null;
  notes: string | null;
  resolution_status: ResolutionStatus;
  admin_notes: string | null;
  flagged_at: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelative(dateString: string | null): string {
  if (!dateString) return '—';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCategoryLabel(category: string | null): string {
  if (!category) return 'General';
  return CATEGORY_LABELS[category] ?? category;
}

function getCategoryBadge(category: string | null): string {
  if (!category) return CATEGORY_BADGE_COLORS.general;
  return CATEGORY_BADGE_COLORS[category] ?? 'bg-gray-100 text-gray-600';
}

const RESOLUTION_CONFIGS: Record<
  ResolutionStatus,
  { label: string; active: string; inactive: string }
> = {
  open: {
    label: 'Open',
    active: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-500',
  },
  resolved: {
    label: 'Resolved',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
  },
  wont_fix: {
    label: "Won't Fix",
    active: 'bg-gray-200 text-gray-600',
    inactive: 'bg-gray-100 text-gray-500',
  },
};

// ============================================================================
// IssueCard component
// ============================================================================

function IssueCard({
  issue,
  onStatusChange,
  onNotesBlur,
}: {
  issue: Issue;
  onStatusChange: (completionId: string, status: ResolutionStatus) => Promise<void>;
  onNotesBlur: (completionId: string, notes: string) => Promise<void>;
}) {
  const [localNotes, setLocalNotes] = useState(issue.admin_notes ?? '');
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleStatusClick(status: ResolutionStatus) {
    if (status === issue.resolution_status) return;
    setSavingStatus(true);
    try {
      await onStatusChange(issue.completion_id, status);
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleNotesBlur() {
    if (localNotes === (issue.admin_notes ?? '')) return;
    await onNotesBlur(issue.completion_id, localNotes);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Top row: title + category badge */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          {issue.test_case_title ?? 'Untitled Test Case'}
        </h3>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${getCategoryBadge(issue.test_case_category)}`}
        >
          {getCategoryLabel(issue.test_case_category)}
        </span>
      </div>

      {/* Step instruction */}
      {issue.step_instruction && (
        <p className="text-sm text-gray-900 mb-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1.5">
            Step:
          </span>
          {issue.step_instruction}
        </p>
      )}

      {/* Expected outcome */}
      {issue.step_expected_outcome && (
        <p className="text-xs text-gray-500 italic mb-2">
          Expected: {issue.step_expected_outcome}
        </p>
      )}

      {/* Tester notes */}
      {issue.notes && (
        <blockquote className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mt-3 border-l-4 border-gray-200">
          {issue.notes}
        </blockquote>
      )}

      {/* Tester identity + timestamp */}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        <span>
          {issue.tester_name ?? issue.tester_email ?? 'Unknown tester'}
        </span>
        <span>·</span>
        <span>{formatRelative(issue.flagged_at)}</span>
      </div>

      {/* Admin notes textarea */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Admin Notes
        </label>
        <textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={2}
          placeholder="Internal notes (saved on blur)..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
        />
      </div>

      {/* Resolution buttons */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-500 mr-1">Status:</span>
        {(Object.entries(RESOLUTION_CONFIGS) as [ResolutionStatus, typeof RESOLUTION_CONFIGS[ResolutionStatus]][]).map(
          ([status, config]) => (
            <button
              key={status}
              onClick={() => handleStatusClick(status)}
              disabled={savingStatus}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50 ${
                issue.resolution_status === status
                  ? config.active
                  : config.inactive + ' hover:bg-gray-200'
              }`}
            >
              {config.label}
            </button>
          )
        )}
        {savingStatus && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-1" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function AdminTestingIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  // ------------------------------------------------------------------
  // Derive unique categories from loaded issues for the dropdown
  // ------------------------------------------------------------------
  const allCategories = Array.from(
    new Set(issues.map((i) => i.test_case_category).filter(Boolean) as string[])
  ).sort();

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/admin/testing/issues?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch issues');
      const data = await res.json();
      setIssues(data.issues ?? []);
    } catch (err) {
      console.error('Error fetching issues:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  async function handleStatusChange(completionId: string, status: ResolutionStatus) {
    // Optimistic update
    setIssues((prev) =>
      prev.map((issue) =>
        issue.completion_id === completionId
          ? { ...issue, resolution_status: status }
          : issue
      )
    );

    try {
      const res = await fetch(`/api/admin/testing/issues/${completionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_status: status }),
      });
      if (!res.ok) {
        // Roll back on error by re-fetching
        await fetchIssues();
      }
    } catch {
      await fetchIssues();
    }
  }

  async function handleNotesBlur(completionId: string, notes: string) {
    try {
      await fetch(`/api/admin/testing/issues/${completionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      });
      // Silently update local state
      setIssues((prev) =>
        prev.map((issue) =>
          issue.completion_id === completionId
            ? { ...issue, admin_notes: notes }
            : issue
        )
      );
    } catch (err) {
      console.error('Failed to save admin notes:', err);
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'wont_fix', label: "Won't Fix" },
  ];

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/testing"
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Flagged Issues</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Issues flagged by testers during test sessions.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex gap-1">
            {STATUS_FILTER_OPTIONS.map((opt) => (
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

          {/* Category filter dropdown */}
          {allCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">All Categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </option>
              ))}
            </select>
          )}

          <span className="text-sm text-gray-400 ml-auto">
            {loading ? '...' : `${issues.length} issue${issues.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Issues list */}
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-24">
            <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No flagged issues
            </h3>
            <p className="text-gray-500 text-sm">
              {statusFilter === 'all' && !categoryFilter
                ? 'Your testers are finding everything works.'
                : 'No issues match the current filters.'}
            </p>
          </div>
        ) : (
          <div>
            {issues.map((issue) => (
              <IssueCard
                key={issue.completion_id}
                issue={issue}
                onStatusChange={handleStatusChange}
                onNotesBlur={handleNotesBlur}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
