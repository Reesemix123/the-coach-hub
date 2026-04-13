'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import { Gift, Users, Shield, ChevronRight, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useGlobalOnboardingSafe } from '@/components/onboarding';
import type { SubscriptionTier } from '@/types/admin';
import { PricingGrid } from '@/components/pricing';
import { FEATURE_DEMOS, getFeatureById } from '@/config/featureDemos';
import FeatureCard from '@/components/home/FeatureCard';
import FeatureDemoModal from '@/components/home/FeatureDemoModal';
import { trackFeatureModalOpen } from '@/utils/analytics';

// Pricing tier configurations
interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  annual_savings: number;
  monthly_upload_tokens: number;
  max_cameras_per_game: number;
  retention_days: number;
  features: string[];
}

const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, Omit<PricingTier, 'id'>> = {
  basic: {
    name: 'Basic',
    description: 'Perfect for getting started',
    price_monthly: 0,
    price_annual: 0,
    annual_savings: 0,
    monthly_upload_tokens: 2,
    max_cameras_per_game: 1,
    retention_days: 30,
    features: [
      '2 games/month (1 team + 1 opponent)',
      '1 camera per game',
      '5 GB per game, 10 GB total',
      '30-day film retention',
      'Up to 3 coaches',
      'All features included'
    ]
  },
  plus: {
    name: 'Plus',
    description: 'For active coaching programs',
    price_monthly: 29.99,
    price_annual: 299.99,
    annual_savings: 60,
    monthly_upload_tokens: 4,
    max_cameras_per_game: 3,
    retention_days: 180,
    features: [
      '4 games/month (2 team + 2 opponent)',
      '3 cameras per game',
      '10 GB per game, ~240 GB total',
      '180-day film retention',
      'Up to 5 coaches',
      'All features included'
    ]
  },
  premium: {
    name: 'Premium',
    description: 'Maximum capacity for serious programs',
    price_monthly: 79.99,
    price_annual: 799.99,
    annual_savings: 160,
    monthly_upload_tokens: 8,
    max_cameras_per_game: 5,
    retention_days: 365,
    features: [
      '8 games/month (4 team + 4 opponent)',
      '5 cameras per game',
      '25 GB per game, ~2.4 TB total',
      '365-day film retention',
      'Up to 10 coaches',
      'All features included'
    ]
  }
};

