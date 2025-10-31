// src/app/teams/[teamId]/players/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { PlayerRecord, Team } from '@/types/football';

interface PlayerFormData {
  jersey_number: string;
  first_name: string;
  last_name: string;
  primary_position: string;
  secondary_position?: string;
  position_group: 'offense' | 'defense' | 'special_teams';
  depth_order: number;
  grade_level?: string;
  weight?: number;
  height?: number;
  notes?: string;
}

const OFFENSIVE_POSITIONS = ['QB', 'RB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEFENSIVE_POSITIONS = ['DE', 'DT', 'NT', 'LB', 'MLB', 'OLB', 'CB', 'S', 'FS', 'SS'];
const SPECIAL_TEAMS_POSITIONS = ['K', 'P', 'LS', 'H', 'KR', 'PR'];

const GRADE_LEVELS = [
  '6th Grade', '7th Grade', '8th Grade',
  'Freshman', 'Sophomore', 'Junior', 'Senior'
];

export default function PlayersPage({ params }: { params: { teamId: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'offense' | 'defense' | 'special_teams'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [params.teamId]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      setTeam(teamData);

      // Fetch players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', params.teamId)
        .eq('is_active', true)
        .order('position_group')
        .order('depth_order');

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const playerData: Partial<PlayerRecord> = {
      jersey_number: formData.get('jersey_number') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      primary_position: formData.get('primary_position') as string,
      secondary_position: formData.get('secondary_position') as string || undefined,
      position_group: formData.get('position_group') as 'offense' | 'defense' | 'special_teams',
      depth_order: parseInt(formData.get('depth_order') as string) || 1,
      grade_level: formData.get('grade_level') as string || undefined,
      weight: formData.get('weight') ? parseInt(formData.get('weight') as string) : undefined,
      height: formData.get('height') ? parseInt(formData.get('height') as string) : undefined,
      notes: formData.get('notes') as string || undefined
    };

    try {
      if (editingPlayer) {
        // Update existing player
        const { error } = await supabase
          .from('players')
          .update(playerData)
          .eq('id', editingPlayer.id);

        if (error) throw error;
      } else {
        // Create new player
        const { error } = await supabase
          .from('players')
          .insert([{
            ...playerData,
            team_id: params.teamId,
            is_active: true
          }]);

        if (error) throw error;
      }

      setShowAddModal(false);
      setEditingPlayer(null);
      await fetchData();
    } catch (error: any) {
      alert('Error saving player: ' + error.message);
    }
  };

  const handleDelete = async (playerId: string) => {
    if (!confirm('Remove this player from the roster?')) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({ is_active: false })
        .eq('id', playerId);

      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert('Error removing player: ' + error.message);
    }
  };

  const openEditModal = (player: PlayerRecord) => {
    setEditingPlayer(player);
    setShowAddModal(true);
  };

  const getPositionsForGroup = (group: string) => {
    switch (group) {
      case 'offense': return OFFENSIVE_POSITIONS;
      case 'defense': return DEFENSIVE_POSITIONS;
      case 'special_teams': return SPECIAL_TEAMS_POSITIONS;
      default: return [];
    }
  };

  const filteredPlayers = filter === 'all'
    ? players
    : players.filter(p => p.position_group === filter);

  const groupedPlayers = {
    offense: players.filter(p => p.position_group === 'offense'),
    defense: players.filter(p => p.position_group === 'defense'),
    special_teams: players.filter(p => p.position_group === 'special_teams')
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading roster...</div>
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
                Player Roster
              </h1>
              <p className="mt-2 text-gray-600">{players.length} active players</p>
            </div>

            <button
              onClick={() => {
                setEditingPlayer(null);
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add Player
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-8 mt-8 border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filter === 'all'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Players ({players.length})
              {filter === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setFilter('offense')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filter === 'offense'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Offense ({groupedPlayers.offense.length})
              {filter === 'offense' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setFilter('defense')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filter === 'defense'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Defense ({groupedPlayers.defense.length})
              {filter === 'defense' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setFilter('special_teams')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                filter === 'special_teams'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Special Teams ({groupedPlayers.special_teams.length})
              {filter === 'special_teams' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Player List */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">
              {filter === 'all' ? 'No players on roster yet' : `No ${filter.replace('_', ' ')} players`}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Add Your First Player
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Depth</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {player.jersey_number || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/teams/${params.teamId}/players/${player.id}`)}
                        className="text-sm font-medium text-gray-900 hover:text-black"
                      >
                        {player.first_name} {player.last_name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {player.primary_position}
                      {player.secondary_position && ` / ${player.secondary_position}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {player.depth_order}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {player.grade_level || '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-3">
                      <button
                        onClick={() => openEditModal(player)}
                        className="text-gray-700 hover:text-black font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(player.id)}
                        className="text-gray-500 hover:text-red-600 font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jersey #
                  </label>
                  <input
                    name="jersey_number"
                    type="text"
                    defaultValue={editingPlayer?.jersey_number || ''}
                    placeholder="24"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    name="first_name"
                    type="text"
                    defaultValue={editingPlayer?.first_name || ''}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    name="last_name"
                    type="text"
                    defaultValue={editingPlayer?.last_name || ''}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Position Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position Group *
                  </label>
                  <select
                    name="position_group"
                    defaultValue={editingPlayer?.position_group || 'offense'}
                    required
                    onChange={(e) => {
                      // Reset position when group changes
                      const form = e.target.form;
                      if (form) {
                        const posSelect = form.querySelector('[name="primary_position"]') as HTMLSelectElement;
                        if (posSelect) posSelect.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="offense">Offense</option>
                    <option value="defense">Defense</option>
                    <option value="special_teams">Special Teams</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Position *
                  </label>
                  <select
                    name="primary_position"
                    defaultValue={editingPlayer?.primary_position || ''}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Select...</option>
                    {OFFENSIVE_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                    {DEFENSIVE_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                    {SPECIAL_TEAMS_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Position
                  </label>
                  <select
                    name="secondary_position"
                    defaultValue={editingPlayer?.secondary_position || ''}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">None</option>
                    {OFFENSIVE_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                    {DEFENSIVE_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                    {SPECIAL_TEAMS_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Depth Order *
                  </label>
                  <input
                    name="depth_order"
                    type="number"
                    min="1"
                    defaultValue={editingPlayer?.depth_order || 1}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade Level
                  </label>
                  <select
                    name="grade_level"
                    defaultValue={editingPlayer?.grade_level || ''}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Select...</option>
                    {GRADE_LEVELS.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    name="weight"
                    type="number"
                    defaultValue={editingPlayer?.weight || ''}
                    placeholder="185"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (in)
                  </label>
                  <input
                    name="height"
                    type="number"
                    defaultValue={editingPlayer?.height || ''}
                    placeholder="72"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingPlayer?.notes || ''}
                  placeholder="Additional information about the player..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPlayer(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {editingPlayer ? 'Update Player' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
