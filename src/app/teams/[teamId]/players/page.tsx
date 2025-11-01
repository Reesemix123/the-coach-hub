// src/app/teams/[teamId]/players/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { PlayerRecord, Team } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';

interface Game {
  id: string;
  game_result: 'win' | 'loss' | 'tie' | null;
}

type ViewMode = 'roster' | 'depth-chart';
type DepthChartUnit = 'offense' | 'defense' | 'special_teams';

const OFFENSIVE_POSITIONS = {
  'QB': 'Quarterback',
  'RB': 'Running Back',
  'FB': 'Fullback',
  'WR': 'Wide Receiver',
  'TE': 'Tight End',
  'LT': 'Left Tackle',
  'LG': 'Left Guard',
  'C': 'Center',
  'RG': 'Right Guard',
  'RT': 'Right Tackle'
};

const DEFENSIVE_POSITIONS = {
  'DE': 'Defensive End',
  'DT': 'Defensive Tackle',
  'NT': 'Nose Tackle',
  'LB': 'Linebacker',
  'MLB': 'Middle Linebacker',
  'OLB': 'Outside Linebacker',
  'CB': 'Cornerback',
  'S': 'Safety',
  'FS': 'Free Safety',
  'SS': 'Strong Safety'
};

const SPECIAL_TEAMS_POSITIONS = {
  'K': 'Kicker',
  'P': 'Punter',
  'LS': 'Long Snapper',
  'H': 'Holder',
  'KR': 'Kick Returner',
  'PR': 'Punt Returner'
};

const GRADE_LEVELS = [
  '6th Grade', '7th Grade', '8th Grade',
  'Freshman', 'Sophomore', 'Junior', 'Senior'
];

