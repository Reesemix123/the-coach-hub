'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { createClient } from '@/utils/supabase/client';
import { AnalyticsService, TeamAnalytics } from '@/lib/services/analytics.service';

interface Team {
  id: string;
  name: string;
  level: string;
}

export default function TeamAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchData();
    }
  }, [teamId]);

  async function fetchData() {
    setLoading(true);

    // Fetch team info
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamData) {
      setTeam(teamData);
    }

    // Fetch analytics
    try {
      const analyticsService = new AnalyticsService();
      const data = await analyticsService.getTeamAnalytics(teamId);
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </AuthGuard>
    );
  }

  if (!team || !analytics) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Unable to load analytics</p>
            <button
              onClick={() => router.push(`/teams/${teamId}`)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Back to Team
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/teams/${teamId}`)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Team
            </button>

            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
              Team Analytics
            </h1>
            <p className="text-gray-600 mt-2">{team.name}</p>
          </div>

          {/* Check if there's data */}
          {analytics.totalPlays === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-600 text-lg mb-4">No play data yet</p>
              <p className="text-gray-500 text-sm mb-6">Tag some plays in your game film to see analytics</p>
              <button
                onClick={() => router.push(`/teams/${teamId}/film`)}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Go to Film Room
              </button>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {analytics.successRate.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Success Rate</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {analytics.totalPlays}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Plays</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {analytics.avgYardsPerPlay.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Avg Yards/Play</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {analytics.firstDowns}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">First Downs</div>
                </div>
              </div>

              {/* Performance by Down */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Performance by Down</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">1st Down</div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">
                      {analytics.firstDownStats.successRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.firstDownStats.success} of {analytics.firstDownStats.plays} plays
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">2nd Down</div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">
                      {analytics.secondDownStats.successRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.secondDownStats.success} of {analytics.secondDownStats.plays} plays
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">3rd Down</div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">
                      {analytics.thirdDownStats.successRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.thirdDownStats.conversions} conversions ({analytics.thirdDownStats.plays} attempts)
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">4th Down</div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">
                      {analytics.fourthDownStats.plays > 0 
                        ? `${analytics.fourthDownStats.successRate.toFixed(0)}%`
                        : '-'
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.fourthDownStats.plays > 0 
                        ? `${analytics.fourthDownStats.success} of ${analytics.fourthDownStats.plays} plays`
                        : 'No attempts'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Red Zone Performance */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Red Zone Performance</h2>
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="grid grid-cols-3 gap-8">
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Attempts</div>
                      <div className="text-3xl font-semibold text-gray-900">
                        {analytics.redZoneAttempts}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Touchdowns</div>
                      <div className="text-3xl font-semibold text-gray-900">
                        {analytics.redZoneTouchdowns}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-2">TD Rate</div>
                      <div className="text-3xl font-semibold text-gray-900">
                        {analytics.redZoneAttempts > 0 
                          ? `${analytics.redZoneSuccessRate.toFixed(0)}%`
                          : '-'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Plays */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">What's Working</h2>
                {analytics.topPlays.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
                    <p className="text-gray-500">Need at least 3 attempts per play to show stats</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Play</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Attempts</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Success Rate</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Avg Yards</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.topPlays.map((play, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{play.play_code}</div>
                              <div className="text-sm text-gray-500">{play.play_name}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-900">{play.attempts}</td>
                            <td className="px-6 py-4">
                              <span className={`font-medium ${
                                play.successRate >= 70 ? 'text-green-600' :
                                play.successRate >= 50 ? 'text-yellow-600' :
                                'text-gray-900'
                              }`}>
                                {play.successRate.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-900">
                              {play.avgYards.toFixed(1)} yds
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Plays */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Needs Work</h2>
                {analytics.bottomPlays.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
                    <p className="text-gray-500">Need at least 3 attempts per play to show stats</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Play</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Attempts</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Success Rate</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Avg Yards</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.bottomPlays.map((play, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{play.play_code}</div>
                              <div className="text-sm text-gray-500">{play.play_name}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-900">{play.attempts}</td>
                            <td className="px-6 py-4">
                              <span className={`font-medium ${
                                play.successRate < 30 ? 'text-red-600' :
                                play.successRate < 50 ? 'text-yellow-600' :
                                'text-gray-900'
                              }`}>
                                {play.successRate.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-900">
                              {play.avgYards.toFixed(1)} yds
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}