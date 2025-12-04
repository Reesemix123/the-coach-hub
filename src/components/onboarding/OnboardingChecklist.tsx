'use client';

import { X, Check, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useGlobalOnboardingSafe } from './GlobalOnboardingProvider';
import { CHECKLIST_ITEMS } from '@/types/onboarding';

export default function OnboardingChecklist() {
  const onboarding = useGlobalOnboardingSafe();

  // Don't render if not in provider context or no teamId
  if (!onboarding || !onboarding.teamId) {
    return null;
  }

  const { state, showChecklist, toggleChecklist, dismissChecklist, startTour } = onboarding;
  const teamId = onboarding.teamId;

  // Don't show if loading or dismissed
  if (state.loading || state.checklistDismissed) {
    return null;
  }

  // Don't show if all items are complete
  if (state.completionCount === state.totalItems) {
    return null;
  }

  const progressPercentage = (state.completionCount / state.totalItems) * 100;

  return (
    <div className="fixed right-0 top-1/3 z-40 flex">
      {/* Collapsed Tab */}
      {!showChecklist && (
        <button
          onClick={toggleChecklist}
          className="flex items-center gap-2 bg-white border border-r-0 border-gray-200 rounded-l-lg px-3 py-4 shadow-lg hover:bg-gray-50 transition-colors"
          title="Open Getting Started checklist"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
              Getting Started
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {state.completionCount}/{state.totalItems}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Expanded Panel */}
      {showChecklist && (
        <div className="w-80 bg-white border-l border-gray-200 shadow-xl rounded-l-lg overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleChecklist}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                  title="Collapse checklist"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <h3 className="font-semibold text-gray-900">Getting Started</h3>
              </div>
              <button
                onClick={dismissChecklist}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                title="Dismiss checklist"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 font-medium">
                {state.completionCount} of {state.totalItems}
              </span>
            </div>
          </div>

          {/* Checklist items */}
          <div className="p-2 max-h-[50vh] overflow-y-auto">
            {CHECKLIST_ITEMS.map((item) => {
              const isCompleted = state.completedItems[item.id];

              return (
                <Link
                  key={item.id}
                  href={item.href(teamId)}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    isCompleted
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : 'border-2 border-gray-300'
                    }`}
                  >
                    {isCompleted && <Check className="h-3 w-3" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted ? 'text-green-700' : 'text-gray-900'
                      }`}
                    >
                      {item.label}
                    </span>
                    <p
                      className={`text-xs mt-0.5 ${
                        isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Arrow for incomplete items */}
                  {!isCompleted && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Take the Tour button */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={startTour}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Play className="h-4 w-4" />
              Take the Tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
