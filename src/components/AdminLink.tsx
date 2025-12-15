'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLink() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    // Check initial auth state
    checkIfAdmin(supabase);

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AdminLink] Auth state changed:', event, session?.user?.email);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkIfAdmin(supabase);
      } else if (event === 'SIGNED_OUT') {
        setIsPlatformAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkIfAdmin(supabase: ReturnType<typeof createClient>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[AdminLink] User:', user?.email);

      // Not signed in - just hide, no error
      if (!user) {
        console.log('[AdminLink] No user, hiding');
        setIsPlatformAdmin(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      console.log('[AdminLink] Profile:', profile, 'Error:', profileError);
      const isAdmin = !profileError && profile?.is_platform_admin === true;
      console.log('[AdminLink] Setting isPlatformAdmin to:', isAdmin);
      setIsPlatformAdmin(isAdmin);
    } catch (err) {
      // Silently fail - don't show error for unauthenticated users
      console.log('[AdminLink] Catch error:', err);
      setIsPlatformAdmin(false);
    }
  }

  // Hide while loading or if not admin
  if (isPlatformAdmin !== true) {
    return null;
  }

  const isActive = pathname?.startsWith('/admin');

  // Is admin - show the link
  return (
    <Link
      href="/admin"
      className={`text-gray-700 hover:text-black font-semibold text-sm ${
        isActive ? 'text-black' : ''
      }`}
    >
      Admin
    </Link>
  );
}
