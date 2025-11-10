'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  colorScheme?: 'blue' | 'green' | 'red' | 'purple';
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultExpanded = false,
  children,
  colorScheme = 'blue'
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      icon: 'text-green-600'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      icon: 'text-red-600'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      icon: 'text-purple-600'
    }
  };

  const colors = colorClasses[colorScheme];

  return (
    <div className={`rounded-lg ${colors.bg} border ${colors.border}`}>
      {/* Header - Clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className={`w-5 h-5 ${colors.icon}`} />
          ) : (
            <ChevronRight className={`w-5 h-5 ${colors.icon}`} />
          )}
          <div className="text-left">
            <h4 className={`text-sm font-semibold ${colors.text}`}>{title}</h4>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500 italic">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {/* Content - Shown when expanded */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
