'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ConsoleLink() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    // Check initial auth state
    checkIfOwner(supabase);

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ConsoleLink] Auth state changed:', event, session?.user?.email);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkIfOwner(supabase);
      } else if (event === 'SIGNED_OUT') {
        setIsOwner(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkIfOwner(supabase: ReturnType<typeof createClient>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[ConsoleLink] User:', user?.email);

      // Not signed in - just hide, no error
      if (!user) {
        console.log('[ConsoleLink] No user, hiding');
        setIsOwner(false);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      console.log('[ConsoleLink] Teams:', teams, 'Error:', teamsError);

      if (teamsError) {
        // Fallback to team_memberships
        const { data: memberships } = await supabase
          .from('team_memberships')
          .select('team_id, role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        console.log('[ConsoleLink] Memberships fallback:', memberships);
        const hasOwnership = memberships !== null && memberships.length > 0;
        console.log('[ConsoleLink] Setting isOwner to:', hasOwnership);
        setIsOwner(hasOwnership);
      } else {
        const hasTeams = teams !== null && teams.length > 0;
        console.log('[ConsoleLink] Setting isOwner to:', hasTeams);
        setIsOwner(hasTeams);
      }
    } catch (err) {
      // Silently fail - don't show error for unauthenticated users
      console.log('[ConsoleLink] Catch error:', err);
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
