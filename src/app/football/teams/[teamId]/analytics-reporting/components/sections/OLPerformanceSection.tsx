/**
 * OL Performance Section
 *
 * Shows offensive line statistics from player_participation table.
 * Requires Comprehensive tagging tier for OL block tracking.
 * Resolves each OL player's primary slot (LT/LG/C/RG/RT) from
 * player_scheme_assignments against the team's default offense scheme.
 * Lowest depth wins; ties broken by slot order (LT < LG < C < RG < RT).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import { getDefaultScheme } from '@/lib/services/scheme.service';
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
        const offenseScheme = await getDefaultScheme(supabase, teamId, 'offense');
        if (!offenseScheme) { setStats([]); setLoading(false); return; }

        const SLOT_ORDER: Record<string, number> = { LT: 0, LG: 1, C: 2, RG: 3, RT: 4 };

        const olSlotIds = offenseScheme.scheme_positions
          .filter(p => p.slot_code in SLOT_ORDER)
          .map(p => p.id);

        if (olSlotIds.length === 0) { setStats([]); setLoading(false); return; }

        // Fetch all OL slot assignments for the team
        const { data: assignments } = await supabase
          .from('player_scheme_assignments')
          .select(`
            player_id, depth,
            scheme_positions!inner (slot_code),
            players!inner (id, first_name, last_name, jersey_number)
          `)
          .in('scheme_position_id', olSlotIds);

        if (!assignments || assignments.length === 0) { setStats([]); setLoading(false); return; }

        // Resolve each player's primary slot — lowest depth wins, ties by slot order
        type Candidate = { slot: string; depth: number; jersey: string; name: string };
        const candidatesByPlayer = new Map<string, Candidate[]>();
        for (const a of assignments) {
          const sp = (a as unknown as { scheme_positions: { slot_code: string } }).scheme_positions;
          const player = (a as unknown as {
            players: { id: string; first_name: string; last_name: string; jersey_number: string }
          }).players;
          const list = candidatesByPlayer.get(player.id) ?? [];
          list.push({
            slot: sp.slot_code,
            depth: a.depth,
            jersey: player.jersey_number || '',
            name: `${player.first_name} ${player.last_name}`,
          });
          candidatesByPlayer.set(player.id, list);
        }

        const primarySlotByPlayer = new Map<string, { slot: string; jersey: string; name: string }>();
        for (const [playerId, candidates] of candidatesByPlayer) {
          candidates.sort((a, b) => a.depth - b.depth || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
          const winner = candidates[0];
          primarySlotByPlayer.set(playerId, { slot: winner.slot, jersey: winner.jersey, name: winner.name });
        }

        const playerIds = Array.from(primarySlotByPlayer.keys());

        // Fetch participation records for these players
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

        // Aggregate stats per player
        const playerStatsMap = new Map<string, OLPlayerStats>();

        participations.forEach((record: { player_id: string; result: string | null; play_instance_id: string }) => {
          if (validPlayIds && !validPlayIds.has(record.play_instance_id)) return;
          const info = primarySlotByPlayer.get(record.player_id);
          if (!info) return;

          const position = info.slot as 'LT' | 'LG' | 'C' | 'RG' | 'RT';

          let stats = playerStatsMap.get(record.player_id);
          if (!stats) {
            stats = {
              playerId: record.player_id,
              playerName: info.name,
              jerseyNumber: info.jersey,
              position,
              totalAssignments: 0,
              blockWins: 0,
              blockLosses: 0,
              blockWinRate: 0,
            };
            playerStatsMap.set(record.player_id, stats);
          }
          stats.totalAssignments++;
          if (record.result === 'win') stats.blockWins++;
          else if (record.result === 'loss') stats.blockLosses++;
        });

        // Calculate block win rates and sort by slot order
        const playerStatsArray: OLPlayerStats[] = Array.from(playerStatsMap.values()).map(stats => ({
          ...stats,
          blockWinRate: stats.totalAssignments > 0
            ? (stats.blockWins / stats.totalAssignments) * 100
            : 0,
        }));
        playerStatsArray.sort((a, b) => SLOT_ORDER[a.position] - SLOT_ORDER[b.position]);

        setStats(playerStatsArray);
      } catch (error) {
        console.error('Error calculating OL stats:', error);
      }

      setLoading(false);
    }

    fetchOLStats();
  }, [teamId, gameId, supabase]);

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
