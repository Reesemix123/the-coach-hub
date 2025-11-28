// src/config/playbookCategories.ts
// Configuration for Madden-style playbook organization
// Multi-level hierarchical categories for plays

import { PlaybookPlay } from '@/types/football';

// ============================================
// TOP LEVEL: ODK (Offense/Defense/Special Teams)
// ============================================

export const ODK_CATEGORIES = [
  { value: 'offense', label: 'Offense' },
  { value: 'defense', label: 'Defense' },
  { value: 'specialTeams', label: 'Special Teams' }
] as const;

// ============================================
// OFFENSE CATEGORIES
// ============================================

export const OFFENSE_CATEGORIES = {
  // Primary categories (by play type)
  'Pass': {
    label: 'Pass',
    subcategories: {
      'Quick': {
        label: 'Quick Game',
        passConcepts: ['Stick', 'Slant', 'Spacing', 'Shallow Cross']
      },
      'Medium': {
        label: 'Medium',
        passConcepts: ['Levels', 'Mesh', 'Drive', 'Follow', 'China']
      },
      'Deep': {
        label: 'Deep',
        passConcepts: ['Four Verticals', 'Post-Wheel', 'Corner', 'Smash']
      },
      'Flood': {
        label: 'Flood/Sail',
        passConcepts: ['Flood', 'Sail']
      }
    }
  },
  'Run': {
    label: 'Run',
    subcategories: {
      'Inside': {
        label: 'Inside',
        runConcepts: ['Inside Zone', 'Iso', 'Dive', 'Trap', 'QB Sneak']
      },
      'Outside': {
        label: 'Outside',
        runConcepts: ['Outside Zone', 'Sweep', 'Toss', 'Stretch']
      },
      'Gap/Power': {
        label: 'Gap/Power',
        runConcepts: ['Power', 'Counter', 'Lead', 'QB Power', 'QB Counter']
      },
      'Option': {
        label: 'Option',
        runConcepts: ['Read Option', 'Speed Option', 'Triple Option']
      }
    }
  },
  'RPO': {
    label: 'RPO',
    subcategories: null // No subcategories, just filter by playType
  },
  'Screen': {
    label: 'Screen',
    subcategories: null
  },
  'Play Action': {
    label: 'Play Action',
    subcategories: null
  },
  'Draw': {
    label: 'Draw',
    subcategories: null
  }
} as const;

// Formation families for "By Formation" view
export const OFFENSE_FORMATIONS = {
  'Shotgun': {
    label: 'Shotgun',
    formations: ['Shotgun Spread', 'Gun Trips Right', 'Gun Trips Left', 'Gun Empty', 'Gun Doubles']
  },
  'I-Form': {
    label: 'I-Form',
    formations: ['I-Formation', 'Power I']
  },
  'Singleback': {
    label: 'Singleback',
    formations: ['Singleback']
  },
  'Pro Set': {
    label: 'Pro Set',
    formations: ['Pro Set']
  },
  'Pistol': {
    label: 'Pistol',
    formations: ['Pistol']
  },
  'Wing-T': {
    label: 'Wing-T',
    formations: ['Wing-T']
  },
  'Option': {
    label: 'Option',
    formations: ['Wishbone', 'Flexbone']
  }
} as const;

// ============================================
// DEFENSE CATEGORIES
// ============================================

export const DEFENSE_CATEGORIES = {
  'Zone': {
    label: 'Zone Coverage',
    subcategories: {
      'Cover 2': {
        label: 'Cover 2',
        coverages: ['Cover 2', 'Tampa 2']
      },
      'Cover 3': {
        label: 'Cover 3',
        coverages: ['Cover 3']
      },
      'Cover 4': {
        label: 'Cover 4',
        coverages: ['Cover 4 (Quarters)', 'Palms']
      },
      'Cover 6': {
        label: 'Cover 6',
        coverages: ['Cover 6']
      }
    }
  },
  'Man': {
    label: 'Man Coverage',
    subcategories: {
      'Cover 0': {
        label: 'Cover 0 (No Safety)',
        coverages: ['Cover 0 (Man)']
      },
      'Cover 1': {
        label: 'Cover 1 (Man Free)',
        coverages: ['Cover 1 (Man Free)']
      },
      '2-Man': {
        label: '2-Man Under',
        coverages: ['2-Man Under']
      }
    }
  },
  'Blitz': {
    label: 'Blitz',
    subcategories: {
      'Inside': {
        label: 'Inside Blitz',
        blitzTypes: ['Inside Blitz', 'Double A-Gap']
      },
      'Outside': {
        label: 'Outside Blitz',
        blitzTypes: ['Outside Blitz', 'Overload']
      },
      'DB': {
        label: 'DB Blitz',
        blitzTypes: ['Corner Blitz', 'Safety Blitz']
      },
      'Fire Zone': {
        label: 'Fire Zone',
        blitzTypes: ['Fire Zone']
      }
    }
  }
} as const;

