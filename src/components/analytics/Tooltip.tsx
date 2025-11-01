/**
 * Tooltip Component
 *
 * Hover-triggered tooltip for analytics metrics.
 * Provides context, explanation, and calculation details.
 *
 * Features:
 * - Shows on hover with smooth animation
 * - Displays: What it is, Why it's useful, How it's calculated
 * - Keyboard accessible (focus to show)
 * - Smart positioning (doesn't go off-screen)
 *
 * @example
 * <Tooltip
 *   content={{
 *     title: "Success Rate",
 *     description: "Percentage of plays that gain expected yards for the down and distance",
 *     useful: "Shows offensive efficiency better than yards per play",
 *     calculation: "1st down: 40% of distance, 2nd: 60%, 3rd/4th: 100%"
 *   }}
 * >
 *   <span>Success Rate</span>
 * </Tooltip>
 */

'use client';

import { useState, useRef } from 'react';

interface TooltipContent {
  title: string;
  description: string;
  useful: string;
  calculation: string;
}

interface TooltipProps {
  content: TooltipContent;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // Delay showing tooltip slightly to avoid flicker
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Use right-side positioning to avoid cutoff on most screens
  const positionClasses = {
    top: 'bottom-full right-0 mb-2',
    bottom: 'top-full right-0 mt-2',
    left: 'right-full top-0 mr-2',
    right: 'left-full top-0 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900',
  };

  return (
    <div
      className="relative inline-flex items-center no-print"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      tabIndex={0}
    >
      {/* Trigger (what to hover over) */}
      <div className="flex items-center gap-1 cursor-help">
        {children}
        <svg
          className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="More information"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Tooltip Content */}
      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} w-80 max-w-[90vw] animate-in fade-in-0 zoom-in-95 duration-200`}
          role="tooltip"
        >
          {/* Tooltip Box */}
          <div className="bg-gray-900 text-white rounded-lg shadow-xl p-4 text-sm max-h-[80vh] overflow-y-auto">
            <div className="font-semibold text-white mb-2">{content.title}</div>

            <div className="space-y-3">
              {/* What it is */}
              <div>
                <div className="text-gray-300 font-medium mb-1">What it is:</div>
                <div className="text-gray-100">{content.description}</div>
              </div>

              {/* Why it's useful */}
              <div>
                <div className="text-gray-300 font-medium mb-1">Why it's useful:</div>
                <div className="text-gray-100">{content.useful}</div>
              </div>

              {/* How it's calculated */}
              <div>
                <div className="text-gray-300 font-medium mb-1">How it's calculated:</div>
                <div className="text-gray-100 font-mono text-xs break-words">{content.calculation}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
