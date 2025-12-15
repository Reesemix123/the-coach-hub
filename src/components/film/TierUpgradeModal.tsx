'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import { TAGGING_TIERS, type TaggingTier, canUpgradeTier } from '@/types/football';

interface TierUpgradeModalProps {
  isOpen: boolean;
  currentTier: TaggingTier;
  playsTaggedCount: number;
  onConfirm: (newTier: TaggingTier) => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for upgrading tagging tier mid-game
 * Shows warning about previously tagged plays
 */
export function TierUpgradeModal({
  isOpen,
  currentTier,
  playsTaggedCount,
  onConfirm,
  onCancel
}: TierUpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<TaggingTier | null>(null);

  if (!isOpen) return null;

  // Get available upgrade tiers
  const availableTiers = TAGGING_TIERS.filter(t => canUpgradeTier(currentTier, t.id));

  const handleConfirm = () => {
    if (selectedTier) {
      onConfirm(selectedTier);
    }
  };

  const getCurrentTierConfig = () => {
    return TAGGING_TIERS.find(t => t.id === currentTier);
  };

  const getSelectedTierConfig = () => {
    return selectedTier ? TAGGING_TIERS.find(t => t.id === selectedTier) : null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Upgrade Tagging Tier
            </h3>
            <button
              onClick={onCancel}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warning */}
        {playsTaggedCount > 0 && (
          <div className="mx-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">
                  {playsTaggedCount} play{playsTaggedCount !== 1 ? 's' : ''} already tagged
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Previously tagged plays won't have the new fields unless you re-tag them.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current tier */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Current:</span>
            <span className="font-medium text-gray-900">
              {getCurrentTierConfig()?.name}
            </span>
          </div>
        </div>

        {/* Tier options */}
        <div className="px-6 pb-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">Upgrade to:</p>

          {availableTiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedTier === tier.id
                  ? 'border-gray-900 bg-gray-50 ring-2 ring-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{tier.name}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{tier.tagline}</p>
                </div>
                {selectedTier === tier.id && (
                  <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTier}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              selectedTier
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>Upgrade to {getSelectedTierConfig()?.name || '...'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TierUpgradeModal;
