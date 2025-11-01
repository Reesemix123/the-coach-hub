// src/app/teams/[teamId]/analytics-advanced/page.tsx
// Enhanced analytics dashboard with tier-based metrics

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { Team, TeamAnalyticsConfig } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';
import CollapsibleSection from '@/components/analytics/CollapsibleSection';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import StatCard from '@/components/analytics/StatCard';
import StatList from '@/components/analytics/StatList';
import Tooltip from '@/components/analytics/Tooltip';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface Game {
  id: string;
  name?: string;
  opponent?: string;
  date?: string;
  game_result: 'win' | 'loss' | 'tie' | null;
}

type ViewMode = 'cards' | 'list' | 'print';

export default function AdvancedAnalyticsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [config, setConfig] = useState<TeamAnalyticsConfig | null>(null);
  const [basicAnalytics, setBasicAnalytics] = useState<any>(null);
  const [driveAnalytics, setDriveAnalytics] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [olStats, setOLStats] = useState<any[]>([]);
  const [defStats, setDefStats] = useState<any[]>([]);
  const [situationalSplits, setSituationalSplits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and view state
  const [selectedGameId, setSelectedGameId] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const router = useRouter();
  const supabase = createClient();
  const analyticsService = new AnalyticsService();
  const advancedService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      setTeam(teamData);

      // Fetch games for record and filtering
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, name, opponent, date, game_result')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      setGames(gamesData || []);

      // Get tier config
      const tierConfig = await advancedService.getTeamTier(teamId);
      setConfig(tierConfig);

      // Basic analytics (always available)
      const basic = await analyticsService.getTeamAnalytics(teamId);
      setBasicAnalytics(basic);

      // Drive analytics (Tier 2+)
      if (tierConfig.enable_drive_analytics) {
        try {
          const drives = await advancedService.getDriveAnalytics(teamId);
          setDriveAnalytics(drives);
        } catch (error) {
          console.error('Drive analytics error:', error);
        }
      }

      // Player attribution (Tier 2+)
      if (tierConfig.enable_player_attribution) {
        try {
          const players = await advancedService.getPlayerAttributionStats(teamId);
          setPlayerStats(players);
        } catch (error) {
          console.error('Player stats error:', error);
        }
      }

      // OL tracking (Tier 3)
      if (tierConfig.enable_ol_tracking) {
        try {
          const ol = await advancedService.getOffensiveLineStats(teamId);
          setOLStats(ol);
        } catch (error) {
          console.error('OL stats error:', error);
        }
      }

      // Defensive tracking (Tier 3)
      if (tierConfig.enable_defensive_tracking) {
        try {
          const def = await advancedService.getDefensiveStats(teamId);
          setDefStats(def);
        } catch (error) {
          console.error('Defensive stats error:', error);
        }
      }

      // Situational splits (Tier 3)
      if (tierConfig.enable_situational_splits) {
        try {
          const splits = await advancedService.getSituationalSplits(teamId);
          setSituationalSplits(splits);
        } catch (error) {
          console.error('Situational splits error:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!team || !config || !basicAnalytics) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Analytics not available</div>
          <button
            onClick={() => router.push(`/teams/${teamId}`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  const record = getWinLossRecord();
  const winPercentage = record.wins + record.losses > 0
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(0)
    : '0';

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="analytics"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Quick Stats Banner */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{games.length}</div>
              <div className="text-sm text-gray-600 mt-1">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{basicAnalytics?.totalPlays || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Total Plays</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{basicAnalytics?.avgYardsPerPlay?.toFixed(1) || '0.0'}</div>
              <div className="text-sm text-gray-600 mt-1">Yards Per Play</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{basicAnalytics?.successRate?.toFixed(0) || '0'}%</div>
              <div className="text-sm text-gray-600 mt-1">Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        {/* Filters */}
        <AnalyticsFilters
          games={games}
          selectedGameId={selectedGameId}
          onGameChange={setSelectedGameId}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Overall Performance - Collapsible */}
        <CollapsibleSection
          id="overall-performance"
          title="Overall Performance"
          defaultExpanded={true}
        >
          {viewMode === 'cards' ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Plays"
                  value={basicAnalytics.totalPlays}
                  tooltip={METRIC_DEFINITIONS.totalPlays}
                />
                <StatCard
                  label="Yards Per Play"
                  value={basicAnalytics.avgYardsPerPlay.toFixed(1)}
                  tooltip={METRIC_DEFINITIONS.yardsPerPlay}
                />
                <StatCard
                  label="Success Rate"
                  value={`${basicAnalytics.successRate.toFixed(1)}%`}
                  tooltip={METRIC_DEFINITIONS.successRate}
                />
                <StatCard
                  label="First Downs"
                  value={basicAnalytics.firstDowns}
                  tooltip={METRIC_DEFINITIONS.firstDowns}
                />
              </div>

              {/* Down Breakdown */}
              <div className="mt-8 grid grid-cols-4 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">1st Down</div>
                  <div className="text-2xl font-semibold text-gray-900">{basicAnalytics.firstDownStats.successRate.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">{basicAnalytics.firstDownStats.plays} plays</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">2nd Down</div>
                  <div className="text-2xl font-semibold text-gray-900">{basicAnalytics.secondDownStats.successRate.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">{basicAnalytics.secondDownStats.plays} plays</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">3rd Down</div>
                  <div className="text-2xl font-semibold text-gray-900">{basicAnalytics.thirdDownStats.successRate.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">{basicAnalytics.thirdDownStats.conversions} conversions</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Red Zone</div>
                  <div className="text-2xl font-semibold text-gray-900">{basicAnalytics.redZoneSuccessRate.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">{basicAnalytics.redZoneTouchdowns} TDs</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <StatList
                stats={[
                  { label: 'Total Plays', value: basicAnalytics.totalPlays, tooltip: METRIC_DEFINITIONS.totalPlays },
                  { label: 'Yards Per Play', value: basicAnalytics.avgYardsPerPlay.toFixed(1), tooltip: METRIC_DEFINITIONS.yardsPerPlay },
                  { label: 'Success Rate', value: `${basicAnalytics.successRate.toFixed(1)}%`, tooltip: METRIC_DEFINITIONS.successRate },
                  { label: 'First Downs', value: basicAnalytics.firstDowns, tooltip: METRIC_DEFINITIONS.firstDowns },
                ]}
                columns={4}
              />

              <div className="mt-6">
                <StatList
                  stats={[
                    { label: '1st Down Success', value: `${basicAnalytics.firstDownStats.successRate.toFixed(0)}% (${basicAnalytics.firstDownStats.plays} plays)`, tooltip: METRIC_DEFINITIONS.firstDownSuccess },
                    { label: '2nd Down Success', value: `${basicAnalytics.secondDownStats.successRate.toFixed(0)}% (${basicAnalytics.secondDownStats.plays} plays)`, tooltip: METRIC_DEFINITIONS.secondDownSuccess },
                    { label: '3rd Down Conv', value: `${basicAnalytics.thirdDownStats.successRate.toFixed(0)}% (${basicAnalytics.thirdDownStats.conversions} conv)`, tooltip: METRIC_DEFINITIONS.thirdDownConversion },
                    { label: 'Red Zone TD', value: `${basicAnalytics.redZoneSuccessRate.toFixed(0)}% (${basicAnalytics.redZoneTouchdowns} TDs)`, tooltip: METRIC_DEFINITIONS.redZoneTD },
                  ]}
                  columns={2}
                />
              </div>
            </>
          )}
        </CollapsibleSection>

        {/* Drive Analytics (Tier 2+) */}
        {driveAnalytics && (
          <CollapsibleSection
            id="drive-analytics"
            title="Drive Analytics"
            badge="Tier 2+"
            badgeColor="blue"
            defaultExpanded={false}
          >
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Points Per Drive"
                  value={driveAnalytics.pointsPerDrive.toFixed(2)}
                  color="blue"
                  tooltip={METRIC_DEFINITIONS.pointsPerDrive}
                />
                <StatCard
                  label="3-and-Out Rate"
                  value={`${driveAnalytics.threeAndOutRate.toFixed(1)}%`}
                  color="blue"
                  tooltip={METRIC_DEFINITIONS.threeAndOutRate}
                />
                <StatCard
                  label="Scoring Drives"
                  value={`${driveAnalytics.scoringDriveRate.toFixed(0)}%`}
                  color="blue"
                  tooltip={METRIC_DEFINITIONS.scoringDriveRate}
                />
                <StatCard
                  label="RZ TD Rate"
                  value={`${driveAnalytics.redZoneTouchdownRate.toFixed(0)}%`}
                  color="blue"
                  tooltip={METRIC_DEFINITIONS.redZoneTD}
                />
              </div>
            ) : (
              <StatList
                stats={[
                  { label: 'Points Per Drive', value: driveAnalytics.pointsPerDrive.toFixed(2), tooltip: METRIC_DEFINITIONS.pointsPerDrive },
                  { label: '3-and-Out Rate', value: `${driveAnalytics.threeAndOutRate.toFixed(1)}%`, tooltip: METRIC_DEFINITIONS.threeAndOutRate },
                  { label: 'Scoring Drives', value: `${driveAnalytics.scoringDriveRate.toFixed(0)}%`, tooltip: METRIC_DEFINITIONS.scoringDriveRate },
                  { label: 'RZ TD Rate', value: `${driveAnalytics.redZoneTouchdownRate.toFixed(0)}%`, tooltip: METRIC_DEFINITIONS.redZoneTD },
                ]}
                columns={4}
              />
            )}
            <p className="text-sm text-gray-600 mt-6">
              Drives are managed in the Film Room when tagging plays.
            </p>
          </CollapsibleSection>
        )}

        {/* Player Attribution (Tier 2+) */}
        {playerStats.length > 0 && (
          <CollapsibleSection
            id="player-performance"
            title="Player Performance"
            badge="Tier 2+"
            badgeColor="blue"
            defaultExpanded={false}
          >
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      <Tooltip content={METRIC_DEFINITIONS.rushingYards}>
                        <span>Rush</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      <Tooltip content={METRIC_DEFINITIONS.passingStats}>
                        <span>Pass</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      <Tooltip content={METRIC_DEFINITIONS.receivingStats}>
                        <span>Rec</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {playerStats.slice(0, 10).map((player) => (
                    <tr key={player.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{player.jerseyNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{player.playerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{player.position}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {player.carries > 0 && `${player.carries}-${player.rushYards} (${player.rushAvg.toFixed(1)})`}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {player.passAttempts > 0 && `${player.completions}/${player.passAttempts} (${player.completionPct.toFixed(0)}%)`}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {player.targets > 0 && `${player.receptions}-${player.recYards} (${player.catchRate.toFixed(0)}%)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Offensive Line (Tier 3) */}
        {olStats.length > 0 && (
          <CollapsibleSection
            id="offensive-line"
            title="Offensive Line Performance"
            badge="Tier 3"
            badgeColor="green"
            defaultExpanded={false}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Block Win Rate by Position:</span>
                <Tooltip content={METRIC_DEFINITIONS.blockWinRate}>
                  <span className="text-sm text-gray-600">What is this?</span>
                </Tooltip>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {olStats.map((player) => (
                  <div key={player.playerId} className="border border-gray-200 rounded-lg p-4 print-keep-together">
                    <div className="text-xs font-semibold text-gray-500 mb-1">{player.position}</div>
                    <div className="text-sm font-medium text-gray-900 mb-2">
                      #{player.jerseyNumber} {player.playerName.split(' ')[1]}
                    </div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">{player.blockWinRate.toFixed(0)}%</div>
                    <div className="text-xs text-gray-600">
                      {player.blockWins}W-{player.blockLosses}L
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Defensive Stats (Tier 3) */}
        {defStats.length > 0 && (
          <CollapsibleSection
            id="defensive-performance"
            title="Defensive Performance"
            badge="Tier 3"
            badgeColor="green"
            defaultExpanded={false}
          >
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Player</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      <Tooltip content={METRIC_DEFINITIONS.tackles}>
                        <span>Tkl</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      <Tooltip content={METRIC_DEFINITIONS.pressures}>
                        <span>Press</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      <Tooltip content={METRIC_DEFINITIONS.tfl}>
                        <span>TFL</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      <Tooltip content={METRIC_DEFINITIONS.sacks}>
                        <span>Sacks</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      <Tooltip content={METRIC_DEFINITIONS.pbu}>
                        <span>PBU</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {defStats.slice(0, 15).map((player) => (
                    <tr key={player.playerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{player.jerseyNumber}</td>
                      <td className="px-4 py-3 text-gray-900">{player.playerName}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{player.totalTackles}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{player.pressures}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{player.tfls}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{player.sacks}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{player.pbus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Situational Splits (Tier 3) */}
        {situationalSplits.length > 0 && (
          <CollapsibleSection
            id="situational-splits"
            title="Situational Splits"
            badge="Tier 3"
            badgeColor="green"
            defaultExpanded={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {situationalSplits.map((split, idx) => {
                // Determine which tooltip to use based on the situation type
                const getTooltipForSituation = (situation: string) => {
                  if (situation.toLowerCase().includes('motion')) return METRIC_DEFINITIONS.motionSplit;
                  if (situation.toLowerCase().includes('play action')) return METRIC_DEFINITIONS.playActionSplit;
                  if (situation.toLowerCase().includes('blitz')) return METRIC_DEFINITIONS.blitzSplit;
                  return null;
                };

                const tooltip = getTooltipForSituation(split.situation);

                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-6 print-keep-together">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-lg font-semibold text-gray-900">{split.situation}</div>
                      {tooltip && (
                        <Tooltip content={tooltip}>
                          <span className="text-xs text-gray-400">ⓘ</span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Plays</span>
                        <span className="font-medium text-gray-900">{split.plays || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <Tooltip content={METRIC_DEFINITIONS.yardsPerPlay}>
                          <span className="text-gray-600">YPP</span>
                        </Tooltip>
                        <span className="font-medium text-gray-900">{split.yardsPerPlay?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <Tooltip content={METRIC_DEFINITIONS.successRate}>
                          <span className="text-gray-600">Success Rate</span>
                        </Tooltip>
                        <span className="font-medium text-gray-900">{split.successRate?.toFixed(1) || '0'}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Top Plays */}
        {basicAnalytics.topPlays.length > 0 && (
          <CollapsibleSection
            id="top-plays"
            title="Top Performing Plays"
            defaultExpanded={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {basicAnalytics.topPlays.map((play: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 print-keep-together">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{play.play_name}</div>
                      <div className="text-sm text-gray-600 mt-1">{play.play_code}</div>
                    </div>
                    <div className="text-right">
                      <Tooltip content={METRIC_DEFINITIONS.playSuccessRate}>
                        <div className="text-2xl font-semibold text-gray-900">{play.successRate.toFixed(0)}%</div>
                      </Tooltip>
                      <div className="text-xs text-gray-500">{play.attempts} attempts</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <Tooltip content={METRIC_DEFINITIONS.playAvgYards}>
                      <span className="text-gray-600">{play.avgYards.toFixed(1)} yards/play</span>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
