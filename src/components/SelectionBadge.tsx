/**
 * SelectionBadge Component
 *
 * Circular checkbox badge that appears on hover for multi-select functionality.
 * Inspired by Gmail, Google Photos, and Notion.
 *
 * Features:
 * - Appears on hover (desktop) or always visible (mobile/selected)
 * - Smooth transitions
 * - Accessible with keyboard and screen readers
 * - Click stops propagation (won't trigger parent click handlers)
 *
 * @example
 * <SelectionBadge
 *   isSelected={selectedIds.has(item.id)}
 *   onToggle={() => toggleSelect(item.id)}
 *   position="top-left" // optional: top-left (default), top-right, bottom-left, bottom-right
 * />
 */

'use client';

interface SelectionBadgeProps {
  isSelected: boolean;
  onToggle: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function SelectionBadge({
  isSelected,
  onToggle,
  position = 'top-left',
  size = 'md',
  className = '',
}: SelectionBadgeProps) {
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`absolute ${positionClasses[position]} z-10 ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggle();
        }}
        className={`
          ${sizeClasses[size]}
          rounded-full border-2 flex items-center justify-center
          transition-all duration-200
          ${
            isSelected
              ? 'bg-blue-600 border-blue-600 opacity-100'
              : 'bg-white border-gray-400 opacity-0 group-hover:opacity-100 hover:border-gray-600'
          }
        `}
        aria-label={isSelected ? 'Deselect item' : 'Select item'}
        aria-pressed={isSelected}
        type="button"
      >
        {isSelected && (
          <svg
            className={`${iconSizeClasses[size]} text-white`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
