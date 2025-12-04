// src/app/pricing/page.tsx
// Public pricing page - Server Component for SEO

import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { TierConfigs, TrialConfig, SubscriptionTier } from '@/types/admin';
import { PricingGrid } from '@/components/pricing';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | The Coach Hub',
  description: 'Choose the perfect plan for your coaching program. From youth leagues to elite high school programs, we have a plan that fits your needs.',
};

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  annual_savings: number;
  ai_video_minutes: number;
  ai_text_actions: number | 'unlimited';
  max_coaches: number;
  storage_gb: number;
  features: string[];
  popular?: boolean;
  priority_processing?: boolean;
}

// Default tier configs with new pricing structure
const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, Omit<PricingTier, 'id'>> = {
  basic: {
    name: 'Basic',
    description: 'Perfect for youth leagues and small programs',
    price_monthly: 0,
    price_annual: 0,
    annual_savings: 0,
    ai_video_minutes: 0,
    ai_text_actions: 0,
    max_coaches: 3,
    storage_gb: 10,
    features: [
      'Digital playbook builder',
      'Film upload & playback',
      'Basic play tagging',
      'Roster management',
      'Game scheduling'
    ]
  },
  plus: {
    name: 'Plus',
    description: 'Full analytics for competitive programs',
    price_monthly: 29,
    price_annual: 290,
    annual_savings: 58,
    ai_video_minutes: 30,
    ai_text_actions: 100,
    max_coaches: 5,
    storage_gb: 50,
    features: [
      'Everything in Basic',
      'Drive-by-drive analytics',
      'Player performance stats',
      'Game planning tools',
      'Situational breakdowns'
    ],
    popular: true
  },
  premium: {
    name: 'Premium',
    description: 'Advanced analytics for serious programs',
    price_monthly: 79,
    price_annual: 790,
    annual_savings: 158,
    ai_video_minutes: 120,
    ai_text_actions: 'unlimited',
    max_coaches: 10,
    storage_gb: 200,
    features: [
      'Everything in Plus',
      'O-Line grading & tracking',
      'Defensive player tracking',
      'Advanced situational splits',
      'Opponent scouting reports'
    ]
  },
  ai_powered: {
    name: 'AI Powered',
    description: 'AI-assisted coaching for elite programs',
    price_monthly: 199,
    price_annual: 1990,
    annual_savings: 398,
    ai_video_minutes: 300,
    ai_text_actions: 'unlimited',
    max_coaches: 10,
    storage_gb: 500,
    features: [
      'Everything in Premium',
      'Priority AI processing',
      'Unlimited highlight exports',
      'Custom AI training on your plays',
      'Advanced tendency analysis'
    ],
    priority_processing: true
  }
};

// FAQ data
const faqs = [
  {
    question: 'Can I change my plan later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! Most paid plans include a 14-day free trial. You can explore all features before committing. Your card won\'t be charged until the trial ends.'
  },
  {
    question: 'What are AI film minutes?',
    answer: 'AI film minutes are used for automatic play tagging from your game film. Our AI watches your film and tags plays, formations, and results - saving hours of manual work. Each minute of film analyzed uses 1 AI minute.'
  },
  {
    question: 'What are AI actions?',
    answer: 'AI actions power our text-based AI features: generating scouting reports, practice plans, tendency analysis, and the AI coaching assistant. Plus tier gets 100 actions/month, Premium and AI Powered tiers get unlimited actions.'
  },
  {
    question: 'Can I buy more AI minutes?',
    answer: 'Yes! You can purchase additional AI film minutes at any time. Packs are available from 15 minutes ($15) to 120 minutes ($79). Purchased minutes are valid for 90 days.'
  },
  {
    question: 'Can I add more coaches to my plan?',
    answer: 'Absolutely! You can purchase additional coach seats as add-ons at any time. Volume discounts are available for larger coaching staffs.'
  },
  {
    question: 'What happens when I run out of storage?',
    answer: 'You\'ll receive a notification when approaching your limit. You can either upgrade your plan or purchase additional storage as an add-on.'
  },
  {
    question: 'Do you offer discounts for schools or leagues?',
    answer: 'Yes! We offer special pricing for multi-team organizations and school districts. Contact us for a custom quote.'
  },
  {
    question: 'Can I cancel at any time?',
    answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your current billing period.'
  }
];

