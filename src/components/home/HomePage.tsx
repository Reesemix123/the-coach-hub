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
      <main className="bg-[#1a1410] min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden -mt-24 bg-[#1a1410]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* Single Fixed Background for entire page */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/marketing/friday-night-field.png)',
            backgroundPosition: 'center 5%'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/20 via-[#1a1410]/30 to-[#1a1410]/75"></div>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 fade-in backdrop-blur-sm" style={{ background: 'rgba(26,20,16,.65)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-10 w-auto"
            />
            <span className="text-white font-semibold text-lg tracking-tight">
              youth<span className="text-[#B8CA6E]">coach</span>hub
            </span>
          </Link>

          <div className="flex items-center gap-8">
            <a href="#features" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Features</a>
            <Link href="/pricing" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Pricing</Link>
            <Link href="/auth/login" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Log In</Link>
            <Link href="/auth/signup" className="h-12 px-5 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-colors text-sm flex items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }}>
              Start Free
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center max-w-5xl mx-auto py-16">
          <div>
            <h1 className="fade-in fade-in-delay-1 text-4xl md:text-6xl font-black text-[#F9FAFB] mb-6 leading-tight" style={{ letterSpacing: '-0.9px' }}>
              Pro-Level Tools.
              <br />
              Youth Program Pricing.
            </h1>

            <p className="fade-in fade-in-delay-2 text-lg mb-10 max-w-2xl mx-auto leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>
              Plan practices, manage your program, and coach with confidence.<br />Powered by your AI coaching co-pilot.
            </p>

            <div className="fade-in fade-in-delay-2 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup" className="h-14 px-7 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-all text-lg flex items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }}>
                Start Free Trial
              </Link>
              <button
                onClick={() => onboarding?.startDemoTour()}
                className="h-14 px-7 text-white font-black rounded-2xl transition-all text-lg flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(15,23,42,.28)',
                  border: '1px solid rgba(148,163,184,.20)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)'
                }}
              >
                Take a Tour
              </button>
            </div>
          </div>

          {/* Value Props */}
          <div className="fade-in fade-in-delay-3 mt-10">
            <p className="text-sm mb-6 font-bold" style={{ color: 'rgba(249,250,251,.85)' }}>Built for youth and high school coaches</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Digital Playbook Builder</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Pro-Level Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>AI Insights & Film Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <svg className="w-6 h-6" style={{ color: 'rgba(249,250,251,.55)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Problem Statement Section */}
      <section className="relative py-16 px-8">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-[#B8CA6E] font-black tracking-widest uppercase text-xs mb-4">The Reality</p>
          <h2 className="text-2xl md:text-4xl font-black text-[#F9FAFB] mb-6 leading-tight" style={{ letterSpacing: '-0.6px' }}>
            College and Pro Teams Have Entire Staff Rooms.
            <br />
            <span style={{ color: 'rgba(249,250,251,.72)' }}>You Have Tuesday Nights After Work.</span>
          </h2>
          <p className="text-base max-w-2xl mx-auto leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>
            Youth and high school coaches deserve the same powerful tools—without the price tag designed for college programs.
            Finally, there&apos;s a platform built specifically for you.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 px-8">
        <div className="relative z-10 max-w-5xl mx-auto">
          {/* 2x2 Feature Grid */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Feature 1: Digital Playbook */}
            <div className="group p-6 rounded-2xl transition-all" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                  <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F9FAFB] mb-1">Digital Playbook</h3>
                  <p className="text-sm leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Create, organize, and manage your entire playbook digitally. Visual play builder makes it simple.</p>
                </div>
              </div>
            </div>

            {/* Feature 2: Pro Analytics */}
            <div className="group p-6 rounded-2xl transition-all" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                  <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F9FAFB] mb-1">Pro-Level Analytics</h3>
                  <p className="text-sm leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>The same analysis tools the pros use. Tendencies, success rates, and insights—finally accessible.</p>
                </div>
              </div>
            </div>

            {/* Feature 3: AI Film Tagging */}
            <div className="group p-6 rounded-2xl transition-all" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                  <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F9FAFB] mb-1">AI Film Tagging</h3>
                  <p className="text-sm leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Your Co-Pilot cuts film tagging time by 50%. AI suggests, you confirm. Hours become minutes.</p>
                </div>
              </div>
            </div>

            {/* Feature 4: Game-Day Preparation */}
            <div className="group p-6 rounded-2xl transition-all" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                  <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F9FAFB] mb-1">Game-Day Preparation</h3>
                  <p className="text-sm leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Show up on game day with a real plan. Build on your team&apos;s proven strengths against opponent tendencies.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Co-Pilot Deep Dive Section */}
      <section className="relative py-20 px-8">
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <p className="text-[#B8CA6E] font-black tracking-widest uppercase text-sm mb-4">Meet Your Coaching Co-Pilot</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F9FAFB] mb-6" style={{ letterSpacing: '-0.6px' }}>
                Like Having a Coaching Staff
                <br />
                <span style={{ color: 'rgba(249,250,251,.72)' }}>In Your Pocket</span>
              </h2>
              <p className="text-lg mb-8 leading-relaxed font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>
                Your AI Co-Pilot knows your team, your plays, and your opponents. Ask it anything:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'rgba(32,26,22,.65)', border: '1px solid rgba(148,163,184,.16)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                    <span className="text-[#B8CA6E] text-sm font-black">?</span>
                  </div>
                  <div>
                    <p className="text-[#F9FAFB] font-black">&quot;What plays work best on 3rd and long?&quot;</p>
                    <p className="text-sm mt-1 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>Instant analysis from your own game data</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'rgba(32,26,22,.65)', border: '1px solid rgba(148,163,184,.16)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                    <span className="text-[#B8CA6E] text-sm font-black">?</span>
                  </div>
                  <div>
                    <p className="text-[#F9FAFB] font-black">&quot;Build me a game plan for Friday&apos;s opponent&quot;</p>
                    <p className="text-sm mt-1 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>Scouting insights + recommended plays</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'rgba(32,26,22,.65)', border: '1px solid rgba(148,163,184,.16)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                    <span className="text-[#B8CA6E] text-sm font-black">?</span>
                  </div>
                  <div>
                    <p className="text-[#F9FAFB] font-black">&quot;What are our offensive tendencies they&apos;ll scout?&quot;</p>
                    <p className="text-sm mt-1 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>See your team the way opponents do</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#B8CA6E]/5 rounded-3xl blur-3xl"></div>
              <div className="relative rounded-2xl p-8" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
                <div className="flex items-center gap-3 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(148,163,184,.16)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(184,202,110,.12)', border: '1px solid rgba(184,202,110,.18)' }}>
                    <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[#F9FAFB] font-black">Coach Co-Pilot</p>
                    <p className="text-xs font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>AI Assistant</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-end">
                    <div className="px-4 py-2 rounded-2xl rounded-br-md max-w-[80%] font-bold" style={{ background: 'rgba(184,202,110,.10)', color: 'rgba(249,250,251,.86)' }}>
                      What should we focus on for Saturday&apos;s game?
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%] font-bold" style={{ background: 'rgba(30,41,59,.55)', color: 'rgba(249,250,251,.86)' }}>
                      <p className="mb-2">Based on your last 3 games and Lincoln&apos;s film:</p>
                      <p className="text-[#B8CA6E]">1. They struggle against outside runs—your Power Sweep has 67% success rate</p>
                      <p className="text-[#B8CA6E] mt-1">2. Their CB #7 bites on play-action every time</p>
                      <p className="text-[#B8CA6E] mt-1">3. Suggest opening with I-Form to set up PA Boot</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative py-20 px-8">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="grid md:grid-cols-3 gap-5 mb-6">
            <Link href="/pricing" className="p-6 rounded-2xl relative cursor-pointer hover:scale-[1.02] transition-transform" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <p className="text-sm mb-2 font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Basic</p>
              <p className="text-3xl font-black text-[#F9FAFB]">Free</p>
              <p className="text-xs mt-2 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>Get started</p>
            </Link>

            <Link href="/pricing" className="p-6 rounded-2xl relative cursor-pointer hover:scale-[1.02] transition-transform" style={{ background: 'rgba(32,26,22,.78)', border: '2px solid rgba(184,202,110,.38)', boxShadow: '0 18px 42px rgba(0,0,0,.35)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#B8CA6E] text-[#1a1410] text-xs font-black rounded-full" style={{ boxShadow: '0 14px 32px rgba(184,202,110,.16)' }}>
                Most Popular
              </div>
              <p className="text-sm mb-2 font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Plus</p>
              <p className="text-3xl font-black text-[#F9FAFB]">$29<span className="text-base font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>/mo</span></p>
              <p className="text-xs mt-2 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>Full AI coaching assist</p>
            </Link>

            <Link href="/pricing" className="p-6 rounded-2xl relative cursor-pointer hover:scale-[1.02] transition-transform" style={{ background: 'rgba(32,26,22,.78)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
              <p className="text-sm mb-2 font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>Premium</p>
              <p className="text-3xl font-black text-[#F9FAFB]">$79<span className="text-base font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>/mo</span></p>
              <p className="text-xs mt-2 font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>Full AI + max film storage</p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-8">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-black text-[#F9FAFB] mb-4" style={{ letterSpacing: '-0.8px' }}>
            Your Players Deserve a Prepared Coach.
            <br />
            <span style={{ color: 'rgba(249,250,251,.72)' }}>You Deserve Better Tools.</span>
          </h2>
          <p className="text-lg mb-8 font-bold" style={{ color: 'rgba(249,250,251,.72)' }}>
            Join coaches who are leveling up their game—without breaking their budget.
          </p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center h-14 px-7 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-all text-lg" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.14)' }}>
            Start Your Free Trial
          </Link>
          <p className="mt-4 text-sm font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-8 bg-[#1a1410] border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-8 w-auto"
            />
            <span className="text-[#F9FAFB] font-black tracking-tight">
              youth<span className="text-[#B8CA6E]">coach</span>hub
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm font-bold" style={{ color: 'rgba(249,250,251,.55)' }}>
            <Link href="/about" className="hover:text-[#F9FAFB] transition-colors">About</Link>
            <Link href="/contact" className="hover:text-[#F9FAFB] transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-[#F9FAFB] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#F9FAFB] transition-colors">Terms</Link>
          </div>

          <p className="text-sm font-bold" style={{ color: 'rgba(249,250,251,.55)', opacity: 0.85 }}>© 2026 Youth Coach Hub</p>
        </div>
      </footer>

      {/* Trial Request Modal */}
      {showTrialModal && trialsEnabled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#B8CA6E]/20 rounded-full flex items-center justify-center">
                <Gift className="h-5 w-5 text-[#B8CA6E]" />
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
                    className="w-full px-3 py-2 bg-[#1a1410] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-[#1a1410] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-[#1a1410] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] focus:border-transparent resize-none"
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
                    className="w-full px-3 py-2 bg-[#1a1410] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] focus:border-transparent"
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
                    className="flex-1 px-4 py-2.5 bg-[#B8CA6E] text-[#1a1410] rounded-lg hover:bg-[#c9d88a] transition-colors font-medium disabled:opacity-50"
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
                className="w-full px-4 py-2.5 bg-[#B8CA6E] text-[#1a1410] rounded-lg hover:bg-[#c9d88a] transition-colors font-medium"
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
      <main className="bg-[#1a1410] min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
