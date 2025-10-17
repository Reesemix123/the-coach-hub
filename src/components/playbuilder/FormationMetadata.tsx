// src/components/playbuilder/FormationMetadata.tsx
'use client';

import { useState } from 'react';
import { FORMATION_METADATA } from '@/config/footballConfig';

interface FormationMetadataProps {
  formation: string;
  odk: 'offense' | 'defense' | 'specialTeams';
}

export function FormationMetadata({ formation, odk }: FormationMetadataProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Only show for offensive formations that have metadata
  if (odk !== 'offense' || !formation || !FORMATION_METADATA[formation]) {
    return null;
  }

  const metadata = FORMATION_METADATA[formation];

  return (
    <div className="mb-4 border border-blue-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-3 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors"
      >
        <h4 className="font-semibold text-gray-900">Formation Info: {formation}</h4>
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
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                {metadata.usage}
              </p>
            </div>
            <div className="ml-4 text-right">
              <div className="text-xs text-gray-600 mb-1">
                {metadata.personnel}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                  Run {metadata.runPercent}%
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-semibold">
                  Pass {metadata.passPercent}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-semibold text-green-700">✓ Strengths:</span>
              <p className="text-gray-700 mt-1">
                {metadata.strengths}
              </p>
            </div>
            <div>
              <span className="font-semibold text-red-700">⚠ Weaknesses:</span>
              <p className="text-gray-700 mt-1">
                {metadata.weaknesses}
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-blue-200">
            <span className="text-xs font-semibold text-gray-700">Common Plays: </span>
            <span className="text-xs text-gray-600">
              {metadata.commonPlays.join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}