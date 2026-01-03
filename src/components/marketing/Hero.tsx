/**
 * Hero Component
 *
 * Full-height hero section with Friday Night Lights background,
 * gradient overlay, headline, and dual CTAs.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';

interface HeroProps {
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

export default function Hero({
  headline = 'Your Playbook.\nYour Film.\nYour Edge.',
  subheadline = 'The all-in-one platform for youth football coaches to build digital playbooks, analyze game film, and develop players.',
  primaryCta = { text: 'Get Started Free', href: '/auth/signup' },
  secondaryCta = { text: 'See How It Works', href: '/#features' },
}: HeroProps) {
  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/marketing/friday-night-field.png"
          alt="High school football field at dusk"
          fill
          className="object-cover object-[center_30%]"
          priority
          quality={90}
        />

        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(15, 23, 42, 0.7) 0%,
              rgba(15, 23, 42, 0.5) 40%,
              rgba(15, 23, 42, 0.85) 80%,
              #0F172A 100%
            )`,
          }}
        />

        {/* Subtle Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(15, 23, 42, 0.4) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 marketing-container text-center pt-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(163,230,53,0.1)] border border-[rgba(163,230,53,0.3)] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#A3E635] animate-pulse" />
          <span className="text-[#A3E635] text-sm font-medium">
            Built for Youth Coaches
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6 whitespace-pre-line"
        >
          {headline.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < headline.split('\n').length - 1 && <br />}
            </span>
          ))}
        </h1>

        {/* Accent Line */}
        <div className="w-24 h-1 bg-[#A3E635]/60 mx-auto mb-8 rounded-full" />

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-[rgba(249,250,251,0.8)] max-w-2xl mx-auto mb-10 leading-relaxed">
          {subheadline}
        </p>

        {/* CTAs */}
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

        {/* Trust Indicators */}
        <div className="mt-16 pt-8 border-t border-[rgba(148,163,184,0.1)]">
          <p className="text-[rgba(249,250,251,0.5)] text-sm mb-4">
            Trusted by coaches at all levels
          </p>
          <div className="flex items-center justify-center gap-8 text-[rgba(249,250,251,0.4)]">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm">Youth Leagues</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm">Middle School</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm">High School</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2 text-[rgba(249,250,251,0.4)]">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg
            className="w-5 h-5 animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
