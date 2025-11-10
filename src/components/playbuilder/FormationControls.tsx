'use client';

import Tooltip from '@/components/Tooltip';
import { FormationMetadata } from './FormationMetadata';
import {
  OFFENSIVE_FORMATIONS,
  DEFENSIVE_FORMATIONS,
  SPECIAL_TEAMS_PLAYS,
  OFFENSIVE_ATTRIBUTES,
  RUNNING_HOLES
} from '@/config/footballConfig';

interface Player {
  id: string;
  x: number;
  y: number;
  label: string;
  position: string;
  side: 'offense' | 'defense';
}

interface FormationControlsProps {
  playName: string;
  playCode: string;
  odk: 'offense' | 'defense' | 'specialTeams';
  formation: string;
  playType: string;
  targetHole: string;
  ballCarrier: string;
  coverage: string;
  specialTeamPlay: string;
  dummyOffenseFormation: string;
  dummyDefenseFormation: string;
  teamName?: string;
  existingPlay?: any;
  availableFormations: string[];
  potentialBallCarriers: Player[];
  onPlayNameChange: (value: string) => void;
  onOdkChange: (value: 'offense' | 'defense' | 'specialTeams') => void;
  onFormationChange: (value: string) => void;
  onPlayTypeChange: (value: string) => void;
  onTargetHoleChange: (value: string) => void;
  onBallCarrierChange: (value: string) => void;
  onCoverageChange: (value: string) => void;
  onSpecialTeamPlayChange: (value: string) => void;
  onDummyOffenseChange: (value: string) => void;
  onDummyDefenseChange: (value: string) => void;
}

