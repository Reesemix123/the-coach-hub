'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ConsoleLink() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    checkIfOwner();
  }, []);

  async function checkIfOwner() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Not signed in - just hide, no error
      if (!user) {
        setIsOwner(false);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (teamsError) {
        // Fallback to team_memberships
        const { data: memberships } = await supabase
          .from('team_memberships')
          .select('team_id, role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        setIsOwner(memberships !== null && memberships.length > 0);
      } else {
        setIsOwner(teams !== null && teams.length > 0);
      }
    } catch {
      // Silently fail - don't show error for unauthenticated users
      setIsOwner(false);
    }
  }

  // Hide while loading or if not owner
  if (isOwner !== true) {
    return null;
  }
  return (
    <Link
      href="/console"
      className={`text-gray-700 hover:text-black font-semibold text-sm ${
        pathname === '/console' ? 'text-black' : ''
      }`}
    >
      Console
    </Link>
  );
}
