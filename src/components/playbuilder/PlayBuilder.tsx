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
  isDefensiveBack,
  getKickoffPlayPaths,
  getKickReturnPlayPaths,
  getFieldGoalPlayPaths,
  getPuntPlayPaths,
  getPuntReturnPlayPaths
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
import QuickDrawToolbar from './QuickDrawToolbar';
import RouteTypeModal from './RouteTypeModal';
import { useQuickDrawEngine } from './hooks/useQuickDrawEngine';
import { useSVGCoordinates } from './hooks/useSVGCoordinates';
import { detectRouteType, getRouteOptions, detectBlockingType, type RouteAnalysis } from './utils/routeDetection';

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
  motionControlPoint?: { x: number; y: number };                   // Bezier control point for curved motion path
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
 * Play Type Utility Functions
 *
 * These functions help categorize play types for proper handling of hybrid types
 * like RPO, Screen, Draw, and Play Action.
 */

// Play types that show run-specific UI (target hole, ball carrier)
const RUN_BASED_PLAY_TYPES = ['Run', 'Draw', 'RPO'];

// Play types that use pass-based assignments (routes, pass protection)
const PASS_BASED_PLAY_TYPES = ['Pass', 'Screen', 'Play Action'];

// All valid offensive play types
const ALL_OFFENSIVE_PLAY_TYPES = ['Run', 'Pass', 'RPO', 'Screen', 'Draw', 'Play Action'];

/**
 * Determines if a play type should show run-specific UI (target hole, ball carrier)
 */
const isRunBasedPlayType = (playType: string): boolean => {
  return RUN_BASED_PLAY_TYPES.includes(playType);
};

/**
 * Returns 'run' or 'pass' category for assignment options
 * - Run, Draw: run assignments (blocking, carries)
 * - Pass, Screen, Play Action: pass assignments (routes, pass protection)
 * - RPO: defaults to run assignments (QB reads determine pass vs run)
 */
const getPlayTypeCategory = (playType: string): 'run' | 'pass' => {
  if (PASS_BASED_PLAY_TYPES.includes(playType)) return 'pass';
  return 'run'; // Run, Draw, RPO default to run
};

/**
 * Determines route type for database storage
 * - Pass, Screen, Play Action: pass routes
 * - Run, Draw: run paths
 * - RPO: hybrid (can be either)
 */
