import { FIELD_CONFIG } from '../fieldConstants';

interface Point {
  x: number;
  y: number;
}

export interface RouteAnalysis {
  suggestedRoute: string;
  confidence: 'high' | 'medium' | 'low';
  characteristics: {
    totalDistance: number;
    netVertical: number;
    netHorizontal: number;
    direction: 'upfield' | 'downfield' | 'lateral';
    curvature: 'straight' | 'breaking' | 'curved';
    endDirection: 'inside' | 'outside' | 'vertical' | 'back';
  };
}

/**
 * Calculate the total distance of a path
 */
function calculatePathDistance(points: Point[]): number {
  if (points.length < 2) return 0;

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    distance += Math.sqrt(dx * dx + dy * dy);
  }
  return distance;
}

/**
 * Determine if a point is on the left or right side of the field
 */
function getFieldSide(x: number): 'left' | 'center' | 'right' {
  if (x < FIELD_CONFIG.CENTER_X - 50) return 'left';
  if (x > FIELD_CONFIG.CENTER_X + 50) return 'right';
  return 'center';
}

/**
 * Calculate the angle of a segment in degrees (0 = right, 90 = up, -90 = down)
 */
function calculateAngle(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.atan2(-dy, dx) * (180 / Math.PI); // Negative dy because SVG y increases downward
}

/**
 * Detect route type from drawn path using heuristics
 *
 * Route detection is based on:
 * - Net vertical movement (upfield vs downfield)
 * - Net horizontal movement (inside vs outside)
 * - Path shape (straight vs breaking)
 * - Final direction of movement
 */
export function detectRouteType(
  path: Point[],
  playerSide: 'offense' | 'defense',
  playerStartX: number
): RouteAnalysis {
  if (path.length < 2) {
    return {
      suggestedRoute: 'Draw Route (Custom)',
      confidence: 'low',
      characteristics: {
        totalDistance: 0,
        netVertical: 0,
        netHorizontal: 0,
        direction: 'upfield',
        curvature: 'straight',
        endDirection: 'vertical',
      },
    };
  }

  const start = path[0];
  const end = path[path.length - 1];
  const totalDistance = calculatePathDistance(path);

  // Net movement (negative Y = upfield for offense)
  const netVertical = start.y - end.y; // Positive = upfield
  const netHorizontal = end.x - start.x; // Positive = right

  // Determine if moving inside or outside based on player's starting position
  const fieldSide = getFieldSide(playerStartX);
  const isMovingInside =
    (fieldSide === 'left' && netHorizontal > 0) ||
    (fieldSide === 'right' && netHorizontal < 0) ||
    (fieldSide === 'center' && Math.abs(netHorizontal) < 20);

  // Analyze path curvature - check if there's a significant direction change
  let hasMajorBreak = false;
  let breakIndex = -1;

  if (path.length >= 3) {
    for (let i = 1; i < path.length - 1; i++) {
      const angle1 = calculateAngle(path[i - 1], path[i]);
      const angle2 = calculateAngle(path[i], path[i + 1]);
      const angleDiff = Math.abs(angle1 - angle2);

      // A break of more than 30 degrees is significant
      if (angleDiff > 30 && angleDiff < 330) {
        hasMajorBreak = true;
        breakIndex = i;
        break;
      }
    }
  }

  // Determine final direction
  let endDirection: 'inside' | 'outside' | 'vertical' | 'back';
  if (path.length >= 2) {
    const finalSegmentStart = path[Math.max(0, path.length - 3)];
    const finalAngle = calculateAngle(finalSegmentStart, end);

    // Check if coming back towards LOS
    if (netVertical < 0) {
      endDirection = 'back';
    } else if (Math.abs(finalAngle) > 60 && Math.abs(finalAngle) < 120) {
      endDirection = 'vertical';
    } else if (isMovingInside) {
      endDirection = 'inside';
    } else {
      endDirection = 'outside';
    }
  } else {
    endDirection = 'vertical';
  }

  // Determine overall direction
  const direction: 'upfield' | 'downfield' | 'lateral' =
    Math.abs(netVertical) > Math.abs(netHorizontal) * 0.5
      ? (netVertical > 0 ? 'upfield' : 'downfield')
      : 'lateral';

  const curvature: 'straight' | 'breaking' | 'curved' =
    hasMajorBreak ? 'breaking' :
    (path.length > 4 ? 'curved' : 'straight');

  const characteristics = {
    totalDistance,
    netVertical,
    netHorizontal,
    direction,
    curvature,
    endDirection,
  };

  // Route detection logic
  let suggestedRoute = 'Draw Route (Custom)';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  const isShort = totalDistance < 80;
  const isMedium = totalDistance >= 80 && totalDistance < 150;
  const isDeep = totalDistance >= 150;

  // Go/Streak: Long, straight, vertical
  if (isDeep && direction === 'upfield' && !hasMajorBreak && Math.abs(netHorizontal) < 40) {
    suggestedRoute = 'Go/Streak/9';
    confidence = 'high';
  }
  // Post: Deep, breaks inside
  else if (isDeep && hasMajorBreak && endDirection === 'inside') {
    suggestedRoute = 'Post';
    confidence = 'high';
  }
  // Corner: Deep, breaks outside
  else if (isDeep && hasMajorBreak && endDirection === 'outside') {
    suggestedRoute = 'Corner';
    confidence = 'high';
  }
  // Seam: Medium-deep, straight up the hash
  else if ((isMedium || isDeep) && direction === 'upfield' && !hasMajorBreak) {
    suggestedRoute = 'Seam';
    confidence = 'medium';
  }
  // Out: Medium, breaks outside horizontally
  else if (isMedium && hasMajorBreak && endDirection === 'outside' && direction !== 'downfield') {
    suggestedRoute = 'Out';
    confidence = 'high';
  }
  // In/Dig: Medium, breaks inside horizontally
  else if (isMedium && hasMajorBreak && endDirection === 'inside') {
    suggestedRoute = 'In/Dig';
    confidence = 'high';
  }
  // Curl/Comeback: Goes upfield then comes back
  else if (endDirection === 'back' || (hasMajorBreak && netVertical < 20 && netVertical > -20)) {
    suggestedRoute = isMedium ? 'Comeback' : 'Curl';
    confidence = 'medium';
  }
  // Slant: Short-medium, diagonal inside from start
  else if ((isShort || isMedium) && isMovingInside && !hasMajorBreak && netVertical > 20) {
    suggestedRoute = 'Slant';
    confidence = 'high';
  }
  // Hitch: Short, straight then stop
  else if (isShort && direction === 'upfield' && !hasMajorBreak) {
    suggestedRoute = 'Hitch';
    confidence = 'medium';
  }
  // Flat: Short horizontal route
  else if (isShort && direction === 'lateral') {
    suggestedRoute = 'Flat';
    confidence = 'high';
  }
  // Swing: Short curved route to the flat (typically for RBs)
  else if (isShort && curvature === 'curved') {
    suggestedRoute = 'Swing';
    confidence = 'medium';
  }
  // Wheel: Starts outside then turns upfield
  else if (isMedium && hasMajorBreak && endDirection === 'vertical') {
    suggestedRoute = 'Wheel';
    confidence = 'medium';
  }
  // Shallow Cross: Medium distance, mostly horizontal
  else if (isMedium && direction === 'lateral' && isMovingInside) {
    suggestedRoute = 'Shallow Cross';
    confidence = 'medium';
  }
  // Deep Cross: Deep horizontal
  else if (isDeep && direction === 'lateral') {
    suggestedRoute = 'Deep Cross';
    confidence = 'low';
  }
  // Default to custom if nothing else matches
  else {
    suggestedRoute = 'Draw Route (Custom)';
    confidence = 'low';
  }

  return {
    suggestedRoute,
    confidence,
    characteristics,
  };
}

