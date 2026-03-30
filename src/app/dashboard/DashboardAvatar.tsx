'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface DashboardAvatarProps {
  initial: string;
  fullName: string;
  hasParentProfile?: boolean;
}

export default function DashboardAvatar({ initial, fullName, hasParentProfile }: DashboardAvatarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#B8CA6E]"
        style={{ background: '#B8CA6E', color: '#1a1410' }}
        aria-label="Account menu"
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden z-50"
          style={{ background: 'rgba(26,20,16,0.96)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold truncate" style={{ color: '#F9FAFB' }}>
              {fullName}
            </p>
          </div>
          {hasParentProfile && (
            <>
              <button
                onClick={() => { setOpen(false); router.push('/parent'); }}
                className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/10 flex items-center gap-2"
                style={{ color: '#B8CA6E' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Switch to parent view
              </button>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
            </>
          )}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/10"
            style={{ color: 'rgba(249,250,251,0.72)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
