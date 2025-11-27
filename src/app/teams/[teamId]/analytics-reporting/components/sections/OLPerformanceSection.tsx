/**
 * OL Performance Section
 *
 * Shows offensive line statistics from player_participation table (Tier 3).
 * Fetches data for all OL positions and displays block win rates.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
}

export default function OLPerformanceSection({ teamId, gameId }: OLPerformanceSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<OLPlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchOLStats() {
      setLoading(true);

      try {
        // Build query for player_participation
        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            participation_type,
            block_result,
            play_instances!inner (
              id,
              game_id,
              team_id
            ),
            players!inner (
              id,
              first_name,
              last_name,
              jersey_number,
              primary_position
            )
          `)
          .eq('play_instances.team_id', teamId)
          .in('participation_type', ['ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt']);

        // Filter by game if specified
        if (gameId) {
          query = query.eq('play_instances.game_id', gameId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching OL stats:', error);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Group by player and calculate stats
        const playerStatsMap = new Map<string, OLPlayerStats>();

        data.forEach((record: any) => {
          const playerId = record.player_id;
          const playerName = `${record.players.first_name} ${record.players.last_name}`;
          const jerseyNumber = record.players.jersey_number || '';
          const participationType = record.participation_type;
          const blockResult = record.block_result;

          // Map participation_type to position
          const positionMap: Record<string, 'LT' | 'LG' | 'C' | 'RG' | 'RT'> = {
            'ol_lt': 'LT',
            'ol_lg': 'LG',
            'ol_c': 'C',
            'ol_rg': 'RG',
            'ol_rt': 'RT'
          };
          const position = positionMap[participationType];

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
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Offensive Line Performance
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-800 text-lg mb-2">No OL data available</p>
          <p className="text-blue-700 text-sm">
            Offensive line stats will appear once you tag plays with OL assignments (Tier 3 feature).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
      >
        <span>Offensive Line Performance</span>
        <span className="text-sm font-normal text-gray-600 bg-purple-100 px-2 py-1 rounded ml-2">Tier 3</span>
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
            Data comes from play-by-play film tagging (Tier 3).
          </p>
        </>
      )}
    </section>
  );
}
