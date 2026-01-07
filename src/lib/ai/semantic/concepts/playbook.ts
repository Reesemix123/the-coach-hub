/**
 * Playbook Concept Resolver
 *
 * Searches and browses the team's playbook.
 * Answers questions about available plays, formations, and concepts.
 */

import type { PlaybookPlayData, ConceptParams } from '../types';

export interface PlaybookSearchResult {
  summary: string;
  hasData: boolean;
  plays: PlaybookPlayData[];
  totalCount: number;
}

/**
 * Format play details for display
 */
function formatPlayDetails(play: PlaybookPlayData): string {
  const parts: string[] = [];

  parts.push(`**${play.play_name}** (${play.play_code})`);

  const details: string[] = [];
  if (play.attributes?.formation) {
    details.push(`Formation: ${play.attributes.formation}`);
  }
  if (play.attributes?.playType) {
    details.push(`Type: ${play.attributes.playType}`);
  }
  if (play.attributes?.personnel) {
    details.push(`Personnel: ${play.attributes.personnel}`);
  }
  if (play.attributes?.runConcept) {
    details.push(`Run Concept: ${play.attributes.runConcept}`);
  }
  if (play.attributes?.passConcept) {
    details.push(`Pass Concept: ${play.attributes.passConcept}`);
  }

  if (details.length > 0) {
    parts.push(`   ${details.join(' | ')}`);
  }

  return parts.join('\n');
}

/**
 * Resolve playbook browse/list queries
 */
export function resolvePlaybookBrowse(
  plays: PlaybookPlayData[],
  params: ConceptParams
): PlaybookSearchResult {
  if (!plays || plays.length === 0) {
    return {
      summary: '**No Plays in Playbook**\n\nYour playbook is empty. Go to the Playbook page to add plays.',
      hasData: false,
      plays: [],
      totalCount: 0,
    };
  }

  let filteredPlays = plays;
  let filterDescription = '';

  // Filter by play type if specified
  if (params.playType && params.playType !== 'all') {
    if (params.playType === 'run') {
      filteredPlays = plays.filter(p => p.attributes?.playType === 'Run');
      filterDescription = 'Run';
    } else if (params.playType === 'pass') {
      filteredPlays = plays.filter(p =>
        ['Pass', 'Screen', 'RPO', 'Play Action'].includes(p.attributes?.playType || '')
      );
      filterDescription = 'Pass';
    }
  }

  // Filter by formation if specified
  if (params.formation) {
    filteredPlays = filteredPlays.filter(p =>
      p.attributes?.formation?.toLowerCase().includes(params.formation!.toLowerCase())
    );
    filterDescription += filterDescription ? ` from ${params.formation}` : params.formation;
  }

  const totalCount = filteredPlays.length;
  const displayPlays = filteredPlays.slice(0, 10); // Show first 10

  let summary = '';

  if (filterDescription) {
    summary = `**${filterDescription} Plays (${totalCount} found)**\n\n`;
  } else {
    summary = `**Your Playbook (${totalCount} plays)**\n\n`;
  }

  if (displayPlays.length === 0) {
    summary += 'No plays match your criteria.';
    return {
      summary,
      hasData: false,
      plays: [],
      totalCount: 0,
    };
  }

  for (const play of displayPlays) {
    summary += formatPlayDetails(play) + '\n\n';
  }

  if (totalCount > 10) {
    summary += `\n*...and ${totalCount - 10} more plays*`;
  }

  return {
    summary,
    hasData: true,
    plays: displayPlays,
    totalCount,
  };
}

/**
 * Resolve playbook search queries (with specific criteria)
 */
