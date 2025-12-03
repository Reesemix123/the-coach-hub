import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ActiveSessionsManager from '@/components/ActiveSessionsManager';
import { User, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Account Settings | Youth Coach Hub',
  description: 'Manage your account settings and security',
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, created_at')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 mt-1">
            Manage your profile and security settings
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Profile Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Profile
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-medium">
                {profile?.full_name
                  ? profile.full_name.charAt(0).toUpperCase()
                  : user.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {profile?.full_name || 'Coach'}
                </h3>
                <p className="text-gray-500">{user.email}</p>
                <p className="text-sm text-gray-400 mt-1">
                  Member since{' '}
                  {new Date(profile?.created_at || user.created_at).toLocaleDateString(
                    'en-US',
                    { month: 'long', year: 'numeric' }
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-600" />
            Security
          </h2>
          <ActiveSessionsManager />
        </section>

        {/* Info Section */}
        <section className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">About Device Limits</h3>
          <p className="text-sm text-blue-800">
            Each coach can be signed in on up to <strong>3 devices</strong> at once.
            When you sign in on a new device and exceed your limit, the oldest session
            will automatically be signed out. You can also manually sign out from any
            device above.
          </p>
        </section>
      </div>
    </div>
  );
}
