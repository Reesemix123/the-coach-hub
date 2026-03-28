/**
 * All Kickers Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL kickers and punters on the team.
 * Queries player_participation table for kicker/punter stats (Tier 2+).
 * Uses unified player participation model with participation_type = 'kicker' or 'punter'.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface KickerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Kickoffs
  kickoffs: number;
  kickoffYards: number;
  kickoffAvg: number;
  touchbacks: number;
  touchbackPct: number;

  // Field Goals
  fgAttempts: number;
  fgMade: number;
  fgPct: number;
  fgLong: number;

  // PATs
  patAttempts: number;
  patMade: number;
  patPct: number;

  // Punting
  punts: number;
  puntYards: number;
  puntAvg: number;
  puntLong: number;
}

interface AllKickersStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllKickersStatsSection({ teamId, gameId, currentTier }: AllKickersStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<KickerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchKickerStats() {
      setLoading(true);

      try {
        // ======================================================================
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_kicker_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        // Debug logging for RPC call
        if (rpcError) {
          console.error('get_kicker_stats RPC error:', rpcError);
        } else {
          console.log('get_kicker_stats RPC result:', rpcData);
        }

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const kickerStatsArray: KickerStats[] = rpcData.map((k: any) => ({
            playerId: k.playerId,
            playerName: k.playerName,
            jerseyNumber: k.jerseyNumber || '',
            // Kickoffs (from migration 133)
            kickoffs: k.kickoffs || 0,
            kickoffYards: 0, // Not individually tracked
            kickoffAvg: k.kickoffAvg || 0,
            touchbacks: k.touchbacks || 0,
            touchbackPct: k.touchbackPct || 0,
            // Field Goals
            fgAttempts: k.fgAttempts || 0,
            fgMade: k.fgMade || 0,
            fgPct: k.fgPct || 0,
            fgLong: k.fgLong || 0,
            // PATs (from migration 133)
            patAttempts: k.xpAttempts || 0,
            patMade: k.xpMade || 0,
            patPct: k.xpPct || 0,
            // Punts
            punts: k.punts || 0,
            puntYards: k.puntYards || 0,
            puntAvg: k.puntAvg || 0,
            puntLong: k.longestPunt || 0,
          }));
          setStats(kickerStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for kicker stats');

        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            participation_type,
            yards_gained,
            result,
            metadata,
            play_instance:play_instances!inner (
              id,
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
          .in('participation_type', ['kicker', 'punter'])
          .eq('phase', 'special_teams');

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching kicker stats:', error);
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
        const kickerStatsMap = new Map<string, KickerStats>();

        filteredData.forEach((participation: any) => {
          if (!participation.player_id || !participation.player) return;

          const playerId = participation.player_id;
          const player = participation.player;
          const metadata = participation.metadata || {};

          // Get or create stats
          let kickerStats = kickerStatsMap.get(playerId);
          if (!kickerStats) {
            kickerStats = {
              playerId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              kickoffs: 0,
              kickoffYards: 0,
              kickoffAvg: 0,
              touchbacks: 0,
              touchbackPct: 0,
              fgAttempts: 0,
              fgMade: 0,
              fgPct: 0,
              fgLong: 0,
              patAttempts: 0,
              patMade: 0,
              patPct: 0,
              punts: 0,
              puntYards: 0,
              puntAvg: 0,
              puntLong: 0,
            };
            kickerStatsMap.set(playerId, kickerStats);
          }

          // Handle kicker stats
          if (participation.participation_type === 'kicker') {
            const kickType = metadata.kick_type;
            const yards = participation.yards_gained || 0;

            if (kickType === 'kickoff') {
              kickerStats.kickoffs++;
              kickerStats.kickoffYards += yards;
              if (participation.result === 'touchback') {
                kickerStats.touchbacks++;
              }
            } else if (kickType === 'field_goal') {
              kickerStats.fgAttempts++;
              if (participation.result === 'made') {
                kickerStats.fgMade++;
                if (yards > kickerStats.fgLong) {
                  kickerStats.fgLong = yards;
                }
              }
            } else if (kickType === 'pat') {
              kickerStats.patAttempts++;
              if (participation.result === 'made') {
                kickerStats.patMade++;
              }
            }
          }

          // Handle punter stats
          if (participation.participation_type === 'punter') {
            const yards = participation.yards_gained || 0;
            kickerStats.punts++;
            kickerStats.puntYards += yards;
            if (yards > kickerStats.puntLong) {
              kickerStats.puntLong = yards;
            }
          }
        });

        // Calculate averages and percentages
        const kickerStatsArray: KickerStats[] = Array.from(kickerStatsMap.values()).map(stats => {
          return {
            ...stats,
            kickoffAvg: stats.kickoffs > 0 ? stats.kickoffYards / stats.kickoffs : 0,
            touchbackPct: stats.kickoffs > 0 ? (stats.touchbacks / stats.kickoffs) * 100 : 0,
            fgPct: stats.fgAttempts > 0 ? (stats.fgMade / stats.fgAttempts) * 100 : 0,
            patPct: stats.patAttempts > 0 ? (stats.patMade / stats.patAttempts) * 100 : 0,
            puntAvg: stats.punts > 0 ? stats.puntYards / stats.punts : 0,
          };
        });

        // Sort by total kicks (kickoffs + punts + FG attempts)
        kickerStatsArray.sort((a, b) =>
          (b.kickoffs + b.punts + b.fgAttempts) - (a.kickoffs + a.punts + a.fgAttempts)
        );

        setStats(kickerStatsArray);
      } catch (error) {
        console.error('Error calculating kicker stats:', error);
      }

      setLoading(false);
    }

    fetchKickerStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Kicking Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading kicking stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Kicking Stats
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
          Kicking Stats
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
          {/* Kicking Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={3}>Field Goals</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={2}>PATs</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={3}>Kickoffs</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={3}>Punting</th>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-2"></th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Made</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">%</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Long</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Made</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">%</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">KO</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Avg</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">TB%</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Punts</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Avg</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Long</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((kicker) => (
                    <tr key={kicker.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{kicker.jerseyNumber} {kicker.playerName}
                      </td>
                      {/* Field Goals */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.fgAttempts > 0 ? `${kicker.fgMade}/${kicker.fgAttempts}` : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.fgAttempts > 0 ? `${kicker.fgPct.toFixed(0)}%` : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.fgLong > 0 ? kicker.fgLong : '-'}
                      </td>
                      {/* PATs */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.patAttempts > 0 ? `${kicker.patMade}/${kicker.patAttempts}` : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.patAttempts > 0 ? `${kicker.patPct.toFixed(0)}%` : '-'}
                      </td>
                      {/* Kickoffs */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.kickoffs > 0 ? kicker.kickoffs : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.kickoffs > 0 ? kicker.kickoffAvg.toFixed(1) : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.kickoffs > 0 ? `${kicker.touchbackPct.toFixed(0)}%` : '-'}
                      </td>
                      {/* Punting */}
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.punts > 0 ? kicker.punts : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.punts > 0 ? kicker.puntAvg.toFixed(1) : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">
                        {kicker.puntLong > 0 ? kicker.puntLong : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <p className="text-sm text-gray-600">
            <strong>FG:</strong> Field Goals. <strong>PAT:</strong> Point After Touchdown.
            <strong> KO:</strong> Kickoffs. <strong>TB%:</strong> Touchback percentage.
            Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}
