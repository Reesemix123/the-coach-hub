'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  ArrowLeft,
  RefreshCw,
  Users,
  Layers,
  DollarSign,
  Activity,
  Clock,
  Mail,
  UserCircle,
  Shield,
  AlertCircle,
  ExternalLink,
  History,
  Zap,
  Eye,
  Gift,
  Plus,
  X,
  CalendarPlus
} from 'lucide-react';
import {
  OrganizationDetail,
  OrganizationDerivedStatus,
  TeamWithSubscription,
  ProfileWithAdmin,
  AuditLog,
  SubscriptionTier
} from '@/types/admin';

// Status badge colors
const STATUS_COLORS: Record<OrganizationDerivedStatus, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-red-100 text-red-800',
  churned: 'bg-gray-100 text-gray-800',
  inactive: 'bg-yellow-100 text-yellow-800'
};

const STATUS_LABELS: Record<OrganizationDerivedStatus, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past Due',
  churned: 'Churned',
  inactive: 'Inactive'
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium'
};

function formatMRR(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

type TabType = 'overview' | 'teams' | 'users' | 'billing' | 'activity';

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Impersonation state
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Organization not found');
        }
        throw new Error('Failed to fetch organization');
      }
      const data: OrganizationDetail = await response.json();
      setOrg(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleImpersonate = async () => {
    if (impersonateReason.trim().length < 10) {
      setImpersonateError('Reason must be at least 10 characters');
      return;
    }

    setImpersonateLoading(true);
    setImpersonateError(null);

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: impersonateReason.trim(),
          duration_minutes: 60
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create impersonation session');
      }

      const data = await response.json();

      // Open impersonation in new tab
      window.open(data.redirect_url, '_blank');

      setShowImpersonateModal(false);
      setImpersonateReason('');
    } catch (err) {
      setImpersonateError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setImpersonateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push('/admin/organizations')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-800">{error || 'Organization not found'}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof Building2 }[] = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'teams', label: 'Teams', icon: Layers },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'activity', label: 'Activity', icon: History }
  ];

  return (
    <div className="p-8">
      {/* Back button */}
      <button
        onClick={() => router.push('/admin/organizations')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-xl">
            <Building2 className="w-8 h-8 text-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{org.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-sm font-medium ${STATUS_COLORS[org.derived_status]}`}>
                {STATUS_LABELS[org.derived_status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 font-mono mt-1">{org.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrganization}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowImpersonateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            <Eye className="w-4 h-4" />
            Impersonate
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{org.teams.length}</p>
              <p className="text-sm text-gray-500">Teams</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{org.users.length}</p>
              <p className="text-sm text-gray-500">Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{formatMRR(org.total_mrr_cents)}</p>
              <p className="text-sm text-gray-500">MRR</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        {activeTab === 'overview' && (
          <OverviewTab org={org} />
        )}
        {activeTab === 'teams' && (
          <TeamsTab teams={org.teams} onRefresh={fetchOrganization} />
        )}
        {activeTab === 'users' && (
          <UsersTab users={org.users} owner={org.owner} />
        )}
        {activeTab === 'billing' && (
          <BillingTab org={org} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab activity={org.recent_activity} />
        )}
      </div>

      {/* Impersonate Modal */}
      {showImpersonateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Impersonate Organization Owner
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to impersonate <strong>{org.owner.email}</strong>. This action will be logged.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for impersonation *
            </label>
            <textarea
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder="e.g., Investigating support ticket #1234"
              className="w-full px-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-24"
            />
            {impersonateError && (
              <p className="text-sm text-red-600 mt-2">{impersonateError}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowImpersonateModal(false);
                  setImpersonateReason('');
                  setImpersonateError(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImpersonate}
                disabled={impersonateLoading}
                className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {impersonateLoading ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ org }: { org: OrganizationDetail }) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Organization Details</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium text-gray-900">{org.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[org.derived_status]}`}>
                  {STATUS_LABELS[org.derived_status]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Billing Email</dt>
              <dd className="text-sm font-medium text-gray-900">{org.billing_email || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm font-medium text-gray-900">{formatDate(org.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Stripe Customer ID</dt>
              <dd className="text-sm font-mono text-gray-900">{org.stripe_customer_id || 'Not connected'}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Owner</h3>
          <dl className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-full">
                <UserCircle className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <dd className="text-sm font-medium text-gray-900">{org.owner.full_name || 'No name'}</dd>
                <dd className="text-sm text-gray-500">{org.owner.email}</dd>
              </div>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Last Active</dt>
              <dd className="text-sm font-medium text-gray-900">{formatRelativeTime(org.owner.last_active_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

interface TrialModalState {
  isOpen: boolean;
  mode: 'start' | 'extend' | 'end' | null;
  team: TeamWithSubscription | null;
}

function TeamsTab({ teams, onRefresh }: { teams: TeamWithSubscription[]; onRefresh: () => void }) {
  const [trialModal, setTrialModal] = useState<TrialModalState>({
    isOpen: false,
    mode: null,
    team: null
  });
  const [trialForm, setTrialForm] = useState({
    tier: 'plus',
    duration_days: 14,
    additional_days: 7,
    new_status: 'expired' as 'expired' | 'canceled' | 'active'
  });
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const openTrialModal = (mode: 'start' | 'extend' | 'end', team: TeamWithSubscription) => {
    setTrialModal({ isOpen: true, mode, team });
    setTrialError(null);
  };

  const closeTrialModal = () => {
    setTrialModal({ isOpen: false, mode: null, team: null });
    setTrialError(null);
  };

  const handleTrialAction = async () => {
    if (!trialModal.team || !trialModal.mode) return;
    setTrialLoading(true);
    setTrialError(null);

    try {
      let response: Response;
      const teamId = trialModal.team.id;

      if (trialModal.mode === 'start') {
        response = await fetch(`/api/admin/teams/${teamId}/trial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: trialForm.tier,
            duration_days: trialForm.duration_days
          })
        });
      } else if (trialModal.mode === 'extend') {
        response = await fetch(`/api/admin/teams/${teamId}/trial`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            additional_days: trialForm.additional_days
          })
        });
      } else {
        response = await fetch(`/api/admin/teams/${teamId}/trial`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_status: trialForm.new_status
          })
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to perform trial action');
      }

      closeTrialModal();
      onRefresh();
    } catch (err) {
      setTrialError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setTrialLoading(false);
    }
  };

  const calculateDaysRemaining = (trialEndsAt: string | null): number => {
    if (!trialEndsAt) return 0;
    const end = new Date(trialEndsAt);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trial Info</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {teams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No teams yet
                </td>
              </tr>
            ) : (
              teams.map((team) => {
                const isTrialing = team.subscription?.status === 'trialing';
                const daysRemaining = isTrialing ? calculateDaysRemaining(team.subscription?.trial_ends_at || null) : 0;

                return (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{team.name}</div>
                      <div className="text-xs text-gray-500">{team.level || 'No level set'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {team.subscription ? TIER_LABELS[team.subscription.tier as SubscriptionTier] : 'None'}
                    </td>
                    <td className="px-4 py-3">
                      {team.subscription ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          team.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                          team.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                          team.subscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
                          team.subscription.status === 'expired' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {team.subscription.status}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isTrialing ? (
                        <div>
                          <span className={`font-medium ${daysRemaining <= 3 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                          </span>
                          <div className="text-xs text-gray-500">
                            Ends {formatDate(team.subscription?.trial_ends_at || null)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isTrialing ? (
                          <>
                            <button
                              onClick={() => openTrialModal('extend', team)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Extend Trial"
                            >
                              <CalendarPlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openTrialModal('end', team)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="End Trial"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openTrialModal('start', team)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Start Trial"
                          >
                            <Gift className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Trial Management Modal */}
      {trialModal.isOpen && trialModal.team && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {trialModal.mode === 'start' && 'Start Trial'}
              {trialModal.mode === 'extend' && 'Extend Trial'}
              {trialModal.mode === 'end' && 'End Trial'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Team: <strong>{trialModal.team.name}</strong>
            </p>

            {trialModal.mode === 'start' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                  <select
                    value={trialForm.tier}
                    onChange={(e) => setTrialForm({ ...trialForm, tier: e.target.value })}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="basic">Basic</option>
                    <option value="plus">Plus</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    value={trialForm.duration_days}
                    onChange={(e) => setTrialForm({ ...trialForm, duration_days: parseInt(e.target.value) || 14 })}
                    min={1}
                    max={90}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
            )}

            {trialModal.mode === 'extend' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Days</label>
                <input
                  type="number"
                  value={trialForm.additional_days}
                  onChange={(e) => setTrialForm({ ...trialForm, additional_days: parseInt(e.target.value) || 7 })}
                  min={1}
                  max={90}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            )}

            {trialModal.mode === 'end' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select
                  value={trialForm.new_status}
                  onChange={(e) => setTrialForm({ ...trialForm, new_status: e.target.value as 'expired' | 'canceled' | 'active' })}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="expired">Expired (trial ended)</option>
                  <option value="canceled">Canceled (by admin)</option>
                  <option value="active">Active (convert to paid)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {trialForm.new_status === 'active'
                    ? 'This will convert the trial to an active subscription.'
                    : 'This will end the trial and revoke access.'}
                </p>
              </div>
            )}

            {trialError && (
              <p className="text-sm text-red-600 mt-4">{trialError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeTrialModal}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTrialAction}
                disabled={trialLoading}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                  trialModal.mode === 'end' && trialForm.new_status !== 'active'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {trialLoading ? 'Processing...' : (
                  trialModal.mode === 'start' ? 'Start Trial' :
                  trialModal.mode === 'extend' ? 'Extend Trial' :
                  'End Trial'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UsersTab({ users, owner }: { users: ProfileWithAdmin[]; owner: OrganizationDetail['owner'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Active</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                No users yet
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gray-100 rounded-full">
                      <UserCircle className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.full_name || 'No name'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user.id === owner.id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      <Shield className="w-3 h-3" />
                      Owner
                    </span>
                  ) : (
                    <span className="text-sm text-gray-900">Member</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatRelativeTime(user.last_active_at)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(user.created_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function BillingTab({ org }: { org: OrganizationDetail }) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Summary</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Monthly Recurring Revenue</dt>
              <dd className="text-2xl font-semibold text-gray-900">{formatMRR(org.total_mrr_cents)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Subscribed Teams</dt>
              <dd className="text-sm font-medium text-gray-900">
                {org.teams.filter(t => t.subscription?.status === 'active').length} of {org.teams.length}
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stripe Integration</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Customer ID</dt>
              <dd className="text-sm font-mono text-gray-900">
                {org.stripe_customer_id || 'Not connected'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Billing Email</dt>
              <dd className="text-sm text-gray-900">
                {org.billing_email || 'Not set'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Teams Billing Table */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Team Subscriptions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Period End</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Waived</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {org.teams.map((team) => (
                <tr key={team.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{team.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {team.subscription ? TIER_LABELS[team.subscription.tier as SubscriptionTier] : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {team.subscription?.status || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {team.subscription?.current_period_end ? formatDate(team.subscription.current_period_end) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {team.subscription?.billing_waived ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ activity }: { activity: AuditLog[] }) {
  return (
    <div className="p-6">
      {activity.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No recent activity</p>
      ) : (
        <div className="space-y-4">
          {activity.map((log) => (
            <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <Activity className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(log.timestamp)}</p>
                </div>
                {log.actor_email && (
                  <p className="text-sm text-gray-600">by {log.actor_email}</p>
                )}
                {log.target_name && (
                  <p className="text-sm text-gray-500">Target: {log.target_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
