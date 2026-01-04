'use client';

import { useState } from 'react';
import { Check, X, AlertTriangle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { AITagPredictions } from './AITaggingButton';

interface AITaggingPanelProps {
  predictions: AITagPredictions;
  predictionId: string;
  onAccept: (field: string, value: string | number | boolean) => void;
  onRejectAll: () => void;
  onAcceptAll: () => void;
  fieldsUncertain?: string[];
  overallConfidence?: number;
  className?: string;
}

// Field display names
const FIELD_LABELS: Record<string, string> = {
  play_type: 'Play Type',
  direction: 'Direction',
  result: 'Result',
  yards_gained: 'Yards Gained',
  formation: 'Formation',
  personnel: 'Personnel',
  hash: 'Hash Mark',
  down: 'Down',
  distance: 'Distance',
  field_zone: 'Field Zone',
  quarter: 'Quarter',
  motion: 'Pre-snap Motion',
  play_action: 'Play Action',
  run_concept: 'Run Concept',
  pass_concept: 'Pass Concept',
  // Special Teams fields
  special_teams_unit: 'Special Teams Unit',
  kick_result: 'Kick Result',
  kick_distance: 'Kick Distance',
  return_yards: 'Return Yards',
  is_touchback: 'Touchback',
  is_fair_catch: 'Fair Catch',
  is_muffed: 'Muffed',
  punt_type: 'Punt Type',
  kickoff_type: 'Kickoff Type',
};

// Confidence level styling - used for row backgrounds and badges
function getConfidenceStyle(confidence: number): {
  rowBg: string;
  rowBorder: string;
  badgeText: string;
  label: string;
} {
  if (confidence >= 80) {
    return {
      rowBg: 'bg-green-50',
      rowBorder: 'border-green-200',
      badgeText: 'text-green-700',
      label: 'High'
    };
  } else if (confidence >= 60) {
    return {
      rowBg: 'bg-yellow-50',
      rowBorder: 'border-yellow-200',
      badgeText: 'text-yellow-700',
      label: 'Medium'
    };
  } else {
    return {
      rowBg: 'bg-red-50',
      rowBorder: 'border-red-200',
      badgeText: 'text-red-700',
      label: 'Low'
    };
  }
}

// Format value for display
function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export function AITaggingPanel({
  predictions,
  predictionId,
  onAccept,
  onRejectAll,
  onAcceptAll,
  fieldsUncertain = [],
  overallConfidence = 0,
  className = '',
}: AITaggingPanelProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set());

  // Filter to only prediction fields (exclude metadata like reasoning)
  const predictionFields = Object.entries(predictions).filter(
    ([key, value]) =>
      key !== 'reasoning' &&
      key !== 'audio_used' &&
      key !== 'fields_uncertain' &&
      value &&
      typeof value === 'object' &&
      'value' in value &&
      'confidence' in value
  ) as [string, { value: string | number | boolean; confidence: number }][];

  const handleAcceptField = (field: string, value: string | number | boolean) => {
    onAccept(field, value);
    setAcceptedFields((prev) => new Set([...prev, field]));
  };

  const handleAcceptAll = () => {
    for (const [field, prediction] of predictionFields) {
      if (!acceptedFields.has(field)) {
        onAccept(field, prediction.value);
      }
    }
    setAcceptedFields(new Set(predictionFields.map(([field]) => field)));
    onAcceptAll();
  };

  const overallStyle = getConfidenceStyle(overallConfidence);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900">AI Suggestions</span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${overallStyle.rowBg} ${overallStyle.badgeText}`}
          >
            {overallConfidence}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRejectAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>

      {/* Predictions Grid */}
      <div className="p-4 grid gap-2">
        {predictionFields.map(([field, prediction]) => {
          const isUncertain = fieldsUncertain.includes(field);
          const isAccepted = acceptedFields.has(field);
          const style = getConfidenceStyle(prediction.confidence);

          return (
            <div
              key={field}
              className={`
                relative flex items-center justify-between px-3 py-2 rounded-lg border transition-all
                ${isAccepted
                  ? 'bg-gray-100 border-gray-300 opacity-60'
                  : `${style.rowBg} ${style.rowBorder}`
                }
              `}
            >
              {/* Confidence percentage - compact, top-right corner */}
              {!isAccepted && (
                <span
                  className={`absolute top-1 right-1 text-[10px] font-semibold ${style.badgeText}`}
                >
                  {prediction.confidence}%
                </span>
              )}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Status icon */}
                {isAccepted ? (
                  <Check className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : isUncertain ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : null}

                {/* Field name and value */}
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {FIELD_LABELS[field] || field}:
                  </span>
                  <span className={`font-semibold truncate ${isAccepted ? 'text-gray-500' : 'text-gray-900'}`}>
                    {formatValue(prediction.value)}
                  </span>
                </div>
              </div>

              {/* Accept button */}
              {!isAccepted && (
                <button
                  onClick={() => handleAcceptField(field, prediction.value)}
                  className="ml-2 p-1 text-gray-600 hover:text-green-600 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                  title="Accept this suggestion"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Reasoning (expandable) */}
      {predictions.reasoning && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
          >
            <span>AI Reasoning</span>
            {showReasoning ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showReasoning && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {predictions.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
