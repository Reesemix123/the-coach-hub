'use client';

import { OffensiveLineSection } from './OffensiveLineSection';
import { BacksSection } from './BacksSection';
import { ReceiversSection } from './ReceiversSection';
import { DefensiveLineSection } from './DefensiveLineSection';
import { LinebackersSection } from './LinebackersSection';
import { DBSection } from './DBSection';
import { isDefensiveLineman, isLinebacker, isDefensiveBack } from '@/config/footballConfig';

interface Player {
  id: string;
  x: number;
  y: number;
  label: string;
  position: string;
  side: 'offense' | 'defense';
  assignment?: string;
  blockType?: string;
  blockDirection?: { x: number; y: number };
  isPrimary?: boolean;
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift';
  motionDirection?: 'toward-center' | 'away-from-center';
  motionEndpoint?: { x: number; y: number };
  coverageRole?: string;
  coverageDepth?: number;
  coverageDescription?: string;
  blitzGap?: string;
  zoneEndpoint?: { x: number; y: number };
  isDummy?: boolean;
}

interface AssignmentPanelProps {
  odk: 'offense' | 'defense' | 'specialTeams';
  playType: string;
  coverage: string;
  players: Player[];
  linemen: Player[];
  backs: Player[];
  receivers: Player[];
  ballCarrier: string;
  targetHole: string;
  getAssignmentOptionsForPlayer: (player: Player) => string[];
  onUpdateBlockType: (id: string, blockType: string) => void;
  onApplyBlockTypeToAll: (blockType: string) => void;
  onUpdateBlockDirection: (id: string, direction: { x: number; y: number }) => void;
  onUpdateAssignment: (id: string, assignment: string) => void;
  onUpdateMotionType: (id: string, motionType: string) => void;
  onUpdateMotionDirection: (id: string, direction: string) => void;
  onTogglePrimary: (id: string) => void;
  onUpdateBlitz: (id: string, gap: string) => void;
  onResetToTechnique: (id: string) => void;
  onUpdateCoverageRole: (id: string, role: string, depth?: number, description?: string) => void;
  onResetToRole: (id: string) => void;
}

export default function AssignmentPanel({
  odk,
  playType,
  coverage,
  players,
  linemen,
  backs,
  receivers,
  ballCarrier,
  targetHole,
  getAssignmentOptionsForPlayer,
  onUpdateBlockType,
  onApplyBlockTypeToAll,
  onUpdateBlockDirection,
  onUpdateAssignment,
  onUpdateMotionType,
  onUpdateMotionDirection,
  onTogglePrimary,
  onUpdateBlitz,
  onResetToTechnique,
  onUpdateCoverageRole,
  onResetToRole
}: AssignmentPanelProps) {
  // Offensive assignments
  if (odk === 'offense' && (playType === 'Run' || playType === 'Pass') && players.length > 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Player Assignments</h3>

        <OffensiveLineSection
          players={linemen}
          onUpdateBlockType={onUpdateBlockType}
          onApplyBlockTypeToAll={onApplyBlockTypeToAll}
          onUpdateBlockDirection={onUpdateBlockDirection}
        />

        <BacksSection
          players={backs}
          playType={playType}
          ballCarrier={ballCarrier}
          targetHole={targetHole}
          assignmentOptions={getAssignmentOptionsForPlayer}
          onUpdateAssignment={onUpdateAssignment}
          onUpdateBlockType={onUpdateBlockType}
          onUpdateBlockResponsibility={(id, resp) => {}}
          onUpdateMotionType={onUpdateMotionType}
          onUpdateMotionDirection={onUpdateMotionDirection}
          onTogglePrimary={onTogglePrimary}
        />

        <ReceiversSection
          players={receivers}
          assignmentOptions={getAssignmentOptionsForPlayer}
          onUpdateAssignment={onUpdateAssignment}
          onUpdateBlockType={onUpdateBlockType}
          onUpdateBlockResponsibility={(id, resp) => {}}
          onUpdateMotionType={onUpdateMotionType}
          onUpdateMotionDirection={onUpdateMotionDirection}
          onTogglePrimary={onTogglePrimary}
        />
      </div>
    );
  }

  // Defensive assignments
  if (odk === 'defense' && coverage && players.length > 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Defensive Assignments</h3>

        <DefensiveLineSection
          players={players.filter(p => isDefensiveLineman(p.position))}
          onUpdateBlitz={onUpdateBlitz}
          onResetToTechnique={onResetToTechnique}
        />

        <LinebackersSection
          players={players.filter(p => isLinebacker(p.position))}
          onUpdateRole={onUpdateCoverageRole}
          onUpdateBlitz={onUpdateBlitz}
          onResetToRole={onResetToRole}
        />

        <DBSection
          players={players.filter(p => isDefensiveBack(p.position))}
          onUpdateRole={onUpdateCoverageRole}
          onUpdateBlitz={onUpdateBlitz}
          onResetToRole={onResetToRole}
        />
      </div>
    );
  }

  // No assignments to show
  return null;
}
