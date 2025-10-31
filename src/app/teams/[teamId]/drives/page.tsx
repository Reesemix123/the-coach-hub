// src/app/teams/[teamId]/drives/page.tsx
// Drive management interface for drive-level analytics

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { DriveService } from '@/lib/services/drive.service';
import type { Drive, Game, Team } from '@/types/football';

export default function DrivesPage({ params }: { params: { teamId: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();
  const driveService = new DriveService();

  useEffect(() => {
    fetchData();
  }, [params.teamId]);

  useEffect(() => {
    if (games.length > 0) {
      fetchDrives();
    }
  }, [selectedGame]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      setTeam(teamData);

      // Fetch games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', params.teamId)
        .order('date', { ascending: false });

      setGames(gamesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrives = async () => {
    try {
      const drivesData = selectedGame === 'all'
        ? await driveService.getDrivesForTeam(params.teamId)
        : await driveService.getDrivesForGame(selectedGame);

      setDrives(drivesData);
    } catch (error) {
      console.error('Error fetching drives:', error);
    }
  };

  const handleCreateDrive = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await driveService.createDrive({
        gameId: formData.get('game_id') as string,
        teamId: params.teamId,
        driveNumber: parseInt(formData.get('drive_number') as string),
        quarter: parseInt(formData.get('quarter') as string),
        startYardLine: parseInt(formData.get('start_yard_line') as string),
        startTime: formData.get('start_time') ? parseInt(formData.get('start_time') as string) : undefined
      });

      setShowCreateModal(false);
      await fetchDrives();
    } catch (error: any) {
      alert('Error creating drive: ' + error.message);
    }
  };

  const handleCompleteDrive = async (drive: Drive) => {
    const result = prompt(
      'Enter drive result:\n' +
      '1 = Touchdown\n' +
      '2 = Field Goal\n' +
      '3 = Punt\n' +
      '4 = Turnover\n' +
      '5 = Turnover on Downs\n' +
      '6 = End of Half/Game'
    );

    if (!result) return;

    const resultMap: Record<string, Drive['result']> = {
      '1': 'touchdown',
      '2': 'field_goal',
      '3': 'punt',
      '4': 'turnover',
      '5': 'downs',
      '6': 'end_half'
    };

    const driveResult = resultMap[result];
    if (!driveResult) {
      alert('Invalid result');
      return;
    }

    const endYardLine = parseInt(prompt('End yard line (0-100):') || '0');

    try {
      await driveService.completeDrive(drive.id, driveResult, endYardLine);
      await fetchDrives();
    } catch (error: any) {
      alert('Error completing drive: ' + error.message);
    }
  };

  const handleDeleteDrive = async (driveId: string) => {
    if (!confirm('Delete this drive? All linked plays will be unlinked.')) return;

    try {
      await driveService.deleteDrive(driveId);
      await fetchDrives();
    } catch (error: any) {
      alert('Error deleting drive: ' + error.message);
    }
  };

  const getResultBadge = (result: string) => {
    const colors: Record<string, string> = {
      touchdown: 'bg-green-100 text-green-800',
      field_goal: 'bg-blue-100 text-blue-800',
      punt: 'bg-gray-100 text-gray-800',
      turnover: 'bg-red-100 text-red-800',
      downs: 'bg-orange-100 text-orange-800',
      end_half: 'bg-gray-100 text-gray-600',
      end_game: 'bg-gray-100 text-gray-600',
      safety: 'bg-purple-100 text-purple-800'
    };

    return colors[result] || 'bg-gray-100 text-gray-600';
  };

  const calculatePPD = () => {
    if (drives.length === 0) return 0;
    const totalPoints = drives.reduce((sum, d) => sum + d.points, 0);
    return (totalPoints / drives.length).toFixed(2);
  };

  const calculate3AndOutRate = () => {
    if (drives.length === 0) return 0;
    const threeAndOuts = drives.filter(d => d.three_and_out).length;
    return ((threeAndOuts / drives.length) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading drives...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push(`/teams/${params.teamId}`)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {team?.name || 'Team'}
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                Drive Analytics
              </h1>
              <p className="mt-2 text-gray-600">{drives.length} drives tracked</p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Create Drive
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-6 mt-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{calculatePPD()}</div>
              <div className="text-sm text-gray-600 mt-1">Points Per Drive</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{calculate3AndOutRate()}%</div>
              <div className="text-sm text-gray-600 mt-1">3-and-Out Rate</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">
                {drives.filter(d => d.scoring_drive).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Scoring Drives</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">
                {(drives.reduce((sum, d) => sum + d.plays_count, 0) / (drives.length || 1)).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Plays Per Drive</div>
            </div>
          </div>

          {/* Game Filter */}
          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Game</label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All Games</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name} {game.opponent && `vs ${game.opponent}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Drive List */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {drives.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">No drives tracked yet</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Create Your First Drive
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {drives.map((drive) => {
              const game = games.find(g => g.id === drive.game_id);

              return (
                <div
                  key={drive.id}
                  className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          Q{drive.quarter} Drive #{drive.drive_number}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getResultBadge(drive.result)}`}>
                          {drive.result.replace('_', ' ').toUpperCase()}
                        </span>
                        {drive.three_and_out && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                            3-and-OUT
                          </span>
                        )}
                        {drive.scoring_drive && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                            SCORING
                          </span>
                        )}
                      </div>

                      {game && (
                        <div className="text-sm text-gray-600 mb-3">
                          {game.name} {game.opponent && `vs ${game.opponent}`}
                        </div>
                      )}

                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Field Position</div>
                          <div className="font-medium text-gray-900">
                            {drive.start_yard_line} → {drive.end_yard_line}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Plays</div>
                          <div className="font-medium text-gray-900">{drive.plays_count}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Yards</div>
                          <div className="font-medium text-gray-900">{drive.yards_gained}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">1st Downs</div>
                          <div className="font-medium text-gray-900">{drive.first_downs}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Points</div>
                          <div className="font-medium text-gray-900">{drive.points}</div>
                        </div>
                      </div>

                      {drive.notes && (
                        <div className="mt-3 text-sm text-gray-600 italic">
                          {drive.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {drive.result === 'end_half' && (
                        <button
                          onClick={() => handleCompleteDrive(drive)}
                          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDrive(drive.id)}
                        className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Drive Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Create Drive</h3>

            <form onSubmit={handleCreateDrive} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Game *
                </label>
                <select
                  name="game_id"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select game...</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} {game.opponent && `vs ${game.opponent}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Drive # *
                  </label>
                  <input
                    name="drive_number"
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quarter *
                  </label>
                  <select
                    name="quarter"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="1">1st</option>
                    <option value="2">2nd</option>
                    <option value="3">3rd</option>
                    <option value="4">4th</option>
                    <option value="5">OT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Starting Yard Line * (0-100)
                </label>
                <input
                  name="start_yard_line"
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="75 (own 25)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <div className="text-xs text-gray-500 mt-1">
                  0 = own goal line, 50 = midfield, 100 = opponent goal line
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Create Drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
