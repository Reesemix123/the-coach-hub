'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import PlayCard from './PlayCard';
import type {
  PlaybookPlay,
  PlayMatchScore,
  PlayRelationshipWithDetails,
  SituationalCategoryId,
  PlayTypeCategoryId
} from '@/types/football';
import type { GamePlanSide } from '@/lib/services/game-plan.service';
import {
  SITUATIONAL_CATEGORIES,
  DEFENSIVE_SITUATIONAL_CATEGORIES,
  PLAY_TYPE_SUBCATEGORIES,
  DEFENSIVE_PLAY_TYPE_CATEGORIES,
  inferPlayTypeCategory,
  getSituationalCategories,
  getPlayTypeCategories
} from '@/config/gamePlanCategories';

interface PlaybookBrowserProps {
  plays: PlaybookPlay[];
  gamePlanPlayCodes: Set<string>;
  playMatchScores: Map<string, PlayMatchScore>;
  setupCounterRelationships: PlayRelationshipWithDetails[];
  activeSituation: SituationalCategoryId | null;
  activeSide: GamePlanSide;
  onAddPlay: (playCode: string, situation: SituationalCategoryId, playTypeCategory: PlayTypeCategoryId) => void;
  onSituationSelect: (situation: SituationalCategoryId | null) => void;
}

