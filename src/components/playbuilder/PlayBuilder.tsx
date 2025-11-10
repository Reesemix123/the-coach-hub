/**
 * PlayBuilder Component - Interactive Play Diagram Editor
 *
 * @file PlayBuilder.tsx
 * @description A comprehensive play diagramming tool for football coaches. Enables creation
 * and editing of offensive, defensive, and special teams plays with drag-and-drop positioning,
 * route drawing, assignment management, and real-time validation.
 *
 * @features
 * - 40+ formations (offense, defense, special teams)
 * - Drag-and-drop player positioning on SVG football field
 * - Route drawing with click-to-add waypoints
 * - Pre-snap motion configuration (6 types)
 * - Blocking assignments (run/pass protection)
 * - Coverage assignments (Cover 0-6)
 * - Reference formations (dummy offense/defense overlay)
 * - Real-time formation validation
 * - Auto-save to localStorage
 * - Keyboard shortcuts (Ctrl+S save, Escape cancel)
 * - Touch/mobile support
 *
 * @architecture
 * Main PlayBuilder orchestrates:
 * - PlayBuilderHeader: Navigation and save controls
 * - Metadata Form: Play details (name, ODK, formation, type)
 * - Assignment Panels: Position-specific player assignments
 *   - OffensiveLineSection, BacksSection, ReceiversSection (offense)
 *   - DefensiveLineSection, LinebackersSection, DBSection (defense)
 * - SVG Diagram: Visual field representation with interactive elements
 * - ValidationModal: Formation rule violation warnings
 *
 * @state
 * - 20+ state variables managing play data, UI modes, and user interactions
 * - Auto-save draft every 3 seconds to localStorage
 * - Unsaved changes tracking for navigation warnings
 *
 * @performance
 * - useMemo for computed player groups and formation lists
 * - useCallback for event handlers to prevent re-renders
 * - Debounced auto-save to reduce localStorage writes
 *
 * @dependencies
 * - footballConfig: Formation definitions, attributes, validation rules
 * - footballRules: Formation validation functions
 * - Supabase: Database persistence
 *
 * @version Phase 2 + Production Improvements
 * @since 2025-01
 */

'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import toast from 'react-hot-toast';
import Tooltip from '@/components/Tooltip';
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

import PlayBuilderHeader from './PlayBuilderHeader';
import FormationControls from './FormationControls';
import AssignmentPanel from './AssignmentPanel';
import FieldDiagram from './FieldDiagram';
import { ValidationModal } from './ValidationModal';
import { FIELD_CONFIG } from './fieldConstants';

/**
 * Player entity on the field diagram
 * Represents a single player's position, assignment, and behavior
 */
interface Player {
  id: string;                                                      // Unique identifier
  x: number;                                                       // X coordinate on SVG canvas
  y: number;                                                       // Y coordinate on SVG canvas
  label: string;                                                   // Display text (position abbreviation)
  position: string;                                                // Football position (QB, RB, WR, etc.)
  side: 'offense' | 'defense';                                     // Which side of ball
  assignment?: string;                                             // Route or blocking assignment
  blockType?: string;                                              // Run Block, Pass Block, Pull
  blockDirection?: { x: number; y: number };                       // Vector for block arrow
  isPrimary?: boolean;                                             // Primary receiver/route
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift'; // Pre-snap motion type
  motionDirection?: 'toward-center' | 'away-from-center';         // Motion direction
  motionEndpoint?: { x: number; y: number };                       // Final motion position
  coverageRole?: string;                                           // Defensive coverage assignment
  coverageDepth?: number;                                          // Coverage depth in yards
  coverageDescription?: string;                                    // Human-readable coverage role
  blitzGap?: string;                                               // Blitz gap assignment (A, B, C, D)
  zoneEndpoint?: { x: number; y: number };                         // Zone coverage endpoint
  isDummy?: boolean;                                               // Reference formation player (non-interactive)
}

