// src/components/playbuilder/PlayBuilder.tsx (COMPLETE REFACTORED)
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { PlayAttributes, PlayDiagram } from '@/types/football';
import {
  OFFENSIVE_FORMATIONS,
  DEFENSIVE_FORMATIONS,
  SPECIAL_TEAMS_FORMATIONS,
  OFFENSIVE_ATTRIBUTES,
  DEFENSIVE_ATTRIBUTES,
  RUNNING_HOLES,
  getAssignmentOptions,
  POSITION_GROUPS,
  calculateMotionEndpoint,
  getDefensivePositionFromConfig
} from '@/config/footballConfig';
import {
  validateOffensiveFormation,
  validateDefensiveFormation,
  checkIllegalFormation,
  checkOffsides,
  validateMotion,
  type FormationValidation
} from '@/config/footballRules';

// Import the new components
import { FormationMetadata } from './FormationMetadata';
import { OffensiveLineSection } from './OffensiveLineSection';
import { BacksSection } from './BacksSection';
import { ReceiversSection } from './ReceiversSection';
import { ValidationModal } from './ValidationModal';

interface Player {
  id: string;
  x: number;
  y: number;
  label: string;
  position: string;
  side: 'offense' | 'defense';
  assignment?: string;
  blockType?: string;
  blockResponsibility?: string;
  isPrimary?: boolean;
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift';
  motionDirection?: 'toward-center' | 'away-from-center';
  motionEndpoint?: { x: number; y: number };
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
  
  // Play metadata state
  const [playName, setPlayName] = useState(existingPlay?.play_name || '');
  const [playCode, setPlayCode] = useState(existingPlay?.play_code || '');
  const [odk, setOdk] = useState<'offense' | 'defense' | 'specialTeams'>(
    existingPlay?.attributes.odk || 'offense'
  );
  const [formation, setFormation] = useState(existingPlay?.attributes.formation || '');
  
  // Offensive attributes
  const [playType, setPlayType] = useState(existingPlay?.attributes.playType || '');
  const [targetHole, setTargetHole] = useState(existingPlay?.attributes.targetHole || '');
  const [ballCarrier, setBallCarrier] = useState(existingPlay?.attributes.ballCarrier || '');
  
  // Defensive attributes
  const [coverage, setCoverage] = useState(existingPlay?.attributes.coverage || '');
  const [blitzType, setBlitzType] = useState(existingPlay?.attributes.blitzType || '');
  const [front, setFront] = useState(existingPlay?.attributes.front || '');
  