export function resolvePlaybookSearch(
  plays: PlaybookPlayData[],
  criteria: {
    targetPosition?: string;
    concept?: string;
    formation?: string;
    playType?: 'run' | 'pass';
    personnel?: string;
  }
): PlaybookSearchResult {
  if (!plays || plays.length === 0) {
    return {
      summary: '**No Plays in Playbook**\n\nYour playbook is empty. Go to the Playbook page to add plays.',
      hasData: false,
      plays: [],
      totalCount: 0,
    };
  }

  let results = plays;
  const appliedFilters: string[] = [];

  // Filter by play type
  if (criteria.playType) {
    if (criteria.playType === 'run') {
      results = results.filter(p => p.attributes?.playType === 'Run');
      appliedFilters.push('Run plays');
    } else {
      results = results.filter(p =>
        ['Pass', 'Screen', 'RPO', 'Play Action'].includes(p.attributes?.playType || '')
      );
      appliedFilters.push('Pass plays');
    }
  }

  // Filter by formation
  if (criteria.formation) {
    results = results.filter(p =>
      p.attributes?.formation?.toLowerCase().includes(criteria.formation!.toLowerCase())
    );
    appliedFilters.push(`${criteria.formation} formation`);
  }

  // Filter by concept (works for offense, defense, and special teams)
  if (criteria.concept) {
    const conceptLower = criteria.concept.toLowerCase();
    results = results.filter(p => {
      // Check offensive concepts
      if (p.attributes?.runConcept?.toLowerCase().includes(conceptLower)) return true;
      if (p.attributes?.passConcept?.toLowerCase().includes(conceptLower)) return true;
      // Check defensive concepts
      if (p.attributes?.coverage?.toLowerCase().includes(conceptLower)) return true;
      if (p.attributes?.blitzType?.toLowerCase().includes(conceptLower)) return true;
      if (p.attributes?.defensiveScheme?.toLowerCase().includes(conceptLower)) return true;
      // Check special teams concepts
      if (p.attributes?.specialTeamsType?.toLowerCase().includes(conceptLower)) return true;
      if (p.attributes?.returnType?.toLowerCase().includes(conceptLower)) return true;
      // Check play name as fallback
      if (p.play_name.toLowerCase().includes(conceptLower)) return true;
      return false;
    });
    appliedFilters.push(`"${criteria.concept}" concept`);
  }

  // Filter by personnel
  if (criteria.personnel) {
    results = results.filter(p =>
      p.attributes?.personnel?.toLowerCase().includes(criteria.personnel!.toLowerCase())
    );
    appliedFilters.push(`${criteria.personnel} personnel`);
  }

  // Filter by target position (works for offense, defense, and special teams)
  if (criteria.targetPosition) {
    const posLower = criteria.targetPosition.toLowerCase();
    results = results.filter(p => {
      // Check personnel
      if (p.attributes?.personnel?.toLowerCase().includes(posLower)) return true;
      // Check ball carrier (offense)
      if (p.attributes?.ballCarrier?.toLowerCase().includes(posLower)) return true;
      // Check play name
      if (p.play_name.toLowerCase().includes(posLower)) return true;
      // Check formation for position mentions
      if (p.attributes?.formation?.toLowerCase().includes(posLower)) return true;

      // Offensive position-specific checks
      if (posLower === 'te' || posLower === 'tight end') {
        const personnel = p.attributes?.personnel?.toLowerCase() || '';
        if (personnel.includes('2te') || personnel.includes('2-te') ||
            personnel.includes('12 ') || personnel.includes('13 ') ||
            personnel.includes('22 ') || personnel.includes('23 ')) {
          return true;
        }
      }

      // Defensive position-specific checks
      if (posLower === 'lb' || posLower === 'linebacker') {
        const formation = p.attributes?.formation?.toLowerCase() || '';
        const playName = p.play_name.toLowerCase();
        if (formation.includes('lb') || playName.includes('lb') ||
            playName.includes('mike') || playName.includes('will') ||
            playName.includes('sam') || playName.includes('linebacker')) {
          return true;
        }
      }
      if (posLower === 'cb' || posLower === 'corner' || posLower === 'cornerback') {
        const coverage = p.attributes?.coverage?.toLowerCase() || '';
        const playName = p.play_name.toLowerCase();
        if (coverage.includes('man') || coverage.includes('press') ||
            playName.includes('corner') || playName.includes('cb')) {
          return true;
        }
      }
      if (posLower === 's' || posLower === 'safety') {
        const coverage = p.attributes?.coverage?.toLowerCase() || '';
        const playName = p.play_name.toLowerCase();
        if (coverage.includes('cover 1') || coverage.includes('cover 3') ||
            playName.includes('safety') || playName.includes('free') ||
            playName.includes('strong')) {
          return true;
        }
      }
      if (posLower === 'de' || posLower === 'defensive end' || posLower === 'edge') {
        const playName = p.play_name.toLowerCase();
        const formation = p.attributes?.formation?.toLowerCase() || '';
        if (playName.includes('end') || playName.includes('edge') ||
            playName.includes('contain') || formation.includes('de')) {
          return true;
        }
      }
      if (posLower === 'dt' || posLower === 'defensive tackle' || posLower === 'nose' || posLower === 'nt') {
        const playName = p.play_name.toLowerCase();
        const formation = p.attributes?.formation?.toLowerCase() || '';
        if (playName.includes('tackle') || playName.includes('nose') ||
            playName.includes('interior') || formation.includes('dt') ||
            formation.includes('nt') || formation.includes('3-4') ||
            formation.includes('4-3')) {
          return true;
        }
      }

      // Offensive line position-specific checks
      if (posLower === 'ol' || posLower === 'offensive line' || posLower === 'o-line' || posLower === 'oline') {
        // Any offensive play likely involves OL
        if (p.attributes?.odk === 'offense') {
          return true;
        }
      }
      if (posLower === 'lt' || posLower === 'left tackle') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('left') || playName.includes('lt') ||
            playName.includes('tackle')) {
          return true;
        }
      }
      if (posLower === 'lg' || posLower === 'left guard') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('left') || playName.includes('lg') ||
            playName.includes('guard') || playName.includes('pull')) {
          return true;
        }
      }
      if (posLower === 'c' || posLower === 'center') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('center') || playName.includes('a gap') ||
            playName.includes('wedge')) {
          return true;
        }
      }
      if (posLower === 'rg' || posLower === 'right guard') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('right') || playName.includes('rg') ||
            playName.includes('guard') || playName.includes('pull')) {
          return true;
        }
      }
      if (posLower === 'rt' || posLower === 'right tackle') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('right') || playName.includes('rt') ||
            playName.includes('tackle')) {
          return true;
        }
      }
      if (posLower === 'guard' || posLower === 'guards') {
        const playName = p.play_name.toLowerCase();
        const runConcept = p.attributes?.runConcept?.toLowerCase() || '';
        if (playName.includes('guard') || playName.includes('pull') ||
            runConcept.includes('power') || runConcept.includes('counter') ||
            runConcept.includes('trap')) {
          return true;
        }
      }
      if (posLower === 'tackle' || posLower === 'tackles') {
        const playName = p.play_name.toLowerCase();
        if (playName.includes('tackle') || playName.includes('edge')) {
          return true;
        }
      }

      // Defensive line as a unit
      if (posLower === 'dl' || posLower === 'd-line' || posLower === 'dline' || posLower === 'defensive line') {
        if (p.attributes?.odk === 'defense') {
          return true;
        }
      }

      // Special teams position-specific checks
      if (posLower === 'k' || posLower === 'kicker') {
        const stType = p.attributes?.specialTeamsType?.toLowerCase() || '';
        if (stType.includes('kickoff') || stType.includes('field goal') ||
            stType.includes('fg') || stType.includes('pat')) {
          return true;
        }
      }
      if (posLower === 'p' || posLower === 'punter') {
        const stType = p.attributes?.specialTeamsType?.toLowerCase() || '';
        if (stType.includes('punt')) {
          return true;
        }
      }
      if (posLower === 'returner' || posLower === 'kr' || posLower === 'pr') {
        const returnType = p.attributes?.returnType?.toLowerCase() || '';
        const stType = p.attributes?.specialTeamsType?.toLowerCase() || '';
        if (returnType || stType.includes('return')) {
          return true;
        }
      }

      return false;
    });
    appliedFilters.push(`featuring ${criteria.targetPosition.toUpperCase()}`);
  }

  const totalCount = results.length;
  const displayPlays = results.slice(0, 8);

  let summary = '';

  if (appliedFilters.length > 0) {
    summary = `**Playbook Search: ${appliedFilters.join(', ')}**\n`;
    summary += `Found ${totalCount} matching plays\n\n`;
  } else {
    summary = `**All Plays (${totalCount})**\n\n`;
  }

  if (displayPlays.length === 0) {
    summary += 'No plays match your search criteria. Try broadening your search or check your playbook for available plays.';
    return {
      summary,
      hasData: false,
      plays: [],
      totalCount: 0,
    };
  }

  for (const play of displayPlays) {
    summary += formatPlayDetails(play) + '\n\n';
  }

  if (totalCount > 8) {
    summary += `\n*...and ${totalCount - 8} more plays*`;
  }

  // Add a helpful suggestion
  if (totalCount > 0) {
    summary += '\n\n*Tip: You can ask me about specific plays by name, like "Tell me about Power Right"*';
  }

  return {
    summary,
    hasData: true,
    plays: displayPlays,
    totalCount,
  };
}

