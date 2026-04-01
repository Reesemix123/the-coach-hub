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
import { SportSelectorDropdown } from '@/components/marketing/SportSelectorDropdown';

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
            <a href="#communication-hub" className="text-sm font-bold" style={{ color: 'rgba(249,250,251,0.70)' }}>
              Communication
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
        className="relative min-h-screen"
        style={{
          backgroundImage: 'url(/marketing/friday-night-lacrosse.png)',
          backgroundPosition: 'center 35%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
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
            <SportSelectorDropdown />
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

        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 2 — CREDIBILITY STRIP                                    */}
      {/* ================================================================= */}
      <section
        className="relative py-12 px-4 sm:px-8"
        style={{
          background: '#1a1410',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-10 md:gap-16">
          {[
            { stat: 'AI-Assisted', sub: 'Film analysis + insights' },
            { stat: 'Multi-Sport', sub: 'Football · More coming soon' },
            { stat: 'Built for 2026', sub: 'Fall season ready' },
            { stat: 'Volunteer Budget', sub: 'Not just for big programs' },
          ].map((item) => (
            <div key={item.stat} className="text-center">
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: '#F9FAFB' }}>
                {item.stat}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(249,250,251,0.40)' }}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 3 — COACHING INTELLIGENCE TOOLS                          */}
      {/* ================================================================= */}
      <section
        id="coaching-tools"
        className="relative py-24 px-4 sm:px-8"
        style={{
          backgroundImage: 'url(/marketing/friday-night-soccer.png)',
          backgroundPosition: 'center 40%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/35 via-[#1a1410]/55 to-[#1a1410]/92" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <AnimateOnScroll>
            <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#B8CA6E' }}>
              Coaching Intelligence
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mt-3" style={{ color: '#F9FAFB' }}>
              Your AI Coaching Assistant
            </h2>
            <p className="max-w-2xl mt-4 mb-16" style={{ color: 'rgba(249,250,251,0.72)' }}>
              AI accelerates your work — you stay in control. Tag key moments faster,
              surface player performance patterns, and spend more time coaching than preparing.
            </p>
          </AnimateOnScroll>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clapperboard, title: 'AI-Assisted Film', desc: 'AI suggests tags as you review film. You confirm, edit, or override. Tag key moments in a fraction of the time.', footer: 'Coach stays in control →' },
              { icon: LayoutGrid, title: 'AI Playbook', desc: 'Design plays visually. AI suggests setups from your tendencies. Share with the team instantly.', footer: 'Opponent scouting built in →' },
              { icon: TrendingUp, title: 'Game Analytics', desc: '150+ stats tracked from your film tags. AI-generated game summaries. Know your tendencies before opponents do.', footer: 'Know your patterns →' },
              { icon: CalendarDays, title: 'Practice Planning', desc: 'AI builds practice plans from your film data. Focus reps where your team actually needs them most.', footer: null },
              { icon: Lightbulb, title: 'Coaching Insights', desc: 'AI surfaces patterns in your data. Run tendency breakdowns, pattern analysis, and opponent prep automatically.', footer: null },
              { icon: Layers, title: 'Game Week Planning', desc: 'Build your weekly game plan with AI assistance. Opponent tendencies, player matchups, and situational prep in one place.', footer: null },
            ].map((card, i) => (
              <AnimateOnScroll key={card.title} delay={(i % 3) as 0 | 1 | 2}>
                <div
                  className="rounded-2xl p-6 hover:-translate-y-1 transition-all duration-200 h-full"
                  style={{
                    background: 'rgba(32,26,22,0.78)',
                    border: '1px solid rgba(148,163,184,0.16)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: 'rgba(184,202,110,0.08)',
                      border: '1px solid rgba(184,202,110,0.20)',
                    }}
                  >
                    <card.icon size={20} stroke="#B8CA6E" strokeWidth={1.5} fill="none" />
                  </div>
                  <h3 className="text-base font-black" style={{ color: '#F9FAFB' }}>{card.title}</h3>
                  <p className="text-sm mt-2" style={{ color: 'rgba(249,250,251,0.60)' }}>{card.desc}</p>
                  {card.footer && (
                    <p className="text-sm font-bold mt-4" style={{ color: '#B8CA6E' }}>{card.footer}</p>
                  )}
                </div>
              </AnimateOnScroll>
            ))}
          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 4 — COMMUNICATION HUB                                    */}
      {/* ================================================================= */}
      <section
        id="communication-hub"
        className="relative py-24 px-4 sm:px-8"
        style={{
          backgroundImage: 'url(/marketing/friday-night-basketball.png)',
          backgroundPosition: 'center 40%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/45 via-[#1a1410]/65 to-[#1a1410]/95" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <AnimateOnScroll>
            <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#B8CA6E' }}>
              Communication Hub
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mt-3" style={{ color: '#F9FAFB' }}>
              Replace the Group Text.<br />
              <span style={{ color: '#B8CA6E' }}>Finally.</span>
            </h2>
            <p className="max-w-2xl mt-4 mb-16" style={{ color: 'rgba(249,250,251,0.72)' }}>
              Push game film, player clips, and AI game summaries directly to
              parents — alongside schedules, RSVP, and team messaging. One app
              for everything your team community needs.
            </p>
          </AnimateOnScroll>

          {/* Two columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
            <AnimateOnScroll delay={1}>
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(32,26,22,0.78)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <h3 className="text-sm font-black uppercase tracking-wider mb-4" style={{ color: '#F9FAFB' }}>
                  What Coaches Get
                </h3>
                <ul className="space-y-3">
                  {[
                    'Push video clips to individual parents with coach notes',
                    'AI game summaries sent automatically after each game',
                    'Team announcements via SMS and email',
                    'Schedule with RSVP tracking and attendance reports',
                    'Parent roster, directory, and contact management',
                    'Direct messaging with full team or individual parents',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(249,250,251,0.70)' }}>
                      <span style={{ color: '#B8CA6E' }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={2}>
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(32,26,22,0.78)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <h3 className="text-sm font-black uppercase tracking-wider mb-4" style={{ color: '#F9FAFB' }}>
                  What Parents Get
                </h3>
                <ul className="space-y-3">
                  {[
                    "Their athlete's auto-clipped highlights and performance reports",
                    'Team schedule with personal calendar sync',
                    'Direct message to coaching staff',
                    'Game day notifications and score alerts',
                    'Persistent athlete profile that survives team changes',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(249,250,251,0.70)' }}>
                      <span style={{ color: '#B8CA6E' }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Season plan pricing */}
          <AnimateOnScroll>
            <p className="text-sm mb-6" style={{ color: 'rgba(249,250,251,0.55)' }}>
              Season Plans — one-time purchase, 6-month access
            </p>
          </AnimateOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Rookie', price: '$149', detail: 'Up to 20 parents · 10 team videos', featured: false, note: null },
              { name: 'Varsity', price: '$249', detail: 'Up to 40 parents · 10 team videos', featured: false, note: null },
              { name: 'All-Conference', price: '$349', detail: 'Up to 60 parents · 10 team videos', featured: true, note: null },
              { name: 'All-State', price: '$449', detail: 'Unlimited parents · 10 team videos', featured: false, note: 'Includes 5 gifted player profiles' },
            ].map((plan, i) => (
              <AnimateOnScroll key={plan.name} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: 'rgba(32,26,22,0.78)',
                    border: plan.featured
                      ? '1px solid rgba(184,202,110,0.35)'
                      : '1px solid rgba(148,163,184,0.16)',
                  }}
                >
                  <p className="text-sm font-black" style={{ color: '#F9FAFB' }}>{plan.name}</p>
                  <p className="text-lg font-black mt-1" style={{ color: '#B8CA6E' }}>{plan.price}<span className="text-xs font-normal" style={{ color: 'rgba(249,250,251,0.40)' }}>/season</span></p>
                  <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.45)' }}>{plan.detail}</p>
                  {plan.note && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(249,250,251,0.35)' }}>{plan.note}</p>
                  )}
                </div>
              </AnimateOnScroll>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: 'rgba(249,250,251,0.40)' }}>
            All plans: SMS + email alerts · RSVP · AI game summaries · Unlimited individual player clips · 30-day parent grace period
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.30)' }}>
            Video top-up pack: $39 for 5 additional team video shares
          </p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 5 — PARENT / FAMILY ANGLE                                */}
      {/* ================================================================= */}
      <section
        className="relative py-24 px-4 sm:px-8"
        style={{
          backgroundImage: 'url(/marketing/friday-night-field.png)',
          backgroundPosition: 'center 30%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/40 via-[#1a1410]/60 to-[#1a1410]/94" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <AnimateOnScroll>
            <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#B8CA6E' }}>
              For Families
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mt-3" style={{ color: '#F9FAFB' }}>
              Your Athlete&apos;s Story.<br />
              <span style={{ color: '#B8CA6E' }}>Preserved Forever.</span>
            </h2>
            <p className="max-w-2xl mt-4 mb-16" style={{ color: 'rgba(249,250,251,0.72)' }}>
              Parents get a persistent athlete profile — clips, performance
              reports, and season history that belongs to your family, not the
              team. No matter what coach or team comes next.
            </p>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AnimateOnScroll delay={1}>
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(32,26,22,0.78)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <span className="inline-block text-xs font-bold rounded-full px-3 py-1 mb-4" style={{ background: 'rgba(184,202,110,0.12)', color: '#B8CA6E' }}>
                  PARENT VIEW
                </span>
                <ul className="space-y-3">
                  {[
                    'Game highlights, automatically clipped and approved by coach',
                    'Performance reports written in plain language',
                    'Season history that never disappears',
                    'Shareable recruiting profile link',
                    'Works across every sport and every team',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(249,250,251,0.70)' }}>
                      <span style={{ color: '#B8CA6E' }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pl-4" style={{ borderLeft: '2px solid #B8CA6E' }}>
                  <p className="text-sm italic" style={{ color: 'rgba(249,250,251,0.50)' }}>
                    &ldquo;Your child&apos;s highlights belong to you — not the coach.&rdquo;
                  </p>
                </div>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={2}>
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(32,26,22,0.78)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <span className="inline-block text-xs font-bold rounded-full px-3 py-1 mb-4" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(249,250,251,0.55)' }}>
                  COACH VIEW
                </span>
                <ul className="space-y-3">
                  {[
                    'Technical grades per play — position-specific metrics',
                    'Position-level performance grades per assignment',
                    'Full AI coaching breakdown',
                    'Clip review queue before parents can view',
                    'Publish reports when ready — coach controls the timing',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(249,250,251,0.70)' }}>
                      <span style={{ color: 'rgba(249,250,251,0.40)' }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pl-4" style={{ borderLeft: '2px solid rgba(148,163,184,0.25)' }}>
                  <p className="text-sm italic" style={{ color: 'rgba(249,250,251,0.45)' }}>
                    &ldquo;Coaches see the data. Parents see the story. Same game, two perspectives.&rdquo;
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Subscription callout */}
          <AnimateOnScroll className="mt-12">
            <div
              className="max-w-2xl mx-auto rounded-2xl p-8 text-center"
              style={{
                background: 'rgba(184,202,110,0.06)',
                border: '1px solid rgba(184,202,110,0.14)',
              }}
            >
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#B8CA6E' }}>
                Player Profile Subscription
              </p>
              <p className="text-4xl font-black" style={{ color: '#F9FAFB' }}>
                $19.99 / year
              </p>
              <p className="text-sm mt-3" style={{ color: 'rgba(249,250,251,0.55)' }}>
                Permanent clip + report history · Multi-sport · Survives team changes
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.35)' }}>
                Auto-renews annually · Cancel anytime · 90-day grace period after lapse
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 6 — MULTI-SPORT VISION                                   */}
      {/* ================================================================= */}
      <section
        className="relative py-24 px-4 sm:px-8"
        style={{
          background: '#1a1410',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <AnimateOnScroll>
            <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#B8CA6E' }}>
              Multi-Sport Platform
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mt-3" style={{ color: '#F9FAFB' }}>
              One Platform.<br />
              <span style={{ color: '#B8CA6E' }}>Every Sport.</span>
            </h2>
            <p className="max-w-2xl mt-4 mb-16" style={{ color: 'rgba(249,250,251,0.72)' }}>
              One coach account. One parent profile. Every season building
              on the last — across every sport your athlete plays.
            </p>
          </AnimateOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimateOnScroll>
              <Link
                href="/football"
                className="block rounded-2xl p-5 hover:-translate-y-1 transition-all duration-200"
                style={{
                  background: 'rgba(32,26,22,0.78)',
                  border: '1px solid rgba(148,163,184,0.20)',
                }}
              >
                <p className="font-black text-base" style={{ color: '#F9FAFB' }}>Football</p>
                <span className="inline-block text-xs font-black rounded-full px-2 py-0.5 mt-2" style={{ background: '#B8CA6E', color: '#1a1410' }}>
                  Available Now
                </span>
                <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.45)' }}>
                  Film · Playbooks · Analytics · Communication
                </p>
              </Link>
            </AnimateOnScroll>

            <AnimateOnScroll delay={1}>
              <Link
                href="/baseball"
                className="block rounded-2xl p-5 opacity-70"
                style={{
                  background: 'rgba(32,26,22,0.78)',
                  border: '1px solid rgba(148,163,184,0.20)',
                }}
              >
                <p className="font-black text-base" style={{ color: 'rgba(249,250,251,0.55)' }}>Baseball</p>
                <span className="inline-block text-xs font-bold rounded-full px-2 py-0.5 mt-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(249,250,251,0.45)' }}>
                  Coming Soon
                </span>
                <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.30)' }}>
                  Pitching charts · Batting analytics
                </p>
              </Link>
            </AnimateOnScroll>

            <AnimateOnScroll delay={2}>
              <Link
                href="/basketball"
                className="block rounded-2xl p-5 opacity-70"
                style={{
                  background: 'rgba(32,26,22,0.78)',
                  border: '1px solid rgba(148,163,184,0.20)',
                }}
              >
                <p className="font-black text-base" style={{ color: 'rgba(249,250,251,0.55)' }}>Basketball</p>
                <span className="inline-block text-xs font-bold rounded-full px-2 py-0.5 mt-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(249,250,251,0.45)' }}>
                  Coming Soon
                </span>
                <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.30)' }}>
                  Shot charts · Play design
                </p>
              </Link>
            </AnimateOnScroll>

            <AnimateOnScroll delay={3}>
              <Link
                href="/soccer"
                className="block rounded-2xl p-5 opacity-50"
                style={{
                  background: 'rgba(32,26,22,0.78)',
                  border: '1px solid rgba(148,163,184,0.20)',
                }}
              >
                <p className="font-black text-base" style={{ color: 'rgba(249,250,251,0.45)' }}>Soccer · Lacrosse · More</p>
                <span className="inline-block text-xs font-bold rounded-full px-2 py-0.5 mt-2" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(249,250,251,0.35)' }}>
                  On the Roadmap
                </span>
                <p className="text-xs mt-2" style={{ color: 'rgba(249,250,251,0.25)' }}>
                  Growing with your community
                </p>
              </Link>
            </AnimateOnScroll>
          </div>

          {/* Platform promise */}
          <AnimateOnScroll className="mt-12">
            <div
              className="max-w-2xl mx-auto rounded-2xl p-8 text-center"
              style={{
                background: 'rgba(32,26,22,0.78)',
                border: '1px solid rgba(148,163,184,0.16)',
              }}
            >
              <p className="text-lg" style={{ color: '#F9FAFB' }}>
                When your athlete switches from football to baseball season,
                their profile — and their entire history — comes with them.
              </p>
              <p className="font-black mt-3" style={{ color: '#B8CA6E' }}>
                That&apos;s the Youth Coach Hub difference.
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FINAL CTA                                                        */}
      {/* ================================================================= */}
      <section
        className="relative py-32 px-4 sm:px-8 text-center"
        style={{ background: '#1a1410' }}
      >
        <AnimateOnScroll>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: '#F9FAFB' }}>
            Ready for the 2026 Season?
          </h2>
          <p className="text-xl mt-4 mb-10" style={{ color: 'rgba(249,250,251,0.72)' }}>
            Join coaches who are serious about developing their athletes.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <SportSelectorDropdown />
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

          <div className="flex gap-4 justify-center flex-wrap mt-6">
            <Link
              href="/guide"
              className="font-black rounded-2xl px-6 py-3 inline-flex items-center justify-center transition-colors text-sm"
              style={{
                background: 'transparent',
                border: '1px solid rgba(184,202,110,0.35)',
                color: '#B8CA6E',
              }}
            >
              See the Guide →
            </Link>
          </div>

          <p className="text-sm mt-8" style={{ color: 'rgba(249,250,251,0.30)' }}>
            Free tier available · No credit card required to start
          </p>
        </AnimateOnScroll>
      </section>

      {/* ================================================================= */}
      {/* FOOTER                                                           */}
      {/* ================================================================= */}
      <footer
        className="py-8 px-4 sm:px-8"
        style={{
          background: '#120e0b',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-darkmode.png" alt="Youth Coach Hub" className="h-7 w-auto" />
            <span className="text-xs" style={{ color: 'rgba(249,250,251,0.40)' }}>
              © 2026 Youth Coach Hub LLC
            </span>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: 'Football', href: '/football' },
              { label: 'Guide', href: '/guide' },
              { label: 'Support', href: '/guide/support/providing-feedback' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs transition-colors hover:text-[#F9FAFB]"
                style={{ color: 'rgba(249,250,251,0.40)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
