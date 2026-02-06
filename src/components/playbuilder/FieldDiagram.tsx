'use client';

import { useRef, useCallback } from 'react';
import Tooltip from '@/components/Tooltip';
import { POSITION_GROUPS, isDefensiveLineman, isLinebacker, isDefensiveBack, getGapPositionFromName } from '@/config/footballConfig';
import { FIELD_CONFIG } from './fieldConstants';

// Modern Color Palette (Hudl-inspired)
const COLORS = {
  field: {
    gradient: ['#065F46', '#047857', '#059669'],
    lines: '#047857',
    border: '#064E3B',
  },
  offense: {
    player: '#DC2626',
    stroke: '#991B1B',
  },
  routes: {
    primary: '#EF4444',
    secondary: '#FBBF24',
    blocking: '#6B7280',
    outline: 'rgba(0,0,0,0.2)',
    highlight: 'rgba(255,255,255,0.4)',
  },
  motion: {
    path: '#06B6D4',      // Modern cyan (not dated #00BFFF)
    endpoint: '#0891B2',
    guide: '#06B6D4',
  },
  ballCarrier: {
    path: '#F97316',      // Orange (distinct from routes!)
    shadow: 'rgba(0,0,0,0.25)',
  },
  blitz: {
    path: '#DC2626',
  },
  coverage: {
    deep: '#1E40AF',      // Deep zones
    shallow: '#CA8A04',   // Shallow zones
  },
} as const;

// Deep coverage roles that get blue zones (darker blue for visibility)
const DEEP_COVERAGE_ROLES = ['Deep Third', 'Deep Half', 'Quarter'];

/**
 * Generate a smooth SVG path using Catmull-Rom to Bezier conversion.
 * This creates natural-looking curves through all waypoints instead of angular lines.
 *
 * @param points - Array of {x, y} coordinates
 * @param tension - Controls curve tightness (0.5 = natural, lower = tighter curves)
 * @returns SVG path string with smooth bezier curves
 */
function generateSmoothPath(points: Array<{ x: number; y: number }>, tension = 0.5): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    // Just 2 points: straight line
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let pathD = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    // Get 4 points for Catmull-Rom calculation (p0, p1, p2, p3)
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Calculate control points using Catmull-Rom to Bezier formula
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return pathD;
}

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
  motionControlPoint?: { x: number; y: number };
  coverageRole?: string;
  coverageDepth?: number;
  coverageDescription?: string;
  blitzGap?: string;
  zoneEndpoint?: { x: number; y: number };
  specialTeamsPath?: { x: number; y: number }; // Endpoint for special teams player path/lane
  isDummy?: boolean;
}

interface Route {
  id: string;
  playerId: string;
  points: Array<{ x: number; y: number }>;
  assignment?: string;
  isPrimary?: boolean;
}

interface FieldDiagramProps {
  players: Player[];
  routes: Route[];
  dummyOffensePlayers: Player[];
  dummyDefensePlayers: Player[];
  dummyOffenseFormation: string;
  dummyDefenseFormation: string;
  isDrawingRoute: boolean;
  isDrawingDrag: boolean;
  currentRoute: Array<{ x: number; y: number }>;
  playType: string;
  targetHole: string;
  ballCarrier: string;
  selectedPlayer: string | null;
  formation?: string; // Current formation - used to hide LOS for kickoff/kick return
  onMouseDown: (playerId: string, isMotionEndpoint?: boolean, isBlockDirection?: boolean, isZoneEndpoint?: boolean, isMotionControlPoint?: boolean, isSpecialTeamsPath?: boolean) => void;
  onTouchStart: (playerId: string, isMotionEndpoint?: boolean, isBlockDirection?: boolean, isZoneEndpoint?: boolean, isMotionControlPoint?: boolean, isSpecialTeamsPath?: boolean) => void;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchEnd: () => void;
  onFieldClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onFieldDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onDrawingMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onDrawingMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onDrawingMouseUp: () => void;
  onUndoSegment: () => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  onEditCustomRoute?: (playerId: string) => void;
}

