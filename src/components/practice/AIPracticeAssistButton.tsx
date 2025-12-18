'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AIPracticeChat } from './AIPracticeChat';

interface AIPracticeAssistButtonProps {
  teamId: string;
  onPlanCreated?: (planId: string) => void;
}

/**
 * Button that opens the AI Practice Planning slide-over chat.
 * Shows a sparkle icon to indicate AI-powered functionality.
 */
export function AIPracticeAssistButton({ teamId, onPlanCreated }: AIPracticeAssistButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-sm hover:shadow-md"
      >
        <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
        <span className="font-medium text-sm">AI Practice Planning</span>
      </button>

      <AIPracticeChat
        teamId={teamId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onPlanCreated={(planId) => {
          onPlanCreated?.(planId);
          setIsOpen(false);
        }}
      />
    </>
  );
}
