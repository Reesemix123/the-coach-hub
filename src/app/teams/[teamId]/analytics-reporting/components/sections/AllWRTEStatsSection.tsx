/**
 * All WR/TE Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL wide receivers and tight ends.
 * Queries player_participation table for WR/TE-specific stats (Tier 2+).
 * Uses unified player participation model with participation_type = 'receiver'.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface WRTEStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  targets: number;
  receptions: number;
  recYards: number;
  recAvg: number;
  recTDs: number;
  catchRate: number;
  explosiveCatches: number;
}

interface AllWRTEStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllWRTEStatsSection({ teamId, gameId, currentTier }: AllWRTEStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<WRTEStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchWRTEStats() {
      setLoading(true);

      try {
        // ======================================================================
        // UNIFIED PLAYER PARTICIPATION MODEL
        // Query player_participation with participation_type = 'receiver'
        // ======================================================================
        // Build query - simpler approach without deeply nested joins
        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            yards_gained,
            is_touchdown,
            play_instance:play_instances!inner (
              id,
              is_complete,
              result_type,
              video_id
            ),
            player:players!inner (
              id,
              first_name,
              last_name,
              jersey_number,
              primary_position
            )
          `)
          .eq('team_id', teamId)
          .eq('participation_type', 'receiver')
          .eq('phase', 'offense');

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching WR/TE stats:', error);
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

        const wrteStatsMap = new Map<string, WRTEStats>();

        filteredData.forEach((participation: any) => {
          if (!participation.player_id || !participation.player) return;

          const player = participation.player;
          const position = player.primary_position;
          const playInstance = participation.play_instance;

          // Only WRs and TEs
          if (position !== 'WR' && position !== 'TE') return;

          const playerId = participation.player_id;

          let wrteStats = wrteStatsMap.get(playerId);
          if (!wrteStats) {
            wrteStats = {
              playerId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              position,
              targets: 0,
              receptions: 0,
              recYards: 0,
              recAvg: 0,
              recTDs: 0,
              catchRate: 0,
              explosiveCatches: 0,
            };
            wrteStatsMap.set(playerId, wrteStats);
          }

          wrteStats.targets++;

          // Check for completion from play_instance or participation
          const isComplete = playInstance?.is_complete ||
            playInstance?.result_type === 'pass_complete' ||
            participation.is_touchdown;

          if (isComplete) {
            wrteStats.receptions++;
            wrteStats.recYards += participation.yards_gained || 0;

            if (participation.is_touchdown) {
              wrteStats.recTDs++;
            }

            if ((participation.yards_gained || 0) >= 15) {
              wrteStats.explosiveCatches++;
            }
          }
        });

        const wrteStatsArray: WRTEStats[] = Array.from(wrteStatsMap.values()).map(stats => {
          const recAvg = stats.receptions > 0 ? stats.recYards / stats.receptions : 0;
          const catchRate = stats.targets > 0 ? (stats.receptions / stats.targets) * 100 : 0;

          return {
            ...stats,
            recAvg,
            catchRate,
          };
        });

        wrteStatsArray.sort((a, b) => b.targets - a.targets);

        setStats(wrteStatsArray);
      } catch (error) {
        console.error('Error calculating WR/TE stats:', error);
      }

      setLoading(false);
    }

    fetchWRTEStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Receiver Stats (WR/TE)
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading WR/TE stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Receiver Stats (WR/TE)
          <TierRequirementBadge section="wr_te_stats" />
        </div>
        <TierUpgradeMessage section="wr_te_stats" currentTier={currentTier} />
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
          Receiver Stats (WR/TE)
          <TierRequirementBadge section="wr_te_stats" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Pos</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Targets</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Catch %</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yards</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPR</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TD</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Exp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((wrte) => (
                    <tr key={wrte.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{wrte.jerseyNumber} {wrte.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                        {wrte.position}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.targets}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.receptions}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.catchRate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.recYards}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.recAvg.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{wrte.recTDs}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {wrte.explosiveCatches}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            <strong>Exp:</strong> Explosive catches (15+ yards).
            <strong> Catch %:</strong> Receptions / targets.
            Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
