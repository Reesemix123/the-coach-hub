'use client';

// src/components/admin/AdminGuard.tsx
// Client-side guard component that checks for platform admin access

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAdminAccess() {
      try {
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          // Not authenticated - redirect to login
          router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
          return;
        }

        // Check if user is platform admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_platform_admin')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error('Failed to fetch profile:', profileError);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        if (!profile.is_platform_admin) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // User is admin
        setIsAdmin(true);
        setLoading(false);

        // Update last_active_at
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id);

      } catch (error) {
        console.error('Error checking admin access:', error);
        setIsAdmin(false);
        setLoading(false);
      }
    }

    checkAdminAccess();
  }, [router, supabase]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Not admin - show forbidden
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access the Platform Admin Console.
            This area is restricted to platform administrators only.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  // Admin access granted
  return <>{children}</>;
}

export default AdminGuard;
