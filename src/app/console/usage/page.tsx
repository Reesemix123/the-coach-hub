'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import {
  AlertCircle,
  Trophy,
  Film,
  Users,
  Zap,
  Upload
} from 'lucide-react';
import ConsoleNav from '@/components/console/ConsoleNav';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface TeamUsage {
  team_id: string;
  team_name: string;
  games: number;
  plays: number;
  tokens_used: number;
  ai_credits_used: number;
  active_users: number;
}

interface UsageData {
  period: string;
  time_series: {
    games: TimeSeriesPoint[];
    plays: TimeSeriesPoint[];
    tokens: TimeSeriesPoint[];
    active_users: TimeSeriesPoint[];
    ai_credits: TimeSeriesPoint[];
  };
  by_team: TeamUsage[];
  totals: {
    games: number;
    plays: number;
    tokens_used: number;
    ai_credits_used: number;
    active_users: number;
  };
}

type Period = '30d' | '90d' | '12m';

export default function ConsoleUsagePage() {
  const [user, setUser] = useState<User | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');

  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, period]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) setLoading(false);
  }

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/console/usage?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load usage data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (period === '12m') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getPeriodLabel(): string {
    switch (period) {
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      case '12m': return 'Last 12 Months';
    }
  }

  if (loading && !usageData) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading usage data...</p>
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
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading Usage</h1>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                  Usage
                </h1>
                <p className="text-gray-600 mt-2">
                  Platform activity and trends
                </p>
              </div>

              {/* Period Selector */}
              <div className="flex gap-2">
                {(['30d', '90d', '12m'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      period === p
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p === '30d' && '30 Days'}
                    {p === '90d' && '90 Days'}
                    {p === '12m' && '12 Months'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Console Navigation */}
        <ConsoleNav />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Trophy className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Games</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {usageData?.totals.games || 0}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Film className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Plays Tagged</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {usageData?.totals.plays.toLocaleString() || 0}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Upload className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Film Uploads</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {usageData?.totals.tokens_used || 0}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Active Users</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {usageData?.totals.active_users || 0}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Zap className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">AI Credits</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {usageData?.totals.ai_credits_used || 0}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Games Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Games Uploaded</h3>
              <div className="h-48">
                {usageData?.time_series.games && usageData.time_series.games.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData.time_series.games}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#000"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#000' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>

            {/* Plays Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Plays Tagged</h3>
              <div className="h-48">
                {usageData?.time_series.plays && usageData.time_series.plays.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData.time_series.plays}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#007AFF"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#007AFF' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>

            {/* Film Uploads Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Film Uploads Used</h3>
              <div className="h-48">
                {usageData?.time_series.tokens && usageData.time_series.tokens.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData.time_series.tokens}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#5856D6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#5856D6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>

            {/* Active Users Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Users</h3>
              <div className="h-48">
                {usageData?.time_series.active_users && usageData.time_series.active_users.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData.time_series.active_users}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#34C759"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#34C759' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>

            {/* AI Credits Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Credits Used</h3>
              <div className="h-48">
                {usageData?.time_series.ai_credits && usageData.time_series.ai_credits.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData.time_series.ai_credits}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#86868B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#FF9500"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#FF9500' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Usage by Team */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Usage by Team</h2>
            {usageData?.by_team && usageData.by_team.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                      <th className="pb-3 font-medium">Team</th>
                      <th className="pb-3 font-medium text-right">Games</th>
                      <th className="pb-3 font-medium text-right">Plays</th>
                      <th className="pb-3 font-medium text-right">Film Uploads</th>
                      <th className="pb-3 font-medium text-right">AI Credits</th>
                      <th className="pb-3 font-medium text-right">Active Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.by_team.map((team) => (
                      <tr key={team.team_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4">
                          <Link
                            href={`/teams/${team.team_id}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            {team.team_name}
                          </Link>
                        </td>
                        <td className="py-4 text-right text-gray-900">{team.games}</td>
                        <td className="py-4 text-right text-gray-900">{team.plays.toLocaleString()}</td>
                        <td className="py-4 text-right text-gray-900">{team.tokens_used}</td>
                        <td className="py-4 text-right text-gray-900">{team.ai_credits_used}</td>
                        <td className="py-4 text-right text-gray-900">{team.active_users}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-300 font-semibold">
                      <td className="pt-4 text-gray-900">Total</td>
                      <td className="pt-4 text-right text-gray-900">{usageData.totals.games}</td>
                      <td className="pt-4 text-right text-gray-900">{usageData.totals.plays.toLocaleString()}</td>
                      <td className="pt-4 text-right text-gray-900">{usageData.totals.tokens_used}</td>
                      <td className="pt-4 text-right text-gray-900">{usageData.totals.ai_credits_used}</td>
                      <td className="pt-4 text-right text-gray-900">{usageData.totals.active_users}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-500">No team data for this period</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