/**
 * Route path drawn for a player
 * Collection of waypoints forming the player's path after snap
 */
interface Route {
  id: string;                                    // Unique route identifier
  playerId: string;                              // Associated player ID
  points: Array<{ x: number; y: number }>;       // Array of waypoints forming the route
  assignment?: string;                           // Route type (Go, Post, Curl, etc.)
  isPrimary?: boolean;                           // Primary route in the concept
}

/**
 * PlayBuilder Component Props
 */
interface PlayBuilderProps {
  teamId: string;           // Team ID for associating the play with a team
  teamName?: string;        // Optional team name for display
  existingPlay?: {          // Optional: If provided, component enters edit mode
    id: string;             // Play UUID from database
    play_code: string;      // Auto-generated code (P-001, P-002, etc.)
    play_name: string;      // User-defined play name
    attributes: PlayAttributes; // Play metadata (ODK, formation, type, etc.)
    diagram: PlayDiagram;   // Player positions and routes
  };
  onSave?: () => void;      // Callback after successful save (e.g., navigate back)
}

/**
 * Main PlayBuilder Component
 *
 * @description Orchestrates the entire play building experience. Manages state for players,
 * routes, formations, and user interactions. Handles saving to database and draft auto-save.
 *
 * @param props - PlayBuilderProps
 * @returns Interactive play builder interface
 */
