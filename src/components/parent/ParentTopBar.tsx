'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

interface TeamInfo {
  id: string;
  name: string;
}

interface ParentTopBarProps {
  parentName: string;
  teams: TeamInfo[];
  defaultTeamId: string | null;
}

export function ParentTopBar({ parentName, teams, defaultTeamId }: ParentTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive the active teamId from the current URL, falling back to the default
  const urlTeamMatch = pathname.match(/\/parent\/teams\/([^/]+)/);
  const activeTeamId = urlTeamMatch ? urlTeamMatch[1] : defaultTeamId;
  const activeTeam = teams.find(t => t.id === activeTeamId);

  const toggleDropdown = useCallback(() => setDropdownOpen(prev => !prev), []);
  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, closeDropdown]);

  function handleTeamSelect(teamId: string) {
    closeDropdown();

    // Replace the teamId segment in the current path, or navigate to messages
    // as the default landing page for a team
    const newPath = pathname.replace(
      /\/parent\/teams\/[^/]+/,
      `/parent/teams/${teamId}`
    );

    if (newPath !== pathname) {
      router.push(newPath);
    } else {
      // Current path has no team segment — navigate to messages for that team
      router.push(`/parent/teams/${teamId}/messages`);
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between h-12 px-4">
        {/* Left: Logo */}
        <Image
          src="/apple-touch-icon.png"
          alt="Youth Coach Hub"
          width={28}
          height={28}
          className="rounded-lg flex-shrink-0"
        />

        {/* Right: Parent name + team switcher */}
        <div className="flex flex-col items-end" ref={dropdownRef}>
          <span className="text-sm font-semibold text-gray-900 leading-tight">
            {parentName}
          </span>

          {teams.length > 1 ? (
            /* Team name is a dropdown trigger when there are multiple teams */
            <div className="relative">
              <button
                onClick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                aria-label="Switch team"
                className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span>{activeTeam?.name ?? 'Select team'}</span>
                <ChevronDown
                  size={12}
                  className={['transition-transform duration-150', dropdownOpen ? 'rotate-180' : ''].join(' ')}
                />
              </button>

              {dropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Teams"
                  className="absolute right-0 top-full mt-1.5 min-w-[180px] bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50"
                >
                  {teams.map(team => {
                    const isActive = team.id === activeTeamId;
                    return (
                      <button
                        key={team.id}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleTeamSelect(team.id)}
                        className={[
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {team.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{team.name}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-black flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Single team — display name only, no interaction */
            <span className="text-xs text-gray-500 leading-tight">
              {activeTeam?.name ?? ''}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
