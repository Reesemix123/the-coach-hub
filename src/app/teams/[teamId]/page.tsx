// src/app/teams/[teamId]/page.tsx
// Team Dashboard - At-a-Glance Season Overview
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamNavigation from '@/components/TeamNavigation';
import AuthGuard from '@/components/AuthGuard';
import { TeamMetricsService, ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.service';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface Game {
  id: string;
  opponent?: string;
  date?: string;
  game_result?: 'win' | 'loss' | 'tie' | null;
  team_score?: number;
  opponent_score?: number;
}

interface TeamDashboardPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDashboardPage({ params }: TeamDashboardPageProps) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Fetch team
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (!team) {
    redirect('/teams');
  }

  // Fetch games
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, opponent, date, game_result, team_score, opponent_score')
    .eq('team_id', teamId)
    .eq('is_opponent_game', false)
    .order('date', { ascending: false });

  const games: Game[] = gamesData || [];

  // Calculate record
  const record = games.reduce(
    (acc, game) => {
      if (game.game_result === 'win') acc.wins++;
      else if (game.game_result === 'loss') acc.losses++;
      else if (game.game_result === 'tie') acc.ties++;
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 }
  );

  // Find next upcoming game
  const now = new Date().toISOString().split('T')[0];
  const { data: upcomingGames } = await supabase
    .from('games')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_opponent_game', false)
    .gte('date', now)
    .order('date', { ascending: true })
    .limit(1);

  const nextGame = upcomingGames?.[0] || null;

  // Fetch stats counts
  const [playsResult, playersResult, playInstancesResult] = await Promise.all([
    supabase.from('playbook_plays').select('id', { count: 'exact' }).eq('team_id', teamId).eq('is_archived', false),
    supabase.from('players').select('id', { count: 'exact' }).eq('team_id', teamId).eq('is_active', true),
    supabase.from('play_instances').select('id', { count: 'exact' }).eq('team_id', teamId),
  ]);

  const playbookCount = playsResult.count || 0;
  const rosterCount = playersResult.count || 0;
  const playsTaggedCount = playInstancesResult.count || 0;

  // Fetch comprehensive metrics (with error handling)
  let metrics: ComprehensiveTeamMetrics | null = null;
  try {
    metrics = await TeamMetricsService.getComprehensiveMetrics({ teamId });
  } catch (error) {
    console.error('Error fetching metrics:', error);
  }

  // Calculate points per game for/against from games data
  const gamesWithScores = games.filter(g => g.team_score !== null && g.team_score !== undefined);
  const pointsFor = gamesWithScores.reduce((sum, g) => sum + (g.team_score || 0), 0);
  const pointsAgainst = gamesWithScores.reduce((sum, g) => sum + (g.opponent_score || 0), 0);
  const ppgFor = gamesWithScores.length > 0 ? (pointsFor / gamesWithScores.length).toFixed(1) : '--';
  const ppgAgainst = gamesWithScores.length > 0 ? (pointsAgainst / gamesWithScores.length).toFixed(1) : '--';

  // Get metrics values with fallbacks
  const offenseYPG = metrics?.offense?.volume?.totalYardsPerGame?.toFixed(0) || '--';
  const defenseYPG = metrics?.defense?.volume?.totalYardsAllowedPerGame?.toFixed(0) || '--';
  const turnoverDiff = metrics?.overall?.turnoverDifferential ?? 0;
  const turnoverDiffDisplay = turnoverDiff > 0 ? `+${turnoverDiff}` : turnoverDiff.toString();

  // Format record string
  const recordString = record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <TeamNavigation
          team={team}
          teamId={teamId}
          currentPage="dashboard"
          wins={record.wins}
          losses={record.losses}
          ties={record.ties}
        />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Compact Season Metrics Banner */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Season at a Glance</h2>
              <Link
                href={`/teams/${teamId}/analytics-reporting`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Full Analytics →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-4">
              {/* Record */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{recordString}</div>
                <div className="text-xs text-gray-500 mt-1">Record</div>
              </div>

              {/* Points For/Against */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  <span className="text-green-600">{ppgFor}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-red-600">{ppgAgainst}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">PPG For / Against</div>
              </div>

              {/* Offense YPG */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{offenseYPG}</div>
                <div className="text-xs text-gray-500 mt-1">Off YPG</div>
              </div>

              {/* Defense YPG */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{defenseYPG}</div>
                <div className="text-xs text-gray-500 mt-1">Def YPG</div>
              </div>

              {/* Turnover Diff */}
              <div className="text-center">
                <div className={`text-2xl font-bold ${turnoverDiff > 0 ? 'text-green-600' : turnoverDiff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {turnoverDiffDisplay}
                </div>
                <div className="text-xs text-gray-500 mt-1">TO Diff</div>
              </div>
            </div>
          </div>

          {/* Two Column Layout: Next Game + Team Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Next Game Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Next Game</h3>
              {nextGame ? (
                <>
                  <div className="mb-6">
                    <div className="text-2xl font-semibold text-gray-900">
                      vs {nextGame.opponent || 'TBD'}
                    </div>
                    <div className="text-gray-600 mt-1">
                      {nextGame.date ? new Date(nextGame.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      }) : 'Date TBD'}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/teams/${teamId}/game-prep-hub?game=${nextGame.id}`}
                      className="flex-1 px-4 py-3 bg-black text-white text-center rounded-lg hover:bg-gray-800 transition-colors font-medium"
                    >
                      Game Prep Hub
                    </Link>
                    <Link
                      href={`/teams/${teamId}/game-plan?game=${nextGame.id}`}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 text-center rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Game Plan
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">No upcoming games scheduled</div>
                  <Link
                    href={`/teams/${teamId}/schedule`}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Add Game
                  </Link>
                </div>
              )}
            </div>

            {/* Team Status Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Team Status</h3>
              <div className="space-y-4">
                {/* Playbook Status */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Playbook</span>
                    <span className="font-medium text-gray-900">{playbookCount} plays</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${Math.min((playbookCount / 50) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Roster Status */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Active Roster</span>
                    <span className="font-medium text-gray-900">{rosterCount} players</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${Math.min((rosterCount / 25) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Film Tagged */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Film Tagged</span>
                    <span className="font-medium text-gray-900">{playsTaggedCount} plays</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${Math.min((playsTaggedCount / 200) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
                <Link
                  href={`/teams/${teamId}/playbook`}
                  className="flex-1 px-3 py-2 text-sm text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Playbook
                </Link>
                <Link
                  href={`/teams/${teamId}/players`}
                  className="flex-1 px-3 py-2 text-sm text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Roster
                </Link>
                <Link
                  href={`/teams/${teamId}/film`}
                  className="flex-1 px-3 py-2 text-sm text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Film
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href={`/teams/${teamId}/film`}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Upload Film</div>
                  <div className="text-xs text-gray-500">Add game footage</div>
                </div>
              </Link>

              <Link
                href={`/teams/${teamId}/playbook`}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Build Play</div>
                  <div className="text-xs text-gray-500">Design new plays</div>
                </div>
              </Link>

              <Link
                href={`/teams/${teamId}/game-week`}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Game Week</div>
                  <div className="text-xs text-gray-500">Prep for gameday</div>
                </div>
              </Link>

              <Link
                href={`/teams/${teamId}/analytics-reporting`}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Analytics</div>
                  <div className="text-xs text-gray-500">See what's working</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Games */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Recent Games</h2>
              <Link
                href={`/teams/${teamId}/schedule`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                View Full Schedule →
              </Link>
            </div>

            {games.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {games.slice(0, 5).map((game) => (
                      <tr key={game.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              game.game_result === 'win' ? 'bg-green-500' :
                              game.game_result === 'loss' ? 'bg-red-500' :
                              game.game_result === 'tie' ? 'bg-yellow-500' :
                              'bg-gray-300'
                            }`} />
                            <span className="font-medium text-gray-900">{game.opponent || 'TBD'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {game.date ? new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }) : '--'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            game.game_result === 'win' ? 'bg-green-100 text-green-700' :
                            game.game_result === 'loss' ? 'bg-red-100 text-red-700' :
                            game.game_result === 'tie' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {game.game_result ? game.game_result.charAt(0).toUpperCase() + game.game_result.slice(1) : 'Scheduled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">
                          {game.team_score !== null && game.team_score !== undefined
                            ? `${game.team_score}-${game.opponent_score || 0}`
                            : '--'
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/teams/${teamId}/film?game=${game.id}`}
                            className="text-sm text-gray-500 hover:text-gray-900"
                          >
                            View Film →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg text-center py-12">
                <div className="text-gray-400 mb-4">No games yet</div>
                <Link
                  href={`/teams/${teamId}/schedule`}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors inline-block"
                >
                  Add Game
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