export default function PlayBuilder({ teamId, teamName, existingPlay, onSave }: PlayBuilderProps) {
  const supabase = createClient();
  const router = useRouter();

  // ====================================
  // STATE MANAGEMENT
  // ====================================

  // Play Metadata
  const [playName, setPlayName] = useState(existingPlay?.play_name || '');
  const [playCode, setPlayCode] = useState(existingPlay?.play_code || '');
  const [odk, setOdk] = useState<'offense' | 'defense' | 'specialTeams'>(
    existingPlay?.attributes.odk || 'offense'
  );
  const [formation, setFormation] = useState(existingPlay?.attributes.formation || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Offensive Play Attributes
  const [playType, setPlayType] = useState(existingPlay?.attributes.playType || '');
  const [targetHole, setTargetHole] = useState(existingPlay?.attributes.targetHole || '');
  const [ballCarrier, setBallCarrier] = useState(existingPlay?.attributes.ballCarrier || '');

  // Defensive Play Attributes
  const [coverage, setCoverage] = useState(existingPlay?.attributes.coverage || '');

  // Special Teams Attributes
  const [specialTeamType, setSpecialTeamType] = useState('');
  const [specialTeamPlay, setSpecialTeamPlay] = useState('');

  // Reference Formations (overlays for game planning)
  const [dummyOffenseFormation, setDummyOffenseFormation] = useState('');
  const [dummyOffensePlayers, setDummyOffensePlayers] = useState<Player[]>([]);
  const [dummyDefenseFormation, setDummyDefenseFormation] = useState('');
  const [dummyDefensePlayers, setDummyDefensePlayers] = useState<Player[]>([]);

  // Field Diagram State
  const [players, setPlayers] = useState<Player[]>([]);  // All players on field
  const [routes, setRoutes] = useState<Route[]>([]);     // All drawn routes

  // Drag & Drop State
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedMotionEndpoint, setDraggedMotionEndpoint] = useState<string | null>(null);
  const [draggedBlockDirection, setDraggedBlockDirection] = useState<string | null>(null);
  const [draggedZoneEndpoint, setDraggedZoneEndpoint] = useState<string | null>(null);

  // Route Drawing Mode
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Array<{ x: number; y: number }>>([]);

  // Validation & Save State
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<FormationValidation | null>(null);
  const [saveAnywayConfirmed, setSaveAnywayConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save State
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const draftRestorePromptShown = useRef(false);
  const validationModalShown = useRef(false);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  // Auto-save draft to localStorage
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Only auto-save if there's content and no existing play (new play only)
    if (!existingPlay && (playName || players.length > 0)) {
      autoSaveTimerRef.current = setTimeout(() => {
        const draft = {
          playName,
          playCode,
          odk,
          formation,
          playType,
          players,
          routes,
          targetHole,
          ballCarrier,
          coverage,
          specialTeamPlay,
          dummyOffenseFormation,
          dummyDefenseFormation,
          timestamp: new Date().toISOString()
        };

        try {
          localStorage.setItem(`playbuilder-draft-${teamId}`, JSON.stringify(draft));
          setLastAutoSave(new Date());
        } catch (error) {
          console.error('Failed to auto-save draft:', error);
        }
      }, 3000); // Auto-save after 3 seconds of inactivity
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [playName, playCode, odk, formation, playType, players, routes, targetHole, ballCarrier, coverage, specialTeamPlay, dummyOffenseFormation, dummyDefenseFormation, teamId, existingPlay]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!existingPlay && !draftRestorePromptShown.current) {
      try {
        const savedDraft = localStorage.getItem(`playbuilder-draft-${teamId}`);
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);

          // Mark as shown to prevent duplicate prompts
          draftRestorePromptShown.current = true;

          // Ask user if they want to restore
          const restore = confirm('Found an auto-saved draft. Would you like to restore it?');
          if (restore) {
            setPlayName(draft.playName || '');
            setPlayCode(draft.playCode || '');
            setOdk(draft.odk || 'offense');
            setFormation(draft.formation || '');
            setPlayType(draft.playType || '');
            setPlayers(draft.players || []);
            setRoutes(draft.routes || []);
            setTargetHole(draft.targetHole || '');
            setBallCarrier(draft.ballCarrier || '');
            setCoverage(draft.coverage || '');
            setSpecialTeamPlay(draft.specialTeamPlay || '');
            setDummyOffenseFormation(draft.dummyOffenseFormation || '');
            setDummyDefenseFormation(draft.dummyDefenseFormation || '');
            toast.success('Draft restored from auto-save');
          } else {
            // User declined, clear the draft
            localStorage.removeItem(`playbuilder-draft-${teamId}`);
          }
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [existingPlay, teamId]);

  // Track unsaved changes
  useEffect(() => {
    if (playName || players.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [playName, players, routes, formation, playType]);

  // Handle browser back button
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Back button handler
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    router.push(`/teams/${teamId}/playbook`);
  }, [hasUnsavedChanges, router, teamId]);

  useEffect(() => {
    if (!existingPlay && !playCode) {
      const generateCode = async () => {
        // Get all play codes to find the highest number
        const { data, error } = await supabase
          .from('playbook_plays')
          .select('play_code')
          .eq('team_id', teamId === 'personal' ? null : teamId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error generating play code:', error);
          setPlayCode('P-001');
          return;
        }

        if (data && data.length > 0) {
          // Extract all numeric parts and find the max
          let maxNum = 0;
          data.forEach(item => {
            const match = item.play_code.match(/P-(\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNum) maxNum = num;
            }
          });

          // Generate next code
          const nextNum = maxNum + 1;
          setPlayCode(`P-${nextNum.toString().padStart(3, '0')}`);
        } else {
          // No plays exist yet
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
      const centerX = FIELD_CONFIG.CENTER_X;
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
  const centerX = FIELD_CONFIG.CENTER_X;
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

    const centerX = FIELD_CONFIG.CENTER_X;
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

    const centerX = FIELD_CONFIG.CENTER_X;
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

  // Handler functions for FormationControls
  const handleOdkChange = (newOdk: 'offense' | 'defense' | 'specialTeams') => {
    setOdk(newOdk);
    setFormation('');
    setPlayers([]);
    setRoutes([]);
    setPlayType('');
    setTargetHole('');
    setSpecialTeamType('');
    setSpecialTeamPlay('');
    setDummyOffenseFormation('');
    setDummyOffensePlayers([]);
    setDummyDefenseFormation('');
    setDummyDefensePlayers([]);
  };

  const handleFormationChange = (formationName: string) => {
    setFormation(formationName);
    if (formationName) loadFormation(formationName);
  };

  const handlePlayTypeChange = (type: string) => {
    setPlayType(type);
    setTargetHole('');
    setBallCarrier('');
  };

  const generateRoutePath = (player: Player, routeType: string): Array<{ x: number; y: number }> => {
    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;
    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
    const isLeftSide = startX < FIELD_CONFIG.CENTER_X;

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
          { x: FIELD_CONFIG.CENTER_X, y: lineOfScrimmage - 100 }
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
          { x: FIELD_CONFIG.CENTER_X, y: lineOfScrimmage - 40 }
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

    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
    const isOnLOS = Math.abs(player.y - lineOfScrimmage) <= 5;

    const endpoint = motionType === 'None'
      ? undefined
      : calculateMotionEndpoint(
          { x: player.x, y: player.y },
          motionType,
          player.motionDirection || 'toward-center',
          FIELD_CONFIG.CENTER_X,
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

    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
    const isOnLOS = Math.abs(player.y - lineOfScrimmage) <= 5;

    const endpoint = calculateMotionEndpoint(
      { x: player.x, y: player.y },
      player.motionType,
      direction,
      FIELD_CONFIG.CENTER_X,
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
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT;

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

  // Touch event handlers for mobile support
  const handleTouchStart = (
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

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    // Prevent scrolling while dragging
    e.preventDefault();

    const rect = svgRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH;
    const y = ((touch.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT;

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

  const handleTouchEnd = () => {
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
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT;

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

  const savePlay = useCallback(async () => {
    // Prevent double-clicking save
    if (isSaving) {
      return;
    }

    if (!playName.trim()) {
      toast.error('Please enter a play name');
      return;
    }

    if (!formation) {
      toast.error('Please select a formation');
      return;
    }

    if (!saveAnywayConfirmed && odk === 'offense') {
      const validation = validateOffensiveFormation(players, playType);
      const illegalFormation = checkIllegalFormation(players);
      const offsidesCheck = checkOffsides(players, 'offense');
      const motionCheck = validateMotion(players);
      
      const combinedValidation: FormationValidation = {
        isValid: validation.isValid && illegalFormation.isValid && offsidesCheck.isValid && motionCheck.isValid,
        errors: [...validation.errors, ...illegalFormation.errors, ...offsidesCheck.errors, ...motionCheck.errors],
        warnings: [...validation.warnings, ...illegalFormation.warnings, ...offsidesCheck.warnings, ...motionCheck.warnings]
      };
      
      if (!combinedValidation.isValid || combinedValidation.warnings.length > 0) {
        if (!validationModalShown.current) {
          validationModalShown.current = true;
          setValidationResult(combinedValidation);
          setShowValidationModal(true);
        }
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
        if (!validationModalShown.current) {
          validationModalShown.current = true;
          setValidationResult(combinedValidation);
          setShowValidationModal(true);
        }
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
        toast.success('Play updated successfully!');
        setHasUnsavedChanges(false);
        // Clear auto-save draft
        localStorage.removeItem(`playbuilder-draft-${teamId}`);
        setLastAutoSave(null);
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

        if (error) {
          // Handle duplicate play code error with retry
          if (error.code === '23505' && error.message?.includes('playbook_plays_play_code_unique')) {
            console.log('Duplicate play code detected, retrying with new code...');

            // Generate a new code and try again (silently)
            const { data: allPlays } = await supabase
              .from('playbook_plays')
              .select('play_code')
              .eq('team_id', teamId === 'personal' ? null : teamId);

            // Find the highest play number
            let maxNum = 0;

            // Also consider the current failed code
            const currentMatch = playCode.match(/P-(\d+)/);
            if (currentMatch) {
              maxNum = parseInt(currentMatch[1]);
            }

            if (allPlays && allPlays.length > 0) {
              console.log(`Found ${allPlays.length} existing plays`);
              allPlays.forEach(item => {
                console.log(`Checking play code: ${item.play_code}`);
                const match = item.play_code.match(/P-(\d+)/);
                if (match) {
                  const num = parseInt(match[1]);
                  if (num > maxNum) maxNum = num;
                }
              });
            }

            const nextNum = maxNum + 1;
            const newCode = `P-${nextNum.toString().padStart(3, '0')}`;
            setPlayCode(newCode);
            console.log(`Max number found: ${maxNum}, using next code: ${newCode}`);

            // Try saving again with new code
            const { error: retryError } = await supabase
              .from('playbook_plays')
              .insert({
                team_id: teamId === 'personal' ? null : teamId,
                play_code: newCode,
                play_name: playName,
                attributes,
                diagram
              });

            if (retryError) {
              // If retry also fails, show error and exit
              console.error('Retry failed:', retryError);
              toast.error('Failed to save play. Please try again.');
              setIsSaving(false);
              return;
            }

            // Retry succeeded! Continue to success message
            console.log('Retry succeeded!');
          } else {
            // Different error, show it
            console.error('Non-duplicate error:', error);
            toast.error(error.message || 'Error saving play. Please try again.');
            setIsSaving(false);
            return;
          }
        }

        toast.success('Play saved successfully!');
        setHasUnsavedChanges(false);
        // Clear auto-save draft
        localStorage.removeItem(`playbuilder-draft-${teamId}`);
        setLastAutoSave(null);
      }

      if (onSave) onSave();
    } catch (error: any) {
      // This catch should rarely be hit now
      console.error('Unexpected error saving play:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [playName, formation, saveAnywayConfirmed, odk, players, playType, routes, targetHole, ballCarrier, coverage, existingPlay, playCode, teamId, onSave, supabase, isSaving]);

  // Keyboard navigation - must be after handleBack and savePlay are defined
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea/select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Escape - Cancel drawing mode or go back
      if (e.key === 'Escape') {
        if (isDrawingRoute) {
          setIsDrawingRoute(false);
          setCurrentRoute([]);
          toast.info('Drawing mode cancelled');
        } else if (hasUnsavedChanges) {
          handleBack();
        }
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving) {
          savePlay();
        }
      }

      // Delete/Backspace - Remove last route point when drawing
      if ((e.key === 'Delete' || e.key === 'Backspace') && isDrawingRoute) {
        e.preventDefault();
        if (currentRoute.length > 0) {
          setCurrentRoute(prev => prev.slice(0, -1));
          toast.info('Removed last point');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingRoute, hasUnsavedChanges, isSaving, currentRoute, handleBack, savePlay]);

  const handleSaveAnyway = () => {
    setSaveAnywayConfirmed(true);
    setShowValidationModal(false);
    validationModalShown.current = false; // Reset flag for next save
    setTimeout(() => savePlay(), 100);
  };

  const getHolePosition = (hole: string): { x: number; y: number } => {
    const linemen = players.filter(p => getPositionGroup(p.position) === 'linemen');
    const sortedLinemen = [...linemen].sort((a, b) => a.x - b.x);

    if (sortedLinemen.length < 2) {
      return { x: FIELD_CONFIG.CENTER_X, y: 195 };
    }

    const center = linemen.find(p => p.position === 'C');
    const lg = linemen.find(p => p.position === 'LG');
    const rg = linemen.find(p => p.position === 'RG');
    const lt = linemen.find(p => p.position === 'LT');
    const rt = linemen.find(p => p.position === 'RT');

    const centerX = center?.x || FIELD_CONFIG.CENTER_X;
    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
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
    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
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
    return getGapPositionFromName(gapName, FIELD_CONFIG.CENTER_X);
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

    const centerX = FIELD_CONFIG.CENTER_X;
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
      const isLeftSide = centerX < FIELD_CONFIG.CENTER_X;
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

    const lineOfScrimmage = FIELD_CONFIG.LINE_OF_SCRIMMAGE;
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

  const availableFormations = useMemo(() => formationList(), [formationList]);
  const linemen = useMemo(() => players.filter(p => getPositionGroup(p.position) === 'linemen'), [players]);
  const backs = useMemo(() => players.filter(p => getPositionGroup(p.position) === 'backs'), [players]);
  const receivers = useMemo(() => players.filter(p => getPositionGroup(p.position) === 'receivers'), [players]);
  const potentialBallCarriers = useMemo(() => players.filter(p => getPositionGroup(p.position) !== 'linemen'), [players]);

  return (
    <div className="space-y-6 pb-12">
      <PlayBuilderHeader
        hasUnsavedChanges={hasUnsavedChanges}
        lastAutoSave={lastAutoSave}
        existingPlay={existingPlay}
        isSaving={isSaving}
        onBack={handleBack}
        onSave={savePlay}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="space-y-6 pl-2">

          <FormationControls
            playName={playName}
            playCode={playCode}
            odk={odk}
            formation={formation}
            playType={playType}
            targetHole={targetHole}
            ballCarrier={ballCarrier}
            coverage={coverage}
            specialTeamPlay={specialTeamPlay}
            dummyOffenseFormation={dummyOffenseFormation}
            dummyDefenseFormation={dummyDefenseFormation}
            teamName={teamName}
            existingPlay={existingPlay}
            availableFormations={availableFormations}
            potentialBallCarriers={potentialBallCarriers}
            onPlayNameChange={setPlayName}
            onOdkChange={handleOdkChange}
            onFormationChange={handleFormationChange}
            onPlayTypeChange={handlePlayTypeChange}
            onTargetHoleChange={setTargetHole}
            onBallCarrierChange={setBallCarrier}
            onCoverageChange={setCoverage}
            onSpecialTeamPlayChange={setSpecialTeamPlay}
            onDummyOffenseChange={loadDummyOffense}
            onDummyDefenseChange={loadDummyDefense}
          />

          <AssignmentPanel
            odk={odk}
            playType={playType}
            coverage={coverage}
            players={players}
            linemen={linemen}
            backs={backs}
            receivers={receivers}
            ballCarrier={ballCarrier}
            targetHole={targetHole}
            getAssignmentOptionsForPlayer={getAssignmentOptionsForPlayer}
            onUpdateBlockType={updatePlayerBlockType}
            onApplyBlockTypeToAll={applyBlockTypeToAll}
            onUpdateBlockDirection={updatePlayerBlockDirection}
            onUpdateAssignment={updatePlayerAssignment}
            onUpdateMotionType={updatePlayerMotionType}
            onUpdateMotionDirection={updatePlayerMotionDirection}
            onTogglePrimary={togglePrimaryReceiver}
            onUpdateBlitz={updatePlayerBlitz}
            onResetToTechnique={resetPlayerToTechnique}
            onUpdateCoverageRole={updatePlayerCoverageRole}
            onResetToRole={resetPlayerToRole}
          />

        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit">
          <FieldDiagram
            players={players}
            routes={routes}
            dummyOffensePlayers={dummyOffensePlayers}
            dummyDefensePlayers={dummyDefensePlayers}
            dummyOffenseFormation={dummyOffenseFormation}
            dummyDefenseFormation={dummyDefenseFormation}
            isDrawingRoute={isDrawingRoute}
            currentRoute={currentRoute}
            playType={playType}
            targetHole={targetHole}
            ballCarrier={ballCarrier}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onFieldClick={handleFieldClick}
            onFieldDoubleClick={handleFieldDoubleClick}
          />
        </div>

      </div>

      <ValidationModal
        isOpen={showValidationModal}
        validationResult={validationResult}
        onClose={() => {
          setShowValidationModal(false);
          validationModalShown.current = false; // Reset flag for next save
        }}
        onSaveAnyway={handleSaveAnyway}
      />
    </div>
  );
}