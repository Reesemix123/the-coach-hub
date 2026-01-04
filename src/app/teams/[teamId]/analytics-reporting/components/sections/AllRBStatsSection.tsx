/**
 * All RB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL running backs on the team.
 * Queries player_participation table for RB-specific stats (Tier 2+).
 * Uses unified player participation model with participation_type = 'rusher' and 'receiver'.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface RBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Rushing
  carries: number;
  rushYards: number;
  rushAvg: number;
  rushTDs: number;
  explosiveRuns: number;

  // Receiving
  targets: number;
  receptions: number;
  recYards: number;
  recAvg: number;
  recTDs: number;

  // Combined
  totalTouches: number;
  totalYards: number;
  totalTDs: number;
}

interface AllRBStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllRBStatsSection({ teamId, gameId, currentTier }: AllRBStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<RBStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchRBStats() {
      setLoading(true);

      try {
        // ======================================================================
        // UNIFIED PLAYER PARTICIPATION MODEL
        // Query player_participation for rushers and receivers, filter to RBs
        // ======================================================================
        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            participation_type,
            yards_gained,
            is_touchdown,
            play_instance:play_instances!inner (
              id,
              is_complete,
              result_type,
              video_id,
              videos!inner (
                game_id
              )
            ),
            player:players!player_id (
              id,
              first_name,
              last_name,
              jersey_number,
              primary_position
            )
          `)
          .eq('team_id', teamId)
          .in('participation_type', ['rusher', 'receiver'])
          .eq('phase', 'offense');

        // Filter by game if specified
        if (gameId) {
          query = query.eq('play_instance.videos.game_id', gameId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching RB stats:', error);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Group by RB and calculate stats
        const rbStatsMap = new Map<string, RBStats>();

        data.forEach((participation: any) => {
          if (!participation.player_id || !participation.player) return;

          const player = participation.player;
          // Only include players with primary_position = 'RB'
          if (player.primary_position !== 'RB') return;

          const rbId = participation.player_id;
          const playInstance = participation.play_instance;

          // Get or create RB stats
          let rbStats = rbStatsMap.get(rbId);
          if (!rbStats) {
            rbStats = {
              playerId: rbId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              carries: 0,
              rushYards: 0,
              rushAvg: 0,
              rushTDs: 0,
              explosiveRuns: 0,
              targets: 0,
              receptions: 0,
              recYards: 0,
              recAvg: 0,
              recTDs: 0,
              totalTouches: 0,
              totalYards: 0,
              totalTDs: 0,
            };
            rbStatsMap.set(rbId, rbStats);
          }

          // Handle rushing stats (participation_type = 'rusher')
          if (participation.participation_type === 'rusher') {
            rbStats.carries++;
            rbStats.rushYards += participation.yards_gained || 0;

            if (participation.is_touchdown) {
              rbStats.rushTDs++;
            }

            if ((participation.yards_gained || 0) >= 10) {
              rbStats.explosiveRuns++;
            }
          }

          // Handle receiving stats (participation_type = 'receiver')
          if (participation.participation_type === 'receiver') {
            rbStats.targets++;

            // Check for completion from play_instance or participation
            const isComplete = playInstance?.is_complete ||
              playInstance?.result_type === 'pass_complete' ||
              participation.is_touchdown;

            if (isComplete) {
              rbStats.receptions++;
              rbStats.recYards += participation.yards_gained || 0;

              if (participation.is_touchdown) {
                rbStats.recTDs++;
              }
            }
          }
        });

        // Calculate averages and totals
        const rbStatsArray: RBStats[] = Array.from(rbStatsMap.values()).map(stats => {
          const rushAvg = stats.carries > 0 ? stats.rushYards / stats.carries : 0;
          const recAvg = stats.receptions > 0 ? stats.recYards / stats.receptions : 0;
          const totalTouches = stats.carries + stats.receptions;
          const totalYards = stats.rushYards + stats.recYards;
          const totalTDs = stats.rushTDs + stats.recTDs;

          return {
            ...stats,
            rushAvg,
            recAvg,
            totalTouches,
            totalYards,
            totalTDs,
          };
        });

        // Sort by total touches (most active RBs first)
        rbStatsArray.sort((a, b) => b.totalTouches - a.totalTouches);

        setStats(rbStatsArray);
      } catch (error) {
        console.error('Error calculating RB stats:', error);
      }

      setLoading(false);
    }

    fetchRBStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Running Back Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading RB stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Running Back Stats
          <TierRequirementBadge section="rb_stats" />
        </div>
        <TierUpgradeMessage section="rb_stats" currentTier={currentTier} />
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
          Running Back Stats
          <TierRequirementBadge section="rb_stats" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          {/* RB Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Carries</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rush Yds</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPC</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rush TD</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Exp Runs</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Targets</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec Yds</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec TD</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((rb) => (
                    <tr key={rb.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{rb.jerseyNumber} {rb.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.carries}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.rushYards}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.rushAvg.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{rb.rushTDs}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.explosiveRuns}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.targets}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.receptions}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {rb.recYards}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{rb.recTDs}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                        {rb.totalYards} ({rb.totalTDs} TD)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <p className="text-sm text-gray-600">
            <strong>Exp Runs:</strong> Explosive runs (10+ yards).
            <strong> Total:</strong> Combined rushing + receiving yards and touchdowns.
            Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
