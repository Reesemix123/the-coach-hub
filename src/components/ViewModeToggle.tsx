/**
 * ViewModeToggle Component
 *
 * Reusable segmented control for switching between view modes (Grid/List/Print/etc.)
 * Used across analytics, playbook, and film pages for consistency.
 */

'use client';

interface ViewMode {
  value: string;
  label: string;
  icon: string;
}

interface ViewModeToggleProps {
  currentMode: string;
  modes: ViewMode[];
  onChange: (mode: string) => void;
  className?: string;
}

export default function ViewModeToggle({
  currentMode,
  modes,
  onChange,
  className = '',
}: ViewModeToggleProps) {
  return (
    <div className={`inline-flex rounded-xl border border-gray-300 p-1 bg-white ${className}`}>
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            currentMode === mode.value
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="text-base">{mode.icon}</span>
          {mode.label}
        </button>
      ))}
    </div>
  );
}

// Common mode configurations for reuse
export const VIEW_MODES = {
  GRID_LIST: [
    { value: 'grid', label: 'Grid', icon: '▦' },
    { value: 'list', label: 'List', icon: '☰' },
  ],
  ANALYTICS: [
    { value: 'cards', label: 'Grid', icon: '▦' },
    { value: 'list', label: 'List', icon: '☰' },
    { value: 'print', label: 'Print', icon: '⎙' },
  ],
  PLAYBOOK: [
    { value: 'grid', label: 'Grid', icon: '▦' },
    { value: 'list', label: 'List', icon: '☰' },
  ],
};
