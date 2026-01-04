/**
 * Situational Report
 *
 * Performance analysis by down, distance, field position, and game context.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import StatCard from '@/components/analytics/StatCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MetricDefinition } from '@/lib/analytics/metricDefinitions';

// ============================================================================
// Situational Metric Definitions (for tooltips)
// ============================================================================
const SITUATIONAL_METRICS: Record<string, MetricDefinition> = {
  // By Down
  firstDown: {
    title: '1st Down Performance',
    description: 'How the offense performs on first down plays',
    useful: 'First down sets the tone. Good 1st down execution creates manageable 2nd/3rd downs. Target 4+ yards and 50%+ success.',
    calculation: 'Success = gain 40% of distance needed (e.g., 4+ yards on 1st & 10)',
  },
  secondDown: {
    title: '2nd Down Performance',
    description: 'How the offense performs on second down plays',
    useful: 'Shows recovery ability after first down. Good 2nd down play prevents 3rd and long. Target 50%+ success.',
    calculation: 'Success = gain 60% of remaining distance needed',
  },
  thirdDown: {
    title: '3rd Down Performance',
    description: 'How the offense performs on third down (conversion situations)',
    useful: 'Critical for sustaining drives. 40%+ conversion rate is strong. Below 30% leads to short drives.',
    calculation: 'Success = convert for first down or touchdown. Conversions shown separately.',
  },
  fourthDown: {
    title: '4th Down Performance',
    description: 'How the offense performs when going for it on fourth down',
    useful: 'High-risk plays. Shows aggressiveness and execution in critical moments. Sample size usually small.',
    calculation: 'Success = convert for first down or touchdown',
  },

  // By Distance
  shortYardage: {
    title: 'Short Yardage (1-3 yards)',
    description: 'Performance when needing 1-3 yards for first down',
    useful: 'Tests physicality and play design. Should convert 70%+ of short yardage. Power running and QB sneaks common.',
    calculation: 'Success = gain the required yards for conversion',
  },
  mediumYardage: {
    title: 'Medium Yardage (4-7 yards)',
    description: 'Performance when needing 4-7 yards for first down',
    useful: 'Most common situation. Balanced run/pass. 50%+ success rate is solid. Shows offensive versatility.',
    calculation: 'Success rate based on down-specific thresholds',
  },
  longYardage: {
    title: 'Long Yardage (8+ yards)',
    description: 'Performance when needing 8+ yards for first down',
    useful: 'Challenging situations, often 3rd and long. 35%+ success is good. Pass-heavy. Avoid these with good early-down play.',
    calculation: 'Success = convert despite long distance needed',
  },

  // By Field Position
  ownTerritory: {
    title: 'Own Territory (0-40 yard line)',
    description: 'Performance when backed up in own territory',
    useful: 'Conservative play calling expected. Avoid turnovers. Steady gains to escape danger zone.',
    calculation: 'Yard line 0-40 from own end zone. Success based on down thresholds.',
  },
  midfield: {
    title: 'Midfield (41-60 yard line)',
    description: 'Performance in the middle of the field',
    useful: 'Open playbook territory. Good for establishing rhythm. Can take calculated risks.',
    calculation: 'Yard line 41-60. Full offensive playbook available.',
  },
  opponentTerritory: {
    title: 'Opponent Territory (61-80 yard line)',
    description: 'Performance inside opponent territory but before red zone',
    useful: 'Scoring range for field goals. Should maintain drives and avoid stalling. Sets up red zone entries.',
    calculation: 'Yard line 61-80. Drives here should result in points.',
  },
  redZone: {
    title: 'Red Zone (81-100 yard line)',
    description: 'Performance inside the opponent\'s 20-yard line',
    useful: 'Must score points when here. TD rate of 60%+ is strong. Field shrinks, precision matters.',
    calculation: 'Yard line 81-100 (inside opponent 20). TD rate = TDs ÷ red zone trips.',
  },
};

interface SituationalStats {
  // By Down
  byDown: {
    firstDown: { plays: number; yards: number; avgYards: number; successRate: number };
    secondDown: { plays: number; yards: number; avgYards: number; successRate: number };
    thirdDown: { plays: number; yards: number; avgYards: number; successRate: number; conversions: number };
    fourthDown: { plays: number; yards: number; avgYards: number; successRate: number };
  };

  // By Distance
  byDistance: {
    short: { plays: number; yards: number; avgYards: number; successRate: number }; // 1-3 yards
    medium: { plays: number; yards: number; avgYards: number; successRate: number }; // 4-7 yards
    long: { plays: number; yards: number; avgYards: number; successRate: number }; // 8+ yards
  };

  // By Field Position
  byFieldPosition: {
    ownTerritory: { plays: number; yards: number; avgYards: number; successRate: number }; // 0-40
    midfield: { plays: number; yards: number; avgYards: number; successRate: number }; // 41-60
    opponentTerritory: { plays: number; yards: number; avgYards: number; successRate: number }; // 61-80
    redZone: { plays: number; yards: number; avgYards: number; successRate: number; touchdowns: number }; // 81-100
  };
}

export default function SituationalReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<SituationalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState({
    byDown: true,
    byDistance: true,
    byFieldPosition: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadSituationalStats() {
      setLoading(true);

      try {
        // Fetch all play instances for this team
        let query = supabase
          .from('play_instances')
          .select('*')
          .eq('team_id', teamId)
          .eq('is_opponent_play', false);

        // Filter by game if specified
        if (filters.gameId || gameId) {
          const { data: videoData } = await supabase
            .from('videos')
            .select('id')
            .eq('game_id', filters.gameId || gameId);

          if (videoData && videoData.length > 0) {
            const videoIds = videoData.map(v => v.id);
            query = query.in('video_id', videoIds);
          }
        }

        const { data: plays, error } = await query;

        if (error || !plays) {
          console.error('Error loading plays:', error);
          setLoading(false);
          return;
        }

        // Calculate success for each play
        const isSuccessful = (play: any) => {
          if (play.resulted_in_first_down) return true;
          if (!play.down || !play.distance || play.yards_gained === null) return false;

          if (play.down === 1) return play.yards_gained >= play.distance * 0.4;
          if (play.down === 2) return play.yards_gained >= play.distance * 0.6;
          if (play.down === 3 || play.down === 4) return play.yards_gained >= play.distance;
          return false;
        };

        // Group by down
        const firstDownPlays = plays.filter(p => p.down === 1);
        const secondDownPlays = plays.filter(p => p.down === 2);
        const thirdDownPlays = plays.filter(p => p.down === 3);
        const fourthDownPlays = plays.filter(p => p.down === 4);

        const byDown = {
          firstDown: {
            plays: firstDownPlays.length,
            yards: firstDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: firstDownPlays.length > 0
              ? firstDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / firstDownPlays.length
              : 0,
            successRate: firstDownPlays.length > 0
              ? (firstDownPlays.filter(isSuccessful).length / firstDownPlays.length) * 100
              : 0
          },
          secondDown: {
            plays: secondDownPlays.length,
            yards: secondDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: secondDownPlays.length > 0
              ? secondDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / secondDownPlays.length
              : 0,
            successRate: secondDownPlays.length > 0
              ? (secondDownPlays.filter(isSuccessful).length / secondDownPlays.length) * 100
              : 0
          },
          thirdDown: {
            plays: thirdDownPlays.length,
            yards: thirdDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: thirdDownPlays.length > 0
              ? thirdDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / thirdDownPlays.length
              : 0,
            successRate: thirdDownPlays.length > 0
              ? (thirdDownPlays.filter(isSuccessful).length / thirdDownPlays.length) * 100
              : 0,
            conversions: thirdDownPlays.filter(p => p.resulted_in_first_down).length
          },
          fourthDown: {
            plays: fourthDownPlays.length,
            yards: fourthDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: fourthDownPlays.length > 0
              ? fourthDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / fourthDownPlays.length
              : 0,
            successRate: fourthDownPlays.length > 0
              ? (fourthDownPlays.filter(isSuccessful).length / fourthDownPlays.length) * 100
              : 0
          }
        };

        // Group by distance
        const shortPlays = plays.filter(p => p.distance && p.distance >= 1 && p.distance <= 3);
        const mediumPlays = plays.filter(p => p.distance && p.distance >= 4 && p.distance <= 7);
        const longPlays = plays.filter(p => p.distance && p.distance >= 8);

        const byDistance = {
          short: {
            plays: shortPlays.length,
            yards: shortPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: shortPlays.length > 0
              ? shortPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / shortPlays.length
              : 0,
            successRate: shortPlays.length > 0
              ? (shortPlays.filter(isSuccessful).length / shortPlays.length) * 100
              : 0
          },
          medium: {
            plays: mediumPlays.length,
            yards: mediumPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: mediumPlays.length > 0
              ? mediumPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / mediumPlays.length
              : 0,
            successRate: mediumPlays.length > 0
              ? (mediumPlays.filter(isSuccessful).length / mediumPlays.length) * 100
              : 0
          },
          long: {
            plays: longPlays.length,
            yards: longPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: longPlays.length > 0
              ? longPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / longPlays.length
              : 0,
            successRate: longPlays.length > 0
              ? (longPlays.filter(isSuccessful).length / longPlays.length) * 100
              : 0
          }
        };

        // Group by field position (yard_line is 0-100)
        const ownTerritoryPlays = plays.filter(p => p.yard_line && p.yard_line >= 0 && p.yard_line <= 40);
        const midfieldPlays = plays.filter(p => p.yard_line && p.yard_line >= 41 && p.yard_line <= 60);
        const opponentTerritoryPlays = plays.filter(p => p.yard_line && p.yard_line >= 61 && p.yard_line <= 80);
        const redZonePlays = plays.filter(p => p.yard_line && p.yard_line >= 81 && p.yard_line <= 100);

        const byFieldPosition = {
          ownTerritory: {
            plays: ownTerritoryPlays.length,
            yards: ownTerritoryPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: ownTerritoryPlays.length > 0
              ? ownTerritoryPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / ownTerritoryPlays.length
              : 0,
            successRate: ownTerritoryPlays.length > 0
              ? (ownTerritoryPlays.filter(isSuccessful).length / ownTerritoryPlays.length) * 100
              : 0
          },
          midfield: {
            plays: midfieldPlays.length,
            yards: midfieldPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: midfieldPlays.length > 0
              ? midfieldPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / midfieldPlays.length
              : 0,
            successRate: midfieldPlays.length > 0
              ? (midfieldPlays.filter(isSuccessful).length / midfieldPlays.length) * 100
              : 0
          },
          opponentTerritory: {
            plays: opponentTerritoryPlays.length,
            yards: opponentTerritoryPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: opponentTerritoryPlays.length > 0
              ? opponentTerritoryPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / opponentTerritoryPlays.length
              : 0,
            successRate: opponentTerritoryPlays.length > 0
              ? (opponentTerritoryPlays.filter(isSuccessful).length / opponentTerritoryPlays.length) * 100
              : 0
          },
          redZone: {
            plays: redZonePlays.length,
            yards: redZonePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
            avgYards: redZonePlays.length > 0
              ? redZonePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / redZonePlays.length
              : 0,
            successRate: redZonePlays.length > 0
              ? (redZonePlays.filter(isSuccessful).length / redZonePlays.length) * 100
              : 0,
            touchdowns: redZonePlays.filter(p =>
              p.result?.includes('touchdown') || (p.yard_line && p.yard_line >= 100)
            ).length
          }
        };

        setStats({ byDown, byDistance, byFieldPosition });
      } catch (error) {
        console.error('Error calculating situational stats:', error);
      }

      setLoading(false);
    }

    loadSituationalStats();
  }, [teamId, gameId, filters.gameId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading situational analysis...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load situational data</p>
      </div>
    );
  }

  const hasData = stats.byDown.firstDown.plays > 0 ||
                  stats.byDown.secondDown.plays > 0 ||
                  stats.byDown.thirdDown.plays > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Analyze performance by down, distance, and field position
        </p>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
          <p className="text-gray-600 text-lg mb-2">No data available yet</p>
          <p className="text-gray-500 text-sm">
            Situational stats will appear once you tag plays in your games.
          </p>
        </div>
      )}

      {/* Performance by Down */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('byDown')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Performance by Down</span>
          {expandedSections.byDown ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.byDown && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="1st Down"
              value={`${stats.byDown.firstDown.plays} plays`}
              subtitle={`${stats.byDown.firstDown.avgYards.toFixed(1)} avg yards • ${stats.byDown.firstDown.successRate.toFixed(1)}% success`}
              color={stats.byDown.firstDown.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.firstDown}
            />
            <StatCard
              label="2nd Down"
              value={`${stats.byDown.secondDown.plays} plays`}
              subtitle={`${stats.byDown.secondDown.avgYards.toFixed(1)} avg yards • ${stats.byDown.secondDown.successRate.toFixed(1)}% success`}
              color={stats.byDown.secondDown.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.secondDown}
            />
            <StatCard
              label="3rd Down"
              value={`${stats.byDown.thirdDown.plays} plays`}
              subtitle={`${stats.byDown.thirdDown.conversions} conversions • ${stats.byDown.thirdDown.successRate.toFixed(1)}% success`}
              color={stats.byDown.thirdDown.successRate >= 40 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.thirdDown}
            />
            <StatCard
              label="4th Down"
              value={`${stats.byDown.fourthDown.plays} plays`}
              subtitle={`${stats.byDown.fourthDown.avgYards.toFixed(1)} avg yards • ${stats.byDown.fourthDown.successRate.toFixed(1)}% success`}
              color={stats.byDown.fourthDown.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.fourthDown}
            />
          </div>
        )}
      </section>

      {/* Performance by Distance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('byDistance')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Performance by Distance</span>
          {expandedSections.byDistance ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.byDistance && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Short (1-3 yards)"
              value={`${stats.byDistance.short.plays} plays`}
              subtitle={`${stats.byDistance.short.avgYards.toFixed(1)} avg yards • ${stats.byDistance.short.successRate.toFixed(1)}% success`}
              color={stats.byDistance.short.successRate >= 60 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.shortYardage}
            />
            <StatCard
              label="Medium (4-7 yards)"
              value={`${stats.byDistance.medium.plays} plays`}
              subtitle={`${stats.byDistance.medium.avgYards.toFixed(1)} avg yards • ${stats.byDistance.medium.successRate.toFixed(1)}% success`}
              color={stats.byDistance.medium.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.mediumYardage}
            />
            <StatCard
              label="Long (8+ yards)"
              value={`${stats.byDistance.long.plays} plays`}
              subtitle={`${stats.byDistance.long.avgYards.toFixed(1)} avg yards • ${stats.byDistance.long.successRate.toFixed(1)}% success`}
              color={stats.byDistance.long.successRate >= 40 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.longYardage}
            />
          </div>
        )}
      </section>

      {/* Performance by Field Position */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('byFieldPosition')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Performance by Field Position</span>
          {expandedSections.byFieldPosition ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.byFieldPosition && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Own Territory (0-40)"
              value={`${stats.byFieldPosition.ownTerritory.plays} plays`}
              subtitle={`${stats.byFieldPosition.ownTerritory.avgYards.toFixed(1)} avg yards • ${stats.byFieldPosition.ownTerritory.successRate.toFixed(1)}% success`}
              color={stats.byFieldPosition.ownTerritory.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.ownTerritory}
            />
            <StatCard
              label="Midfield (41-60)"
              value={`${stats.byFieldPosition.midfield.plays} plays`}
              subtitle={`${stats.byFieldPosition.midfield.avgYards.toFixed(1)} avg yards • ${stats.byFieldPosition.midfield.successRate.toFixed(1)}% success`}
              color={stats.byFieldPosition.midfield.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.midfield}
            />
            <StatCard
              label="Opponent Territory (61-80)"
              value={`${stats.byFieldPosition.opponentTerritory.plays} plays`}
              subtitle={`${stats.byFieldPosition.opponentTerritory.avgYards.toFixed(1)} avg yards • ${stats.byFieldPosition.opponentTerritory.successRate.toFixed(1)}% success`}
              color={stats.byFieldPosition.opponentTerritory.successRate >= 50 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.opponentTerritory}
            />
            <StatCard
              label="Red Zone (81-100)"
              value={`${stats.byFieldPosition.redZone.plays} plays`}
              subtitle={`${stats.byFieldPosition.redZone.touchdowns} TDs • ${stats.byFieldPosition.redZone.successRate.toFixed(1)}% success`}
              color={stats.byFieldPosition.redZone.successRate >= 60 ? 'green' : 'default'}
              tooltip={SITUATIONAL_METRICS.redZone}
            />
          </div>
        )}
      </section>
    </div>
  );
}
