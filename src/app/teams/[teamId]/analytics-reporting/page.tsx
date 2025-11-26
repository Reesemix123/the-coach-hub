/**
 * Analytics and Reporting Page
 *
 * Unified reporting system with on-demand report generation.
 * Replaces the old "Analytics" and "Metrics" pages.
 */

'use client';

import { use, useState, useEffect } from 'react';
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

interface AnalyticsReportingPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ type?: string }>;
}

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
  const [games, setGames] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

        // Fetch games
        const { data: gamesData } = await supabase
          .from('games')
          .select('*')
          .eq('team_id', teamId)
          .order('date', { ascending: false });

        setGames(gamesData || []);

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

  // Update URL when report changes
  const handleReportChange = (reportType: ReportType) => {
    setSelectedReport(reportType);
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('type', reportType);
    window.history.pushState({}, '', url);
  };

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

            {/* Report Filters */}
            <ReportFilters
              filters={filters}
              onFiltersChange={setFilters}
              games={games}
              players={players}
              showGameFilter={true}
              showPlayerFilter={currentReportConfig.requiresPlayer}
              showOpponentFilter={false}
              showDateRange={false}
            />

            {/* Report Content */}
            {!validation.valid ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">{validation.message}</p>
              </div>
            ) : (
              <div>
                {/* Render report based on type */}
                {selectedReport === 'season-overview' && (
                  <SeasonOverviewReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'game-report' && (
                  <GameReport
                    teamId={teamId}
                    gameId={filters.gameId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'offensive' && (
                  <OffensiveReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'defensive' && (
                  <DefensiveReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'special-teams' && (
                  <SpecialTeamsReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'player' && (
                  <PlayerReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'situational' && (
                  <SituationalReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}

                {selectedReport === 'drives' && (
                  <DriveAnalysisReport
                    teamId={teamId}
                    filters={filters}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