const faqs = [
  { question: 'Can I change my plan later?', answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.' },
  { question: 'What are upload tokens?', answer: 'Upload tokens are used to upload game film to the platform. Each game you upload uses 1 token. Tokens refresh monthly. If you need more tokens, you can upgrade to a higher plan.' },
  { question: 'How many cameras can I use per game?', answer: 'Each plan includes a certain number of camera angles per game. Basic allows 1 camera, Plus allows 3 cameras, and Premium allows 5 cameras. This lets you capture sideline, end zone, and other angles.' },
  { question: 'What is game retention?', answer: 'Game retention is how long your uploaded games stay on the platform. Basic keeps games for 30 days, Plus for 6 months, and Premium for a full year. After this period, games are automatically archived.' },
  { question: 'What if I run out of upload tokens?', answer: 'Tokens refresh at the start of each billing cycle. If you frequently run out of tokens, consider upgrading to a higher plan for more monthly uploads.' },
  { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe.' },
  { question: 'Can I cancel at any time?', answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your current billing period.' },
];

interface UserTeam {
  id: string;
  name: string;
  tier: SubscriptionTier;
  tier_display_name: string;
  role: 'owner' | 'coach';
}

// Component that uses searchParams - must be wrapped in Suspense
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = useGlobalOnboardingSafe();
  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [trialsEnabled, setTrialsEnabled] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialSubmitting, setTrialSubmitting] = useState(false);
  const [trialMessage, setTrialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trialEmail, setTrialEmail] = useState('');
  const [trialName, setTrialName] = useState('');
  const [trialReason, setTrialReason] = useState('');
  const [trialTier, setTrialTier] = useState('plus');
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClient();

  const tiers: PricingTier[] = (['basic', 'plus', 'premium'] as SubscriptionTier[]).map(tierId => ({
    id: tierId,
    ...DEFAULT_TIER_CONFIGS[tierId]
  }));

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
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      // Fetch all owned teams with subscription info
      const { data: ownedTeams } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          subscriptions(tier)
        `)
        .eq('user_id', user.id);

      // Fetch all teams where user is a member
      const { data: memberTeams } = await supabase
        .from('team_memberships')
        .select(`
          team:teams(
            id,
            name,
            subscriptions(tier)
          )
        `)
        .eq('user_id', user.id);

      // Build combined list of user's teams
      const allTeams: UserTeam[] = [];

      // Add owned teams
      if (ownedTeams) {
        for (const team of ownedTeams) {
          const subscription = team.subscriptions as { tier: SubscriptionTier }[] | null;
          const tier = subscription?.[0]?.tier || 'basic';
          allTeams.push({
            id: team.id,
            name: team.name,
            tier,
            tier_display_name: tier === 'basic' ? 'Basic' : tier === 'plus' ? 'Plus' : 'Premium',
            role: 'owner',
          });
        }
      }

      // Add member teams (avoiding duplicates if somehow both owner and member)
      if (memberTeams) {
        for (const membership of memberTeams) {
          // Team might be an array or single object depending on Supabase version
          const teamData = membership.team;
          const team = Array.isArray(teamData) ? teamData[0] : teamData;
          if (team && !allTeams.find(t => t.id === team.id)) {
            const subscriptions = team.subscriptions as { tier: SubscriptionTier }[] | null;
            const tier = subscriptions?.[0]?.tier || 'basic';
            allTeams.push({
              id: team.id,
              name: team.name,
              tier,
              tier_display_name: tier === 'basic' ? 'Basic' : tier === 'plus' ? 'Plus' : 'Premium',
              role: 'coach',
            });
          }
        }
      }

      // Decision tree:
      // 0 teams → setup
      // 1 team → redirect directly
      // 2+ teams → show team selector
      if (allTeams.length === 0) {
        router.push('/setup');
        return;
      }

      if (allTeams.length === 1) {
        router.push(`/football/teams/${allTeams[0].id}`);
        return;
      }

      // Multiple teams - show selector
      setUserTeams(allTeams);
      setShowTeamSelector(true);
      setLoading(false);
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

  // Team selector for users with multiple teams
  if (showTeamSelector && userTeams.length > 0) {
    const getTierBadgeStyle = (tier: SubscriptionTier) => {
      switch (tier) {
        case 'premium':
          return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'plus':
          return 'bg-amber-100 text-amber-800 border-amber-200';
        default:
          return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };

    return (
      <main className="min-h-screen bg-gray-50 -mt-24 pt-24">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a Team</h1>
            <p className="text-gray-600">Choose which team you want to work with</p>
          </div>

          <div className="space-y-4">
            {userTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => router.push(`/football/teams/${team.id}`)}
                className="w-full p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-semibold">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getTierBadgeStyle(team.tier)}`}>
                          {team.tier_display_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {team.role === 'owner' ? (
                          <>
                            <Shield className="h-4 w-4" />
                            <span>Owner</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4" />
                            <span>Coach</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/setup"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span>Create a new team</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
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
        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 fade-in backdrop-blur-sm" style={{ background: 'rgba(26,20,16,.65)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-8 sm:h-10 w-auto"
            />
            <span className="hidden sm:inline text-white font-semibold text-lg tracking-tight">
              youth<span className="text-[#B8CA6E]">coach</span>hub
            </span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-8">
            <a href="#features" className="hidden sm:inline text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Features</a>
            <a href="#pricing" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold cursor-pointer" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>Pricing</a>
            <Link href="/auth/login" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Log In</Link>
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
              <a href="#pricing" className="h-14 px-7 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-all text-lg flex items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }} onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>
                See Pricing
              </a>
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
            {FEATURE_DEMOS.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                onClick={() => {
                  trackFeatureModalOpen(feature.id);
                  setActiveFeatureId(feature.id);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Demo Modal */}
      {activeFeatureId && (
        <FeatureDemoModal
          feature={getFeatureById(activeFeatureId)!}
          isOpen={!!activeFeatureId}
          onClose={() => setActiveFeatureId(null)}
          onNavigateToFeature={(featureId) => {
            trackFeatureModalOpen(featureId);
            setActiveFeatureId(featureId);
          }}
          isAuthenticated={isAuthenticated}
        />
      )}

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
      <section id="pricing" className="relative py-20 px-4 sm:px-8">
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white" style={{ letterSpacing: '-0.8px' }}>
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-300/80 max-w-2xl mx-auto">
              Choose the plan that fits your program. Use upload tokens to add games,
              multiple camera angles for better coverage, and keep your games for longer.
            </p>
          </div>
          <PricingGrid tiers={tiers} />
          <p className="text-center text-sm text-gray-400/60 mt-8">
            All plans include every feature. Only capacity differs.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-16 px-4 sm:px-8">
        <div className="relative z-10 mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group rounded-2xl border border-white/10 bg-[#201a16]/60 backdrop-blur-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-left">
                  <span className="font-medium text-white">{faq.question}</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4">
                  <p className="text-gray-300/80">{faq.answer}</p>
                </div>
              </details>
            ))}
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
          <a href="#pricing" className="inline-flex items-center justify-center h-14 px-7 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-all text-lg" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.14)' }} onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>
            Get Started Today
          </a>
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