export default function FormationControls({
  playName,
  playCode,
  odk,
  formation,
  playType,
  targetHole,
  ballCarrier,
  coverage,
  specialTeamPlay,
  dummyOffenseFormation,
  dummyDefenseFormation,
  teamName,
  existingPlay,
  availableFormations,
  potentialBallCarriers,
  onPlayNameChange,
  onOdkChange,
  onFormationChange,
  onPlayTypeChange,
  onTargetHoleChange,
  onBallCarrierChange,
  onCoverageChange,
  onSpecialTeamPlayChange,
  onDummyOffenseChange,
  onDummyDefenseChange
}: FormationControlsProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {existingPlay ? 'Edit Play' : 'Create New Play'}
          </h2>
          {teamName && (
            <p className="text-sm text-gray-600 mt-1">Team: {teamName}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Play Code</p>
          <p className="text-2xl font-bold text-gray-900">{playCode}</p>
        </div>
      </div>

      <div className="mb-6">
        <Tooltip content="Give your play a memorable name. Examples: '22 Power', 'Four Verts', 'Cover 2 Blitz'">
          <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
            Play Name *
          </label>
        </Tooltip>
        <input
          type="text"
          value={playName}
          onChange={(e) => onPlayNameChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md text-gray-900 ${
            playName.trim() ? 'border-gray-300' : 'border-red-300 bg-red-50'
          }`}
          placeholder="e.g., 22 Power, Cover 2 Blitz"
        />
        {!playName.trim() && (
          <p className="text-xs text-red-600 mt-1">Play name is required</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <Tooltip content="Choose Offense, Defense, or Special Teams. This determines which formations are available.">
            <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
              Type (ODK) *
            </label>
          </Tooltip>
          <select
            value={odk}
            onChange={(e) => onOdkChange(e.target.value as 'offense' | 'defense' | 'specialTeams')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="offense">Offense</option>
            <option value="defense">Defense</option>
            <option value="specialTeams">Special Teams</option>
          </select>
        </div>

        <div>
          <Tooltip content="Select a formation to place players on the field. Players can be repositioned after loading.">
            <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
              Formation * ({availableFormations.length} available)
            </label>
          </Tooltip>
          <select
            value={formation}
            onChange={(e) => onFormationChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md text-gray-900 ${
              formation ? 'border-gray-300' : 'border-red-300 bg-red-50'
            }`}
          >
            <option value="">Select Formation...</option>
            {availableFormations.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {!formation && (
            <p className="text-xs text-red-600 mt-1">Formation is required</p>
          )}
        </div>

        {odk === 'offense' && (
          <div>
            <Tooltip content="Choose Run for rushing plays or Pass for passing plays. This determines what assignments are available.">
              <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
                Play Type *
              </label>
            </Tooltip>
            <select
              value={playType}
              onChange={(e) => onPlayTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">Select...</option>
              {OFFENSIVE_ATTRIBUTES.playType.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>
        )}
        {odk === 'specialTeams' && formation && (
          <div>
            <Tooltip content="Select the specific special teams play for this formation. Options vary based on the formation selected.">
              <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
                Play *
              </label>
            </Tooltip>
            <select
              value={specialTeamPlay}
              onChange={(e) => onSpecialTeamPlayChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">Select Play...</option>
              {SPECIAL_TEAMS_PLAYS[formation]?.map(play => (
                <option key={play} value={play}>{play}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {odk === 'offense' && playType && playType !== 'Run' && playType !== 'Pass' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>🚧 Coming Soon:</strong> {playType} play configuration is under development. For now, please use Run or Pass play types.
          </p>
        </div>
      )}

      {odk === 'offense' && playType === 'Run' && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Tooltip content="Select which gap or hole the ball carrier will attack. Numbered from inside-out: 0 (A-gap) through 9 (C-gap).">
              <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
                Target Hole *
              </label>
            </Tooltip>
            <select
              value={targetHole}
              onChange={(e) => onTargetHoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">Select hole...</option>
              {RUNNING_HOLES.map(hole => (
                <option key={hole.charAt(0)} value={hole}>{hole}</option>
              ))}
            </select>
          </div>

          {targetHole && (
            <div>
              <Tooltip content="Choose which player will carry the ball on this play. Available options are backs and receivers.">
                <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
                  Ball Carrier *
                </label>
              </Tooltip>
              <select
                value={ballCarrier}
                onChange={(e) => onBallCarrierChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              >
                <option value="">Select ball carrier...</option>
                {potentialBallCarriers.map(player => (
                  <option key={player.id} value={player.label}>{player.label} ({player.position})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <FormationMetadata formation={formation} odk={odk} />

      {/* Reference Defense (Only for Offense) */}
      {odk === 'offense' && formation && (
        <div className="mb-4">
          <Tooltip content="Add a semi-transparent defensive formation to see how your offense matches up. Useful for identifying blocking assignments and route reads.">
            <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
              Reference Defense (Optional)
            </label>
          </Tooltip>
          <select
            value={dummyDefenseFormation}
            onChange={(e) => onDummyDefenseChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">None</option>
            {Object.keys(DEFENSIVE_FORMATIONS).map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {dummyDefenseFormation && (
            <p className="text-xs text-gray-600 mt-1">
              Semi-transparent defense shown for matchup reference. Drag to adjust positioning.
            </p>
          )}
        </div>
      )}

      {/* Reference Offense (Only for Defense) */}
      {odk === 'defense' && (
        <div className="mb-4">
          <Tooltip content="Add a semi-transparent offensive formation to see how your defense aligns against it. Useful for setting gap responsibilities and coverage zones.">
            <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
              Reference Offense (Optional)
            </label>
          </Tooltip>
          <select
            value={dummyOffenseFormation}
            onChange={(e) => onDummyOffenseChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">None</option>
            {Object.keys(OFFENSIVE_FORMATIONS).map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {dummyOffenseFormation && (
            <p className="text-xs text-gray-600 mt-1">
              Semi-transparent offense shown for gap reference. Drag to adjust positioning.
            </p>
          )}
        </div>
      )}

      {odk === 'defense' && (
        <div className="mb-4">
          <Tooltip content="Select your defensive coverage scheme. This automatically assigns defensive backs to their zones or man coverage responsibilities.">
            <label className="block text-sm font-semibold text-gray-800 mb-1 cursor-help">
              Coverage *
            </label>
          </Tooltip>
          <select
            value={coverage}
            onChange={(e) => onCoverageChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">Select Coverage...</option>
            <option value="Cover 0">Cover 0 (Man, No Deep Help)</option>
            <option value="Cover 1">Cover 1 (Man Free)</option>
            <option value="Cover 2">Cover 2 (Two Deep Halves)</option>
            <option value="Cover 3">Cover 3 (Three Deep Thirds)</option>
            <option value="Cover 4">Cover 4 (Quarters)</option>
            <option value="Cover 6">Cover 6 (Quarter-Quarter-Half)</option>
          </select>
        </div>
      )}
    </div>
  );
}
