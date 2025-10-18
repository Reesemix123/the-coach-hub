// src/components/playbuilder/PlayBuilder.tsx - PHASE 2 COMPLETE
// This is a COMPLETE file replacement - includes Phase 1 + Phase 2

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { PlayAttributes, PlayDiagram } from '@/types/football';
import {
  OFFENSIVE_FORMATIONS,
  DEFENSIVE_FORMATIONS,
  SPECIAL_TEAMS_FORMATIONS,
  SPECIAL_TEAMS_PLAYS,
  isOffensiveStyleSpecialTeam,
  OFFENSIVE_ATTRIBUTES,
  RUNNING_HOLES,
  getAssignmentOptions,
  POSITION_GROUPS,
  calculateMotionEndpoint,
  applyCoverageToFormation,
  COVERAGES,
  BLITZ_GAPS,
  getGapPositionFromName,
  isDefensiveLineman,
  isLinebacker,
  isDefensiveBack
} from '@/config/footballConfig';
import {
  validateOffensiveFormation,
  validateDefensiveFormation,
  checkIllegalFormation,
  checkOffsides,
  validateMotion,
  type FormationValidation
} from '@/config/footballRules';

import { FormationMetadata } from './FormationMetadata';
import { OffensiveLineSection } from './OffensiveLineSection';
import { BacksSection } from './BacksSection';
import { ReceiversSection } from './ReceiversSection';
import { ValidationModal } from './ValidationModal';
import { DefensiveLineSection } from './DefensiveLineSection';
import { LinebackersSection } from './LinebackersSection';
import { DBSection } from './DBSection';

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
  isDummy?: boolean; // PHASE 2: Flag for dummy offense players
}

interface Route {
  id: string;
  playerId: string;
  points: Array<{ x: number; y: number }>;
  assignment?: string;
  isPrimary?: boolean;
}

interface PlayBuilderProps {
  teamId: string;
  teamName?: string;
  existingPlay?: {
    id: string;
    play_code: string;
    play_name: string;
    attributes: PlayAttributes;
    diagram: PlayDiagram;
  };
  onSave?: () => void;
}

export default function PlayBuilder({ teamId, teamName, existingPlay, onSave }: PlayBuilderProps) {
  const supabase = createClient();
  
  const [playName, setPlayName] = useState(existingPlay?.play_name || '');
  const [playCode, setPlayCode] = useState(existingPlay?.play_code || '');
  const [odk, setOdk] = useState<'offense' | 'defense' | 'specialTeams'>(
    existingPlay?.attributes.odk || 'offense'
  );
  const [formation, setFormation] = useState(existingPlay?.attributes.formation || '');
  
  const [playType, setPlayType] = useState(existingPlay?.attributes.playType || '');
  const [targetHole, setTargetHole] = useState(existingPlay?.attributes.targetHole || '');
  const [ballCarrier, setBallCarrier] = useState(existingPlay?.attributes.ballCarrier || '');
  
  const [coverage, setCoverage] = useState(existingPlay?.attributes.coverage || '');
  const [specialTeamType, setSpecialTeamType] = useState('');
const [specialTeamPlay, setSpecialTeamPlay] = useState('');
  // PHASE 2: Dummy offense state
  const [dummyOffenseFormation, setDummyOffenseFormation] = useState('');
  const [dummyOffensePlayers, setDummyOffensePlayers] = useState<Player[]>([]);
  
  // PHASE 2: Dummy defense state
  const [dummyDefenseFormation, setDummyDefenseFormation] = useState('');
  const [dummyDefensePlayers, setDummyDefensePlayers] = useState<Player[]>([]);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedMotionEndpoint, setDraggedMotionEndpoint] = useState<string | null>(null);
  const [draggedBlockDirection, setDraggedBlockDirection] = useState<string | null>(null);
  const [draggedZoneEndpoint, setDraggedZoneEndpoint] = useState<string | null>(null);
  
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Array<{ x: number; y: number }>>([]);
  
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<FormationValidation | null>(null);
  const [saveAnywayConfirmed, setSaveAnywayConfirmed] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!existingPlay && !playCode) {
      const generateCode = async () => {
        const { data, error } = await supabase
          .from('playbook_plays')
          .select('play_code')
          .eq('team_id', teamId === 'personal' ? null : teamId)
          .order('play_code', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error generating play code:', error);
          setPlayCode('P-001');
          return;
        }

        if (data && data.length > 0) {
          const lastCode = data[0].play_code;
          const match = lastCode.match(/P-(\d+)/);
          if (match) {
            const nextNum = parseInt(match[1]) + 1;
            setPlayCode(`P-${nextNum.toString().padStart(3, '0')}`);
          } else {
            setPlayCode('P-001');
          }
        } else {
          setPlayCode('P-001');
        }
      };
      generateCode();
    }
  }, [existingPlay, playCode, teamId, supabase]);

  useEffect(() => {
    if (existingPlay?.diagram) {
      setPlayers(existingPlay.diagram.players.map((p, idx) => ({
        id: `player-${idx}`,
        x: p.x,
        y: p.y,
        label: p.label,
        position: p.position,
        side: existingPlay.diagram.odk === 'defense' ? 'defense' : 'offense',
        assignment: p.assignment,
        blockType: p.blockType,
        blockDirection: p.blockDirection,
        isPrimary: p.isPrimary || false,
        motionType: p.motionType || 'None',
        motionDirection: p.motionDirection || 'toward-center',
        motionEndpoint: p.motionEndpoint,
        coverageRole: p.coverageRole,
        coverageDepth: p.coverageDepth,
        coverageDescription: p.coverageDescription,
        blitzGap: p.blitzGap,
        zoneEndpoint: p.zoneEndpoint
      })));
      setRoutes(existingPlay.diagram.routes || []);
    }
  }, [existingPlay]);

  useEffect(() => {
    if (!existingPlay) {
      setRoutes([]);
      setPlayers(prev => prev.map(p => ({
        ...p,
        assignment: undefined,
        blockType: undefined,
        blockDirection: undefined,
        isPrimary: false
      })));
    }
  }, [playType, existingPlay]);

  useEffect(() => {
    if (odk === 'defense' && coverage && players.length > 0) {
      const updatedPlayers = applyCoverageToFormation(players, coverage);
      setPlayers(updatedPlayers);
    }
  }, [coverage, odk]);

  const formationList = useCallback(() => {
    switch (odk) {
      case 'offense':
        return Object.keys(OFFENSIVE_FORMATIONS);
      case 'defense':
        return Object.keys(DEFENSIVE_FORMATIONS);
      case 'specialTeams':
        return Object.keys(SPECIAL_TEAMS_FORMATIONS);
      default:
        return [];
    }
  }, [odk]);

  const loadFormation = (formationName: string) => {
    let formationData;
    
    if (odk === 'offense') {
      formationData = OFFENSIVE_FORMATIONS[formationName];
    } else if (odk === 'defense') {
      formationData = DEFENSIVE_FORMATIONS[formationName];
    } else {
      formationData = SPECIAL_TEAMS_FORMATIONS[formationName];
    }

    if (formationData) {
      const centerX = 350;
      const formationCenter = formationData.reduce((sum, pos) => sum + pos.x, 0) / formationData.length;
      const offset = centerX - formationCenter;

      const newPlayers: Player[] = formationData.map((pos, idx) => ({
        id: `${odk}-${idx}`,
        x: pos.x + offset,
        y: pos.y,
        label: pos.label,
        position: pos.position,
        side: odk === 'defense' ? 'defense' : 'offense',
        isPrimary: false,
        motionType: 'None',
        motionDirection: 'toward-center'
      }));
      
      setPlayers(newPlayers);
      setRoutes([]);
    }
  };