export default function PlayersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('roster');
  const [depthChartUnit, setDepthChartUnit] = useState<DepthChartUnit>('offense');
  const [filter, setFilter] = useState<'all' | 'offense' | 'defense' | 'special_teams'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      setTeam(teamData);

      // Fetch games for record
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, game_result')
        .eq('team_id', teamId);

      setGames(gamesData || []);

      // Fetch players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('position_group')
        .order('primary_position')
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
        const { error } = await supabase
          .from('players')
          .update(playerData)
          .eq('id', editingPlayer.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('players')
          .insert([{
            ...playerData,
            team_id: teamId,
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

  const handleDepthChange = async (playerId: string, newDepth: number) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ depth_order: newDepth })
        .eq('id', playerId);

      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert('Error updating depth: ' + error.message);
    }
  };

  const openEditModal = (player: PlayerRecord) => {
    setEditingPlayer(player);
    setShowAddModal(true);
  };

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
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

  const record = getWinLossRecord();
  const winPercentage = record.wins + record.losses > 0
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(0)
    : '0';

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team!}
        teamId={teamId}
        currentPage="players"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Quick Stats Banner */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{players.length}</div>
              <div className="text-sm text-gray-600 mt-1">Active Players</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{groupedPlayers.offense.length}</div>
              <div className="text-sm text-gray-600 mt-1">Offense</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{groupedPlayers.defense.length}</div>
              <div className="text-sm text-gray-600 mt-1">Defense</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-gray-900">{groupedPlayers.special_teams.length}</div>
              <div className="text-sm text-gray-600 mt-1">Special Teams</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('roster')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'roster'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => setViewMode('depth-chart')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'depth-chart'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Depth Chart
            </button>
          </div>

          <button
            onClick={() => {
              setEditingPlayer(null);
              setShowAddModal(true);
            }}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            + Add Player
          </button>
        </div>

        {/* Roster View */}
        {viewMode === 'roster' && (
          <RosterView
            players={filteredPlayers}
            filter={filter}
            setFilter={setFilter}
            groupedPlayers={groupedPlayers}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onPlayerClick={(id) => router.push(`/teams/${teamId}/players/${id}`)}
            onAddPlayer={() => setShowAddModal(true)}
          />
        )}

        {/* Depth Chart View */}
        {viewMode === 'depth-chart' && (
          <DepthChartView
            players={players}
            unit={depthChartUnit}
            onUnitChange={setDepthChartUnit}
            onDepthChange={handleDepthChange}
            onEdit={openEditModal}
          />
        )}
      </div>

      {/* Add/Edit Player Modal */}
      {showAddModal && (
        <PlayerModal
          player={editingPlayer}
          onClose={() => {
            setShowAddModal(false);
            setEditingPlayer(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// Roster View Component
function RosterView({
  players,
  filter,
  setFilter,
  groupedPlayers,
  onEdit,
  onDelete,
  onPlayerClick,
  onAddPlayer
}: {
  players: PlayerRecord[];
  filter: string;
  setFilter: (f: any) => void;
  groupedPlayers: any;
  onEdit: (p: PlayerRecord) => void;
  onDelete: (id: string) => void;
  onPlayerClick: (id: string) => void;
  onAddPlayer: () => void;
}) {
  return (
    <>
      {/* Filter Tabs */}
      <div className="flex gap-8 border-b border-gray-200 mb-8">
        <button
          onClick={() => setFilter('all')}
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
            filter === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Players ({players.length + (groupedPlayers.offense.length - players.filter((p: PlayerRecord) => filter === 'all' || p.position_group === filter).length)})
          {filter === 'all' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
          )}
        </button>
        <button
          onClick={() => setFilter('offense')}
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
            filter === 'offense' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
            filter === 'defense' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
            filter === 'special_teams' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Special Teams ({groupedPlayers.special_teams.length})
          {filter === 'special_teams' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
          )}
        </button>
      </div>

      {/* Player Table */}
      {players.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-gray-400 mb-4">No players on roster yet</div>
          <button
            onClick={onAddPlayer}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Depth</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Grade</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {player.jersey_number || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onPlayerClick(player.id)}
                      className="text-sm font-medium text-gray-900 hover:text-black"
                    >
                      {player.first_name} {player.last_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {player.primary_position}
                    {player.secondary_position && ` / ${player.secondary_position}`}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      player.depth_order === 1 ? 'bg-green-100 text-green-700' :
                      player.depth_order === 2 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {player.depth_order === 1 ? '1st' : player.depth_order === 2 ? '2nd' : `${player.depth_order}${getOrdinalSuffix(player.depth_order)}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {player.grade_level || '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <button
                      onClick={() => onEdit(player)}
                      className="text-gray-700 hover:text-black font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(player.id)}
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
    </>
  );
}

// Depth Chart View Component
function DepthChartView({
  players,
  unit,
  onUnitChange,
  onDepthChange,
  onEdit
}: {
  players: PlayerRecord[];
  unit: DepthChartUnit;
  onUnitChange: (u: DepthChartUnit) => void;
  onDepthChange: (playerId: string, depth: number) => void;
  onEdit: (p: PlayerRecord) => void;
}) {
  const positions = unit === 'offense' ? OFFENSIVE_POSITIONS :
                   unit === 'defense' ? DEFENSIVE_POSITIONS :
                   SPECIAL_TEAMS_POSITIONS;

  const unitPlayers = players.filter(p => p.position_group === unit);

  return (
    <>
      {/* Unit Tabs */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => onUnitChange('offense')}
          className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
            unit === 'offense'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Offense
        </button>
        <button
          onClick={() => onUnitChange('defense')}
          className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
            unit === 'defense'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Defense
        </button>
        <button
          onClick={() => onUnitChange('special_teams')}
          className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
            unit === 'special_teams'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Special Teams
        </button>
      </div>

      {/* Depth Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(positions).map(([code, name]) => {
          const positionPlayers = unitPlayers
            .filter(p => p.primary_position === code)
            .sort((a, b) => (a.depth_order || 99) - (b.depth_order || 99));

          return (
            <div key={code} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Position Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{code}</h3>
                <p className="text-xs text-gray-600">{name}</p>
              </div>

              {/* Depth Slots */}
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((depth) => {
                  const player = positionPlayers.find(p => p.depth_order === depth);

                  return (
                    <div key={depth} className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold ${
                        depth === 1 ? 'bg-green-100 text-green-700' :
                        depth === 2 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {depth === 1 ? '1st' : depth === 2 ? '2nd' : '3rd'}
                      </div>

                      {player ? (
                        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 group hover:border-gray-400 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                #{player.jersey_number} {player.first_name} {player.last_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {player.grade_level || 'No grade'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => onEdit(player)}
                                className="text-xs text-gray-600 hover:text-gray-900"
                              >
                                Edit
                              </button>
                              {depth < 3 && (
                                <button
                                  onClick={() => onDepthChange(player.id, depth + 1)}
                                  className="text-xs text-gray-600 hover:text-gray-900"
                                >
                                  ↓
                                </button>
                              )}
                              {depth > 1 && (
                                <button
                                  onClick={() => onDepthChange(player.id, depth - 1)}
                                  className="text-xs text-gray-600 hover:text-gray-900"
                                >
                                  ↑
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 text-center">
                          <span className="text-xs text-gray-400">Empty</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Player Modal Component
function PlayerModal({
  player,
  onClose,
  onSubmit
}: {
  player: PlayerRecord | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">
          {player ? 'Edit Player' : 'Add Player'}
        </h3>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jersey #
              </label>
              <input
                name="jersey_number"
                type="text"
                defaultValue={player?.jersey_number || ''}
                placeholder="24"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                name="first_name"
                type="text"
                defaultValue={player?.first_name || ''}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                name="last_name"
                type="text"
                defaultValue={player?.last_name || ''}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
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
                defaultValue={player?.position_group || 'offense'}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
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
                defaultValue={player?.primary_position || ''}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              >
                <option value="">Select...</option>
                <optgroup label="Offense">
                  {Object.keys(OFFENSIVE_POSITIONS).map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </optgroup>
                <optgroup label="Defense">
                  {Object.keys(DEFENSIVE_POSITIONS).map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </optgroup>
                <optgroup label="Special Teams">
                  {Object.keys(SPECIAL_TEAMS_POSITIONS).map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Depth Order *
              </label>
              <select
                name="depth_order"
                defaultValue={player?.depth_order || 1}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              >
                <option value="1">1st String</option>
                <option value="2">2nd String</option>
                <option value="3">3rd String</option>
                <option value="4">4th String</option>
              </select>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade Level
              </label>
              <select
                name="grade_level"
                defaultValue={player?.grade_level || ''}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
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
                defaultValue={player?.weight || ''}
                placeholder="185"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (in)
              </label>
              <input
                name="height"
                type="number"
                defaultValue={player?.height || ''}
                placeholder="72"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
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
              defaultValue={player?.notes || ''}
              placeholder="Additional information..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {player ? 'Update Player' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper function
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
