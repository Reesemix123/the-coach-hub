'use client';

import { useState, useEffect } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { PASSING_ROUTES, BLOCKING_ASSIGNMENTS } from '@/config/footballConfig';
import type { RouteAnalysis } from './utils/routeDetection';
import type { QuickDrawToolId } from './fieldConstants';

interface RouteTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (routeType: string, isPrimary: boolean) => void;
  tool: QuickDrawToolId;
  playerLabel: string;
  suggestedRoute: string;
  routeAnalysis: RouteAnalysis | null;
  relevantOptions: string[];
}

export default function RouteTypeModal({
  isOpen,
  onClose,
  onConfirm,
  tool,
  playerLabel,
  suggestedRoute,
  routeAnalysis,
  relevantOptions,
}: RouteTypeModalProps) {
  const [selectedRoute, setSelectedRoute] = useState(suggestedRoute);
  const [isPrimary, setIsPrimary] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Reset state when modal opens with new suggestion
  useEffect(() => {
    if (isOpen) {
      setSelectedRoute(suggestedRoute);
      setIsPrimary(false);
      setShowAllRoutes(false);
    }
  }, [isOpen, suggestedRoute]);

  if (!isOpen) return null;

  // Get all available options based on tool type
  const allOptions = tool === 'block'
    ? [...BLOCKING_ASSIGNMENTS]
    : [...PASSING_ROUTES];

  // Display options: relevant first, then show all if expanded
  const displayOptions = showAllRoutes ? allOptions : relevantOptions;

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-gray-500';
    }
  };

  const getConfidenceLabel = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'High confidence';
      case 'medium': return 'Medium confidence';
      case 'low': return 'Low confidence';
    }
  };

  const getToolLabel = () => {
    switch (tool) {
      case 'route': return 'Route';
      case 'block': return 'Block';
      case 'motion': return 'Motion';
      case 'coverage': return 'Coverage';
      case 'blitz': return 'Blitz';
      default: return 'Assignment';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">
            Confirm {getToolLabel()} for {playerLabel}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* AI Suggestion */}
          {routeAnalysis && (
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Detected: {suggestedRoute}
                </p>
                <p className={`text-xs ${getConfidenceColor(routeAnalysis.confidence)}`}>
                  {getConfidenceLabel(routeAnalysis.confidence)}
                </p>
              </div>
            </div>
          )}

          {/* Route Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select {getToolLabel()} Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {displayOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedRoute(option)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                    selectedRoute === option
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  } ${option === suggestedRoute ? 'ring-2 ring-green-300 ring-offset-1' : ''}`}
                >
                  {option}
                  {option === suggestedRoute && (
                    <span className="ml-1 text-xs opacity-70">(suggested)</span>
                  )}
                </button>
              ))}
            </div>

            {/* Show more options */}
            {!showAllRoutes && allOptions.length > relevantOptions.length && (
              <button
                onClick={() => setShowAllRoutes(true)}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Show all {allOptions.length} options
              </button>
            )}
          </div>

          {/* Primary Route Toggle (only for routes, not blocks) */}
          {tool === 'route' && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="isPrimary"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <label htmlFor="isPrimary" className="text-sm text-gray-700">
                Mark as primary route (first read)
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedRoute, isPrimary)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
          >
            <Check className="w-4 h-4" />
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
