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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsOwner(false);
        setLoading(false);
        return;
      }

      // Check if user owns any teams
      const { data: teams, error } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      console.log('ConsoleLink - Checking ownership:', { userId: user.id, teamsCount: teams?.length, error });

      setIsOwner(!error && teams !== null && teams.length > 0);
    } catch (error) {
      console.error('ConsoleLink - Error checking ownership:', error);
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
      className={`text-gray-800 hover:text-black font-medium text-lg transition-colors ${
        pathname === '/console' ? 'text-black' : ''
      }`}
    >
      Console
    </Link>
  );
}
