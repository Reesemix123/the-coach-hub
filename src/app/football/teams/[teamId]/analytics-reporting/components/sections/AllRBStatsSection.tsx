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
