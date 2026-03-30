'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, Film, FileText, ChevronLeft } from 'lucide-react';

interface PlayersSubNavProps {
  teamId: string;
  pendingClipCount: number;
  unpublishedReportCount: number;
}

const tabs = [
  { label: 'Roster', href: '', icon: Users },
  { label: 'Clip Review', href: '/clips', icon: Film, countKey: 'clips' as const },
  { label: 'Reports', href: '/reports', icon: FileText, countKey: 'reports' as const },
];

export function PlayersSubNav({
  teamId,
  pendingClipCount,
  unpublishedReportCount,
}: PlayersSubNavProps) {
  const pathname = usePathname();
  const basePath = `/football/teams/${teamId}/players`;

  const counts = {
    clips: pendingClipCount,
    reports: unpublishedReportCount,
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4">
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Players sections">
          <Link
            href={`/football/teams/${teamId}`}
            className="flex items-center gap-1 px-3 py-3 text-sm font-medium text-gray-400 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" />
            Team
          </Link>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          {tabs.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const isActive = tab.href === ''
              ? pathname === basePath || pathname === `${basePath}/`
              : pathname.startsWith(href);
            const Icon = tab.icon;
            const count = tab.countKey ? counts[tab.countKey] : 0;

            return (
              <Link
                key={tab.label}
                href={href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
