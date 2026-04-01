export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Clapperboard,
  LayoutGrid,
  TrendingUp,
  CalendarDays,
  Lightbulb,
  Layers,
  MessageSquare,
  UserCircle,
} from 'lucide-react';
import { AnimateOnScroll } from '@/components/marketing/AnimateOnScroll';

// =============================================================================
// Auth redirect — authenticated coaches go to /dashboard
// =============================================================================

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div
      className="bg-[#1a1410]"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      {/* ================================================================= */}
      {/* NAVBAR                                                            */}
      {/* ================================================================= */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          background: 'rgba(26,20,16,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
          {/* Left: Logo + wordmark */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-8 sm:h-10 w-auto"
            />
            <span className="hidden sm:inline text-white font-semibold text-lg tracking-tight">
              youth<span style={{ color: '#B8CA6E' }}>coach</span>hub
            </span>
          </Link>

          {/* Center: Nav links */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#coaching-tools" className="text-sm font-bold" style={{ color: 'rgba(249,250,251,0.70)' }}>
              Features
            </a>
            <a href="#pricing" className="text-sm font-bold" style={{ color: 'rgba(249,250,251,0.70)' }}>
              Pricing
            </a>
            <Link href="/guide" className="text-sm font-bold" style={{ color: 'rgba(249,250,251,0.70)' }}>
              Guide
            </Link>
          </div>

          {/* Right: Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-bold transition-colors hover:text-white"
              style={{ color: 'rgba(249,250,251,0.70)' }}
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-black rounded-2xl px-5 py-2 transition-colors hover:bg-[#c9d88a]"
              style={{ background: '#B8CA6E', color: '#1a1410' }}
            >
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ================================================================= */}
      {/* SECTION 1 — HERO                                                  */}
      {/* ================================================================= */}
      <section
        className="relative min-h-screen parallax-section"
        style={{
          backgroundImage: 'url(/marketing/friday-night-lacrosse.png)',
          backgroundPosition: 'center 35%',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/30 via-[#1a1410]/50 to-[#1a1410]/90" />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto pt-32 pb-24 px-4 sm:px-8">
          {/* Eyebrow */}
          <p
            className="text-xs font-black tracking-[0.2em] uppercase fade-in"
            style={{ color: '#B8CA6E' }}
          >
            The Coaching Intelligence Platform
          </p>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mt-4 fade-in fade-in-delay-1">
            <span style={{ color: '#F9FAFB' }}>Coaching Tools Built for</span>
            <br />
            <span style={{ color: '#B8CA6E' }}>Every Sport.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg md:text-xl max-w-2xl mt-6 fade-in fade-in-delay-2"
            style={{ color: 'rgba(249,250,251,0.72)' }}
          >
            AI-assisted film analysis, smart playbooks, practice planning,
            and parent communication — everything a serious coach needs,
            built for volunteer budgets.
          </p>

          {/* CTA Row */}
          <div className="flex gap-4 flex-wrap mt-10">
            <Link
              href="/auth/signup"
              className="font-black rounded-2xl h-14 px-8 inline-flex items-center justify-center transition-colors hover:bg-[#c9d88a] w-full sm:w-auto"
              style={{
                background: '#B8CA6E',
                color: '#1a1410',
                boxShadow: '0 14px 28px rgba(184,202,110,0.25)',
              }}
            >
              Get Started →
            </Link>
            <Link
              href="/auth/login"
              className="font-black rounded-2xl h-14 px-8 inline-flex items-center justify-center transition-colors w-full sm:w-auto"
              style={{
                background: 'rgba(15,23,42,0.28)',
                color: '#fff',
                border: '1px solid rgba(148,163,184,0.25)',
              }}
            >
              Sign In
            </Link>
          </div>

          {/* See how it works */}
          <a
            href="#coaching-tools"
            className="inline-block text-sm mt-4 transition-colors hover:text-[#F9FAFB]"
            style={{ color: 'rgba(249,250,251,0.45)' }}
          >
            See how it works ↓
          </a>

          {/* Disclaimer */}
          <p className="text-xs mt-3" style={{ color: 'rgba(249,250,251,0.35)' }}>
            Plans from $29.99/mo · Free tier available
          </p>

          {/* Sport Navigation Strip */}
          <div className="mt-16">
            <p
              className="text-xs tracking-wider uppercase mb-3"
              style={{ color: 'rgba(249,250,251,0.35)' }}
            >
              Choose your sport
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/football"
                className="rounded-full px-4 py-2 text-sm font-bold transition-colors hover:bg-[rgba(184,202,110,0.20)]"
                style={{
                  background: 'rgba(184,202,110,0.12)',
                  border: '1px solid rgba(184,202,110,0.35)',
                  color: '#B8CA6E',
                }}
              >
                🏈 Football
              </Link>
              {[
                { href: '/baseball', label: '⚾ Baseball · Coming Soon' },
                { href: '/basketball', label: '🏀 Basketball · Coming Soon' },
                { href: '/soccer', label: '⚽ Soccer · Coming Soon' },
                { href: '/lacrosse', label: '🥍 Lacrosse · Coming Soon' },
              ].map((sport) => (
                <Link
                  key={sport.href}
                  href={sport.href}
                  className="rounded-full px-4 py-2 text-sm transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(249,250,251,0.50)',
                  }}
                >
                  {sport.label}
                </Link>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'rgba(249,250,251,0.30)' }}>
              Football available now · More sports launching soon
            </p>
          </div>
        </div>
      </section>

      {/* Sections 2–8 will be added after approval */}
    </div>
  );
}
