'use client';

import { useEffect, useState } from 'react';
import { Trash2, CheckCircle, XCircle, AlertTriangle, Clock, Loader2, ShieldAlert } from 'lucide-react';

interface DeletionRequest {
  id: string;
  athlete_profile_id: string;
  parent_id: string;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  completed_at: string | null;
  error_message: string | null;
  deletion_summary: Record<string, unknown> | null;
  athleteName: string;
  parentName: string;
  parentEmail: string;
}

type Filter = 'all' | 'pending' | 'approved' | 'completed' | 'rejected' | 'failed';

export default function DeletionRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deletion-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); }, []);

  async function handleReview(requestId: string, action: 'approve' | 'reject') {
    setActionLoading(requestId);
    try {
      const res = await fetch('/api/admin/deletion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, reviewNotes: reviewNotes.trim() || undefined }),
      });
      if (res.ok) {
        setReviewNotes('');
        await fetchRequests();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExecute(requestId: string) {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/admin/deletion-requests/${requestId}/execute`, {
        method: 'POST',
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        setConfirmText('');
        await fetchRequests();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = filter === 'all'
    ? requests
    : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approved': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-gray-400" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-gray-100 text-gray-600',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {statusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Trash2 className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-semibold text-gray-900">Deletion Requests</h1>
        {pendingCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            {pendingCount} pending
          </span>
        )}
        {approvedCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
            {approvedCount} awaiting execution
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'completed', 'rejected', 'failed', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No {filter === 'all' ? '' : filter} deletion requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{req.athleteName}</p>
                  <p className="text-sm text-gray-500">
                    Requested by {req.parentName} ({req.parentEmail})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(req.status)}
                </div>
              </div>

              {/* Details */}
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Submitted:</strong> {formatDate(req.requested_at)}</p>
                {req.reason && <p><strong>Reason:</strong> {req.reason}</p>}
                {req.reviewed_at && <p><strong>Reviewed:</strong> {formatDate(req.reviewed_at)}</p>}
                {req.review_notes && <p><strong>Admin notes:</strong> {req.review_notes}</p>}
                {req.completed_at && <p><strong>Completed:</strong> {formatDate(req.completed_at)}</p>}
                {req.error_message && (
                  <p className="text-red-600"><strong>Errors:</strong> {req.error_message}</p>
                )}
                {req.deletion_summary && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-400">Deletion summary</summary>
                    <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(req.deletion_summary, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* PENDING: Approve / Reject actions */}
              {req.status === 'pending' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Optional review notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(req.id, 'approve')}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      {actionLoading === req.id ? 'Processing...' : 'Approve for Deletion'}
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'reject')}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* APPROVED: Execute Deletion (two-step confirm) */}
              {req.status === 'approved' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {confirmDeleteId !== req.id ? (
                    <button
                      onClick={() => { setConfirmDeleteId(req.id); setConfirmText(''); }}
                      className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Execute Deletion...
                    </button>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-900">
                            This action is permanent and irreversible.
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            This will permanently delete <strong>{req.athleteName}&apos;s</strong> profile,
                            all clips, all reports, cancel any Stripe subscription, and remove all
                            associated Mux video assets. This data cannot be recovered.
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-red-800 mb-2">
                        Type <strong>DELETE</strong> to confirm:
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type DELETE"
                        className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm text-gray-900 mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExecute(req.id)}
                          disabled={confirmText !== 'DELETE' || actionLoading === req.id}
                          className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === req.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                            </span>
                          ) : (
                            'Permanently Delete All Data'
                          )}
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(null); setConfirmText(''); }}
                          className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