const getRouteTypeForPlayType = (playType: string): 'pass' | 'run' => {
  if (['Pass', 'Screen', 'Play Action'].includes(playType)) return 'pass';
  return 'run';
};

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
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);

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
  const [draggedMotionControlPoint, setDraggedMotionControlPoint] = useState<string | null>(null);
  const [draggedBlockDirection, setDraggedBlockDirection] = useState<string | null>(null);
  const [draggedZoneEndpoint, setDraggedZoneEndpoint] = useState<string | null>(null);
  const [draggedSpecialTeamsPath, setDraggedSpecialTeamsPath] = useState<string | null>(null);

  // Route Drawing Mode
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [isDrawingDrag, setIsDrawingDrag] = useState(false); // True while mouse is held down during drawing
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Array<{ x: number; y: number }>>([]);
  const [routeSegmentIndices, setRouteSegmentIndices] = useState<number[]>([]); // Indices where segments end (for undo)

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

  // Quick Draw Mode
  const { state: quickDrawState, actions: quickDrawActions } = useQuickDrawEngine();
  const { getPointFromMouseEvent } = useSVGCoordinates();

  // Quick Draw modal state
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [pendingQuickDraw, setPendingQuickDraw] = useState<{
    playerId: string;
    tool: string;
    path: Array<{ x: number; y: number }>;
    routeAnalysis: RouteAnalysis | null;
    relevantOptions: string[];
  } | null>(null);

  // Quick Draw event handlers
  const handleQuickDrawPlayerClick = useCallback((playerId: string) => {
    // If already drawing, clicking another player cancels current and starts new
    if (quickDrawState.isDrawing) {
      quickDrawActions.cancelDrawing();
    }

    // Find the player to get their position as the starting point
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Start drawing from this player
    quickDrawActions.startDrawing(playerId);

    // Add player position as first point of ghost line
    const startPoint = player.motionEndpoint || { x: player.x, y: player.y };
    quickDrawActions.updateGhostLine(startPoint);
  }, [quickDrawState.isDrawing, players, quickDrawActions]);

  const handleQuickDrawFieldClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!quickDrawState.activePlayerId || !quickDrawState.isDrawing) return;

    const point = getPointFromMouseEvent(e);
    quickDrawActions.updateGhostLine(point);
  }, [quickDrawState.activePlayerId, quickDrawState.isDrawing, getPointFromMouseEvent, quickDrawActions]);

  const handleQuickDrawFinish = useCallback(() => {
    if (!quickDrawState.activePlayerId || quickDrawState.ghostLine.length < 2) {
      quickDrawActions.cancelDrawing();
      return;
    }

    const player = players.find(p => p.id === quickDrawState.activePlayerId);
    if (!player) {
      quickDrawActions.cancelDrawing();
      return;
    }

    // Detect route type from drawn path
    const routeAnalysis = detectRouteType(
      quickDrawState.ghostLine,
      player.side,
      player.x
    );
    const relevantOptions = getRouteOptions(routeAnalysis);

    // Store pending draw data and show modal
    setPendingQuickDraw({
      playerId: quickDrawState.activePlayerId,
      tool: quickDrawState.selectedTool,
      path: [...quickDrawState.ghostLine],
      routeAnalysis,
      relevantOptions,
    });

    quickDrawActions.finishDrawing();
    setShowRouteModal(true);
  }, [quickDrawState, quickDrawActions, players]);

  const handleQuickDrawConfirm = useCallback((routeType: string, isPrimary: boolean) => {
    if (!pendingQuickDraw) return;

    const { playerId, path, tool } = pendingQuickDraw;
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Create new route with the drawn path
    const newRouteId = `route-${Date.now()}`;
    const newRoute: Route = {
      id: newRouteId,
      playerId: playerId,
      points: path, // Using points internally, will be mapped to path on save
      assignment: routeType,
      isPrimary: isPrimary,
    };

    // Update routes - remove any existing route for this player first
    setRoutes(prev => {
      const filtered = prev.filter(r => r.playerId !== playerId);
      return [...filtered, newRoute];
    });

    // Update player assignment
    setPlayers(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          // If marking as primary, unmark others
          const updates: Partial<Player> = {
            assignment: routeType,
            isPrimary: isPrimary,
          };

          // For blocking assignments, set blockType
          if (tool === 'block') {
            updates.blockType = routeType;
            updates.blockDirection = path.length > 1
              ? { x: path[path.length - 1].x, y: path[path.length - 1].y }
              : undefined;
          }

          return { ...p, ...updates };
        }
        // If new route is primary, unmark others
        if (isPrimary && p.isPrimary) {
          return { ...p, isPrimary: false };
        }
        return p;
      })
    );

    // Also update other routes' isPrimary if this one is primary
    if (isPrimary) {
      setRoutes(prev =>
        prev.map(r => r.id === newRouteId ? r : { ...r, isPrimary: false })
      );
    }

    // Mark as having unsaved changes
    setHasUnsavedChanges(true);

    // Push to undo stack
    quickDrawActions.pushUndo({
      type: tool === 'block' ? 'block' : 'route',
      playerId,
      previousState: null, // Could store previous assignment for true undo
      newState: { routeType, path, isPrimary },
    });

    // Close modal and reset state
    setShowRouteModal(false);
    setPendingQuickDraw(null);
    quickDrawActions.cancelDrawing();

    toast.success(`${routeType} assigned to ${player.label}`);
  }, [pendingQuickDraw, players, quickDrawActions]);

  const handleQuickDrawCancel = useCallback(() => {
    setShowRouteModal(false);
    setPendingQuickDraw(null);
    quickDrawActions.cancelDrawing();
  }, [quickDrawActions]);

  // Note: SVG ref is managed by FieldDiagram component - we use e.currentTarget in handlers

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

  // Duplicate play handler - creates a copy of the current play
  const handleDuplicate = useCallback(async () => {
    // Generate a new play code
    const { data, error } = await supabase
      .from('playbook_plays')
      .select('play_code')
      .eq('team_id', teamId === 'personal' ? null : teamId)
      .order('created_at', { ascending: false });

    let newCode = 'P-001';
    if (!error && data && data.length > 0) {
      let maxNum = 0;
      data.forEach(item => {
        const match = item.play_code.match(/P-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      });
      newCode = `P-${(maxNum + 1).toString().padStart(3, '0')}`;
    }

    // Update state for duplicate mode
    setPlayCode(newCode);
    setPlayName(prev => prev.endsWith(' (Copy)') ? prev : `${prev} (Copy)`);
    setIsDuplicateMode(true);
    setHasUnsavedChanges(true);
    toast.success('Duplicating play - save to create the copy');
  }, [teamId, supabase]);

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
        zoneEndpoint: p.zoneEndpoint,
        specialTeamsPath: p.specialTeamsPath
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

      // Determine if this is a kickoff-style (move down/toward opponent) or return-style (move up/toward own end zone)
      // Kickoff/Punt coverage teams start above LOS and move down
      // Return teams start below LOS and move up
      const isKickoffStyle = formationName.toLowerCase().includes('kickoff') && !formationName.toLowerCase().includes('return');
      const isPuntCoverage = formationName.toLowerCase().includes('punt') && !formationName.toLowerCase().includes('return');
      const isDownwardMovement = isKickoffStyle || isPuntCoverage;

      // For Kickoff, use the default "Deep Center" play paths
      const kickoffPaths = formationName === 'Kickoff' ? getKickoffPlayPaths('Deep Center') : null;
      // For Kick Return, use the default "Return Middle" play paths
      const kickReturnPaths = formationName === 'Kick Return' ? getKickReturnPlayPaths('Return Middle') : null;
      // For Field Goal, use the default "Standard Field Goal" play paths
      const fieldGoalPaths = formationName === 'Field Goal' ? getFieldGoalPlayPaths('Standard Field Goal') : null;
      // For Punt, use the default "Punt" play paths
      const puntPaths = formationName === 'Punt' ? getPuntPlayPaths('Punt') : null;
      // For Punt Return, use the default "Return Middle" play paths
      const puntReturnPaths = formationName === 'Punt Return' ? getPuntReturnPlayPaths('Return Middle') : null;

      const newPlayers: Player[] = formationData.map((pos, idx) => {
        const playerX = pos.x + offset;
        const playerY = pos.y;

        // For special teams, auto-initialize a path in the appropriate direction
        let specialTeamsPath: { x: number; y: number } | undefined;
        if (odk === 'specialTeams') {
          // For Kickoff, use the pre-defined play paths
          if (kickoffPaths) {
            const pathConfig = kickoffPaths.find(p => p.position === pos.position);
            if (pathConfig) {
              specialTeamsPath = pathConfig.endpoint;
            }
          } else if (kickReturnPaths) {
            // For Kick Return, use the pre-defined return paths
            const pathConfig = kickReturnPaths.find(p => p.position === pos.position);
            if (pathConfig) {
              specialTeamsPath = pathConfig.endpoint;
            }
          } else if (fieldGoalPaths) {
            // For Field Goal, use the pre-defined blocking paths
            const pathConfig = fieldGoalPaths.find(p => p.position === pos.position);
            if (pathConfig) {
              specialTeamsPath = pathConfig.endpoint;
            }
            // Holder and Kicker don't have paths (no entry in fieldGoalPaths)
          } else if (puntPaths) {
            // For Punt, use the pre-defined blocking/coverage paths
            const pathConfig = puntPaths.find(p => p.position === pos.position);
            if (pathConfig) {
              specialTeamsPath = pathConfig.endpoint;
            }
            // PP and P don't have paths (no entry in puntPaths)
          } else if (puntReturnPaths) {
            // For Punt Return, use the pre-defined return paths
            const pathConfig = puntReturnPaths.find(p => p.position === pos.position);
            if (pathConfig) {
              specialTeamsPath = pathConfig.endpoint;
            }
          } else {
            // For other special teams, use a generic path
            const pathLength = 80;
            if (isDownwardMovement) {
              // Kickoff/punt coverage: move downward (increasing Y)
              specialTeamsPath = { x: playerX, y: playerY + pathLength };
            } else {
              // Return teams: move upward (decreasing Y)
              specialTeamsPath = { x: playerX, y: playerY - pathLength };
            }
          }
        }

        return {
          id: `${odk}-${idx}`,
          x: playerX,
          y: playerY,
          label: pos.label,
          position: pos.position,
          side: odk === 'defense' ? 'defense' : 'offense',
          isPrimary: false,
          motionType: 'None',
          motionDirection: 'toward-center',
          ...(specialTeamsPath && { specialTeamsPath })
        };
      });

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

  // Handle special teams play selection and update player paths
  const handleSpecialTeamPlayChange = (playName: string) => {
    setSpecialTeamPlay(playName);

    // If no play is selected, clear all special teams paths
    if (!playName) {
      setPlayers(prev =>
        prev.map(player => ({
          ...player,
          specialTeamsPath: undefined
        }))
      );
      return;
    }

    // If this is a Kickoff formation, update the coverage paths
    if (formation === 'Kickoff' && playName) {
      const paths = getKickoffPlayPaths(playName);

      setPlayers(prev =>
        prev.map(player => {
          const pathConfig = paths.find(p => p.position === player.position);
          if (pathConfig) {
            return {
              ...player,
              specialTeamsPath: pathConfig.endpoint
            };
          }
          // Clear paths for players without config
          return {
            ...player,
            specialTeamsPath: undefined
          };
        })
      );
    }

    // If this is a Kick Return formation, update the return/blocking paths
    if (formation === 'Kick Return' && playName) {
      const paths = getKickReturnPlayPaths(playName);

      setPlayers(prev =>
        prev.map(player => {
          const pathConfig = paths.find(p => p.position === player.position);
          if (pathConfig) {
            // For onside recovery plays, also update player starting positions
            const updatedPlayer: typeof player = {
              ...player,
              specialTeamsPath: pathConfig.endpoint
            };
            // If startPosition is provided (for onside recovery), move the player
            if (pathConfig.startPosition) {
              updatedPlayer.x = pathConfig.startPosition.x;
              updatedPlayer.y = pathConfig.startPosition.y;
            }
            return updatedPlayer;
          }
          // Clear paths for players without config
          return {
            ...player,
            specialTeamsPath: undefined
          };
        })
      );
    }

    // If this is a Field Goal formation, update the blocking paths
    if (formation === 'Field Goal' && playName) {
      const paths = getFieldGoalPlayPaths(playName);

      setPlayers(prev =>
        prev.map(player => {
          const pathConfig = paths.find(p => p.position === player.position);
          if (pathConfig) {
            return {
              ...player,
              specialTeamsPath: pathConfig.endpoint
            };
          }
          // Players without paths (Holder, Kicker) keep no specialTeamsPath
          return {
            ...player,
            specialTeamsPath: undefined
          };
        })
      );
    }

    // If this is a Punt formation, update the blocking/coverage paths
    if (formation === 'Punt' && playName) {
      const paths = getPuntPlayPaths(playName);

      setPlayers(prev =>
        prev.map(player => {
          const pathConfig = paths.find(p => p.position === player.position);
          if (pathConfig) {
            return {
              ...player,
              specialTeamsPath: pathConfig.endpoint
            };
          }
          // Players without paths (PP, P) keep no specialTeamsPath
          return {
            ...player,
            specialTeamsPath: undefined
          };
        })
      );
    }

    // If this is a Punt Return formation, update the paths
    if (formation === 'Punt Return' && playName) {
      const paths = getPuntReturnPlayPaths(playName);

      setPlayers(prev =>
        prev.map(player => {
          const pathConfig = paths.find(p => p.position === player.position);
          if (pathConfig) {
            return {
              ...player,
              specialTeamsPath: pathConfig.endpoint
            };
          }
          // Players without paths keep no specialTeamsPath
          return {
            ...player,
            specialTeamsPath: undefined
          };
        })
      );
    }
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
      prev.map(p => {
        if (p.id !== playerId) return p;

        // When changing assignment, clear block-related fields if not blocking
        // and clear isPrimary when switching to non-route assignments
        const updates: Partial<Player> = { assignment };

        if (assignment !== 'Block') {
          updates.blockType = undefined;
          updates.blockDirection = undefined;
        }

        if (assignment === 'Block' || assignment === 'Draw Route (Custom)') {
          updates.isPrimary = false;
        }

        return { ...p, ...updates };
      })
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

    // Update route if player has a custom drawn route - translate entire route
    setRoutes(prev =>
      prev.map(route => {
        if (route.playerId === playerId && route.points.length > 0) {
          // Get the current starting point of the route (where it was drawn from)
          const currentStart = route.points[0];

          // Calculate where the route should now start from
          // If motion was added: start from motion endpoint
          // If motion was removed: start from player position
          const newStartX = endpoint?.x ?? player.x;
          const newStartY = endpoint?.y ?? player.y;

          // Calculate the translation delta
          const deltaX = newStartX - currentStart.x;
          const deltaY = newStartY - currentStart.y;

          // Translate all points in the route by this delta
          const updatedPoints = route.points.map(point => ({
            x: point.x + deltaX,
            y: point.y + deltaY
          }));

          return { ...route, points: updatedPoints };
        }
        return route;
      })
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

    // Update route if player has a custom drawn route - translate entire route
    if (endpoint) {
      setRoutes(prev =>
        prev.map(route => {
          if (route.playerId === playerId && route.points.length > 0) {
            // Get the current starting point of the route
            const currentStart = route.points[0];

            // Calculate the translation delta to the new motion endpoint
            const deltaX = endpoint.x - currentStart.x;
            const deltaY = endpoint.y - currentStart.y;

            // Translate all points in the route by this delta
            const updatedPoints = route.points.map(point => ({
              x: point.x + deltaX,
              y: point.y + deltaY
            }));

            return { ...route, points: updatedPoints };
          }
          return route;
        })
      );
    }
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
    return getAssignmentOptions(player.position, getPlayTypeCategory(playType));
  };

  // PHASE 2: Updated drag handlers to support dummy offense
  const handleMouseDown = (
    playerId: string,
    isMotionEndpoint: boolean = false,
    isBlockDirection: boolean = false,
    isZoneEndpoint: boolean = false,
    isMotionControlPoint: boolean = false,
    isSpecialTeamsPath: boolean = false
  ) => {
    // If in drawing mode and clicking on a player, cancel drawing mode
    // This allows users to drag players even if they accidentally entered drawing mode
    if (isDrawingRoute) {
      setIsDrawingRoute(false);
      setCurrentRoute([]);
      setSelectedPlayer(null);
      // Don't return - continue to allow the drag
    }

    if (isSpecialTeamsPath) {
      setDraggedSpecialTeamsPath(playerId);
    } else if (isMotionControlPoint) {
      setDraggedMotionControlPoint(playerId);
    } else if (isZoneEndpoint) {
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
    // Use e.currentTarget which is the SVG element the event is attached to
    const svgElement = e.currentTarget;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
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
    } else if (draggedMotionControlPoint) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedMotionControlPoint
            ? { ...p, motionControlPoint: { x, y } }
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
    } else if (draggedSpecialTeamsPath) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedSpecialTeamsPath
            ? { ...p, specialTeamsPath: { x, y } }
            : p
        )
      );
    }
  }, [draggedPlayer, draggedMotionEndpoint, draggedMotionControlPoint, draggedBlockDirection, draggedZoneEndpoint, draggedSpecialTeamsPath]);

  const handleMouseUp = () => {
    // If we were dragging a motion endpoint, update the route to match
    if (draggedMotionEndpoint) {
      const player = players.find(p => p.id === draggedMotionEndpoint);
      if (player?.motionEndpoint) {
        setRoutes(prev =>
          prev.map(route => {
            if (route.playerId === draggedMotionEndpoint && route.points.length > 0) {
              // Get the current starting point of the route
              const currentStart = route.points[0];

              // Calculate the translation delta to the new motion endpoint
              const deltaX = player.motionEndpoint!.x - currentStart.x;
              const deltaY = player.motionEndpoint!.y - currentStart.y;

              // Translate all points in the route by this delta
              const updatedPoints = route.points.map(point => ({
                x: point.x + deltaX,
                y: point.y + deltaY
              }));

              return { ...route, points: updatedPoints };
            }
            return route;
          })
        );
      }
    }

    setDraggedPlayer(null);
    setDraggedMotionEndpoint(null);
    setDraggedMotionControlPoint(null);
    setDraggedBlockDirection(null);
    setDraggedZoneEndpoint(null);
    setDraggedSpecialTeamsPath(null);
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (
    playerId: string,
    isMotionEndpoint: boolean = false,
    isBlockDirection: boolean = false,
    isZoneEndpoint: boolean = false,
    isMotionControlPoint: boolean = false,
    isSpecialTeamsPath: boolean = false
  ) => {
    // If in drawing mode and touching a player, cancel drawing mode
    // This allows users to drag players even if they accidentally entered drawing mode
    if (isDrawingRoute) {
      setIsDrawingRoute(false);
      setCurrentRoute([]);
      setSelectedPlayer(null);
      // Don't return - continue to allow the drag
    }

    if (isSpecialTeamsPath) {
      setDraggedSpecialTeamsPath(playerId);
    } else if (isMotionControlPoint) {
      setDraggedMotionControlPoint(playerId);
    } else if (isZoneEndpoint) {
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
    // Use e.currentTarget which is the SVG element the event is attached to
    const svgElement = e.currentTarget;
    if (!svgElement) return;

    // Prevent scrolling while dragging
    e.preventDefault();

    const rect = svgElement.getBoundingClientRect();
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
    } else if (draggedMotionControlPoint) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedMotionControlPoint
            ? { ...p, motionControlPoint: { x, y } }
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
    } else if (draggedSpecialTeamsPath) {
      setPlayers(prev =>
        prev.map(p =>
          p.id === draggedSpecialTeamsPath
            ? { ...p, specialTeamsPath: { x, y } }
            : p
        )
      );
    }
  }, [draggedPlayer, draggedMotionEndpoint, draggedMotionControlPoint, draggedBlockDirection, draggedZoneEndpoint, draggedSpecialTeamsPath]);

  const handleTouchEnd = () => {
    // If we were dragging a motion endpoint, update the route to match
    if (draggedMotionEndpoint) {
      const player = players.find(p => p.id === draggedMotionEndpoint);
      if (player?.motionEndpoint) {
        setRoutes(prev =>
          prev.map(route => {
            if (route.playerId === draggedMotionEndpoint && route.points.length > 0) {
              // Get the current starting point of the route
              const currentStart = route.points[0];

              // Calculate the translation delta to the new motion endpoint
              const deltaX = player.motionEndpoint!.x - currentStart.x;
              const deltaY = player.motionEndpoint!.y - currentStart.y;

              // Translate all points in the route by this delta
              const updatedPoints = route.points.map(point => ({
                x: point.x + deltaX,
                y: point.y + deltaY
              }));

              return { ...route, points: updatedPoints };
            }
            return route;
          })
        );
      }
    }

    setDraggedPlayer(null);
    setDraggedMotionEndpoint(null);
    setDraggedMotionControlPoint(null);
    setDraggedBlockDirection(null);
    setDraggedZoneEndpoint(null);
    setDraggedSpecialTeamsPath(null);
  };

  const startCustomRoute = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;

    setSelectedPlayer(playerId);
    setIsDrawingRoute(true);
    setIsDrawingDrag(false);
    setCurrentRoute([{ x: startX, y: startY }]);
    setRouteSegmentIndices([0]); // First segment starts at index 0
    toast.info('Click and drag to draw route. Release to pause. Click Finish when done.');
  };

  // Edit an existing custom route - load it into drawing mode
  const editCustomRoute = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const existingRoute = routes.find(r => r.playerId === playerId);

    if (!player) return;

    // Remove the existing route from routes array (we'll add it back when done)
    setRoutes(prev => prev.filter(r => r.playerId !== playerId));

    // Load the existing route points into currentRoute for editing
    if (existingRoute && existingRoute.points.length > 0) {
      setCurrentRoute([...existingRoute.points]);
      // Create segment indices - treat each point as potentially being undoable
      // Start with index 0 (first point from player) and mark every few points as a segment
      setRouteSegmentIndices([0]);
    } else {
      // No existing route, start fresh from player position
      const startX = player.motionEndpoint?.x || player.x;
      const startY = player.motionEndpoint?.y || player.y;
      setCurrentRoute([{ x: startX, y: startY }]);
      setRouteSegmentIndices([0]);
    }

    setSelectedPlayer(playerId);
    setIsDrawingRoute(true);
    setIsDrawingDrag(false);
    toast.info('Editing route. Click and drag to continue drawing, or Finish to save.');
  };

  // Start drawing when mouse is pressed down in drawing mode
  const handleDrawingMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingRoute || !selectedPlayer) return;

    const svgElement = e.currentTarget;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT;

    // Mark the start of a new segment (current length before adding new point)
    setRouteSegmentIndices(prev => [...prev, currentRoute.length]);

    // If there's already points, we need to connect from the last point to this click
    // The drawing will continue from this click position
    setCurrentRoute(prev => [...prev, { x, y }]);
    setIsDrawingDrag(true);
  };

  // Continue drawing while mouse is held down
  const handleDrawingMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingRoute || !selectedPlayer || !isDrawingDrag) return;

    const svgElement = e.currentTarget;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT;

    // Only add point if it's far enough from the last point (avoid too many points)
    const lastPoint = currentRoute[currentRoute.length - 1];
    if (lastPoint) {
      const distance = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
      if (distance > 5) { // Minimum distance between points
        setCurrentRoute(prev => [...prev, { x, y }]);
      }
    }
  };

  // Stop drawing segment when mouse is released
  const handleDrawingMouseUp = () => {
    if (isDrawingDrag) {
      setIsDrawingDrag(false);
    }
  };

  // Undo last drawn segment
  const undoLastSegment = () => {
    if (!isDrawingRoute || routeSegmentIndices.length <= 1) return;

    // Get the index where the last segment started
    const lastSegmentIndex = routeSegmentIndices[routeSegmentIndices.length - 1];

    // Remove all points from that segment
    setCurrentRoute(prev => prev.slice(0, lastSegmentIndex));
    setRouteSegmentIndices(prev => prev.slice(0, -1));
  };

  // Finish drawing and save the route
  const finishDrawing = () => {
    if (!isDrawingRoute || !selectedPlayer || currentRoute.length < 2) {
      toast.error('Draw at least one segment before finishing');
      return;
    }

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
    setIsDrawingDrag(false);
    setCurrentRoute([]);
    setRouteSegmentIndices([]);
    setSelectedPlayer(null);
    toast.success('Route saved!');
  };

  // Cancel drawing mode
  const cancelDrawing = () => {
    setIsDrawingRoute(false);
    setIsDrawingDrag(false);
    setCurrentRoute([]);
    setRouteSegmentIndices([]);
    setSelectedPlayer(null);
    toast.info('Drawing cancelled');
  };

  // Legacy handlers - kept for backwards compatibility but not used in new drawing mode
  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Now handled by handleDrawingMouseDown
    if (!isDrawingRoute || !selectedPlayer) return;
  };

  const handleFieldDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Quick Draw mode - double-click finishes drawing
    if (quickDrawState.isDrawing) {
      e.preventDefault();
      handleQuickDrawFinish();
      return;
    }
    // Normal drawing mode - now handled by finishDrawing button
    if (!isDrawingRoute || !selectedPlayer) return;
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
        zoneEndpoint: p.zoneEndpoint,
        specialTeamsPath: p.specialTeamsPath
      })),
      routes: routes.map(r => ({
        id: r.id,
        playerId: r.playerId,
        path: r.points,
        type: getRouteTypeForPlayType(playType),
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
      if (existingPlay && !isDuplicateMode) {
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

        toast.success(isDuplicateMode ? 'Play duplicated successfully!' : 'Play saved successfully!');
        setHasUnsavedChanges(false);
        setIsDuplicateMode(false);
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
  }, [playName, formation, saveAnywayConfirmed, odk, players, playType, routes, targetHole, ballCarrier, coverage, existingPlay, playCode, teamId, onSave, supabase, isSaving, isDuplicateMode]);

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
        if (quickDrawState.isDrawing) {
          quickDrawActions.cancelDrawing();
          toast('Drawing cancelled');
        } else if (isDrawingRoute) {
          setIsDrawingRoute(false);
          setCurrentRoute([]);
          toast('Drawing mode cancelled');
        } else if (hasUnsavedChanges) {
          handleBack();
        }
      }

      // Enter - Finish Quick Draw drawing
      if (e.key === 'Enter' && quickDrawState.isDrawing) {
        e.preventDefault();
        handleQuickDrawFinish();
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
  }, [isDrawingRoute, hasUnsavedChanges, isSaving, currentRoute, handleBack, savePlay, quickDrawState.isDrawing, quickDrawActions, handleQuickDrawFinish]);

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
        existingPlay={existingPlay && !isDuplicateMode ? existingPlay : null}
        isSaving={isSaving}
        onBack={handleBack}
        onSave={savePlay}
        onDuplicate={existingPlay ? handleDuplicate : undefined}
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
            onSpecialTeamPlayChange={handleSpecialTeamPlayChange}
            onDummyOffenseChange={loadDummyOffense}
            onDummyDefenseChange={loadDummyDefense}
          />

          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-700">Build Mode</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => quickDrawActions.setActive(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !quickDrawState.isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Form-Based
              </button>
              <button
                onClick={() => quickDrawActions.setActive(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  quickDrawState.isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Quick Draw
              </button>
            </div>
          </div>

          {/* Assignment Panel - hidden in Quick Draw mode */}
          {!quickDrawState.isActive && (
            <AssignmentPanel
            odk={odk}
            playType={playType}
            coverage={coverage}
            players={players}
            routes={routes}
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
            onEditCustomRoute={editCustomRoute}
          />
          )}

          {/* Quick Draw Instructions - shown in Quick Draw mode */}
          {quickDrawState.isActive && (
            <div className="p-4 bg-gray-800 rounded-lg text-white">
              <h3 className="font-semibold mb-2">Quick Draw Mode</h3>
              <p className="text-sm text-gray-300 mb-3">
                Click on a player, then draw their route or assignment on the field.
              </p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Select a tool from the toolbar below the field</li>
                <li>• Click a player to start drawing</li>
                <li>• Click points to draw the path</li>
                <li>• Double-click or press Enter to finish</li>
                <li>• Press Escape to cancel</li>
              </ul>
            </div>
          )}

        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit space-y-4">
          <FieldDiagram
            players={players}
            routes={routes}
            dummyOffensePlayers={dummyOffensePlayers}
            dummyDefensePlayers={dummyDefensePlayers}
            dummyOffenseFormation={dummyOffenseFormation}
            dummyDefenseFormation={dummyDefenseFormation}
            isDrawingRoute={isDrawingRoute}
            isDrawingDrag={isDrawingDrag}
            currentRoute={currentRoute}
            playType={playType}
            targetHole={targetHole}
            ballCarrier={ballCarrier}
            selectedPlayer={selectedPlayer}
            formation={formation}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onFieldClick={handleFieldClick}
            onFieldDoubleClick={handleFieldDoubleClick}
            onDrawingMouseDown={handleDrawingMouseDown}
            onDrawingMouseMove={handleDrawingMouseMove}
            onDrawingMouseUp={handleDrawingMouseUp}
            onUndoSegment={undoLastSegment}
            onFinishDrawing={finishDrawing}
            onCancelDrawing={cancelDrawing}
            onEditCustomRoute={editCustomRoute}
            // Quick Draw mode props
            isQuickDrawMode={quickDrawState.isActive}
            quickDrawActivePlayer={quickDrawState.activePlayerId}
            quickDrawGhostLine={quickDrawState.ghostLine}
            quickDrawSelectedTool={quickDrawState.selectedTool}
            onQuickDrawPlayerClick={handleQuickDrawPlayerClick}
            onQuickDrawFieldClick={handleQuickDrawFieldClick}
          />

          {/* Quick Draw Toolbar - shown below field in Quick Draw mode */}
          {quickDrawState.isActive && (
            <QuickDrawToolbar
              selectedTool={quickDrawState.selectedTool}
              onSelectTool={quickDrawActions.selectTool}
              odk={odk}
              canUndo={quickDrawState.undoStack.length > 0}
              canRedo={quickDrawState.redoStack.length > 0}
              onUndo={quickDrawActions.undo}
              onRedo={quickDrawActions.redo}
            />
          )}
        </div>

      </div>

      <ValidationModal
        isOpen={showValidationModal}
        validationResult={validationResult}
        onClose={() => {
          setShowValidationModal(false);
          setValidationResult(null); // Clear old validation result
          validationModalShown.current = false; // Reset flag for next save
        }}
        onSaveAnyway={handleSaveAnyway}
      />

      {/* Quick Draw Route Confirmation Modal */}
      <RouteTypeModal
        isOpen={showRouteModal}
        onClose={handleQuickDrawCancel}
        onConfirm={handleQuickDrawConfirm}
        tool={pendingQuickDraw?.tool as 'route' | 'block' || 'route'}
        playerLabel={players.find(p => p.id === pendingQuickDraw?.playerId)?.label || ''}
        suggestedRoute={pendingQuickDraw?.routeAnalysis?.suggestedRoute || 'Draw Route (Custom)'}
        routeAnalysis={pendingQuickDraw?.routeAnalysis || null}
        relevantOptions={pendingQuickDraw?.relevantOptions || []}
      />
    </div>
  );
}