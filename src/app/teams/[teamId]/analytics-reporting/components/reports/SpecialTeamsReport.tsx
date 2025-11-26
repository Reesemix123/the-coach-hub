/**
 * Special Teams Report
 *
 * Special teams performance metrics and analysis including:
 * - Kickoff performance
 * - Punt performance
 * - Return performance
 * - Field goal and PAT performance
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SpecialTeamsReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    kickoff: true,
    punt: true,
    returns: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);

      // Get comprehensive metrics for special teams display
      const { data: metricsData, error: metricsError } = await supabase.rpc('calculate_team_metrics', {
        p_team_id: teamId,
        p_game_id: filters.gameId || gameId || null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_opponent: filters.opponent || null,
      });

      if (metricsError) {
        console.error('Error loading metrics:', metricsError);
        setLoading(false);
        return;
      }

      setMetrics(metricsData as ComprehensiveTeamMetrics);
      setLoading(false);
    }

    loadMetrics();
  }, [teamId, gameId, filters]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading special teams report...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load special teams data</p>
      </div>
    );
  }

  const gamesPlayed = metrics.filters.gamesPlayed || 0;
  const hasData = gamesPlayed > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          {gamesPlayed === 0 ? 'No games played' : `${gamesPlayed} game${gamesPlayed > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
          <p className="text-gray-600 text-lg mb-2">No data available yet</p>
          <p className="text-gray-500 text-sm">
            Special teams stats will appear once you tag plays in your games.
          </p>
        </div>
      )}

      {/* Kickoff Performance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('kickoff')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Kickoff Performance</span>
          {expandedSections.kickoff ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.kickoff && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total Kickoffs"
              value={metrics.specialTeams.kickoff.kickoffs.toString()}
              subtitle="Total kickoffs"
              tooltip={METRIC_DEFINITIONS.kickoffs}
            />
            <StatCard
              title="Touchbacks"
              value={metrics.specialTeams.kickoff.touchbacks.toString()}
              subtitle={`${(metrics.specialTeams.kickoff.touchbackRate || 0).toFixed(1)}% touchback rate`}
              tooltip={METRIC_DEFINITIONS.touchbacks}
            />
            <StatCard
              title="Avg Starting Field Position"
              value={`${(metrics.specialTeams.kickoff.averageKickoffYardLine || 0).toFixed(1)}`}
              subtitle="Average starting yard line"
              tooltip={METRIC_DEFINITIONS.averageKickoffYardLine}
            />
          </div>
        )}
      </section>

      {/* Punt Performance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('punt')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Punt Performance</span>
          {expandedSections.punt ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.punt && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total Punts"
              value={metrics.specialTeams.punt.punts.toString()}
              subtitle="Total punts"
              tooltip={METRIC_DEFINITIONS.punts}
            />
            <StatCard
              title="Average Punt Yards"
              value={`${(metrics.specialTeams.punt.averagePuntYards || 0).toFixed(1)}`}
              subtitle="Average yards per punt"
              tooltip={METRIC_DEFINITIONS.averagePuntYards}
            />
            <StatCard
              title="Net Punt Average"
              value={`${(metrics.specialTeams.punt.netPuntAverage || 0).toFixed(1)}`}
              subtitle="Net yards after returns"
              tooltip={METRIC_DEFINITIONS.netPuntAverage}
            />
          </div>
        )}
      </section>

      {/* Return Performance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('returns')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Return Performance</span>
          {expandedSections.returns ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.returns && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total Returns"
              value={metrics.specialTeams.returns.returns.toString()}
              subtitle="Kickoff and punt returns"
              tooltip={METRIC_DEFINITIONS.returns}
            />
            <StatCard
              title="Average Return Yards"
              value={`${(metrics.specialTeams.returns.averageReturnYards || 0).toFixed(1)}`}
              subtitle="Average yards per return"
              tooltip={METRIC_DEFINITIONS.averageReturnYards}
            />
            <StatCard
              title="Longest Return"
              value={metrics.specialTeams.returns.longestReturn.toString()}
              subtitle="Longest return yards"
              tooltip={METRIC_DEFINITIONS.longestReturn}
            />
          </div>
        )}
      </section>
    </div>
  );
}
