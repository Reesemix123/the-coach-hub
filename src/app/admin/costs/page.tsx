'use client';

// /admin/costs - Costs & Profitability Dashboard
// Platform admin view of AI costs, revenue, and margins

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calculator,
  Percent,
  RefreshCw,
  Building2,
  Layers
} from 'lucide-react';

// Types
interface CostsOverview {
  current_month: {
    video_minutes_used: number;
    text_actions_used: number;
    ai_cost: number;
    revenue: number;
    margin: number;
    margin_percentage: number;
  };
  cost_trend: { date: string; cost: number }[];
  projected_month_end: {
    ai_cost: number;
    margin: number;
    margin_percentage: number;
  };
}

interface OrganizationCost {
  id: string;
  name: string;
  video_minutes_used: number;
  text_actions_used: number;
  ai_cost: number;
  revenue: number;
  margin: number;
  margin_percentage: number;
}

interface TierCost {
  tier: string;
  tier_name: string;
  subscriptions: number;
  total_revenue: number;
  total_ai_cost: number;
  avg_ai_cost_per_sub: number;
  margin_percentage: number;
}

// Metric Card Component
function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  isPositive = true,
  isCurrency = false,
  isPercentage = false
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  trendLabel?: string;
  isPositive?: boolean;
  isCurrency?: boolean;
  isPercentage?: boolean;
}) {
  const formattedValue = typeof value === 'number'
    ? isCurrency
      ? `$${value.toLocaleString()}`
      : isPercentage
        ? `${value}%`
        : value.toLocaleString()
    : value;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        {trend !== undefined && (
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% {trendLabel}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-semibold text-gray-900">{formattedValue}</p>
    </div>
  );
}

// Cost Trend Chart Component
function CostTrendChart({ data }: { data: { date: string; cost: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        No cost data available
      </div>
    );
  }

  const maxCost = Math.max(...data.map(d => d.cost), 1);

  return (
    <div className="h-48">
      <div className="flex items-end justify-between h-full gap-2">
        {data.map((item, index) => {
          const height = (item.cost / maxCost) * 100;
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center justify-end h-36">
                <span className="text-xs text-gray-500 mb-1">
                  ${item.cost.toFixed(2)}
                </span>
                <div
                  className="w-full bg-orange-500 rounded-t"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 mt-2 whitespace-nowrap">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Organization Costs Table Component
function OrganizationCostsTable({ organizations }: { organizations: OrganizationCost[] }) {
  if (!organizations || organizations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No organization data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Organization
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Video Min
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Text Actions
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Cost
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Revenue
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Margin %
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {organizations.slice(0, 10).map((org) => (
            <tr key={org.id} className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <span className="font-medium text-gray-900">{org.name}</span>
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                {org.video_minutes_used.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                {org.text_actions_used.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                ${org.ai_cost.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                ${org.revenue}
              </td>
              <td className="py-3 px-4 text-right">
                <span className={`font-medium ${org.margin_percentage >= 80 ? 'text-green-600' : org.margin_percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {org.margin_percentage}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tier Profitability Table Component
function TierProfitabilityTable({ tiers }: { tiers: TierCost[] }) {
  if (!tiers || tiers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tier data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tier
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Subscriptions
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Revenue
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Cost
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Avg Cost/Sub
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Margin %
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tiers.map((tier) => (
            <tr key={tier.tier} className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <span className="font-medium text-gray-900">{tier.tier_name}</span>
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                {tier.subscriptions}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                ${tier.total_revenue.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                ${tier.total_ai_cost.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                ${tier.avg_ai_cost_per_sub.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right">
                <span className={`font-medium ${tier.margin_percentage >= 80 ? 'text-green-600' : tier.margin_percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {tier.margin_percentage}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Main Page Component
export default function AdminCostsPage() {
  const [period, setPeriod] = useState<'30d' | '90d' | '12m'>('30d');
  const [overview, setOverview] = useState<CostsOverview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationCost[]>([]);
  const [tiers, setTiers] = useState<TierCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, byOrgRes, byTierRes] = await Promise.all([
        fetch(`/api/admin/costs/overview?period=${period}`),
        fetch('/api/admin/costs/by-organization'),
        fetch('/api/admin/costs/by-tier')
      ]);

      if (!overviewRes.ok) throw new Error('Failed to fetch costs overview');
      if (!byOrgRes.ok) throw new Error('Failed to fetch organization costs');
      if (!byTierRes.ok) throw new Error('Failed to fetch tier costs');

      const [overviewData, byOrgData, byTierData] = await Promise.all([
        overviewRes.json(),
        byOrgRes.json(),
        byTierRes.json()
      ]);

      setOverview(overviewData);
      setOrganizations(byOrgData.organizations || []);
      setTiers(byTierData.tiers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Costs & Profitability</h1>
            <p className="text-sm text-gray-500">Track AI costs and margins</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '30d' | '90d' | '12m')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="12m">Last 12 Months</option>
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 flex items-center gap-2">
            <span className="text-red-500">!</span>
            {error}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && !overview ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : overview ? (
        <>
          {/* Current Month Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Video Minutes Used"
              value={overview.current_month.video_minutes_used}
              icon={Calculator}
            />
            <MetricCard
              title="Text Actions Used"
              value={overview.current_month.text_actions_used}
              icon={Calculator}
            />
            <MetricCard
              title="AI Cost (MTD)"
              value={overview.current_month.ai_cost}
              icon={DollarSign}
              isCurrency
            />
            <MetricCard
              title="Revenue (MRR)"
              value={overview.current_month.revenue}
              icon={DollarSign}
              isCurrency
            />
            <MetricCard
              title="Margin"
              value={overview.current_month.margin_percentage}
              icon={Percent}
              isPercentage
              isPositive={overview.current_month.margin_percentage >= 80}
            />
          </div>

          {/* Projected Month End */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Projected Month End</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Projected AI Cost</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${overview.projected_month_end.ai_cost.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Projected Margin</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${overview.projected_month_end.margin.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Projected Margin %</p>
                <p className={`text-xl font-semibold ${overview.projected_month_end.margin_percentage >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {overview.projected_month_end.margin_percentage}%
                </p>
              </div>
            </div>
          </div>

          {/* Cost Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Cost Trend</h2>
            <CostTrendChart data={overview.cost_trend} />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Costs by Organization */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Top AI Users by Organization</h2>
              </div>
              <OrganizationCostsTable organizations={organizations} />
            </div>

            {/* Profitability by Tier */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Profitability by Tier</h2>
              </div>
              <TierProfitabilityTable tiers={tiers} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
