'use client';

// Admin Trial Requests Management
// View and approve/deny trial requests from users

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Gift, Check, X, Clock, User, Calendar, Building2, Mail } from 'lucide-react';

interface TrialRequest {
  id: string;
  user_id: string | null;
  team_id: string | null;
  requested_tier: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  granted_trial_days: number | null;
  created_at: string;
  // Guest request fields
  guest_email: string | null;
  guest_name: string | null;
  // Joined data
  teams: { id: string; name: string } | null;
  profiles: { id: string; email: string; full_name: string | null } | null;
}

const TIER_NAMES: Record<string, string> = {
  little_league: 'Little League',
  hs_basic: 'High School Basic',
  hs_advanced: 'High School Advanced',
  ai_powered: 'AI-Powered'
};

export default function TrialRequestsPage() {
  const [requests, setRequests] = useState<TrialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState<Record<string, number>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const supabase = createClient();

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  async function fetchRequests() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }

      const response = await fetch(`/api/trial-requests?${params}`);
      const data = await response.json();

      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(requestId: string, action: 'approve' | 'deny') {
    setProcessing(requestId);

    try {
      const response = await fetch(`/api/trial-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          trial_days: trialDays[requestId] || 14,
          admin_notes: adminNotes[requestId] || null
        })
      });

      if (response.ok) {
        // Refresh the list
        await fetchRequests();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to process request');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Failed to process request');
    } finally {
      setProcessing(null);
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Gift className="w-8 h-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Trial Requests</h1>
          {pendingCount > 0 && (
            <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-gray-600">Review and approve free trial requests from users</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'denied', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {filter === 'pending'
              ? 'No pending trial requests'
              : `No ${filter} requests`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between gap-6">
                {/* Request Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      request.status === 'pending' ? 'bg-yellow-100' :
                      request.status === 'approved' ? 'bg-green-100' :
                      'bg-red-100'
                    }`}>
                      {request.status === 'pending' ? (
                        <Clock className={`w-5 h-5 text-yellow-600`} />
                      ) : request.status === 'approved' ? (
                        <Check className={`w-5 h-5 text-green-600`} />
                      ) : (
                        <X className={`w-5 h-5 text-red-600`} />
                      )}
                    </div>
                    <div>
                      {/* Show name first if available */}
                      {(request.guest_name || request.profiles?.full_name) && (
                        <div className="font-medium text-gray-900">
                          {request.guest_name || request.profiles?.full_name}
                        </div>
                      )}
                      {/* Show email as clickable link */}
                      {(request.guest_email || request.profiles?.email) && (
                        <a
                          href={`mailto:${request.guest_email || request.profiles?.email}?subject=Your Coach Hub Trial Request`}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          {request.guest_email || request.profiles?.email}
                        </a>
                      )}
                    </div>
                    {/* Guest badge */}
                    {request.guest_email && !request.user_id && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        Guest
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Gift className="w-4 h-4" />
                      <span>Requested: {TIER_NAMES[request.requested_tier] || request.requested_tier}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                    {request.teams && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="w-4 h-4" />
                        <span>Team: {request.teams.name}</span>
                      </div>
                    )}
                  </div>

                  {request.reason && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                      <span className="font-medium">Reason: </span>
                      {request.reason}
                    </div>
                  )}

                  {request.admin_notes && request.status !== 'pending' && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="font-medium">Admin notes: </span>
                      {request.admin_notes}
                    </div>
                  )}

                  {request.status === 'approved' && request.granted_trial_days && (
                    <div className="mt-2 text-sm text-green-600">
                      Granted {request.granted_trial_days} day trial
                    </div>
                  )}
                </div>

                {/* Actions for pending requests */}
                {request.status === 'pending' && (
                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Trial Days
                      </label>
                      <select
                        value={trialDays[request.id] || 14}
                        onChange={(e) => setTrialDays({
                          ...trialDays,
                          [request.id]: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                      >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={adminNotes[request.id] || ''}
                        onChange={(e) => setAdminNotes({
                          ...adminNotes,
                          [request.id]: e.target.value
                        })}
                        placeholder="Add a note..."
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(request.id, 'approve')}
                        disabled={processing === request.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(request.id, 'deny')}
                        disabled={processing === request.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Deny
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
