import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function FootballPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  // Unauthenticated visitor — show football landing
  return (
    <div
      className="min-h-screen bg-[#1a1410] relative"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 parallax-section"
          style={{
            backgroundImage: 'url(/marketing/friday-night-lacrosse.png)',
            backgroundPosition: 'center 40%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/40 via-[#1a1410]/60 to-[#1a1410]/95" />
      </div>

      {/* Nav */}
      <nav
        className="relative z-10 px-4 sm:px-8 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Link href="/">
          <img src="/logo-darkmode.png" alt="Youth Coach Hub" className="h-8 sm:h-10 w-auto" />
        </Link>
      </nav>

      {/* Content */}
      <div className="relative z-10 min-h-[calc(100vh-65px)] flex items-center justify-center px-4 sm:px-8">
        <div className="text-center max-w-2xl">
          <p
            className="text-xs font-black tracking-[0.2em] uppercase"
            style={{ color: '#B8CA6E' }}
          >
            Football — Available Now
          </p>

          <h1
            className="text-4xl md:text-5xl font-black tracking-tight mt-4"
            style={{ color: '#F9FAFB' }}
          >
            Pro-Level Football Coaching Tools
          </h1>

          <p
            className="text-base md:text-lg mt-6 max-w-xl mx-auto"
            style={{ color: 'rgba(249,250,251,0.72)' }}
          >
            AI-assisted film analysis, playbooks, game analytics, practice planning,
            and parent communication — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['Film Analysis', 'AI Playbook', 'Game Analytics', 'Practice Planning', 'Communication Hub', 'Player Profiles'].map((label) => (
              <span
                key={label}
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: 'rgba(184,202,110,0.10)',
                  border: '1px solid rgba(184,202,110,0.25)',
                  color: '#B8CA6E',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 mt-10 flex-wrap">
            <Link
              href="/auth/signup"
              className="font-black rounded-2xl h-14 px-8 inline-flex items-center justify-center transition-colors"
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
              className="font-black rounded-2xl h-14 px-8 inline-flex items-center justify-center transition-colors"
              style={{
                background: 'rgba(15,23,42,0.28)',
                color: '#fff',
                border: '1px solid rgba(148,163,184,0.25)',
              }}
            >
              Sign In
            </Link>
          </div>

          <Link
            href="/"
            className="inline-block text-sm mt-8"
            style={{ color: '#B8CA6E' }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
