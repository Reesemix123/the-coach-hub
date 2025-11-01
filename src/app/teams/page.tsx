'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';

interface TeamWithMembership {
  team: {
    id: string;
    name: string;
    level: string;
  };
  membership: {
    role: string;
  };
}

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState<TeamWithMembership[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const membershipService = new TeamMembershipService();

  useEffect(() => {
    checkUserAndRedirect();
  }, []);

  async function checkUserAndRedirect() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Get all teams user has access to (owned or invited)
    const teams = await membershipService.getUserTeams(user.id);

    // Also check for teams where user is the owner
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, level')
      .eq('user_id', user.id);

    // Combine owned teams with membership teams
    const allTeams = [
      ...(ownedTeams || []).map(team => ({
        team,
        membership: { role: 'owner' }
      })),
      ...teams
    ];

    // Remove duplicates by team id
    const uniqueTeams = Array.from(
      new Map(allTeams.map(item => [item.team.id, item])).values()
    );

    setUserTeams(uniqueTeams);
    setIsOwner((ownedTeams || []).length > 0);

    // Smart routing
    if (uniqueTeams.length === 1) {
      // Single team - redirect directly
      router.push(`/teams/${uniqueTeams[0].team.id}`);
    } else if (uniqueTeams.length === 0) {
      // No teams
      if (ownedTeams && ownedTeams.length === 0) {
        // Check if they're an owner (have created teams before)
        // If they might be an owner, send to console
        router.push('/console');
      }
      // Otherwise stay on this page and show "no teams" message
      setLoading(false);
    } else {
      // Multiple teams - show switcher
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Select Team</h1>
            <p className="mt-2 text-gray-600">Choose a team to view</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12">
          {userTeams.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-lg mb-4">No teams yet</div>
              <p className="text-gray-600 mb-8">
                {isOwner
                  ? 'Create your first team in the Console.'
                  : 'Ask your coach to invite you to a team.'}
              </p>
              {isOwner && (
                <button
                  onClick={() => router.push('/console')}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Go to Console
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {userTeams.map(({ team, membership }) => (
                <button
                  key={team.id}
                  onClick={() => router.push(`/teams/${team.id}`)}
                  className="w-full border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{team.level}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full capitalize">
                        {membership.role}
                      </span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
