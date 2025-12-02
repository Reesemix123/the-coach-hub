'use client';

// src/components/AIActionButton.tsx
// A button component for AI actions that handles credit checking, confirmation, and consumption

import React, { useState, useCallback } from 'react';
import { aiUsageService, AIFeature, getCreditCost, AICreditsStatus, ConsumeCreditsResult } from '@/lib/services/ai-usage.service';

interface AIActionButtonProps {
  teamId: string;
  feature: AIFeature;
  onAction: () => Promise<void>;  // The actual AI action to perform
  children: React.ReactNode;      // Button label
  className?: string;
  disabled?: boolean;
  showCreditCost?: boolean;       // Show credit cost in button
  requireConfirmation?: boolean;  // Show confirmation dialog before action
  confirmationMessage?: string;   // Custom confirmation message
  onCreditsExhausted?: () => void; // Callback when credits are exhausted
  onSuccess?: (result: ConsumeCreditsResult) => void;  // Callback on successful credit consumption
  onError?: (error: string) => void;  // Callback on error
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  feature: AIFeature;
  creditCost: number;
  creditsRemaining: number;
  isLoading: boolean;
  customMessage?: string;
}

// Feature display names
const FEATURE_DISPLAY_NAMES: Record<AIFeature, string> = {
  'play_analysis': 'Play Analysis',
  'auto_tagging': 'Auto Tagging',
  'game_summary': 'Game Summary',
  'opponent_tendencies': 'Opponent Tendencies',
  'practice_plan': 'Practice Plan',
  'player_evaluation': 'Player Evaluation',
  'strategy_assistant': 'Strategy Assistant',
  'play_recognition': 'Play Recognition',
  'scouting_analysis': 'Scouting Analysis',
  'other': 'AI Feature'
};

