import Link from 'next/link';
import Image from 'next/image';
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

            {/* User info */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {parentProfile.first_name} {parentProfile.last_name}
              </span>
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
