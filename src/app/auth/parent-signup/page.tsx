'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface InvitationDetails {
  id: string;
  team_id: string;
  player_id: string;
  parent_email: string;
  parent_name: string | null;
  relationship: string | null;
  team_name?: string;
  player_name?: string;
}

const CONSENT_TEXT = `I consent to creating an account with Youth Coach Hub. I understand that:
• My contact information will be used to send team communications
• I may receive SMS and/or email notifications based on my preferences
• Video content shared by coaches may include footage of team activities
• I can update my notification preferences or delete my account at any time

By creating an account, I confirm I am the parent or legal guardian of the player(s) I am linked to and have authority to receive information about their participation.`;

export default function ParentSignupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationPref, setNotificationPref] = useState<'email' | 'sms' | 'both'>('both');
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

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

        if (new Date(inv.token_expires_at) < new Date()) {
          setError('This invitation has expired');
          setLoading(false);
          return;
        }

        if (inv.status !== 'pending') {
          setError('This invitation is no longer valid');
          setLoading(false);
          return;
        }

        // Get team and player names
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

        // Pre-fill name if provided
        if (inv.parent_name) {
          const parts = inv.parent_name.split(' ');
          if (parts.length >= 2) {
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(' '));
          } else {
            setFirstName(inv.parent_name);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error validating invitation:', err);
        setError('Failed to validate invitation');
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!consentChecked) {
      setError('Please accept the terms to continue');
      return;
    }

    if (!invitation) return;

    setSubmitting(true);

    try {
      const supabase = createClient();

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.parent_email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            user_type: 'parent',
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(authError.message);
        }
        setSubmitting(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create account');
        setSubmitting(false);
        return;
      }

      // 2. Create parent profile
      const { data: profile, error: profileError } = await supabase
        .from('parent_profiles')
        .insert({
          user_id: authData.user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: invitation.parent_email,
          phone: phone.trim() || null,
          notification_preference: notificationPref,
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        setError('Failed to create profile');
        setSubmitting(false);
        return;
      }

      // 3. Link parent to player
      const { error: linkError } = await supabase
        .from('player_parent_links')
        .insert({
          player_id: invitation.player_id,
          parent_id: profile.id,
          relationship: invitation.relationship || 'guardian',
          is_primary_contact: true,
        });

      if (linkError) {
        console.error('Link creation error:', linkError);
      }

      // 4. Grant team access
      const { error: accessError } = await supabase
        .from('team_parent_access')
        .insert({
          team_id: invitation.team_id,
          parent_id: profile.id,
          access_level: 'full',
          status: 'active',
        });

      if (accessError) {
        console.error('Access grant error:', accessError);
      }

      // 5. Log consent
      const { error: consentError } = await supabase
        .from('parent_consent_log')
        .insert({
          parent_id: profile.id,
          team_id: invitation.team_id,
          consent_type: 'account_creation',
          consented: true,
          consent_text: CONSENT_TEXT,
        });

      if (consentError) {
        console.error('Consent log error:', consentError);
      }

      // 6. Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('parent_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Invitation update error:', updateError);
      }

      // Success! Redirect to parent dashboard
      router.push('/parent');
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Error</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block py-3 px-6 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">
              Create Your Parent Account
            </h1>
            <p className="mt-2 text-gray-600">
              Join {invitation?.team_name || 'the team'}
              {invitation?.player_name && ` as ${invitation.player_name}'s parent`}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={invitation?.parent_email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                This is the email your coach used to invite you
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">
                Required for SMS notifications
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            {/* Notification Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How would you like to receive notifications?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'both', label: 'Email and SMS (recommended)' },
                  { value: 'email', label: 'Email only' },
                  { value: 'sms', label: 'SMS only' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="notification"
                      value={option.value}
                      checked={notificationPref === option.value}
                      onChange={(e) => setNotificationPref(e.target.value as 'email' | 'sms' | 'both')}
                      className="w-4 h-4 text-gray-900"
                    />
                    <span className="text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Consent */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-gray-900 rounded"
                />
                <span className="text-sm text-gray-600">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => alert(CONSENT_TEXT)}
                    className="text-black font-medium underline"
                  >
                    terms and conditions
                  </button>
                  {' '}for creating a parent account.
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
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
