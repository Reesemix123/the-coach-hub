// src/app/teams/[teamId]/players/page.tsx
'use client';

import { useEffect, useState, use, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { PlayerRecord, Team, PositionDepthMap } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';
import {
  validatePositionDepths,
  validateDepthChartConflicts,
  createPositionDepthsFromSelections,
  convertDepthMapToSelections,
  getDepthLabel
} from '@/utils/playerHelpers';
import { POSITION_CATEGORIES } from '@/config/footballPositions';
import {
  ensureDefaultSchemes,
  getTeamSchemes,
  getSlotAssignments,
  assignPlayerToSlot,
  swapDepth,
  type SchemeUnit,
  type SchemeWithPositions,
  type SlotAssignment,
} from '@/lib/services/scheme.service';

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
  'X': 'Split End (X)',
  'Y': 'Slot/TE (Y)',
  'Z': 'Flanker (Z)',
  'TE': 'Tight End',
  'LT': 'Left Tackle',
  'LG': 'Left Guard',
  'C': 'Center',
  'RG': 'Right Guard',
  'RT': 'Right Tackle'
};

const DEFENSIVE_POSITIONS = {
  'DE': 'Defensive End',
  'DT1': 'Defensive Tackle 1',
  'DT2': 'Defensive Tackle 2',
  'NT': 'Nose Tackle',
  'LB': 'Linebacker',
  'MLB': 'Middle Linebacker',
  'SAM': 'Strong Side LB (SAM)',
  'WILL': 'Weak Side LB (WILL)',
  'LCB': 'Left Cornerback',
  'RCB': 'Right Cornerback',
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

  const [schemesByUnit, setSchemesByUnit] = useState<Partial<Record<SchemeUnit, SchemeWithPositions>>>({});
  const [slotAssignmentsByScheme, setSlotAssignmentsByScheme] = useState<Record<string, SlotAssignment[]>>({});
  const [schemesLoading, setSchemesLoading] = useState(true);

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

      // Fetch players (with position_categories JOIN, flattened to category fields)
      const { data: playersData } = await supabase
        .from('players')
        .select('*, position_categories!primary_position_category_id(code, unit)')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('created_at');

      const flat = (playersData ?? []).map((p) => {
        const cat = (p as unknown as { position_categories?: { code: string | null; unit: string | null } | null }).position_categories;
        return {
          ...p,
          primary_position_category_code: cat?.code ?? null,
          primary_position_category_unit: cat?.unit ?? null,
        } as PlayerRecord;
      });
      setPlayers(flat);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // State for the position-category UUID lookup (loaded once on mount)
  const [categoryByCode, setCategoryByCode] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Load position_categories once so we can write primary_position_category_id by code lookup
    supabase
      .from('position_categories')
      .select('id, code')
      .eq('sport', 'football')
      .then(({ data }) => {
        if (data) {
          setCategoryByCode(new Map(data.map((r) => [r.code as string, r.id as string])));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load default schemes + their slot assignments for the depth chart view
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function loadSchemes() {
      setSchemesLoading(true);
      const dbClient = createClient();
      try {
        const level = team?.level ?? null;
        await ensureDefaultSchemes(dbClient, teamId, level);
        const schemes = await getTeamSchemes(dbClient, teamId);
        if (cancelled) return;

        const byUnit: Partial<Record<SchemeUnit, SchemeWithPositions>> = {};
        for (const unit of ['offense', 'defense', 'special_teams'] as SchemeUnit[]) {
          const def = schemes.find(s => s.unit === unit && s.is_default);
          if (def) byUnit[unit] = def;
        }
        setSchemesByUnit(byUnit);

        const assignmentMap: Record<string, SlotAssignment[]> = {};
        for (const scheme of Object.values(byUnit)) {
          if (!scheme) continue;
          const assignments = await getSlotAssignments(dbClient, scheme.id);
          if (cancelled) return;
          assignmentMap[scheme.id] = assignments;
        }
        setSlotAssignmentsByScheme(assignmentMap);
      } catch (err) {
        console.error('[PlayersPage] scheme load failed:', err);
      } finally {
        if (!cancelled) setSchemesLoading(false);
      }
    }

    loadSchemes();
    return () => { cancelled = true };
  }, [teamId, team?.level]);

  async function refreshSlotAssignments(schemeId: string) {
    const dbClient = createClient();
    const assignments = await getSlotAssignments(dbClient, schemeId);
    setSlotAssignmentsByScheme(prev => ({ ...prev, [schemeId]: assignments }));
  }

  const handleSubmit = async (position_depths: PositionDepthMap, otherData: any) => {
    // Validate position_depths structure
    const validation = validatePositionDepths(position_depths);
    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }

    // Check for depth chart conflicts with other players
    const conflictCheck = validateDepthChartConflicts(
      position_depths,
      players,
      editingPlayer?.id || null
    );

    if (!conflictCheck.isValid) {
      const conflictMessages = conflictCheck.conflicts.map(conflict => {
        const depthLabel = getDepthLabel(conflict.depth);
        return `${conflict.position} (${depthLabel}) is already assigned to #${conflict.conflictingPlayer.jersey_number} ${conflict.conflictingPlayer.first_name} ${conflict.conflictingPlayer.last_name}`;
      });

      alert(
        'Depth chart conflicts detected:\n\n' +
        conflictMessages.join('\n') +
        '\n\nEach position can only have one player at each depth level (1st, 2nd, 3rd, 4th string).'
      );
      return;
    }

    const primaryCategoryId = otherData.primary_category_code
      ? categoryByCode.get(otherData.primary_category_code) ?? null
      : null;

    const playerData: Partial<PlayerRecord> & { primary_position_category_id?: string | null } = {
      jersey_number: otherData.jersey_number,
      first_name: otherData.first_name,
      last_name: otherData.last_name,
      position_depths: position_depths,
      primary_position_category_id: primaryCategoryId,
      grade_level: otherData.grade_level || undefined,
      weight: otherData.weight ? parseInt(otherData.weight) : undefined,
      height: otherData.height ? parseInt(otherData.height) : undefined,
      notes: otherData.notes || undefined
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
      // Check for duplicate jersey number
      if (error.message?.includes('idx_players_team_jersey_unique') ||
          error.message?.includes('duplicate key')) {
        alert(
          `Jersey number ${otherData.jersey_number} is already taken.\n\n` +
          'Please choose a different jersey number.'
        );
      } else {
        alert('Error saving player: ' + error.message);
      }
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

  async function handleDepthChange(
    playerId: string,
    schemePositionId: string,
    currentDepth: number,
    newDepth: number,
  ) {
    const scheme = schemesByUnit[depthChartUnit];
    if (!scheme) return;

    const slotEntry = (slotAssignmentsByScheme[scheme.id] ?? []).find(
      a => a.scheme_position_id === schemePositionId,
    );
    const displaced = slotEntry?.players.find(
      p => p.depth === newDepth && p.player_id !== playerId,
    );

    // Optimistic update on the nested players array within the matching slot
    setSlotAssignmentsByScheme(prev => {
      const current = prev[scheme.id] ?? [];
      const updated = current.map(slot => {
        if (slot.scheme_position_id !== schemePositionId) return slot;
        const newPlayers = slot.players.map(p => {
          if (p.player_id === playerId) return { ...p, depth: newDepth };
          if (displaced && p.player_id === displaced.player_id) return { ...p, depth: currentDepth };
          return p;
        });
        return { ...slot, players: newPlayers };
      });
      return { ...prev, [scheme.id]: updated };
    });

    const dbClient = createClient();
    try {
      if (displaced) {
        await swapDepth(dbClient, schemePositionId, playerId, currentDepth, displaced.player_id, newDepth);
      } else {
        await assignPlayerToSlot(dbClient, playerId, schemePositionId, newDepth);
      }
    } catch (err) {
      console.error('[handleDepthChange] failed:', err);
    }

    await refreshSlotAssignments(scheme.id);
  }

  async function handleAssignPlayer(
    schemeId: string,
    schemePositionId: string,
    playerId: string,
    targetDepth: number,
  ) {
    const dbClient = createClient();
    try {
      await assignPlayerToSlot(dbClient, playerId, schemePositionId, targetDepth);
    } catch (err) {
      console.error('[handleAssignPlayer] failed:', err);
      alert('Could not assign player. Please try again.');
      return;
    }
    await refreshSlotAssignments(schemeId);
  }

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

  // Roster view groups players by their primary position category's unit.
  const inUnit = (p: PlayerRecord, unit: 'offense' | 'defense' | 'special_teams') =>
    p.primary_position_category_unit === unit;

  const filteredPlayers = filter === 'all'
    ? players
    : players.filter(p => inUnit(p, filter as 'offense' | 'defense' | 'special_teams'));

  const groupedPlayers = {
    offense: players.filter(p => inUnit(p, 'offense')),
    defense: players.filter(p => inUnit(p, 'defense')),
    special_teams: players.filter(p => inUnit(p, 'special_teams'))
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
            onPlayerClick={(id) => router.push(`/football/teams/${teamId}/players/${id}`)}
            onAddPlayer={() => setShowAddModal(true)}
          />
        )}

        {/* Depth Chart View */}
        {viewMode === 'depth-chart' && (
          <DepthChartView
            unit={depthChartUnit}
            scheme={schemesByUnit[depthChartUnit]}
            slotAssignments={
              schemesByUnit[depthChartUnit]
                ? (slotAssignmentsByScheme[schemesByUnit[depthChartUnit]!.id] ?? [])
                : []
            }
            players={players}
            schemesLoading={schemesLoading}
            onUnitChange={setDepthChartUnit}
            onDepthChange={handleDepthChange}
            onAssignPlayer={handleAssignPlayer}
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopyCode(playerId: string, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(playerId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

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
          All Players ({players.length})
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Positions & Depth</th>
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
                    {player.primary_position_category_code ?? '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {player.grade_level || '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    {player.join_code && (
                      <button
                        onClick={() => handleCopyCode(player.id, player.join_code!)}
                        className="text-gray-400 hover:text-gray-700 font-medium"
                        title="Copy join code"
                      >
                        {copiedId === player.id ? '✓ Copied' : 'Code'}
                      </button>
                    )}
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

// Inline player picker — opens from "+ Add" affordance on an empty depth row.
function PlayerPickerPopover({
  schemeId,
  schemePositionId,
  slotCategoryId,
  targetDepth,
  players,
  slotAssignments,
  onAssign,
}: {
  schemeId: string;
  schemePositionId: string;
  slotCategoryId: string;
  targetDepth: number;
  players: PlayerRecord[];
  slotAssignments: SlotAssignment[];
  onAssign: (schemeId: string, schemePositionId: string, playerId: string, targetDepth: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside handler
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const eligible = useMemo(() => {
    const slot = slotAssignments.find(a => a.scheme_position_id === schemePositionId);
    const assignedToSlot = new Set(slot?.players.map(p => p.player_id) ?? []);

    const filtered = players.filter(p => !assignedToSlot.has(p.id));
    const q = search.trim().toLowerCase();
    const searched = q
      ? filtered.filter(p =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.jersey_number ?? '').toString().includes(q),
        )
      : filtered;

    // Relevance: matching primary_position_category_id float to top.
    return [...searched].sort((a, b) => {
      const aRelevant = a.primary_position_category_id === slotCategoryId ? 0 : 1;
      const bRelevant = b.primary_position_category_id === slotCategoryId ? 0 : 1;
      if (aRelevant !== bRelevant) return aRelevant - bRelevant;
      const aJ = parseInt(a.jersey_number || '999', 10);
      const bJ = parseInt(b.jersey_number || '999', 10);
      return aJ - bJ;
    });
  }, [players, slotAssignments, schemePositionId, slotCategoryId, search]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
      >
        + Add
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {eligible.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-500 text-center">No available players</p>
            ) : (
              eligible.map(player => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    onAssign(schemeId, schemePositionId, player.id, targetDepth);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-900 text-xs font-bold flex-shrink-0">
                    {player.jersey_number || '?'}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">
                    {player.first_name} {player.last_name}
                  </span>
                  {player.primary_position_category_code && (
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {player.primary_position_category_code}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Depth Chart View Component
function DepthChartView({
  unit,
  scheme,
  slotAssignments,
  players,
  schemesLoading,
  onUnitChange,
  onDepthChange,
  onAssignPlayer,
  onEdit,
}: {
  unit: DepthChartUnit;
  scheme: SchemeWithPositions | undefined;
  slotAssignments: SlotAssignment[];
  players: PlayerRecord[];
  schemesLoading: boolean;
  onUnitChange: (u: DepthChartUnit) => void;
  onDepthChange: (playerId: string, schemePositionId: string, currentDepth: number, newDepth: number) => void;
  onAssignPlayer: (schemeId: string, schemePositionId: string, playerId: string, targetDepth: number) => void;
  onEdit: (p: PlayerRecord) => void;
}) {
  const sortedSlots = useMemo(() => {
    if (!scheme) return [];
    return [...scheme.scheme_positions].sort((a, b) => a.sort_order - b.sort_order);
  }, [scheme]);

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

      {schemesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 h-14" />
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(d => (
                  <div key={d} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100" />
                    <div className="flex-1 h-12 bg-gray-50 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !scheme ? (
        <div className="text-center py-16 text-gray-500">No scheme configured for this unit.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSlots.map(slot => {
            const slotEntry = slotAssignments.find(a => a.scheme_position_id === slot.id);
            return (
              <div key={slot.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Position Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">{slot.slot_code}</h3>
                  <p className="text-xs text-gray-600">{slot.display_label}</p>
                </div>

                {/* Depth Slots */}
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map(depth => {
                    const assignment = slotEntry?.players.find(p => p.depth === depth);
                    const player = assignment ? players.find(p => p.id === assignment.player_id) : null;

                    return (
                      <div key={depth} className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold ${
                          depth === 1 ? 'bg-green-100 text-green-700' :
                          depth === 2 ? 'bg-blue-100 text-blue-700' :
                          depth === 3 ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {getDepthLabel(depth)}
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
                                {depth < 4 && (
                                  <button
                                    onClick={() => onDepthChange(player.id, slot.id, depth, depth + 1)}
                                    className="text-xs text-gray-600 hover:text-gray-900"
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                )}
                                {depth > 1 && (
                                  <button
                                    onClick={() => onDepthChange(player.id, slot.id, depth, depth - 1)}
                                    className="text-xs text-gray-600 hover:text-gray-900"
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 flex items-center justify-center">
                            {scheme && (
                              <PlayerPickerPopover
                                schemeId={scheme.id}
                                schemePositionId={slot.id}
                                slotCategoryId={slot.position_category_id}
                                targetDepth={depth}
                                players={players}
                                slotAssignments={slotAssignments}
                                onAssign={onAssignPlayer}
                              />
                            )}
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
      )}
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
  onSubmit: (position_depths: PositionDepthMap, otherData: any) => void;
}) {
  // Convert player's position_depths to selections array for state
  const initialSelections = player ? convertDepthMapToSelections(player.position_depths) : [];

  // State for position-depth selections
  const [selections, setSelections] = useState<Array<{ position: string; depth: number }>>(initialSelections);

  // Toggle position on/off
  const handlePositionToggle = (position: string, checked: boolean) => {
    if (checked) {
      // Add position with default depth of 1
      setSelections([...selections, { position, depth: 1 }]);
    } else {
      // Remove position
      setSelections(selections.filter(s => s.position !== position));
    }
  };

  // Change depth for a position
  const handleDepthChange = (position: string, newDepth: number) => {
    setSelections(selections.map(s =>
      s.position === position ? { ...s, depth: newDepth } : s
    ));
  };

  // Check if position is selected
  const isPositionSelected = (position: string) => {
    return selections.some(s => s.position === position);
  };

  // Get depth for a position
  const getSelectedDepth = (position: string) => {
    return selections.find(s => s.position === position)?.depth || 1;
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Build position_depths from selections
    const position_depths = createPositionDepthsFromSelections(selections);

    // Gather other form data
    const otherData = {
      jersey_number: formData.get('jersey_number') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      primary_category_code: formData.get('primary_category_code') as string,
      grade_level: formData.get('grade_level') as string,
      weight: formData.get('weight') as string,
      height: formData.get('height') as string,
      notes: formData.get('notes') as string
    };

    onSubmit(position_depths, otherData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">
          {player ? 'Edit Player' : 'Add Player'}
        </h3>

        <form onSubmit={handleFormSubmit} className="space-y-6">
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

          {/* Primary Position Category — drives stats and reports */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Position *
            </label>
            <select
              name="primary_category_code"
              defaultValue={
                (player as unknown as { primary_position_category_code?: string })
                  ?.primary_position_category_code ?? ''
              }
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">Select position...</option>
              {POSITION_CATEGORIES.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.code} — {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Used for stats grouping. Specific scheme positions (LDE, MIKE, etc.) are assigned in the depth chart.
            </p>
          </div>

          {/* Positions with Per-Position Depth */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Positions & Depth <span className="text-xs text-gray-500">(legacy depth chart — Phase 2 replaces this)</span>
            </label>

            {/* Offensive Positions */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Offense</div>
              <div className="space-y-2">
                {Object.entries(OFFENSIVE_POSITIONS).map(([code, name]) => (
                  <div key={code} className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2 cursor-pointer min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={isPositionSelected(code)}
                        onChange={(e) => handlePositionToggle(code, e.target.checked)}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700 font-medium">{code}</span>
                      <span className="text-xs text-gray-500">({name})</span>
                    </label>
                    {isPositionSelected(code) && (
                      <select
                        value={getSelectedDepth(code)}
                        onChange={(e) => handleDepthChange(code, parseInt(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                      >
                        <option value="1">1st String</option>
                        <option value="2">2nd String</option>
                        <option value="3">3rd String</option>
                        <option value="4">4th String</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Defensive Positions */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Defense</div>
              <div className="space-y-2">
                {Object.entries(DEFENSIVE_POSITIONS).map(([code, name]) => (
                  <div key={code} className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2 cursor-pointer min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={isPositionSelected(code)}
                        onChange={(e) => handlePositionToggle(code, e.target.checked)}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700 font-medium">{code}</span>
                      <span className="text-xs text-gray-500">({name})</span>
                    </label>
                    {isPositionSelected(code) && (
                      <select
                        value={getSelectedDepth(code)}
                        onChange={(e) => handleDepthChange(code, parseInt(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                      >
                        <option value="1">1st String</option>
                        <option value="2">2nd String</option>
                        <option value="3">3rd String</option>
                        <option value="4">4th String</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Special Teams Positions */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Special Teams</div>
              <div className="space-y-2">
                {Object.entries(SPECIAL_TEAMS_POSITIONS).map(([code, name]) => (
                  <div key={code} className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2 cursor-pointer min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={isPositionSelected(code)}
                        onChange={(e) => handlePositionToggle(code, e.target.checked)}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700 font-medium">{code}</span>
                      <span className="text-xs text-gray-500">({name})</span>
                    </label>
                    {isPositionSelected(code) && (
                      <select
                        value={getSelectedDepth(code)}
                        onChange={(e) => handleDepthChange(code, parseInt(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                      >
                        <option value="1">1st String</option>
                        <option value="2">2nd String</option>
                        <option value="3">3rd String</option>
                        <option value="4">4th String</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selections.length === 0 && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                ⚠️ Please select at least one position
              </div>
            )}
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
