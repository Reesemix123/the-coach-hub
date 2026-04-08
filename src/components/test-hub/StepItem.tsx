'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X, MinusCircle, Flag, ChevronDown } from 'lucide-react';

// ============================================
// TYPES
// ============================================

type StepStatus = 'pending' | 'pass' | 'fail' | 'skip';

interface Step {
  id: string;
  step_type: 'setup' | 'test';
  instruction: string;
  expected_outcome: string | null;
}

interface Completion {
  status: StepStatus;
  notes: string | null;
  flagged_issue: boolean;
}

interface StepItemProps {
  step: Step;
  completion: Completion | null;
  onUpdate: (
    stepId: string,
    data: { status: string; notes?: string; flagged_issue?: boolean }
  ) => void;
}

// ============================================
// HELPERS
// ============================================

const LEFT_BORDER_CLASS: Record<StepStatus, string> = {
  pending: 'border-l-gray-300',
  pass: 'border-l-green-500',
  fail: 'border-l-red-500',
  skip: 'border-l-gray-400',
};

// ============================================
// COMPONENT
// ============================================

export function StepItem({ step, completion, onUpdate }: StepItemProps) {
  const status: StepStatus = completion?.status ?? 'pending';
  const isFlagged = completion?.flagged_issue ?? false;

  const [notes, setNotes] = useState(completion?.notes ?? '');
  const [outcomeExpanded, setOutcomeExpanded] = useState(false);

  // Keep local notes in sync when completion changes externally
  useEffect(() => {
    setNotes(completion?.notes ?? '');
  }, [completion?.notes]);

  // Debounced notes update — only fires when a non-pending status is active
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status === 'pending') return;
    notesTimerRef.current = setTimeout(() => {
      onUpdate(step.id, { status, notes: notes || undefined });
    }, 500);
    return () => {
      if (notesTimerRef.current !== null) clearTimeout(notesTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const handleStatusToggle = (next: StepStatus) => {
    // Toggle off if already that status
    const newStatus: StepStatus = status === next ? 'pending' : next;
    onUpdate(step.id, { status: newStatus, notes: notes || undefined });
  };

  const handleFlagToggle = () => {
    onUpdate(step.id, { status, flagged_issue: !isFlagged });
  };

  const showNotes = status !== 'pending';
  const borderClass = LEFT_BORDER_CLASS[status];

  return (
    <div
      className={`border border-gray-200 border-l-4 ${borderClass} rounded-lg p-4 mb-3`}
    >
      {/* Top row: instruction + status toggles */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-900 flex-1 leading-snug">
          {step.instruction}
        </p>

        <div className="inline-flex items-center gap-1 shrink-0">
          {/* Pass */}
          <button
            onClick={() => handleStatusToggle('pass')}
            title="Pass"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              status === 'pass'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
            }`}
          >
            <Check size={13} />
          </button>

          {/* Fail */}
          <button
            onClick={() => handleStatusToggle('fail')}
            title="Fail"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              status === 'fail'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <X size={13} />
          </button>

          {/* Skip */}
          <button
            onClick={() => handleStatusToggle('skip')}
            title="Skip"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              status === 'skip'
                ? 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <MinusCircle size={13} />
          </button>

          {/* Flag issue */}
          <button
            onClick={handleFlagToggle}
            title={isFlagged ? 'Remove flag' : 'Flag issue'}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              isFlagged
                ? 'bg-amber-100 text-amber-600'
                : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
            }`}
          >
            <Flag size={13} />
          </button>
        </div>
      </div>

      {/* Expected outcome — collapsible with rotating chevron */}
      {step.expected_outcome && (
        <div className="mt-1">
          <button
            onClick={() => setOutcomeExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${
                outcomeExpanded ? 'rotate-180' : 'rotate-0'
              }`}
            />
            Expected outcome
          </button>
          {outcomeExpanded && (
            <p className="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-gray-200 leading-relaxed">
              {step.expected_outcome}
            </p>
          )}
        </div>
      )}

      {/* Notes textarea — visible when a status is set */}
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Add notes..."
          className="w-full mt-2 p-2 text-sm border border-gray-200 rounded resize-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      )}
    </div>
  );
}
