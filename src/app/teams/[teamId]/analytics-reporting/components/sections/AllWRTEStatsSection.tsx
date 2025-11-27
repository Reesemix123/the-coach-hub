/**
 * All WR/TE Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL wide receivers and tight ends.
 * Queries play_instances table for WR/TE-specific stats (Tier 2+).
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
}

export default function AllWRTEStatsSection({ teamId, gameId }: AllWRTEStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<WRTEStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchWRTEStats() {
      setLoading(true);

      try {
        let query = supabase
          .from('play_instances')
          .select(`
            target_id,
            is_complete,
            yards_gained,
            is_touchdown,
            players!target_id (
              id,
              first_name,
              last_name,
              jersey_number,
              primary_position
            )
          `)
          .eq('team_id', teamId)
          .not('target_id', 'is', null);

        if (gameId) {
          query = query.eq('game_id', gameId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching WR/TE stats:', error);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        const wrteStatsMap = new Map<string, WRTEStats>();

        data.forEach((play: any) => {
          if (!play.target_id || !play.players) return;

          const player = play.players;
          const position = player.primary_position;

          // Only WRs and TEs
          if (position !== 'WR' && position !== 'TE') return;

          const playerId = play.target_id;

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

          if (play.is_complete) {
            wrteStats.receptions++;
            wrteStats.recYards += play.yards_gained || 0;

            if (play.is_touchdown) {
              wrteStats.recTDs++;
            }

            if ((play.yards_gained || 0) >= 15) {
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
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Receiver Stats (WR/TE)
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-800 text-lg mb-2">No WR/TE data available</p>
          <p className="text-blue-700 text-sm">
            Receiver stats will appear once you tag plays with WR/TE as targets (Tier 2+ feature).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
      >
        <span>Receiver Stats (WR/TE)</span>
        <span className="text-sm font-normal text-gray-600 bg-blue-100 px-2 py-1 rounded ml-2">Tier 2+</span>
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
            Data from play-by-play film tagging (Tier 2+).
          </p>
        </>
      )}
    </section>
  );
}
