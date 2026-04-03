'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  MessageCircle,
  PlayCircle,
  MoreHorizontal,
  Users,
  Settings,
  LogOut,
  X,
  UserCircle,
  LayoutDashboard,
  HelpCircle,
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
  hasCoachProfile: boolean;
}

interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string | null;
  isActive: (pathname: string) => boolean;
}

export function BottomTabBar({ teamId: defaultTeamId, teams, parentName, athleteProfileId: initialAthleteId, athleteName, hasCoachProfile }: BottomTabBarProps) {
  const pathname = usePathname();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [athleteProfileId, setAthleteProfileId] = useState(initialAthleteId);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fallback: if server didn't provide athleteProfileId, fetch it client-side
  useEffect(() => {
    if (athleteProfileId) return;
    fetch('/api/parent/athlete-profile-id')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.athleteProfileId) setAthleteProfileId(data.athleteProfileId);
      })
      .catch(() => {});
  }, [athleteProfileId]);

  // Derive active teamId from the current URL, or fall back to default
  const urlTeamMatch = pathname.match(/\/parent\/teams\/([^/]+)/);
  const activeTeamId = urlTeamMatch ? urlTeamMatch[1] : defaultTeamId;
  const teamId = activeTeamId;

  // Poll unread count every 30 seconds for Messages badge
  useEffect(() => {
    if (!teamId) return;

    async function fetchUnread() {
      try {
        const res = await fetch(`/api/parent/unread-count?teamId=${teamId}`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.total ?? 0);
        }
      } catch {}
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [teamId]);

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
      isActive: (p) => p.includes('/messages') || p.includes('/announcements'),
    },
    {
      key: 'media',
      label: 'Media',
      icon: PlayCircle,
      href: teamId ? `/parent/teams/${teamId}/media` : null,
      isActive: (p) => p.includes('/media') || p.includes('/videos') || p.includes('/reports'),
    },
    {
      key: 'player-profile',
      label: 'Player Profile',
      icon: UserCircle,
      href: athleteProfileId
        ? `/parent/athletes/${athleteProfileId}`
        : '/parent/athletes/new',
      isActive: (p) => p.includes('/athletes'),
    },
  ];

  const moreIsActive =
    pathname.includes('/directory') ||
    pathname.includes('/settings') ||
    pathname.startsWith('/parent/guide');

  const moreMenuItems = [
    {
      key: 'directory',
      label: 'Directory',
      icon: Users,
      href: teamId ? `/parent/teams/${teamId}/directory` : null,
    },
    {
      key: 'guide',
      label: 'Help Guide',
      icon: HelpCircle,
      href: '/parent/guide',
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

            const badge = key === 'messages' && unreadCount > 0 ? (
              <span className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null;

            if (!href) {
              return (
                <button
                  key={key}
                  disabled
                  aria-label={`${label} — no team selected`}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-300 cursor-not-allowed"
                >
                  <div className="relative">
                    <Icon size={24} strokeWidth={active ? 2.5 : 1.75} />
                    {badge}
                  </div>
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
                <div className="relative">
                  <Icon
                    size={24}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  {badge}
                </div>
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
              {hasCoachProfile && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={closeMoreMenu}
                    className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl transition-colors hover:bg-gray-50"
                    style={{ color: '#B8CA6E' }}
                  >
                    <LayoutDashboard size={20} strokeWidth={1.75} />
                    <span className="text-[15px] font-medium">Switch to coach view</span>
                  </Link>
                  <div className="mx-2 my-1 border-t border-gray-100" />
                </>
              )}
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
