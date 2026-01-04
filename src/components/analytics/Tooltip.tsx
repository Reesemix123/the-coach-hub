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

import { useState, useRef, useEffect } from 'react';

interface TooltipContent {
  title: string;
  description: string;
  useful?: string;  // Optional for backward compatibility
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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    // Delay showing tooltip slightly to avoid flicker
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 320; // 80 * 4 (w-80)
    const tooltipHeight = 300; // Approximate height
    const spacing = 8; // 2 * 4 (gap)

    let top = 0;
    let left = 0;

    // Calculate position based on available space
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    // Try to position to the right first (most space usually)
    if (spaceRight >= tooltipWidth + spacing) {
      left = rect.right + spacing;
      top = Math.max(spacing, Math.min(rect.top, window.innerHeight - tooltipHeight - spacing));
    }
    // If not enough space on right, try left
    else if (spaceLeft >= tooltipWidth + spacing) {
      left = rect.left - tooltipWidth - spacing;
      top = Math.max(spacing, Math.min(rect.top, window.innerHeight - tooltipHeight - spacing));
    }
    // If not enough horizontal space, try top
    else if (spaceAbove >= tooltipHeight + spacing) {
      top = rect.top - tooltipHeight - spacing;
      left = Math.max(spacing, Math.min(rect.left, window.innerWidth - tooltipWidth - spacing));
    }
    // Otherwise position below
    else {
      top = rect.bottom + spacing;
      left = Math.max(spacing, Math.min(rect.left, window.innerWidth - tooltipWidth - spacing));
    }

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);

      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex items-center no-print"
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
      </div>

      {/* Tooltip Content - Fixed position portal-like */}
      {isVisible && (
        <div
          style={tooltipStyle}
          className="w-80 max-w-[90vw] animate-in fade-in-0 zoom-in-95 duration-200"
          role="tooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Tooltip Box - Subtle white style */}
          <div className="bg-white text-gray-700 rounded-lg shadow-lg border border-gray-200 p-4 text-sm max-h-[80vh] overflow-y-auto">
            <div className="font-semibold text-gray-900 mb-2">{content.title}</div>

            <div className="space-y-3">
              {/* What it is */}
              <div>
                <div className="text-gray-500 font-medium mb-1">What it is:</div>
                <div className="text-gray-700">{content.description}</div>
              </div>

              {/* Why it's useful (only if provided) */}
              {content.useful && (
                <div>
                  <div className="text-gray-500 font-medium mb-1">Why it's useful:</div>
                  <div className="text-gray-700">{content.useful}</div>
                </div>
              )}

              {/* How it's calculated */}
              <div>
                <div className="text-gray-500 font-medium mb-1">How it's calculated:</div>
                <div className="text-gray-700 font-mono text-xs break-words">{content.calculation}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
