'use client';

import { forwardRef } from 'react';
import type { GamePlanPlayWithDetails } from '@/types/football';
import { getSituationalCategories } from '@/config/gamePlanCategories';
import type { GamePlanSide } from '@/lib/services/game-plan.service';

interface PrintableWristbandProps {
  teamName: string;
  opponent: string;
  gameDate: string;
  side: GamePlanSide;
  playsBySituation: Record<string, GamePlanPlayWithDetails[]>;
  format?: 'compact' | 'standard' | 'large';
}

const PrintableWristband = forwardRef<HTMLDivElement, PrintableWristbandProps>(
  function PrintableWristband(
    { teamName, opponent, gameDate, side, playsBySituation, format = 'standard' },
    ref
  ) {
    const situationalCategories = getSituationalCategories(side);

    // Get side styling
    const sideLabel = side === 'offense' ? 'OFF' : side === 'defense' ? 'DEF' : 'ST';
    const headerBg = side === 'offense' ? 'bg-blue-600' : side === 'defense' ? 'bg-amber-600' : 'bg-purple-600';
    const categoryBg = side === 'offense' ? 'bg-blue-100' : side === 'defense' ? 'bg-amber-100' : 'bg-purple-100';
    const categoryText = side === 'offense' ? 'text-blue-800' : side === 'defense' ? 'text-amber-800' : 'text-purple-800';
    const numberBg = side === 'offense' ? 'bg-blue-600' : side === 'defense' ? 'bg-amber-600' : 'bg-purple-600';

    // Determine sizing based on format
    const containerClass = format === 'compact'
      ? 'max-w-[3.5in]'
      : format === 'large'
      ? 'max-w-[5in]'
      : 'max-w-[4in]';

    const textSize = format === 'compact'
      ? 'text-[7pt]'
      : format === 'large'
      ? 'text-[10pt]'
      : 'text-[8pt]';

    const numberSize = format === 'compact'
      ? 'w-4 h-4 text-[7pt]'
      : format === 'large'
      ? 'w-6 h-6 text-[10pt]'
      : 'w-5 h-5 text-[8pt]';

    // Collect all plays for this side
    const allPlays: Array<{ play: GamePlanPlayWithDetails; situation: string; categoryLabel: string }> = [];
    situationalCategories.forEach(category => {
      const plays = playsBySituation[category.id] || [];
      plays.forEach(play => {
        allPlays.push({
          play,
          situation: category.id,
          categoryLabel: category.shortLabel || category.label.slice(0, 8)
        });
      });
    });

    // Sort by call number
    allPlays.sort((a, b) => (a.play.call_number || 0) - (b.play.call_number || 0));

    return (
      <div ref={ref} className={`print-wristband bg-white ${containerClass} mx-auto`}>
        <style jsx>{`
          @media print {
            .print-wristband {
              padding: 0.1in;
              margin: 0;
            }
            .wristband-section {
              page-break-inside: avoid;
            }
          }
          @media screen {
            .print-wristband {
              border: 2px dashed #ccc;
              padding: 0.25in;
            }
          }
        `}</style>

        {/* Compact Header */}
        <div className={`${headerBg} text-white px-2 py-1 mb-1 rounded-t flex justify-between items-center`}>
          <span className={`font-bold ${format === 'compact' ? 'text-[9pt]' : 'text-[11pt]'}`}>
            {sideLabel} • vs {opponent}
          </span>
          <span className={format === 'compact' ? 'text-[7pt]' : 'text-[8pt]'}>
            {gameDate}
          </span>
        </div>

        {/* Plays Grid - Organized by Situation */}
        <div className="space-y-1">
          {situationalCategories.map(category => {
            const plays = playsBySituation[category.id] || [];
            if (plays.length === 0) return null;

            // Short label for wristband
            const shortLabel = category.shortLabel || category.label.slice(0, 12);

            return (
              <div key={category.id} className="wristband-section">
                {/* Category Header */}
                <div className={`${categoryBg} ${categoryText} px-1 py-0.5 font-bold ${textSize} border-b border-gray-300`}>
                  {shortLabel}
                </div>

                {/* Plays Grid - 2 columns */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-1 py-0.5">
                  {plays.map((play, index) => (
                    <div
                      key={play.id || `${play.play_code}-${index}`}
                      className={`flex items-center gap-1 ${textSize}`}
                    >
                      {/* Call Number */}
                      <span className={`${numberBg} text-white ${numberSize} rounded flex-shrink-0 flex items-center justify-center font-bold`}>
                        {play.call_number}
                      </span>

                      {/* Play Name - truncated */}
                      <span className="truncate text-gray-900 font-medium">
                        {abbreviatePlayName(play.play?.play_name || play.play_code)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cutline indicator */}
        <div className="mt-2 pt-1 border-t border-dashed border-gray-300 text-center text-[6pt] text-gray-400">
          ✂ Cut along dashed line
        </div>
      </div>
    );
  }
);

/**
 * Abbreviate play names for wristband display
 */
function abbreviatePlayName(name: string): string {
  if (!name) return '';

  // Common abbreviations
  const abbreviations: Record<string, string> = {
    'Shotgun': 'SG',
    'Under Center': 'UC',
    'Pistol': 'Pstl',
    'I-Formation': 'I',
    'Spread': 'Sprd',
    'Singleback': 'Sngl',
    'Zone': 'Zn',
    'Power': 'Pwr',
    'Counter': 'Ctr',
    'Sweep': 'Swp',
    'Slant': 'Slt',
    'Out': 'Out',
    'Post': 'Pst',
    'Corner': 'Cnr',
    'Curl': 'Crl',
    'Fade': 'Fde',
    'Screen': 'Scn',
    'Draw': 'Drw',
    'Quick': 'Qk',
    'Deep': 'Dp',
    'Short': 'Sht',
    'Middle': 'Mid',
    'Left': 'L',
    'Right': 'R',
    'Inside': 'In',
    'Outside': 'Out',
    'Cover': 'Cvr',
    'Blitz': 'Blz',
    'Man': 'Man',
    'Press': 'Prs',
  };

  let result = name;
  for (const [full, short] of Object.entries(abbreviations)) {
    result = result.replace(new RegExp(full, 'gi'), short);
  }

  // Truncate if still too long
  return result.length > 18 ? result.slice(0, 16) + '..' : result;
}

export default PrintableWristband;
