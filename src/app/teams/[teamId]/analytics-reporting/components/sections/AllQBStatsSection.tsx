/**
 * All QB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL quarterbacks on the team.
 * Queries play_instances table for QB-specific stats (Tier 2+).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface QBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Passing
  attempts: number;
  completions: number;
  completionPct: number;
  passingYards: number;
  yardsPerAttempt: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  successRate: number;
}

interface AllQBStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllQBStatsSection({ teamId, gameId, currentTier }: AllQBStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<QBStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchQBStats() {
      setLoading(true);

      try {
        // Build query for plays where team's QBs threw passes
        let query = supabase
          .from('play_instances')
          .select(`
            qb_id,
            result,
            yards_gained,
            down,
            distance,
            is_complete,
            is_touchdown,
            is_interception,
            is_sack,
            players!qb_id (
              id,
              first_name,
              last_name,
              jersey_number
            )
          `)
          .eq('team_id', teamId)
          .not('qb_id', 'is', null);

        // Filter by game if specified
        if (gameId) {
          query = query.eq('game_id', gameId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching QB stats:', error);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Group by QB and calculate stats
        const qbStatsMap = new Map<string, QBStats>();

        data.forEach((play: any) => {
          if (!play.qb_id || !play.players) return;

          const qbId = play.qb_id;
          const player = play.players;

          // Get or create QB stats
          let qbStats = qbStatsMap.get(qbId);
          if (!qbStats) {
            qbStats = {
              playerId: qbId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              attempts: 0,
              completions: 0,
              completionPct: 0,
              passingYards: 0,
              yardsPerAttempt: 0,
              touchdowns: 0,
              interceptions: 0,
              sacks: 0,
              successRate: 0,
            };
            qbStatsMap.set(qbId, qbStats);
          }

          // Count passing stats
          qbStats.attempts++;

          if (play.is_complete) {
            qbStats.completions++;
          }

          if (play.is_touchdown) {
            qbStats.touchdowns++;
          }

          if (play.is_interception) {
            qbStats.interceptions++;
          }

          if (play.is_sack) {
            qbStats.sacks++;
          } else {
            // Only count yards for non-sack plays
            qbStats.passingYards += play.yards_gained || 0;
          }
        });

        // Calculate percentages and rates
        const qbStatsArray: QBStats[] = Array.from(qbStatsMap.values()).map(stats => {
          const completionPct = stats.attempts > 0
            ? (stats.completions / stats.attempts) * 100
            : 0;

          const yardsPerAttempt = stats.attempts > 0
            ? stats.passingYards / stats.attempts
            : 0;

          // Calculate success rate (simplified - completions / attempts)
          const successRate = stats.attempts > 0
            ? (stats.completions / stats.attempts) * 100
            : 0;

          return {
            ...stats,
            completionPct,
            yardsPerAttempt,
            successRate,
          };
        });

        // Sort by attempts (most active QBs first)
        qbStatsArray.sort((a, b) => b.attempts - a.attempts);

        setStats(qbStatsArray);
      } catch (error) {
        console.error('Error calculating QB stats:', error);
      }

      setLoading(false);
    }

    fetchQBStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Quarterback Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading QB stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Quarterback Stats
          <TierRequirementBadge section="qb_stats" />
        </div>
        <TierUpgradeMessage section="qb_stats" currentTier={currentTier} />
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
          Quarterback Stats
          <TierRequirementBadge section="qb_stats" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          {/* QB Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Comp/Att</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">%</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yards</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPA</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TD</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sacks</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Success %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((qb) => (
                    <tr key={qb.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{qb.jerseyNumber} {qb.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.completions}/{qb.attempts}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.completionPct.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.passingYards}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.yardsPerAttempt.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{qb.touchdowns}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-red-600 font-semibold">{qb.interceptions}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.sacks}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={qb.successRate >= 60 ? 'text-green-600 font-semibold' : ''}>
                          {qb.successRate.toFixed(1)}%
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
            <strong>Success Rate:</strong> Completion percentage (completions / attempts).
            Good: 60%+. Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
