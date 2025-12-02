'use client';

import { PlayDiagram, Player, Route, PlayAttributes } from '@/types/football';
import { getGapPositionFromName, isDefensiveLineman, isLinebacker, isDefensiveBack } from '@/config/footballConfig';

// Extended player type that may have isDummy from playbuilder
interface DiagramPlayer extends Player {
  isDummy?: boolean;
}

// Route might have either 'path' or 'points' depending on source
interface DiagramRoute extends Omit<Route, 'path'> {
  path?: { x: number; y: number }[];
  points?: { x: number; y: number }[];
}

interface MiniPlayDiagramProps {
  diagram: PlayDiagram | null;
  attributes?: PlayAttributes | null;
  width?: number;
  height?: number;
  className?: string;
}

// Field configuration constants (matching PlayBuilder)
const FIELD_CONFIG = {
  CENTER_X: 350,
  LINE_OF_SCRIMMAGE: 200
};

// Deep coverage roles that get blue zones
const DEEP_COVERAGE_ROLES = ['Deep Third', 'Deep Half', 'Quarter'];
const DEEP_ZONE_COLOR = '#1E40AF'; // Darker blue for better visibility
const SHALLOW_ZONE_COLOR = '#CA8A04'; // Darker gold/yellow

/**
 * A small, read-only preview of a play diagram
 * Renders players as colored dots and routes/blocking arrows as lines
 */
