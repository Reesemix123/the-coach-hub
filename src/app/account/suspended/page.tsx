// Suspended account page - shown when admin has revoked access for TOS violations
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ShieldAlert, Mail, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SuspendedAccountPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUserEmail(user.email || null);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
          Account Suspended
        </h1>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          Your access to Youth Coach Hub has been suspended due to a violation of our{' '}
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>.
        </p>

        {/* Info Box */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            Your subscription has been canceled and you no longer have access to:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>- Your team playbooks and plays</li>
            <li>- Game film and tagged plays</li>
            <li>- Analytics and reports</li>
            <li>- Team management features</li>
          </ul>
        </div>

        {/* Appeal Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">
                Believe this is a mistake?
              </p>
              <p className="text-sm text-blue-700">
                If you believe your account was suspended in error, please contact us at{' '}
                <a
                  href="mailto:support@youthcoachhub.com"
                  className="font-medium underline hover:text-blue-800"
                >
                  support@youthcoachhub.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* User Info */}
        {userEmail && (
          <p className="text-sm text-gray-500 text-center mb-6">
            Signed in as: {userEmail}
          </p>
        )}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
