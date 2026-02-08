'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, XCircle, Loader2, Users } from 'lucide-react';

interface InvitationDetails {
  id: string;
  team_id: string;
  player_id: string;
  parent_email: string;
  parent_name: string | null;
  relationship: string | null;
  status: string;
  team_name?: string;
  player_name?: string;
}

export default function ParentInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch invitation details
        const { data: inv, error: invError } = await supabase
          .from('parent_invitations')
          .select(`
            id,
            team_id,
            player_id,
            parent_email,
            parent_name,
            relationship,
            status,
            token_expires_at
          `)
          .eq('invitation_token', token)
          .single();

        if (invError || !inv) {
          setError('Invalid invitation link');
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(inv.token_expires_at) < new Date()) {
          setError('This invitation has expired. Please ask the coach to resend it.');
          setLoading(false);
          return;
        }

        // Check status
        if (inv.status === 'accepted') {
          setError('This invitation has already been accepted. Please sign in.');
          setLoading(false);
          return;
        }

        if (inv.status === 'revoked') {
          setError('This invitation has been revoked. Please contact the coach.');
          setLoading(false);
          return;
        }

        // Get team and player names for display
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', inv.team_id)
          .single();

        const { data: player } = await supabase
          .from('players')
          .select('first_name, last_name')
          .eq('id', inv.player_id)
          .single();

        setInvitation({
          ...inv,
          team_name: team?.name,
          player_name: player ? `${player.first_name} ${player.last_name}` : undefined,
        });
        setLoading(false);
      } catch (err) {
        console.error('Error validating invitation:', err);
        setError('Failed to validate invitation');
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Invitation Error
          </h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <div className="mt-6 space-y-3">
            <Link
              href="/auth/login"
              className="block w-full py-3 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="block w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            You&apos;re Invited!
          </h1>

          <p className="mt-2 text-gray-600">
            You&apos;ve been invited to join{' '}
            <span className="font-medium text-gray-900">
              {invitation.team_name || 'the team'}
            </span>
            {invitation.player_name && (
              <>
                {' '}as a parent of{' '}
                <span className="font-medium text-gray-900">
                  {invitation.player_name}
                </span>
              </>
            )}
            .
          </p>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            What you&apos;ll get access to:
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Team announcements and updates</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Practice and game schedules with RSVP</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Game film and highlight videos</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Player progress reports</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Direct messaging with coaches</span>
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <button
            onClick={() => router.push(`/auth/parent-signup?token=${token}`)}
            className="w-full py-3 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Create Your Account
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-black font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
