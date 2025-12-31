/**
 * Opponent Scouting Report
 *
 * Comprehensive opponent analysis including:
 * - Defensive tendencies (coverage, blitz patterns)
 * - Offensive tendencies (run/pass splits, formations)
 * - Special teams tendencies (kicking, returning, scoring)
 *
 * Requires selecting an opponent to display data.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import {
  getOpponentTendencies,
  getOpponentOffensiveTendencies,
  getOpponentSpecialTeamsTendencies,
} from '@/lib/services/opponent-analytics.service';
import OpponentTendencies from '@/components/game-plan/OpponentTendencies';
import OpponentOffensiveTendencies from '@/components/game-plan/OpponentOffensiveTendencies';
import OpponentSpecialTeamsTendencies from '@/components/game-plan/OpponentSpecialTeamsTendencies';
import type {
  OpponentProfile,
  OpponentOffensiveProfile,
  OpponentSpecialTeamsProfile,
} from '@/types/football';
import { AlertCircle, Eye, ChevronDown } from 'lucide-react';

interface OpponentOption {
  name: string;
  gameCount: number;
  isScoutingFilm: boolean;
}

export default function OpponentScoutingReport({ teamId, filters }: ReportProps) {
  const supabase = createClient();

  // State
  const [opponents, setOpponents] = useState<OpponentOption[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string>(filters.opponent || '');
  const [loading, setLoading] = useState(true);
  const [loadingTendencies, setLoadingTendencies] = useState(false);

  // Tendencies data
  const [defensiveTendencies, setDefensiveTendencies] = useState<OpponentProfile | null>(null);
  const [offensiveTendencies, setOffensiveTendencies] = useState<OpponentOffensiveProfile | null>(null);
  const [specialTeamsTendencies, setSpecialTeamsTendencies] = useState<OpponentSpecialTeamsProfile | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'defensive' | 'offensive' | 'special-teams'>('defensive');

  // Fetch available opponents from games
  useEffect(() => {
    async function loadOpponents() {
      setLoading(true);

      // Get all games for this team
      const { data: games, error } = await supabase
        .from('games')
        .select('opponent, opponent_team_name, is_opponent_game')
        .eq('team_id', teamId);

      if (error) {
        console.error('Error fetching games:', error);
        setLoading(false);
        return;
      }

      // Build unique opponent list with game counts
      const opponentMap = new Map<string, OpponentOption>();

      for (const game of games || []) {
        // For opponent scouting games, use opponent_team_name
        // For regular games, use opponent
        const opponentName = game.is_opponent_game
          ? game.opponent_team_name || game.opponent
          : game.opponent;

        if (!opponentName) continue;

        const existing = opponentMap.get(opponentName);
        if (existing) {
          existing.gameCount++;
          if (game.is_opponent_game) existing.isScoutingFilm = true;
        } else {
          opponentMap.set(opponentName, {
            name: opponentName,
            gameCount: 1,
            isScoutingFilm: !!game.is_opponent_game,
          });
        }
      }

      // Sort by game count (most film first)
      const sortedOpponents = Array.from(opponentMap.values()).sort(
        (a, b) => b.gameCount - a.gameCount
      );

      setOpponents(sortedOpponents);
      setLoading(false);

      // Auto-select first opponent if none selected
      if (!selectedOpponent && sortedOpponents.length > 0) {
        setSelectedOpponent(sortedOpponents[0].name);
      }
    }

    loadOpponents();
  }, [teamId]);

  // Load tendencies when opponent changes
  useEffect(() => {
    async function loadTendencies() {
      if (!selectedOpponent) return;

      setLoadingTendencies(true);

      try {
        // Fetch all tendencies in parallel
        const [defensive, offensive, specialTeams] = await Promise.all([
          getOpponentTendencies(teamId, selectedOpponent),
          getOpponentOffensiveTendencies(teamId, selectedOpponent),
          getOpponentSpecialTeamsTendencies(teamId, selectedOpponent),
        ]);

        setDefensiveTendencies(defensive);
        setOffensiveTendencies(offensive);
        setSpecialTeamsTendencies(specialTeams);
      } catch (error) {
        console.error('Error loading tendencies:', error);
      } finally {
        setLoadingTendencies(false);
      }
    }

    loadTendencies();
  }, [teamId, selectedOpponent]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading opponents...</div>
      </div>
    );
  }

  if (opponents.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <Eye className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Opponents Found</h3>
        <p className="text-gray-600 mb-4">
          Upload opponent scouting film to see their tendencies here.
        </p>
        <p className="text-sm text-gray-500">
          Go to Film → Add Opponent Game to upload scouting film.
        </p>
      </div>
    );
  }

  const hasAnyData =
    (defensiveTendencies?.totalPlaysAnalyzed ?? 0) > 0 ||
    (offensiveTendencies?.totalPlaysAnalyzed ?? 0) > 0 ||
    (specialTeamsTendencies?.totalPlaysAnalyzed ?? 0) > 0;

  return (
    <div>
      {/* Opponent Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Opponent
        </label>
        <div className="relative">
          <select
            value={selectedOpponent}
            onChange={(e) => setSelectedOpponent(e.target.value)}
            className="w-full md:w-64 px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 appearance-none cursor-pointer"
          >
            {opponents.map((opponent) => (
              <option key={opponent.name} value={opponent.name}>
                {opponent.name} ({opponent.gameCount} game{opponent.gameCount !== 1 ? 's' : ''})
                {opponent.isScoutingFilm ? ' - Scouting Film' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Loading State */}
      {loadingTendencies && (
        <div className="text-center py-12">
          <div className="text-gray-600">Loading {selectedOpponent} tendencies...</div>
        </div>
      )}

      {/* No Data State */}
      {!loadingTendencies && !hasAnyData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">No Tagged Plays Found</h3>
              <p className="text-sm text-amber-700 mt-1">
                Tag opponent plays in the Film section (with &quot;Opponent Play&quot; checked) to see tendencies for {selectedOpponent}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tendencies Content */}
      {!loadingTendencies && hasAnyData && (
        <>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('defensive')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'defensive'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Defensive Tendencies
              {defensiveTendencies && defensiveTendencies.totalPlaysAnalyzed > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {defensiveTendencies.totalPlaysAnalyzed}
                </span>
              )}
              {activeTab === 'defensive' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('offensive')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'offensive'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Offensive Tendencies
              {offensiveTendencies && offensiveTendencies.totalPlaysAnalyzed > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {offensiveTendencies.totalPlaysAnalyzed}
                </span>
              )}
              {activeTab === 'offensive' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('special-teams')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'special-teams'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Special Teams
              {specialTeamsTendencies && specialTeamsTendencies.totalPlaysAnalyzed > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {specialTeamsTendencies.totalPlaysAnalyzed}
                </span>
              )}
              {activeTab === 'special-teams' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'defensive' && defensiveTendencies && (
              <OpponentTendencies
                opponentProfile={defensiveTendencies}
                opponentName={selectedOpponent}
              />
            )}

            {activeTab === 'offensive' && offensiveTendencies && (
              <OpponentOffensiveTendencies
                opponentProfile={offensiveTendencies}
                opponentName={selectedOpponent}
              />
            )}

            {activeTab === 'special-teams' && specialTeamsTendencies && (
              <OpponentSpecialTeamsTendencies
                opponentProfile={specialTeamsTendencies}
                opponentName={selectedOpponent}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
