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
