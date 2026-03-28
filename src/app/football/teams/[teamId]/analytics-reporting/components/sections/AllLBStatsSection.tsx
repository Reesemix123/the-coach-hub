/**
 * All LB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL linebackers.
 * Queries player_participation table for LB-specific actions (Tier 3).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface LBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Tackles
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;

  // Pass Rush
  pressures: number;
  sacks: number;

  // Coverage
  coverageSnaps: number;

  // Havoc
  tfls: number;
  forcedFumbles: number;
  interceptions: number;
  pbus: number;
  havocPlays: number;
}

interface AllLBStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllLBStatsSection({ teamId, gameId, currentTier }: AllLBStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<LBStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchLBStats() {
      setLoading(true);

      try {
        // ======================================================================
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_lb_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const lbStatsArray: LBStats[] = rpcData.map((l: any) => ({
            playerId: l.playerId,
            playerName: l.playerName,
            jerseyNumber: l.jerseyNumber || '',
            position: l.position || 'LB',
            primaryTackles: l.primaryTackles || 0,
            assistTackles: l.assistTackles || 0,
            totalTackles: l.totalTackles || 0,
            missedTackles: l.missedTackles || 0,
            pressures: l.pressures || 0,
            sacks: l.sacks || 0,
            coverageSnaps: l.coverageSnaps || 0,
            tfls: l.tfls || 0,
            forcedFumbles: l.forcedFumbles || 0,
            interceptions: l.interceptions || 0,
            pbus: l.pbus || 0,
            havocPlays: l.havocPlays || 0,
          }));
          setStats(lbStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for LB stats');

        let query = supabase
          .from('player_participation')
          .select(`
            player_id,
            participation_type,
            result,
            play_instance:play_instances!inner (
              id,
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
          .eq('phase', 'defense');

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching LB stats:', error);
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

        const lbStatsMap = new Map<string, LBStats>();

        filteredData.forEach((record: any) => {
          if (!record.player_id || !record.player) return;

          const player = record.player;
          const position = player.primary_position;

          // Only LB positions
          if (!['LB', 'ILB', 'OLB', 'MLB'].includes(position)) return;

          const playerId = record.player_id;
          const participationType = record.participation_type;
          const result = record.result;

          let lbStats = lbStatsMap.get(playerId);
          if (!lbStats) {
            lbStats = {
              playerId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              position: player.primary_position,
              primaryTackles: 0,
              assistTackles: 0,
              totalTackles: 0,
              missedTackles: 0,
              pressures: 0,
              sacks: 0,
              coverageSnaps: 0,
              tfls: 0,
              forcedFumbles: 0,
              interceptions: 0,
              pbus: 0,
              havocPlays: 0,
            };
            lbStatsMap.set(playerId, lbStats);
          }

          switch (participationType) {
            case 'primary_tackle':
              lbStats.primaryTackles++;
              lbStats.totalTackles++;
              break;
            case 'assist_tackle':
              lbStats.assistTackles++;
              lbStats.totalTackles++;
              break;
            case 'missed_tackle':
              lbStats.missedTackles++;
              break;
            case 'pressure':
              lbStats.pressures++;
              if (result === 'sack') {
                lbStats.sacks++;
              }
              break;
            case 'coverage_assignment':
              lbStats.coverageSnaps++;
              break;
            case 'tackle_for_loss':
              lbStats.tfls++;
              lbStats.havocPlays++;
              break;
            case 'forced_fumble':
              lbStats.forcedFumbles++;
              lbStats.havocPlays++;
              break;
            case 'interception':
              lbStats.interceptions++;
              lbStats.havocPlays++;
              break;
            case 'pass_breakup':
              lbStats.pbus++;
              lbStats.havocPlays++;
              break;
          }
        });

        const lbStatsArray: LBStats[] = Array.from(lbStatsMap.values());
        lbStatsArray.sort((a, b) => b.totalTackles - a.totalTackles);

        setStats(lbStatsArray);
      } catch (error) {
        console.error('Error calculating LB stats:', error);
      }

      setLoading(false);
    }

    fetchLBStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Linebacker Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading LB stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Linebacker Stats
          <TierRequirementBadge section="lb_stats" />
        </div>
        <TierUpgradeMessage section="lb_stats" currentTier={currentTier} />
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
          Linebacker Stats
          <TierRequirementBadge section="lb_stats" />
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
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tackles</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Solo</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Ast</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Miss</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Pressures</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sacks</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cov</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TFLs</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">PBU</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Havoc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((lb) => (
                    <tr key={lb.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{lb.jerseyNumber} {lb.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                        {lb.position}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                        {lb.totalTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {lb.primaryTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {lb.assistTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={lb.missedTackles > 0 ? 'text-red-600' : 'text-gray-900'}>
                          {lb.missedTackles}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {lb.pressures}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{lb.sacks}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {lb.coverageSnaps}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-red-600 font-semibold">{lb.tfls}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{lb.interceptions}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {lb.pbus}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-bold">
                        {lb.havocPlays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            <strong>Cov:</strong> Coverage snaps.
            <strong> PBU:</strong> Pass breakups.
            <strong> Havoc:</strong> TFLs + INTs + FFs + PBUs.
            Data from Comprehensive tagging level.
          </p>
        </>
      )}
    </section>
  );
}
