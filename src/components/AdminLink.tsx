'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function AdminLink() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    checkIfAdmin();
  }, []);

  async function checkIfAdmin() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('AdminLink: No authenticated user', { authError });
        setIsPlatformAdmin(false);
        setLoading(false);
        return;
      }

      console.log('AdminLink: Checking admin status for user', user.id, user.email);

      // Check if user is platform admin
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_platform_admin, email')
        .eq('id', user.id)
        .single();

      console.log('AdminLink: Profile query result', { profile, error, userId: user.id });

      const isAdmin = !error && profile?.is_platform_admin === true;
      console.log('AdminLink: Setting isPlatformAdmin to', isAdmin);
      setIsPlatformAdmin(isAdmin);
    } catch (error) {
      console.error('AdminLink: Error checking admin status:', error);
      setIsPlatformAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  // Don't show while loading or if not admin
  if (loading || !isPlatformAdmin) {
    return null;
  }

  const isActive = pathname?.startsWith('/admin');

  return (
    <Link
      href="/admin"
      className={`flex items-center gap-1.5 text-gray-800 hover:text-black font-medium text-lg transition-colors ${
        isActive ? 'text-black' : ''
      }`}
    >
      <Shield className="w-4 h-4" />
      Admin
    </Link>
  );
}
