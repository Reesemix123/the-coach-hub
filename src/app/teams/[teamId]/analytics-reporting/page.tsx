/**
 * Analytics and Reporting Page
 *
 * Unified reporting system with on-demand report generation.
 * Replaces the old "Analytics" and "Metrics" pages.
 *
 * Features:
 * - Report-level caching to avoid refetching when switching between reports
 * - Win/loss record displayed in navigation
 */

'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getReportConfig, getDefaultReport, canDisplayReport } from '@/config/reportRegistry';
import { ReportType, ReportFilters as ReportFiltersType } from '@/types/reports';
import TeamNavigation from '@/components/TeamNavigation';
import ReportSelector from './components/ReportSelector';
import ReportFilters from './components/ReportFilters';
import ReportActions from './components/ReportActions';
import PlaceholderReport from './components/reports/PlaceholderReport';
import SeasonOverviewReport from './components/reports/SeasonOverviewReport';
import OffensiveReport from './components/reports/OffensiveReport';
import DefensiveReport from './components/reports/DefensiveReport';
import SpecialTeamsReport from './components/reports/SpecialTeamsReport';
import PlayerReport from './components/reports/PlayerReport';
import SituationalReport from './components/reports/SituationalReport';
import DriveAnalysisReport from './components/reports/DriveAnalysisReport';
import GameReport from './components/reports/GameReport';
import OpponentScoutingReport from './components/reports/OpponentScoutingReport';
import { UpgradeBanner, FeatureGate } from '@/components/FeatureGate';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface AnalyticsReportingPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ type?: string }>;
}

// Cache for report data - persists across report switches within the same page session
interface ReportCache {
  [reportType: string]: {
    data: any;
    timestamp: number;
    filterHash: string;
  };
}

