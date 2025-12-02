'use client';

import { forwardRef, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { GamePlanPlayWithDetails, SituationalCategoryId, PlayRelationshipWithDetails } from '@/types/football';
import { getSituationalCategories } from '@/config/gamePlanCategories';
import type { GamePlanSide } from '@/lib/services/game-plan.service';

interface PrintableGamePlanProps {
  teamName: string;
  opponent: string;
  gameDate: string;
  side: GamePlanSide;
  playsBySituation: Record<string, GamePlanPlayWithDetails[]>;
  setupCounterRelationships?: PlayRelationshipWithDetails[];
}

const PrintableGamePlan = forwardRef<HTMLDivElement, PrintableGamePlanProps>(
  function PrintableGamePlan({ teamName, opponent, gameDate, side, playsBySituation, setupCounterRelationships = [] }, ref) {
    const situationalCategories = getSituationalCategories(side);

    // Get side label
    const sideLabel = side === 'offense' ? 'OFFENSE' : side === 'defense' ? 'DEFENSE' : 'SPECIAL TEAMS';
    const sideColor = side === 'offense' ? '#2563eb' : side === 'defense' ? '#d97706' : '#7c3aed';

    // Calculate total plays
    const totalPlays = Object.values(playsBySituation).reduce((sum, plays) => sum + plays.length, 0);

    // Build a map of play_code -> call_number for all plays in this game plan
    const playCodeToCallNumber = useMemo(() => {
      const map = new Map<string, number>();
      Object.values(playsBySituation).flat().forEach(play => {
        if (play.play_code && play.call_number) {
          map.set(play.play_code, play.call_number);
        }
      });
      return map;
    }, [playsBySituation]);

    // Build a map of setup_play_code -> counter call numbers (only for counters that are in the game plan)
    const setupToCounterNumbers = useMemo(() => {
      const map = new Map<string, number[]>();
      setupCounterRelationships.forEach(rel => {
        const counterCallNumber = playCodeToCallNumber.get(rel.counter_play_code);
        if (counterCallNumber) {
          const existing = map.get(rel.setup_play_code) || [];
          existing.push(counterCallNumber);
          map.set(rel.setup_play_code, existing);
        }
      });
      // Sort each array so counters appear in order
      map.forEach((numbers, key) => {
        map.set(key, numbers.sort((a, b) => a - b));
      });
      return map;
    }, [setupCounterRelationships, playCodeToCallNumber]);

    return (
      <div ref={ref} className="print-game-plan bg-white p-8 max-w-[8.5in] mx-auto">
        <style jsx>{`
          @media print {
            .print-game-plan {
              padding: 0.5in;
              font-size: 11pt;
            }
            .page-break {
              page-break-before: always;
            }
            .no-break {
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* Header */}
        <div className="border-b-4 pb-4 mb-6" style={{ borderColor: sideColor }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{teamName}</h1>
              <h2 className="text-xl text-gray-600">vs {opponent}</h2>
              <p className="text-gray-500">{gameDate}</p>
            </div>
            <div className="text-right">
              <div
                className="text-2xl font-bold px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: sideColor }}
              >
                {sideLabel}
              </div>
              <p className="text-sm text-gray-500 mt-2">{totalPlays} plays</p>
            </div>
          </div>
        </div>

        {/* Plays organized by situation */}
        <div className="space-y-6">
          {situationalCategories.map(category => {
            const plays = playsBySituation[category.id] || [];
            if (plays.length === 0) return null;

            return (
              <div key={category.id} className="no-break">
                <h3
                  className="text-lg font-bold mb-3 pb-1 border-b-2"
                  style={{ borderColor: sideColor, color: sideColor }}
                >
                  {category.label}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {plays.map((play, index) => {
                    const counterNumbers = setupToCounterNumbers.get(play.play_code);
                    return (
                      <div
                        key={play.id || `${play.play_code}-${index}`}
                        className="flex items-start gap-3 p-2 border border-gray-200 rounded bg-gray-50"
                      >
                        {/* Call Number - large and prominent */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: sideColor }}
                        >
                          {play.call_number}
                        </div>

                        {/* Play Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 truncate">
                              {play.play?.play_name || play.play_code}
                            </span>
                            {/* Counter play indicator */}
                            {counterNumbers && counterNumbers.length > 0 && (
                              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                <ArrowRight className="w-3 h-3" />
                                {counterNumbers.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {play.play?.attributes?.formation || ''}
                            {play.play?.attributes?.playType && ` • ${play.play.attributes.playType}`}
                          </div>
                          {play.notes && (
                            <div className="text-xs text-gray-600 italic mt-1">
                              {play.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
          Generated by Titan First Read • {new Date().toLocaleDateString()}
        </div>
      </div>
    );
  }
);

export default PrintableGamePlan;