export default function MiniPlayDiagram({
  diagram,
  attributes,
  width = 140,
  height = 80,
  className = ''
}: MiniPlayDiagramProps) {
  if (!diagram || !diagram.players || diagram.players.length === 0) {
    return (
      <div
        className={`bg-green-800 rounded flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-green-300">No diagram</span>
      </div>
    );
  }

  // Original canvas is 700x400, scale down
  const scaleX = width / 700;
  const scaleY = height / 400;

  const isOffense = diagram.odk === 'offense';
  const isDefense = diagram.odk === 'defense';

  // Filter out dummy players
  const mainPlayers = (diagram.players as DiagramPlayer[]).filter(p => !p.isDummy);
  const routes = (diagram.routes || []) as DiagramRoute[];

  // Get player color based on ODK and primary status
  const getPlayerColor = (player: DiagramPlayer) => {
    // Ball carrier gets red
    if (attributes?.ballCarrier && player.label === attributes.ballCarrier) {
      return '#FF0000';
    }
    if (player.isPrimary) return '#FF0000'; // Red for primary
    if (isOffense) return '#3B82F6'; // Blue for offense
    if (isDefense) return '#EF4444'; // Red for defense
    return '#22C55E'; // Green for special teams
  };

  // Get route color - primary is red, others are yellow/gold
  const getRouteColor = (route: DiagramRoute) => {
    if (route.isPrimary) return '#FF0000'; // Red for primary
    return '#FFD700'; // Gold for other routes
  };

  // Get route points (handle both 'path' and 'points' field names)
  const getRoutePoints = (route: DiagramRoute): { x: number; y: number }[] => {
    return route.path || route.points || [];
  };

  // Build SVG path from route points
  const buildRoutePath = (route: DiagramRoute): string => {
    const points = getRoutePoints(route);
    if (points.length < 2) return '';

    const pathParts = points.map((p, i) => {
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });

    return pathParts.join(' ');
  };

  // Calculate hole position for run plays (simplified version)
  const getHolePosition = (hole: string): { x: number; y: number } => {
    const linemen = mainPlayers.filter(p =>
      ['LT', 'LG', 'C', 'RG', 'RT'].includes(p.position)
    );

    const center = linemen.find(p => p.position === 'C');
    const lg = linemen.find(p => p.position === 'LG');
    const rg = linemen.find(p => p.position === 'RG');
    const lt = linemen.find(p => p.position === 'LT');
    const rt = linemen.find(p => p.position === 'RT');

    const centerX = center?.x || FIELD_CONFIG.CENTER_X;
    const holeY = FIELD_CONFIG.LINE_OF_SCRIMMAGE - 5;

    const holeMatch = hole.match(/^(\d)/);
    const holeNum = holeMatch ? holeMatch[1] : hole.charAt(0);

    switch (holeNum) {
      case '0': return { x: centerX, y: holeY }; // Over center
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
        return { x: centerX - 140, y: holeY };
      case '8':
        return { x: centerX + 140, y: holeY };
      case '9':
        return { x: centerX - 180, y: holeY };
      default:
        return { x: centerX, y: holeY };
    }
  };

  // Generate ball carrier run path for run plays
  const getBallCarrierPath = (): string | null => {
    if (!attributes?.playType || !attributes?.targetHole || !attributes?.ballCarrier) {
      return null;
    }

    // Only show for run-based play types
    if (!['Run', 'Draw', 'RPO'].includes(attributes.playType)) {
      return null;
    }

    const ballCarrierPlayer = mainPlayers.find(p => p.label === attributes.ballCarrier);
    if (!ballCarrierPlayer) return null;

    const holePos = getHolePosition(attributes.targetHole);
    const startX = (ballCarrierPlayer.motionEndpoint?.x ?? ballCarrierPlayer.x) * scaleX;
    const startY = (ballCarrierPlayer.motionEndpoint?.y ?? ballCarrierPlayer.y) * scaleY;
    const endX = holePos.x * scaleX;
    const endY = holePos.y * scaleY;

    // Create path: start -> drop to line -> move horizontally -> go to hole
    const midY = Math.max(startY, 205 * scaleY);
    return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
  };

  // Sort routes so primary renders on top
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return 1;
    if (!a.isPrimary && b.isPrimary) return -1;
    return 0;
  });

  const ballCarrierPath = getBallCarrierPath();

  return (
    <div
      className={`bg-green-800 rounded overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Arrowhead markers for routes */}
        <defs>
          <marker
            id="mini-arrowhead-gold"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M 0 0 L 4 2 L 0 4 z" fill="#FFD700" />
          </marker>
          <marker
            id="mini-arrowhead-red"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M 0 0 L 4 2 L 0 4 z" fill="#FF0000" />
          </marker>
          <marker
            id="mini-arrowhead-orange"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M 0 0 L 4 2 L 0 4 z" fill="#F97316" />
          </marker>
          {/* Blitz arrow marker */}
          <marker
            id="mini-arrowhead-blitz"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M 0 0 L 4 2 L 0 4 z" fill="#DC2626" />
          </marker>
          {/* Special teams path arrow marker */}
          <marker
            id="mini-arrowhead-st"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M 0 0 L 4 2 L 0 4 z" fill="#22C55E" />
          </marker>
        </defs>

        {/* Line of scrimmage */}
        <line
          x1={0}
          y1={200 * scaleY}
          x2={width}
          y2={200 * scaleY}
          stroke="#FFFFFF"
          strokeWidth={1}
          strokeOpacity={0.5}
        />

        {/* Yard lines (simplified) */}
        {[100, 300].map(y => (
          <line
            key={y}
            x1={0}
            y1={y * scaleY}
            x2={width}
            y2={y * scaleY}
            stroke="#FFFFFF"
            strokeWidth={0.5}
            strokeOpacity={0.2}
          />
        ))}

        {/* Motion paths - dashed yellow */}
        {mainPlayers
          .filter(p => p.motionType && p.motionType !== 'None' && p.motionEndpoint)
          .map((player, index) => {
            const startX = player.x * scaleX;
            const startY = player.y * scaleY;
            const endX = (player.motionEndpoint?.x ?? player.x) * scaleX;
            const endY = (player.motionEndpoint?.y ?? player.y) * scaleY;

            return (
              <line
                key={`motion-${player.position}-${index}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#FBBF24"
                strokeWidth={1.5}
                strokeDasharray="3,2"
                markerEnd="url(#mini-arrowhead-gold)"
              />
            );
          })}

        {/* Blocking arrows - orange */}
        {mainPlayers
          .filter(p => p.blockType && p.blockDirection)
          .map((player, index) => {
            const startX = (player.motionEndpoint?.x ?? player.x) * scaleX;
            const startY = (player.motionEndpoint?.y ?? player.y) * scaleY;
            const endX = (player.blockDirection?.x ?? player.x) * scaleX;
            const endY = (player.blockDirection?.y ?? player.y) * scaleY;

            return (
              <line
                key={`block-${player.position}-${index}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#F97316"
                strokeWidth={2}
                markerEnd="url(#mini-arrowhead-orange)"
              />
            );
          })}

        {/* Coverage zones - for defensive players in zone coverage */}
        {isDefense && mainPlayers
          .filter(p =>
            !isDefensiveLineman(p.position) &&
            p.coverageRole &&
            !p.blitzGap &&
            p.coverageRole !== 'Man'
          )
          .map((player, index) => {
            const startX = player.x * scaleX;
            const startY = player.y * scaleY;

            // Use saved zoneEndpoint or calculate default
            const defaultDepth = 30;
            const endpoint = player.zoneEndpoint || { x: player.x, y: player.y - defaultDepth };
            const endX = endpoint.x * scaleX;
            const endY = endpoint.y * scaleY;

            const isDeep = DEEP_COVERAGE_ROLES.includes(player.coverageRole || '');
            const zoneColor = isDeep ? DEEP_ZONE_COLOR : SHALLOW_ZONE_COLOR;

            // Calculate ellipse size (scaled down)
            const zoneWidth = Math.max(Math.abs(endX - startX) / 2, 15 * scaleX);
            const zoneHeight = Math.max(Math.abs(endY - startY) / 2, 10 * scaleY);

            return (
              <g key={`zone-${player.position}-${index}`}>
                {/* Line from player to zone */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={zoneColor}
                  strokeWidth={1}
                  opacity={0.7}
                />
                {/* Zone ellipse */}
                <ellipse
                  cx={endX}
                  cy={endY}
                  rx={zoneWidth}
                  ry={zoneHeight}
                  fill={zoneColor}
                  opacity={0.2}
                  stroke={zoneColor}
                  strokeWidth={1}
                  strokeDasharray="2,1"
                />
              </g>
            );
          })}

        {/* Blitz arrows - for players with blitz assignments */}
        {isDefense && mainPlayers
          .filter(p => p.blitzGap)
          .map((player, index) => {
            const startX = player.x * scaleX;
            const startY = player.y * scaleY;

            // Use saved zoneEndpoint or calculate gap position
            const gapPos = player.zoneEndpoint || getGapPositionFromName(player.blitzGap || '', FIELD_CONFIG.CENTER_X);
            const endX = gapPos.x * scaleX;
            const endY = gapPos.y * scaleY;

            return (
              <line
                key={`blitz-${player.position}-${index}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#DC2626"
                strokeWidth={2}
                markerEnd="url(#mini-arrowhead-blitz)"
              />
            );
          })}

        {/* Special teams path arrows */}
        {mainPlayers
          .filter(p => p.specialTeamsPath)
          .map((player, index) => {
            const startX = player.x * scaleX;
            const startY = player.y * scaleY;
            const endX = (player.specialTeamsPath?.x ?? player.x) * scaleX;
            const endY = (player.specialTeamsPath?.y ?? player.y) * scaleY;

            return (
              <line
                key={`st-path-${player.position}-${index}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#22C55E"
                strokeWidth={2}
                markerEnd="url(#mini-arrowhead-st)"
              />
            );
          })}

        {/* Ball carrier run path - red */}
        {ballCarrierPath && (
          <path
            d={ballCarrierPath}
            fill="none"
            stroke="#FF0000"
            strokeWidth={2.5}
            markerEnd="url(#mini-arrowhead-red)"
          />
        )}

        {/* Pass routes with arrowheads */}
        {sortedRoutes.map(route => {
          const pathD = buildRoutePath(route);
          if (!pathD) return null;

          const color = getRouteColor(route);
          const markerId = route.isPrimary ? 'mini-arrowhead-red' : 'mini-arrowhead-gold';
          const strokeWidth = route.isPrimary ? 2.5 : 2;

          return (
            <path
              key={route.id}
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}

        {/* Players - rendered last to be on top */}
        {mainPlayers.map((player, index) => {
          // If player has motion, render at motion endpoint
          const x = (player.motionEndpoint?.x ?? player.x) * scaleX;
          const y = (player.motionEndpoint?.y ?? player.y) * scaleY;
          const color = getPlayerColor(player);
          const isBallCarrier = attributes?.ballCarrier === player.label;
          const isPrimary = player.isPrimary || isBallCarrier;
          const radius = isPrimary ? 4 : 3;

          // Determine player shape based on position
          const renderPlayerShape = () => {
            if (isOffense) {
              // Offense: circles
              return (
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={isPrimary ? 1 : 0.5}
                />
              );
            } else if (isDefensiveLineman(player.position)) {
              // Defensive Linemen: squares
              const size = radius * 2;
              return (
                <rect
                  x={x - radius}
                  y={y - radius}
                  width={size}
                  height={size}
                  fill="#FFFFFF"
                  stroke="#000000"
                  strokeWidth={0.5}
                />
              );
            } else if (isLinebacker(player.position)) {
              // Linebackers: circles (white)
              return (
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="#FFFFFF"
                  stroke="#000000"
                  strokeWidth={0.5}
                />
              );
            } else {
              // DBs (Safeties/Cornerbacks): X shape
              const xSize = radius * 0.8;
              return (
                <>
                  <line
                    x1={x - xSize}
                    y1={y - xSize}
                    x2={x + xSize}
                    y2={y + xSize}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={x - xSize}
                    y1={y + xSize}
                    x2={x + xSize}
                    y2={y - xSize}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                </>
              );
            }
          };

          return (
            <g key={`${player.position}-${index}`}>
              {renderPlayerShape()}
              {/* Show player label for key positions */}
              {(player.label === 'QB' || player.label === 'RB' || player.label === 'FB' || isBallCarrier) && (
                <text
                  x={x}
                  y={y + 8}
                  fontSize="6"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {player.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
