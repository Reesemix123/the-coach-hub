/**
 * All DB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL defensive backs.
 * Queries player_participation table for DB-specific actions (Tier 3).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface DBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Tackles
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;

  // Coverage
  coverageSnaps: number;
  interceptions: number;
  pbus: number;

  // Havoc
  forcedFumbles: number;
  havocPlays: number;
}

interface AllDBStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllDBStatsSection({ teamId, gameId, currentTier }: AllDBStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<DBStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchDBStats() {
      setLoading(true);

      try {
        // ======================================================================
        // OPTION 2: Use database function for server-side aggregation
        // This is 10-50x faster than client-side joins
        // ======================================================================
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_db_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const dbStatsArray: DBStats[] = rpcData.map((d: any) => ({
            playerId: d.playerId,
            playerName: d.playerName,
            jerseyNumber: d.jerseyNumber || '',
            position: d.position || 'DB',
            primaryTackles: d.primaryTackles || 0,
            assistTackles: d.assistTackles || 0,
            totalTackles: d.totalTackles || 0,
            missedTackles: d.missedTackles || 0,
            coverageSnaps: d.coverageSnaps || 0,
            interceptions: d.interceptions || 0,
            pbus: d.pbus || 0,
            forcedFumbles: d.forcedFumbles || 0,
            havocPlays: d.havocPlays || 0,
          }));
          setStats(dbStatsArray);
          setLoading(false);
          return;
        }

        // ======================================================================
        // OPTION 1 FALLBACK: Split queries if database function unavailable
        // ======================================================================
        console.log('Falling back to split queries for DB stats');

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
          console.error('Error fetching DB stats:', error);
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

        const dbStatsMap = new Map<string, DBStats>();

        filteredData.forEach((record: any) => {
          if (!record.player_id || !record.player) return;

          const player = record.player;
          const position = player.primary_position;

          // Only DB positions
          if (!['CB', 'S', 'FS', 'SS', 'DB'].includes(position)) return;

          const playerId = record.player_id;
          const participationType = record.participation_type;

          let dbStats = dbStatsMap.get(playerId);
          if (!dbStats) {
            dbStats = {
              playerId,
              playerName: `${player.first_name} ${player.last_name}`,
              jerseyNumber: player.jersey_number || '',
              position: player.primary_position,
              primaryTackles: 0,
              assistTackles: 0,
              totalTackles: 0,
              missedTackles: 0,
              coverageSnaps: 0,
              interceptions: 0,
              pbus: 0,
              forcedFumbles: 0,
              havocPlays: 0,
            };
            dbStatsMap.set(playerId, dbStats);
          }

          switch (participationType) {
            case 'primary_tackle':
              dbStats.primaryTackles++;
              dbStats.totalTackles++;
              break;
            case 'assist_tackle':
              dbStats.assistTackles++;
              dbStats.totalTackles++;
              break;
            case 'missed_tackle':
              dbStats.missedTackles++;
              break;
            case 'coverage_assignment':
              dbStats.coverageSnaps++;
              break;
            case 'interception':
              dbStats.interceptions++;
              dbStats.havocPlays++;
              break;
            case 'pass_breakup':
              dbStats.pbus++;
              dbStats.havocPlays++;
              break;
            case 'forced_fumble':
              dbStats.forcedFumbles++;
              dbStats.havocPlays++;
              break;
          }
        });

        const dbStatsArray: DBStats[] = Array.from(dbStatsMap.values());
        dbStatsArray.sort((a, b) => b.havocPlays - a.havocPlays);

        setStats(dbStatsArray);
      } catch (error) {
        console.error('Error calculating DB stats:', error);
      }

      setLoading(false);
    }

    fetchDBStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Defensive Back Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading DB stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Defensive Back Stats
          <TierRequirementBadge section="db_stats" />
        </div>
        <TierUpgradeMessage section="db_stats" currentTier={currentTier} />
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
          Defensive Back Stats
          <TierRequirementBadge section="db_stats" />
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
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cov Snaps</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">PBU</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">FF</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Havoc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((db) => (
                    <tr key={db.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{db.jerseyNumber} {db.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                        {db.position}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                        {db.totalTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {db.primaryTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {db.assistTackles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={db.missedTackles > 0 ? 'text-red-600' : 'text-gray-900'}>
                          {db.missedTackles}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {db.coverageSnaps}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{db.interceptions}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {db.pbus}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {db.forcedFumbles}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-bold">
                        {db.havocPlays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            <strong>Cov Snaps:</strong> Coverage assignments.
            <strong> PBU:</strong> Pass breakups.
            <strong> FF:</strong> Forced fumbles.
            <strong> Havoc:</strong> INTs + PBUs + FFs.
            Data from Comprehensive tagging level.
          </p>
        </>
      )}
    </section>
  );
}
