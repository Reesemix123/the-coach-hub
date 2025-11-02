'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { createClient } from '@/utils/supabase/client';
import { AnalyticsService, PlayerStats } from '@/lib/services/analytics.service';

interface Team {
  id: string;
  name: string;
  level: string;
}

export default function PlayerStatsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const teamId = params.teamId as string;
  const playerId = params.playerId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccessInfo, setShowSuccessInfo] = useState(false);

  useEffect(() => {
    if (teamId && playerId) {
      fetchData();
    }
  }, [teamId, playerId]);

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

    // Fetch player stats
    try {
      const analyticsService = new AnalyticsService();
      const data = await analyticsService.getPlayerStats(playerId, teamId);
      setStats(data);
    } catch (error) {
      console.error('Error fetching player stats:', error);
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

  if (!team || !stats) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Unable to load player stats</p>
            <button
              onClick={() => router.push(`/teams/${teamId}/players`)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Back to Roster
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const { player } = stats;
  const isQB = player.position === 'QB';

  // Calculate max yards for bar chart scaling
  const maxYards = Math.max(
    stats.yardsByDown.firstDown.avgYards,
    stats.yardsByDown.secondDown.avgYards,
    stats.yardsByDown.thirdDown.avgYards,
    stats.yardsByDown.fourthDown.avgYards,
    1 // Minimum to avoid division by zero
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/teams/${teamId}/players`)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Roster
            </button>

            <div className="flex items-baseline gap-4 mb-2">
              {player.jersey_number && (
                <div className="text-6xl font-semibold text-gray-900 tracking-tight">
                  #{player.jersey_number}
                </div>
              )}
              <div>
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                  {player.first_name} {player.last_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  {player.position} · {team.name}
                </p>
              </div>
            </div>
          </div>

          {/* Check if there's data */}
          {stats.totalPlays === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-gray-600 text-lg mb-4">No play data for this player yet</p>
              <p className="text-gray-500 text-sm mb-6">Tag some plays in your game film with this player</p>
              <button
                onClick={() => router.push(`/teams/${teamId}/film`)}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Go to Film Room
              </button>
            </div>
          ) : (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {stats.totalPlays}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Plays</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-4xl font-semibold text-gray-900">
                        {stats.successRate.toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Success Rate</div>
                    </div>
                    <button
                      onClick={() => setShowSuccessInfo(!showSuccessInfo)}
                      className="text-gray-400 hover:text-gray-600"
                      title="What is Success Rate?"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                  {showSuccessInfo && (
                    <div className="mt-3 text-xs text-gray-600 bg-white rounded p-3 border border-gray-200">
                      <p className="font-semibold mb-1">Success Rate Criteria:</p>
                      <p>• 1st down: Gain 40% of distance needed</p>
                      <p>• 2nd down: Gain 60% of distance needed</p>
                      <p>• 3rd/4th down: Gain 100% (convert or TD)</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-4xl font-semibold text-gray-900">
                    {(stats.rushingYards + stats.receivingYards).toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Yards</div>
                </div>
              </div>

              {/* Yards Per Down - Bar Chart */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Performance by Down</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="space-y-4">
                    {/* 1st Down */}
                    {stats.yardsByDown.firstDown.attempts > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">1st Down</span>
                          <span className="text-sm text-gray-600">
                            {stats.yardsByDown.firstDown.avgYards.toFixed(1)} yds/play 
                            <span className="text-gray-400 ml-1">({stats.yardsByDown.firstDown.attempts} plays)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-8 relative">
                          <div 
                            className="bg-black rounded-full h-8 flex items-center justify-end pr-3"
                            style={{ width: `${(stats.yardsByDown.firstDown.avgYards / maxYards) * 100}%` }}
                          >
                            <span className="text-white text-xs font-semibold">
                              {stats.yardsByDown.firstDown.avgYards.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2nd Down */}
                    {stats.yardsByDown.secondDown.attempts > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">2nd Down</span>
                          <span className="text-sm text-gray-600">
                            {stats.yardsByDown.secondDown.avgYards.toFixed(1)} yds/play
                            <span className="text-gray-400 ml-1">({stats.yardsByDown.secondDown.attempts} plays)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-8 relative">
                          <div 
                            className="bg-black rounded-full h-8 flex items-center justify-end pr-3"
                            style={{ width: `${(stats.yardsByDown.secondDown.avgYards / maxYards) * 100}%` }}
                          >
                            <span className="text-white text-xs font-semibold">
                              {stats.yardsByDown.secondDown.avgYards.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Down */}
                    {stats.yardsByDown.thirdDown.attempts > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">3rd Down</span>
                          <span className="text-sm text-gray-600">
                            {stats.yardsByDown.thirdDown.avgYards.toFixed(1)} yds/play
                            <span className="text-gray-400 ml-1">({stats.yardsByDown.thirdDown.attempts} plays)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-8 relative">
                          <div 
                            className="bg-black rounded-full h-8 flex items-center justify-end pr-3"
                            style={{ width: `${(stats.yardsByDown.thirdDown.avgYards / maxYards) * 100}%` }}
                          >
                            <span className="text-white text-xs font-semibold">
                              {stats.yardsByDown.thirdDown.avgYards.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4th Down */}
                    {stats.yardsByDown.fourthDown.attempts > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">4th Down</span>
                          <span className="text-sm text-gray-600">
                            {stats.yardsByDown.fourthDown.avgYards.toFixed(1)} yds/play
                            <span className="text-gray-400 ml-1">({stats.yardsByDown.fourthDown.attempts} plays)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-8 relative">
                          <div 
                            className="bg-black rounded-full h-8 flex items-center justify-end pr-3"
                            style={{ width: `${(stats.yardsByDown.fourthDown.avgYards / maxYards) * 100}%` }}
                          >
                            <span className="text-white text-xs font-semibold">
                              {stats.yardsByDown.fourthDown.avgYards.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Passing Stats (for QBs) */}
              {isQB && stats.passingAttempts > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">Passing</h2>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-6">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Attempts</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.passingAttempts}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Completions</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.completions}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Comp %</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.completionPct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Yards</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.passingYards}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">TDs</div>
                        <div className="text-2xl font-semibold text-green-600">
                          {stats.passingTouchdowns}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">INTs</div>
                        <div className="text-2xl font-semibold text-red-600">
                          {stats.interceptions}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Fumbles</div>
                        <div className="text-2xl font-semibold text-red-600">
                          {stats.passingFumbles}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rushing Stats */}
              {stats.rushingAttempts > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rushing</h2>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Attempts</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.rushingAttempts}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Yards</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.rushingYards}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Avg</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.rushingAvg.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">TDs</div>
                        <div className="text-2xl font-semibold text-green-600">
                          {stats.rushingTouchdowns}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Fumbles</div>
                        <div className="text-2xl font-semibold text-red-600">
                          {stats.rushingFumbles}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Receiving Stats */}
              {stats.targets > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">Receiving</h2>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Targets</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.targets}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Receptions</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.receptions}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Drops</div>
                        <div className="text-2xl font-semibold text-yellow-600">
                          {stats.drops}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Yards</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.receivingYards}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Avg</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.receivingAvg.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">TDs</div>
                        <div className="text-2xl font-semibold text-green-600">
                          {stats.receivingTouchdowns}
                        </div>
                      </div>
                    </div>
                    {stats.receivingFumbles > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">Fumbles: <span className="font-semibold text-red-600">{stats.receivingFumbles}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Top Plays */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Top Plays</h2>
                {stats.topPlays.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
                    <p className="text-gray-500">Need at least 2 attempts per play to show stats</p>
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
                        {stats.topPlays.map((play, idx) => (
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
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}