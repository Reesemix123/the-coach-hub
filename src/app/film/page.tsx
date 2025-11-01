'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from '@/components/AuthGuard';
import { useForm } from "react-hook-form";
import { createClient } from '@/utils/supabase/client';

interface Team {
  id: string;
  name: string;
  level: string;
}

interface Game {
  id: string;
  name: string;
  opponent?: string;
  date?: string;
  team_id?: string;
  is_opponent_game?: boolean;
  video_count?: number;
  play_count?: number;
}

interface GameForm {
  date: string;
  opponent: string;
  video?: FileList;
}

export default function FilmPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [viewMode, setViewMode] = useState<'own' | 'opponent'>('own');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GameForm>();

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchGames();
    } else {
      setGames([]);
    }
  }, [selectedTeam, viewMode]);

  async function fetchTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, level')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTeams(data);
    }
  }

  async function fetchGames() {
    const isOpponentView = viewMode === 'opponent';

    console.log('Fetching games for team:', selectedTeam, 'isOpponent:', isOpponentView);

    let query = supabase
      .from('games')
      .select('*')
      .eq('team_id', selectedTeam);

    // Filter based on view mode
    if (isOpponentView) {
      // Opponent games: only where is_opponent_game = true
      query = query.eq('is_opponent_game', true);
    } else {
      // Your games: where is_opponent_game = false OR NULL (for backward compatibility)
      query = query.or('is_opponent_game.is.null,is_opponent_game.eq.false');
    }

    const { data, error } = await query.order('date', { ascending: false });

    console.log('Fetched games:', { count: data?.length || 0, data, error });

    if (error) {
      console.error('Error fetching games:', error);
      setGames([]);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No games found, setting empty array');
      setGames([]);
      return;
    }

    // Get counts separately for each game
    const gamesWithCounts = await Promise.all(
      data.map(async (game) => {
        const { count: videoCount } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);

        const { count: playCount } = await supabase
          .from('play_instances')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', game.id);

        return {
          ...game,
          video_count: videoCount || 0,
          play_count: playCount || 0
        };
      })
    );

    setGames(gamesWithCounts);
  }

  async function onSubmit(values: GameForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to create a game');
      return;
    }

    if (!selectedTeam) {
      alert('Please select a team first');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Creating game...');

    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert([{
        date: values.date,
        name: viewMode === 'opponent' ? `${values.opponent} (Opponent)` : `vs ${values.opponent}`,
        opponent: values.opponent,
        team_id: selectedTeam,
        is_opponent_game: viewMode === 'opponent',
        user_id: user.id
      }])
      .select()
      .single();

    if (gameError) {
      setUploadStatus('Error: ' + gameError.message);
      setIsUploading(false);
      return;
    }

    if (values.video && values.video.length > 0) {
      const videoFile = values.video[0];
      setUploadStatus('Uploading video...');

      const fileName = `${gameData.id}/${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('game_videos')
        .upload(fileName, videoFile);

      if (uploadError) {
        setUploadStatus('Error uploading video: ' + uploadError.message);
        setIsUploading(false);
        return;
      }

      await supabase
        .from('videos')
        .insert([{
          name: videoFile.name,
          file_path: fileName,
          game_id: gameData.id
        }]);

      setUploadStatus('Game and video created successfully!');
    } else {
      setUploadStatus('Game created successfully!');
    }

    reset();
    setIsUploading(false);
    fetchGames();

    setTimeout(() => {
      setUploadStatus('');
      router.push(`/film/${gameData.id}`);
    }, 1500);
  }

  async function deleteGame(gameId: string) {
    if (!confirm('Delete this game and all its videos/play tags?')) return;

    try {
      console.log('Starting deletion for game:', gameId);

      // First, verify the game exists
      const { data: existingGame, error: checkError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      console.log('Game exists check:', { existingGame, checkError });

      if (checkError || !existingGame) {
        alert('Game does not exist in database! It may have already been deleted. Refreshing the list...');
        await fetchGames();
        return;
      }

      // Check if the current user matches the game owner
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Auth check:', {
        currentUserId: user?.id,
        gameUserId: existingGame.user_id,
        matches: user?.id === existingGame.user_id
      });

      if (user?.id !== existingGame.user_id) {
        alert(`Permission denied: You don't own this game.\nYour ID: ${user?.id}\nGame owner: ${existingGame.user_id}`);
        return;
      }

      // First, get all videos for this game
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, file_path')
        .eq('game_id', gameId);

      if (videosError) {
        console.error('Error fetching videos:', videosError);
        alert('Error fetching videos: ' + videosError.message);
        return;
      }

      console.log('Found videos:', videos?.length || 0);

      // Delete video files from storage and database records
      if (videos && videos.length > 0) {
        for (const video of videos) {
          console.log('Deleting video:', video.id);

          // Delete play instances first (they reference videos)
          const { error: playError } = await supabase
            .from('play_instances')
            .delete()
            .eq('video_id', video.id);

          if (playError) {
            console.error('Error deleting play instances:', playError);
          }

          // Delete from storage
          if (video.file_path) {
            const { error: storageError } = await supabase.storage
              .from('game_videos')
              .remove([video.file_path]);

            if (storageError) {
              console.error('Error deleting from storage:', storageError);
            }
          }

          // Delete video record
          const { data: deletedVideo, error: videoError } = await supabase
            .from('videos')
            .delete()
            .eq('id', video.id)
            .select();

          if (videoError) {
            console.error('Error deleting video record:', videoError);
            throw new Error('Failed to delete video: ' + videoError.message);
          }

          if (!deletedVideo || deletedVideo.length === 0) {
            console.error('Video was not deleted - possibly due to permissions');
            throw new Error('Video was not deleted - possibly due to RLS policies');
          }

          console.log('Video deleted successfully:', deletedVideo);
        }
      }

      // Finally, delete the game
      console.log('Deleting game:', gameId);
      const { data: deletedGame, error: gameError, count } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)
        .select();

      console.log('Delete response:', { deletedGame, gameError, count });

      if (gameError) {
        console.error('Error deleting game:', gameError);
        throw new Error('Failed to delete game: ' + gameError.message);
      }

      if (!deletedGame || deletedGame.length === 0) {
        throw new Error('Game was not deleted - possibly due to permissions. Check RLS policies.');
      }

      console.log('Game deleted successfully:', deletedGame);

      // Wait a moment for database to process, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchGames();

      alert('Game deleted successfully!');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Error during deletion: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Film Room</h1>
            <p className="text-gray-600">Manage game film and analyze plays</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">

          {/* Team Selection */}
          <div className="border border-gray-200 rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">Select Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white text-gray-900"
            >
              <option value="">Select a team...</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.level})
                </option>
              ))}
            </select>
          </div>

          {selectedTeam && (
            <>
              {/* View Mode Toggle */}
              <div className="border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('own')}
                    className={viewMode === 'own'
                      ? 'flex-1 px-4 py-2 bg-black text-white rounded-lg font-medium transition-colors'
                      : 'flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors'
                    }
                  >
                    Your Games
                  </button>
                  <button
                    onClick={() => setViewMode('opponent')}
                    className={viewMode === 'opponent'
                      ? 'flex-1 px-4 py-2 bg-black text-white rounded-lg font-medium transition-colors'
                      : 'flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors'
                    }
                  >
                    Opponent Scouting
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Create Game Form */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {viewMode === 'opponent' ? 'Add Opponent Game' : 'Add Your Game'}
                </h2>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Date</label>
                    <input
                      {...register('date', { required: 'Date is required' })}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    {errors.date && <p className="text-red-600 text-sm mt-1">{errors.date.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      {viewMode === 'opponent' ? 'Opponent Team' : 'Opponent'}
                    </label>
                    <input
                      {...register('opponent', { required: 'Opponent is required' })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="e.g., Eagles"
                    />
                    {errors.opponent && <p className="text-red-600 text-sm mt-1">{errors.opponent.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Video (Optional)</label>
                    <input
                      {...register('video')}
                      type="file"
                      accept="video/*"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max 150MB</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {isUploading ? 'Creating...' : 'Create Game'}
                  </button>

                  {uploadStatus && (
                    <div className={uploadStatus.includes('Error') ? 'text-red-700 bg-red-50 p-3 rounded-lg text-sm' : 'text-green-700 bg-green-50 p-3 rounded-lg text-sm'}>
                      {uploadStatus}
                    </div>
                  )}
                </form>
              </div>

              {/* Games Grid */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {viewMode === 'opponent' ? 'Opponent Games' : 'Your Games'} ({games.length})
                </h2>

                {games.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg">
                      {viewMode === 'opponent'
                        ? 'No opponent games yet. Add your first opponent scouting film!'
                        : 'No games yet. Create your first game!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {games.map(game => (
                      <div
                        key={game.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors cursor-pointer"
                        onClick={() => router.push(`/film/${game.id}`)}
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{game.name}</h3>
                              <p className="text-sm text-gray-500">
                                {game.date ? new Date(game.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 'No date'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                            <div className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{game.video_count || 0} video{game.video_count === 1 ? '' : 's'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span>{game.play_count || 0} play{game.play_count === 1 ? '' : 's'} tagged</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/film/${game.id}`);
                              }}
                              className="flex-1 px-3 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              Open Film Room
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGame(game.id);
                              }}
                              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}