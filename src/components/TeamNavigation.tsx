// src/components/TeamNavigation.tsx
'use client';

import { useRouter } from 'next/navigation';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface TeamNavigationProps {
  team: Team;
  teamId: string;
  currentPage: 'dashboard' | 'game-week' | 'schedule' | 'playbook' | 'film' | 'analytics' | 'metrics' | 'players' | 'practice' | 'settings';
  wins?: number;
  losses?: number;
  ties?: number;
}

export default function TeamNavigation({
  team,
  teamId,
  currentPage,
  wins = 0,
  losses = 0,
  ties = 0
}: TeamNavigationProps) {
  const router = useRouter();

  const showRecord = wins !== undefined || losses !== undefined;
  const winPercentage = wins + losses > 0
    ? ((wins / (wins + losses)) * 100).toFixed(0)
    : '0';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: `/teams/${teamId}` },
    { id: 'schedule', label: 'Schedule', path: `/teams/${teamId}/schedule` },
    { id: 'players', label: 'Players', path: `/teams/${teamId}/players` },
    { id: 'playbook', label: 'Playbook', path: `/teams/${teamId}/playbook` },
    { id: 'practice', label: 'Practice', path: `/teams/${teamId}/practice` },
    { id: 'film', label: 'Film', path: `/teams/${teamId}/film` },
    { id: 'analytics', label: 'Analytics', path: `/teams/${teamId}/analytics-advanced` },
    { id: 'metrics', label: 'Metrics', path: `/teams/${teamId}/metrics` },
    { id: 'game-week', label: 'Game Week', path: `/teams/${teamId}/game-week` },
    { id: 'settings', label: 'Settings', path: `/teams/${teamId}/settings` }
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Team Info Bar */}
        <div className="flex items-center justify-between py-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-lg"
              style={{ backgroundColor: team.colors?.primary || '#000000' }}
            />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{team.name}</h1>
              <p className="text-sm text-gray-600">{team.level}</p>
            </div>
          </div>
          {showRecord && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">
                  {`${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`}
                </div>
                <div className="text-xs text-gray-500">{winPercentage}% Win Rate</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`py-4 text-base font-medium transition-colors ${
                currentPage === item.id
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
