/**
 * OL Performance Section
 *
 * Shows offensive line statistics from player_participation table.
 * Requires Comprehensive tagging tier for OL block tracking.
 * Fetches data for all OL positions and displays block win rates.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface OLPlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: 'LT' | 'LG' | 'C' | 'RG' | 'RT';

  totalAssignments: number;
  blockWins: number;
  blockLosses: number;
  blockWinRate: number;
}

interface OLPerformanceSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function OLPerformanceSection({ teamId, gameId, currentTier }: OLPerformanceSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<OLPlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchOLStats() {
      setLoading(true);

      try {
        // First, get OL players from the roster
        const { data: olPlayers, error: playersError } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, primary_position')
          .eq('team_id', teamId)
          .in('primary_position', ['LT', 'LG', 'C', 'RG', 'RT']);

        if (playersError || !olPlayers || olPlayers.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Get participation records for these players
        const playerIds = olPlayers.map(p => p.id);
        const { data: participations, error: partError } = await supabase
          .from('player_participation')
          .select('player_id, participation_type, result, play_instance_id')
          .eq('team_id', teamId)
          .in('player_id', playerIds)
          .in('participation_type', ['ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt']);

        if (partError) {
          console.error('Error fetching OL participations:', partError);
          setLoading(false);
          return;
        }

        if (!participations || participations.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // If filtering by game, get play instances for that game
        let validPlayIds: Set<string> | null = null;
        if (gameId) {
          const { data: plays } = await supabase
            .from('play_instances')
            .select('id')
            .eq('team_id', teamId)
            .eq('game_id', gameId);
          validPlayIds = new Set(plays?.map(p => p.id) || []);
        }

        // Create a map of player info
        const playerInfoMap = new Map(olPlayers.map(p => [p.id, p]));

        // Group by player and calculate stats
        const playerStatsMap = new Map<string, OLPlayerStats>();

        participations.forEach((record: any) => {
          // Filter by game if needed
          if (validPlayIds && !validPlayIds.has(record.play_instance_id)) return;

          const playerId = record.player_id;
          const playerInfo = playerInfoMap.get(playerId);
          if (!playerInfo) return;

          const playerName = `${playerInfo.first_name} ${playerInfo.last_name}`;
          const jerseyNumber = playerInfo.jersey_number || '';
          const blockResult = record.result;

          // Use player's primary position
          const position = playerInfo.primary_position as 'LT' | 'LG' | 'C' | 'RG' | 'RT';
          if (!position) return;

          // Get or create player stats
          let playerStats = playerStatsMap.get(playerId);
          if (!playerStats) {
            playerStats = {
              playerId,
              playerName,
              jerseyNumber,
              position,
              totalAssignments: 0,
              blockWins: 0,
              blockLosses: 0,
              blockWinRate: 0
            };
            playerStatsMap.set(playerId, playerStats);
          }

          // Count assignments and results
          playerStats.totalAssignments++;
          if (blockResult === 'win') {
            playerStats.blockWins++;
          } else if (blockResult === 'loss') {
            playerStats.blockLosses++;
          }
        });

        // Calculate block win rates
        const playerStatsArray: OLPlayerStats[] = Array.from(playerStatsMap.values()).map(stats => ({
          ...stats,
          blockWinRate: stats.totalAssignments > 0
            ? (stats.blockWins / stats.totalAssignments) * 100
            : 0
        }));

        // Sort by position order: LT, LG, C, RG, RT
        const positionOrder = { 'LT': 0, 'LG': 1, 'C': 2, 'RG': 3, 'RT': 4 };
        playerStatsArray.sort((a, b) => positionOrder[a.position] - positionOrder[b.position]);

        setStats(playerStatsArray);
      } catch (error) {
        console.error('Error calculating OL stats:', error);
      }

      setLoading(false);
    }

    fetchOLStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Offensive Line Performance
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading OL stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Offensive Line Performance
          <TierRequirementBadge section="ol_performance" />
        </div>
        <TierUpgradeMessage section="ol_performance" currentTier={currentTier} />
      </section>
    );
  }

  return (
    <section className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
      >
        <span className="flex items-center gap-3">
          Offensive Line Performance
          <TierRequirementBadge section="ol_performance" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          {/* OL Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Position</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Assignments</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Wins</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Losses</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((player) => (
                    <tr key={player.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{player.jerseyNumber} {player.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                        {player.position}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {player.totalAssignments}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600 font-semibold">
                        {player.blockWins}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-red-600 font-semibold">
                        {player.blockLosses}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={player.blockWinRate >= 70 ? 'text-green-600 font-semibold' : player.blockWinRate >= 50 ? 'text-gray-900' : 'text-red-600'}>
                          {player.blockWinRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <p className="text-sm text-gray-600">
            <strong>Block Win Rate:</strong> Percentage of assignments where the player won their block.
            Good: 70%+, Average: 50-69%, Needs Improvement: &lt;50%.
            Data comes from Comprehensive tagging level.
          </p>
        </>
      )}
    </section>
  );
}
