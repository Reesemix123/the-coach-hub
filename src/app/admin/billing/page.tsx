'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  BarChart3,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

// Types
interface MRRTrendItem {
  date: string;
  mrr: number;
}

interface BillingOverview {
  mrr: {
    current: number;
    previous: number;
    change_percentage: number;
  };
  arr: number;
  mrr_by_tier: {
    little_league: number;
    hs_basic: number;
    hs_advanced: number;
    ai_powered: number;
  };
  mrr_trend: MRRTrendItem[];
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    waived: number;
  };
  new_subscriptions_this_month: number;
  churned_this_month: number;
  churn_rate: number;
}

interface FailedPayment {
  id: string;
  organization_id: string;
  organization_name: string;
  owner_email: string;
  team_name: string | null;
  amount: number;
  failed_at: string;
  stripe_invoice_id: string | null;
  last_error: string | null;
}

interface ChurnData {
  churned_organizations: {
    id: string;
    name: string;
    churned_at: string;
    was_paying: number;
    reason: string;
    lifetime_value: number;
  }[];
  churn_by_month: {
    month: string;
    count: number;
    mrr_lost: number;
  }[];
  total_churned_30d: number;
  total_mrr_lost_30d: number;
  average_lifetime_days: number;
}

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">{title}</span>
        <div className="p-2 bg-gray-100 rounded-lg">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-gray-900 mb-1">{value}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
          <span className={`text-sm ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {change > 0 ? '+' : ''}{change}% {changeLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// MRR Chart Component (Simple bar chart)
function MRRChart({ data }: { data: MRRTrendItem[] }) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        No trend data available
      </div>
    );
  }

  const maxMRR = Math.max(...data.map(d => d.mrr), 1);

  return (
    <div className="h-48 flex items-end gap-2 px-4">
      {data.map((item, index) => {
        const height = (item.mrr / maxMRR) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-gray-900 rounded-t transition-all duration-300"
              style={{ height: `${Math.max(height, 2)}%` }}
              title={`${formatCurrency(item.mrr)}`}
            />
            <span className="text-xs text-gray-500">
              {item.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Revenue by Tier Component
function RevenueByTier({ data }: { data: BillingOverview['mrr_by_tier'] }) {
  const tiers = [
    { key: 'hs_advanced', label: 'HS Advanced', color: 'bg-gray-900' },
    { key: 'hs_basic', label: 'HS Basic', color: 'bg-gray-600' },
    { key: 'ai_powered', label: 'AI Powered', color: 'bg-gray-800' },
    { key: 'little_league', label: 'Little League', color: 'bg-gray-400' }
  ] as const;

  const total = Object.values(data).reduce((sum, val) => sum + val, 0) || 1;

  return (
    <div className="space-y-4">
      {tiers.map(tier => {
        const value = data[tier.key];
        const percentage = (value / total) * 100;
        return (
          <div key={tier.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{tier.label}</span>
              <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${tier.color} rounded-full transition-all duration-300`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Failed Payments Table Component
function FailedPaymentsTable({
  payments,
  onRetry
}: {
  payments: FailedPayment[];
  onRetry: (invoiceId: string) => Promise<void>;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleRetry = async (payment: FailedPayment) => {
    if (!payment.stripe_invoice_id) {
      alert('Cannot retry: No Stripe invoice ID');
      return;
    }
    setRetrying(payment.id);
    try {
      await onRetry(payment.id);
    } finally {
      setRetrying(null);
    }
  };

  if (!payments.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        No failed payments
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
              Organization
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
              Failed
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
              Error
            </th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {payments.map(payment => (
            <tr key={payment.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium text-gray-900">{payment.organization_name}</div>
                  <div className="text-xs text-gray-500">{payment.owner_email}</div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-900">
                {formatCurrency(payment.amount)}
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm">
                {formatRelativeTime(payment.failed_at)}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  {payment.last_error || 'Unknown'}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleRetry(payment)}
                  disabled={retrying === payment.id || !payment.stripe_invoice_id}
                  className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {retrying === payment.id ? 'Retrying...' : 'Retry'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Main Component
export default function BillingPage() {
  const [period, setPeriod] = useState<'30d' | '90d' | '12m'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);

  // Fetch all billing data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, failedRes, churnRes] = await Promise.all([
        fetch(`/api/admin/billing/overview?period=${period}`),
        fetch('/api/admin/billing/failed-payments'),
        fetch('/api/admin/billing/churn')
      ]);

      if (!overviewRes.ok) throw new Error('Failed to fetch billing overview');
      if (!failedRes.ok) throw new Error('Failed to fetch failed payments');
      if (!churnRes.ok) throw new Error('Failed to fetch churn data');

      const [overviewData, failedData, churnDataRes] = await Promise.all([
        overviewRes.json(),
        failedRes.json(),
        churnRes.json()
      ]);

      setOverview(overviewData);
      setFailedPayments(failedData.failed_payments || []);
      setChurnData(churnDataRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle retry payment
  const handleRetryPayment = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/admin/billing/retry-payment/${invoiceId}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry payment');
      }

      // Refresh data
      fetchData();
      alert('Payment retry initiated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry payment');
    }
  };

  if (loading && !overview) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Revenue & Billing</h1>
            <p className="text-sm text-gray-500">
              Monitor MRR, subscriptions, and payment health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '30d' | '90d' | '12m')}
            className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {overview && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Monthly Recurring Revenue"
              value={formatCurrency(overview.mrr.current)}
              change={overview.mrr.change_percentage}
              changeLabel="vs last month"
              icon={DollarSign}
              trend={overview.mrr.change_percentage > 0 ? 'up' : overview.mrr.change_percentage < 0 ? 'down' : 'neutral'}
            />
            <MetricCard
              title="Annual Run Rate"
              value={formatCurrency(overview.arr)}
              icon={TrendingUp}
            />
            <MetricCard
              title="Active Subscriptions"
              value={String(overview.subscriptions.active + overview.subscriptions.trialing)}
              icon={Users}
            />
            <MetricCard
              title="Churn Rate"
              value={`${overview.churn_rate}%`}
              icon={AlertTriangle}
              trend={overview.churn_rate > 5 ? 'down' : 'neutral'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* MRR Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">MRR Trend</h2>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <MRRChart data={overview.mrr_trend} />
            </div>

            {/* Revenue by Tier */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Revenue by Tier</h2>
                <CreditCard className="w-5 h-5 text-gray-400" />
              </div>
              <RevenueByTier data={overview.mrr_by_tier} />
            </div>
          </div>

          {/* Subscription Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Subscription Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{overview.subscriptions.active}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-600">{overview.subscriptions.trialing}</div>
                <div className="text-sm text-gray-500">Trialing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-red-600">{overview.subscriptions.past_due}</div>
                <div className="text-sm text-gray-500">Past Due</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-400">{overview.subscriptions.canceled}</div>
                <div className="text-sm text-gray-500">Canceled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-purple-600">{overview.subscriptions.waived}</div>
                <div className="text-sm text-gray-500">Waived</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{overview.subscriptions.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
            </div>
          </div>

          {/* Failed Payments Section */}
          {failedPayments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Failed Payments</h2>
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                    {failedPayments.length}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              <FailedPaymentsTable
                payments={failedPayments}
                onRetry={handleRetryPayment}
              />
            </div>
          )}

          {/* Churn Summary */}
          {churnData && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Churn Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-semibold text-gray-900">{churnData.total_churned_30d}</div>
                  <div className="text-sm text-gray-500">Churned (30d)</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-semibold text-red-600">{formatCurrency(churnData.total_mrr_lost_30d)}</div>
                  <div className="text-sm text-gray-500">MRR Lost (30d)</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-semibold text-gray-900">{churnData.average_lifetime_days}</div>
                  <div className="text-sm text-gray-500">Avg Lifetime (days)</div>
                </div>
              </div>

              {/* Churn by Month */}
              {churnData.churn_by_month.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Churned</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">MRR Lost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {churnData.churn_by_month.map(month => (
                        <tr key={month.month} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{month.month}</td>
                          <td className="px-4 py-2 text-gray-900">{month.count}</td>
                          <td className="px-4 py-2 text-red-600">{formatCurrency(month.mrr_lost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Churned Organizations */}
              {churnData.churned_organizations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Recently Churned</h3>
                  <div className="space-y-2">
                    {churnData.churned_organizations.slice(0, 5).map(org => (
                      <div key={org.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{org.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatRelativeTime(org.churned_at)} - {org.reason}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(org.was_paying)}/mo
                          </div>
                          <div className="text-xs text-gray-500">
                            LTV: {formatCurrency(org.lifetime_value)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
