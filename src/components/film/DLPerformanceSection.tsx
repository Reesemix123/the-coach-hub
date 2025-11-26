'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { DLRunDefenseSection } from './DLRunDefenseSection';
import { DLPassRushSection } from './DLPassRushSection';
import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { OPPONENT_PLAY_TYPES } from '@/config/footballConfig';

interface DLPerformanceSectionProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  players: any[];
}

export function DLPerformanceSection({ register, watch, setValue, players }: DLPerformanceSectionProps) {
  const playType = watch('opponent_play_type');
  const isRunPlay = OPPONENT_PLAY_TYPES.run.includes(playType);
  const isPassPlay = OPPONENT_PLAY_TYPES.pass.includes(playType);

  return (
    <CollapsibleSection
      title="Defensive Line Performance"
      subtitle="Track DL run defense and pass rush (Tier 3)"
      colorScheme="red"
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Run Defense Section - Only show for run plays */}
        {isRunPlay && (
          <div className="pb-4 border-b border-gray-200">
            <DLRunDefenseSection
              register={register}
              watch={watch}
              setValue={setValue}
              players={players}
            />
          </div>
        )}

        {/* Pass Rush Section - Only show for pass plays */}
        {isPassPlay && (
          <div>
            <DLPassRushSection
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
            Select opponent play type above to see DL tracking options
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
