'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    // Log the logout event before signing out
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to log logout event:', error);
    }
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        Sign In
      </a>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <button className="text-gray-700 hover:text-gray-900 px-2 py-1 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline">{user.email}</span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
          </div>

          <Link
            href="/account"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <UserIcon className="h-4 w-4" />
            Account
          </Link>

          <div className="border-t border-gray-100 mt-1">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}