// Defense fronts for "By Front" view
export const DEFENSE_FRONTS = {
  '4-3': {
    label: '4-3',
    formations: ['4-3 Base', '4-3 Over', '4-3 Under']
  },
  '3-4': {
    label: '3-4',
    formations: ['3-4 Base']
  },
  'Nickel': {
    label: 'Nickel',
    formations: ['4-2-5', 'Nickel']
  },
  '4-4': {
    label: '4-4',
    formations: ['4-4']
  },
  '5-3': {
    label: '5-3',
    formations: ['5-3']
  },
  '6-2': {
    label: '6-2',
    formations: ['6-2']
  }
} as const;

// ============================================
// SPECIAL TEAMS CATEGORIES
// ============================================

export const SPECIAL_TEAMS_CATEGORIES = {
  'Kickoff': { label: 'Kickoff' },
  'Kick Return': { label: 'Kick Return' },
  'Punt': { label: 'Punt' },
  'Punt Return': { label: 'Punt Return' },
  'Field Goal': { label: 'Field Goal' },
  'PAT': { label: 'PAT' }
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export type ODKType = 'offense' | 'defense' | 'specialTeams';
export type CategoryPath = {
  odk: ODKType | null;
  category: string | null;
  subcategory: string | null;
  viewMode: 'playType' | 'formation'; // Toggle between play type and formation view
};

/**
 * Check if a play matches a pass concept subcategory
 */
function matchesPassConcept(play: PlaybookPlay, concepts: readonly string[]): boolean {
  const passConcept = play.attributes?.passConcept;
  if (!passConcept) return false;
  return concepts.some(c => passConcept.toLowerCase().includes(c.toLowerCase()));
}

/**
 * Check if a play matches a run concept subcategory
 */
function matchesRunConcept(play: PlaybookPlay, concepts: readonly string[]): boolean {
  const runConcept = play.attributes?.runConcept;
  if (!runConcept) return false;
  return concepts.some(c => runConcept.toLowerCase().includes(c.toLowerCase()));
}

/**
 * Check if a play matches a coverage subcategory
 */
function matchesCoverage(play: PlaybookPlay, coverages: readonly string[]): boolean {
  const coverage = play.attributes?.coverage;
  if (!coverage) return false;
  return coverages.some(c => coverage.toLowerCase().includes(c.toLowerCase()));
}

/**
 * Check if a play matches a blitz type subcategory
 */
function matchesBlitzType(play: PlaybookPlay, blitzTypes: readonly string[]): boolean {
  const blitzType = play.attributes?.blitzType;
  if (!blitzType || blitzType === 'None') return false;
  return blitzTypes.some(b => blitzType.toLowerCase().includes(b.toLowerCase()));
}

/**
 * Check if a play matches a formation family
 */
function matchesFormationFamily(play: PlaybookPlay, formations: readonly string[]): boolean {
  const formation = play.attributes?.formation;
  if (!formation) return false;
  return formations.some(f =>
    formation.toLowerCase().includes(f.toLowerCase()) ||
    f.toLowerCase().includes(formation.toLowerCase())
  );
}

/**
 * Filter plays by category path
 */
export function filterPlaysByCategory(
  plays: PlaybookPlay[],
  path: CategoryPath
): PlaybookPlay[] {
  let filtered = [...plays];

  // Filter by ODK first
  if (path.odk) {
    filtered = filtered.filter(p => p.attributes?.odk === path.odk);
  }

  if (!path.category) {
    return filtered;
  }

  // OFFENSE filtering
  if (path.odk === 'offense') {
    if (path.viewMode === 'formation') {
      // Formation-based filtering
      const formationConfig = OFFENSE_FORMATIONS[path.category as keyof typeof OFFENSE_FORMATIONS];
      if (formationConfig) {
        filtered = filtered.filter(p => matchesFormationFamily(p, formationConfig.formations));
      }
    } else {
      // Play type-based filtering
      const categoryConfig = OFFENSE_CATEGORIES[path.category as keyof typeof OFFENSE_CATEGORIES];

      if (categoryConfig) {
        // First filter by play type
        filtered = filtered.filter(p => p.attributes?.playType === path.category);

        // Then filter by subcategory if specified
        if (path.subcategory && categoryConfig.subcategories) {
          const subConfig = categoryConfig.subcategories[path.subcategory as keyof typeof categoryConfig.subcategories];
          if (subConfig) {
            if ('passConcepts' in subConfig) {
              filtered = filtered.filter(p => matchesPassConcept(p, subConfig.passConcepts));
            } else if ('runConcepts' in subConfig) {
              filtered = filtered.filter(p => matchesRunConcept(p, subConfig.runConcepts));
            }
          }
        }
      }
    }
  }

  // DEFENSE filtering
  if (path.odk === 'defense') {
    if (path.viewMode === 'formation') {
      // Front-based filtering
      const frontConfig = DEFENSE_FRONTS[path.category as keyof typeof DEFENSE_FRONTS];
      if (frontConfig) {
        filtered = filtered.filter(p => matchesFormationFamily(p, frontConfig.formations));
      }
    } else {
      // Coverage/Blitz-based filtering
      const categoryConfig = DEFENSE_CATEGORIES[path.category as keyof typeof DEFENSE_CATEGORIES];

      if (categoryConfig) {
        if (path.category === 'Zone' || path.category === 'Man') {
          // Coverage filtering
          if (path.subcategory && categoryConfig.subcategories) {
            const subConfig = categoryConfig.subcategories[path.subcategory as keyof typeof categoryConfig.subcategories];
            if (subConfig && 'coverages' in subConfig) {
              filtered = filtered.filter(p => matchesCoverage(p, subConfig.coverages));
            }
          } else {
            // Filter by category type (Zone or Man)
            if (path.category === 'Zone') {
              filtered = filtered.filter(p => {
                const coverage = p.attributes?.coverage?.toLowerCase() || '';
                return coverage.includes('cover 2') || coverage.includes('cover 3') ||
                       coverage.includes('cover 4') || coverage.includes('cover 6') ||
                       coverage.includes('tampa') || coverage.includes('palms');
              });
            } else if (path.category === 'Man') {
              filtered = filtered.filter(p => {
                const coverage = p.attributes?.coverage?.toLowerCase() || '';
                return coverage.includes('man') || coverage.includes('cover 0') || coverage.includes('cover 1');
              });
            }
          }
        } else if (path.category === 'Blitz') {
          // Blitz filtering - any play with a blitz type
          filtered = filtered.filter(p =>
            p.attributes?.blitzType && p.attributes.blitzType !== 'None'
          );

          if (path.subcategory && categoryConfig.subcategories) {
            const subConfig = categoryConfig.subcategories[path.subcategory as keyof typeof categoryConfig.subcategories];
            if (subConfig && 'blitzTypes' in subConfig) {
              filtered = filtered.filter(p => matchesBlitzType(p, subConfig.blitzTypes));
            }
          }
        }
      }
    }
  }

  // SPECIAL TEAMS filtering
  if (path.odk === 'specialTeams' && path.category) {
    filtered = filtered.filter(p => p.attributes?.unit === path.category);
  }

  return filtered;
}

/**
 * Count plays for each category/subcategory
 */
export interface CategoryCount {
  key: string;
  label: string;
  count: number;
  subcategories?: CategoryCount[];
}

export function getOffenseCategoryCounts(plays: PlaybookPlay[]): CategoryCount[] {
  const offensePlays = plays.filter(p => p.attributes?.odk === 'offense');
  const counts: CategoryCount[] = [];

  for (const [key, config] of Object.entries(OFFENSE_CATEGORIES)) {
    const categoryPlays = offensePlays.filter(p => p.attributes?.playType === key);
    const subcategories: CategoryCount[] = [];

    if (config.subcategories) {
      for (const [subKey, subConfig] of Object.entries(config.subcategories)) {
        let subCount = 0;
        if ('passConcepts' in subConfig) {
          subCount = categoryPlays.filter(p => matchesPassConcept(p, subConfig.passConcepts)).length;
        } else if ('runConcepts' in subConfig) {
          subCount = categoryPlays.filter(p => matchesRunConcept(p, subConfig.runConcepts)).length;
        }
        if (subCount > 0) {
          subcategories.push({ key: subKey, label: subConfig.label, count: subCount });
        }
      }
    }

    if (categoryPlays.length > 0) {
      counts.push({
        key,
        label: config.label,
        count: categoryPlays.length,
        subcategories: subcategories.length > 0 ? subcategories : undefined
      });
    }
  }

  return counts;
}

export function getOffenseFormationCounts(plays: PlaybookPlay[]): CategoryCount[] {
  const offensePlays = plays.filter(p => p.attributes?.odk === 'offense');
  const counts: CategoryCount[] = [];

  for (const [key, config] of Object.entries(OFFENSE_FORMATIONS)) {
    const formationPlays = offensePlays.filter(p => matchesFormationFamily(p, config.formations));
    if (formationPlays.length > 0) {
      counts.push({ key, label: config.label, count: formationPlays.length });
    }
  }

  return counts;
}

export function getDefenseCategoryCounts(plays: PlaybookPlay[]): CategoryCount[] {
  const defensePlays = plays.filter(p => p.attributes?.odk === 'defense');
  const counts: CategoryCount[] = [];

  for (const [key, config] of Object.entries(DEFENSE_CATEGORIES)) {
    let categoryPlays: PlaybookPlay[] = [];
    const subcategories: CategoryCount[] = [];

    if (key === 'Blitz') {
      categoryPlays = defensePlays.filter(p =>
        p.attributes?.blitzType && p.attributes.blitzType !== 'None'
      );
    } else {
      // Zone or Man - filter by coverage type
      categoryPlays = defensePlays.filter(p => {
        const coverage = p.attributes?.coverage?.toLowerCase() || '';
        if (key === 'Zone') {
          return coverage.includes('cover 2') || coverage.includes('cover 3') ||
                 coverage.includes('cover 4') || coverage.includes('cover 6') ||
                 coverage.includes('tampa') || coverage.includes('palms');
        } else {
          return coverage.includes('man') || coverage.includes('cover 0') || coverage.includes('cover 1');
        }
      });
    }

    if (config.subcategories) {
      for (const [subKey, subConfig] of Object.entries(config.subcategories)) {
        let subCount = 0;
        if ('coverages' in subConfig) {
          subCount = categoryPlays.filter(p => matchesCoverage(p, subConfig.coverages)).length;
        } else if ('blitzTypes' in subConfig) {
          subCount = defensePlays.filter(p => matchesBlitzType(p, subConfig.blitzTypes)).length;
        }
        if (subCount > 0) {
          subcategories.push({ key: subKey, label: subConfig.label, count: subCount });
        }
      }
    }

    if (categoryPlays.length > 0) {
      counts.push({
        key,
        label: config.label,
        count: categoryPlays.length,
        subcategories: subcategories.length > 0 ? subcategories : undefined
      });
    }
  }

  return counts;
}

export function getDefenseFrontCounts(plays: PlaybookPlay[]): CategoryCount[] {
  const defensePlays = plays.filter(p => p.attributes?.odk === 'defense');
  const counts: CategoryCount[] = [];

  for (const [key, config] of Object.entries(DEFENSE_FRONTS)) {
    const frontPlays = defensePlays.filter(p => matchesFormationFamily(p, config.formations));
    if (frontPlays.length > 0) {
      counts.push({ key, label: config.label, count: frontPlays.length });
    }
  }

  return counts;
}

export function getSpecialTeamsCounts(plays: PlaybookPlay[]): CategoryCount[] {
  const stPlays = plays.filter(p => p.attributes?.odk === 'specialTeams');
  const counts: CategoryCount[] = [];

  for (const [key, config] of Object.entries(SPECIAL_TEAMS_CATEGORIES)) {
    const unitPlays = stPlays.filter(p => p.attributes?.unit === key);
    if (unitPlays.length > 0) {
      counts.push({ key, label: config.label, count: unitPlays.length });
    }
  }

  return counts;
}
