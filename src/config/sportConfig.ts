/**
 * Sport Configuration Router
 *
 * Returns the correct sport-specific configuration based on a team's sport value.
 * Currently only football is supported. Adding a second sport (basketball) requires:
 *   1. Create the sport-specific config file (e.g., basketballConfig.ts)
 *   2. Add it to SPORT_CONFIGS below
 *   3. Add the sport to the teams_sport_check constraint in a migration
 *   4. Update components that import directly from footballConfig to use this router
 *
 * The 32 files that currently import from footballConfig directly will be migrated
 * to use this router when sport 2 is built. For now, football-only code continues
 * to import footballConfig directly — that is correct and expected.
 */

import { FOOTBALL_CONFIG } from './footballConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported sports — matches the CHECK constraint on teams.sport */
export type Sport = 'football';
// TODO: MULTI-SPORT — add 'basketball' here when ready

/** Sport metadata for UI display */
export interface SportMeta {
  id: Sport;
  label: string;
  icon: string;         // Emoji for quick identification in UI
  enabled: boolean;     // false = "Coming Soon" in team creation
  comingSoon?: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Master config lookup. Each sport's config object follows its own shape —
 * football has formations, routes, coverages; basketball would have plays,
 * positions, court zones. The router returns the raw config; consumers cast
 * to the expected type for their sport.
 */
const SPORT_CONFIGS: Record<Sport, unknown> = {
  football: FOOTBALL_CONFIG,
  // TODO: MULTI-SPORT — add basketball: BASKETBALL_CONFIG here
};

/**
 * Sport metadata for UI — includes coming-soon sports that aren't playable yet.
 * Order determines display order in team creation selector.
 */
export const SPORT_OPTIONS: SportMeta[] = [
  { id: 'football', label: 'Football', icon: '🏈', enabled: true },
  // Coming soon — shown in UI but disabled
  // { id: 'basketball', label: 'Basketball', icon: '🏀', enabled: false, comingSoon: true },
];

/** Only sports that are fully enabled */
export const SUPPORTED_SPORTS: Sport[] = SPORT_OPTIONS
  .filter(s => s.enabled)
  .map(s => s.id);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the sport-specific configuration for a team.
 * Returns the raw config object — caller should cast to the expected type.
 *
 * @param sport - The sport value from teams.sport
 * @returns The sport's configuration object
 * @throws If the sport is not supported
 */
export function getSportConfig(sport: Sport): unknown {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`Unsupported sport: ${sport}. Supported: ${SUPPORTED_SPORTS.join(', ')}`);
  }
  return config;
}

/**
 * Get the display label for a sport.
 */
export function getSportLabel(sport: Sport): string {
  const meta = SPORT_OPTIONS.find(s => s.id === sport);
  return meta?.label ?? sport;
}

/**
 * Check if a sport value is supported.
 */
export function isSupportedSport(value: string): value is Sport {
  return SUPPORTED_SPORTS.includes(value as Sport);
}
