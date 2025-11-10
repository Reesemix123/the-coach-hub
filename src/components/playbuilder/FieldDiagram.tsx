'use client';

import { useRef, useCallback } from 'react';
import Tooltip from '@/components/Tooltip';
import { POSITION_GROUPS, isDefensiveLineman } from '@/config/footballConfig';
import { FIELD_CONFIG } from './fieldConstants';

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
  currentRoute: Array<{ x: number; y: number }>;
  playType: string;
  targetHole: string;
  ballCarrier: string;
  onMouseDown: (playerId: string, isMotionEndpoint?: boolean, isBlockDirection?: boolean, isZoneEndpoint?: boolean) => void;
  onTouchStart: (playerId: string, isMotionEndpoint?: boolean, isBlockDirection?: boolean, isZoneEndpoint?: boolean) => void;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchEnd: () => void;
  onFieldClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onFieldDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}

export default function FieldDiagram({
  players,
  routes,
  dummyOffensePlayers,
  dummyDefensePlayers,
  dummyOffenseFormation,
  dummyDefenseFormation,
  isDrawingRoute,
  currentRoute,
  playType,
  targetHole,
  ballCarrier,
  onMouseDown,
  onTouchStart,
  onMouseMove,
  onMouseUp,
  onTouchMove,
  onTouchEnd,
  onFieldClick,
  onFieldDoubleClick
}: FieldDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

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
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#4F46E5" />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="#4F46E5"
          strokeWidth="2"
          strokeDasharray="5,5"
          markerEnd={`url(#motion-arrow-${player.id})`}
        />
        <circle
          cx={endX}
          cy={endY}
          r="6"
          fill="#4F46E5"
          stroke="#ffffff"
          strokeWidth="2"
          className="cursor-move"
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown(player.id, true, false, false);
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
          viewBox={`0 0 ${FIELD_CONFIG.WIDTH} ${FIELD_CONFIG.HEIGHT}`}
          className="w-full h-auto bg-green-100"
          style={{ touchAction: 'none' }}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={onFieldClick}
          onDoubleClick={onFieldDoubleClick}
          role="application"
          aria-label="Football play diagram - drag players to reposition"
        >
          <rect width={FIELD_CONFIG.WIDTH} height={FIELD_CONFIG.HEIGHT} fill="#2a6e3f" />
          
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

          <line x1={FIELD_CONFIG.HASH_LEFT} y1="0" x2={FIELD_CONFIG.HASH_LEFT} y2={FIELD_CONFIG.HEIGHT} stroke="white" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />
          <line x1={FIELD_CONFIG.HASH_RIGHT} y1="0" x2={FIELD_CONFIG.HASH_RIGHT} y2={FIELD_CONFIG.HEIGHT} stroke="white" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />

          <line x1="0" y1={FIELD_CONFIG.LINE_OF_SCRIMMAGE} x2={FIELD_CONFIG.WIDTH} y2={FIELD_CONFIG.LINE_OF_SCRIMMAGE} stroke="white" strokeWidth="3" />

          {/* Dummy Offense (for defensive plays) */}
          {dummyOffensePlayers.map(player => (
            <g key={player.id}>
              <circle
                cx={player.x}
                cy={player.y}
                r={FIELD_CONFIG.PLAYER_RADIUS}
                fill="#DC2626"
                fillOpacity={0.4}
                stroke="black"
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
                  >
                    {player.label}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Routes */}
          {routes.map(route => renderPassRoute(route))}

          {/* Ball carrier arrows, blocking arrows, motion arrows */}
          {players.map(player => (
            <g key={`arrows-${player.id}`}>
              {renderBallCarrierArrow(player)}
              {renderBlockingArrow(player)}
              {renderMotionArrow(player)}
            </g>
          ))}

          {/* Real players */}
          {players.map(player => (
            <g key={player.id}>
              {player.side === 'offense' ? (
                <circle
                  cx={player.x}
                  cy={player.y}
                  r={FIELD_CONFIG.PLAYER_RADIUS}
                  fill={player.isPrimary ? '#DC2626' : '#DC2626'}
                  stroke={player.isPrimary ? '#FBBF24' : 'black'}
                  strokeWidth={player.isPrimary ? 3 : 2}
                  className="cursor-move"
                  onMouseDown={() => onMouseDown(player.id)}
                  onTouchStart={() => onTouchStart(player.id)}
                />
              ) : isDefensiveLineman(player.position) ? (
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
                y={player.y + (player.side === 'defense' && !isDefensiveLineman(player.position) ? 20 : 5)}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={player.side === 'offense' ? 'white' : 'black'}
              >
                {player.label}
              </text>
            </g>
          ))}

          {/* Current route being drawn */}
          {isDrawingRoute && currentRoute.length > 0 && (
            <g>
              <path
                d={`M ${currentRoute.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}`}
                fill="none"
                stroke="#FFD700"
                strokeWidth="2.5"
                strokeDasharray="5,5"
              />
              {currentRoute.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="#FFD700"
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
