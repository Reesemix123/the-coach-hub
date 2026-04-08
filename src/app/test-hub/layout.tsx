import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export default async function TestHubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_tester, is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_tester && !profile?.is_platform_admin) {
    redirect('/dashboard');
  }

  const isAdmin = profile.is_platform_admin === true;

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/test-hub" className="text-lg font-bold text-gray-900">
              Test Hub
            </Link>
            {isAdmin && (
              <Link href="/test-hub/admin" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{profile.full_name || user.email || 'Tester'}</span>
            <Link href={isAdmin ? '/admin/testing' : '/dashboard'} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Back to App
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