// Confirmation Modal Component
function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  feature,
  creditCost,
  creditsRemaining,
  isLoading,
  customMessage
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const featureName = FEATURE_DISPLAY_NAMES[feature];
  const isNearLimit = creditsRemaining - creditCost < creditsRemaining * 0.2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Use AI Credits?
        </h3>

        <div className="space-y-3 mb-6">
          <p className="text-gray-600">
            {customMessage || `Using ${featureName} will consume ${creditCost} AI credit${creditCost !== 1 ? 's' : ''}.`}
          </p>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Credits needed:</span>
              <span className="font-medium text-gray-900">{creditCost}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Credits remaining:</span>
              <span className={`font-medium ${isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
                {creditsRemaining}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">After action:</span>
              <span className="font-medium text-gray-900">
                {creditsRemaining - creditCost}
              </span>
            </div>
          </div>

          {isNearLimit && (
            <p className="text-yellow-600 text-sm">
              Warning: You're running low on AI credits.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </>
            ) : (
              <>
                Confirm ({creditCost} credit{creditCost !== 1 ? 's' : ''})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Credits Exhausted Modal
function CreditsExhaustedModal({
  isOpen,
  onClose,
  teamId,
  feature
}: {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  feature: AIFeature;
}) {
  if (!isOpen) return null;

  const featureName = FEATURE_DISPLAY_NAMES[feature];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            AI Credits Exhausted
          </h3>
        </div>

        <p className="text-gray-600 mb-6">
          You've used all your AI credits for this billing period. To use {featureName}, you can:
        </p>

        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>Wait for your credits to reset at the start of your next billing period</li>
          <li>Upgrade your plan for more monthly credits</li>
        </ul>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <a
            href={`/teams/${teamId}/settings`}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            View Plans
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * AIActionButton - A button that handles AI credit checking and consumption
 *
 * Usage:
 * <AIActionButton
 *   teamId={teamId}
 *   feature="play_analysis"
 *   onAction={async () => { await analyzePlay() }}
 *   requireConfirmation
 * >
 *   Analyze Play
 * </AIActionButton>
 */
export function AIActionButton({
  teamId,
  feature,
  onAction,
  children,
  className = '',
  disabled = false,
  showCreditCost = true,
  requireConfirmation = true,
  confirmationMessage,
  onCreditsExhausted,
  onSuccess,
  onError
}: AIActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showExhausted, setShowExhausted] = useState(false);
  const [creditsStatus, setCreditsStatus] = useState<AICreditsStatus | null>(null);

  const creditCost = getCreditCost(feature);

  // Check credits and possibly show confirmation
  const handleClick = useCallback(async () => {
    setIsLoading(true);

    try {
      // Check if team has enough credits
      const status = await aiUsageService.getCreditsStatus(teamId);
      setCreditsStatus(status);

      if (!status) {
        const error = 'Unable to check credit status';
        onError?.(error);
        return;
      }

      if (status.at_limit || status.credits_remaining < creditCost) {
        setShowExhausted(true);
        onCreditsExhausted?.();
        return;
      }

      // Show confirmation dialog if required
      if (requireConfirmation) {
        setShowConfirmation(true);
      } else {
        // Proceed directly
        await executeAction();
      }
    } catch (error) {
      console.error('Error checking credits:', error);
      onError?.('Failed to check AI credits');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, creditCost, requireConfirmation, onCreditsExhausted, onError]);

  // Execute the AI action with credit consumption
  const executeAction = useCallback(async () => {
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      // Consume credits first
      const result = await aiUsageService.consumeCredits(teamId, feature);

      if (!result.success) {
        if (result.code === 'CREDITS_EXHAUSTED' || result.code === 'TRIAL_LIMIT_EXCEEDED') {
          setShowExhausted(true);
          onCreditsExhausted?.();
        } else {
          onError?.(result.error || 'Failed to consume credits');
        }
        return;
      }

      // Credits consumed successfully, now perform the action
      await onAction();
      onSuccess?.(result);

    } catch (error) {
      console.error('Error executing AI action:', error);
      onError?.(error instanceof Error ? error.message : 'AI action failed');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, feature, onAction, onCreditsExhausted, onSuccess, onError]);

  const baseClassName = `
    px-4 py-2 bg-black text-white rounded-lg
    hover:bg-gray-800 transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed
    flex items-center gap-2
  `;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`${baseClassName} ${className}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // AI icon
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        {children}
        {showCreditCost && (
          <span className="text-xs opacity-75">
            ({creditCost} credit{creditCost !== 1 ? 's' : ''})
          </span>
        )}
      </button>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={executeAction}
        feature={feature}
        creditCost={creditCost}
        creditsRemaining={creditsStatus?.credits_remaining || 0}
        isLoading={isLoading}
        customMessage={confirmationMessage}
      />

      {/* Credits Exhausted Modal */}
      <CreditsExhaustedModal
        isOpen={showExhausted}
        onClose={() => setShowExhausted(false)}
        teamId={teamId}
        feature={feature}
      />
    </>
  );
}

/**
 * AICreditsDisplay - Shows current credit status
 */
export function AICreditsDisplay({ teamId }: { teamId: string }) {
  const [status, setStatus] = useState<AICreditsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchStatus() {
      const data = await aiUsageService.getCreditsStatus(teamId);
      setStatus(data);
      setLoading(false);
    }
    fetchStatus();
  }, [teamId]);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-16 w-48" />
    );
  }

  if (!status) {
    return null;
  }

  const progressColor = status.at_limit
    ? 'bg-red-500'
    : status.near_limit
    ? 'bg-yellow-500'
    : 'bg-green-500';

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">AI Credits</span>
        <span className="text-sm text-gray-500">
          {status.credits_remaining} / {status.credits_allowed}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${progressColor} transition-all duration-300`}
          style={{ width: `${Math.min(status.percentage_used, 100)}%` }}
        />
      </div>
      {status.is_trial && (
        <p className="text-xs text-gray-500 mt-2">
          Trial limit: {status.trial_limit} credits
        </p>
      )}
      {status.near_limit && !status.at_limit && (
        <p className="text-xs text-yellow-600 mt-2">
          Running low on credits
        </p>
      )}
      {status.at_limit && (
        <p className="text-xs text-red-600 mt-2">
          Credits exhausted for this period
        </p>
      )}
    </div>
  );
}

export default AIActionButton;
