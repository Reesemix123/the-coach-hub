// src/app/teams/[teamId]/film/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import TeamNavigation from '@/components/TeamNavigation';
import SelectionBadge from '@/components/SelectionBadge';
import BulkActionBar from '@/components/BulkActionBar';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { bulkDelete, confirmBulkOperation } from '@/utils/bulkOperations';

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

export default function TeamFilmPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<GameWithVideos[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'with-film' | 'no-film'>('all');

  const router = useRouter();
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

  const getFilteredGames = () => {
    if (filter === 'with-film') {
      return games.filter(g => g.videos.length > 0);
    } else if (filter === 'no-film') {
      return games.filter(g => g.videos.length === 0);
    }
    return games;
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
        <div className="max-w-7xl mx-auto px-6 py-6">
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900">Film Library</h2>
            <p className="text-gray-600 mt-1">Game film and video analysis</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All Games ({games.length})
            {filter === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setFilter('with-film')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'with-film' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            With Film ({gamesWithFilm})
            {filter === 'with-film' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setFilter('no-film')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'no-film' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            No Film ({games.length - gamesWithFilm})
            {filter === 'no-film' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
        </div>

        {/* Games List */}
        {filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">
              {filter === 'all' ? 'No games scheduled yet' :
               filter === 'with-film' ? 'No games with film yet' :
               'All games have film'}
            </div>
            <button
              onClick={() => router.push(`/teams/${teamId}`)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Go to Schedule
            </button>
          </div>
        ) : (
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

                    <button
                      onClick={() => router.push(`/film/${game.id}`)}
                      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      View/Add Film →
                    </button>
                  </div>
                </div>

                {/* Videos List */}
                <div className="p-6">
                  {game.videos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No film uploaded for this game yet</p>
                      <button
                        onClick={() => router.push(`/film/${game.id}`)}
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
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {video.name}
                            </h4>
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
                              onClick={() => router.push(`/film/${game.id}`)}
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
    </div>
  );
}
