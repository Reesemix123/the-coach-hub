import { useCallback } from 'react';
import { FIELD_CONFIG } from '../fieldConstants';

interface Point {
  x: number;
  y: number;
}

/**
 * Hook to convert mouse/touch events to SVG coordinate space
 * Handles the transformation from screen coordinates to SVG viewBox coordinates
 */
export function useSVGCoordinates() {
  /**
   * Convert a mouse event to SVG coordinates
   */
  const getPointFromMouseEvent = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): Point => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();

      return {
        x: ((e.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT,
      };
    },
    []
  );

  /**
   * Convert a touch event to SVG coordinates
   * Uses the first touch point
   */
  const getPointFromTouchEvent = useCallback(
    (e: React.TouchEvent<SVGSVGElement>): Point | null => {
      if (e.touches.length === 0) return null;

      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const touch = e.touches[0];

      return {
        x: ((touch.clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH,
        y: ((touch.clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT,
      };
    },
    []
  );

  /**
   * Convert raw client coordinates to SVG coordinates
   * Useful when you have clientX/clientY but not the full event
   */
  const getPointFromClientCoords = useCallback(
    (clientX: number, clientY: number, svgElement: SVGSVGElement): Point => {
      const rect = svgElement.getBoundingClientRect();

      return {
        x: ((clientX - rect.left) / rect.width) * FIELD_CONFIG.WIDTH,
        y: ((clientY - rect.top) / rect.height) * FIELD_CONFIG.HEIGHT,
      };
    },
    []
  );

  /**
   * Check if a point is within the field bounds
   */
  const isPointInBounds = useCallback((point: Point): boolean => {
    return (
      point.x >= 0 &&
      point.x <= FIELD_CONFIG.WIDTH &&
      point.y >= 0 &&
      point.y <= FIELD_CONFIG.HEIGHT
    );
  }, []);

  /**
   * Clamp a point to field bounds
   */
  const clampToBounds = useCallback((point: Point): Point => {
    return {
      x: Math.max(0, Math.min(FIELD_CONFIG.WIDTH, point.x)),
      y: Math.max(0, Math.min(FIELD_CONFIG.HEIGHT, point.y)),
    };
  }, []);

  return {
    getPointFromMouseEvent,
    getPointFromTouchEvent,
    getPointFromClientCoords,
    isPointInBounds,
    clampToBounds,
  };
}
