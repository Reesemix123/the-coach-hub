'use client';

import { ChevronRight } from 'lucide-react';
import type { FeatureDemo } from '@/config/featureDemos';

interface FeatureCardProps {
  feature: FeatureDemo;
  onClick: () => void;
}

// Icon components matching the homepage design
function PlaybookIcon() {
  return (
    <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function GamedayIcon() {
  return (
    <svg className="w-5 h-5 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function getIcon(iconType: FeatureDemo['icon']) {
  switch (iconType) {
    case 'playbook':
      return <PlaybookIcon />;
    case 'analytics':
      return <AnalyticsIcon />;
    case 'film':
      return <FilmIcon />;
    case 'gameday':
      return <GamedayIcon />;
    default:
      return <PlaybookIcon />;
  }
}

export default function FeatureCard({ feature, onClick }: FeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="group p-6 rounded-2xl transition-all duration-200 text-left w-full cursor-pointer hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]/50 focus:ring-offset-2 focus:ring-offset-[#1a1410]"
      style={{
        background: 'rgba(32,26,22,.78)',
        border: '1px solid rgba(148,163,184,.16)',
        boxShadow: '0 12px 30px rgba(0,0,0,.28)',
      }}
      aria-label={`Learn more about ${feature.title}`}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(184,202,110,.12)',
            border: '1px solid rgba(184,202,110,.18)',
          }}
        >
          {getIcon(feature.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-[#F9FAFB] mb-1">{feature.title}</h3>
            {/* Subtle "Learn more" hint - visible on hover */}
            <span
              className="flex items-center gap-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
              style={{ color: 'rgba(184,202,110,.8)' }}
            >
              <span className="hidden sm:inline">Learn more</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <p
            className="text-sm leading-relaxed font-bold"
            style={{ color: 'rgba(249,250,251,.72)' }}
          >
            {feature.shortDescription}
          </p>
        </div>
      </div>
    </button>
  );
}
