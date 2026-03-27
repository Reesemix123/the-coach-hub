'use client';

import { Suspense, useEffect, useState } from 'react';
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

const COPPA_CONSENT_TEXT = `I consent to my child's information being stored and shared within this team's platform, including video content featuring my child.`;

const SMS_CONSENT_TEXT = `I agree to receive text messages from Youth Coach Hub, including game alerts, coaching updates, and team notifications. Message & data rates may apply. Reply STOP at any time to opt out.`;

export default function ParentSignupPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ParentSignupContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
    </div>
  );
}

function ParentSignupContent() {
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
  const [smsConsentChecked, setSmsConsentChecked] = useState(false);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/communication/parents/validate-token?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Invalid invitation link');
          setLoading(false);
          return;
        }

        const inv = data.invitation;
        setInvitation(inv);

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
      // If parent selected SMS/both but did not consent to SMS, downgrade to email-only
      const effectivePref = (notificationPref === 'sms' || notificationPref === 'both') && !smsConsentChecked
        ? 'email'
        : notificationPref;

      const { data: profile, error: profileError } = await supabase
        .from('parent_profiles')
        .insert({
          user_id: authData.user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: invitation.parent_email,
          phone: phone.trim() || null,
          notification_preference: effectivePref,
          sms_consent: smsConsentChecked,
          sms_consent_at: smsConsentChecked ? new Date().toISOString() : null,
          sms_consent_ip: null, // Client-side — IP captured server-side if needed
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

      // 5. Log COPPA consent
      const { error: consentError } = await supabase
        .from('parent_consent_log')
        .insert({
          parent_id: profile.id,
          team_id: invitation.team_id,
          consent_type: 'account_creation',
          consented: true,
          consent_text: COPPA_CONSENT_TEXT,
          ip_address: null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        });

      if (consentError) {
        console.error('Consent log error:', consentError);
      }

      // 5b. Log SMS consent (regardless of checked/unchecked — audit trail)
      const { error: smsConsentError } = await supabase
        .from('parent_consent_log')
        .insert({
          parent_id: profile.id,
          team_id: invitation.team_id,
          consent_type: 'sms_consent',
          consented: smsConsentChecked,
          consent_text: SMS_CONSENT_TEXT,
          ip_address: null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        });

      if (smsConsentError) {
        console.error('SMS consent log error:', smsConsentError);
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
              {(notificationPref === 'sms' || notificationPref === 'both') && (
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  By selecting SMS, you consent to receive team notifications via text message.
                  Reply STOP to opt out. Msg &amp; data rates may apply.{' '}
                  <a href="/sms-policy" target="_blank" rel="noopener noreferrer" className="text-gray-900 underline hover:text-gray-700">
                    SMS Policy
                  </a>
                </p>
              )}
            </div>

            {/* COPPA Consent */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-gray-900 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  {COPPA_CONSENT_TEXT}
                </span>
              </label>
              {!consentChecked && (
                <p className="mt-2 ml-8 text-xs text-red-600">
                  You must provide consent to create an account.
                </p>
              )}
            </div>

            {/* SMS Consent (Optional) */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-900">SMS Notifications</span>
                <span className="text-xs text-gray-400 font-normal">(Optional)</span>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConsentChecked}
                  onChange={(e) => setSmsConsentChecked(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-gray-900 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  {SMS_CONSENT_TEXT}
                </span>
              </label>
              <p className="mt-2 ml-8 text-xs text-gray-500">
                View our{' '}
                <a href="/sms-policy" target="_blank" rel="noopener noreferrer" className="text-gray-900 underline hover:text-gray-700">
                  SMS Policy
                </a>
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !consentChecked}
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
