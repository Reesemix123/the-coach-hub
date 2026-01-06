/**
 * All DL Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL defensive linemen.
 * Queries player_participation table for DL-specific actions (Tier 3).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface DLStats {
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

  // Havoc
  tfls: number;
  forcedFumbles: number;
  havocPlays: number;
}

interface AllDLStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllDLStatsSection({ teamId, gameId, currentTier }: AllDLStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<DLStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchDLStats() {
      setLoading(true);

      try {
        // ======================================================================
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_dl_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const dlStatsArray: DLStats[] = rpcData.map((d: any) => ({
            playerId: d.playerId,
            playerName: d.playerName,
            jerseyNumber: d.jerseyNumber || '',
            position: d.position || 'DL',
            primaryTackles: d.primaryTackles || 0,
            assistTackles: d.assistTackles || 0,
            totalTackles: d.totalTackles || 0,
            missedTackles: d.missedTackles || 0,
            pressures: d.pressures || 0,
            sacks: d.sacks || 0,
            tfls: d.tfls || 0,
            forcedFumbles: d.forcedFumbles || 0,
            havocPlays: d.havocPlays || 0,
          }));
          setStats(dlStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for DL stats');

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
          console.error('Error fetching DL stats:', error);
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
        const dlStatsMap = new Map<string, DLStats>();

        filteredData.forEach((record: any) => {
          if (!record.player_id || !record.player) return;

          const player = record.player;
          const position = player.primary_position;

          // Only DL positions
          if (!['DE', 'DT', 'NT'].includes(position)) return;

          const playerId = record.player_id;
          const participationType = record.participation_type;
          const result = record.result;

          let dlStats = dlStatsMap.get(playerId);
          if (!dlStats) {
            dlStats = {
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
              tfls: 0,
              forcedFumbles: 0,
              havocPlays: 0,
            };
            dlStatsMap.set(playerId, dlStats);
          }

          // Count by participation type
          switch (participationType) {
            case 'primary_tackle':
              dlStats.primaryTackles++;
              dlStats.totalTackles++;
              break;
            case 'assist_tackle':
              dlStats.assistTackles++;
              dlStats.totalTackles++;
              break;
            case 'missed_tackle':
              dlStats.missedTackles++;
              break;
            case 'pressure':
              dlStats.pressures++;
              if (result === 'sack') {
                dlStats.sacks++;
              }
              break;
            case 'tackle_for_loss':
              dlStats.tfls++;
              dlStats.havocPlays++;
              break;
            case 'forced_fumble':
              dlStats.forcedFumbles++;
              dlStats.havocPlays++;
              break;
          }
        });

        const dlStatsArray: DLStats[] = Array.from(dlStatsMap.values());

        // Sort by total tackles (most active DL first)
        dlStatsArray.sort((a, b) => b.totalTackles - a.totalTackles);

        setStats(dlStatsArray);
      } catch (error) {
        console.error('Error calculating DL stats:', error);
      }

      setLoading(false);
    }

    fetchDLStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Defensive Line Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading DL stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Defensive Line Stats
          <TierRequirementBadge section="dl_stats" />
        </div>
        <TierUpgradeMessage section="dl_stats" currentTier={currentTier} />
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
          Defensive Line Stats
          <TierRequirementBadge section="dl_stats" />
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
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TFLs</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">FF</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Havoc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((dl) => (
                    <tr key={dl.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{dl.jerseyNumber} {dl.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                        {dl.position}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                        {dl.totalTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {dl.primaryTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {dl.assistTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={dl.missedTackles > 0 ? 'text-red-600' : 'text-gray-900'}>
                          {dl.missedTackles}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {dl.pressures}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{dl.sacks}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-red-600 font-semibold">{dl.tfls}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {dl.forcedFumbles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-bold">
                        {dl.havocPlays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            <strong>TFLs:</strong> Tackles for loss.
            <strong> FF:</strong> Forced fumbles.
            <strong> Havoc:</strong> TFLs + forced fumbles (disruptive plays).
            Data from Comprehensive tagging level.
          </p>
        </>
      )}
    </section>
  );
}
