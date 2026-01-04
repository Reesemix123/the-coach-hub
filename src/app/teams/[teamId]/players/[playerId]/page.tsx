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
    console.log('[PlayerPage] fetchData starting...', { teamId, playerId });
    setLoading(true);

    // Fetch team info
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    console.log('[PlayerPage] Team fetch result:', { teamData: teamData?.name, error: teamError?.message });

    if (teamData) {
      setTeam(teamData);
    }

    // Fetch player stats
    try {
      console.log('[PlayerPage] Calling AnalyticsService.getPlayerStats...');
      const analyticsService = new AnalyticsService();
      const data = await analyticsService.getPlayerStats(playerId, teamId);
      console.log('[PlayerPage] Stats received:', {
        totalPlays: data.totalPlays,
        defensiveSnaps: data.defensiveSnaps,
        tackles: data.tackles
      });
      setStats(data);
    } catch (error) {
      console.error('[PlayerPage] Error fetching player stats:', error);
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
  const pos = player.position?.toUpperCase() || '';

  // Position detection including playbook positions
  const isQB = pos === 'QB';
  const isWR = ['WR', 'SE', 'FL', 'X', 'Y', 'Z', 'SLOT', 'SL', 'SR', 'WB'].includes(pos);
  const isTE = ['TE', 'TE1', 'TE2'].includes(pos);
  const isRB = ['RB', 'HB', 'FB', 'TB', 'HB1', 'HB2'].includes(pos);
  const isOL = ['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'].includes(pos);
  const isDefense = ['DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'FS', 'SS', 'DB', 'EDGE', 'MIKE', 'WILL', 'SAM'].includes(pos);

  // Data-driven stats detection (for two-way players)
  const hasRushingStats = stats.rushingAttempts > 0;
  const hasReceivingStats = stats.targets > 0;
  const hasPassingStats = stats.passingAttempts > 0;
  const hasDefensiveStats = stats.defensiveSnaps > 0;
  const hasOffensiveStats = hasRushingStats || hasReceivingStats || hasPassingStats;

  // Position-specific metrics
  const catchRate = stats.targets > 0 ? (stats.receptions / stats.targets) * 100 : 0;
  const yardsPerTarget = stats.targets > 0 ? stats.receivingYards / stats.targets : 0;
  const yardsPerCarry = stats.rushingAttempts > 0 ? stats.rushingYards / stats.rushingAttempts : 0;

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

          {/* Check if there's any data (offensive or defensive) */}
          {stats.totalPlays === 0 && stats.defensiveSnaps === 0 ? (
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
              {/* Data-driven stats sections - shows based on actual data, not just position */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Statistics</h2>

                <div className="space-y-6">
                  {/* Passing Stats - show if player has passing attempts */}
                  {hasPassingStats && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">Passing</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.completionPct.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Comp %</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.passingAttempts > 0 ? (stats.passingYards / stats.passingAttempts).toFixed(1) : '0.0'}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Yards/Att</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-green-600">
                            {stats.passingTouchdowns}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Pass TDs</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-red-600">
                            {stats.interceptions}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">INTs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rushing Stats - show if player has rushing attempts */}
                  {hasRushingStats && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">Rushing</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                          <div className="text-2xl font-bold text-gray-900">
                            {yardsPerCarry.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Yards/Carry</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.rushingAttempts}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Carries</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.rushingYards}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Yards</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.rushingAvg.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Avg</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-green-600">
                            {stats.rushingTouchdowns}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">TDs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receiving Stats - show if player has targets */}
                  {hasReceivingStats && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">Receiving</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                          <div className="text-2xl font-bold text-gray-900">
                            {catchRate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Catch Rate</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.receptions}/{stats.targets}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Rec/Targets</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.receivingYards}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Yards</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.receivingAvg.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">YPC</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-green-600">
                            {stats.receivingTouchdowns}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">TDs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Defensive Stats - show if player has defensive involvement */}
                  {hasDefensiveStats && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">Defense</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.tackles}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Tackles</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.tacklesForLoss}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">TFLs</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.sacks}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Sacks</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-gray-900">
                            {stats.pressures}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Pressures</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-2xl font-bold text-green-600">
                            {stats.interceptions}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">INTs</div>
                        </div>
                        {/* Show additional defensive stats if any exist */}
                        {(stats.passBreakups > 0 || stats.forcedFumbles > 0) && (
                          <>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="text-2xl font-bold text-gray-900">
                                {stats.passBreakups}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">PBUs</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="text-2xl font-bold text-green-600">
                                {stats.forcedFumbles}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">FF</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No stats message */}
                  {!hasOffensiveStats && !hasDefensiveStats && (
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
                      <p className="text-gray-500">No stats recorded yet</p>
                      <p className="text-sm text-gray-400 mt-1">Tag plays in film analysis to track this player&apos;s performance</p>
                    </div>
                  )}
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