// src/app/pricing/page.tsx
// Public pricing page - Server Component for SEO

import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { TierConfigs, TrialConfig, SubscriptionTier } from '@/types/admin';
import { PricingGrid } from '@/components/pricing';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | Youth Coach Hub',
  description: 'Choose the perfect plan for your coaching program. From youth leagues to elite high school programs, we have a plan that fits your needs.',
};

interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  price_monthly: number;
  ai_credits: number;
  max_coaches: number;
  storage_gb: number;
  features: string[];
  popular?: boolean;
}

// Default tier configs
const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, Omit<PricingTier, 'id'>> = {
  basic: {
    name: 'Basic',
    description: 'Perfect for youth leagues and small programs',
    price_monthly: 0,
    ai_credits: 0,
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
    ai_credits: 100,
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
    ai_credits: 500,
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
    price_monthly: 149,
    ai_credits: 2000,
    max_coaches: 10,
    storage_gb: 500,
    features: [
      'Everything in Premium',
      'Priority AI processing',
      'Unlimited highlight exports',
      'Custom AI training on your plays',
      'Dedicated support'
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
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! Most paid plans include a 14-day free trial. You can explore all features before committing. Your card won\'t be charged until the trial ends.'
  },
  {
    question: 'What are AI credits and how are they used?',
    answer: 'AI credits power our AI features: auto-tagging plays from film (saves hours of manual tagging), generating game insights and tendencies, creating highlight reels automatically, and analyzing opponent patterns. Each AI action uses credits based on complexity. Credits reset monthly with your billing cycle.'
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
      const dbConfig = tierConfigs?.[tierId];
      const defaultConfig = DEFAULT_TIER_CONFIGS[tierId];

      return {
        id: tierId,
        name: dbConfig?.name || defaultConfig.name,
        description: dbConfig?.description || defaultConfig.description,
        price_monthly: dbConfig?.price_monthly ?? defaultConfig.price_monthly,
        ai_credits: dbConfig?.ai_credits ?? defaultConfig.ai_credits,
        max_coaches: dbConfig?.max_coaches ?? defaultConfig.max_coaches,
        storage_gb: dbConfig?.storage_gb ?? defaultConfig.storage_gb,
        features: dbConfig?.features || defaultConfig.features,
        popular: tierId === 'plus'
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
            Join thousands of coaches using Youth Coach Hub to build better programs.
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
              &copy; {new Date().getFullYear()} Youth Coach Hub. All rights reserved.
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