/**
 * Find a specific play by name or code
 */
export function findPlayByName(
  plays: PlaybookPlayData[],
  searchTerm: string
): PlaybookPlayData | null {
  const termLower = searchTerm.toLowerCase();

  // Exact match on play code
  const exactCode = plays.find(p => p.play_code.toLowerCase() === termLower);
  if (exactCode) return exactCode;

  // Exact match on play name
  const exactName = plays.find(p => p.play_name.toLowerCase() === termLower);
  if (exactName) return exactName;

  // Partial match on play name
  const partialName = plays.find(p => p.play_name.toLowerCase().includes(termLower));
  if (partialName) return partialName;

  // Partial match on play code
  const partialCode = plays.find(p => p.play_code.toLowerCase().includes(termLower));
  if (partialCode) return partialCode;

  return null;
}

/**
 * Get play recommendations based on criteria
 */
export function resolvePlayRecommendations(
  plays: PlaybookPlayData[],
  performanceData: Map<string, { successRate: number; attempts: number }> | null,
  criteria: {
    targetPosition?: string;
    playType?: 'run' | 'pass';
    formation?: string;
  }
): string {
  // First, filter plays by criteria
  const searchResult = resolvePlaybookSearch(plays, criteria);

  if (!searchResult.hasData) {
    return searchResult.summary;
  }

  let summary = `**Recommended Plays**\n`;

  if (criteria.targetPosition) {
    summary += `*To feature your ${criteria.targetPosition.toUpperCase()}*\n\n`;
  } else if (criteria.playType) {
    summary += `*${criteria.playType === 'run' ? 'Run' : 'Pass'} plays*\n\n`;
  }

  // If we have performance data, sort by success rate
  if (performanceData && performanceData.size > 0) {
    const rankedPlays = searchResult.plays
      .map(play => ({
        play,
        stats: performanceData.get(play.play_code),
      }))
      .filter(p => p.stats && p.stats.attempts >= 2)
      .sort((a, b) => (b.stats?.successRate || 0) - (a.stats?.successRate || 0));

    if (rankedPlays.length > 0) {
      summary += '**Based on your game film performance:**\n\n';
      for (const { play, stats } of rankedPlays.slice(0, 5)) {
        summary += `- **${play.play_name}** (${play.play_code})\n`;
        summary += `  ${stats!.successRate.toFixed(0)}% success rate (${stats!.attempts} attempts)\n`;
        if (play.attributes?.formation) {
          summary += `  Formation: ${play.attributes.formation}\n`;
        }
        summary += '\n';
      }
      return summary;
    }
  }

  // No performance data - just list matching plays
  summary += 'These plays from your playbook match your criteria:\n\n';

  for (const play of searchResult.plays.slice(0, 5)) {
    summary += formatPlayDetails(play) + '\n\n';
  }

  summary += '\n*Tag these plays in game film to see performance stats!*';

  return summary;
}