export default function PlaybookBrowser({
  plays,
  gamePlanPlayCodes,
  playMatchScores,
  setupCounterRelationships,
  activeSituation,
  activeSide,
  onAddPlay,
  onSituationSelect
}: PlaybookBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlayType, setFilterPlayType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'matchScore' | 'name'>('matchScore');

  // Get dynamic categories based on active side
  const situationalCategories = getSituationalCategories(activeSide);
  const playTypeCategories = getPlayTypeCategories(activeSide);

  // Reset play type filter when side changes
  useEffect(() => {
    setFilterPlayType('all');
  }, [activeSide]);

  // Helper to get special teams unit from situation ID
  const getSTUnitFromSituation = (situationId: string | null): string | null => {
    if (!situationId) return null;
    if (situationId.startsWith('st_ko_')) return 'kickoff';
    if (situationId.startsWith('st_kr_')) return 'kick_return';
    if (situationId.startsWith('st_punt_')) return 'punt';
    if (situationId.startsWith('st_pr_')) return 'punt_return';
    if (situationId.startsWith('st_fg_')) return 'field_goal';
    if (situationId.startsWith('st_fgb_')) return 'fg_block';
    if (situationId.startsWith('st_pat_') || situationId.startsWith('st_2pt_')) return 'pat';
    return null;
  };

  // Helper to normalize unit/formation name to a standard slug format
  const normalizeUnit = (value: string | undefined): string | null => {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/\s+/g, '_');
    // Map common variations to standard unit names
    if (normalized === 'kickoff') return 'kickoff';
    if (normalized === 'kick_return') return 'kick_return';
    if (normalized === 'punt') return 'punt';
    if (normalized === 'punt_return') return 'punt_return';
    if (normalized === 'field_goal') return 'field_goal';
    if (normalized === 'fg_block') return 'fg_block';
    if (normalized === 'pat' || normalized === '2pt_conversion' || normalized === 'goal_line') return 'pat';
    return normalized; // Return normalized value for any other cases
  };

  // Get the target ST unit based on selected situation
  const targetSTUnit = activeSide === 'special_teams' ? getSTUnitFromSituation(activeSituation) : null;

  // Create a lookup for counter relationships
  const counterLookup = useMemo(() => {
    const lookup = new Map<string, PlayRelationshipWithDetails[]>();
    for (const rel of setupCounterRelationships) {
      const existing = lookup.get(rel.setup_play_code) || [];
      existing.push(rel);
      lookup.set(rel.setup_play_code, existing);
    }
    return lookup;
  }, [setupCounterRelationships]);

  // Filter plays based on search and filters (plays are already filtered by side from parent)
  const filteredPlays = useMemo(() => {
    return plays.filter(play => {
      // Special teams unit filter - filter by unit when a ST situation is selected
      if (targetSTUnit) {
        // Check explicit unit attribute first, then fall back to formation name
        // Normalize all values to standard slug format for comparison
        const formation = play.attributes?.formation || play.diagram?.formation;
        const playUnit = normalizeUnit(play.attributes?.unit) || normalizeUnit(formation);

        if (!playUnit || playUnit !== targetSTUnit) {
          return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          play.play_code.toLowerCase().includes(search) ||
          play.play_name.toLowerCase().includes(search) ||
          play.attributes?.formation?.toLowerCase().includes(search) ||
          play.attributes?.playType?.toLowerCase().includes(search);

        if (!matchesSearch) return false;
      }

      // Play type filter (use the appropriate infer function based on side)
      if (filterPlayType !== 'all') {
        const inferredType = inferPlayTypeCategory(play.attributes || {});
        if (inferredType !== filterPlayType) {
          return false;
        }
      }

      return true;
    });
  }, [plays, searchTerm, filterPlayType, targetSTUnit]);

  // Sort plays
  const sortedPlays = useMemo(() => {
    return [...filteredPlays].sort((a, b) => {
      if (sortBy === 'matchScore') {
        const scoreA = playMatchScores.get(a.play_code)?.score || 50;
        const scoreB = playMatchScores.get(b.play_code)?.score || 50;
        return scoreB - scoreA;
      }
      if (sortBy === 'name') {
        return a.play_name.localeCompare(b.play_name);
      }
      return a.play_code.localeCompare(b.play_code);
    });
  }, [filteredPlays, sortBy, playMatchScores]);

  const handleAddClick = (play: PlaybookPlay) => {
    if (!activeSituation) {
      alert('Please select a situation first by clicking on one of the situation sections on the right.');
      return;
    }

    const playTypeCategory = inferPlayTypeCategory(play.attributes || {}) as PlayTypeCategoryId;
    onAddPlay(play.play_code, activeSituation, playTypeCategory);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Playbook Browser</h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plays..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Side indicator */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${
            activeSide === 'offense'
              ? 'bg-blue-100 text-blue-700'
              : activeSide === 'defense'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            Showing {activeSide === 'offense' ? 'Offensive' : activeSide === 'defense' ? 'Defensive' : 'Special Teams'} Plays
          </span>
          {targetSTUnit && (
            <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
              {targetSTUnit.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Unit
            </span>
          )}
          <span className="text-xs text-gray-500">
            ({filteredPlays.length} plays)
          </span>
        </div>

        {/* Expanded filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          <span>More Filters</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {/* Play Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Play Type</label>
              <select
                value={filterPlayType}
                onChange={(e) => setFilterPlayType(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                <option value="all">All Types</option>
                {playTypeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'code' | 'matchScore' | 'name')}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                <option value="matchScore">Match Score (Best First)</option>
                <option value="code">Play Code</option>
                <option value="name">Play Name</option>
              </select>
            </div>
          </div>
        )}

        {/* Selected situation indicator */}
        {activeSituation && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              Adding to: <span className="font-medium">{situationalCategories.find(c => c.id === activeSituation)?.label}</span>
            </p>
          </div>
        )}
      </div>

      {/* Play list */}
      <div className="p-3 max-h-[calc(100vh-320px)] overflow-y-auto">
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {sortedPlays.length} of {plays.length} plays
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">70%+</span>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">50-69%</span>
              <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded">&lt;50%</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {activeSituation
              ? `Match % based on ${situationalCategories.find(c => c.id === activeSituation)?.label || 'selected situation'}`
              : 'Select a situation to see situation-specific match scores'}
          </p>
        </div>

        <div className="space-y-2">
          {sortedPlays.map(play => {
            const isInGamePlan = gamePlanPlayCodes.has(play.play_code);
            const matchScore = playMatchScores.get(play.play_code);
            const counters = counterLookup.get(play.play_code) || [];
            const activeSituationLabel = activeSituation
              ? situationalCategories.find(c => c.id === activeSituation)?.label
              : undefined;

            return (
              <PlayCard
                key={play.id}
                play={play}
                matchScore={matchScore}
                counters={counters}
                isInGamePlan={isInGamePlan}
                activeSituationLabel={activeSituationLabel}
                onAdd={() => handleAddClick(play)}
              />
            );
          })}
        </div>

        {sortedPlays.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {activeSide === 'special_teams' && !targetSTUnit ? (
              <div>
                <p className="font-medium text-gray-700 mb-1">Select a situation to see plays</p>
                <p>Click on a situation (Kickoff, Punt, Field Goal, etc.) on the right to filter plays by unit.</p>
              </div>
            ) : activeSide === 'special_teams' && targetSTUnit ? (
              <div>
                <p className="font-medium text-gray-700 mb-1">No {targetSTUnit.replace('_', ' ')} plays in playbook</p>
                <p>Create plays using Playbook → Special Teams with the matching formation.</p>
                <p className="mt-2 text-xs text-gray-400">
                  Available formations: Kickoff, Kick Return, Punt, Punt Return, Field Goal, PAT
                </p>
              </div>
            ) : (
              'No plays match your filters'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
