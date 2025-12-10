'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import {
  CreditCard,
  AlertCircle,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import ConsoleNav from '@/components/console/ConsoleNav';

interface TeamBilling {
  team_id: string;
  team_name: string;
  tier: string;
  status: string;
  billing_waived: boolean;
  billing_waived_reason: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  monthly_cost_cents: number;
  ai_credits_used: number;
  ai_credits_allowed: number;
  upload_tokens: {
    available: number;
    allocation: number;
  };
}

interface BillingSummary {
  total_mrr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  waived_subscriptions: number;
  past_due_subscriptions: number;
}

interface TierConfigValue {
  name: string;
  description: string;
  ai_credits: number;
  price_monthly: number;
  features: string[];
}

interface BillingData {
  summary: BillingSummary;
  teams: TeamBilling[];
  tier_configs: Record<string, TierConfigValue> | null;
}

export default function ConsoleBillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/console/billing');
      if (response.ok) {
        const data = await response.json();
        setBillingData(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load billing data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }

    setLoading(false);
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getTierDisplayName(tier: string): string {
    const names: Record<string, string> = {
      'basic': 'Basic',
      'plus': 'Plus',
      'premium': 'Premium'
    };
    return names[tier] || tier;
  }

  function getStatusBadge(status: string, waived: boolean) {
    if (waived) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <CheckCircle className="w-3 h-3" />
          Waived
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3" />
            Past Due
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <XCircle className="w-3 h-3" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            No Plan
          </span>
        );
    }
  }

  function getCreditsPercentage(used: number, allowed: number): number {
    if (allowed === 0) return 0;
    return Math.min(100, Math.round((used / allowed) * 100));
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading billing...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!user) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
            <p className="text-gray-600 mb-8">Please sign in to access the console.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading Billing</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); loadData(); }}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
              Billing
            </h1>
            <p className="text-gray-600 mt-2">
              Manage subscriptions and view billing details
            </p>
          </div>
        </div>

        {/* Console Navigation */}
        <ConsoleNav />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* MRR Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-gray-600">Monthly Cost</span>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {formatCurrency(billingData?.summary.total_mrr_cents || 0)}
              </p>
            </div>

            {/* Active Subscriptions Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-600">Active Plans</span>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {billingData?.summary.active_subscriptions || 0}
              </p>
            </div>

            {/* Waived Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-600">Waived</span>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {billingData?.summary.waived_subscriptions || 0}
              </p>
            </div>

            {/* Past Due Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm text-gray-600">Past Due</span>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {billingData?.summary.past_due_subscriptions || 0}
              </p>
            </div>
          </div>

          {/* Team Subscriptions Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Team Subscriptions</h2>
                <p className="text-sm text-gray-600">
                  Click &quot;Manage&quot; on any team to view details and change their subscription plan.
                </p>
              </div>
            </div>
          </div>

          {billingData?.teams.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No teams found</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                    <th className="px-6 py-3 font-medium">Team</th>
                    <th className="px-6 py-3 font-medium">Plan</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Monthly Cost</th>
                    <th className="px-6 py-3 font-medium">Film Uploads</th>
                    <th className="px-6 py-3 font-medium">AI Credits</th>
                    <th className="px-6 py-3 font-medium">Renews</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData?.teams.map((team) => {
                    const creditsPercent = getCreditsPercentage(
                      team.ai_credits_used,
                      team.ai_credits_allowed
                    );

                    return (
                      <tr key={team.team_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link
                            href={`/console/teams/${team.team_id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {team.team_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm font-medium text-gray-700">
                            <Zap className="w-3 h-3" />
                            {getTierDisplayName(team.tier)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(team.status, team.billing_waived)}
                          {team.billing_waived && team.billing_waived_reason && (
                            <p className="text-xs text-gray-500 mt-1">
                              {team.billing_waived_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 font-medium">
                            {team.billing_waived ? (
                              <span className="text-gray-500">$0.00</span>
                            ) : (
                              formatCurrency(team.monthly_cost_cents)
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[100px]">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    team.upload_tokens?.available <= 1
                                      ? 'bg-red-500'
                                      : team.upload_tokens?.available <= Math.ceil((team.upload_tokens?.allocation || 4) / 2)
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, ((team.upload_tokens?.allocation || 4) - (team.upload_tokens?.available || 0)) / (team.upload_tokens?.allocation || 4) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm text-gray-600 whitespace-nowrap">
                              {team.upload_tokens?.available || 0} / {team.upload_tokens?.allocation || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[100px]">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    creditsPercent >= 90
                                      ? 'bg-red-500'
                                      : creditsPercent >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${creditsPercent}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm text-gray-600 whitespace-nowrap">
                              {team.ai_credits_used} / {team.ai_credits_allowed}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(team.current_period_end)}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/console/teams/${team.team_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