/**
 * Get route options filtered by relevance to the drawn path
 * Returns suggested route first, then other common options
 */
export function getRouteOptions(analysis: RouteAnalysis): string[] {
  const { suggestedRoute, characteristics } = analysis;

  // Start with suggested route
  const options = [suggestedRoute];

  // Add contextually relevant alternatives
  if (characteristics.direction === 'upfield' && characteristics.totalDistance > 100) {
    // Deep routes
    if (!options.includes('Go/Streak/9')) options.push('Go/Streak/9');
    if (!options.includes('Post')) options.push('Post');
    if (!options.includes('Corner')) options.push('Corner');
    if (!options.includes('Seam')) options.push('Seam');
  } else if (characteristics.curvature === 'breaking') {
    // Breaking routes
    if (!options.includes('Out')) options.push('Out');
    if (!options.includes('In/Dig')) options.push('In/Dig');
    if (!options.includes('Curl')) options.push('Curl');
    if (!options.includes('Comeback')) options.push('Comeback');
  } else {
    // Short/quick routes
    if (!options.includes('Slant')) options.push('Slant');
    if (!options.includes('Hitch')) options.push('Hitch');
    if (!options.includes('Flat')) options.push('Flat');
    if (!options.includes('Swing')) options.push('Swing');
  }

  // Always include custom as last option
  if (!options.includes('Draw Route (Custom)')) {
    options.push('Draw Route (Custom)');
  }

  return options;
}

/**
 * Detect blocking assignment from drawn path
 */
export function detectBlockingType(path: Point[]): {
  suggestedType: 'Run Block' | 'Pass Block' | 'Pull';
  confidence: 'high' | 'medium' | 'low';
} {
  if (path.length < 2) {
    return { suggestedType: 'Pass Block', confidence: 'low' };
  }

  const start = path[0];
  const end = path[path.length - 1];
  const distance = calculatePathDistance(path);
  const netHorizontal = Math.abs(end.x - start.x);

  // Pull: Long horizontal movement
  if (netHorizontal > 60 && distance > 80) {
    return { suggestedType: 'Pull', confidence: 'high' };
  }

  // Run Block: Short forward movement
  if (distance < 50) {
    return { suggestedType: 'Run Block', confidence: 'medium' };
  }

  // Pass Block: Default for medium distance
  return { suggestedType: 'Pass Block', confidence: 'medium' };
}