const loadSpecialTeamFormation = (teamType: string) => {
  const formationData = SPECIAL_TEAMS_FORMATIONS[teamType];
  if (!formationData) {
    console.error(`Formation data not found for: ${teamType}`);
    return;
  }
  
  // Calculate center offset
  const centerX = 350;
  const formationCenter = formationData.reduce((sum, pos) => sum + pos.x, 0) / formationData.length;
  const offset = centerX - formationCenter;
  
  // Determine rendering style
  const isOffensiveStyle = isOffensiveStyleSpecialTeam(teamType);
  
  const newPlayers: Player[] = formationData.map((pos, idx) => ({
    id: `st-${idx}-${Date.now()}`,
    x: pos.x + offset,
    y: pos.y,
    label: pos.label,
    position: pos.position,
    side: isOffensiveStyle ? 'offense' : 'defense',
  }));
  
  setPlayers(newPlayers);
  setFormation(teamType);
  
  console.log(`Loaded ${teamType} formation with ${newPlayers.length} players`);
};
  // PHASE 2: Load dummy offensive formation
  const loadDummyOffense = (formationName: string) => {
    if (!formationName) {
      setDummyOffensePlayers([]);
      setDummyOffenseFormation('');
      return;
    }

    const formationData = OFFENSIVE_FORMATIONS[formationName];
    if (!formationData) return;

    const centerX = 350;
    const formationCenter = formationData.reduce((sum, pos) => sum + pos.x, 0) / formationData.length;
    const offset = centerX - formationCenter;

    const newPlayers: Player[] = formationData.map((pos, idx) => ({
      id: `dummy-offense-${idx}`,
      x: pos.x + offset,
      y: pos.y,
      label: pos.label,
      position: pos.position,
      side: 'offense',
      isDummy: true
    }));

    setDummyOffensePlayers(newPlayers);
    setDummyOffenseFormation(formationName);
  };

  // PHASE 2: Load dummy defensive formation
  const loadDummyDefense = (formationName: string) => {
    if (!formationName) {
      setDummyDefensePlayers([]);
      setDummyDefenseFormation('');
      return;
    }

    const formationData = DEFENSIVE_FORMATIONS[formationName];
    if (!formationData) return;

    const centerX = 350;
    const formationCenter = formationData.reduce((sum, pos) => sum + pos.x, 0) / formationData.length;
    const offset = centerX - formationCenter;

    const newPlayers: Player[] = formationData.map((pos, idx) => ({
      id: `dummy-defense-${idx}`,
      x: pos.x + offset,
      y: pos.y,
      label: pos.label,
      position: pos.position,
      side: 'defense',
      isDummy: true
    }));

    setDummyDefensePlayers(newPlayers);
    setDummyDefenseFormation(formationName);
  };

  const generateRoutePath = (player: Player, routeType: string): Array<{ x: number; y: number }> => {
    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;
    const lineOfScrimmage = 200;
    const isLeftSide = startX < 350;

    const routeName = routeType.split('/')[0];

    switch (routeName) {
      case 'Go':
      case 'Streak':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 100 }
        ];
      
      case 'Post':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 50 },
          { x: 350, y: lineOfScrimmage - 100 }
        ];
      
      case 'Corner':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 50 },
          { x: isLeftSide ? startX - 60 : startX + 60, y: lineOfScrimmage - 100 }
        ];
      
      case 'Out':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 40 },
          { x: isLeftSide ? startX - 80 : startX + 80, y: lineOfScrimmage - 40 }
        ];
      
      case 'In':
      case 'Dig':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 40 },
          { x: 350, y: lineOfScrimmage - 40 }
        ];
      
      case 'Slant':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 15 },
          { x: isLeftSide ? startX + 40 : startX - 40, y: lineOfScrimmage - 45 }
        ];
      
      case 'Hitch':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 30 },
          { x: startX, y: lineOfScrimmage - 25 }
        ];
      
      case 'Flat':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 10 },
          { x: isLeftSide ? startX - 60 : startX + 60, y: lineOfScrimmage - 15 }
        ];
      
      case 'Wheel':
        return [
          { x: startX, y: startY },
          { x: isLeftSide ? startX - 30 : startX + 30, y: lineOfScrimmage - 10 },
          { x: isLeftSide ? startX - 50 : startX + 50, y: lineOfScrimmage - 30 },
          { x: isLeftSide ? startX - 60 : startX + 60, y: lineOfScrimmage - 80 }
        ];

      case 'Curl':
      case 'Comeback':
        return [
          { x: startX, y: startY },
          { x: startX, y: lineOfScrimmage - 50 },
          { x: startX, y: lineOfScrimmage - 45 }
        ];

      case 'Seam':
        return [
          { x: startX, y: startY },
          { x: startX + (isLeftSide ? 20 : -20), y: lineOfScrimmage - 100 }
        ];

      case 'Fade':
        return [
          { x: startX, y: startY },
          { x: isLeftSide ? startX - 20 : startX + 20, y: lineOfScrimmage - 80 }
        ];
      
      default:
        return [{ x: startX, y: startY }];
    }
  };

  useEffect(() => {
    const newRoutes: Route[] = [];
    
    players.forEach(player => {
      if (player.assignment && player.assignment !== 'Block' && player.assignment !== 'Draw Route (Custom)') {
        const routePath = generateRoutePath(player, player.assignment);
        if (routePath.length > 1) {
          const existingRoute = routes.find(r => r.playerId === player.id);
          newRoutes.push({
            id: `route-${player.id}`,
            playerId: player.id,
            points: routePath,
            assignment: player.assignment,
            isPrimary: existingRoute?.isPrimary || player.isPrimary || false
          });
        }
      }
    });
    
    const manualRoutes = routes.filter(r => {
      const player = players.find(p => p.id === r.playerId);
      return player?.assignment === 'Draw Route (Custom)';
    });
    
    setRoutes([...newRoutes, ...manualRoutes]);
  }, [players]);

  const updatePlayerAssignment = (playerId: string, assignment: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, assignment } : p
      )
    );

    if (assignment === 'Draw Route (Custom)') {
      setTimeout(() => startCustomRoute(playerId), 100);
    } else {
      setRoutes(prev => prev.filter(r => r.playerId !== playerId));
    }
  };

  const updatePlayerBlockType = (playerId: string, blockType: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, blockType, blockDirection: undefined } : p
      )
    );
  };

  const updatePlayerCoverageRole = (playerId: string, role: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, coverageRole: role, blitzGap: undefined, zoneEndpoint: undefined } : p
      )
    );
  };

  const updatePlayerBlitz = (playerId: string, blitzGap: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, blitzGap, coverageRole: undefined, zoneEndpoint: undefined } : p
      )
    );
  };

  const resetPlayerToRole = (playerId: string) => {
    setPlayers(prev =>
      prev.map(p => {
        if (p.id === playerId && coverage) {
          const assignment = applyCoverageToFormation([p], coverage)[0];
          return {
            ...p,
            coverageRole: assignment.coverageRole,
            coverageDepth: assignment.coverageDepth,
            coverageDescription: assignment.coverageDescription,
            blitzGap: undefined,
            zoneEndpoint: undefined
          };
        }
        return p;
      })
    );
  };

  const resetPlayerToTechnique = (playerId: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, blitzGap: undefined, zoneEndpoint: undefined } : p
      )
    );
  };

  const updatePlayerZoneEndpoint = (playerId: string, endpoint: { x: number; y: number }) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, zoneEndpoint: endpoint } : p
      )
    );
  };

  const applyBlockTypeToAll = (blockType: string) => {
    setPlayers(prev =>
      prev.map(p => {
        const group = getPositionGroup(p.position);
        if (group === 'linemen') {
          return { ...p, blockType, blockDirection: undefined };
        }
        return p;
      })
    );
  };

  const updatePlayerBlockDirection = (playerId: string, direction: { x: number; y: number }) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, blockDirection: direction } : p
      )
    );
  };

  const updatePlayerMotionType = (playerId: string, motionType: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const lineOfScrimmage = 200;
    const isOnLOS = Math.abs(player.y - lineOfScrimmage) <= 5;

    const endpoint = motionType === 'None' 
      ? undefined 
      : calculateMotionEndpoint(
          { x: player.x, y: player.y },
          motionType,
          player.motionDirection || 'toward-center',
          350,
          isOnLOS
        );

    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId 
          ? { 
              ...p, 
              motionType: motionType as Player['motionType'],
              motionEndpoint: endpoint
            } 
          : p
      )
    );
  };

  const updatePlayerMotionDirection = (playerId: string, direction: 'toward-center' | 'away-from-center') => {
    const player = players.find(p => p.id === playerId);
    if (!player || !player.motionType || player.motionType === 'None') return;

    const lineOfScrimmage = 200;
    const isOnLOS = Math.abs(player.y - lineOfScrimmage) <= 5;

    const endpoint = calculateMotionEndpoint(
      { x: player.x, y: player.y },
      player.motionType,
      direction,
      350,
      isOnLOS
    );

    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId 
          ? { ...p, motionDirection: direction, motionEndpoint: endpoint } 
          : p
      )
    );
  };

  const togglePrimaryReceiver = (playerId: string) => {
    setPlayers(prev =>
      prev.map(p => ({
        ...p,
        isPrimary: p.id === playerId ? !p.isPrimary : false
      }))
    );

    setRoutes(prev =>
      prev.map(r => {
        if (r.playerId === playerId) {
          return { ...r, isPrimary: !r.isPrimary };
        } else {
          return { ...r, isPrimary: false };
        }
      })
    );
  };

  const getPositionGroup = (position: string): 'linemen' | 'backs' | 'receivers' => {
    if (POSITION_GROUPS.linemen.includes(position)) return 'linemen';
    if (POSITION_GROUPS.backs.includes(position)) return 'backs';
    return 'receivers';
  };

  const getAssignmentOptionsForPlayer = (player: Player): string[] => {
    return getAssignmentOptions(player.position, playType === 'Run' ? 'run' : 'pass');
  };

  // PHASE 2: Updated drag handlers to support dummy offense
  const handleMouseDown = (
    playerId: string, 
    isMotionEndpoint: boolean = false, 
    isBlockDirection: boolean = false,
    isZoneEndpoint: boolean = false
  ) => {
    if (isDrawingRoute) return;
    
    if (isZoneEndpoint) {
      setDraggedZoneEndpoint(playerId);
    } else if (isBlockDirection) {
      setDraggedBlockDirection(playerId);
    } else if (isMotionEndpoint) {
      setDraggedMotionEndpoint(playerId);
    } else {
      setDraggedPlayer(playerId);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 700;
    const y = ((e.clientY - rect.top) / rect.height) * 400;

    if (draggedPlayer) {
      // Check if dragging dummy offense, dummy defense, or real player
      if (draggedPlayer.startsWith('dummy-offense-')) {
        setDummyOffensePlayers(prev =>
          prev.map(p =>
            p.id === draggedPlayer ? { ...p, x, y } : p
          )
        );
      } else if (draggedPlayer.startsWith('dummy-defense-')) {
        setDummyDefensePlayers(prev =>
          prev.map(p =>
            p.id === draggedPlayer ? { ...p, x, y } : p
          )
        );
      } else {
        setPlayers(prev =>
          prev.map(p =>
            p.id === draggedPlayer ? { ...p, x, y } : p
          )
        );
      }
    } else if (draggedMotionEndpoint) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedMotionEndpoint 
            ? { ...p, motionEndpoint: { x, y } } 
            : p
        )
      );
    } else if (draggedBlockDirection) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedBlockDirection 
            ? { ...p, blockDirection: { x, y } } 
            : p
        )
      );
    } else if (draggedZoneEndpoint) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedZoneEndpoint 
            ? { ...p, zoneEndpoint: { x, y } } 
            : p
        )
      );
    }
  }, [draggedPlayer, draggedMotionEndpoint, draggedBlockDirection, draggedZoneEndpoint]);

  const handleMouseUp = () => {
    setDraggedPlayer(null);
    setDraggedMotionEndpoint(null);
    setDraggedBlockDirection(null);
    setDraggedZoneEndpoint(null);
  };

  const startCustomRoute = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;

    setSelectedPlayer(playerId);
    setIsDrawingRoute(true);
    setCurrentRoute([{ x: startX, y: startY }]);
  };

  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !isDrawingRoute || !selectedPlayer) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 700;
    const y = ((e.clientY - rect.top) / rect.height) * 400;

    setCurrentRoute(prev => [...prev, { x, y }]);
  };

  const handleFieldDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingRoute || !selectedPlayer || currentRoute.length < 2) return;
    
    const player = players.find(p => p.id === selectedPlayer);
    const filteredRoutes = routes.filter(r => r.playerId !== selectedPlayer);
    
    setRoutes([
      ...filteredRoutes,
      {
        id: `route-${Date.now()}`,
        playerId: selectedPlayer,
        points: [...currentRoute],
        assignment: player?.assignment,
        isPrimary: player?.isPrimary || false
      }
    ]);
    
    setIsDrawingRoute(false);
    setCurrentRoute([]);
    setSelectedPlayer(null);
  };

  const savePlay = async () => {
    if (!playName.trim()) {
      alert('Please enter a play name');
      return;
    }

    if (!formation) {
      alert('Please select a formation');
      return;
    }

    if (!saveAnywayConfirmed && odk === 'offense') {
      const validation = validateOffensiveFormation(players);
      const illegalFormation = checkIllegalFormation(players);
      const offsidesCheck = checkOffsides(players, 'offense');
      const motionCheck = validateMotion(players);
      
      const combinedValidation: FormationValidation = {
        isValid: validation.isValid && illegalFormation.isValid && offsidesCheck.isValid && motionCheck.isValid,
        errors: [...validation.errors, ...illegalFormation.errors, ...offsidesCheck.errors, ...motionCheck.errors],
        warnings: [...validation.warnings, ...illegalFormation.warnings, ...offsidesCheck.warnings, ...motionCheck.warnings]
      };
      
      if (!combinedValidation.isValid || combinedValidation.warnings.length > 0) {
        setValidationResult(combinedValidation);
        setShowValidationModal(true);
        return;
      }
    } else if (!saveAnywayConfirmed && odk === 'defense') {
      const validation = validateDefensiveFormation(players);
      const offsidesCheck = checkOffsides(players, 'defense');
      
      const combinedValidation: FormationValidation = {
        isValid: validation.isValid && offsidesCheck.isValid,
        errors: [...validation.errors, ...offsidesCheck.errors],
        warnings: [...validation.warnings, ...offsidesCheck.warnings]
      };
      
      if (!combinedValidation.isValid || combinedValidation.warnings.length > 0) {
        setValidationResult(combinedValidation);
        setShowValidationModal(true);
        return;
      }
    }

    setIsSaving(true);
    setSaveAnywayConfirmed(false);

    const diagram: PlayDiagram = {
      players: players.map(p => ({
        position: p.position,
        x: p.x,
        y: p.y,
        label: p.label,
        assignment: p.assignment,
        blockType: p.blockType,
        blockDirection: p.blockDirection,
        isPrimary: p.isPrimary,
        motionType: p.motionType,
        motionDirection: p.motionDirection,
        motionEndpoint: p.motionEndpoint,
        coverageRole: p.coverageRole,
        coverageDepth: p.coverageDepth,
        coverageDescription: p.coverageDescription,
        blitzGap: p.blitzGap,
        zoneEndpoint: p.zoneEndpoint
      })),
      routes: routes.map(r => ({
        id: r.id,
        playerId: r.playerId,
        path: r.points,
        type: playType === 'Pass' ? 'pass' : 'run',
        routeType: r.assignment,
        isPrimary: r.isPrimary
      })),
      formation,
      odk
    };

    const attributes: PlayAttributes = {
      odk,
      formation,
      playType: playType || undefined,
      targetHole: targetHole || undefined,
      ballCarrier: ballCarrier || undefined,
      coverage: coverage || undefined
    };

    try {
      if (existingPlay) {
        const { error } = await supabase
          .from('playbook_plays')
          .update({
            play_name: playName,
            attributes,
            diagram,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPlay.id);

        if (error) throw error;
        alert('Play updated successfully!');
      } else {
        const { error } = await supabase
          .from('playbook_plays')
          .insert({
            team_id: teamId === 'personal' ? null : teamId,
            play_code: playCode,
            play_name: playName,
            attributes,
            diagram
          });

        if (error) throw error;
        alert('Play saved successfully!');
      }

      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving play:', error);
      alert('Error saving play. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAnyway = () => {
    setSaveAnywayConfirmed(true);
    setShowValidationModal(false);
    setTimeout(() => savePlay(), 100);
  };

  const getHolePosition = (hole: string): { x: number; y: number } => {
    const linemen = players.filter(p => getPositionGroup(p.position) === 'linemen');
    const sortedLinemen = [...linemen].sort((a, b) => a.x - b.x);
    
    if (sortedLinemen.length < 2) {
      return { x: 350, y: 195 };
    }

    const center = linemen.find(p => p.position === 'C');
    const lg = linemen.find(p => p.position === 'LG');
    const rg = linemen.find(p => p.position === 'RG');
    const lt = linemen.find(p => p.position === 'LT');
    const rt = linemen.find(p => p.position === 'RT');
    
    const centerX = center?.x || 350;
    const lineOfScrimmage = 200;
    const holeY = lineOfScrimmage - 5;

    const holeMatch = hole.match(/^(\d)/);
    const holeNum = holeMatch ? holeMatch[1] : hole.charAt(0);

    switch (holeNum) {
      case '1':
        if (lg && center) return { x: (center.x + lg.x) / 2, y: holeY };
        return { x: centerX - 20, y: holeY };
      case '2':
        if (rg && center) return { x: (center.x + rg.x) / 2, y: holeY };
        return { x: centerX + 20, y: holeY };
      case '3':
        if (lg && lt) return { x: (lg.x + lt.x) / 2, y: holeY };
        return { x: centerX - 60, y: holeY };
      case '4':
        if (rg && rt) return { x: (rg.x + rt.x) / 2, y: holeY };
        return { x: centerX + 60, y: holeY };
      case '5':
        if (lt) return { x: lt.x - 30, y: holeY };
        return { x: centerX - 100, y: holeY };
      case '6':
        if (rt) return { x: rt.x + 30, y: holeY };
        return { x: centerX + 100, y: holeY };
      case '7':
        return { x: sortedLinemen[0].x - 120, y: holeY };
      case '8':
        return { x: sortedLinemen[sortedLinemen.length - 1].x + 120, y: holeY };
      default:
        return { x: centerX, y: holeY };
    }
  };

  // PHASE 2: Enhanced gap position calculation using dummy offense
  const getGapPosition = (gapName: string): { x: number; y: number } => {
    const lineOfScrimmage = 200;
    const throughLine = 205;

    // If dummy offense loaded, use their actual O-line positions for gaps
    if (dummyOffensePlayers.length > 0) {
      const dummyOLine = dummyOffensePlayers.filter(p => 
        ['C', 'LG', 'RG', 'LT', 'RT'].includes(p.position)
      );

      if (dummyOLine.length >= 5) {
        const center = dummyOLine.find(p => p.position === 'C');
        const lg = dummyOLine.find(p => p.position === 'LG');
        const rg = dummyOLine.find(p => p.position === 'RG');
        const lt = dummyOLine.find(p => p.position === 'LT');
        const rt = dummyOLine.find(p => p.position === 'RT');

        // Calculate gaps based on actual O-line spacing
        switch (gapName) {
          case 'Strong A-gap':
            if (center && lg) return { x: (center.x + lg.x) / 2, y: throughLine };
            break;
          case 'Weak A-gap':
            if (center && rg) return { x: (center.x + rg.x) / 2, y: throughLine };
            break;
          case 'Strong B-gap':
            if (lg && lt) return { x: (lg.x + lt.x) / 2, y: throughLine };
            break;
          case 'Weak B-gap':
            if (rg && rt) return { x: (rg.x + rt.x) / 2, y: throughLine };
            break;
          case 'Strong C-gap':
            if (lt) return { x: lt.x - 25, y: throughLine };
            break;
          case 'Weak C-gap':
            if (rt) return { x: rt.x + 25, y: throughLine };
            break;
        }
      }
    }

    // Fallback to standard spacing if no dummy offense or incomplete O-line
    return getGapPositionFromName(gapName, 350);
  };

  const getBlitzArrowPath = (player: Player, gapPos: { x: number; y: number }): string => {
    const startX = player.x;
    const startY = player.y;
    const endX = gapPos.x;
    const endY = gapPos.y;

    const otherPlayers = players.filter(p => p.id !== player.id && p.side === 'defense');
    
    let hasCollision = false;
    for (const other of otherPlayers) {
      const dist = pointToLineDistance(
        { x: other.x, y: other.y },
        { x: startX, y: startY },
        { x: endX, y: endY }
      );
      if (dist < 20) {
        hasCollision = true;
        break;
      }
    }

    if (!hasCollision) {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    const centerX = 350;
    const isLeftSide = startX < centerX;
    const arcX = isLeftSide ? startX - 30 : startX + 30;
    const arcY = (startY + endY) / 2;

    return `M ${startX} ${startY} Q ${arcX} ${arcY} ${endX} ${endY}`;
  };

  const pointToLineDistance = (
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getBlockingArrowDirection = (player: Player): { endX: number; endY: number } | null => {
    if (!player.blockType) return null;

    const baseLength = 35;
    const centerX = player.motionEndpoint?.x || player.x;
    const centerY = player.motionEndpoint?.y || player.y;

    if (player.blockDirection) {
      return {
        endX: player.blockDirection.x,
        endY: player.blockDirection.y
      };
    }

    let angle = -45;
    
    if (player.blockType === 'Pass Block') {
      angle = -90;
    } else if (player.blockType === 'Pull') {
      const isLeftSide = centerX < 350;
      angle = isLeftSide ? 135 : -135;
    }

    const radians = (angle * Math.PI) / 180;
    return {
      endX: centerX + baseLength * Math.cos(radians),
      endY: centerY + baseLength * Math.sin(radians)
    };
  };

  const getDefaultZoneEndpoint = (player: Player): { x: number; y: number } => {
    const startX = player.x;
    const startY = player.y;
    const depth = player.coverageDepth || 30;

    return {
      x: startX,
      y: startY - depth
    };
  };

  const renderBallCarrierArrow = (player: Player) => {
    if (playType !== 'Run' || !targetHole || player.label !== ballCarrier) return null;

    const holePos = getHolePosition(targetHole);
    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;
    const endX = holePos.x;
    const endY = holePos.y;

    let pathD = `M ${startX} ${startY}`;
    const midY = Math.max(startY, 205);
    pathD += ` L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;

    return (
      <g key={`ball-carrier-${player.id}`}>
        <defs>
          <marker
            id={`arrowhead-ball-${player.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#FF0000" />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="#FF0000"
          strokeWidth="2.5"
          markerEnd={`url(#arrowhead-ball-${player.id})`}
        />
      </g>
    );
  };

  const renderBlockingArrow = (player: Player) => {
    const arrowEnd = getBlockingArrowDirection(player);
    if (!arrowEnd) return null;

    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;

    const dx = arrowEnd.endX - startX;
    const dy = arrowEnd.endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / length * 8;
    const perpY = dx / length * 8;

    return (
      <g key={`block-${player.id}`}>
        <line
          x1={startX}
          y1={startY}
          x2={arrowEnd.endX}
          y2={arrowEnd.endY}
          stroke="#888888"
          strokeWidth="2"
        />
        <line
          x1={arrowEnd.endX - perpX}
          y1={arrowEnd.endY - perpY}
          x2={arrowEnd.endX + perpX}
          y2={arrowEnd.endY + perpY}
          stroke="#888888"
          strokeWidth="2"
        />
        <circle
          cx={arrowEnd.endX}
          cy={arrowEnd.endY}
          r="6"
          fill="#888888"
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(player.id, false, true, false);
          }}
        />
      </g>
    );
  };

  const renderMotionArrow = (player: Player) => {
    if (!player.motionType || player.motionType === 'None' || !player.motionEndpoint) return null;

    const startX = player.x;
    const startY = player.y;
    const endX = player.motionEndpoint.x;
    const endY = player.motionEndpoint.y;

    const lineOfScrimmage = 200;
    const isOnLOS = Math.abs(startY - lineOfScrimmage) <= 5;

    let pathD;
    if (isOnLOS) {
      const controlY = startY + 15;
      const controlX = (startX + endX) / 2;
      pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
    } else {
      pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    return (
      <g key={`motion-${player.id}`}>
        <defs>
          <marker
            id={`motion-arrow-${player.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#888888" />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="#888888"
          strokeWidth="2"
          strokeDasharray="5,5"
          markerEnd={`url(#motion-arrow-${player.id})`}
        />
        <circle
          cx={endX}
          cy={endY}
          r="6"
          fill="#888888"
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(player.id, true, false, false);
          }}
        />
      </g>
    );
  };

  const renderCoverageZone = (player: Player) => {
    if (isDefensiveLineman(player.position)) return null;
    if (!player.coverageRole || player.blitzGap || player.coverageRole === 'Man') return null;

    const deepRoles = ['Deep Third', 'Deep Half', 'Quarter'];
    const isDeep = deepRoles.includes(player.coverageRole);
    const zoneColor = isDeep ? '#0066CC' : '#FFD700';

    const startX = player.x;
    const startY = player.y;
    const endpoint = player.zoneEndpoint || getDefaultZoneEndpoint(player);

    const width = Math.abs(endpoint.x - startX) || 50;
    const height = Math.abs(endpoint.y - startY) || 30;

    return (
      <g key={`zone-${player.id}`}>
        <line
          x1={startX}
          y1={startY}
          x2={endpoint.x}
          y2={endpoint.y}
          stroke={zoneColor}
          strokeWidth="2"
        />
        <ellipse
          cx={endpoint.x}
          cy={endpoint.y}
          rx={Math.max(width / 2, 30)}
          ry={Math.max(height / 2, 20)}
          fill={zoneColor}
          opacity={0.25}
          stroke={zoneColor}
          strokeWidth="2"
          strokeDasharray="5,3"
        />
        <circle
          cx={endpoint.x}
          cy={endpoint.y}
          r="6"
          fill={zoneColor}
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(player.id, false, false, true);
          }}
        />
      </g>
    );
  };

  const renderBlitzArrow = (player: Player) => {
    if (!player.blitzGap) return null;

    const gapPos = getGapPosition(player.blitzGap);
    const endpoint = player.zoneEndpoint || gapPos;
    
    const pathD = getBlitzArrowPath(player, endpoint);

    return (
      <g key={`blitz-${player.id}`}>
        <defs>
          <marker
            id={`arrowhead-blitz-${player.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#DC2626" />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="#DC2626"
          strokeWidth="2.5"
          markerEnd={`url(#arrowhead-blitz-${player.id})`}
        />
        <circle
          cx={endpoint.x}
          cy={endpoint.y}
          r="6"
          fill="#DC2626"
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(player.id, false, false, true);
          }}
        />
      </g>
    );
  };

  const renderPassRoute = (route: Route) => {
    const player = players.find(p => p.id === route.playerId);
    if (!player || route.points.length < 2) return null;

    let pathD = `M ${route.points[0].x} ${route.points[0].y}`;
    for (let i = 1; i < route.points.length; i++) {
      pathD += ` L ${route.points[i].x} ${route.points[i].y}`;
    }

    const color = route.isPrimary ? '#FF0000' : '#FFD700';

    return (
      <g key={route.id}>
        <defs>
          <marker
            id={`arrowhead-route-${route.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill={color} />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          markerEnd={`url(#arrowhead-route-${route.id})`}
        />
        {route.assignment && route.assignment !== 'Draw Route (Custom)' && (
          <text
            x={route.points[route.points.length - 1].x + 10}
            y={route.points[route.points.length - 1].y - 6}
            fontSize="9"
            fill={color}
            fontWeight="bold"
          >
            {route.assignment.split('/')[0]}
          </text>
        )}
      </g>
    );
  };

  const availableFormations = formationList();
  const linemen = players.filter(p => getPositionGroup(p.position) === 'linemen');
  const backs = players.filter(p => getPositionGroup(p.position) === 'backs');
  const receivers = players.filter(p => getPositionGroup(p.position) === 'receivers');
  const potentialBallCarriers = players.filter(p => getPositionGroup(p.position) !== 'linemen');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="space-y-6">
          
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
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Play Name *
              </label>
              <input
                type="text"
                value={playName}
                onChange={(e) => setPlayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                placeholder="e.g., 22 Power, Cover 2 Blitz"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Type (ODK) *
                </label>
                <select
                  value={odk}
                  onChange={(e) => {
  setOdk(e.target.value as 'offense' | 'defense' | 'specialTeams');
  setFormation('');
  setPlayers([]);
  setRoutes([]);
  setPlayType('');
  setTargetHole('');
  setSpecialTeamType('');  // ADD THIS LINE
  setSpecialTeamPlay('');  // ADD THIS LINE
  setDummyOffenseFormation('');
  setDummyOffensePlayers([]);
  setDummyDefenseFormation('');  // ADD THIS LINE
  setDummyDefensePlayers([]);    // ADD THIS LINE
}}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="offense">Offense</option>
                  <option value="defense">Defense</option>
                  <option value="specialTeams">Special Teams</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Formation * ({availableFormations.length} available)
                </label>
                <select
                  value={formation}
                  onChange={(e) => {
                    setFormation(e.target.value);
                    if (e.target.value) loadFormation(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">Select Formation...</option>
                  {availableFormations.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {odk === 'offense' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Play Type *
                  </label>
                  <select
                    value={playType}
                    onChange={(e) => {
                      setPlayType(e.target.value);
                      setTargetHole('');
                      setBallCarrier('');
                    }}
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
    <label className="block text-sm font-semibold text-gray-800 mb-1">
      Play *
    </label>
    <select
      value={specialTeamPlay}
      onChange={(e) => setSpecialTeamPlay(e.target.value)}
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
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Target Hole *
                  </label>
                  <select
                    value={targetHole}
                    onChange={(e) => setTargetHole(e.target.value)}
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
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      Ball Carrier *
                    </label>
                    <select
                      value={ballCarrier}
                      onChange={(e) => setBallCarrier(e.target.value)}
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

            {/* PHASE 2: Dummy Defense Dropdown (Only for Offense) */}
            {odk === 'offense' && formation && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Reference Defense (Optional)
                </label>
                <select
                  value={dummyDefenseFormation}
                  onChange={(e) => loadDummyDefense(e.target.value)}
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

            {/* PHASE 2: Dummy Offense Dropdown (Only for Defense) */}
            {odk === 'defense' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Reference Offense (Optional)
                </label>
                <select
                  value={dummyOffenseFormation}
                  onChange={(e) => loadDummyOffense(e.target.value)}
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
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Coverage *
                </label>
                <select
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
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

          {odk === 'offense' && (playType === 'Run' || playType === 'Pass') && players.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Player Assignments</h3>
              
              <OffensiveLineSection
                players={linemen}
                onUpdateBlockType={updatePlayerBlockType}
                onApplyBlockTypeToAll={applyBlockTypeToAll}
                onUpdateBlockDirection={updatePlayerBlockDirection}
              />

              <BacksSection
                players={backs}
                playType={playType}
                ballCarrier={ballCarrier}
                targetHole={targetHole}
                assignmentOptions={getAssignmentOptionsForPlayer}
                onUpdateAssignment={updatePlayerAssignment}
                onUpdateBlockType={updatePlayerBlockType}
                onUpdateBlockResponsibility={(id, resp) => {}}
                onUpdateMotionType={updatePlayerMotionType}
                onUpdateMotionDirection={updatePlayerMotionDirection}
                onTogglePrimary={togglePrimaryReceiver}
              />

              <ReceiversSection
                players={receivers}
                assignmentOptions={getAssignmentOptionsForPlayer}
                onUpdateAssignment={updatePlayerAssignment}
                onUpdateBlockType={updatePlayerBlockType}
                onUpdateBlockResponsibility={(id, resp) => {}}
                onUpdateMotionType={updatePlayerMotionType}
                onUpdateMotionDirection={updatePlayerMotionDirection}
                onTogglePrimary={togglePrimaryReceiver}
              />
            </div>
          )}

          {odk === 'defense' && coverage && players.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Defensive Assignments</h3>
              
              <DefensiveLineSection
                players={players.filter(p => isDefensiveLineman(p.position))}
                onUpdateBlitz={updatePlayerBlitz}
                onResetToTechnique={resetPlayerToTechnique}
              />

              <LinebackersSection
                players={players.filter(p => isLinebacker(p.position))}
                onUpdateRole={updatePlayerCoverageRole}
                onUpdateBlitz={updatePlayerBlitz}
                onResetToRole={resetPlayerToRole}
              />

              <DBSection
                players={players.filter(p => isDefensiveBack(p.position))}
                onUpdateRole={updatePlayerCoverageRole}
                onUpdateBlitz={updatePlayerBlitz}
                onResetToRole={resetPlayerToRole}
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={savePlay}
              disabled={isSaving}
              className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isSaving ? 'Saving...' : existingPlay ? 'Update Play' : 'Save Play'}
            </button>
          </div>

        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Play Diagram</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-md text-xs leading-relaxed">
              <p className="text-gray-700">
                <strong>Drag players</strong> to reposition. <strong>Select assignments</strong> from dropdowns - routes auto-generate! 
                {isDrawingRoute && (
                  <span className="text-orange-600 font-semibold"> ✏️ Drawing mode active: Click to add points, double-click to finish.</span>
                )}
                {dummyOffenseFormation && (
                  <span className="text-blue-600 font-semibold"> 👁️ Reference offense visible - gaps adjust to O-line positions.</span>
                )}
                {dummyDefenseFormation && (
                  <span className="text-blue-600 font-semibold"> 👁️ Reference defense visible - visualize matchups.</span>
                )}
              </p>
            </div>

            <div className="border-2 border-gray-300 rounded-lg overflow-hidden relative">
              <svg
                ref={svgRef}
                viewBox="0 0 700 400"
                className="w-full h-auto bg-green-100"
                preserveAspectRatio="xMidYMid meet"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleFieldClick}
                onDoubleClick={handleFieldDoubleClick}
              >
                <rect width="700" height="400" fill="#2a6e3f" />
                
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <line
                    key={i}
                    x1="0"
                    y1={i * 40}
                    x2="700"
                    y2={i * 40}
                    stroke="white"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                ))}

                <line x1="250" y1="0" x2="250" y2="400" stroke="white" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />
                <line x1="450" y1="0" x2="450" y2="400" stroke="white" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />
                
                <line x1="0" y1="200" x2="700" y2="200" stroke="white" strokeWidth="3" />

                {/* PHASE 2: Render dummy players FIRST (underneath real players) */}
                
                {/* Dummy Offense (for defensive plays) */}
                {dummyOffensePlayers.map(player => (
                  <g key={player.id}>
                    <circle
                      cx={player.x}
                      cy={player.y}
                      r={12}
                      fill="#DC2626"
                      fillOpacity={0.4}
                      stroke="black"
                      strokeWidth={2}
                      strokeDasharray="3,3"
                      className="cursor-move"
                      onMouseDown={() => handleMouseDown(player.id)}
                    />
                    <text
                      x={player.x}
                      y={player.y + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="white"
                      opacity={0.6}
                    >
                      {player.label}
                    </text>
                  </g>
                ))}

                {/* Dummy Defense (for offensive plays) */}
                {dummyDefensePlayers.map(player => (
                  <g key={player.id}>
                    {isDefensiveLineman(player.position) ? (
                      <>
                        <rect
                          x={player.x - 12}
                          y={player.y - 12}
                          width="24"
                          height="24"
                          fill="white"
                          fillOpacity={0.4}
                          stroke="black"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                          className="cursor-move"
                          onMouseDown={() => handleMouseDown(player.id)}
                        />
                        <text
                          x={player.x}
                          y={player.y + 5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill="black"
                          opacity={0.6}
                        >
                          {player.label}
                        </text>
                      </>
                    ) : (
                      <>
                        <line
                          x1={player.x - 10}
                          y1={player.y - 10}
                          x2={player.x + 10}
                          y2={player.y + 10}
                          stroke="white"
                          strokeWidth="3"
                          opacity={0.4}
                          className="cursor-move"
                          onMouseDown={() => handleMouseDown(player.id)}
                        />
                        <line
                          x1={player.x - 10}
                          y1={player.y + 10}
                          x2={player.x + 10}
                          y2={player.y - 10}
                          stroke="white"
                          strokeWidth="3"
                          opacity={0.4}
                          className="cursor-move"
                          onMouseDown={() => handleMouseDown(player.id)}
                        />
                        <text
                          x={player.x}
                          y={player.y + 20}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill="white"
                          opacity={0.6}
                        >
                          {player.label}
                        </text>
                      </>
                    )}
                  </g>
                ))}

                {/* Render defensive coverage zones */}
                {odk === 'defense' && players.map(player => renderCoverageZone(player))}
                
                {/* Render offensive/defensive arrows */}
                {players.map(player => renderBallCarrierArrow(player))}
                {players.map(player => renderBlockingArrow(player))}
                {players.map(player => renderMotionArrow(player))}
                {players.map(player => renderBlitzArrow(player))}
                {routes.map(route => renderPassRoute(route))}

                {/* Drawing route preview */}
                {currentRoute.length > 1 && (
                  <g>
                    <path
                      d={(() => {
                        let path = `M ${currentRoute[0].x} ${currentRoute[0].y}`;
                        for (let i = 1; i < currentRoute.length; i++) {
                          path += ` L ${currentRoute[i].x} ${currentRoute[i].y}`;
                        }
                        return path;
                      })()}
                      fill="none"
                      stroke="#FF6600"
                      strokeWidth="2.5"
                      strokeDasharray="5,5"
                    />
                    {currentRoute.map((point, idx) => (
                      <circle
                        key={idx}
                        cx={point.x}
                        cy={point.y}
                        r="3"
                        fill="#FF6600"
                      />
                    ))}
                  </g>
                )}

                {/* Player Rendering */}
                {players.map(player => (
                  <g key={player.id}>
                    {player.side === 'defense' ? (
                      <>
                        {isDefensiveLineman(player.position) ? (
                          <>
                            <rect
                              x={player.x - 12}
                              y={player.y - 12}
                              width="24"
                              height="24"
                              fill="white"
                              stroke="black"
                              strokeWidth="2"
                              className="cursor-move hover:fill-gray-100"
                              onMouseDown={() => handleMouseDown(player.id)}
                            />
                            <text
                              x={player.x}
                              y={player.y + 5}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="black"
                            >
                              {player.label}
                            </text>
                          </>
                        ) : (
                          <>
                            <line
                              x1={player.x - 10}
                              y1={player.y - 10}
                              x2={player.x + 10}
                              y2={player.y + 10}
                              stroke="white"
                              strokeWidth="3"
                              className="cursor-move"
                              onMouseDown={() => handleMouseDown(player.id)}
                            />
                            <line
                              x1={player.x - 10}
                              y1={player.y + 10}
                              x2={player.x + 10}
                              y2={player.y - 10}
                              stroke="white"
                              strokeWidth="3"
                              className="cursor-move"
                              onMouseDown={() => handleMouseDown(player.id)}
                            />
                            <text
                              x={player.x}
                              y={player.y + 20}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="white"
                            >
                              {player.label}
                            </text>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <circle
                          cx={player.x}
                          cy={player.y}
                          r={12}
                          fill="#DC2626"
                          stroke="black"
                          strokeWidth={2}
                          className="cursor-move hover:fill-red-700"
                          onMouseDown={() => handleMouseDown(player.id)}
                        />
                        <text
                          x={player.x}
                          y={player.y + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill="white"
                        >
                          {player.label}
                        </text>
                      </>
                    )}
                  </g>
                ))}
              </svg>
              
              {isDrawingRoute && (
                <div className="absolute top-2 right-2 bg-orange-500 text-white px-3 py-1 rounded-lg shadow-lg text-xs font-semibold">
                  ✏️ Drawing Route
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <ValidationModal
        isOpen={showValidationModal}
        validationResult={validationResult}
        onClose={() => setShowValidationModal(false)}
        onSaveAnyway={handleSaveAnyway}
      />
    </div>
  );
}