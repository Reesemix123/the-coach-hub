/**
 * Player Report
 *
 * Individual player performance analysis by position group.
 * Requires a player to be selected via the filter.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import StatCard from '@/components/analytics/StatCard';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function PlayerReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    stats: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadPlayer() {
      if (!filters.playerId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', filters.playerId)
        .single();

      setPlayer(playerData);
      setLoading(false);
    }

    loadPlayer();
  }, [filters.playerId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading player report...</div>
      </div>
    );
  }

  if (!filters.playerId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-yellow-800 text-lg mb-2">No player selected</p>
        <p className="text-yellow-700 text-sm">
          Please select a player from the filter above to view their individual report.
        </p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load player data</p>
      </div>
    );
  }

  return (
    <div>
      {/* Player Overview */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Player Overview</span>
          {expandedSections.overview ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.overview && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="h-20 w-20 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                <span className="text-3xl font-bold">
                  {player.jersey_number || '?'}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {player.first_name} {player.last_name}
                </h3>
                <p className="text-lg text-gray-600">{player.primary_position}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Jersey Number</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.jersey_number || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.primary_position || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position Group</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {player.position_group || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Player Statistics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('stats')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Performance Statistics</span>
          {expandedSections.stats ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.stats && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Individual Player Stats Coming Soon
              </h3>
              <p className="text-gray-600 mb-4">
                We're building detailed individual player performance analytics including:
              </p>
              <ul className="text-sm text-gray-600 space-y-2 text-left bg-white rounded-lg p-4">
                <li>• Play-by-play performance tracking</li>
                <li>• Position-specific metrics and grades</li>
                <li>• Game-by-game trends and progressions</li>
                <li>• Comparison to team and league averages</li>
                <li>• Video highlights of key plays</li>
              </ul>
              <p className="text-sm text-gray-500 mt-4">
                For now, you can view this player's stats in the position-specific sections of the
                Offensive or Defensive Reports.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
