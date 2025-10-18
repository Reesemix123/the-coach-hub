'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: any;
  created_at: string;
}

export default function SetupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamLevel, setTeamLevel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        setTeams(data || []);
      }
      setLoading(false);
    }
    checkUser();
  }, []);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    
    if (!teamName.trim()) {
      setMessage('Please enter a team name');
      return;
    }

    const { data, error } = await supabase
      .from('teams')
      .insert([{ 
        name: teamName.trim(), 
        level: teamLevel.trim() || 'High School',
        colors: { primary: 'Blue', secondary: 'White' },
        user_id: user?.id 
      }])
      .select()
      .single();

    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('');
      setTeamName('');
      setTeamLevel('');
      setShowForm(false);
      const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
      setTeams(updatedTeams || []);
    }
  }

  async function deleteTeam(teamId: string, teamName: string) {
    if (!confirm(`Are you sure you want to delete ${teamName}?`)) return;

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      alert('Error deleting team: ' + error.message);
    } else {
      const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
      setTeams(updatedTeams || []);
    }
  }

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
          <p className="text-gray-600 mb-8">Create and manage your teams.</p>
          <Link 
            href="/auth/login"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-semibold text-gray-900 mb-3">Teams</h1>
          <p className="text-xl text-gray-600">Organize and manage your coaching teams.</p>
        </div>

        {/* Create Team Section */}
        {!showForm ? (
          <div className="max-w-2xl mx-auto mb-16">
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-6 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
            >
              + Create New Team
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto mb-16 bg-gray-50 rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create New Team</h2>
            
            <form onSubmit={createTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Varsity Football"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level
                </label>
                <select
                  value={teamLevel}
                  onChange={(e) => setTeamLevel(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
                >
                  <option value="">Select level...</option>
                  <option value="Youth">Youth</option>
                  <option value="Middle School">Middle School</option>
                  <option value="JV">JV</option>
                  <option value="Varsity">Varsity</option>
                  <option value="College">College</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setTeamName('');
                    setTeamLevel('');
                    setMessage('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Create Team
                </button>
              </div>
            </form>
            
            {message && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                {message}
              </div>
            )}
          </div>
        )}

        {/* Teams List */}
        {teams.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <p className="text-2xl font-semibold text-gray-900 mb-3">No teams yet</p>
              <p className="text-gray-600 mb-8">Create your first team to get started.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Teams</h2>
              
              <div className="space-y-4">
                {teams.map((team) => (
                  <div 
                    key={team.id} 
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{team.level || 'High School'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/teams/${team.id}`}
                          className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => deleteTeam(team.id, team.name)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="max-w-4xl mx-auto border-t border-gray-200 pt-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Link 
                  href="/playbook"
                  className="block px-6 py-4 text-center bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Manage Playbook
                </Link>
                <Link 
                  href="/film"
                  className="block px-6 py-4 text-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Manage Film
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}