'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLink() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    checkIfAdmin();
  }, []);

  async function checkIfAdmin() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Not signed in - just hide, no error
      if (!user) {
        setIsPlatformAdmin(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      setIsPlatformAdmin(!profileError && profile?.is_platform_admin === true);
    } catch {
      // Silently fail - don't show error for unauthenticated users
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
      className={`flex items-center gap-1.5 text-red-600 hover:text-red-800 font-bold text-lg ${
        isActive ? 'text-red-800' : ''
      }`}
    >
      🔴 Admin
    </Link>
  );
}
