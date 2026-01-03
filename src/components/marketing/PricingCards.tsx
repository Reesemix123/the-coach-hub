/**
 * PricingCards Component
 *
 * Three pricing cards with Basic, Plus (highlighted), and Premium tiers.
 * Matches the current subscription structure.
 */

'use client';

import Link from 'next/link';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
  badge?: string;
}

const defaultTiers: PricingTier[] = [
  {
    name: 'Basic',
    price: 'Free',
    period: 'forever',
    description: 'Perfect for trying out the platform',
    features: [
      '2 games per month',
      '1 camera angle',
      '30-day film retention',
      'Up to 3 coaches',
      'Basic analytics',
    ],
    cta: 'Get Started',
    href: '/auth/signup',
  },
  {
    name: 'Plus',
    price: '$29.99',
    period: '/month',
    description: 'For serious coaching programs',
    features: [
      '4 games per month',
      '3 camera angles',
      '180-day retention',
      'Up to 5 coaches',
      'Advanced analytics',
      'AI Coach Assistant',
    ],
    cta: 'Start Free Trial',
    href: '/auth/signup?plan=plus',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Premium',
    price: '$79.99',
    period: '/month',
    description: 'For multi-team organizations',
    features: [
      '8 games per month',
      '5 camera angles',
      '365-day retention',
      'Up to 10 coaches',
      'Full analytics suite',
      'Priority support',
    ],
    cta: 'Contact Sales',
    href: '/contact',
  },
];

interface PricingCardsProps {
  label?: string;
  headline?: string;
  subheadline?: string;
  tiers?: PricingTier[];
}

export default function PricingCards({
  label = 'Pricing',
  headline = 'Pricing That\nMakes Sense',
  subheadline = 'Start free, upgrade when you need more. No hidden fees, cancel anytime.',
  tiers = defaultTiers,
}: PricingCardsProps) {
  return (
    <section id="pricing" className="marketing-section-lg bg-[#0F172A]">
      <div className="marketing-container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="marketing-label mb-4 inline-block">{label}</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6 whitespace-pre-line">
            {headline.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < headline.split('\n').length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="text-lg text-[rgba(249,250,251,0.72)] max-w-2xl mx-auto">
            {subheadline}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative ${
                tier.highlighted
                  ? 'marketing-card-highlight'
                  : 'marketing-card'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-[#A3E635] text-[#0F172A] text-xs font-semibold rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {tier.name}
                </h3>
                <p className="text-[rgba(249,250,251,0.56)] text-sm">
                  {tier.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                <span className="text-[rgba(249,250,251,0.56)] text-sm ml-1">
                  {tier.period}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <svg
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        tier.highlighted ? 'text-[#A3E635]' : 'text-[rgba(249,250,251,0.56)]'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-[rgba(249,250,251,0.8)] text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={tier.href}
                className={`block text-center ${
                  tier.highlighted
                    ? 'marketing-btn-primary w-full'
                    : 'marketing-btn-secondary w-full'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="text-center text-[rgba(249,250,251,0.56)] text-sm mt-8">
          All plans include 14-day free trial. Annual billing saves 17%.
        </p>
      </div>
    </section>
  );
}
