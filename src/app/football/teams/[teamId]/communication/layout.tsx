'use client';

import { use } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Users, CreditCard, MessageSquare, Video, FileText, Settings, ChevronLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}

const tabs = [
  { label: 'Messages', href: 'messages', icon: MessageSquare },
  { label: 'Schedule', href: 'calendar', icon: Calendar },
  { label: 'Videos', href: 'videos', icon: Video },
  { label: 'Reports', href: 'reports', icon: FileText },
  { label: 'Parents', href: 'parents', icon: Users },
  { label: 'Plan', href: 'plan', icon: CreditCard },
  { label: 'Settings', href: 'settings', icon: Settings },
];

export default function CommunicationLayout({ children, params }: LayoutProps) {
  const { teamId } = use(params);
  const pathname = usePathname();

  return (
    <div>
      {/* Sub-navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Communication sections">
            <Link
              href={`/football/teams/${teamId}`}
              className="flex items-center gap-1 px-3 py-3 text-sm font-medium text-gray-400 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" />
              Team
            </Link>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            {tabs.map((tab) => {
              const href = `/football/teams/${teamId}/communication/${tab.href}`;
              const isActive = pathname.startsWith(href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
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
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
