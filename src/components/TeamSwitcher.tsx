'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { useRouter, usePathname } from 'next/navigation';

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

export default function TeamSwitcher() {
  const [teams, setTeams] = useState<TeamWithMembership[]>([]);
  const [currentTeam, setCurrentTeam] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const membershipService = new TeamMembershipService();

  useEffect(() => {
    fetchTeams();

    // Extract team ID from pathname if on a team page
    const match = pathname.match(/\/teams\/([^\/]+)/);
    if (match) {
      setCurrentTeam(match[1]);
    }
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchTeams() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get teams from memberships
    const memberTeams = await membershipService.getUserTeams(user.id);

    // Get owned teams
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, level')
      .eq('user_id', user.id);

    // Combine and deduplicate
    const allTeams = [
      ...(ownedTeams || []).map(team => ({
        team,
        membership: { role: 'owner' }
      })),
      ...memberTeams
    ];

    const uniqueTeams = Array.from(
      new Map(allTeams.map(item => [item.team.id, item])).values()
    );

    setTeams(uniqueTeams);
    setLoading(false);
  }

  if (loading || teams.length <= 1) {
    return null; // Don't show switcher if only one team or loading
  }

  const currentTeamData = teams.find(t => t.team.id === currentTeam);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-gray-800 hover:text-black font-medium text-lg transition-colors"
      >
        <span>{currentTeamData ? currentTeamData.team.name : 'Teams'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Switch Team
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {teams.map(({ team, membership }) => (
              <button
                key={team.id}
                onClick={() => {
                  router.push(`/teams/${team.id}`);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  currentTeam === team.id ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{team.name}</div>
                    <div className="text-sm text-gray-600">{team.level}</div>
                  </div>
                  {currentTeam === team.id && (
                    <svg className="w-5 h-5 text-black flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-2">
            <button
              onClick={() => {
                router.push('/teams');
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="font-medium">View All Teams</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
