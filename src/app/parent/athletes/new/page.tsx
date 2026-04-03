'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Camera, Check, Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type Step = 1 | 2 | 3 | 4;

interface FormData {
  firstName: string;
  lastName: string;
  graduationYear: string;
  photoUrl: string | null;
  sport: string;
  seasonYear: string;
}

// =============================================================================
// Constants
// =============================================================================

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] text-gray-900';

const currentYear = new Date().getFullYear();

const COPPA_GRADUATION_THRESHOLD = currentYear + 5;

const COPPA_CONSENT_TEXT =
  "I, as the parent or legal guardian, consent to my child's personal information (name, graduation year, profile photo, and performance data) being collected and stored on Youth Coach Hub. This information will be used to create an athlete profile that tracks clips, reports, and season history. I understand I can request deletion of this data at any time by contacting support.";

// =============================================================================
// Component
// =============================================================================

export default function NewAthletePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    graduationYear: '',
    photoUrl: null,
    sport: 'football',
    seasonYear: String(currentYear),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [athleteProfileId, setAthleteProfileId] = useState<string | null>(null);

  const [coppaConsent, setCoppaConsent] = useState(false);

  // Derived: does the athlete need COPPA consent?
  const needsCoppa = form.graduationYear
    ? parseInt(form.graduationYear, 10) <= COPPA_GRADUATION_THRESHOLD
    : false;

  // Join code state (step 4)
  const [joinCode, setJoinCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ teamName: string; playerName: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Photo upload
  // ---------------------------------------------------------------------------

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrors((prev) => ({ ...prev, photo: '' }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parent/athletes/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors((prev) => ({ ...prev, photo: data.error ?? 'Upload failed' }));
        return;
      }

      const data = await res.json();
      setForm((prev) => ({ ...prev, photoUrl: data.publicUrl }));
    } catch {
      setErrors((prev) => ({ ...prev, photo: 'Upload failed. Try again.' }));
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1 validation
  // ---------------------------------------------------------------------------

  function validateStep1(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.graduationYear) {
      newErrors.graduationYear = 'Graduation year is required';
    } else {
      const year = parseInt(form.graduationYear, 10);
      if (year < currentYear || year > currentYear + 8) {
        newErrors.graduationYear = `Must be between ${currentYear} and ${currentYear + 8}`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Create athlete profile (step 2 → step 3)
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    setCreating(true);
    setErrors({});

    try {
      const res = await fetch('/api/parent/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          graduationYear: parseInt(form.graduationYear, 10),
          photoPath: form.photoUrl,
          ...(needsCoppa ? { coppaConsent, coppaConsentText: COPPA_CONSENT_TEXT } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ create: data.error ?? 'Failed to create profile' });
        return;
      }

      const data = await res.json();
      setAthleteProfileId(data.athleteProfileId);
      setStep(4);
    } catch {
      setErrors({ create: 'Something went wrong. Try again.' });
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Link roster (step 3)
  // ---------------------------------------------------------------------------

  async function handleLinkRoster() {
    if (!athleteProfileId || !joinCode.trim()) return;

    setLinking(true);
    setLinkError(null);

    try {
      const res = await fetch(`/api/parent/athletes/${athleteProfileId}/link-roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLinkError(data.error ?? 'Failed to link');
        return;
      }

      setLinkResult({ teamName: data.teamName, playerName: data.playerName });
    } catch {
      setLinkError('Something went wrong. Try again.');
    } finally {
      setLinking(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {step === 1 ? (
            <Link
              href="/parent"
              className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Link>
          ) : step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : step === 3 ? (
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: needsCoppa ? 4 : 3 }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full ${
                  s <= step ? 'bg-[#B8CA6E]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ================================================================= */}
        {/* STEP 1 — Athlete basics                                          */}
        {/* ================================================================= */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
              Add your athlete
            </h1>
            <p className="text-sm text-[#6b7280] mb-8">
              Create a profile to track highlights and reports.
            </p>

            {/* Photo upload */}
            <div className="flex justify-center mb-8">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative w-20 h-20 rounded-full bg-[#B8CA6E]/20 border-2 border-dashed border-[#B8CA6E] flex items-center justify-center overflow-hidden hover:bg-[#B8CA6E]/30 transition-colors"
              >
                {form.photoUrl ? (
                  <img
                    src={form.photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#B8CA6E]" />
                ) : (
                  <Camera className="w-6 h-6 text-[#B8CA6E]" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
            {errors.photo && (
              <p className="text-xs text-red-600 text-center mb-4">{errors.photo}</p>
            )}

            {/* Form fields */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  First name
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Enter first name"
                />
                {errors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Last name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Enter last name"
                />
                {errors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Graduation year
                </label>
                <input
                  type="number"
                  value={form.graduationYear}
                  onChange={(e) => setForm((p) => ({ ...p, graduationYear: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder={String(currentYear + 4)}
                  min={currentYear}
                  max={currentYear + 8}
                />
                {errors.graduationYear && (
                  <p className="text-xs text-red-600 mt-1">{errors.graduationYear}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => validateStep1() && setStep(2)}
              className="w-full mt-8 px-4 py-3 rounded-lg text-sm font-semibold bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2 — Sport selection                                         */}
        {/* ================================================================= */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
              Choose a sport
            </h1>
            <p className="text-sm text-[#6b7280] mb-8">
              Select the sport {form.firstName} plays.
            </p>

            {/* Sport cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { key: 'football', emoji: '🏈', label: 'Football', active: true },
                { key: 'baseball', emoji: '⚾', label: 'Baseball', active: false },
                { key: 'basketball', emoji: '🏀', label: 'Basketball', active: false },
              ].map((sport) => (
                <button
                  key={sport.key}
                  disabled={!sport.active}
                  onClick={() => setForm((p) => ({ ...p, sport: sport.key }))}
                  className={`rounded-xl p-4 text-center border-2 transition-colors ${
                    form.sport === sport.key && sport.active
                      ? 'border-[#B8CA6E] bg-[#B8CA6E]/10'
                      : sport.active
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span className="text-2xl block mb-1">{sport.emoji}</span>
                  <span className="text-xs font-medium text-[#1a1a1a]">
                    {sport.label}
                  </span>
                  {!sport.active && (
                    <span className="block text-[10px] text-[#6b7280] mt-0.5">
                      Coming soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Season year */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Season year
              </label>
              <select
                value={form.seasonYear}
                onChange={(e) => setForm((p) => ({ ...p, seasonYear: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value={String(currentYear)}>{currentYear}</option>
                <option value={String(currentYear - 1)}>{currentYear - 1}</option>
              </select>
            </div>

            {errors.create && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{errors.create}</p>
              </div>
            )}

            <button
              onClick={() => {
                if (needsCoppa) {
                  setStep(3);
                } else {
                  handleCreate();
                }
              }}
              disabled={creating}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all disabled:opacity-50"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating profile...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3 — COPPA Consent (only shown when needsCoppa)              */}
        {/* ================================================================= */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
              Parental Consent Required
            </h1>
            <p className="text-sm text-[#6b7280] mb-6">
              Since {form.firstName} is under 13, federal law (COPPA) requires
              your consent before we can create their profile.
            </p>

            {/* Consent text */}
            <div className="bg-[#f9fafb] rounded-xl p-4 mb-6">
              <p className="text-sm text-[#1a1a1a] leading-relaxed">
                {COPPA_CONSENT_TEXT}
              </p>
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={coppaConsent}
                onChange={(e) => setCoppaConsent(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#B8CA6E] focus:ring-[#B8CA6E]"
              />
              <span className="text-sm text-[#1a1a1a] font-medium">
                I consent as the parent or legal guardian
              </span>
            </label>

            {errors.create && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{errors.create}</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!coppaConsent || creating}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all disabled:opacity-50"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating profile...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4 — Success + optional roster link                          */}
        {/* ================================================================= */}
        {step === 4 && (
          <div className="text-center">
            {/* Success icon */}
            <div className="w-20 h-20 rounded-full bg-[#B8CA6E] flex items-center justify-center mx-auto mb-4">
              <span className="text-[#1a1410] text-2xl font-bold">
                {form.firstName.charAt(0).toUpperCase()}
                {form.lastName.charAt(0).toUpperCase()}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
              {form.firstName}&apos;s profile is ready
            </h1>
            <p className="text-sm text-[#6b7280] mb-8">
              Clips and reports will appear here automatically once your coach sets up Youth Coach Hub.
            </p>

            {/* Join code section */}
            {!linkResult && (
              <div className="bg-[#f9fafb] rounded-xl p-5 mb-6 text-left">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-1">
                  Have a team code from your coach?
                </p>
                <p className="text-xs text-[#6b7280] mb-3">
                  Optional — you can add this later.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    maxLength={6}
                    placeholder="ABC123"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center font-mono text-lg tracking-widest uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]"
                  />
                  <button
                    onClick={handleLinkRoster}
                    disabled={linking || joinCode.length < 4}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {linking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Link'
                    )}
                  </button>
                </div>

                {linkError && (
                  <p className="text-xs text-red-600 mt-2">{linkError}</p>
                )}
              </div>
            )}

            {/* Link success */}
            {linkResult && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-green-800">
                    Linked to {linkResult.teamName}
                  </p>
                  <p className="text-xs text-green-700">
                    {linkResult.playerName}
                  </p>
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <button
              onClick={() => router.push(`/parent/athletes/${athleteProfileId}`)}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all"
            >
              View {form.firstName}&apos;s profile →
            </button>

            {!linkResult && (
              <button
                onClick={() => router.push(`/parent/athletes/${athleteProfileId}`)}
                className="mt-3 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* Footer branding */}
        <div className="mt-12 flex items-center justify-center gap-2 opacity-30">
          <Image
            src="/apple-touch-icon.png"
            alt="Youth Coach Hub"
            width={16}
            height={16}
            className="rounded"
          />
          <span className="text-xs text-gray-400">Youth Coach Hub</span>
        </div>
      </div>
    </div>
  );
}
