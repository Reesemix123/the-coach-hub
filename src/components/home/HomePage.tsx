'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import { Gift } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useGlobalOnboardingSafe } from '@/components/onboarding';

// Component that uses searchParams - must be wrapped in Suspense
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = useGlobalOnboardingSafe();
  const [loading, setLoading] = useState(true);
  const [trialsEnabled, setTrialsEnabled] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialSubmitting, setTrialSubmitting] = useState(false);
  const [trialMessage, setTrialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trialEmail, setTrialEmail] = useState('');
  const [trialName, setTrialName] = useState('');
  const [trialReason, setTrialReason] = useState('');
  const [trialTier, setTrialTier] = useState('plus');
  const supabase = createClient();

  useEffect(() => {
    checkUserTeams();
    checkTrialsEnabled();
  }, []);

  useEffect(() => {
    if (searchParams.get('trial') === 'true' && trialsEnabled) {
      setShowTrialModal(true);
    }
  }, [searchParams, trialsEnabled]);

  async function checkTrialsEnabled() {
    try {
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'trial_enabled')
        .single();

      const enabled = data?.value === true || data?.value === 'true';
      setTrialsEnabled(enabled);
    } catch {
      setTrialsEnabled(false);
    }
  }

  async function handleRequestTrial() {
    if (!trialEmail.trim()) {
      setTrialMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    if (!trialName.trim()) {
      setTrialMessage({ type: 'error', text: 'Please enter your name.' });
      return;
    }
    if (!trialReason.trim()) {
      setTrialMessage({ type: 'error', text: 'Please tell us why you\'re interested in a trial.' });
      return;
    }

    setTrialSubmitting(true);
    setTrialMessage(null);

    try {
      const response = await fetch('/api/trial-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trialEmail.trim(),
          name: trialName.trim(),
          reason: trialReason.trim(),
          requested_tier: trialTier
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTrialMessage({
          type: 'success',
          text: 'Trial request submitted! We\'ll review your request and get back to you shortly.'
        });
        setTrialEmail('');
        setTrialName('');
        setTrialReason('');
        setTrialTier('plus');
      } else {
        setTrialMessage({ type: 'error', text: result.error || 'Failed to submit request' });
      }
    } catch (error) {
      console.error('Error requesting trial:', error);
      setTrialMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setTrialSubmitting(false);
    }
  }

  async function checkUserTeams() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: ownedTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (ownedTeams && ownedTeams.length > 0) {
        router.push(`/teams/${ownedTeams[0].id}`);
        return;
      }

      const { data: memberTeams } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberTeams && memberTeams.length > 0) {
        router.push(`/teams/${memberTeams[0].team_id}`);
        return;
      }

      router.push('/setup');
    } catch (error) {
      console.error('Error checking teams:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-[#0d1117] min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="bg-[#0d1117] min-h-screen overflow-x-hidden -mt-24" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col">

        {/* Bokeh Background Effect - Stadium Lights */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="bokeh-1 absolute top-20 left-[10%] w-64 h-64 rounded-full bg-amber-400/20 blur-3xl"></div>
          <div className="bokeh-2 absolute top-40 right-[15%] w-48 h-48 rounded-full bg-amber-300/15 blur-3xl"></div>
          <div className="bokeh-3 absolute top-10 right-[30%] w-32 h-32 rounded-full bg-amber-500/25 blur-2xl"></div>
          <div className="bokeh-4 absolute top-60 left-[25%] w-40 h-40 rounded-full bg-amber-400/10 blur-3xl"></div>
          <div className="bokeh-5 absolute top-32 left-[50%] w-56 h-56 rounded-full bg-amber-300/15 blur-3xl"></div>
          <div className="absolute top-48 right-[40%] w-20 h-20 rounded-full bg-white/10 blur-xl"></div>
          <div className="absolute top-72 left-[40%] w-16 h-16 rounded-full bg-amber-200/20 blur-xl"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117]/50 via-[#0d1117]/70 to-[#0d1117]"></div>
        </div>

        {/* Animated Play Routes SVG with X's and O's */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.08 }}>
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a3e635" stopOpacity="0" />
              <stop offset="50%" stopColor="#a3e635" stopOpacity="1" />
              <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Formation 1: Left side - Spread formation */}
          <g className="formation-1" style={{ animation: 'fadeInOut 12s ease-in-out infinite' }}>
            <circle cx="8%" cy="45%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="12%" cy="45%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="16%" cy="45%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="20%" cy="45%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="24%" cy="45%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="16%" cy="52%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="16%" cy="60%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="3%" cy="45%" r="6" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="29%" cy="45%" r="6" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <path className="route-draw-1" d="M 3% 45% L 3% 35% L 12% 25%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="route-draw-2" d="M 29% 45% L 29% 38% L 22% 30%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="route-draw-3" d="M 16% 60% L 24% 60% L 30% 50%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </g>

          {/* Formation 2: Right side - I Formation */}
          <g className="formation-2" style={{ animation: 'fadeInOut 12s ease-in-out infinite 4s' }}>
            <circle cx="75%" cy="65%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="79%" cy="65%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="83%" cy="65%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="87%" cy="65%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="91%" cy="65%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="83%" cy="72%" r="8" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="83%" cy="79%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="83%" cy="86%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="95%" cy="65%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <path className="route-draw-4" d="M 95% 65% L 95% 55% L 88% 48%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="route-draw-5" d="M 83% 86% L 75% 86% L 70% 75%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </g>

          {/* Formation 3: Center - Shotgun */}
          <g className="formation-3" style={{ animation: 'fadeInOut 12s ease-in-out infinite 8s' }}>
            <circle cx="42%" cy="30%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="46%" cy="30%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="50%" cy="30%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="54%" cy="30%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="58%" cy="30%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="50%" cy="40%" r="7" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="56%" cy="40%" r="6" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <circle cx="35%" cy="30%" r="6" fill="none" stroke="#a3e635" strokeWidth="2"/>
            <path className="route-draw-6" d="M 35% 30% L 35% 20% L 45% 12%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="route-draw-7" d="M 56% 40% L 62% 40% L 68% 32%" stroke="#a3e635" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </g>

          {/* Defensive X's scattered - Formation 1 area */}
          <g className="defense-1" style={{ animation: 'fadeInOut 12s ease-in-out infinite' }}>
            <text x="8%" y="38%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="16%" y="36%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="24%" y="38%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="12%" y="30%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
            <text x="20%" y="30%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
          </g>

          {/* Defensive X's - Formation 2 area */}
          <g className="defense-2" style={{ animation: 'fadeInOut 12s ease-in-out infinite 4s' }}>
            <text x="75%" y="58%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="83%" y="56%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="91%" y="58%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="79%" y="50%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
            <text x="87%" y="50%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
          </g>

          {/* Defensive X's - Formation 3 area */}
          <g className="defense-3" style={{ animation: 'fadeInOut 12s ease-in-out infinite 8s' }}>
            <text x="42%" y="23%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="50%" y="21%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="58%" y="23%" fill="#a3e635" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
            <text x="46%" y="16%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
            <text x="54%" y="16%" fill="#a3e635" fontSize="12" fontWeight="bold" textAnchor="middle">×</text>
          </g>
        </svg>

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 fade-in">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-10 w-auto"
            />
            <span className="text-white font-semibold text-lg tracking-tight">
              youth<span className="text-[#a3e635]">coach</span>hub
            </span>
          </Link>

          <div className="flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</a>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">Pricing</Link>
            <Link href="/auth/login" className="text-gray-400 hover:text-white transition-colors text-sm">Log In</Link>
            <Link href="/auth/signup" className="px-5 py-2.5 bg-[#a3e635] text-[#0d1117] font-semibold rounded-lg hover:bg-[#bef264] transition-colors text-sm">
              Start Free
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center max-w-5xl mx-auto">
          <div>
            {/* Co-Pilot Badge */}
            <div className="fade-in fade-in-delay-1 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#a3e635]/10 border border-[#a3e635]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#a3e635] animate-pulse"></span>
              <span className="text-[#a3e635] text-sm font-medium">Your AI Coaching Co-Pilot</span>
            </div>

            <h1 className="fade-in fade-in-delay-1 text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
              Pro-Level Tools.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a3e635] to-[#84cc16]">
                Youth Program Pricing.
              </span>
            </h1>

            <p className="fade-in fade-in-delay-2 text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              AI helps you handle the work off the field—so you can show up prepared, focused, and ready to{' '}
              <span className="text-white">coach your players on the field.</span>
            </p>

            <div className="fade-in fade-in-delay-2 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup" className="btn-glow px-8 py-4 bg-[#a3e635] text-[#0d1117] font-semibold rounded-xl hover:bg-[#bef264] transition-all hover:scale-105 text-lg">
                Start Free Trial
              </Link>
              <button
                onClick={() => onboarding?.startDemoTour()}
                className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20 text-lg flex items-center justify-center gap-2"
              >
                Take a Tour
              </button>
            </div>
          </div>

          {/* Value Props */}
          <div className="fade-in fade-in-delay-3 mt-10">
            <p className="text-gray-500 text-sm mb-6">Built for youth and high school coaches</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Digital Playbook Builder</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Pro-Level Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>AI Co-Pilot Insights</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Game-Day Ready Plans</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 pb-8 flex justify-center fade-in fade-in-delay-3">
          <div className="animate-bounce">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Problem Statement Section */}
      <section className="relative py-12 px-8 bg-[#0d1117] border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#a3e635] font-medium tracking-widest uppercase text-sm mb-4">The Reality</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            College and Pro Teams Have Entire Staff Rooms.
            <br />
            <span className="text-gray-400">You Have Tuesday Nights After Work.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Youth and high school coaches deserve the same powerful tools—without the price tag designed for college programs.
            Finally, there&apos;s a platform built specifically for you.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 px-8 bg-[#0d1117]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#a3e635] font-medium tracking-widest uppercase text-sm mb-4">Your Co-Pilot Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need.
              <br />
              <span className="text-gray-400">Nothing You Don&apos;t.</span>
            </h2>
          </div>

          {/* Top Row: 3 cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Feature 1: Digital Playbook */}
            <div className="group p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-[#a3e635]/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center mb-5 group-hover:bg-[#a3e635]/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Digital Playbook</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Create, organize, and manage your entire playbook digitally. Visual play builder makes it simple.</p>
            </div>

            {/* Feature 2: AI Film Tagging */}
            <div className="group p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-[#a3e635]/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center mb-5 group-hover:bg-[#a3e635]/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Film Tagging</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Your Co-Pilot cuts film tagging time by 50%. AI suggests, you confirm. Hours become minutes.</p>
            </div>

            {/* Feature 3: Pro Analytics */}
            <div className="group p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-[#a3e635]/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center mb-5 group-hover:bg-[#a3e635]/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Pro-Level Analytics</h3>
              <p className="text-gray-400 text-sm leading-relaxed">The same analysis tools the pros use. Tendencies, success rates, and insights—finally accessible to you.</p>
            </div>
          </div>

          {/* Bottom Row: Game-Day Prep (wide) + AI Co-Pilot */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 4: Game-Day Preparation (spans 2 columns) */}
            <div className="group md:col-span-2 p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-[#a3e635]/30 transition-all">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="w-12 h-12 rounded-xl bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center flex-shrink-0 group-hover:bg-[#a3e635]/20 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Game-Day Preparation</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Show up on game day with a real plan—not a guess. Your practices are focused on what actually needs work. Your game plan is built on your team&apos;s proven strengths matched against your opponent&apos;s real tendencies.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#a3e635] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-xs">Data-driven practice plans</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#a3e635] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-xs">Opponent scouting reports</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#a3e635] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-xs">Higher probability of success</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 5: AI Coach Co-Pilot */}
            <div className="group p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-[#a3e635]/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center mb-5 group-hover:bg-[#a3e635]/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Coach Co-Pilot</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Your coach of coaches. Ask questions, identify trends, get insights, and show up ready.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Co-Pilot Deep Dive Section */}
      <section className="relative py-24 px-8 bg-[#161b22]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <p className="text-[#a3e635] font-medium tracking-widest uppercase text-sm mb-4">Meet Your Co-Pilot</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Like Having a Coaching Staff
                <br />
                <span className="text-gray-400">In Your Pocket</span>
              </h2>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Your AI Co-Pilot knows your team, your plays, and your opponents. Ask it anything:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[#0d1117] border border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#a3e635] text-sm">?</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">&quot;What plays work best on 3rd and long?&quot;</p>
                    <p className="text-gray-500 text-sm mt-1">Instant analysis from your own game data</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-[#0d1117] border border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#a3e635] text-sm">?</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">&quot;Build me a game plan for Friday&apos;s opponent&quot;</p>
                    <p className="text-gray-500 text-sm mt-1">Scouting insights + recommended plays</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-[#0d1117] border border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#a3e635] text-sm">?</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">&quot;What are our offensive tendencies they&apos;ll scout?&quot;</p>
                    <p className="text-gray-500 text-sm mt-1">See your team the way opponents do</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#a3e635]/5 rounded-3xl blur-3xl"></div>
              <div className="relative bg-[#0d1117] rounded-2xl border border-gray-800 p-8">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-[#a3e635]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Coach Co-Pilot</p>
                    <p className="text-gray-500 text-xs">AI Assistant</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-end">
                    <div className="bg-[#a3e635]/10 text-gray-300 px-4 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                      What should we focus on for Saturday&apos;s game?
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-[#1e2a3a] text-gray-300 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%]">
                      <p className="mb-2">Based on your last 3 games and Lincoln&apos;s film:</p>
                      <p className="text-[#a3e635]">1. They struggle against outside runs—your Power Sweep has 67% success rate</p>
                      <p className="text-[#a3e635] mt-1">2. Their CB #7 bites on play-action every time</p>
                      <p className="text-[#a3e635] mt-1">3. Suggest opening with I-Form to set up PA Boot</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser Section */}
      <section className="relative py-24 px-8 bg-[#0d1117]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#a3e635] font-medium tracking-widest uppercase text-sm mb-4">Pricing That Makes Sense</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Finally, Tools You Can Actually Afford
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            The tools the pros use? They cost thousands per year. We built Youth Coach Hub for coaches who pay out of pocket—not programs with athletic department budgets.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-2xl bg-[#161b22] border border-gray-800">
              <p className="text-gray-400 text-sm mb-2">Basic</p>
              <p className="text-4xl font-bold text-white">Free</p>
              <p className="text-gray-500 text-sm mt-2">Start here. You&apos;ll want more.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#161b22] border border-[#a3e635]/50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#a3e635] text-[#0d1117] text-xs font-semibold rounded-full">
                Most Popular
              </div>
              <p className="text-gray-400 text-sm mb-2">Plus</p>
              <p className="text-4xl font-bold text-white">$29<span className="text-lg text-gray-400">/mo</span></p>
              <p className="text-gray-500 text-sm mt-2">Full Co-Pilot access</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#161b22] border border-gray-800">
              <p className="text-gray-400 text-sm mb-2">Premium</p>
              <p className="text-4xl font-bold text-white">$79<span className="text-lg text-gray-400">/mo</span></p>
              <p className="text-gray-500 text-sm mt-2">Unlimited everything</p>
            </div>
          </div>

          <p className="text-gray-500 text-sm">
            That&apos;s less than a set of practice cones. <span className="text-gray-400">Seriously.</span>
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 px-8 bg-gradient-to-b from-[#0d1117] to-[#161b22]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Your Players Deserve a Prepared Coach.
            <br />
            <span className="text-gray-400">You Deserve Better Tools.</span>
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join the coaches who are leveling up their game—without breaking their budget.
          </p>
          <Link href="/auth/signup" className="btn-glow inline-block px-10 py-5 bg-[#a3e635] text-[#0d1117] font-semibold rounded-xl hover:bg-[#bef264] transition-all hover:scale-105 text-lg">
            Start Your Free Trial
          </Link>
          <p className="mt-4 text-gray-500 text-sm">No credit card required • Free tier to get started</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-8 bg-[#161b22] border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-8 w-auto"
            />
            <span className="text-white font-semibold tracking-tight">
              youth<span className="text-[#a3e635]">coach</span>hub
            </span>
          </div>

          <p className="text-gray-500 text-sm">
            Handle the work off the field. Make the difference on it.
          </p>

          <div className="flex items-center gap-6 text-gray-500 text-sm">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

      {/* Trial Request Modal */}
      {showTrialModal && trialsEnabled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#a3e635]/20 rounded-full flex items-center justify-center">
                <Gift className="h-5 w-5 text-[#a3e635]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Request Free Trial</h2>
                <p className="text-sm text-gray-500">14-day full access to all features</p>
              </div>
            </div>

            {trialMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                trialMessage.type === 'success'
                  ? 'bg-green-900/30 text-green-400 border border-green-800'
                  : 'bg-red-900/30 text-red-400 border border-red-800'
              }`}>
                {trialMessage.text}
              </div>
            )}

            {!trialMessage?.type || trialMessage.type !== 'success' ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={trialEmail}
                    onChange={(e) => setTrialEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#a3e635] focus:border-transparent"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={trialName}
                    onChange={(e) => setTrialName(e.target.value)}
                    placeholder="Coach Smith"
                    className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#a3e635] focus:border-transparent"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Why are you interested? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={trialReason}
                    onChange={(e) => setTrialReason(e.target.value)}
                    placeholder="e.g., I coach a youth football team and want to organize our playbook..."
                    className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#a3e635] focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Which plan are you interested in?
                  </label>
                  <select
                    value={trialTier}
                    onChange={(e) => setTrialTier(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#a3e635] focus:border-transparent"
                  >
                    <option value="basic">Basic (Free) - Digital playbook, film upload</option>
                    <option value="plus">Plus ($29/mo) - Full analytics, drive-by-drive</option>
                    <option value="premium">Premium ($79/mo) - Advanced analytics, O-Line grading</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    You can discuss plan options with us during the trial review.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowTrialModal(false);
                      setTrialMessage(null);
                      setTrialEmail('');
                      setTrialName('');
                      setTrialReason('');
                      setTrialTier('plus');
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                    disabled={trialSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestTrial}
                    disabled={trialSubmitting || !trialEmail.trim() || !trialName.trim() || !trialReason.trim()}
                    className="flex-1 px-4 py-2.5 bg-[#a3e635] text-[#0d1117] rounded-lg hover:bg-[#bef264] transition-colors font-medium disabled:opacity-50"
                  >
                    {trialSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowTrialModal(false);
                  setTrialMessage(null);
                }}
                className="w-full px-4 py-2.5 bg-[#a3e635] text-[#0d1117] rounded-lg hover:bg-[#bef264] transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function HomePage() {
  return (
    <Suspense fallback={
      <main className="bg-[#0d1117] min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
