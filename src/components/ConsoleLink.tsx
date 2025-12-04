'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ConsoleLink() {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    checkIfOwner();
  }, []);

  async function checkIfOwner() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.log('ConsoleLink: No authenticated user', { authError });
        setIsOwner(false);
        setLoading(false);
        return;
      }

      console.log('ConsoleLink: Checking ownership for user', user.id);

      // Check if user owns any teams
      const { data: teams, error } = await supabase
        .from('teams')
        .select('id, user_id')
        .eq('user_id', user.id)
        .limit(1);

      console.log('ConsoleLink: Teams query result', { teams, error, userId: user.id });

      if (error) {
        console.log('ConsoleLink: Teams query error, trying memberships', error);
        // Even if query fails, still check team_memberships as fallback
        const { data: memberships, error: membershipError } = await supabase
          .from('team_memberships')
          .select('team_id, role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        console.log('ConsoleLink: Memberships result', { memberships, membershipError });
        setIsOwner(memberships !== null && memberships.length > 0);
      } else {
        const hasTeams = teams !== null && teams.length > 0;
        console.log('ConsoleLink: Setting isOwner to', hasTeams);
        setIsOwner(hasTeams);
      }
    } catch (error) {
      console.error('ConsoleLink: Error checking team ownership:', error);
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  }

  // Show loading state or hide while checking
  if (loading) {
    return null;
  }

  if (!isOwner) {
    return null;
  }

  return (
    <Link
      href="/console"
      className={`text-gray-600 hover:text-black font-medium text-sm transition-colors ${
        pathname === '/console' ? 'text-black' : ''
      }`}
    >
      Console
    </Link>
  );
}