export default function FieldDiagram({
  players,
  routes,
  dummyOffensePlayers,
  dummyDefensePlayers,
  dummyOffenseFormation,
  dummyDefenseFormation,
  isDrawingRoute,
  isDrawingDrag,
  currentRoute,
  playType,
  targetHole,
  ballCarrier,
  selectedPlayer,
  formation,
  onMouseDown,
  onTouchStart,
  onMouseMove,
  onMouseUp,
  onTouchMove,
  onTouchEnd,
  onFieldClick,
  onFieldDoubleClick,
  onDrawingMouseDown,
  onDrawingMouseMove,
  onDrawingMouseUp,
  onUndoSegment,
  onFinishDrawing,
  onCancelDrawing,
  onEditCustomRoute
}: FieldDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clickStartRef = useRef<{ x: number; y: number; playerId: string } | null>(null);

  // Check if a player has a custom drawn route
  const hasCustomRoute = (playerId: string): boolean => {
    const player = players.find(p => p.id === playerId);
    return player?.assignment === 'Draw Route (Custom)' && routes.some(r => r.playerId === playerId);
  };

  // Track mouse down position for click detection
  const handlePlayerMouseDown = (playerId: string, e: React.MouseEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY, playerId };
    onMouseDown(playerId);
  };

  // Handle player click - only trigger if mouse didn't move much (not a drag)
  const handlePlayerClick = (playerId: string, e: React.MouseEvent) => {
    if (!clickStartRef.current || clickStartRef.current.playerId !== playerId) return;

    const dx = Math.abs(e.clientX - clickStartRef.current.x);
    const dy = Math.abs(e.clientY - clickStartRef.current.y);

    // Only count as click if mouse moved less than 5 pixels (not a drag)
    if (dx < 5 && dy < 5 && hasCustomRoute(playerId) && onEditCustomRoute) {
      onEditCustomRoute(playerId);
    }

    clickStartRef.current = null;
  };

  const getPositionGroup = (position: string): 'linemen' | 'backs' | 'receivers' => {
    if (POSITION_GROUPS.linemen.includes(position)) return 'linemen';
    if (POSITION_GROUPS.backs.includes(position)) return 'backs';
    return 'receivers';
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

  // Play types that show ball carrier arrow (run-based plays)
  const runBasedPlayTypes = ['Run', 'Draw', 'RPO'];

  const renderBallCarrierArrow = (player: Player) => {
    if (!runBasedPlayTypes.includes(playType) || !targetHole || player.label !== ballCarrier) return null;

    const holePos = getHolePosition(targetHole);
    const startX = player.motionEndpoint?.x || player.x;
    const startY = player.motionEndpoint?.y || player.y;
    const endX = holePos.x;
    const endY = holePos.y;

    // Create smooth curved path through intermediate waypoints
    const midY = Math.max(startY, 205);
    const waypoints = [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY }
    ];
    const pathD = generateSmoothPath(waypoints, 0.4);

    return (
      <g key={`ball-carrier-${player.id}`}>
        <defs>
          <marker
            id={`arrowhead-ball-${player.id}`}
            markerWidth="12"
            markerHeight="10"
            refX="10"
            refY="5"
            orient="auto"
          >
            {/* Shadow layer */}
            <path d="M 0 0 L 12 5 L 0 10 z" fill={COLORS.ballCarrier.shadow} />
            {/* Main arrowhead with outline */}
            <path d="M 2 2 L 10 5 L 2 8 z" fill={COLORS.ballCarrier.path} stroke="white" strokeWidth="0.6" />
          </marker>
        </defs>
        {/* Shadow/outline layer */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.routes.outline}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Main path */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.ballCarrier.path}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
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
        {/* Shadow layer */}
        <line
          x1={startX}
          y1={startY}
          x2={arrowEnd.endX}
          y2={arrowEnd.endY}
          stroke={COLORS.routes.outline}
          strokeWidth="4"
        />
        {/* Main line */}
        <line
          x1={startX}
          y1={startY}
          x2={arrowEnd.endX}
          y2={arrowEnd.endY}
          stroke={COLORS.routes.blocking}
          strokeWidth="2"
        />
        {/* Shadow for T-bar */}
        <line
          x1={arrowEnd.endX - perpX}
          y1={arrowEnd.endY - perpY}
          x2={arrowEnd.endX + perpX}
          y2={arrowEnd.endY + perpY}
          stroke={COLORS.routes.outline}
          strokeWidth="4"
        />
        {/* T-bar */}
        <line
          x1={arrowEnd.endX - perpX}
          y1={arrowEnd.endY - perpY}
          x2={arrowEnd.endX + perpX}
          y2={arrowEnd.endY + perpY}
          stroke={COLORS.routes.blocking}
          strokeWidth="2"
        />
        <circle
          cx={arrowEnd.endX}
          cy={arrowEnd.endY}
          r="6"
          fill={COLORS.routes.blocking}
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown(player.id, false, true, false);
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

    // Calculate default control point if not set (midpoint with vertical offset for curve)
    const defaultControlX = (startX + endX) / 2;
    const defaultControlY = Math.max(startY, endY) + 30; // Default curve below the line

    const controlX = player.motionControlPoint?.x ?? defaultControlX;
    const controlY = player.motionControlPoint?.y ?? defaultControlY;

    // Use quadratic bezier curve with the control point
    const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

    return (
      <g key={`motion-${player.id}`}>
        <defs>
          <marker
            id={`motion-arrow-${player.id}`}
            markerWidth="12"
            markerHeight="10"
            refX="10"
            refY="5"
            orient="auto"
          >
            {/* Shadow layer */}
            <path d="M 0 0 L 12 5 L 0 10 z" fill={COLORS.ballCarrier.shadow} />
            {/* Main arrowhead with outline */}
            <path d="M 2 2 L 10 5 L 2 8 z" fill={COLORS.motion.path} stroke="white" strokeWidth="0.6" />
          </marker>
        </defs>

        {/* Control point guide lines - very subtle */}
        <line
          x1={startX}
          y1={startY}
          x2={controlX}
          y2={controlY}
          stroke={COLORS.motion.guide}
          strokeWidth="1"
          strokeDasharray="3,3"
          opacity="0.2"
        />
        <line
          x1={endX}
          y1={endY}
          x2={controlX}
          y2={controlY}
          stroke={COLORS.motion.guide}
          strokeWidth="1"
          strokeDasharray="3,3"
          opacity="0.2"
        />

        {/* Shadow/outline layer */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.routes.outline}
          strokeWidth="5"
          strokeDasharray="8,4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Motion path */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.motion.path}
          strokeWidth="3"
          strokeDasharray="8,4"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#motion-arrow-${player.id})`}
        />

        {/* Control point handle - draggable (diamond shape) */}
        <rect
          x={controlX - 6}
          y={controlY - 6}
          width="12"
          height="12"
          fill={COLORS.motion.path}
          stroke="white"
          strokeWidth="2"
          transform={`rotate(45 ${controlX} ${controlY})`}
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown(player.id, false, false, false, true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onTouchStart(player.id, false, false, false, true);
          }}
        />

        {/* Motion endpoint circle - draggable */}
        <circle
          cx={endX}
          cy={endY}
          r="8"
          fill={COLORS.motion.path}
          stroke="white"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown(player.id, true, false, false, false);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onTouchStart(player.id, true, false, false, false);
          }}
        />
      </g>
    );
  };

  const renderPassRoute = (route: Route) => {
    const player = players.find(p => p.id === route.playerId);
    if (!player || route.points.length < 2) return null;

    // Use smooth Catmull-Rom curves for professional-looking routes
    const pathD = generateSmoothPath(route.points, 0.5);

    const color = route.isPrimary ? COLORS.routes.primary : COLORS.routes.secondary;

    // Check if this is a blocking assignment
    const isBlockingRoute = route.assignment === 'Block';

    // Calculate T-shape perpendicular for blocking routes
    const lastPoint = route.points[route.points.length - 1];
    const secondLastPoint = route.points[route.points.length - 2];
    const dx = lastPoint.x - secondLastPoint.x;
    const dy = lastPoint.y - secondLastPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = length > 0 ? (-dy / length) * 8 : 0;
    const perpY = length > 0 ? (dx / length) * 8 : 0;

    return (
      <g key={route.id}>
        {!isBlockingRoute && (
          <defs>
            <marker
              id={`arrowhead-route-${route.id}`}
              markerWidth="12"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="auto"
            >
              {/* Shadow layer */}
              <path d="M 0 0 L 12 5 L 0 10 z" fill={COLORS.routes.outline} />
              {/* Main arrowhead with outline */}
              <path d="M 2 2 L 10 5 L 2 8 z" fill={color} stroke="white" strokeWidth="0.6" />
            </marker>
          </defs>
        )}
        {/* Shadow/outline layer */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.routes.outline}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Main route path */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={!isBlockingRoute ? `url(#arrowhead-route-${route.id})` : undefined}
        />
        {/* Optional highlight for primary routes */}
        {route.isPrimary && (
          <path
            d={pathD}
            fill="none"
            stroke={COLORS.routes.highlight}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {isBlockingRoute && (
          <>
            {/* T-shape blocking symbol for WR/RB blocks - shadow */}
            <line
              x1={lastPoint.x - perpX}
              y1={lastPoint.y - perpY}
              x2={lastPoint.x + perpX}
              y2={lastPoint.y + perpY}
              stroke={COLORS.routes.outline}
              strokeWidth="5"
            />
            {/* T-shape main */}
            <line
              x1={lastPoint.x - perpX}
              y1={lastPoint.y - perpY}
              x2={lastPoint.x + perpX}
              y2={lastPoint.y + perpY}
              stroke={color}
              strokeWidth="3.5"
            />
          </>
        )}
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

  const renderCoverageZone = (player: Player) => {
    // Skip defensive linemen and players with blitz assignments or man coverage
    if (isDefensiveLineman(player.position)) return null;
    if (!player.coverageRole || player.blitzGap || player.coverageRole === 'Man') return null;

    const startX = player.x;
    const startY = player.y;

    // Use saved zoneEndpoint or calculate default (30px above player)
    const defaultDepth = player.coverageDepth || 30;
    const endpoint = player.zoneEndpoint || { x: player.x, y: player.y - defaultDepth };

    const isDeep = DEEP_COVERAGE_ROLES.includes(player.coverageRole);
    const zoneColor = isDeep ? COLORS.coverage.deep : COLORS.coverage.shallow;

    // Calculate ellipse dimensions
    const width = Math.abs(endpoint.x - startX) || 50;
    const height = Math.abs(endpoint.y - startY) || 30;

    return (
      <g key={`zone-${player.id}`}>
        {/* Line from player to zone center */}
        <line
          x1={startX}
          y1={startY}
          x2={endpoint.x}
          y2={endpoint.y}
          stroke={zoneColor}
          strokeWidth="2"
        />
        {/* Zone ellipse */}
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
        {/* Draggable zone endpoint handle */}
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
            onMouseDown(player.id, false, false, true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onTouchStart(player.id, false, false, true);
          }}
        />
      </g>
    );
  };

  const renderBlitzArrow = (player: Player) => {
    if (!player.blitzGap) return null;

    const startX = player.x;
    const startY = player.y;

    // Use saved zoneEndpoint or calculate from gap name
    const gapPos = player.zoneEndpoint || getGapPositionFromName(player.blitzGap, FIELD_CONFIG.CENTER_X);
    const endX = gapPos.x;
    const endY = gapPos.y;

    return (
      <g key={`blitz-${player.id}`}>
        <defs>
          <marker
            id={`arrowhead-blitz-${player.id}`}
            markerWidth="12"
            markerHeight="10"
            refX="10"
            refY="5"
            orient="auto"
          >
            {/* Shadow layer */}
            <path d="M 0 0 L 12 5 L 0 10 z" fill={COLORS.routes.outline} />
            {/* Main arrowhead with outline */}
            <path d="M 2 2 L 10 5 L 2 8 z" fill={COLORS.blitz.path} stroke="white" strokeWidth="0.6" />
          </marker>
        </defs>
        {/* Shadow layer */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={COLORS.routes.outline}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Blitz arrow */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={COLORS.blitz.path}
          strokeWidth="3.5"
          strokeLinecap="round"
          markerEnd={`url(#arrowhead-blitz-${player.id})`}
        />
        {/* Draggable blitz endpoint handle */}
        <circle
          cx={endX}
          cy={endY}
          r="6"
          fill={COLORS.blitz.path}
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown(player.id, false, false, true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onTouchStart(player.id, false, false, true);
          }}
        />
      </g>
    );
  };

  const renderSpecialTeamsPath = (player: Player) => {
    // Only render for players that have a specialTeamsPath defined
    if (!player.specialTeamsPath) return null;

    const startX = player.x;
    const startY = player.y;
    const endX = player.specialTeamsPath.x;
    const endY = player.specialTeamsPath.y;

    // Use green for special teams paths, red/pink for run paths, yellow for pass routes
    // Run paths: Holder (FG fake), PP (Punt fake), R (Punt/Kick Return) - when they have significant horizontal movement
    // Pass routes: WR (FG fake), WingR (Punt fake) - when they have significant horizontal movement
    const runPathPositions = ['Holder', 'PP', 'R'];
    const passRoutePositions = ['WR', 'WingR'];
    const hasSignificantHorizontalMovement = Math.abs(endX - startX) > 50;

    const isRunPath = runPathPositions.includes(player.position) && hasSignificantHorizontalMovement;
    const isPassRoute = passRoutePositions.includes(player.position) && hasSignificantHorizontalMovement;
    const pathColor = isRunPath ? '#E11D48' : isPassRoute ? '#EAB308' : '#22C55E'; // Red for run, Yellow for pass, Green for others

    // Determine if this is a blocker (FL, SL, Field Goal/Punt line positions, or Punt Return blockers)
    // Note: WR/WingR is NOT a blocker if running a pass route, PP is NOT a blocker if running
    const linePositions = ['LS', 'LG', 'RG', 'LT', 'RT', 'TEL', 'TER', 'WL'];
    const puntReturnBlockers = ['Box1', 'Box2', 'Box3', 'Box4', 'Box5', 'Box6', 'JamL', 'JamR', 'R2'];
    const isBlocker = !isPassRoute && !isRunPath && (
      player.position.startsWith('FL') ||
      player.position.startsWith('SL') ||
      linePositions.includes(player.position) ||
      puntReturnBlockers.includes(player.position)
    );

    // Calculate perpendicular for T-shape blocking symbol
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = length > 0 ? (-dy / length) * 10 : 0;
    const perpY = length > 0 ? (dx / length) * 10 : 0;

    // For run paths or pass routes, create a curved path
    const isCurvedPath = isRunPath || isPassRoute;
    // Control point for the curve
    const isReturner = player.position === 'R';
    const isGoingDown = endY > startY; // Returner going toward LOS
    const isGoingRight = endX > startX;

    // For returners going down and to the side, curve outward first
    let controlX, controlY;
    if (isReturner && isGoingDown) {
      // Curve outward in the direction of travel, staying near start Y
      controlX = startX + (endX - startX) * 0.8;
      controlY = startY + 20; // Slight dip, then curve to destination
    } else {
      controlX = startX + (endX - startX) * 0.7;
      // Pass routes curve slightly, run paths curve based on direction
      controlY = isPassRoute ? startY - 20 :
                 isReturner ? startY + 40 : // Returners going up curve down first
                 (endX < startX ? startY - 40 : startY + 20);
    }

    return (
      <g key={`st-path-${player.id}`}>
        {(!isBlocker || isCurvedPath) && (
          <defs>
            <marker
              id={`arrowhead-st-${player.id}`}
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" fill={pathColor} />
            </marker>
          </defs>
        )}
        {/* Special teams path - curved for run paths, straight for others */}
        {isCurvedPath ? (
          <path
            d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
            stroke={pathColor}
            strokeWidth="2.5"
            fill="none"
            markerEnd={`url(#arrowhead-st-${player.id})`}
          />
        ) : (
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={pathColor}
            strokeWidth="2.5"
            markerEnd={!isBlocker ? `url(#arrowhead-st-${player.id})` : undefined}
          />
        )}
        {isBlocker && !isCurvedPath ? (
          <>
            {/* T-shape blocking symbol - perpendicular line at end */}
            <line
              x1={endX - perpX}
              y1={endY - perpY}
              x2={endX + perpX}
              y2={endY + perpY}
              stroke={pathColor}
              strokeWidth="3"
            />
            {/* Invisible larger hit area for dragging */}
            <circle
              cx={endX}
              cy={endY}
              r="12"
              fill="transparent"
              className="cursor-move"
              onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(player.id, false, false, false, false, true);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onTouchStart(player.id, false, false, false, false, true);
              }}
            />
          </>
        ) : (
          /* Draggable path endpoint handle (circle for returners and run paths) */
          <circle
            cx={endX}
            cy={endY}
            r="6"
            fill={pathColor}
            stroke="#ffffff"
            strokeWidth="2"
            className="cursor-move"
            onMouseDown={(e) => {
              e.stopPropagation();
              onMouseDown(player.id, false, false, false, false, true);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onTouchStart(player.id, false, false, false, false, true);
            }}
          />
        )}
      </g>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold text-gray-900">Play Diagram</h3>
        <Tooltip content="Drag players to reposition. Click a player to select, then click on the field to draw a route. Use Ctrl+S to save." position="bottom">
          <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </Tooltip>
      </div>
      
      <div className="mb-4 p-3 bg-gray-50 rounded-md text-xs leading-relaxed">
        <p className="text-gray-700">
          <strong>Drag players</strong> to reposition. <strong>Select assignments</strong> from dropdowns - routes auto-generate!
          {isDrawingRoute && (
            <span className="text-orange-600 font-semibold"> ✏️ Drawing mode: Click and drag to draw route. Release to pause. Click Finish when done.</span>
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
        {/* Drawing Mode Controls */}
        {isDrawingRoute && (
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <button
              onClick={onUndoSegment}
              className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded shadow hover:bg-yellow-600 transition-colors flex items-center gap-1"
              title="Undo last segment"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>
            <button
              onClick={onFinishDrawing}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded shadow hover:bg-green-700 transition-colors flex items-center gap-1"
              title="Finish drawing route"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Finish
            </button>
            <button
              onClick={onCancelDrawing}
              className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded shadow hover:bg-red-600 transition-colors flex items-center gap-1"
              title="Cancel drawing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${FIELD_CONFIG.WIDTH} ${FIELD_CONFIG.HEIGHT}`}
          className="w-full h-auto"
          style={{
            touchAction: 'none',
            cursor: isDrawingRoute ? 'crosshair' : 'default'
          }}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={isDrawingRoute ? onDrawingMouseDown : undefined}
          onMouseMove={(e) => {
            if (isDrawingRoute && isDrawingDrag) {
              onDrawingMouseMove(e);
            } else {
              onMouseMove(e);
            }
          }}
          onMouseUp={() => {
            if (isDrawingRoute) {
              onDrawingMouseUp();
            } else {
              onMouseUp();
            }
          }}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={onFieldClick}
          onDoubleClick={onFieldDoubleClick}
          role="application"
          aria-label="Football play diagram - drag players to reposition"
        >
          <defs>
            {/* Modern field gradient */}
            <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={COLORS.field.gradient[0]} />
              <stop offset="50%" stopColor={COLORS.field.gradient[1]} />
              <stop offset="100%" stopColor={COLORS.field.gradient[2]} />
            </linearGradient>
          </defs>
          {/* Field background with gradient */}
          <rect width={FIELD_CONFIG.WIDTH} height={FIELD_CONFIG.HEIGHT} fill="url(#fieldGradient)" />
          <rect width={FIELD_CONFIG.WIDTH} height={FIELD_CONFIG.HEIGHT} fill="none" stroke={COLORS.field.border} strokeWidth="3" />
          
          {/* Yard lines */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <line
              key={i}
              x1="0"
              y1={i * 40}
              x2="700"
              y2={i * 40}
              stroke={COLORS.field.lines}
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Hash marks */}
          <line x1={FIELD_CONFIG.HASH_LEFT} y1="0" x2={FIELD_CONFIG.HASH_LEFT} y2={FIELD_CONFIG.HEIGHT} stroke={COLORS.field.lines} strokeWidth="1" strokeDasharray="5,5" opacity="0.6" />
          <line x1={FIELD_CONFIG.HASH_RIGHT} y1="0" x2={FIELD_CONFIG.HASH_RIGHT} y2={FIELD_CONFIG.HEIGHT} stroke={COLORS.field.lines} strokeWidth="1" strokeDasharray="5,5" opacity="0.6" />

          {/* Line of scrimmage - hide for kickoff and kick return plays */}
          {formation !== 'Kickoff' && formation !== 'Kick Return' && (
            <line x1="0" y1={FIELD_CONFIG.LINE_OF_SCRIMMAGE} x2={FIELD_CONFIG.WIDTH} y2={FIELD_CONFIG.LINE_OF_SCRIMMAGE} stroke="white" strokeWidth="3" opacity="0.8" />
          )}

          {/* Dummy Offense (for defensive plays) */}
          {dummyOffensePlayers.map(player => (
            <g key={player.id}>
              <circle
                cx={player.x}
                cy={player.y}
                r={FIELD_CONFIG.PLAYER_RADIUS}
                fill={COLORS.offense.player}
                fillOpacity={0.4}
                stroke="white"
                strokeWidth={2}
                strokeDasharray="3,3"
                className="cursor-move"
                onMouseDown={() => onMouseDown(player.id)}
                onTouchStart={() => onTouchStart(player.id)}
              />
              <text
                x={player.x}
                y={player.y + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="white"
                opacity={0.6}
                style={{ pointerEvents: 'none' }}
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
                    x={player.x - FIELD_CONFIG.PLAYER_RADIUS}
                    y={player.y - FIELD_CONFIG.PLAYER_RADIUS}
                    width={FIELD_CONFIG.PLAYER_RADIUS * 2}
                    height={FIELD_CONFIG.PLAYER_RADIUS * 2}
                    fill="white"
                    fillOpacity={0.4}
                    stroke="black"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                    className="cursor-move"
                    onMouseDown={() => onMouseDown(player.id)}
                    onTouchStart={() => onTouchStart(player.id)}
                  />
                  <text
                    x={player.x}
                    y={player.y + 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="black"
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
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
                    onMouseDown={() => onMouseDown(player.id)}
                    onTouchStart={() => onTouchStart(player.id)}
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
                    onMouseDown={() => onMouseDown(player.id)}
                    onTouchStart={() => onTouchStart(player.id)}
                  />
                  <text
                    x={player.x}
                    y={player.y + 20}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="white"
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
                  >
                    {player.label}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Routes */}
          {routes.map(route => renderPassRoute(route))}

          {/* Coverage zones and blitz arrows for defensive players */}
          {players.filter(p => p.side === 'defense').map(player => (
            <g key={`defensive-${player.id}`}>
              {renderCoverageZone(player)}
              {renderBlitzArrow(player)}
            </g>
          ))}

          {/* Special teams path arrows */}
          {players.map(player => renderSpecialTeamsPath(player))}

          {/* Ball carrier arrows, blocking arrows, motion arrows */}
          {players.map(player => (
            <g key={`arrows-${player.id}`}>
              {renderBallCarrierArrow(player)}
              {renderBlockingArrow(player)}
              {renderMotionArrow(player)}
            </g>
          ))}

          {/* Real players */}
          {players.map(player => {
            const playerHasCustomRoute = hasCustomRoute(player.id);

            return (
              <g key={player.id}>
                {/* Highlight ring for players with editable custom routes */}
                {playerHasCustomRoute && (
                  <circle
                    cx={player.x}
                    cy={player.y}
                    r={FIELD_CONFIG.PLAYER_RADIUS + 4}
                    fill="none"
                    stroke="#FF8C00"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    opacity="0.8"
                  />
                )}

                {player.side === 'offense' ? (
                  // Offense: circles (red)
                  <circle
                    cx={player.x}
                    cy={player.y}
                    r={FIELD_CONFIG.PLAYER_RADIUS}
                    fill={COLORS.offense.player}
                    stroke={player.isPrimary ? COLORS.routes.secondary : COLORS.offense.stroke}
                    strokeWidth={player.isPrimary ? 3 : 2}
                    className={playerHasCustomRoute ? 'cursor-pointer' : 'cursor-move'}
                    onMouseDown={(e) => handlePlayerMouseDown(player.id, e)}
                    onTouchStart={() => onTouchStart(player.id)}
                    onClick={(e) => handlePlayerClick(player.id, e)}
                  />
                ) : isDefensiveLineman(player.position) ? (
                  // Defensive Linemen: squares (white)
                  <rect
                    x={player.x - FIELD_CONFIG.PLAYER_RADIUS}
                    y={player.y - FIELD_CONFIG.PLAYER_RADIUS}
                    width={FIELD_CONFIG.PLAYER_RADIUS * 2}
                    height={FIELD_CONFIG.PLAYER_RADIUS * 2}
                    fill="white"
                    stroke="black"
                    strokeWidth="2"
                    className="cursor-move"
                    onMouseDown={() => onMouseDown(player.id)}
                    onTouchStart={() => onTouchStart(player.id)}
                  />
                ) : isLinebacker(player.position) ? (
                  // Linebackers: circles (white)
                  <circle
                    cx={player.x}
                    cy={player.y}
                    r={FIELD_CONFIG.PLAYER_RADIUS}
                    fill="white"
                    stroke="black"
                    strokeWidth="2"
                    className="cursor-move"
                    onMouseDown={() => onMouseDown(player.id)}
                    onTouchStart={() => onTouchStart(player.id)}
                  />
                ) : (
                  // DBs (Safeties/Cornerbacks): X shape (white)
                  <>
                    <line
                      x1={player.x - 10}
                      y1={player.y - 10}
                      x2={player.x + 10}
                      y2={player.y + 10}
                      stroke="white"
                      strokeWidth="3"
                      className="cursor-move"
                      onMouseDown={() => onMouseDown(player.id)}
                      onTouchStart={() => onTouchStart(player.id)}
                    />
                    <line
                      x1={player.x - 10}
                      y1={player.y + 10}
                      x2={player.x + 10}
                      y2={player.y - 10}
                      stroke="white"
                      strokeWidth="3"
                      className="cursor-move"
                      onMouseDown={() => onMouseDown(player.id)}
                      onTouchStart={() => onTouchStart(player.id)}
                    />
                  </>
                )}
                <text
                  x={player.x}
                  y={player.y + (player.side === 'defense' && isDefensiveBack(player.position) ? 20 : 5)}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={player.side === 'offense' ? 'white' : (isDefensiveBack(player.position) ? 'white' : 'black')}
                  style={{ pointerEvents: 'none' }}
                >
                  {player.label}
                </text>
              </g>
            );
          })}

          {/* Current route being drawn */}
          {isDrawingRoute && currentRoute.length > 0 && (
            <g>
              {/* Shadow layer */}
              <path
                d={generateSmoothPath(currentRoute, 0.5)}
                fill="none"
                stroke={COLORS.routes.outline}
                strokeWidth="5"
                strokeDasharray="5,5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main path */}
              <path
                d={generateSmoothPath(currentRoute, 0.5)}
                fill="none"
                stroke={COLORS.routes.secondary}
                strokeWidth="3.5"
                strokeDasharray="5,5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {currentRoute.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={COLORS.routes.secondary}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
