/**
 * CollapsibleSection Component
 *
 * Reusable collapsible section with expand/collapse animation.
 * Used throughout analytics page to minimize vertical space.
 *
 * Features:
 * - Smooth expand/collapse animation
 * - Rotating chevron icon
 * - Optional badge in header (e.g., "Tier 3")
 * - Remembers state in localStorage
 * - Auto-expands in print view
 *
 * @example
 * <CollapsibleSection
 *   id="offensive-stats"
 *   title="Offensive Stats"
 *   defaultExpanded={true}
 *   badge="Tier 2"
 * >
 *   <div>Your content here</div>
 * </CollapsibleSection>
 */

'use client';

import { useState, useEffect } from 'react';

interface CollapsibleSectionProps {
  id: string; // Unique identifier for localStorage
  title: string;
  defaultExpanded?: boolean;
  badge?: string; // Optional badge text (e.g., "Tier 3")
  badgeColor?: 'blue' | 'green' | 'red' | 'gray';
  children: React.ReactNode;
  printAlwaysExpanded?: boolean; // Force expanded in print view
  headerRight?: React.ReactNode; // Optional content on right side of header
}

export default function CollapsibleSection({
  id,
  title,
  defaultExpanded = false,
  badge,
  badgeColor = 'blue',
  children,
  printAlwaysExpanded = true,
  headerRight,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`analytics-section-${id}`);
    if (savedState !== null) {
      setIsExpanded(savedState === 'true');
    }
  }, [id]);

  // Save state to localStorage when it changes
  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`analytics-section-${id}`, String(newState));
    console.log(`Toggled ${id}: ${newState}`); // Debug log
  };

  const badgeColors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header - Always Visible */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors no-print cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {badge && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {headerRight}

          {/* Chevron Icon */}
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Print-only header (replaces button in print view) */}
      <div className="hidden print:block px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {badge && (
            <span className="px-2 py-1 text-xs font-medium border border-gray-300 rounded">
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="p-6 bg-white animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}

      {/* Print-only content (always visible in print) */}
      {!isExpanded && printAlwaysExpanded && (
        <div className="hidden print:block p-6 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}
