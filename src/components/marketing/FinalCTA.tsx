/**
 * FinalCTA Component
 *
 * Final call-to-action section before the footer.
 * Full-width with subtle background treatment.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';

interface FinalCTAProps {
  headline?: string;
  subheadline?: string;
  primaryCta?: {
    text: string;
    href: string;
  };
  secondaryCta?: {
    text: string;
    href: string;
  };
}

export default function FinalCTA({
  headline = 'Ready to Take Your\nProgram to the Next Level?',
  subheadline = 'Join thousands of coaches who are building better playbooks, analyzing smarter, and developing players more effectively.',
  primaryCta = { text: 'Get Started Free', href: '/auth/signup' },
  secondaryCta = { text: 'Schedule a Demo', href: '/contact' },
}: FinalCTAProps) {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background with Subtle Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/marketing/friday-night-field.png"
          alt=""
          fill
          className="object-cover object-[center_60%] opacity-20"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              to bottom,
              #0F172A 0%,
              rgba(15, 23, 42, 0.85) 30%,
              rgba(15, 23, 42, 0.85) 70%,
              #0F172A 100%
            )`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 marketing-container">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6 whitespace-pre-line">
            {headline.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < headline.split('\n').length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="text-lg text-[rgba(249,250,251,0.72)] mb-10 leading-relaxed">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={primaryCta.href} className="marketing-btn-primary">
              {primaryCta.text}
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link href={secondaryCta.href} className="marketing-btn-secondary">
              {secondaryCta.text}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
