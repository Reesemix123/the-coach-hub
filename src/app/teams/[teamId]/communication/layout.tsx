'use client';

import { use } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell, Calendar, Users, CreditCard } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}

const tabs = [
  { label: 'Announcements', href: 'announcements', icon: Bell },
  { label: 'Calendar', href: 'calendar', icon: Calendar },
  { label: 'Parents', href: 'parents', icon: Users },
  { label: 'Plan', href: 'plan', icon: CreditCard },
];

export default function CommunicationLayout({ children, params }: LayoutProps) {
  const { teamId } = use(params);
  const pathname = usePathname();

  return (
    <div>
      {/* Sub-navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Communication sections">
            {tabs.map((tab) => {
              const href = `/teams/${teamId}/communication/${tab.href}`;
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
