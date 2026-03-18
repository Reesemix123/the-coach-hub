import Link from 'next/link';
import Image from 'next/image';
import { Settings } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Verify user is a parent
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) {
    // Not a parent account, redirect to main app
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hide the root layout coach navbar and payment banner when parent layout is active */}
      <style>{`
        #coach-nav { display: none !important; }
        #coach-banner { display: none !important; }
        main.pt-24 { padding-top: 0 !important; }
      `}</style>

      {/* Parent Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/parent" className="flex items-center gap-2">
              <Image
                src="/apple-touch-icon.png"
                alt="Youth Coach Hub"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-semibold text-gray-900 hidden sm:inline">
                Youth Coach Hub
              </span>
            </Link>

            {/* User info + actions */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">
                {parentProfile.first_name} {parentProfile.last_name}
              </span>
              <Link
                href="/parent/settings"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Account settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}
