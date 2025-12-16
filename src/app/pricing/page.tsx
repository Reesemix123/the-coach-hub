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
  monthly_upload_tokens: number;
  max_cameras_per_game: number;
  retention_days: number;
  features: string[];
}

// Default tier configs with new token-based system
// NOTE: All tiers have the same features - only capacity differs
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
    price_annual: 299.90,
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
    price_annual: 799.90,
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

// FAQ data
const faqs = [
  {
    question: 'Can I change my plan later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.'
  },
  {
    question: 'What are upload tokens?',
    answer: 'Upload tokens are used to upload game film to the platform. Each game you upload uses 1 token. Tokens refresh monthly. If you need more tokens, you can upgrade to a higher plan.'
  },
  {
    question: 'How many cameras can I use per game?',
    answer: 'Each plan includes a certain number of camera angles per game. Basic allows 1 camera, Plus allows 3 cameras, and Premium allows 5 cameras. This lets you capture sideline, end zone, and other angles.'
  },
  {
    question: 'What is game retention?',
    answer: 'Game retention is how long your uploaded games stay on the platform. Basic keeps games for 30 days, Plus for 6 months, and Premium for a full year. After this period, games are automatically archived.'
  },
  {
    question: 'What if I run out of upload tokens?',
    answer: 'Tokens refresh at the start of each billing cycle. If you frequently run out of tokens, consider upgrading to a higher plan for more monthly uploads.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe.'
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

    // Build tiers array (only 3 tiers: basic, plus, premium)
    const tiers: PricingTier[] = (['basic', 'plus', 'premium'] as SubscriptionTier[]).map(tierId => {
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

    // Return defaults on error (only 3 tiers)
    const tiers: PricingTier[] = (['basic', 'plus', 'premium'] as SubscriptionTier[]).map(tierId => ({
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
  const { tiers } = await getPricingData();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your program. Use upload tokens to add games,
            multiple camera angles for better coverage, and keep your games for longer.
          </p>
        </div>
      </section>

      {/* Pricing Grid */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingGrid tiers={tiers} />
        </div>
      </section>

      {/* Feature Comparison Note */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Need more capacity?</h2>
          <p className="mt-4 text-gray-600">
            Upgrade to a higher plan for more monthly uploads, additional camera angles,
            longer retention, and more storage per game.
          </p>
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
            Join The Coach Hub today to start improving how you coach.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/auth/signup"
              className="rounded-lg bg-white px-6 py-3 text-base font-medium text-gray-900 hover:bg-gray-100"
            >
              Get Started
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
