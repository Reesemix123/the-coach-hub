'use client';

import { Mail, Smartphone, Bell } from 'lucide-react';

interface NotificationChannelPickerProps {
  value: 'sms' | 'email' | 'both';
  onChange: (channel: 'sms' | 'email' | 'both') => void;
  disabled?: boolean;
  showLabel?: boolean;
}

const OPTIONS = [
  { value: 'email' as const, label: 'Email', icon: Mail },
  { value: 'sms' as const, label: 'SMS', icon: Smartphone },
  { value: 'both' as const, label: 'Both', icon: Bell },
];

export function NotificationChannelPicker({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: NotificationChannelPickerProps) {
  return (
    <div className="space-y-2">
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700">
          Notification Channel
        </label>
      )}

      <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-md
                font-medium text-sm transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? 'bg-black text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
