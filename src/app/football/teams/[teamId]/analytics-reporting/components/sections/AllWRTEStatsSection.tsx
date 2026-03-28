/**
 * All WR/TE Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL wide receivers and tight ends.
 * Uses database function get_wrte_stats() for optimized server-side aggregation.
 * Falls back to split queries if the function is not available.
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
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_wrte_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          // Map database function response to component interface
          const wrteStatsArray: WRTEStats[] = rpcData.map((wr: any) => ({
            playerId: wr.playerId,
            playerName: wr.playerName,
            jerseyNumber: wr.jerseyNumber || '',
            position: wr.position || 'WR',
            targets: wr.targets || 0,
            receptions: wr.receptions || 0,
            recYards: wr.recYards || 0,
            recAvg: wr.recAvg || 0,
            recTDs: wr.recTDs || 0,
            catchRate: wr.catchRate || 0,
            explosiveCatches: wr.explosiveCatches || 0,
          }));

          setStats(wrteStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for WR/TE stats');

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

        // Step 3: Get player participation for receivers
        const { data: participations } = await supabase
          .from('player_participation')
          .select('player_id, play_instance_id, yards_gained, is_touchdown')
          .eq('team_id', teamId)
          .eq('participation_type', 'receiver')
          .eq('phase', 'offense')
          .in('play_instance_id', playInstanceIds);

        if (!participations || participations.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // Step 4: Get player details (only WRs and TEs)
        const playerIds = [...new Set(participations.map(p => p.player_id))];
        const { data: players } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, primary_position')
          .in('id', playerIds)
          .in('primary_position', ['WR', 'TE']);

        const playerMap = new Map(players?.map(p => [p.id, p]) || []);

        // Step 5: Aggregate stats
        const wrteStatsMap = new Map<string, WRTEStats>();

        participations.forEach((participation) => {
          const player = playerMap.get(participation.player_id);
          if (!player) return; // Skip if not a WR/TE

          const playInstance = playInstanceMap.get(participation.play_instance_id);
          if (!playInstance) return;

          const wrId = participation.player_id;

          let wrStats = wrteStatsMap.get(wrId);
          if (!wrStats) {
            wrStats = {
              playerId: wrId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              position: player.primary_position || 'WR',
              targets: 0,
              receptions: 0,
              recYards: 0,
              recAvg: 0,
              recTDs: 0,
              catchRate: 0,
              explosiveCatches: 0,
            };
            wrteStatsMap.set(wrId, wrStats);
          }

          wrStats.targets++;

          const isComplete = playInstance.is_complete ||
            playInstance.result === 'pass_complete' ||
            playInstance.result === 'complete' ||
            participation.is_touchdown;

          if (isComplete) {
            wrStats.receptions++;
            const yards = participation.yards_gained || 0;
            wrStats.recYards += yards;
            if (participation.is_touchdown) wrStats.recTDs++;
            if (yards >= 15) wrStats.explosiveCatches++;
          }
        });

        // Calculate derived stats
        const wrteStatsArray: WRTEStats[] = Array.from(wrteStatsMap.values()).map(stats => ({
          ...stats,
          recAvg: stats.receptions > 0 ? stats.recYards / stats.receptions : 0,
          catchRate: stats.targets > 0 ? (stats.receptions / stats.targets) * 100 : 0,
        }));

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
