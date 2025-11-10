'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  if (!user) {
    return (
      <a href="/auth/login" className="text-gray-700 hover:text-gray-900">
        Sign In
      </a>
    );
  }

  return (
    <div className="relative group">
      <button className="text-gray-700 hover:text-gray-900 px-2 py-1">
        {user.email}
      </button>
      <div className="absolute right-0 top-full w-48 bg-white rounded-md shadow-lg border border-gray-200 hidden group-hover:block z-50">
        <button
          onClick={handleSignOut}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}