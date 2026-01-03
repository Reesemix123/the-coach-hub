/**
 * FeatureGrid Component
 *
 * 2x2 grid of feature cards on desktop, stacked on mobile.
 * Each card has an icon, title, and description.
 */

'use client';

import { ReactNode } from 'react';

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

interface FeatureGridProps {
  label?: string;
  headline?: string;
  subheadline?: string;
  features?: Feature[];
}

const defaultFeatures: Feature[] = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Digital Playbook',
    description: 'Build and organize your entire playbook digitally. Draw plays, assign routes, and share with your staff instantly.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Film Analysis',
    description: 'Upload game film, tag plays, and build a searchable library. Find any play in seconds, not hours.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Smart Analytics',
    description: 'Track what works. See success rates by formation, down, distance, and more. Make data-driven decisions.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Team Collaboration',
    description: 'Invite assistant coaches and coordinators. Everyone stays on the same page with shared access.',
  },
];

export default function FeatureGrid({
  label = 'Features',
  headline = 'Everything You Need\nto Run Your Program',
  subheadline = 'From playbook to film room to practice planning, all your coaching tools in one place.',
  features = defaultFeatures,
}: FeatureGridProps) {
  return (
    <section id="features" className="marketing-section bg-[#0F172A]">
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

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="marketing-card group"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[rgba(163,230,53,0.1)] flex items-center justify-center text-[#A3E635] mb-4 group-hover:bg-[rgba(163,230,53,0.15)] transition-colors">
                {feature.icon}
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-[rgba(249,250,251,0.72)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
