'use client';

import { FeedbackButton } from '@/components/feedback';
import { NotificationsBell } from '@/components/notifications';

export function NavbarUtilities() {
  return (
    <div className="flex items-center gap-1">
      <FeedbackButton />
      <NotificationsBell />
    </div>
  );
}

export default NavbarUtilities;
