'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from '@/components/AuthGuard';
import { useForm } from "react-hook-form";
import { createClient } from '@/utils/supabase/client';

interface Team {
  id: string;
  name: string;
  level: string;
}

interface Player {
  id: string;
  team_id: string;
  jersey_number?: string;
  first_name: string;
  last_name: string;
  position?: string;
  grade_year?: string;
  is_active: boolean;
}

interface PlayerForm {
  jersey_number?: string;
  first_name: string;
  last_name: string;
  position?: string;
  grade_year?: string;
}

const POSITIONS = [
  'QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'C', 'G', 'T',
  'DL', 'DE', 'DT', 'LB', 'DB', 'CB', 'S', 'K', 'P'
];

const GRADE_YEARS = [
  'Freshman', 'Sophomore', 'Junior', 'Senior',
  '7th Grade', '8th Grade'
];

export default function PlayersPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PlayerForm>();

  useEffect(() => {
    if (teamId) {
      fetchTeam();
      fetchPlayers();
    }
  }, [teamId]);

  async function fetchTeam() {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    if (data) setTeam(data);
  }

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('jersey_number', { ascending: true });
    if (data) setPlayers(data);
  }

  async function onSubmit(values: PlayerForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in');
      return;
    }

    if (editingPlayer) {
      // Update existing player
      const { error } = await supabase
        .from('players')
        .update(values)
        .eq('id', editingPlayer.id);

      if (error) {
        alert('Error updating player: ' + error.message);
        return;
      }
    } else {
      // Create new player
      const { error } = await supabase
        .from('players')
        .insert([{
          ...values,
          team_id: teamId,
          user_id: user.id,
          is_active: true
        }]);

      if (error) {
        alert('Error adding player: ' + error.message);
        return;
      }
    }

    setShowAddModal(false);
    setEditingPlayer(null);
    reset();
    fetchPlayers();
  }

  async function deletePlayer(playerId: string) {
    if (!confirm('Remove this player from roster?')) return;

    const { error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', playerId);

    if (!error) {
      fetchPlayers();
    }
  }

  function openEditModal(player: Player) {
    setEditingPlayer(player);
    setValue('jersey_number', player.jersey_number || '');
    setValue('first_name', player.first_name);
    setValue('last_name', player.last_name);
    setValue('position', player.position || '');
    setValue('grade_year', player.grade_year || '');
    setShowAddModal(true);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push(`/teams/${teamId}`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Team</span>
            </button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Player Roster</h1>
                {team && <p className="text-lg text-gray-600 mt-1">{team.name}</p>}
              </div>

              <button
                onClick={() => {
                  setEditingPlayer(null);
                  reset();
                  setShowAddModal(true);
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold"
              >
                + Add Player
              </button>
            </div>
          </div>

          {/* Player List */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            {players.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">No players on roster yet</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold"
                >
                  Add Your First Player
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">#</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">Position</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">Grade</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {players.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {player.jersey_number || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => router.push(`/teams/${teamId}/players/${player.id}`)}
                            className="font-semibold text-gray-900 hover:text-black transition-colors"
                          >
                            {player.first_name} {player.last_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {player.position || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {player.grade_year || '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm space-x-2">
                          <button
                            onClick={() => openEditModal(player)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePlayer(player.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
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
        </div>
      </div>

      {/* Add/Edit Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Jersey Number
                </label>
                <input
                  {...register('jersey_number')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 24"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  {...register('first_name', { required: 'First name is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {errors.first_name && <p className="text-red-600 text-sm mt-1">{errors.first_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Last Name <span className="text-red-600">*</span>
                </label>
                <input
                  {...register('last_name', { required: 'Last name is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {errors.last_name && <p className="text-red-600 text-sm mt-1">{errors.last_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Position</label>
                <select
                  {...register('position')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select position...</option>
                  {POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Grade/Year</label>
                <select
                  {...register('grade_year')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select grade...</option>
                  {GRADE_YEARS.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPlayer(null);
                    reset();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold"
                >
                  {editingPlayer ? 'Update' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}