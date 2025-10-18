// src/components/playbuilder/DBSection.tsx
'use client';

import { useState } from 'react';
import { COVERAGE_ROLES, BLITZ_GAPS } from '@/config/footballConfig';

interface Player {
  id: string;
  label: string;
  position: string;
  coverageRole?: string;
  coverageDescription?: string;
  blitzGap?: string;
}

interface DBSectionProps {
  players: Player[];
  onUpdateRole: (playerId: string, role: string) => void;
  onUpdateBlitz: (playerId: string, blitzGap: string) => void;
  onResetToRole: (playerId: string) => void;
}

export function DBSection({
  players,
  onUpdateRole,
  onUpdateBlitz,
  onResetToRole
}: DBSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (players.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-green-50 p-3 flex items-center justify-between hover:bg-green-100 transition-colors"
      >
        <h4 className="font-semibold text-gray-900">Safeties / Cornerbacks ({players.length})</h4>
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
        <div className="p-4 bg-green-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {players.map(player => (
              <div key={player.id} className="bg-white p-3 rounded border border-gray-200">
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  {player.label}
                </label>
                
                {/* Show current assignment */}
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <div className="font-semibold text-blue-900">
                    {player.blitzGap ? `🔴 Blitz: ${player.blitzGap}` : `✓ ${player.coverageRole || 'Coverage Role'}`}
                  </div>
                  {!player.blitzGap && player.coverageDescription && (
                    <div className="text-blue-700 mt-1">{player.coverageDescription}</div>
                  )}
                </div>

                {/* Action dropdown */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Action</label>
                  <select
                    value={player.blitzGap || player.coverageRole || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        onResetToRole(player.id);
                      } else if (BLITZ_GAPS.includes(value as any)) {
                        onUpdateBlitz(player.id, value);
                      } else {
                        onUpdateRole(player.id, value);
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                  >
                    <option value="">Keep Coverage Role</option>
                    <optgroup label="Change Role">
                      {COVERAGE_ROLES.DB.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Add Blitz">
                      {BLITZ_GAPS.map(gap => (
                        <option key={gap} value={gap}>{gap}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}