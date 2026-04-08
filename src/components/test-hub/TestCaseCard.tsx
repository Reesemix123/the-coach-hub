'use client';

import { useState } from 'react';
import { Check, Loader2, Lock, Play } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  category: string;
  suite_name: string;
}

type SessionStatus = 'available' | 'in-progress' | 'checked-out' | 'completed';

interface TestCaseCardProps {
  testCase: TestCase;
  sessionStatus: SessionStatus;
  onCheckout: (testCaseId: string) => Promise<void>;
  onResume: (testCaseId: string) => void;
}

// ============================================
// STATUS INDICATOR
// ============================================

function StatusIndicator({ status }: { status: SessionStatus }) {
  if (status === 'available') {
    return (
      <span className="text-sm text-green-600 font-medium">Available</span>
    );
  }

  if (status === 'in-progress') {
    return (
      <span className="text-sm text-blue-600 font-medium">In Progress</span>
    );
  }

  if (status === 'checked-out') {
    return (
      <span className="text-sm text-gray-400 font-medium flex items-center gap-1">
        <Lock size={13} />
        Checked Out
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
        <Check size={13} />
        Completed
      </span>
    );
  }

  return null;
}

// ============================================
// COMPONENT
// ============================================

export function TestCaseCard({
  testCase,
  sessionStatus,
  onCheckout,
  onResume,
}: TestCaseCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const showActionButton =
    sessionStatus === 'available' || sessionStatus === 'in-progress';

  const actionLabel = sessionStatus === 'available' ? 'Start Testing' : 'Resume';

  const handleAction = async () => {
    if (sessionStatus === 'available') {
      try {
        setIsLoading(true);
        await onCheckout(testCase.id);
      } catch {
        // Error handling is the caller's responsibility; we only manage loading state
      } finally {
        setIsLoading(false);
      }
    } else if (sessionStatus === 'in-progress') {
      onResume(testCase.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 transition-all hover:border-gray-300">
      {/* Category badge */}
      <div>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
          {testCase.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mt-2">
        {testCase.title}
      </h3>

      {/* Description */}
      {testCase.description && (
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {testCase.description}
        </p>
      )}

      {/* Suite name */}
      <p className="text-xs text-gray-400 mt-3">{testCase.suite_name}</p>

      {/* Bottom row: status + action */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <StatusIndicator status={sessionStatus} />

        {showActionButton && (
          <button
            onClick={handleAction}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
