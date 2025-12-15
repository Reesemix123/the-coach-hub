'use client';

import { useState } from 'react';
import { Clock, Check, ChevronDown, ChevronUp, Zap, Target, Users } from 'lucide-react';
import { TAGGING_TIERS, type TaggingTier, type TaggingTierConfig } from '@/types/football';

interface TierSelectorModalProps {
  isOpen: boolean;
  onSelect: (tier: TaggingTier) => void;
  gameName?: string;
}

/**
 * Modal for selecting tagging tier when starting film analysis
 * Apple-like aesthetic with card-based tier selection
 */
export function TierSelectorModal({ isOpen, onSelect, gameName }: TierSelectorModalProps) {
  const [selectedTier, setSelectedTier] = useState<TaggingTier | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedTier) {
      onSelect(selectedTier);
    }
  };

  const getTierIcon = (tier: TaggingTier) => {
    switch (tier) {
      case 'quick':
        return <Zap className="w-6 h-6" />;
      case 'standard':
        return <Target className="w-6 h-6" />;
      case 'comprehensive':
        return <Users className="w-6 h-6" />;
    }
  };

  const getTierColor = (tier: TaggingTier, isSelected: boolean) => {
    if (!isSelected) return 'border-gray-200 bg-white hover:border-gray-300';

    switch (tier) {
      case 'quick':
        return 'border-blue-500 bg-blue-50 ring-2 ring-blue-500';
      case 'standard':
        return 'border-gray-900 bg-gray-50 ring-2 ring-gray-900';
      case 'comprehensive':
        return 'border-purple-500 bg-purple-50 ring-2 ring-purple-500';
    }
  };

  const getIconColor = (tier: TaggingTier) => {
    switch (tier) {
      case 'quick':
        return 'text-blue-600';
      case 'standard':
        return 'text-gray-900';
      case 'comprehensive':
        return 'text-purple-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Choose Your Tagging Depth
          </h2>
          {gameName && (
            <p className="mt-1 text-sm text-gray-500">
              for {gameName}
            </p>
          )}
          <p className="mt-3 text-gray-600">
            Select how detailed you want your play analysis to be. You can upgrade later but cannot downgrade.
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
        {/* Tier Cards */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TAGGING_TIERS.map((tier: TaggingTierConfig) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${getTierColor(tier.id, selectedTier === tier.id)}`}
              >
                {/* Selected checkmark */}
                {selectedTier === tier.id && (
                  <div className="absolute top-3 right-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      tier.id === 'quick' ? 'bg-blue-500' :
                      tier.id === 'standard' ? 'bg-gray-900' :
                      'bg-purple-500'
                    }`}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Icon */}
                <div className={`mb-4 ${getIconColor(tier.id)}`}>
                  {getTierIcon(tier.id)}
                </div>

                {/* Tier name */}
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {tier.name}
                </h3>

                {/* Tagline */}
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {tier.tagline}
                </p>

                {/* Description */}
                <p className="text-sm text-gray-500 mb-4">
                  {tier.description}
                </p>

                {/* Time estimate */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{tier.timePerPlay} per play</span>
                </div>

                {/* What it enables (hover reveal on desktop) */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Enables:</p>
                  <ul className="space-y-1">
                    {tier.enables.slice(0, 3).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                        <Check className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {tier.enables.length > 3 && (
                      <li className="text-xs text-gray-400">
                        +{tier.enables.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="px-8 pb-4">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showHelp ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>Which should I choose?</span>
          </button>

          {showHelp && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-3 h-3 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Choose Quick</p>
                  <p className="text-sm text-gray-600">if you have limited time or just want to track the game</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Target className="w-3 h-3 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Choose Standard</p>
                  <p className="text-sm text-gray-600">if you're preparing for your next opponent</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-3 h-3 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Choose Comprehensive</p>
                  <p className="text-sm text-gray-600">if you're evaluating individual players</p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            You can upgrade to a higher tier later, but cannot downgrade.
          </p>
          <button
            onClick={handleConfirm}
            disabled={!selectedTier}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              selectedTier
                ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Start Tagging
          </button>
        </div>
      </div>
    </div>
  );
}

export default TierSelectorModal;
