/**
 * Player Report
 *
 * Individual player performance analysis by position group.
 * Requires a player to be selected via the filter.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import StatCard from '@/components/analytics/StatCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnalyticsService, PlayerStats } from '@/lib/services/analytics.service';

export default function PlayerReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    stats: true,
    byDown: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadPlayer() {
      if (!filters.playerId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch player data
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', filters.playerId)
        .single();

      setPlayer(playerData);

      // Fetch player stats using analytics service
      try {
        const analyticsService = new AnalyticsService();
        const playerStats = await analyticsService.getPlayerStats(filters.playerId, teamId, filters.gameId);
        setStats(playerStats);
      } catch (error) {
        console.error('Error loading player stats:', error);
      }

      setLoading(false);
    }

    loadPlayer();
  }, [filters.playerId, filters.gameId, teamId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading player report...</div>
      </div>
    );
  }

  if (!filters.playerId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-yellow-800 text-lg mb-2">No player selected</p>
        <p className="text-yellow-700 text-sm">
          Please select a player from the filter above to view their individual report.
        </p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load player data</p>
      </div>
    );
  }

  const isQB = player.primary_position === 'QB';
  const isOffensiveSkill = ['QB', 'RB', 'WR', 'TE'].includes(player.primary_position);

  return (
    <div>
      {/* Player Overview */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Player Overview</span>
          {expandedSections.overview ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.overview && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="h-20 w-20 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                <span className="text-3xl font-bold">
                  {player.jersey_number || '?'}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {player.first_name} {player.last_name}
                </h3>
                <p className="text-lg text-gray-600">{player.primary_position}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Jersey Number</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.jersey_number || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.primary_position || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position Group</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {player.position_group || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Player Statistics */}
      {stats && (
        <section className="mb-12">
          <button
            onClick={() => toggleSection('stats')}
            className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
          >
            <span>Performance Statistics</span>
            {expandedSections.stats ? (
              <ChevronUp className="h-6 w-6" />
            ) : (
              <ChevronDown className="h-6 w-6" />
            )}
          </button>

          {expandedSections.stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Plays"
                value={stats.totalPlays.toString()}
                subtitle="Plays involved"
              />
              <StatCard
                title="Success Rate"
                value={`${(stats.successRate || 0).toFixed(1)}%`}
                subtitle="Successful plays"
                color={(stats.successRate || 0) >= 50 ? 'green' : 'default'}
              />

              {/* QB-specific stats */}
              {isQB && stats.passingAttempts > 0 && (
                <>
                  <StatCard
                    title="Completions"
                    value={`${stats.completions}/${stats.passingAttempts}`}
                    subtitle={`${(stats.completionPct || 0).toFixed(1)}% completion`}
                  />
                  <StatCard
                    title="Passing Yards"
                    value={stats.passingYards.toString()}
                    subtitle="Yards through air"
                    color={stats.passingYards > 0 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Touchdowns"
                    value={stats.passingTouchdowns.toString()}
                    subtitle="Passing TDs"
                    color={stats.passingTouchdowns > 0 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Interceptions"
                    value={stats.interceptions.toString()}
                    subtitle="Picks thrown"
                    color={stats.interceptions > 0 ? 'red' : 'green'}
                  />
                </>
              )}

              {/* Offensive skill position stats - Rushing */}
              {isOffensiveSkill && stats.rushingAttempts > 0 && (
                <>
                  <StatCard
                    title="Carries"
                    value={stats.rushingAttempts.toString()}
                    subtitle="Rushing attempts"
                  />
                  <StatCard
                    title="Rushing Yards"
                    value={stats.rushingYards.toString()}
                    subtitle="Yards on ground"
                    color={stats.rushingYards > 0 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Yards Per Carry"
                    value={stats.rushingAvg.toFixed(1)}
                    subtitle="YPC"
                  />
                  <StatCard
                    title="Rushing TDs"
                    value={stats.rushingTouchdowns.toString()}
                    subtitle="Touchdowns"
                    color={stats.rushingTouchdowns > 0 ? 'green' : 'default'}
                  />
                </>
              )}

              {/* Offensive skill position stats - Receiving */}
              {isOffensiveSkill && stats.receptions > 0 && (
                <>
                  <StatCard
                    title="Targets"
                    value={stats.targets.toString()}
                    subtitle="Times targeted"
                  />
                  <StatCard
                    title="Receptions"
                    value={stats.receptions.toString()}
                    subtitle="Catches"
                  />
                  <StatCard
                    title="Receiving Yards"
                    value={stats.receivingYards.toString()}
                    subtitle="Yards receiving"
                    color={stats.receivingYards > 0 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Yards Per Reception"
                    value={stats.receivingAvg.toFixed(1)}
                    subtitle="YPR"
                  />
                  <StatCard
                    title="Receiving TDs"
                    value={stats.receivingTouchdowns.toString()}
                    subtitle="Touchdowns"
                    color={stats.receivingTouchdowns > 0 ? 'green' : 'default'}
                  />
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Performance by Down */}
      {stats && stats.yardsByDown && (
        <section className="mb-12">
          <button
            onClick={() => toggleSection('byDown')}
            className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
          >
            <span>Performance by Down</span>
            {expandedSections.byDown ? (
              <ChevronUp className="h-6 w-6" />
            ) : (
              <ChevronDown className="h-6 w-6" />
            )}
          </button>

          {expandedSections.byDown && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="1st Down"
                value={`${stats.yardsByDown.firstDown?.attempts || 0} plays`}
                subtitle={`${(stats.yardsByDown.firstDown?.avgYards || 0).toFixed(1)} avg yards`}
              />
              <StatCard
                title="2nd Down"
                value={`${stats.yardsByDown.secondDown?.attempts || 0} plays`}
                subtitle={`${(stats.yardsByDown.secondDown?.avgYards || 0).toFixed(1)} avg yards`}
              />
              <StatCard
                title="3rd Down"
                value={`${stats.yardsByDown.thirdDown?.attempts || 0} plays`}
                subtitle={`${(stats.yardsByDown.thirdDown?.avgYards || 0).toFixed(1)} avg yards`}
              />
              <StatCard
                title="4th Down"
                value={`${stats.yardsByDown.fourthDown?.attempts || 0} plays`}
                subtitle={`${(stats.yardsByDown.fourthDown?.avgYards || 0).toFixed(1)} avg yards`}
              />
            </div>
          )}
        </section>
      )}

      {/* No stats available */}
      {!stats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Stats Available
            </h3>
            <p className="text-gray-600">
              This player doesn't have any recorded stats yet. Stats will appear once plays
              are tagged with this player in the Film Room.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
