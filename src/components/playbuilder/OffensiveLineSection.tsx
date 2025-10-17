// src/components/playbuilder/OffensiveLineSection.tsx
'use client';

import { useState } from 'react';
import { BLOCKING_ASSIGNMENTS } from '@/config/footballConfig';

interface Player {
  id: string;
  label: string;
  position: string;
  blockType?: string;
  blockDirection?: { x: number; y: number }; // NEW: Draggable blocking direction
}

interface OffensiveLineSectionProps {
  players: Player[];
  onUpdateBlockType: (playerId: string, blockType: string) => void;
  onApplyBlockTypeToAll: (blockType: string) => void; // NEW: Apply to all linemen
  onUpdateBlockDirection: (playerId: string, direction: { x: number; y: number }) => void; // NEW
}

export function OffensiveLineSection({
  players,
  onUpdateBlockType,
  onApplyBlockTypeToAll,
  onUpdateBlockDirection
}: OffensiveLineSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);

  if (players.length === 0) return null;

  const handleBlockTypeChange = (playerId: string, blockType: string) => {
    if (applyToAll) {
      onApplyBlockTypeToAll(blockType);
    } else {
      onUpdateBlockType(playerId, blockType);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-50 p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <h4 className="font-semibold text-gray-900">Offensive Line ({players.length})</h4>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="p-4 bg-gray-50">
          {/* Apply to All Checkbox */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 mr-2"
              />
              <span className="text-sm font-semibold text-blue-900">
                Apply blocking assignment to all linemen
              </span>
            </label>
            {applyToAll && (
              <p className="text-xs text-blue-700 mt-1 ml-6">
                💡 When checked, changing any lineman's block type will update all linemen
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map(player => (
              <div key={player.id} className="bg-white p-3 rounded border border-gray-200">
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  {player.label}
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Block Type</label>
                    <select
                      value={player.blockType || ''}
                      onChange={(e) => handleBlockTypeChange(player.id, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">Select...</option>
                      {BLOCKING_ASSIGNMENTS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  
                  {player.blockType && (
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                      💡 <strong>Drag the arrow on the diagram</strong> to set blocking direction
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}