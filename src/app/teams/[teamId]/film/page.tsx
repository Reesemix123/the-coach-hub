// src/app/teams/[teamId]/film/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import TeamNavigation from '@/components/TeamNavigation';
import SelectionBadge from '@/components/SelectionBadge';
import BulkActionBar from '@/components/BulkActionBar';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { bulkDelete, confirmBulkOperation } from '@/utils/bulkOperations';
import { useTokenBalance } from '@/components/TokenBalanceCard';
import { Upload, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface Game {
  id: string;
  name: string;
  date: string;
  opponent: string;
  location?: string;
  team_score?: number | null;
  opponent_score?: number | null;
  game_result?: 'win' | 'loss' | 'tie' | null;
  film_analysis_status?: 'not_started' | 'in_progress' | 'complete' | null;
  is_opponent_game?: boolean;
  opponent_team_name?: string;
  created_at: string;
}

interface Video {
  id: string;
  name: string;
  file_path: string;
  url: string;
  game_id: string;
  created_at: string;
}

interface GameWithVideos extends Game {
  videos: Video[];
}

type ViewMode = 'grid' | 'list';

export default function TeamFilmPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<GameWithVideos[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filmFilter, setFilmFilter] = useState<'all' | 'with-film' | 'no-film'>('all');
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'own-team' | 'opponent'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'opponent' | 'date' | 'uploaded'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showOpponentGameModal, setShowOpponentGameModal] = useState(false);
  const [showOwnTeamGameModal, setShowOwnTeamGameModal] = useState(false);
  const [editingGameResult, setEditingGameResult] = useState<Game | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const router = useRouter();

  // Token balance for game creation gating
  const { balance: tokenBalance, loading: tokenLoading, refetch: refetchTokens } = useTokenBalance(teamId);
  const supabase = createClient();

  // Multi-select for videos
  const {
    selectedIds: selectedVideoIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount,
  } = useMultiSelect<string>();

  // Get all video IDs for select all functionality
  const allVideoIds = games.flatMap(game => game.videos.map(v => v.id));

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSelectAll: () => selectAll(allVideoIds),
    onClearSelection: clearSelection,
    enabled: allVideoIds.length > 0,
  });

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch all games
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      if (gamesError) throw gamesError;
      setAllGames(gamesData || []);

      // Fetch all videos
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .in('game_id', (gamesData || []).map(g => g.id))
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Combine games with their videos
      const gamesWithVideos = (gamesData || []).map(game => ({
        ...game,
        videos: (videosData || []).filter(v => v.game_id === game.id)
      }));

      setGames(gamesWithVideos);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWinLossRecord = () => {
    const wins = allGames.filter(g => g.game_result === 'win').length;
    const losses = allGames.filter(g => g.game_result === 'loss').length;
    const ties = allGames.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  const handleSort = (field: 'opponent' | 'date' | 'uploaded') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getFilteredGames = () => {
    let filtered = games;

    // Apply game type filter (own vs opponent)
    if (gameTypeFilter === 'own-team') {
      filtered = filtered.filter(g => !g.is_opponent_game);
    } else if (gameTypeFilter === 'opponent') {
      filtered = filtered.filter(g => g.is_opponent_game);
    }

    // Apply film presence filter
    if (filmFilter === 'with-film') {
      filtered = filtered.filter(g => g.videos.length > 0);
    } else if (filmFilter === 'no-film') {
      filtered = filtered.filter(g => g.videos.length === 0);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.opponent.toLowerCase().includes(query) ||
        g.name.toLowerCase().includes(query) ||
        g.videos.some(v => v.name.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'opponent') {
        comparison = a.opponent.localeCompare(b.opponent);
      } else if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'uploaded') {
        const aDate = a.videos.length > 0 ? new Date(a.videos[0].created_at).getTime() : 0;
        const bDate = b.videos.length > 0 ? new Date(b.videos[0].created_at).getTime() : 0;
        comparison = aDate - bDate;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Error deleting video');
    }
  };

  // Bulk Operations
  const handleBulkDelete = async () => {
    if (!confirmBulkOperation('delete', selectedCount, 'video')) return;

    const selectedArray = Array.from(selectedVideoIds);
    const result = await bulkDelete('videos', 'id', selectedArray);

    if (result.success) {
      alert(`Successfully deleted ${selectedCount} video${selectedCount === 1 ? '' : 's'}`);
      clearSelection();
      await fetchData();
    } else {
      alert('Error deleting videos: ' + result.error);
    }
  };

  const handleCombineVideos = () => {
    const selectedArray = Array.from(selectedVideoIds);

    if (selectedArray.length < 2) {
      alert('Please select at least 2 videos to combine');
      return;
    }

    // Get video details for the selected videos
    const selectedVideos = games
      .flatMap(game => game.videos)
      .filter(video => selectedArray.includes(video.id));

    // For now, just show which videos would be combined
    const videoNames = selectedVideos.map(v => v.name).join('\n- ');
    alert(`Combine Videos feature:\n\nSelected videos:\n- ${videoNames}\n\nThis will create a virtual video combining these clips in sequence.`);

    // TODO: Open CombineVideosModal
    // setCombineModalOpen(true);
  };

  const handleCreatePlaylist = () => {
    alert('Create Playlist feature coming soon!\n\nThis will allow you to:\n- Group selected videos into a playlist\n- Add descriptions and notes\n- Share with coaching staff');
  };

  const handleCreateOpponentGame = async (formData: any) => {
    // Check token availability first
    if (!tokenBalance || tokenBalance.totalAvailable < 1) {
      setTokenError('No upload tokens available. Purchase additional tokens or wait for your next billing cycle.');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      const cleanData = {
        ...formData,
        start_time: formData.start_time || null,
        is_opponent_game: true, // Force this to be an opponent game
      };

      const { data: gameData, error } = await supabase
        .from('games')
        .insert({
          team_id: teamId,
          user_id: userData.user?.id,
          ...cleanData
        })
        .select('id')
        .single();

      if (error) throw error;

      // Consume a token for this game
      const consumeResponse = await fetch('/api/tokens/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          game_id: gameData.id
        })
      });

      if (!consumeResponse.ok) {
        console.error('Warning: Failed to consume token for game');
        // Don't fail the game creation - token consumption is secondary
      }

      // Refresh the games list and token balance
      await fetchData();
      refetchTokens();

      // Close modal
      setShowOpponentGameModal(false);

      // Switch to opponent filter to show the new game
      setGameTypeFilter('opponent');
    } catch (error) {
      console.error('Error creating opponent game:', error);
      alert('Error creating opponent game');
    }
  };

  const handleCreateOwnTeamGame = async (formData: any) => {
    // Check token availability first
    if (!tokenBalance || tokenBalance.totalAvailable < 1) {
      setTokenError('No upload tokens available. Purchase additional tokens or wait for your next billing cycle.');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      const cleanData = {
        ...formData,
        start_time: formData.start_time || null,
        is_opponent_game: false, // This is an own team game
      };

      const { data: gameData, error } = await supabase
        .from('games')
        .insert({
          team_id: teamId,
          user_id: userData.user?.id,
          ...cleanData
        })
        .select('id')
        .single();

      if (error) throw error;

      // Consume a token for this game
      const consumeResponse = await fetch('/api/tokens/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          game_id: gameData.id
        })
      });

      if (!consumeResponse.ok) {
        console.error('Warning: Failed to consume token for game');
        // Don't fail the game creation - token consumption is secondary
      }

      // Refresh the games list and token balance
      await fetchData();
      refetchTokens();

      // Close modal
      setShowOwnTeamGameModal(false);

      // Stay on own-team filter to show the new game
      setGameTypeFilter('own-team');
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Error creating game');
    }
  };

  const handleUpdateGameResult = async (gameId: string, result: 'win' | 'loss' | 'tie' | null, teamScore: number | null, opponentScore: number | null) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({
          game_result: result,
          team_score: teamScore,
          opponent_score: opponentScore
        })
        .eq('id', gameId);

      if (error) throw error;

      // Refresh the games list
      await fetchData();

      // Close modal
      setEditingGameResult(null);
    } catch (error) {
      console.error('Error updating game result:', error);
      alert('Error updating game result');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading film library...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Team not found</div>
          <button
            onClick={() => router.push('/teams')}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  const record = getWinLossRecord();
  const filteredGames = getFilteredGames();
  const totalVideos = games.reduce((sum, game) => sum + game.videos.length, 0);
  const gamesWithFilm = games.filter(g => g.videos.length > 0).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="film"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Stats Banner */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{totalVideos}</div>
              <div className="text-sm text-gray-600 mt-1">Total Videos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{gamesWithFilm}</div>
              <div className="text-sm text-gray-600 mt-1">Games with Film</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{games.length - gamesWithFilm}</div>
              <div className="text-sm text-gray-600 mt-1">Games without Film</div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Balance Banner */}
      {!tokenLoading && tokenBalance && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div
              className={`rounded-lg px-4 py-3 ${
                tokenBalance.totalAvailable <= 1
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {tokenBalance.totalAvailable <= 1 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  ) : (
                    <Upload className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={tokenBalance.totalAvailable <= 1 ? 'text-amber-800 font-medium' : 'text-gray-700'}>
                      Film Uploads: <span className="font-semibold">{tokenBalance.totalAvailable}</span> remaining
                    </span>
                    {tokenBalance.totalAvailable > 0 && (
                      <span className="text-gray-500">
                        ({Math.floor(tokenBalance.totalAvailable / 2)} team + {Math.floor(tokenBalance.totalAvailable / 2) + (tokenBalance.totalAvailable % 2)} opponent)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {tokenBalance.periodEnd && (
                    <span className="text-gray-500">
                      Resets {new Date(tokenBalance.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <Link
                    href={`/teams/${teamId}/settings/addons`}
                    className="text-gray-600 hover:text-gray-900 flex items-center gap-1 font-medium"
                  >
                    Purchase more
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-3xl font-semibold text-gray-900">Film Library</h2>
          <p className="text-gray-600 mt-1">Game film and video analysis</p>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search games or videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
          />
        </div>

        {/* Filter Tabs and View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setFilmFilter('all')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filmFilter === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Games ({games.length})
              {filmFilter === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setFilmFilter('with-film')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filmFilter === 'with-film' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              With Film ({gamesWithFilm})
              {filmFilter === 'with-film' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setFilmFilter('no-film')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filmFilter === 'no-film' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              No Film ({games.length - gamesWithFilm})
              {filmFilter === 'no-film' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          </div>

          {/* Game Type Filter - Own Team vs Opponent */}
          <div className="flex gap-2">
            <button
              onClick={() => setGameTypeFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameTypeFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setGameTypeFilter('own-team')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameTypeFilter === 'own-team'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {team.name} Film
            </button>
            <button
              onClick={() => setGameTypeFilter('opponent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameTypeFilter === 'opponent'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Opponent Scouting
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              List View
            </button>
          </div>
        </div>

        {/* Games List or Grid */}
        {filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">
              {games.length === 0 ? (
                // No games at all
                'No games scheduled yet'
              ) : gameTypeFilter === 'opponent' && games.filter(g => g.is_opponent_game).length === 0 ? (
                // Has games but none are opponent games
                'No opponent scouting film yet'
              ) : gameTypeFilter === 'own-team' && games.filter(g => !g.is_opponent_game).length === 0 ? (
                // Has games but none are own team games
                'No own team games yet'
              ) : filmFilter === 'with-film' ? (
                'No games with film yet'
              ) : filmFilter === 'no-film' ? (
                'All games have film'
              ) : (
                'No games match your filters'
              )}
            </div>
            <div className="flex gap-3 justify-center">
              {games.length === 0 ? (
                <button
                  onClick={() => router.push(`/teams/${teamId}/schedule`)}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Go to Schedule
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setFilmFilter('all');
                      setGameTypeFilter('all');
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => router.push(`/teams/${teamId}/schedule`)}
                    className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    Add More Games
                  </button>
                </>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
              >
                {/* Game Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          vs {game.opponent}
                        </h3>
                        {game.is_opponent_game && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200">
                            Opponent Scouting{game.opponent_team_name && `: ${game.opponent_team_name}`}
                          </span>
                        )}
                        {game.game_result && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              game.game_result === 'win'
                                ? 'bg-green-100 text-green-700'
                                : game.game_result === 'loss'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {game.game_result.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {game.date && (
                          <span>
                            {new Date(game.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        )}
                        {game.location && <span>{game.location}</span>}
                        {(game.team_score !== null || game.opponent_score !== null) && (
                          <span className="font-semibold text-gray-900">
                            {game.team_score ?? '-'} - {game.opponent_score ?? '-'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {game.videos.length > 0 && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
                          game.film_analysis_status === 'complete'
                            ? 'bg-green-100 text-green-800'
                            : game.film_analysis_status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            game.film_analysis_status === 'complete'
                              ? 'bg-green-500'
                              : game.film_analysis_status === 'in_progress'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                          }`} />
                          {game.film_analysis_status === 'complete'
                            ? 'Complete'
                            : game.film_analysis_status === 'in_progress'
                              ? 'In Progress'
                              : 'Not Started'}
                        </span>
                      )}
                      <button
                        onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                      >
                        {game.videos.length > 0 ? 'View Film' : 'Add Film'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Videos List */}
                <div className="p-6">
                  {game.videos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No film uploaded for this game yet</p>
                      <button
                        onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Upload Film →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {game.videos.map((video) => (
                        <div
                          key={video.id}
                          className={`
                            relative group
                            flex items-center justify-between p-4 rounded-lg transition-all
                            ${isSelected(video.id)
                              ? 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }
                          `}
                        >
                          {/* Selection Badge */}
                          <SelectionBadge
                            isSelected={isSelected(video.id)}
                            onToggle={() => toggleSelect(video.id)}
                            position="top-left"
                          />

                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                              className="text-left w-full"
                            >
                              <h4 className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline transition-colors">
                                {video.name}
                              </h4>
                            </button>
                            <p className="text-xs text-gray-500 mt-1">
                              Added {new Date(video.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                              className="px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(video.id)}
                              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('opponent')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                    >
                      Game
                      {sortField === 'opponent' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Video Name
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                    >
                      Date
                      {sortField === 'date' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('uploaded')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                    >
                      Uploaded
                      {sortField === 'uploaded' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tagging Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Add Own Team Game Row - only show when viewing own team */}
                {gameTypeFilter === 'own-team' && (
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>
                      {tokenBalance && tokenBalance.totalAvailable < 1 ? (
                        <span className="text-amber-700">
                          No tokens available.{' '}
                          <Link href={`/teams/${teamId}/settings/addons`} className="underline hover:no-underline">
                            Purchase more
                          </Link>{' '}
                          to add games.
                        </span>
                      ) : (
                        `Add a new game to upload ${team.name} film`
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => setShowOwnTeamGameModal(true)}
                        disabled={!tokenBalance || tokenBalance.totalAvailable < 1}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add Game
                      </button>
                    </td>
                  </tr>
                )}

                {/* Add Opponent Game Row - only show when viewing opponent scouting */}
                {gameTypeFilter === 'opponent' && (
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>
                      {tokenBalance && tokenBalance.totalAvailable < 1 ? (
                        <span className="text-amber-700">
                          No tokens available.{' '}
                          <Link href={`/teams/${teamId}/settings/addons`} className="underline hover:no-underline">
                            Purchase more
                          </Link>{' '}
                          to add games.
                        </span>
                      ) : (
                        'Add a new opponent game to upload scouting film'
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => setShowOpponentGameModal(true)}
                        disabled={!tokenBalance || tokenBalance.totalAvailable < 1}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add Game
                      </button>
                    </td>
                  </tr>
                )}

                {filteredGames.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">vs {game.opponent}</span>
                        {game.is_opponent_game && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200">
                            Scouting
                          </span>
                        )}
                        {game.game_result && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              game.game_result === 'win'
                                ? 'bg-green-100 text-green-700'
                                : game.game_result === 'loss'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {game.game_result.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {game.videos.length > 0 ? (
                        <div>
                          <button
                            onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                            className="hover:text-blue-600 hover:underline transition-colors text-left font-medium"
                          >
                            {game.videos[0].name}
                          </button>
                          {game.videos.length > 1 && (
                            <span className="ml-2 text-xs text-gray-500">
                              +{game.videos.length - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">No film</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {game.date && new Date(game.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {game.videos.length > 0 ? (
                        new Date(game.videos[0].created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {game.videos.length > 0 ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          game.film_analysis_status === 'complete'
                            ? 'bg-green-100 text-green-800'
                            : game.film_analysis_status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            game.film_analysis_status === 'complete'
                              ? 'bg-green-500'
                              : game.film_analysis_status === 'in_progress'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                          }`} />
                          {game.film_analysis_status === 'complete'
                            ? 'Complete'
                            : game.film_analysis_status === 'in_progress'
                              ? 'In Progress'
                              : 'Not Started'}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => router.push(`/teams/${teamId}/film/${game.id}/tag`)}
                        className="px-4 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                      >
                        {game.videos.length > 0 ? 'View Film' : 'Add Film'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        totalCount={allVideoIds.length}
        itemName="video"
        primaryActions={[
          {
            label: 'Combine Videos',
            onClick: handleCombineVideos,
            variant: 'primary',
            disabled: selectedCount < 2,
          },
          {
            label: 'Create Playlist',
            onClick: handleCreatePlaylist,
            variant: 'success',
          },
        ]}
        secondaryActions={[
          {
            label: 'Delete',
            onClick: handleBulkDelete,
            variant: 'danger',
          },
        ]}
        onSelectAll={() => selectAll(allVideoIds)}
        onClear={clearSelection}
      />

      {/* Own Team Game Modal */}
      {showOwnTeamGameModal && (
        <OwnTeamGameModal
          teamName={team.name}
          onSave={handleCreateOwnTeamGame}
          onClose={() => setShowOwnTeamGameModal(false)}
        />
      )}

      {/* Opponent Game Modal */}
      {showOpponentGameModal && (
        <OpponentGameModal
          onSave={handleCreateOpponentGame}
          onClose={() => setShowOpponentGameModal(false)}
        />
      )}

      {/* Game Result Modal */}
      {editingGameResult && (
        <GameResultModal
          game={editingGameResult}
          onSave={(result, teamScore, opponentScore) =>
            handleUpdateGameResult(editingGameResult.id, result, teamScore, opponentScore)
          }
          onClose={() => setEditingGameResult(null)}
        />
      )}
    </div>
  );
}

// Own Team Game Modal Component
function OwnTeamGameModal({
  teamName,
  onSave,
  onClose
}: {
  teamName: string;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    opponent: '',
    date: '',
    start_time: '',
    location: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Add {teamName} Game
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Game Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Week 1, Homecoming Game"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opponent <span className="text-gray-500">(Team you're playing)</span>
            </label>
            <input
              type="text"
              value={formData.opponent}
              onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
              placeholder="e.g., Lincoln Lions, Roosevelt Bears"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kickoff Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Home Field, Opponent Stadium"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional game notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Create Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Opponent Game Modal Component
function OpponentGameModal({
  onSave,
  onClose
}: {
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    opponent_team_name: '',
    opponent: '',
    date: '',
    start_time: '',
    location: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Add Opponent Scouting Game
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Game Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Week 1, Homecoming Game"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          {/* Info Banner */}
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-gray-600 text-xl">📹</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Opponent Scouting Film
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  This game will be used for uploading scouting film of another team
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Which team is this film of? <span className="text-gray-900">(Required)</span>
            </label>
            <input
              type="text"
              value={formData.opponent_team_name}
              onChange={(e) => setFormData({ ...formData, opponent_team_name: e.target.value })}
              placeholder="e.g., Lincoln Lions, Roosevelt Bears"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              This is the team you're scouting (the team in the film)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who are they playing? <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.opponent}
              onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
              placeholder="e.g., Central High"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
            <p className="text-xs text-gray-600 mt-1">
              The other team in this scouting film
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kickoff Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Home Field, Opponent Stadium"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional game notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Create Opponent Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Game Result Modal Component
function GameResultModal({
  game,
  onSave,
  onClose
}: {
  game: Game;
  onSave: (result: 'win' | 'loss' | 'tie' | null, teamScore: number | null, opponentScore: number | null) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<'win' | 'loss' | 'tie' | null>(game.game_result || null);
  const [teamScore, setTeamScore] = useState<number | null>(game.team_score ?? null);
  const [opponentScore, setOpponentScore] = useState<number | null>(game.opponent_score ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(result, teamScore, opponentScore);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Edit Game Result
        </h2>
        <p className="text-gray-600 mb-6">
          vs {game.opponent} - {game.date && new Date(game.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Result
            </label>
            <select
              value={result || ''}
              onChange={(e) => setResult(e.target.value ? (e.target.value as 'win' | 'loss' | 'tie') : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">Not played yet</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="tie">Tie</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Our Score
              </label>
              <input
                type="number"
                min="0"
                value={teamScore ?? ''}
                onChange={(e) => setTeamScore(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opponent Score
              </label>
              <input
                type="number"
                min="0"
                value={opponentScore ?? ''}
                onChange={(e) => setOpponentScore(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Save Result
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
