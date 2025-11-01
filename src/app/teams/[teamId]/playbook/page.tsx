'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import TeamNavigation from '@/components/TeamNavigation';
import type { GamePlan, GamePlanPlayWithDetails, PlaybookPlay } from '@/types/football';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

type ViewMode = 'grid' | 'list' | 'gameplan';

export default function TeamPlaybookPage({ params }: { params: { teamId: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [plays, setPlays] = useState<PlaybookPlay[]>([]);
  const [filteredPlays, setFilteredPlays] = useState<PlaybookPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Selection state
  const [selectedPlayCodes, setSelectedPlayCodes] = useState<Set<string>>(new Set());

  // Game Plans
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [activeGamePlan, setActiveGamePlan] = useState<GamePlan | null>(null);
  const [gamePlanPlays, setGamePlanPlays] = useState<GamePlanPlayWithDetails[]>([]);

  // Modals
  const [showCreateGamePlanModal, setShowCreateGamePlanModal] = useState(false);
  const [newGamePlanName, setNewGamePlanName] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterODK, setFilterODK] = useState<string>('all');
  const [filterFormation, setFilterFormation] = useState<string>('all');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [params.teamId]);

  useEffect(() => {
    applyFilters();
  }, [plays, searchTerm, filterODK, filterFormation]);

  async function fetchData() {
    try {
      // Fetch team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch plays for this team
      const { data: playsData, error: playsError } = await supabase
        .from('playbook_plays')
        .select('*')
        .eq('team_id', params.teamId)
        .eq('is_archived', false)
        .order('play_code', { ascending: true });

      if (playsError) throw playsError;
      setPlays(playsData || []);

      // Fetch game plans
      const { data: gamePlansData, error: gamePlansError } = await supabase
        .from('game_plans')
        .select('*')
        .eq('team_id', params.teamId)
        .order('created_at', { ascending: false });

      if (gamePlansError) throw gamePlansError;
      setGamePlans(gamePlansData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGamePlanPlays(gamePlanId: string) {
    try {
      const { data, error } = await supabase
        .from('game_plan_plays')
        .select('*, playbook_plays(*)')
        .eq('game_plan_id', gamePlanId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Transform data to match our type
      const transformedData = (data || []).map(item => ({
        id: item.id,
        game_plan_id: item.game_plan_id,
        play_code: item.play_code,
        call_number: item.call_number,
        sort_order: item.sort_order,
        notes: item.notes,
        created_at: item.created_at,
        play: Array.isArray(item.playbook_plays) ? item.playbook_plays[0] : item.playbook_plays
      }));

      setGamePlanPlays(transformedData);
    } catch (error) {
      console.error('Error fetching game plan plays:', error);
    }
  }

  function applyFilters() {
    let filtered = [...plays];

    if (searchTerm) {
      filtered = filtered.filter(play =>
        play.play_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        play.play_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterODK !== 'all') {
      filtered = filtered.filter(play => play.attributes?.odk === filterODK);
    }

    if (filterFormation !== 'all') {
      filtered = filtered.filter(play => play.attributes?.formation === filterFormation);
    }

    setFilteredPlays(filtered);
  }

  function handleSelectPlay(playCode: string) {
    const newSelected = new Set(selectedPlayCodes);
    if (newSelected.has(playCode)) {
      newSelected.delete(playCode);
    } else {
      newSelected.add(playCode);
    }
    setSelectedPlayCodes(newSelected);
  }

  function handleSelectAll() {
    if (selectedPlayCodes.size === filteredPlays.length) {
      setSelectedPlayCodes(new Set());
    } else {
      setSelectedPlayCodes(new Set(filteredPlays.map(p => p.play_code)));
    }
  }

  async function handleCreateGamePlan() {
    if (!newGamePlanName.trim()) {
      alert('Please enter a game plan name');
      return;
    }

    if (selectedPlayCodes.size === 0) {
      alert('Please select at least one play');
      return;
    }

    try {
      // Create game plan
      const { data: gamePlan, error: gamePlanError } = await supabase
        .from('game_plans')
        .insert({
          team_id: params.teamId,
          name: newGamePlanName,
          wristband_format: '3x5'
        })
        .select()
        .single();

      if (gamePlanError) throw gamePlanError;

      // Add plays to game plan
      const selectedPlaysArray = Array.from(selectedPlayCodes);
      const gamePlanPlaysData = selectedPlaysArray.map((playCode, index) => ({
        game_plan_id: gamePlan.id,
        play_code: playCode,
        call_number: index + 1,
        sort_order: index
      }));

      const { error: playsError } = await supabase
        .from('game_plan_plays')
        .insert(gamePlanPlaysData);

      if (playsError) throw playsError;

      // Reset and refresh
      setNewGamePlanName('');
      setSelectedPlayCodes(new Set());
      setShowCreateGamePlanModal(false);
      await fetchData();

      // Switch to game plan view and select the new plan
      setActiveGamePlan(gamePlan);
      setViewMode('gameplan');
      await fetchGamePlanPlays(gamePlan.id);
    } catch (error) {
      console.error('Error creating game plan:', error);
      alert('Error creating game plan');
    }
  }

  async function handleDeleteGamePlan(gamePlanId: string) {
    if (!confirm('Are you sure you want to delete this game plan?')) return;

    try {
      const { error } = await supabase
        .from('game_plans')
        .delete()
        .eq('id', gamePlanId);

      if (error) throw error;

      if (activeGamePlan?.id === gamePlanId) {
        setActiveGamePlan(null);
        setGamePlanPlays([]);
      }

      await fetchData();
    } catch (error) {
      console.error('Error deleting game plan:', error);
      alert('Error deleting game plan');
    }
  }

  async function handleSelectGamePlan(gamePlan: GamePlan) {
    setActiveGamePlan(gamePlan);
    await fetchGamePlanPlays(gamePlan.id);
  }

  async function handleUpdateCallNumber(gamePlanPlayId: string, newCallNumber: number) {
    try {
      const { error } = await supabase
        .from('game_plan_plays')
        .update({ call_number: newCallNumber })
        .eq('id', gamePlanPlayId);

      if (error) throw error;

      if (activeGamePlan) {
        await fetchGamePlanPlays(activeGamePlan.id);
      }
    } catch (error) {
      console.error('Error updating call number:', error);
      alert('Error updating call number');
    }
  }

  async function handleRemoveFromGamePlan(gamePlanPlayId: string) {
    if (!confirm('Remove this play from the game plan?')) return;

    try {
      const { error } = await supabase
        .from('game_plan_plays')
        .delete()
        .eq('id', gamePlanPlayId);

      if (error) throw error;

      if (activeGamePlan) {
        await fetchGamePlanPlays(activeGamePlan.id);
      }
    } catch (error) {
      console.error('Error removing play:', error);
      alert('Error removing play');
    }
  }

  function handlePrintWristband() {
    if (!activeGamePlan) return;
    router.push(`/teams/${params.teamId}/playbook/print-wristband/${activeGamePlan.id}`);
  }

  function handlePrintCoachSheet() {
    if (!activeGamePlan) return;
    router.push(`/teams/${params.teamId}/playbook/print-coach-sheet/${activeGamePlan.id}`);
  }

  async function handleDeletePlay(playId: string) {
    if (!confirm('Are you sure you want to delete this play?')) return;

    try {
      const { error } = await supabase
        .from('playbook_plays')
        .delete()
        .eq('id', playId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting play:', error);
      alert('Error deleting play');
    }
  }

  async function handleArchivePlay(playId: string) {
    try {
      const { error } = await supabase
        .from('playbook_plays')
        .update({ is_archived: true })
        .eq('id', playId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error archiving play:', error);
      alert('Error archiving play');
    }
  }

  const uniqueFormations = Array.from(
    new Set(plays.map(p => p.attributes?.formation).filter(Boolean))
  ).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading playbook...</div>
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={params.teamId}
        currentPage="playbook"
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900">Playbook</h2>
            <p className="text-gray-600 mt-1">
              {plays.length} plays • {gamePlans.length} game plans
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/playbook')}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              + Build Play
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-8 flex items-center justify-between">
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
            <button
              onClick={() => setViewMode('gameplan')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'gameplan'
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Game Plans
            </button>
          </div>

          {viewMode === 'list' && selectedPlayCodes.size > 0 && (
            <button
              onClick={() => setShowCreateGamePlanModal(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Create Game Plan ({selectedPlayCodes.size} plays)
            </button>
          )}
        </div>

        {/* Filters (Grid & List View) */}
        {viewMode !== 'gameplan' && plays.length > 0 && (
          <div className="mb-8 flex items-center space-x-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plays..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />

            <select
              value={filterODK}
              onChange={(e) => setFilterODK(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="all">All Types</option>
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
              <option value="specialTeams">Special Teams</option>
            </select>

            {uniqueFormations.length > 0 && (
              <select
                value={filterFormation}
                onChange={(e) => setFilterFormation(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              >
                <option value="all">All Formations</option>
                {uniqueFormations.map(formation => (
                  <option key={formation} value={formation}>
                    {formation}
                  </option>
                ))}
              </select>
            )}

            {(searchTerm || filterODK !== 'all' || filterFormation !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterODK('all');
                  setFilterFormation('all');
                }}
                className="px-4 py-2 text-gray-700 hover:text-black font-medium transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'grid' && (
          <>
            {plays.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-lg">
                <div className="max-w-md mx-auto">
                  <p className="text-2xl font-semibold text-gray-900 mb-3">No plays yet</p>
                  <p className="text-gray-600 mb-8">Build your first play to get started.</p>
                  <button
                    onClick={() => router.push('/playbook')}
                    className="px-8 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
                  >
                    Build First Play
                  </button>
                </div>
              </div>
            ) : filteredPlays.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600">No plays match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlays.map(play => (
                  <div
                    key={play.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-all"
                  >
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-500">{play.play_code}</h3>
                          <p className="text-xl font-semibold text-gray-900 mt-1">{play.play_name}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          play.attributes?.odk === 'offense' ? 'bg-blue-50 text-blue-700' :
                          play.attributes?.odk === 'defense' ? 'bg-red-50 text-red-700' :
                          'bg-green-50 text-green-700'
                        }`}>
                          {play.attributes?.odk === 'offense' ? 'OFF' :
                           play.attributes?.odk === 'defense' ? 'DEF' : 'ST'}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <p>{play.attributes?.formation || 'No formation'}</p>
                        {play.attributes?.playType && (
                          <p>{play.attributes.playType}</p>
                        )}
                        {play.attributes?.coverage && (
                          <p>{play.attributes.coverage}</p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 flex items-center justify-between">
                      <button
                        onClick={() => router.push('/playbook')}
                        className="text-sm text-gray-700 hover:text-black font-medium transition-colors"
                      >
                        View/Edit
                      </button>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchivePlay(play.id);
                          }}
                          className="text-sm text-gray-700 hover:text-black font-medium transition-colors"
                        >
                          Archive
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlay(play.id);
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === 'list' && (
          <>
            {plays.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-lg">
                <div className="max-w-md mx-auto">
                  <p className="text-2xl font-semibold text-gray-900 mb-3">No plays yet</p>
                  <p className="text-gray-600 mb-8">Build your first play to get started.</p>
                  <button
                    onClick={() => router.push('/playbook')}
                    className="px-8 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
                  >
                    Build First Play
                  </button>
                </div>
              </div>
            ) : filteredPlays.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600">No plays match your filters.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedPlayCodes.size === filteredPlays.length && filteredPlays.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Play Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Formation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Details
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPlays.map(play => (
                      <tr key={play.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPlayCodes.has(play.play_code)}
                            onChange={() => handleSelectPlay(play.play_code)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {play.play_code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {play.play_name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            play.attributes?.odk === 'offense' ? 'bg-blue-50 text-blue-700' :
                            play.attributes?.odk === 'defense' ? 'bg-red-50 text-red-700' :
                            'bg-green-50 text-green-700'
                          }`}>
                            {play.attributes?.odk === 'offense' ? 'OFF' :
                             play.attributes?.odk === 'defense' ? 'DEF' : 'ST'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {play.attributes?.formation || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {play.attributes?.playType || play.attributes?.coverage || '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm space-x-3">
                          <button
                            onClick={() => router.push('/playbook')}
                            className="text-gray-700 hover:text-black font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchivePlay(play.id)}
                            className="text-gray-700 hover:text-black font-medium"
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => handleDeletePlay(play.id)}
                            className="text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {viewMode === 'gameplan' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar: Game Plans List */}
            <div className="col-span-3">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Game Plans</h3>

                {gamePlans.length === 0 ? (
                  <p className="text-sm text-gray-600">No game plans yet. Switch to List View to select plays and create a game plan.</p>
                ) : (
                  <div className="space-y-2">
                    {gamePlans.map(plan => (
                      <div
                        key={plan.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          activeGamePlan?.id === plan.id
                            ? 'bg-black text-white'
                            : 'bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                        onClick={() => handleSelectGamePlan(plan)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{plan.name}</p>
                            <p className={`text-xs mt-1 ${
                              activeGamePlan?.id === plan.id ? 'text-gray-300' : 'text-gray-500'
                            }`}>
                              {new Date(plan.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGamePlan(plan.id);
                            }}
                            className={`ml-2 text-xs ${
                              activeGamePlan?.id === plan.id
                                ? 'text-red-300 hover:text-red-100'
                                : 'text-red-600 hover:text-red-700'
                            }`}
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

            {/* Main Area: Game Plan Details */}
            <div className="col-span-9">
              {!activeGamePlan ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg">
                  <p className="text-xl text-gray-600">Select a game plan to view details</p>
                </div>
              ) : (
                <div>
                  {/* Game Plan Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold text-gray-900">{activeGamePlan.name}</h3>
                      <p className="text-gray-600 mt-1">{gamePlanPlays.length} plays</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePrintWristband}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Print Wristband
                      </button>
                      <button
                        onClick={handlePrintCoachSheet}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        Print Coach Sheet
                      </button>
                    </div>
                  </div>

                  {/* Plays Table */}
                  {gamePlanPlays.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">No plays in this game plan</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Call #
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Play Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Play Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Formation
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {gamePlanPlays.map(gpPlay => (
                            <tr key={gpPlay.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  value={gpPlay.call_number}
                                  onChange={(e) => handleUpdateCallNumber(gpPlay.id, parseInt(e.target.value) || 1)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                  min="1"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {gpPlay.play_code}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {gpPlay.play?.play_name || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {gpPlay.play?.attributes?.formation || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {gpPlay.play?.attributes?.playType || gpPlay.play?.attributes?.coverage || '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleRemoveFromGamePlan(gpPlay.id)}
                                  className="text-sm text-red-600 hover:text-red-700 font-medium"
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
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Game Plan Modal */}
      {showCreateGamePlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Create Game Plan</h3>
            <p className="text-gray-600 mb-6">
              {selectedPlayCodes.size} play{selectedPlayCodes.size !== 1 ? 's' : ''} selected
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Plan Name
              </label>
              <input
                type="text"
                value={newGamePlanName}
                onChange={(e) => setNewGamePlanName(e.target.value)}
                placeholder="e.g., Week 5 vs Eagles"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateGamePlan}
                className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Create Game Plan
              </button>
              <button
                onClick={() => {
                  setShowCreateGamePlanModal(false);
                  setNewGamePlanName('');
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
