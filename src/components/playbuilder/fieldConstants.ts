/**
 * SVG football field dimensions and layout constants
 * All measurements in pixels
 */
export const FIELD_CONFIG = {
  WIDTH: 700,              // Total canvas width
  HEIGHT: 400,             // Total canvas height
  CENTER_X: 350,           // Horizontal center point
  LINE_OF_SCRIMMAGE: 200,  // Y-coordinate of LOS (horizontal center)
  HASH_LEFT: 250,          // Left hash mark X position
  HASH_RIGHT: 450,         // Right hash mark X position
  PLAYER_RADIUS: 12,       // Circle radius for player icons
  NEUTRAL_ZONE_BUFFER: 6,  // Neutral zone width (3px each side of LOS)
  YARD_LINE_SPACING: 40    // Distance between yard line markers
} as const;

/**
 * Quick Draw mode tool definitions
 * Each tool maps to a specific player assignment type
 */
export type QuickDrawToolId =
  | 'select'    // Select/move players
  | 'route'     // Draw pass routes (offense)
  | 'block'     // Draw blocking assignments
  | 'motion'    // Draw pre-snap motion paths
  | 'coverage'  // Draw coverage zones (defense)
  | 'blitz'     // Draw blitz paths (defense)
  | 'eraser';   // Remove routes/assignments

export interface QuickDrawTool {
  id: QuickDrawToolId;
  label: string;
  icon: string;        // Lucide icon name
  description: string;
  side: 'offense' | 'defense' | 'both';
}

export const QUICK_DRAW_TOOLS: QuickDrawTool[] = [
  { id: 'select', label: 'Select', icon: 'MousePointer2', description: 'Select and move players', side: 'both' },
  { id: 'route', label: 'Route', icon: 'TrendingUp', description: 'Draw pass routes', side: 'offense' },
  { id: 'block', label: 'Block', icon: 'Shield', description: 'Draw blocking assignments', side: 'offense' },
  { id: 'motion', label: 'Motion', icon: 'MoveHorizontal', description: 'Draw pre-snap motion', side: 'offense' },
  { id: 'coverage', label: 'Coverage', icon: 'Circle', description: 'Draw coverage zones', side: 'defense' },
  { id: 'blitz', label: 'Blitz', icon: 'Zap', description: 'Draw blitz paths', side: 'defense' },
  { id: 'eraser', label: 'Eraser', icon: 'Eraser', description: 'Remove assignments', side: 'both' },
] as const;
