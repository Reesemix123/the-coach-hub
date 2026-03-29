'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  MessageCircle,
  Video,
  MoreHorizontal,
  Bell,
  FileText,
  Users,
  Settings,
  LogOut,
  X,
  UserCircle,
} from 'lucide-react';

interface TeamInfo {
  id: string;
  name: string;
}

interface BottomTabBarProps {
  teamId: string | null;
  teams: TeamInfo[];
  parentName: string;
  athleteProfileId: string | null;
  athleteName: string | null;
}

interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string | null;
  isActive: (pathname: string) => boolean;
}

export function BottomTabBar({ teamId: defaultTeamId, teams, parentName, athleteProfileId, athleteName }: BottomTabBarProps) {
  const pathname = usePathname();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Derive active teamId from the current URL, or fall back to default
  const urlTeamMatch = pathname.match(/\/parent\/teams\/([^/]+)/);
  const activeTeamId = urlTeamMatch ? urlTeamMatch[1] : defaultTeamId;
  const teamId = activeTeamId;

  const openMoreMenu = useCallback(() => setMoreMenuOpen(true), []);
  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);

  const tabs: TabItem[] = [
    {
      key: 'schedule',
      label: 'Schedule',
      icon: Calendar,
      href: teamId ? `/parent/teams/${teamId}/calendar` : null,
      isActive: (p) => p.includes('/calendar'),
    },
    {
      key: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      href: teamId ? `/parent/teams/${teamId}/messages` : null,
      isActive: (p) => p.includes('/messages'),
    },
    {
      key: 'videos',
      label: 'Videos',
      icon: Video,
      href: teamId ? `/parent/teams/${teamId}/videos` : null,
      isActive: (p) => p.includes('/videos'),
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: FileText,
      href: teamId ? `/parent/teams/${teamId}/reports` : null,
      isActive: (p) => p.includes('/reports'),
    },
    {
      key: 'directory',
      label: 'Directory',
      icon: Users,
      href: teamId ? `/parent/teams/${teamId}/directory` : null,
      isActive: (p) => p.includes('/directory'),
    },
    {
      key: 'player',
      label: 'Player',
      icon: UserCircle,
      href: athleteProfileId
        ? `/parent/athletes/${athleteProfileId}`
        : '/parent/athletes/new',
      isActive: (p) => p.includes('/athletes'),
    },
  ];

  const moreIsActive =
    pathname.includes('/announcements') ||
    pathname.includes('/settings');

  const moreMenuItems = [
    {
      key: 'announcements',
      label: 'Announcements',
      icon: Bell,
      href: teamId ? `/parent/teams/${teamId}/announcements` : null,
    },
    {
      key: 'athlete-profile',
      label: athleteProfileId
        ? `${athleteName ?? 'My Athlete'}'s Profile`
        : 'Set up athlete profile',
      icon: UserCircle,
      href: athleteProfileId
        ? `/parent/athletes/${athleteProfileId}`
        : '/parent/athletes/new',
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/parent/settings',
    },
  ];

  return (
    <>
      {/* Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main navigation"
      >
        <div className="flex items-stretch h-[60px]">
          {/* Standard tabs */}
          {tabs.map(({ key, label, icon: Icon, href, isActive }) => {
            const active = isActive(pathname);

            if (!href) {
              return (
                <button
                  key={key}
                  disabled
                  aria-label={`${label} — no team selected`}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-300 cursor-not-allowed"
                >
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.75} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={key}
                href={href}
                className={[
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                  active ? 'text-black' : 'text-gray-400 hover:text-gray-600',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  size={24}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span className={['text-[10px] font-medium', active ? 'text-black' : 'text-gray-400'].join(' ')}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={openMoreMenu}
            aria-haspopup="dialog"
            aria-expanded={moreMenuOpen}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              moreIsActive ? 'text-black' : 'text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            <MoreHorizontal
              size={24}
              strokeWidth={moreIsActive ? 2.5 : 1.75}
            />
            <span className={['text-[10px] font-medium', moreIsActive ? 'text-black' : 'text-gray-400'].join(' ')}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {moreMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={closeMoreMenu}
            aria-hidden="true"
          />

          {/* Slide-up sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/apple-touch-icon.png"
                  alt="Youth Coach Hub"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                <div>
                  <p className="text-xs text-gray-500 leading-none">Signed in as</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{parentName}</p>
                </div>
              </div>
              <button
                onClick={closeMoreMenu}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu items */}
            <nav className="px-3 py-2">
              {moreMenuItems.map(({ key, label, icon: Icon, href }) => {
                if (!href) {
                  return (
                    <button
                      key={key}
                      disabled
                      className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-300 cursor-not-allowed"
                    >
                      <Icon size={20} strokeWidth={1.75} />
                      <span className="text-[15px] font-medium">{label}</span>
                      <span className="ml-auto text-xs text-gray-300">No team</span>
                    </button>
                  );
                }

                const isCurrentPage = pathname.includes(`/${key}`);

                return (
                  <Link
                    key={key}
                    href={href}
                    onClick={closeMoreMenu}
                    className={[
                      'flex items-center gap-3.5 px-3 py-3.5 rounded-xl transition-colors',
                      isCurrentPage
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                    ].join(' ')}
                  >
                    <Icon size={20} strokeWidth={isCurrentPage ? 2.25 : 1.75} />
                    <span className="text-[15px] font-medium">{label}</span>
                    {isCurrentPage && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Divider + Sign out */}
            <div className="mx-3 mb-3 border-t border-gray-100 pt-2">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} strokeWidth={1.75} />
                  <span className="text-[15px] font-medium">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
