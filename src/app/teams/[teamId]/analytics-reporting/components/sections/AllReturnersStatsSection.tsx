/**
 * All Returners Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL kick/punt returners on the team.
 * Queries player_participation table for returner stats (Tier 2+).
 * Uses unified player participation model with participation_type = 'returner'.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface ReturnerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Kick Returns
  kickReturns: number;
  kickReturnYards: number;
  kickReturnAvg: number;
  kickReturnTDs: number;
  kickReturnLong: number;

  // Punt Returns
  puntReturns: number;
  puntReturnYards: number;
  puntReturnAvg: number;
  puntReturnTDs: number;
  puntReturnLong: number;
  fairCatches: number;

  // Combined
  totalReturns: number;
  totalYards: number;
  totalTDs: number;
}

interface AllReturnersStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllReturnersStatsSection({ teamId, gameId, currentTier }: AllReturnersStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<ReturnerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchReturnerStats() {
      setLoading(true);

      try {
        // ======================================================================
        // UNIFIED PLAYER PARTICIPATION MODEL
        // Query player_participation with participation_type = 'returner'
        // ======================================================================
        // Build query - simpler approach without deeply nested joins
        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            yards_gained,
            is_touchdown,
            result,
            metadata,
            play_instance:play_instances!inner (
              id,
              special_teams_unit,
              video_id
            ),
            player:players!inner (
              id,
              first_name,
              last_name,
              jersey_number
            )
          `)
          .eq('team_id', teamId)
          .eq('participation_type', 'returner')
          .eq('phase', 'special_teams');

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching returner stats:', error);
          setLoading(false);
          return;
        }

        // If gameId specified, filter by video's game_id
        let filteredData = data || [];
        if (gameId && data && data.length > 0) {
          const videoIds = [...new Set(data.map((p: any) => p.play_instance?.video_id).filter(Boolean))];

          const { data: videos } = await supabase
            .from('videos')
            .select('id')
            .eq('game_id', gameId)
            .in('id', videoIds);

          const gameVideoIds = new Set(videos?.map(v => v.id) || []);
          filteredData = data.filter((p: any) => gameVideoIds.has(p.play_instance?.video_id));
        }

        if (!filteredData || filteredData.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Group by player and calculate stats
        const returnerStatsMap = new Map<string, ReturnerStats>();

        filteredData.forEach((participation: any) => {
          if (!participation.player_id || !participation.player) return;

          const playerId = participation.player_id;
          const player = participation.player;
          const playInstance = participation.play_instance;
          const metadata = participation.metadata || {};
          const yards = participation.yards_gained || 0;

          // Get or create stats
          let returnerStats = returnerStatsMap.get(playerId);
          if (!returnerStats) {
            returnerStats = {
              playerId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              kickReturns: 0,
              kickReturnYards: 0,
              kickReturnAvg: 0,
              kickReturnTDs: 0,
              kickReturnLong: 0,
              puntReturns: 0,
              puntReturnYards: 0,
              puntReturnAvg: 0,
              puntReturnTDs: 0,
              puntReturnLong: 0,
              fairCatches: 0,
              totalReturns: 0,
              totalYards: 0,
              totalTDs: 0,
            };
            returnerStatsMap.set(playerId, returnerStats);
          }

          // Determine return type from play_instance.special_teams_unit
          const unit = playInstance?.special_teams_unit;
          const isFairCatch = metadata.is_fair_catch || participation.result === 'fair_catch';
          const isTouchdown = participation.is_touchdown;

          if (unit === 'kick_return') {
            if (!isFairCatch) {
              returnerStats.kickReturns++;
              returnerStats.kickReturnYards += yards;
              if (yards > returnerStats.kickReturnLong) {
                returnerStats.kickReturnLong = yards;
              }
              if (isTouchdown) {
                returnerStats.kickReturnTDs++;
              }
            }
          } else if (unit === 'punt_return') {
            if (isFairCatch) {
              returnerStats.fairCatches++;
            } else {
              returnerStats.puntReturns++;
              returnerStats.puntReturnYards += yards;
              if (yards > returnerStats.puntReturnLong) {
                returnerStats.puntReturnLong = yards;
              }
              if (isTouchdown) {
                returnerStats.puntReturnTDs++;
              }
            }
          }
        });

        // Calculate averages and totals
        const returnerStatsArray: ReturnerStats[] = Array.from(returnerStatsMap.values()).map(stats => {
          const totalReturns = stats.kickReturns + stats.puntReturns;
          const totalYards = stats.kickReturnYards + stats.puntReturnYards;
          const totalTDs = stats.kickReturnTDs + stats.puntReturnTDs;

          return {
            ...stats,
            kickReturnAvg: stats.kickReturns > 0 ? stats.kickReturnYards / stats.kickReturns : 0,
            puntReturnAvg: stats.puntReturns > 0 ? stats.puntReturnYards / stats.puntReturns : 0,
            totalReturns,
            totalYards,
            totalTDs,
          };
        });

        // Sort by total returns
        returnerStatsArray.sort((a, b) => b.totalReturns - a.totalReturns);

        setStats(returnerStatsArray);
      } catch (error) {
        console.error('Error calculating returner stats:', error);
      }

      setLoading(false);
    }

    fetchReturnerStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Return Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading return stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Return Stats
          <TierRequirementBadge section="special_teams_stats" />
        </div>
        <TierUpgradeMessage section="special_teams_stats" currentTier={currentTier} />
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
          Return Stats
          <TierRequirementBadge section="special_teams_stats" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          {/* Returner Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={4}>Kick Returns</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={5}>Punt Returns</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={2}>Total</th>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-2"></th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Ret</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Yds</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Avg</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">TD</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Ret</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Yds</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Avg</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">TD</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">FC</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Yds</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">TD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((returner) => (
                    <tr key={returner.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{returner.jerseyNumber} {returner.playerName}
                      </td>
                      {/* Kick Returns */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.kickReturns}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.kickReturnYards}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.kickReturns > 0 ? returner.kickReturnAvg.toFixed(1) : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        <span className={returner.kickReturnTDs > 0 ? 'text-green-600 font-semibold' : ''}>
                          {returner.kickReturnTDs}
                        </span>
                      </td>
                      {/* Punt Returns */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.puntReturns}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.puntReturnYards}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.puntReturns > 0 ? returner.puntReturnAvg.toFixed(1) : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        <span className={returner.puntReturnTDs > 0 ? 'text-green-600 font-semibold' : ''}>
                          {returner.puntReturnTDs}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {returner.fairCatches}
                      </td>
                      {/* Totals */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900 font-semibold">
                        {returner.totalYards}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        <span className={returner.totalTDs > 0 ? 'text-green-600 font-semibold' : ''}>
                          {returner.totalTDs}
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
            <strong>Ret:</strong> Returns. <strong>Avg:</strong> Average yards per return.
            <strong> FC:</strong> Fair catches.
            Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