async function getPricingData() {
  try {
    const supabase = await createClient();

    // Fetch tier configs
    const { data: tierConfigData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'tier_config')
      .single();

    // Fetch trial config
    const { data: trialConfigData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'trial_config')
      .single();

    const tierConfigs = (tierConfigData?.value as TierConfigs) || null;
    const trialConfig = (trialConfigData?.value as TrialConfig) || {
      trial_enabled: false,
      trial_duration_days: 14,
      trial_allowed_tiers: ['plus', 'premium'] as SubscriptionTier[],
      trial_ai_credits_limit: 25
    };

    // Build tiers array
    const tiers: PricingTier[] = (['basic', 'plus', 'premium', 'ai_powered'] as SubscriptionTier[]).map(tierId => {
      const defaultConfig = DEFAULT_TIER_CONFIGS[tierId];

      return {
        id: tierId,
        ...defaultConfig
      };
    });

    return {
      tiers,
      trialEnabled: trialConfig.trial_enabled,
      trialDurationDays: trialConfig.trial_duration_days,
      trialAllowedTiers: trialConfig.trial_allowed_tiers
    };
  } catch (error) {
    console.error('Error fetching pricing data:', error);

    // Return defaults on error
    const tiers: PricingTier[] = (['basic', 'plus', 'premium', 'ai_powered'] as SubscriptionTier[]).map(tierId => ({
      id: tierId,
      ...DEFAULT_TIER_CONFIGS[tierId]
    }));

    return {
      tiers,
      trialEnabled: false,
      trialDurationDays: 14,
      trialAllowedTiers: ['plus', 'premium'] as SubscriptionTier[]
    };
  }
}

export default async function PricingPage() {
  const { tiers, trialEnabled, trialDurationDays, trialAllowedTiers } = await getPricingData();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your program. All plans include unlimited games,
            plays, and video uploads within your storage limit.
          </p>
          {trialEnabled && (
            <p className="mt-4 text-sm font-medium text-green-600">
              Start with a {trialDurationDays}-day free trial on select plans
            </p>
          )}
        </div>
      </section>

      {/* Pricing Grid */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingGrid
            tiers={tiers}
            trialEnabled={trialEnabled}
            trialAllowedTiers={trialAllowedTiers}
            trialDurationDays={trialDurationDays}
          />
        </div>
      </section>

      {/* AI Minutes Purchase Info */}
      <section className="py-12 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Need more AI film minutes?</h2>
          <p className="mt-4 text-gray-600">
            Purchase additional AI minutes at any time. No subscription required.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-2xl font-bold text-gray-900">15 min</p>
              <p className="text-gray-600">$15</p>
              <p className="text-xs text-gray-500">$1.00/min</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-2xl font-bold text-gray-900">30 min</p>
              <p className="text-gray-600">$25</p>
              <p className="text-xs text-gray-500">$0.83/min</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 ring-2 ring-purple-500">
              <p className="text-xs text-purple-600 font-medium mb-1">Best Value</p>
              <p className="text-2xl font-bold text-gray-900">60 min</p>
              <p className="text-gray-600">$45</p>
              <p className="text-xs text-gray-500">$0.75/min</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-2xl font-bold text-gray-900">120 min</p>
              <p className="text-gray-600">$79</p>
              <p className="text-xs text-gray-500">$0.66/min</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Purchased minutes are valid for 90 days
          </p>
        </div>
      </section>

      {/* Feature Comparison Note */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Need more?</h2>
          <p className="mt-4 text-gray-600">
            All plans can be customized with add-ons for additional coaches, storage,
            and AI credits. Volume discounts available for larger coaching staffs.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block text-sm font-medium text-gray-900 underline hover:no-underline"
          >
            Contact us for custom enterprise pricing
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group rounded-lg border border-gray-200 bg-white"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-left">
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to elevate your coaching?
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Join thousands of coaches using The Coach Hub to build better programs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup?tier=plus"
              className="rounded-lg bg-white px-6 py-3 text-base font-medium text-gray-900 hover:bg-gray-100"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border-2 border-white px-6 py-3 text-base font-medium text-white hover:bg-white/10"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} The Coach Hub. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/about" className="text-sm text-gray-500 hover:text-gray-700">
                About
              </Link>
              <Link href="/contact" className="text-sm text-gray-500 hover:text-gray-700">
                Contact
              </Link>
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
