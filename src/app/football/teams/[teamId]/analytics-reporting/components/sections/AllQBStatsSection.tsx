/**
 * All QB Stats Section - Data Fetching Wrapper
 *
 * Fetches and displays statistics for ALL quarterbacks on the team.
 * Uses database function get_qb_stats() for optimized server-side aggregation.
 * Falls back to split queries if the function is not available.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TierUpgradeMessage, TierRequirementBadge } from '@/components/TierUpgradeMessage';
import type { TaggingTier } from '@/types/football';

interface QBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Passing
  attempts: number;
  completions: number;
  completionPct: number;
  passingYards: number;
  yardsPerAttempt: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  qbRating: number;
}

interface AllQBStatsSectionProps {
  teamId: string;
  gameId?: string | null;
  currentTier?: TaggingTier;
}

export default function AllQBStatsSection({ teamId, gameId, currentTier }: AllQBStatsSectionProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<QBStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchQBStats() {
      setLoading(true);

      try {
        // Server-side aggregation via get_qb_stats (rewritten in migration 190
        // to use position_categories). Phase 1 of the position architecture
        // redesign removed the legacy client-side fallback.
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_qb_stats', {
            p_team_id: teamId,
            p_game_id: gameId || null
          });

        if (rpcError) {
          console.error('get_qb_stats RPC error:', rpcError);
          setStats([]);
          setLoading(false);
          return;
        }

        const rows = Array.isArray(rpcData) ? rpcData : [];
        const qbStatsArray: QBStats[] = rows.map((qb: any) => ({
          playerId: qb.playerId,
          playerName: qb.playerName,
          jerseyNumber: qb.jerseyNumber || '',
          attempts: qb.passAttempts || 0,
          completions: qb.completions || 0,
          completionPct: qb.completionPct || 0,
          passingYards: qb.passingYards || 0,
          yardsPerAttempt: qb.yardsPerAttempt || 0,
          touchdowns: qb.passTDs || 0,
          interceptions: qb.interceptions || 0,
          sacks: qb.sacks || 0,
          qbRating: qb.qbRating || 0,
        }));
        setStats(qbStatsArray);
      } catch (error) {
        console.error('Error calculating QB stats:', error);
      }

      setLoading(false);
    }

    fetchQBStats();
  }, [teamId, gameId]);

  if (loading) {
    return (
      <section className="mb-12">
        <div className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Quarterback Stats
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600">Loading QB stats...</div>
        </div>
      </section>
    );
  }

  if (stats.length === 0) {
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          Quarterback Stats
          <TierRequirementBadge section="qb_stats" />
        </div>
        <TierUpgradeMessage section="qb_stats" currentTier={currentTier} />
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
          Quarterback Stats
          <TierRequirementBadge section="qb_stats" />
        </span>
        {expanded ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <ChevronDown className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <>
          {/* QB Stats Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Comp/Att</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">%</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yards</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPA</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TD</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sacks</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.map((qb) => (
                    <tr key={qb.playerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{qb.jerseyNumber} {qb.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.completions}/{qb.attempts}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.completionPct.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.passingYards}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.yardsPerAttempt.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-green-600 font-semibold">{qb.touchdowns}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className="text-red-600 font-semibold">{qb.interceptions}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.sacks}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        <span className={qb.qbRating >= 90 ? 'text-green-600 font-semibold' : ''}>
                          {qb.qbRating.toFixed(1)}
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
            <strong>Rating:</strong> Passer rating (0-158.3 scale).
            Good: 90+. Data from Standard tagging level.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Calculate simplified QB rating
 */
function calculateQBRating(stats: { attempts: number; completions: number; passingYards: number; touchdowns: number; interceptions: number }): number {
  if (stats.attempts === 0) return 0;

  const a = Math.min(2.375, Math.max(0, (stats.completions / stats.attempts - 0.3) * 5));
  const b = Math.min(2.375, Math.max(0, (stats.passingYards / stats.attempts - 3) * 0.25));
  const c = Math.min(2.375, Math.max(0, (stats.touchdowns / stats.attempts) * 20));
  const d = Math.min(2.375, Math.max(0, 2.375 - (stats.interceptions / stats.attempts * 25)));

  return ((a + b + c + d) / 6) * 100;
}
