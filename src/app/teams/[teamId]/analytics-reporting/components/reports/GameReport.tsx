/**
 * Game Report
 *
 * Comprehensive single-game analysis including:
 * - Game summary and final stats
 * - Offensive metrics
 * - Defensive metrics
 * - Special teams metrics
 * - Key plays and turning points
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function GameReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    offensive: true,
    defensive: true,
    specialTeams: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const selectedGameId = filters.gameId || gameId || null;

      if (!selectedGameId) {
        setLoading(false);
        return;
      }

      // Fetch game details
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', selectedGameId)
        .single();

      if (gameError) {
        console.error('Error loading game:', gameError);
        setLoading(false);
        return;
      }

      setGame(gameData);

      // Fetch play instances for this game to calculate simple metrics
      // First get videos for this game, then get plays for those videos
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id')
        .eq('game_id', selectedGameId);

      if (videosError || !videos || videos.length === 0) {
        console.error('Error loading videos:', videosError);
        // No videos for this game yet - show empty metrics
        setMetrics({
          offense: {
            volume: { totalYards: 0, rushingYards: 0, passingYards: 0, touchdowns: 0 },
            efficiency: { yardsPerPlay: 0, thirdDownConversions: 0, thirdDownAttempts: 0, thirdDownConversionRate: 0 },
            ballSecurity: { turnovers: 0 },
          },
          defense: {
            volume: { totalYardsAllowed: 0, rushingYardsAllowed: 0, passingYardsAllowed: 0, pointsAllowed: gameData?.opponent_score || 0 },
            disruptive: { turnoversForced: 0, sacks: 0, tacklesForLoss: 0, havocRate: 0 },
          },
          specialTeams: {
            kickoff: { averageKickoffYardLine: 0 },
            returns: { averageReturnYards: 0 },
          },
        } as any);
        setLoading(false);
        return;
      }

      const videoIds = videos.map(v => v.id);

      const { data: plays, error: playsError } = await supabase
        .from('play_instances')
        .select('*')
        .in('video_id', videoIds);

      if (playsError) {
        console.error('Error loading plays:', playsError);
        setLoading(false);
        return;
      }

      // Calculate simple game metrics from plays
      const offensivePlays = (plays || []).filter(p => !p.is_opponent_play);
      const defensivePlays = (plays || []).filter(p => p.is_opponent_play);

      // Offensive stats
      const totalYards = offensivePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const rushingPlays = offensivePlays.filter(p => p.play_type === 'run');
      const passingPlays = offensivePlays.filter(p => p.play_type === 'pass');
      const rushingYards = rushingPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const passingYards = passingPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const touchdowns = offensivePlays.filter(p => p.result === 'touchdown').length;
      const turnovers = offensivePlays.filter(p => p.is_turnover).length;
      const thirdDowns = offensivePlays.filter(p => p.down === 3);
      const thirdDownConversions = thirdDowns.filter(p => p.resulted_in_first_down).length;

      // Defensive stats
      const yardsAllowed = defensivePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const rushingYardsAllowed = defensivePlays.filter(p => p.play_type === 'run').reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const passingYardsAllowed = defensivePlays.filter(p => p.play_type === 'pass').reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const turnoversForced = defensivePlays.filter(p => p.is_turnover).length;
      const sacks = defensivePlays.filter(p => p.result === 'sack').length;
      const tacklesForLoss = defensivePlays.filter(p => p.yards_gained && p.yards_gained < 0).length;

      // Create simplified metrics object
      const gameMetrics = {
        offense: {
          volume: {
            totalYards,
            rushingYards,
            passingYards,
            touchdowns,
          },
          efficiency: {
            yardsPerPlay: offensivePlays.length > 0 ? totalYards / offensivePlays.length : 0,
            thirdDownConversions,
            thirdDownAttempts: thirdDowns.length,
            thirdDownConversionRate: thirdDowns.length > 0 ? (thirdDownConversions / thirdDowns.length) * 100 : 0,
          },
          ballSecurity: {
            turnovers,
          },
        },
        defense: {
          volume: {
            totalYardsAllowed: yardsAllowed,
            rushingYardsAllowed,
            passingYardsAllowed,
            pointsAllowed: gameData?.opponent_score || 0,
          },
          disruptive: {
            turnoversForced,
            sacks,
            tacklesForLoss,
            havocRate: defensivePlays.length > 0 ? ((sacks + turnoversForced + tacklesForLoss) / defensivePlays.length) * 100 : 0,
          },
        },
        specialTeams: {
          kickoff: {
            averageKickoffYardLine: 0,
          },
          returns: {
            averageReturnYards: 0,
          },
        },
      };

      setMetrics(gameMetrics as any);
      setLoading(false);
    }

    loadData();
  }, [teamId, gameId, filters]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading game report...</div>
      </div>
    );
  }

  if (!filters.gameId && !gameId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-yellow-800 text-lg mb-2">No game selected</p>
        <p className="text-yellow-700 text-sm">
          Please select a game from the filter above to view the game report.
        </p>
      </div>
    );
  }

  if (!metrics || !game) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load game data</p>
      </div>
    );
  }

  const finalScore = `${game.team_score || 0} - ${game.opponent_score || 0}`;
  const result = game.game_result || 'unknown';
  const resultColor = result === 'win' ? 'text-green-600' : result === 'loss' ? 'text-red-600' : 'text-gray-600';

  return (
    <div>
      {/* Game Summary */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('summary')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Game Summary</span>
          {expandedSections.summary ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.summary && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{game.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(game.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Final Score</p>
                <p className={`text-lg font-semibold ${resultColor}`}>
                  {finalScore}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Result</p>
                <p className={`text-lg font-semibold uppercase ${resultColor}`}>
                  {result}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Offensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('offensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Performance</span>
          {expandedSections.offensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.offensive && (
          <div className="space-y-8">
            {/* Volume */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Yards"
                  value={metrics.offense.volume.totalYards.toString()}
                  subtitle="Total offense"
                />
                <StatCard
                  title="Rushing Yards"
                  value={metrics.offense.volume.rushingYards.toString()}
                  subtitle="Yards on the ground"
                />
                <StatCard
                  title="Passing Yards"
                  value={metrics.offense.volume.passingYards.toString()}
                  subtitle="Yards through the air"
                />
                <StatCard
                  title="Touchdowns"
                  value={metrics.offense.volume.touchdowns.toString()}
                  subtitle="Offensive TDs"
                  color="green"
                />
              </div>
            </div>

            {/* Efficiency */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  title="Yards Per Play"
                  value={metrics.offense.efficiency.yardsPerPlay?.toFixed(2) || '0.00'}
                  subtitle="Overall efficiency"
                  color={(metrics.offense.efficiency.yardsPerPlay || 0) >= 5.5 ? 'green' : 'default'}
                />
                <StatCard
                  title="3rd Down Conversions"
                  value={`${metrics.offense.efficiency.thirdDownConversions}/${metrics.offense.efficiency.thirdDownAttempts}`}
                  subtitle={`${(metrics.offense.efficiency.thirdDownConversionRate || 0).toFixed(1)}%`}
                  color={(metrics.offense.efficiency.thirdDownConversionRate || 0) >= 40 ? 'green' : 'default'}
                />
                <StatCard
                  title="Turnovers"
                  value={metrics.offense.ballSecurity.turnovers.toString()}
                  subtitle="Giveaways"
                  color={metrics.offense.ballSecurity.turnovers > 0 ? 'red' : 'green'}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Defensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('defensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Performance</span>
          {expandedSections.defensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.defensive && (
          <div className="space-y-8">
            {/* Volume */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Yards Allowed"
                  value={metrics.defense.volume.totalYardsAllowed.toString()}
                  subtitle="Total yards given up"
                  color={(metrics.defense.volume.totalYardsAllowed || 999) <= 300 ? 'green' : 'default'}
                />
                <StatCard
                  title="Rushing Yards Allowed"
                  value={metrics.defense.volume.rushingYardsAllowed.toString()}
                  subtitle="Yards on ground"
                />
                <StatCard
                  title="Passing Yards Allowed"
                  value={metrics.defense.volume.passingYardsAllowed.toString()}
                  subtitle="Yards through air"
                />
                <StatCard
                  title="Points Allowed"
                  value={metrics.defense.volume.pointsAllowed.toString()}
                  subtitle="Points given up"
                  color={(metrics.defense.volume.pointsAllowed || 999) <= 20 ? 'green' : 'default'}
                />
              </div>
            </div>

            {/* Disruptive Plays */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Disruptive Plays</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Turnovers Forced"
                  value={metrics.defense.disruptive.turnoversForced.toString()}
                  subtitle="Takeaways"
                  color={metrics.defense.disruptive.turnoversForced > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Sacks"
                  value={metrics.defense.disruptive.sacks.toString()}
                  subtitle="QB takedowns"
                  color={metrics.defense.disruptive.sacks > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Tackles For Loss"
                  value={metrics.defense.disruptive.tacklesForLoss.toString()}
                  subtitle="TFLs"
                  color={metrics.defense.disruptive.tacklesForLoss > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Havoc Rate"
                  value={`${(metrics.defense.disruptive.havocRate || 0).toFixed(1)}%`}
                  subtitle="Disruptive plays"
                  color={(metrics.defense.disruptive.havocRate || 0) >= 10 ? 'green' : 'default'}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Special Teams */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('specialTeams')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Special Teams</span>
          {expandedSections.specialTeams ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.specialTeams && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Kickoff Average"
              value={`${(metrics.specialTeams.kickoff.averageKickoffYardLine || 0).toFixed(1)}`}
              subtitle="Average starting yard line"
            />
            <StatCard
              title="Return Average"
              value={`${(metrics.specialTeams.returns.averageReturnYards || 0).toFixed(1)}`}
              subtitle="Average yards per return"
            />
          </div>
        )}
      </section>
    </div>
  );
}
