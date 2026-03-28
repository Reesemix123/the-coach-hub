/**
 * All RB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL running backs on the team.
 * Uses database function get_rb_stats() for optimized server-side aggregation.
 * Falls back to split queries if the function is not available.
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
  longestRun: number;

  // Receiving
  targets: number;
  receptions: number;
  recYards: number;
  recTDs: number;

  // Combined
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
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_rb_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          // Map database function response to component interface
          const rbStatsArray: RBStats[] = rpcData.map((rb: any) => ({
            playerId: rb.playerId,
            playerName: rb.playerName,
            jerseyNumber: rb.jerseyNumber || '',
            carries: rb.carries || 0,
            rushYards: rb.rushYards || 0,
            rushAvg: rb.rushAvg || 0,
            rushTDs: rb.rushTDs || 0,
            explosiveRuns: rb.explosiveRuns || 0,
            longestRun: rb.longestRun || 0,
            targets: rb.targets || 0,
            receptions: rb.receptions || 0,
            recYards: rb.recYards || 0,
            recTDs: rb.recTDs || 0,
            totalYards: rb.totalYards || 0,
            totalTDs: rb.totalTDs || 0,
          }));

          setStats(rbStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for RB stats');

        // Step 1: Get video IDs for this game (if filtering by game)
        let videoIds: string[] = [];
        if (gameId) {
          const { data: videos } = await supabase
            .from('videos')
            .select('id')
            .eq('game_id', gameId);
          videoIds = videos?.map(v => v.id) || [];
          if (videoIds.length === 0) {
            setStats([]);
            setLoading(false);
            return;
          }
        }

        // Step 2: Get play instances for those videos (or all for team)
        let playInstanceQuery = supabase
          .from('play_instances')
          .select('id, video_id, result, is_complete')
          .eq('team_id', teamId)
          .eq('is_opponent_play', false);

        if (videoIds.length > 0) {
          playInstanceQuery = playInstanceQuery.in('video_id', videoIds);
        }

        const { data: playInstances } = await playInstanceQuery;
        if (!playInstances || playInstances.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        const playInstanceIds = playInstances.map(pi => pi.id);
        const playInstanceMap = new Map(playInstances.map(pi => [pi.id, pi]));

        // Step 3: Get player participation for rushers and receivers
        // Note: 'rusher' is the correct type from migration 123, 'ball_carrier' is legacy
        const { data: participations } = await supabase
          .from('player_participation')
          .select('player_id, play_instance_id, participation_type, yards_gained, is_touchdown')
          .eq('team_id', teamId)
          .in('participation_type', ['rusher', 'ball_carrier', 'receiver'])
          .eq('phase', 'offense')
          .in('play_instance_id', playInstanceIds);

        if (!participations || participations.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Step 4: Get player details (only RBs)
        const playerIds = [...new Set(participations.map(p => p.player_id))];
        const { data: players } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, primary_position')
          .in('id', playerIds)
          .in('primary_position', ['RB', 'FB', 'HB']);

        const playerMap = new Map(players?.map(p => [p.id, p]) || []);

        // Step 5: Aggregate stats
        const rbStatsMap = new Map<string, RBStats>();

        participations.forEach((participation) => {
          const player = playerMap.get(participation.player_id);
          if (!player) return; // Skip if not an RB

          const playInstance = playInstanceMap.get(participation.play_instance_id);
          if (!playInstance) return;

          const rbId = participation.player_id;

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
              longestRun: 0,
              targets: 0,
              receptions: 0,
              recYards: 0,
              recTDs: 0,
              totalYards: 0,
              totalTDs: 0,
            };
            rbStatsMap.set(rbId, rbStats);
          }

          // Handle rushing stats (both 'rusher' and legacy 'ball_carrier')
          if (participation.participation_type === 'rusher' || participation.participation_type === 'ball_carrier') {
            rbStats.carries++;
            const yards = participation.yards_gained || 0;
            rbStats.rushYards += yards;
            if (yards > rbStats.longestRun) rbStats.longestRun = yards;
            if (yards >= 10) rbStats.explosiveRuns++;
            if (participation.is_touchdown) rbStats.rushTDs++;
          }

          // Handle receiving stats
          if (participation.participation_type === 'receiver') {
            rbStats.targets++;
            const isComplete = playInstance.is_complete ||
              playInstance.result === 'pass_complete' ||
              playInstance.result === 'complete' ||
              participation.is_touchdown;

            if (isComplete) {
              rbStats.receptions++;
              rbStats.recYards += participation.yards_gained || 0;
              if (participation.is_touchdown) rbStats.recTDs++;
            }
          }
        });

        // Calculate derived stats
        const rbStatsArray: RBStats[] = Array.from(rbStatsMap.values()).map(stats => ({
          ...stats,
          rushAvg: stats.carries > 0 ? stats.rushYards / stats.carries : 0,
          totalYards: stats.rushYards + stats.recYards,
          totalTDs: stats.rushTDs + stats.recTDs,
        }));

        rbStatsArray.sort((a, b) => b.carries - a.carries);
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
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Exp</th>
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
            <strong>Exp:</strong> Explosive runs (10+ yards).
            <strong> Total:</strong> Combined rushing + receiving yards and touchdowns.
            Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
