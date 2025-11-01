/**
 * AnalyticsFilters Component
 *
 * Filter controls for analytics page:
 * - Game filter dropdown (All Games or specific game)
 * - View mode toggle (Cards, List, Print)
 * - Export/Print button
 *
 * @example
 * <AnalyticsFilters
 *   games={games}
 *   selectedGameId={selectedGameId}
 *   onGameChange={setSelectedGameId}
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 * />
 */

'use client';

interface Game {
  id: string;
  name?: string;
  opponent?: string;
  date?: string;
  game_result?: 'win' | 'loss' | 'tie' | null;
}

interface AnalyticsFiltersProps {
  games: Game[];
  selectedGameId: string | 'all';
  onGameChange: (gameId: string | 'all') => void;
  viewMode: 'cards' | 'list' | 'print';
  onViewModeChange: (mode: 'cards' | 'list' | 'print') => void;
}

export default function AnalyticsFilters({
  games,
  selectedGameId,
  onGameChange,
  viewMode,
  onViewModeChange,
}: AnalyticsFiltersProps) {
  const handlePrint = () => {
    // Switch to print view temporarily
    onViewModeChange('print');

    // Wait for render, then print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const formatGameLabel = (game: Game) => {
    const resultEmoji = game.game_result === 'win' ? 'W' : game.game_result === 'loss' ? 'L' : game.game_result === 'tie' ? 'T' : '';
    const dateStr = game.date ? new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `${resultEmoji ? resultEmoji + ' - ' : ''}vs ${game.opponent || game.name} ${dateStr ? '(' + dateStr + ')' : ''}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap no-print">
      {/* Game Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Filter:</label>
        <select
          value={selectedGameId}
          onChange={(e) => onGameChange(e.target.value as string | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 min-w-[200px]"
        >
          <option value="all">All Games ({games.length})</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {formatGameLabel(game)}
            </option>
          ))}
        </select>
      </div>

      {/* View Mode Toggle & Print */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('cards')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-black text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            title="Card View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-black text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            title="List View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Print Button */}
        <button
          onClick={handlePrint}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
      </div>
    </div>
  );
}
