// src/app/teams/[teamId]/practice/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import TeamNavigation from '@/components/TeamNavigation';
import type { PracticePlan } from '@/types/football';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

export default function PracticePlansPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [practices, setPractices] = useState<PracticePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'templates' | 'all'>('upcoming');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  async function fetchData() {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      setTeam(teamData);

      // Fetch practice plans
      const { data: practicesData } = await supabase
        .from('practice_plans')
        .select('*')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      setPractices(practicesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getFilteredPractices = () => {
    const today = new Date().toISOString().split('T')[0];

    if (filter === 'templates') {
      return practices.filter(p => p.is_template);
    } else if (filter === 'upcoming') {
      return practices.filter(p => !p.is_template && p.date >= today);
    } else if (filter === 'past') {
      return practices.filter(p => !p.is_template && p.date < today);
    }
    return practices.filter(p => !p.is_template);
  };

  const handleDeletePractice = async (practiceId: string) => {
    if (!confirm('Are you sure you want to delete this practice plan?')) return;

    try {
      const { error } = await supabase
        .from('practice_plans')
        .delete()
        .eq('id', practiceId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting practice:', error);
      alert('Error deleting practice plan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading practice plans...</div>
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

  const filteredPractices = getFilteredPractices();
  const upcomingCount = practices.filter(p => !p.is_template && p.date >= new Date().toISOString().split('T')[0]).length;
  const pastCount = practices.filter(p => !p.is_template && p.date < new Date().toISOString().split('T')[0]).length;
  const templateCount = practices.filter(p => p.is_template).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="practice"
      />

      {/* Practice Plans Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Practice Plans</h1>
            <p className="text-gray-600 mt-2">Plan and organize your practice sessions</p>
          </div>
          <button
            onClick={() => router.push(`/teams/${teamId}/practice/new`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            + Create Practice Plan
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setFilter('upcoming')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'upcoming' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upcoming ({upcomingCount})
            {filter === 'upcoming' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'past' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Past ({pastCount})
            {filter === 'past' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setFilter('templates')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'templates' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Templates ({templateCount})
            {filter === 'templates' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              filter === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All ({practices.filter(p => !p.is_template).length})
            {filter === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
        </div>

        {/* Practice Plans List */}
        {filteredPractices.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-lg">
            <div className="text-6xl mb-4">📋</div>
            <div className="text-gray-400 mb-4 text-lg">
              {filter === 'templates' ? 'No practice templates yet' :
               filter === 'upcoming' ? 'No upcoming practices scheduled' :
               filter === 'past' ? 'No past practices' :
               'No practice plans yet'}
            </div>
            <p className="text-gray-500 text-sm mb-6">
              Create practice plans to organize your practice sessions
            </p>
            <button
              onClick={() => router.push(`/teams/${teamId}/practice/new`)}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Create Your First Practice Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPractices.map((practice) => (
              <div
                key={practice.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {practice.title}
                        </h3>
                        {practice.is_template && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 border border-purple-200">
                            Template
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>📅 {new Date(practice.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                        <span>⏱️ {practice.duration_minutes} min</span>
                      </div>
                      {practice.location && (
                        <div className="text-sm text-gray-600 mt-1">
                          📍 {practice.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {practice.notes && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {practice.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/teams/${teamId}/practice/${practice.id}`)}
                      className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      View Plan
                    </button>
                    <button
                      onClick={() => handleDeletePractice(practice.id)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
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
  );
}
