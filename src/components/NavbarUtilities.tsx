'use client';

import { FeedbackButton } from '@/components/feedback';
import { NotificationsBell } from '@/components/notifications';
import { GuideDropdown } from '@/components/guide';

export function NavbarUtilities() {
  return (
    <div className="flex items-center gap-1">
      <GuideDropdown />
      <FeedbackButton />
      <NotificationsBell />
    </div>
  );
}

export default NavbarUtilities;
