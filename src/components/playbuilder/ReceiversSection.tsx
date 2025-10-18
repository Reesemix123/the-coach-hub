// src/components/playbuilder/ReceiversSection.tsx
// COMPLETE REPLACEMENT with unified blocking interface
'use client';

import { useState } from 'react';
import { 
  BLOCKING_ASSIGNMENTS,
  MOTION_TYPES
} from '@/config/footballConfig';

interface Player {
  id: string;
  label: string;
  position: string;
  assignment?: string;
  blockType?: string;
  blockDirection?: { x: number; y: number };
  isPrimary?: boolean;
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift';
  motionDirection?: 'toward-center' | 'away-from-center';
}

interface ReceiversSectionProps {
  players: Player[];
  assignmentOptions: (player: Player) => string[];
  onUpdateAssignment: (playerId: string, assignment: string) => void;
  onUpdateBlockType: (playerId: string, blockType: string) => void;
  onUpdateBlockResponsibility: (playerId: string, responsibility: string) => void;
  onUpdateMotionType: (playerId: string, motionType: string) => void;
  onUpdateMotionDirection: (playerId: string, direction: 'toward-center' | 'away-from-center') => void;
  onTogglePrimary: (playerId: string) => void;
}

export function ReceiversSection({
  players,
  assignmentOptions,
  onUpdateAssignment,
  onUpdateBlockType,
  onUpdateBlockResponsibility,
  onUpdateMotionType,
  onUpdateMotionDirection,
  onTogglePrimary
}: ReceiversSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (players.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-green-50 p-3 flex items-center justify-between hover:bg-green-100 transition-colors"
      >
        <h4 className="font-semibold text-gray-900">Receivers ({players.length})</h4>
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
            {players.map(player => {
              const hasMotion = player.motionType && player.motionType !== 'None';
              
              return (
                <div key={player.id} className="bg-white p-3 rounded border border-gray-200">
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    {player.label}
                  </label>
                  
                  {/* Motion Section */}
                  <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                    <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                      Pre-Snap Motion
                    </h5>
                    
                    <div className="mb-2">
                      <label className="block text-xs text-gray-600 mb-1">Motion Type</label>
                      <select
                        value={player.motionType || 'None'}
                        onChange={(e) => onUpdateMotionType(player.id, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                      >
                        <option value="None">None</option>
                        <option value="Jet">Jet - Fast lateral to center</option>
                        <option value="Orbit">Orbit - Loop behind QB</option>
                        <option value="Across">Across - Short lateral move</option>
                        <option value="Return">Return - Fake & return to set</option>
                        <option value="Shift">Shift - Static realignment</option>
                      </select>
                    </div>
                    
                    {hasMotion && (
                      <>
                        <div className="mb-2">
                          <label className="block text-xs text-gray-600 mb-1">Direction</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => onUpdateMotionDirection(player.id, 'toward-center')}
                              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                                player.motionDirection === 'toward-center'
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              → Center
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateMotionDirection(player.id, 'away-from-center')}
                              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                                player.motionDirection === 'away-from-center'
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              ← Away
                            </button>
                          </div>
                        </div>
                        
                        {player.motionType && MOTION_TYPES[player.motionType.toUpperCase()] && (
                          <div className="text-xs text-blue-700 italic p-2 bg-blue-50 rounded border border-blue-200">
                            ℹ️ {MOTION_TYPES[player.motionType.toUpperCase()].description}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Assignment Section */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1 font-semibold">
                      {hasMotion ? 'Post-Snap Action (from motion endpoint)' : 'Assignment'}
                    </label>
                    <select
                      value={player.assignment || ''}
                      onChange={(e) => onUpdateAssignment(player.id, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 mb-2"
                    >
                      <option value="">Select...</option>
                      {assignmentOptions(player).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Blocking Details - Same as Offensive Line */}
                  {player.assignment === 'Block' && (
                    <div className="space-y-2 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Block Type</label>
                        <select
                          value={player.blockType || ''}
                          onChange={(e) => onUpdateBlockType(player.id, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        >
                          <option value="">Select...</option>
                          {BLOCKING_ASSIGNMENTS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      
                      {player.blockType && (
                        <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                          💡 <strong>Drag the arrow on the diagram</strong> to set blocking assignment
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Primary Receiver Toggle */}
                  {player.assignment && player.assignment !== 'Block' && player.assignment !== 'Draw Route (Custom)' && (
                    <label className="flex items-center text-xs text-gray-600 cursor-pointer hover:text-gray-800 mt-2">
                      <input
                        type="checkbox"
                        checked={player.isPrimary || false}
                        onChange={() => onTogglePrimary(player.id)}
                        className="w-3 h-3 mr-1"
                      />
                      Primary receiver (red route)
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}