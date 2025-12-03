'use client';

// src/app/admin/page.tsx
// Platform Admin Dashboard - Main overview page

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trophy,
  Film,
  AlertTriangle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface DashboardData {
  metrics: {
    organizations: {
      total: number;
      active: number;
      trial: number;
      churned: number;
    };
    teams: {
      total: number;
      by_tier: {
        basic: number;
        plus: number;
        premium: number;
        ai_powered: number;
      };
    };
    users: {
      total: number;
      active_today: number;
      active_week: number;
      active_month: number;
    };
  };
  revenue: {
    mrr: number;
    mrr_change: number;
    arr: number;
  };
  costs: {
    ai_mtd: number;
    ai_projected: number;
    margin_percentage: number;
  };
  activity: {
    games_today: number;
    games_week: number;
    plays_today: number;
    plays_week: number;
  };
  alerts: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    count?: number;
    action_url: string;
  }>;
  recent_signups: Array<{
    organization_id: string;
    name: string;
    created_at: string;
    owner_email: string | null;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Metric Card Component
function MetricCard({
  label,
  value,
  change,
  changeLabel,
  subvalue,
  icon: Icon
}: {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  subvalue?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {Icon && (
          <div className="p-2 bg-gray-100 rounded-lg">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </div>
      <div className="text-3xl font-semibold text-gray-900 mb-1">{value}</div>
      {change !== undefined && (
        <div className={`text-sm flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {change >= 0 ? '+' : ''}{change}% {changeLabel}
        </div>
      )}
      {subvalue && (
        <div className="text-sm text-gray-500 mt-1">{subvalue}</div>
      )}
    </div>
  );
}

// Alert Banner Component
function AlertBanner({ alert }: { alert: DashboardData['alerts'][0] }) {
  const severityStyles = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <Link
      href={alert.action_url}
      className={`flex items-center justify-between p-4 rounded-lg border ${severityStyles[alert.severity]} hover:opacity-90 transition-opacity`}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">{alert.message}</span>
      </div>
      <ChevronRight className="w-5 h-5" />
    </Link>
  );
}

// Tier Distribution Bar
function TierDistribution({ data }: { data: DashboardData['metrics']['teams']['by_tier'] }) {
  const total = data.basic + data.plus + data.premium + data.ai_powered;
  if (total === 0) return <div className="text-gray-500 text-sm">No teams yet</div>;

  const tiers = [
    { name: 'Basic', count: data.basic, color: 'bg-gray-400' },
    { name: 'Plus', count: data.plus, color: 'bg-blue-500' },
    { name: 'Premium', count: data.premium, color: 'bg-purple-500' },
    { name: 'AI Powered', count: data.ai_powered, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
        {tiers.map((tier, i) => (
          tier.count > 0 && (
            <div
              key={tier.name}
              className={`${tier.color} transition-all`}
              style={{ width: `${(tier.count / total) * 100}%` }}
            />
          )
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {tiers.map((tier) => (
          <div key={tier.name} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${tier.color}`} />
            <span className="text-gray-600">{tier.name}</span>
            <span className="font-medium text-gray-900">{tier.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchDashboard() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dashboard');

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch dashboard');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Failed to Load Dashboard</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-3 mb-8">
          {data.alerts.map((alert, i) => (
            <AlertBanner key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="Monthly Revenue"
          value={formatCurrency(data.revenue.mrr)}
          change={data.revenue.mrr_change}
          changeLabel="vs last month"
          subvalue={`ARR: ${formatCurrency(data.revenue.arr)}`}
          icon={DollarSign}
        />
        <MetricCard
          label="Organizations"
          value={data.metrics.organizations.total}
          subvalue={`${data.metrics.organizations.active} active, ${data.metrics.organizations.trial} trial`}
          icon={Building2}
        />
        <MetricCard
          label="Teams"
          value={data.metrics.teams.total}
          icon={Users}
        />
        <MetricCard
          label="AI Costs (MTD)"
          value={formatCurrency(data.costs.ai_mtd)}
          subvalue={`Projected: ${formatCurrency(data.costs.ai_projected)} | Margin: ${data.costs.margin_percentage}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Secondary Sections */}
      <div className="grid grid-cols-3 gap-6">
        {/* Teams by Tier */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Teams by Tier</h3>
          <TierDistribution data={data.metrics.teams.by_tier} />
        </div>

        {/* Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Trophy className="w-4 h-4" />
                <span>Games today</span>
              </div>
              <span className="font-semibold text-gray-900">{data.activity.games_today}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Trophy className="w-4 h-4" />
                <span>Games this week</span>
              </div>
              <span className="font-semibold text-gray-900">{data.activity.games_week}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Film className="w-4 h-4" />
                <span>Plays tagged today</span>
              </div>
              <span className="font-semibold text-gray-900">{data.activity.plays_today}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Film className="w-4 h-4" />
                <span>Plays this week</span>
              </div>
              <span className="font-semibold text-gray-900">{data.activity.plays_week}</span>
            </div>
          </div>

          {/* User Activity */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">User Activity</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Active today</span>
                <span className="font-medium">{data.metrics.users.active_today}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active this week</span>
                <span className="font-medium">{data.metrics.users.active_week}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active this month</span>
                <span className="font-medium">{data.metrics.users.active_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total users</span>
                <span className="font-medium">{data.metrics.users.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Signups */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Signups</h3>
            <Link
              href="/admin/organizations"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {data.recent_signups.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent signups</p>
            ) : (
              data.recent_signups.map((org) => (
                <Link
                  key={org.organization_id}
                  href={`/admin/organizations/${org.organization_id}`}
                  className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">{org.name}</div>
                    <div className="text-sm text-gray-500">{org.owner_email || 'No owner'}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(org.created_at)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