  // Diagram state
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedMotionEndpoint, setDraggedMotionEndpoint] = useState<string | null>(null);
  
  // Route drawing state
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Array<{ x: number; y: number }>>([]);
  
  // Validation state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<FormationValidation | null>(null);
  const [saveAnywayConfirmed, setSaveAnywayConfirmed] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Generate play code on mount
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

  // Load existing play data
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
        blockResponsibility: p.blockResponsibility,
        isPrimary: p.isPrimary || false,
        motionType: p.motionType || 'None',
        motionDirection: p.motionDirection || 'toward-center',
        motionEndpoint: p.motionEndpoint
      })));
      setRoutes(existingPlay.diagram.routes || []);
    }
  }, [existingPlay]);

  // Reset when play type changes
  useEffect(() => {
    if (!existingPlay) {
      setRoutes([]);
      setPlayers(prev => prev.map(p => ({
        ...p,
        assignment: undefined,
        blockType: undefined,
        blockResponsibility: undefined,
        isPrimary: false
      })));
    }
  }, [playType, existingPlay]);

  // Formation list based on ODK
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

  // Load formation
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

  // Route generation function
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

  // Auto-generate routes when assignments change
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

  // Player update functions
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
        p.id === playerId ? { ...p, blockType } : p
      )
    );
  };

  const updatePlayerBlockResponsibility = (playerId: string, blockResponsibility: string) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, blockResponsibility } : p
      )
    );
  };

  const updatePlayerMotionType = (playerId: string, motionType: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const endpoint = motionType === 'None' 
      ? undefined 
      : calculateMotionEndpoint(
          { x: player.x, y: player.y },
          motionType,
          player.motionDirection || 'toward-center'
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

    const endpoint = calculateMotionEndpoint(
      { x: player.x, y: player.y },
      player.motionType,
      direction
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

  // Helper functions for position grouping
  const getPositionGroup = (position: string): 'linemen' | 'backs' | 'receivers' => {
    if (POSITION_GROUPS.linemen.includes(position)) return 'linemen';
    if (POSITION_GROUPS.backs.includes(position)) return 'backs';
    return 'receivers';
  };

  const getAssignmentOptionsForPlayer = (player: Player): string[] => {
    return getAssignmentOptions(player.position, playType === 'Run' ? 'run' : 'pass');
  };

  // Drag handlers
  const handleMouseDown = (playerId: string, isMotionEndpoint: boolean = false) => {
    if (isDrawingRoute) return;
    if (isMotionEndpoint) {
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
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedPlayer ? { ...p, x, y } : p
        )
      );
    } else if (draggedMotionEndpoint) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedMotionEndpoint 
            ? { ...p, motionEndpoint: { x, y } } 
            : p
        )
      );
    }
  }, [draggedPlayer, draggedMotionEndpoint]);

  const handleMouseUp = () => {
    setDraggedPlayer(null);
    setDraggedMotionEndpoint(null);
  };

  // Custom route drawing
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

  // Save play
  const savePlay = async () => {
    if (!playName.trim()) {
      alert('Please enter a play name');
      return;
    }

    if (!formation) {
      alert('Please select a formation');
      return;
    }

    // Validation
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
        blockResponsibility: p.blockResponsibility,
        isPrimary: p.isPrimary,
        motionType: p.motionType,
        motionDirection: p.motionDirection,
        motionEndpoint: p.motionEndpoint
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
      coverage: coverage || undefined,
      blitzType: blitzType || undefined,
      front: front || undefined
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

  // Helper function: Get hole position for ball carrier arrow
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
        return { x: sortedLinemen[0].x - 60, y: holeY };
      case '8':
        return { x: sortedLinemen[sortedLinemen.length - 1].x + 60, y: holeY };
      default:
        return { x: centerX, y: holeY };
    }
  };

  // Helper function: Get blocking arrow direction
  const getBlockingArrowDirection = (player: Player): { endX: number; endY: number } | null => {
    if (!player.blockType && !player.blockResponsibility) return null;

    const baseLength = 35;
    const centerX = player.motionEndpoint?.x || player.x;
    const centerY = player.motionEndpoint?.y || player.y;
    
    if (player.blockType === 'Pull') {
      let direction = 0;
      if (player.blockResponsibility?.toLowerCase().includes('left')) {
        direction = -1;
      } else if (player.blockResponsibility?.toLowerCase().includes('right')) {
        direction = 1;
      } else {
        direction = 1;
      }
      return {
        endX: centerX + (baseLength * 2 * direction),
        endY: centerY
      };
    }

    if (player.blockResponsibility) {
      const linemen = players.filter(p => getPositionGroup(p.position) === 'linemen');
      const center = linemen.find(p => p.position === 'C');
      const lg = linemen.find(p => p.position === 'LG');
      const rg = linemen.find(p => p.position === 'RG');
      const lt = linemen.find(p => p.position === 'LT');
      const rt = linemen.find(p => p.position === 'RT');
      
      const defenderPos = getDefensivePositionFromConfig(player.blockResponsibility, {
        lineOfScrimmage: 200,
        centerX: center?.x || 350,
        center,
        lg,
        rg,
        lt,
        rt,
        responsibility: player.blockResponsibility.toLowerCase()
      });
      
      if (defenderPos) {
        const dx = defenderPos.x - centerX;
        const dy = defenderPos.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const endX = centerX + (dx / distance) * baseLength;
        const endY = centerY + (dy / distance) * baseLength;
        
        return { endX, endY };
      }
    }

    let angle = -45;
    
    if (player.blockType) {
      const blockTypeLower = player.blockType.toLowerCase();
      if (blockTypeLower === 'down') angle = -60;
      else if (blockTypeLower === 'reach') angle = -30;
      else if (blockTypeLower === 'scoop') angle = -60;
      else if (blockTypeLower === 'combo') angle = -70;
    }

    const radians = (angle * Math.PI) / 180;
    return {
      endX: centerX + baseLength * Math.cos(radians),
      endY: centerY + baseLength * Math.sin(radians)
    };
  };

  // SVG Rendering functions
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
      </g>
    );
  };

  const renderMotionArrow = (player: Player) => {
    if (!player.motionType || player.motionType === 'None' || !player.motionEndpoint) return null;

    const startX = player.x;
    const startY = player.y;
    const endX = player.motionEndpoint.x;
    const endY = player.motionEndpoint.y;

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
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
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
            handleMouseDown(player.id, true);
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

  // Organize players by position group
  const availableFormations = formationList();
  const linemen = players.filter(p => getPositionGroup(p.position) === 'linemen');
  const backs = players.filter(p => getPositionGroup(p.position) === 'backs');
  const receivers = players.filter(p => getPositionGroup(p.position) === 'receivers');
  const potentialBallCarriers = players.filter(p => getPositionGroup(p.position) !== 'linemen');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Controls */}
        <div className="space-y-6">
          
          {/* Play Metadata */}
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

            {odk === 'defense' && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Front
                  </label>
                  <select
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select...</option>
                    {DEFENSIVE_ATTRIBUTES.front.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Coverage
                  </label>
                  <select
                    value={coverage}
                    onChange={(e) => setCoverage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select...</option>
                    {DEFENSIVE_ATTRIBUTES.coverage.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Blitz Type
                  </label>
                  <select
                    value={blitzType}
                    onChange={(e) => setBlitzType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  >
                    <option value="">Select...</option>
                    {DEFENSIVE_ATTRIBUTES.blitzType.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Player Assignments Sections */}
          {odk === 'offense' && (playType === 'Run' || playType === 'Pass') && players.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Player Assignments</h3>
              
              <OffensiveLineSection
                players={linemen}
                onUpdateBlockType={updatePlayerBlockType}
                onUpdateBlockResponsibility={updatePlayerBlockResponsibility}
              />

              <BacksSection
                players={backs}
                playType={playType}
                ballCarrier={ballCarrier}
                targetHole={targetHole}
                assignmentOptions={getAssignmentOptionsForPlayer}
                onUpdateAssignment={updatePlayerAssignment}
                onUpdateBlockType={updatePlayerBlockType}
                onUpdateBlockResponsibility={updatePlayerBlockResponsibility}
                onUpdateMotionType={updatePlayerMotionType}
                onUpdateMotionDirection={updatePlayerMotionDirection}
                onTogglePrimary={togglePrimaryReceiver}
              />

              <ReceiversSection
                players={receivers}
                assignmentOptions={getAssignmentOptionsForPlayer}
                onUpdateAssignment={updatePlayerAssignment}
                onUpdateBlockType={updatePlayerBlockType}
                onUpdateBlockResponsibility={updatePlayerBlockResponsibility}
                onUpdateMotionType={updatePlayerMotionType}
                onUpdateMotionDirection={updatePlayerMotionDirection}
                onTogglePrimary={togglePrimaryReceiver}
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

        {/* RIGHT COLUMN: Diagram */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Play Diagram</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-md text-xs leading-relaxed">
              <p className="text-gray-700">
                <strong>Drag players</strong> to reposition. <strong>Select assignments</strong> from dropdowns - routes auto-generate! 
                {isDrawingRoute && (
                  <span className="text-orange-600 font-semibold"> ✏️ Drawing mode active: Click to add points, double-click to finish.</span>
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

                {players.map(player => renderBallCarrierArrow(player))}
                {players.map(player => renderBlockingArrow(player))}
                {players.map(player => renderMotionArrow(player))}
                {routes.map(route => renderPassRoute(route))}

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

                {players.map(player => (
                  <g key={player.id}>
                    {player.side === 'defense' ? (
                      <rect
                        x={player.x - 12}
                        y={player.y - 12}
                        width="24"
                        height="24"
                        fill="red"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-move hover:fill-red-400"
                        onMouseDown={() => handleMouseDown(player.id)}
                      />
                    ) : (
                      <circle
                        cx={player.x}
                        cy={player.y}
                        r="12"
                        fill="white"
                        stroke="black"
                        strokeWidth="2"
                        className="cursor-move hover:fill-blue-100"
                        onMouseDown={() => handleMouseDown(player.id)}
                      />
                    )}
                    <text
                      x={player.x}
                      y={player.y + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="black"
                      pointerEvents="none"
                    >
                      {player.label}
                    </text>
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