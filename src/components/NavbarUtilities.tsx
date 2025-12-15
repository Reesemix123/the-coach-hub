'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { FeedbackButton } from '@/components/feedback';
import { NotificationsBell } from '@/components/notifications';

export function NavbarUtilities() {
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/guide"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Guide"
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">How To</span>
      </Link>
      <FeedbackButton />
      <NotificationsBell />
    </div>
  );
}

export default NavbarUtilities;
