// src/components/playbuilder/DefensiveLineSection.tsx - PHASE 1 COMPLETE
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BLITZ_GAPS } from '@/config/footballConfig';

interface Player {
  id: string;
  label: string;
  position: string;
  blitzGap?: string;
}

interface DefensiveLineSectionProps {
  players: Player[];
  onUpdateBlitz: (playerId: string, blitzGap: string) => void;
  onResetToTechnique: (playerId: string) => void;
}

export function DefensiveLineSection({ 
  players, 
  onUpdateBlitz,
  onResetToTechnique
}: DefensiveLineSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (players.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <h4 className="font-semibold text-gray-900">Defensive Line ({players.length})</h4>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {players.map(player => (
            <div key={player.id} className="bg-white p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-900">
                  {player.label} ({player.position})
                </span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Gap Assignment
                  </label>
                  <select
                    value={player.blitzGap || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        onUpdateBlitz(player.id, e.target.value);
                      } else {
                        onResetToTechnique(player.id);
                      }
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="">Hold Technique</option>
                    {BLITZ_GAPS.map(gap => (
                      <option key={gap} value={gap}>{gap}</option>
                    ))}
                  </select>
                </div>

                {player.blitzGap && (
                  <button
                    onClick={() => onResetToTechnique(player.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ← Reset to Hold Technique
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}