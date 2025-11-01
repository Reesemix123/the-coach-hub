'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { PlayBuilder } from '@/components/playbuilder';

interface Team {
  id: string;
  name: string;
  level: string;
}

interface Play {
  id: string;
  play_code: string;
  play_name: string;
  attributes: {
    odk: 'offense' | 'defense' | 'specialTeams';
    formation: string;
    playType?: string;
    coverage?: string;
    blitzType?: string;
    unit?: string;
    targetHole?: string;
    ballCarrier?: string;
    customTags?: string[];
  };
  diagram: any;
  comments?: string;
  created_at: string;
  updated_at: string;
}

export default function PlaybookPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [plays, setPlays] = useState<Play[]>([]);
  const [filteredPlays, setFilteredPlays] = useState<Play[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterODK, setFilterODK] = useState<string>('all');
  const [filterFormation, setFilterFormation] = useState<string>('all');

  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get('teamId');
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Auth error:', error);
          return;
        }
        
        setUser(user);
        if (user) {
          await fetchTeams();
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    checkUser();
  }, []);

  // Auto-select team from query param when teams are loaded
  useEffect(() => {
    if (preselectedTeamId && teams.length > 0 && !selectedTeamId) {
      // Verify the team exists in user's teams
      const teamExists = teams.some(team => team.id === preselectedTeamId);
      if (teamExists) {
        setSelectedTeamId(preselectedTeamId);
      }
    }
  }, [teams, preselectedTeamId]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchPlays();
    } else {
      setPlays([]);
      setFilteredPlays([]);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    applyFilters();
  }, [plays, searchTerm, filterODK, filterFormation]);

  async function fetchTeams() {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, level')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching teams:', error);
      } else {
        setTeams(data || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }

  async function fetchPlays() {
    try {
      const { data, error } = await supabase
        .from('playbook_plays')
        .select('*')
        .eq('team_id', selectedTeamId === 'personal' ? null : selectedTeamId)
        .eq('is_archived', false)
        .order('play_code', { ascending: true });

      if (error) {
        console.error('Error fetching plays:', error);
      } else {
        setPlays(data || []);
      }
    } catch (error) {
      console.error('Error fetching plays:', error);
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

  async function handleDeletePlay(playId: string) {
    if (!confirm('Are you sure you want to delete this play?')) return;

    try {
      const { error } = await supabase
        .from('playbook_plays')
        .delete()
        .eq('id', playId);

      if (error) throw error;

      await fetchPlays();
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

      await fetchPlays();
    } catch (error) {
      console.error('Error archiving play:', error);
      alert('Error archiving play');
    }
  }

  function handleEditPlay(play: Play) {
    setEditingPlay(play);
    setShowBuilder(true);
  }

  function handleNewPlay() {
    setEditingPlay(null);
    setShowBuilder(true);
  }

  function handleBackToPlaybook() {
    // If came from team-specific page, return there
    if (preselectedTeamId) {
      router.push(`/teams/${preselectedTeamId}/playbook`);
    } else {
      // Stay on global playbook page
      setShowBuilder(false);
      setEditingPlay(null);
      fetchPlays();
    }
  }

  const uniqueFormations = Array.from(
    new Set(plays.map(p => p.attributes?.formation).filter(Boolean))
  ).sort();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamName = selectedTeamId === 'personal' ? 'Personal Playbook' : selectedTeam?.name;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
          <p className="text-gray-600 mb-8">Access your playbook and manage your plays.</p>
          <a 
            href="/auth/login"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  // PLAY BUILDER VIEW
  if (showBuilder) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto py-6 px-4">
          {/* Back Button */}
          <button
            onClick={handleBackToPlaybook}
            className="mb-6 px-4 py-2 text-gray-700 hover:text-black font-medium flex items-center space-x-2 transition-colors"
          >
            <span>←</span>
            <span>Back to Playbook</span>
          </button>
          
          <PlayBuilder 
            teamId={selectedTeamId || 'personal'} 
            teamName={teamName}
            existingPlay={editingPlay}
            onSave={handleBackToPlaybook}
          />
        </div>
      </div>
    );
  }

  // PLAYBOOK VIEW
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-semibold text-gray-900 mb-3">Playbook</h1>
          <p className="text-xl text-gray-600">Your plays, organized.</p>
        </div>

        {/* Team Selection */}
        {!selectedTeamId ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-50 rounded-2xl p-12 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Select a team</h2>
              <p className="text-gray-600 mb-8">Choose which playbook you'd like to view.</p>
              
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full max-w-md mx-auto px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900 text-lg"
              >
                <option value="">Choose team...</option>
                <option value="personal">Personal Playbook</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.level})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            {/* Team Header with Create Button */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-3xl font-semibold text-gray-900">{teamName}</h2>
                <p className="text-gray-600 mt-1">{plays.length} plays</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedTeamId('')}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition-colors"
                >
                  Change Team
                </button>
                <button
                  onClick={handleNewPlay}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  + New Play
                </button>
              </div>
            </div>

            {/* Filters */}
            {plays.length > 0 && (
              <div className="mb-8 flex items-center space-x-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search plays..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
                />
                
                <select
                  value={filterODK}
                  onChange={(e) => setFilterODK(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
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

            {/* Empty State */}
            {plays.length === 0 ? (
              <div className="text-center py-20">
                <div className="max-w-md mx-auto">
                  <p className="text-2xl font-semibold text-gray-900 mb-3">No plays yet</p>
                  <p className="text-gray-600 mb-8">Create your first play to get started.</p>
                  <button
                    onClick={handleNewPlay}
                    className="px-8 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
                  >
                    Create First Play
                  </button>
                </div>
              </div>
            ) : filteredPlays.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600">No plays match your filters.</p>
              </div>
            ) : (
              /* Plays Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlays.map(play => (
                  <div 
                    key={play.id} 
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-all cursor-pointer"
                    onClick={() => handleEditPlay(play)}
                  >
                    {/* Play Header */}
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

                    {/* Actions */}
                    <div className="p-4 bg-gray-50 flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPlay(play);
                        }}
                        className="text-sm text-gray-700 hover:text-black font-medium transition-colors"
                      >
                        Edit
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
      </div>
    </div>
  );
}