// Cache TTL: 5 minutes (data stays fresh for typical coaching session)
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function AnalyticsReportingPage({
  params,
  searchParams,
}: AnalyticsReportingPageProps) {
  const { teamId } = use(params);
  const { type } = use(searchParams);

  const supabase = createClient();

  // State
  const [selectedReport, setSelectedReport] = useState<ReportType>(
    (type as ReportType) || getDefaultReport().id
  );
  const [filters, setFilters] = useState<ReportFiltersType>({});
  const [team, setTeam] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]); // All games
  const [teamGames, setTeamGames] = useState<any[]>([]); // Only team games (not scouting)
  const [scoutingGames, setScoutingGames] = useState<any[]>([]); // Only opponent scouting games
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Report cache state - stores fetched report data
  const [reportCache, setReportCache] = useState<ReportCache>({});

  // Feature access for subscription-based gating
  const {
    features,
    showUpgradePrompt,
    showPaymentWarning,
    loading: featureAccessLoading
  } = useFeatureAccess(teamId);

  // Track which reports have been visited (for showing cached versions)
  const [visitedReports, setVisitedReports] = useState<Set<string>>(new Set());

  // Calculate win/loss record from team games only (not scouting games)
  const record = useMemo(() => {
    return teamGames.reduce(
      (acc, game) => {
        if (game.game_result === 'win') acc.wins++;
        else if (game.game_result === 'loss') acc.losses++;
        else if (game.game_result === 'tie') acc.ties++;
        return acc;
      },
      { wins: 0, losses: 0, ties: 0 }
    );
  }, [teamGames]);

  // Generate a hash of current filters for cache invalidation
  const filterHash = useMemo(() => {
    return JSON.stringify(filters);
  }, [filters]);

  // Check if cached data is still valid
  const isCacheValid = useCallback((reportType: string): boolean => {
    const cached = reportCache[reportType];
    if (!cached) return false;

    const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
    const filtersChanged = cached.filterHash !== filterHash;

    return !isExpired && !filtersChanged;
  }, [reportCache, filterHash]);

  // Update cache for a report
  const updateCache = useCallback((reportType: string, data: any) => {
    setReportCache(prev => ({
      ...prev,
      [reportType]: {
        data,
        timestamp: Date.now(),
        filterHash,
      }
    }));
  }, [filterHash]);

  // Clear cache (useful for manual refresh)
  const clearCache = useCallback(() => {
    setReportCache({});
  }, []);

  // Fetch team data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch team
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single();

        setTeam(teamData);

        // Fetch games (including game_result for win/loss record)
        const { data: gamesData } = await supabase
          .from('games')
          .select('*')
          .eq('team_id', teamId)
          .order('date', { ascending: false });

        const allGames = gamesData || [];
        setGames(allGames);

        // Separate team games from opponent scouting games
        const regularGames = allGames.filter(g => !g.is_opponent_game);
        const opponentScoutGames = allGames.filter(g => g.is_opponent_game === true);
        setTeamGames(regularGames);
        setScoutingGames(opponentScoutGames);

        // Fetch players (for player reports)
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('jersey_number', { ascending: true });

        setPlayers(playersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  // Update URL when report changes and track visited reports
  const handleReportChange = (reportType: ReportType) => {
    setSelectedReport(reportType);

    // Track this report as visited (for caching)
    setVisitedReports(prev => new Set(prev).add(reportType));

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('type', reportType);
    window.history.pushState({}, '', url);
  };

  // Track initial report as visited on mount
  useEffect(() => {
    setVisitedReports(prev => new Set(prev).add(selectedReport));
  }, []);

  // Get current report config
  const currentReportConfig = getReportConfig(selectedReport);
  if (!currentReportConfig) {
    return <div>Report not found</div>;
  }

  // Check if report can be displayed
  const validation = canDisplayReport(currentReportConfig, filters);

  // Loading state
  if (loading || !team) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TeamNavigation
          team={{ id: teamId, name: 'Loading...', level: '' }}
          teamId={teamId}
          currentPage="analytics-reporting"
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="analytics-reporting"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Main Content */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Sidebar - Report Selector */}
        <ReportSelector
          selectedReport={selectedReport}
          onSelectReport={handleReportChange}
        />

        {/* Main Report Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-8 py-8">
            {/* Report Actions */}
            <ReportActions reportName={currentReportConfig.name} />

            {/* Upgrade Banner for users without active subscription */}
            <UpgradeBanner teamId={teamId} />

            {/* Report Filters - Hide for opponent-scouting since it has its own selector */}
            {selectedReport !== 'opponent-scouting' && (
              <ReportFilters
                filters={filters}
                onFiltersChange={setFilters}
                games={teamGames}
                players={players}
                showGameFilter={true}
                showPlayerFilter={currentReportConfig.requiresPlayer}
                showOpponentFilter={false}
                showDateRange={false}
                requiresGameSelection={currentReportConfig.requiresGame}
              />
            )}

            {/* Report Content */}
            {!validation.valid ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">{validation.message}</p>
              </div>
            ) : (
              <div>
                {/*
                 * Report Caching Strategy:
                 * Reports are kept mounted but hidden (display: none) after first visit.
                 * This preserves their internal state and fetched data, avoiding
                 * refetch when switching between reports.
                 *
                 * Benefits:
                 * - Instant report switching after initial load
                 * - No data loss when comparing reports
                 * - Reduced API calls during coaching sessions
                 *
                 * Trade-off:
                 * - Slightly higher memory usage (acceptable for typical report count)
                 * - Data may be up to 5 minutes stale (acceptable for analytics use case)
                 */}

                {/* Season Overview Report */}
                <div style={{ display: selectedReport === 'season-overview' ? 'block' : 'none' }}>
                  {(selectedReport === 'season-overview' || visitedReports.has('season-overview')) && (
                    <SeasonOverviewReport
                      teamId={teamId}
                      filters={filters}
                    />
                  )}
                </div>

                {/* Game Report */}
                <div style={{ display: selectedReport === 'game-report' ? 'block' : 'none' }}>
                  {(selectedReport === 'game-report' || visitedReports.has('game-report')) && (
                    <GameReport
                      teamId={teamId}
                      gameId={filters.gameId}
                      filters={filters}
                    />
                  )}
                </div>

                {/* Offensive Report */}
                <div style={{ display: selectedReport === 'offensive' ? 'block' : 'none' }}>
                  {(selectedReport === 'offensive' || visitedReports.has('offensive')) && (
                    <OffensiveReport
                      teamId={teamId}
                      filters={filters}
                    />
                  )}
                </div>

                {/* Defensive Report */}
                <div style={{ display: selectedReport === 'defensive' ? 'block' : 'none' }}>
                  {(selectedReport === 'defensive' || visitedReports.has('defensive')) && (
                    <DefensiveReport
                      teamId={teamId}
                      filters={filters}
                    />
                  )}
                </div>

                {/* Special Teams Report */}
                <div style={{ display: selectedReport === 'special-teams' ? 'block' : 'none' }}>
                  {(selectedReport === 'special-teams' || visitedReports.has('special-teams')) && (
                    <SpecialTeamsReport
                      teamId={teamId}
                      filters={filters}
                    />
                  )}
                </div>

                {/* Player Report - Requires plus or higher */}
                <div style={{ display: selectedReport === 'player' ? 'block' : 'none' }}>
                  {(selectedReport === 'player' || visitedReports.has('player')) && (
                    <FeatureGate teamId={teamId} feature="player_stats">
                      <PlayerReport
                        teamId={teamId}
                        filters={filters}
                      />
                    </FeatureGate>
                  )}
                </div>

                {/* Situational Report - Requires plus or higher */}
                <div style={{ display: selectedReport === 'situational' ? 'block' : 'none' }}>
                  {(selectedReport === 'situational' || visitedReports.has('situational')) && (
                    <FeatureGate teamId={teamId} feature="situational_analysis">
                      <SituationalReport
                        teamId={teamId}
                        filters={filters}
                      />
                    </FeatureGate>
                  )}
                </div>

                {/* Drive Analysis Report - Requires plus or higher */}
                <div style={{ display: selectedReport === 'drives' ? 'block' : 'none' }}>
                  {(selectedReport === 'drives' || visitedReports.has('drives')) && (
                    <FeatureGate teamId={teamId} feature="drive_analytics">
                      <DriveAnalysisReport
                        teamId={teamId}
                        filters={filters}
                      />
                    </FeatureGate>
                  )}
                </div>

                {/* Opponent Scouting Report */}
                <div style={{ display: selectedReport === 'opponent-scouting' ? 'block' : 'none' }}>
                  {(selectedReport === 'opponent-scouting' || visitedReports.has('opponent-scouting')) && (
                    <OpponentScoutingReport
                      teamId={teamId}
                      filters={filters}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
