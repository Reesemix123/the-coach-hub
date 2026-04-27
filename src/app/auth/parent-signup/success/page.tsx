'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'

// TODO: PRE-LAUNCH — replace with the real App Store listing URL
//       once Youth Coach Hub has been published. Format:
//       https://apps.apple.com/app/youth-coach-hub/id<NUMERIC_ID>
const APP_STORE_URL = 'https://apps.apple.com/app/youth-coach-hub/id0000000000'

// TODO: PRE-LAUNCH — replace with the real Play Store listing URL once
//       the Android build is published. The package id (com.youthcoachhub.app)
//       is set in capacitor.config.ts.
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.youthcoachhub.app'

// TODO: PRE-LAUNCH — once a smart-link route exists at /app that detects
//       platform and redirects, point the QR code there instead of the raw
//       App Store URL.
const QR_TARGET_URL = APP_STORE_URL

// Brand accent — the established Youth Coach Hub green. Hardcoded here
// rather than via the existing --color-brand-green token because that token
// currently resolves to the Tailwind default #a3e635 across the marketing
// site. TODO: align tokens project-wide.
const BRAND_GREEN = '#B8CA6E'
const BRAND_GREEN_HOVER = '#c8d986'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  // Treat anything that's not a known mobile UA as desktop. iPadOS 13+ reports
  // as Mac so we deliberately don't try to over-classify; the user can still
  // tap whichever badge fits.
  return 'desktop'
}

// ---------------------------------------------------------------------------
// CSS-styled App Store / Play Store badges
// TODO: PRE-LAUNCH — swap for official Apple / Google PNG/SVG badges if you
//       want the exact branded look. The CSS approximations below match the
//       layout and proportions of the real badges and use the official
//       wordmarks. Apple's marketing guidelines + Google Play badge policy
//       allow the official assets to be used directly without modification.
// ---------------------------------------------------------------------------

function AppStoreBadge({
  recommended,
  href,
}: {
  recommended?: boolean
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl px-5 py-3 transition-colors bg-black text-white border ${
        recommended ? 'border-white/40 ring-2 ring-offset-2 ring-offset-[#0d1117]' : 'border-white/10 hover:border-white/30'
      }`}
      style={recommended ? { boxShadow: `0 0 0 2px ${BRAND_GREEN}` } : undefined}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.05 20.28c-.98.95-2.05.86-3.07.4-1.07-.48-2.06-.51-3.2 0-1.41.61-2.16.43-3.04-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.32.07 2.24.74 3 .79 1.13-.23 2.21-.92 3.42-.83 1.45.12 2.54.7 3.27 1.74-3.01 1.81-2.32 5.74.42 6.84-.55 1.45-1.27 2.89-2.11 4.43zM12.03 7.25c-.15-2.23 1.66-4.05 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          Download on the
        </span>
        <span className="text-lg font-semibold">App Store</span>
      </div>
    </a>
  )
}

function PlayStoreBadge({
  recommended,
  href,
}: {
  recommended?: boolean
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl px-5 py-3 transition-colors bg-black text-white border ${
        recommended ? 'border-white/40' : 'border-white/10 hover:border-white/30'
      }`}
      style={recommended ? { boxShadow: `0 0 0 2px ${BRAND_GREEN}` } : undefined}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#34a853"
          d="M3.6 20.5c.13-.07 8.4-4.84 8.4-4.84l-2.43-2.42z"
        />
        <path
          fill="#fbbc04"
          d="M16.81 12.13l-2.84-1.64-2.36 2.36 2.36 2.36 2.84-1.64a.78.78 0 000-1.44z"
        />
        <path
          fill="#ea4335"
          d="M3.6 3.5c-.18.1-.3.3-.3.55v15.9c0 .25.12.45.3.55l8.4-8.5z"
        />
        <path
          fill="#4285f4"
          d="M12 12l-8.4-8.5c.13.07 8.4 4.84 8.4 4.84l2.36 2.36z"
        />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          Get it on
        </span>
        <span className="text-lg font-semibold">Google Play</span>
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ParentSignupSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccessContent />
    </Suspense>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )
}

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamName = searchParams.get('team')?.trim() || ''
  const athleteName = searchParams.get('athlete')?.trim() || ''

  const [platform, setPlatform] = useState<Platform>('unknown')

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  const showQR = platform === 'desktop'
  const iosRecommended = platform === 'ios'
  const androidRecommended = platform === 'android'

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl mx-auto">
          {/* Hero confirmation */}
          <div className="text-center mb-12">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{
                backgroundColor: `${BRAND_GREEN}26`,
                animation: 'ych-pulse 2s ease-out',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke={BRAND_GREEN}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              You&apos;re all set!
            </h1>
            <p className="text-lg text-gray-300">
              {teamName ? (
                <>
                  You&apos;ve joined{' '}
                  <span className="font-semibold text-white">{teamName}</span>
                  {athleteName && (
                    <>
                      {' '}as{' '}
                      <span className="font-semibold text-white">
                        {athleteName}
                      </span>
                      &apos;s parent
                    </>
                  )}
                  .
                </>
              ) : (
                <>You&apos;ve successfully joined your team.</>
              )}
            </p>
          </div>

          {/* App download CTA */}
          <div className="bg-brand-surface rounded-2xl p-8 border border-gray-800">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Get the app
              </h2>
              <p className="text-gray-300 leading-relaxed max-w-md mx-auto">
                Get schedule alerts, message your coach, and watch your
                athlete&apos;s highlights — all from your phone.
              </p>
            </div>

            <div
              className={`flex flex-wrap justify-center gap-3 ${showQR ? 'md:gap-4' : ''}`}
            >
              <AppStoreBadge
                href={APP_STORE_URL}
                recommended={iosRecommended}
              />
              <PlayStoreBadge
                href={PLAY_STORE_URL}
                recommended={androidRecommended}
              />
            </div>

            {(iosRecommended || androidRecommended) && (
              <p
                className="text-center text-xs mt-4"
                style={{ color: BRAND_GREEN }}
              >
                Recommended for your device
              </p>
            )}

            {/* QR code — desktop only */}
            {showQR && (
              <div className="mt-8 pt-8 border-t border-gray-800">
                <p className="text-center text-sm text-gray-400 mb-4">
                  On a laptop? Scan with your phone camera.
                </p>
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCode
                      value={QR_TARGET_URL}
                      size={140}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0d1117"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Continue on web — escape hatch */}
          <div className="text-center mt-8">
            <button
              type="button"
              onClick={() => router.push('/parent')}
              className="text-sm text-gray-400 hover:text-white transition-colors underline-offset-4 hover:underline"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = BRAND_GREEN_HOVER
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = ''
              }}
            >
              Continue on web instead
            </button>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes ych-pulse {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
