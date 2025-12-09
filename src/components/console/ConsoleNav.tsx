'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  BarChart3,
  CreditCard
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  match?: string[]; // Additional paths that should mark this tab as active
}

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: '/console',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: 'Teams',
    href: '/console/teams',
    icon: <Users className="w-4 h-4" />,
    match: ['/console/teams'],
  },
  {
    label: 'People',
    href: '/console/people',
    icon: <UserCircle className="w-4 h-4" />,
  },
  {
    label: 'Usage',
    href: '/console/usage',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    label: 'Billing',
    href: '/console/billing',
    icon: <CreditCard className="w-4 h-4" />,
  },
];

export default function ConsoleNav() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    // Exact match for /console
    if (item.href === '/console') {
      return pathname === '/console';
    }
    // Check if current path starts with the href
    if (pathname.startsWith(item.href)) {
      return true;
    }
    // Check additional match paths
    if (item.match) {
      return item.match.some(path => pathname.startsWith(path));
    }
    return false;
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 -mb-px">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${active
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
