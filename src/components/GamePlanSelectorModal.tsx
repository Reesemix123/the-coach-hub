/**
 * GamePlanSelectorModal Component
 *
 * Modal for selecting a game plan to add plays to.
 * Replaces the prompt() with a proper dropdown UI.
 *
 * @example
 * <GamePlanSelectorModal
 *   isOpen={showModal}
 *   gamePlans={gamePlans}
 *   selectedCount={5}
 *   onSelect={(gamePlanId) => handleAddToGamePlan(gamePlanId)}
 *   onClose={() => setShowModal(false)}
 * />
 */

'use client';

import { useState } from 'react';
import type { GamePlan } from '@/types/football';

interface GamePlanSelectorModalProps {
  isOpen: boolean;
  gamePlans: GamePlan[];
  selectedCount: number;
  onSelect: (gamePlanId: string) => void;
  onClose: () => void;
}

export default function GamePlanSelectorModal({
  isOpen,
  gamePlans,
  selectedCount,
  onSelect,
  onClose,
}: GamePlanSelectorModalProps) {
  const [selectedGamePlanId, setSelectedGamePlanId] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedGamePlanId) {
      onSelect(selectedGamePlanId);
      setSelectedGamePlanId('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Add to Existing Game Plan
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Select which game plan to add {selectedCount} play{selectedCount === 1 ? '' : 's'} to
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Game Plan
          </label>
          <select
            value={selectedGamePlanId}
            onChange={(e) => setSelectedGamePlanId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            autoFocus
          >
            <option value="">Select a game plan...</option>
            {gamePlans.map((gamePlan) => (
              <option key={gamePlan.id} value={gamePlan.id}>
                {gamePlan.name} {gamePlan.opponent ? `(vs ${gamePlan.opponent})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedGamePlanId}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Add to Game Plan
          </button>
        </div>
      </div>
    </div>
  );
}
