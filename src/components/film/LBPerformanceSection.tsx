'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { LBRunStopSection } from './LBRunStopSection';
import { LBPassCoverageSection } from './LBPassCoverageSection';
import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { OPPONENT_PLAY_TYPES } from '@/config/footballConfig';

interface LBPerformanceSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

export function LBPerformanceSection({ register, watch, setValue, players }: LBPerformanceSectionProps) {
  const playType = watch('opponent_play_type');
  const isRunPlay = OPPONENT_PLAY_TYPES.run.includes(playType);
  const isPassPlay = OPPONENT_PLAY_TYPES.pass.includes(playType);

  return (
    <CollapsibleSection
      title="Linebacker Performance"
      subtitle="Track LB run fits and pass coverage (Tier 3)"
      colorScheme="red"
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Run Stop Section - Only show for run plays */}
        {isRunPlay && (
          <div className="pb-4 border-b border-gray-200">
            <LBRunStopSection
              register={register}
              watch={watch}
              setValue={setValue}
              players={players}
            />
          </div>
        )}

        {/* Pass Coverage Section - Only show for pass plays */}
        {isPassPlay && (
          <div>
            <LBPassCoverageSection
              register={register}
              watch={watch}
              setValue={setValue}
              players={players}
            />
          </div>
        )}

        {/* Show message if no play type selected */}
        {!isRunPlay && !isPassPlay && (
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 rounded border border-gray-200">
            Select opponent play type above to see LB tracking options
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
