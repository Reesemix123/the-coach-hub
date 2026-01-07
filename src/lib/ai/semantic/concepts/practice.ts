/**
 * Practice Concept Resolver
 *
 * Analyzes team practice plans and schedule.
 * Answers questions about upcoming practices, past practices, and practice details.
 */

import type { PracticePlanData, PracticePlanWithDetails, ConceptParams } from '../types';

export interface PracticeResult {
  summary: string;
  hasData: boolean;
  upcomingPractices?: PracticePlanData[];
  pastPractices?: PracticePlanData[];
  lastPractice?: PracticePlanData;
  nextPractice?: PracticePlanData;
}

/**
 * Format a date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date for short display
 */
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
}

/**
 * Get relative date description
 */
function getRelativeDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDateShort(dateStr);
}

/**
 * Resolve practice-related queries
 */
export function resolvePracticeSchedule(
  practices: PracticePlanData[],
  params: ConceptParams
): PracticeResult {
  if (!practices || practices.length === 0) {
    return {
      summary: '**No Practice Plans Found**\n\nYou haven\'t created any practice plans yet. Go to your team\'s Practice page to create practice plans.',
      hasData: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Split practices into past and upcoming
  const pastPractices = practices.filter((p) => {
    const practiceDate = new Date(p.date);
    practiceDate.setHours(0, 0, 0, 0);
    return practiceDate < today;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const upcomingPractices = practices.filter((p) => {
    const practiceDate = new Date(p.date);
    practiceDate.setHours(0, 0, 0, 0);
    return practiceDate >= today;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lastPractice = pastPractices[0];
  const nextPractice = upcomingPractices[0];

  // Build comprehensive practice summary
  let summary = '';

  // Stats section
  summary += `**Practice Overview**\n`;
  summary += `- Total Practices: ${practices.length}\n`;
  summary += `- Completed: ${pastPractices.length}\n`;
  summary += `- Upcoming: ${upcomingPractices.length}\n\n`;

  // Upcoming practices section
  if (upcomingPractices.length > 0) {
    summary += `**Upcoming Practices (${upcomingPractices.length})**\n`;
    // Show next 3 upcoming practices
    const nextPractices = upcomingPractices.slice(0, 3);
    for (const practice of nextPractices) {
      summary += `- **${practice.title}** - ${formatDate(practice.date)} (${getRelativeDate(practice.date)})\n`;
      summary += `  Duration: ${formatDuration(practice.duration_minutes)}`;
      if (practice.location) {
        summary += ` | Location: ${practice.location}`;
      }
      if (practice.periods_count) {
        summary += ` | ${practice.periods_count} periods`;
      }
      if (practice.drills_count) {
        summary += `, ${practice.drills_count} drills`;
      }
      summary += '\n';
    }
    if (upcomingPractices.length > 3) {
      summary += `\n*...and ${upcomingPractices.length - 3} more practices scheduled*\n`;
    }
  } else {
    summary += '**No Upcoming Practices**\n\nYou don\'t have any practices scheduled. Create a practice plan to get started.\n';
  }

  // Recent/past practices section
  if (pastPractices.length > 0) {
    summary += `\n**Recent Practices**\n`;
    // Show last 3 practices
    const recentPractices = pastPractices.slice(0, 3);
    for (const practice of recentPractices) {
      summary += `- **${practice.title}** - ${formatDateShort(practice.date)} (${getRelativeDate(practice.date)})\n`;
      summary += `  Duration: ${formatDuration(practice.duration_minutes)}`;
      if (practice.location) {
        summary += ` | ${practice.location}`;
      }
      summary += '\n';
    }
  }

  return {
    summary,
    hasData: true,
    upcomingPractices,
    pastPractices,
    lastPractice,
    nextPractice,
  };
}

/**
 * Resolve last practice query
 */
export function resolveLastPractice(practices: PracticePlanData[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPractices = practices
    .filter((p) => {
      const practiceDate = new Date(p.date);
      practiceDate.setHours(0, 0, 0, 0);
      return practiceDate < today;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (pastPractices.length === 0) {
    return '**No Past Practices**\n\nYou haven\'t had any practices yet. Your first practice plan will appear here after the scheduled date passes.';
  }

  const lastPractice = pastPractices[0];

  let summary = `**Last Practice: ${lastPractice.title}**\n\n`;
  summary += `- **Date:** ${formatDate(lastPractice.date)} (${getRelativeDate(lastPractice.date)})\n`;
  summary += `- **Duration:** ${formatDuration(lastPractice.duration_minutes)}\n`;

  if (lastPractice.location) {
    summary += `- **Location:** ${lastPractice.location}\n`;
  }

  if (lastPractice.periods_count) {
    summary += `- **Periods:** ${lastPractice.periods_count}\n`;
  }

  if (lastPractice.drills_count) {
    summary += `- **Drills:** ${lastPractice.drills_count}\n`;
  }

  if (lastPractice.notes) {
    summary += `\n**Notes:** ${lastPractice.notes}\n`;
  }

  // Show how long ago it was
  const daysAgo = Math.ceil(
    (today.getTime() - new Date(lastPractice.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysAgo === 1) {
    summary += `\n*Practice was yesterday*`;
  } else {
    summary += `\n*${daysAgo} days since last practice*`;
  }

  return summary;
}

/**
 * Resolve next practice query
 */
export function resolveNextPractice(practices: PracticePlanData[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingPractices = practices
    .filter((p) => {
      const practiceDate = new Date(p.date);
      practiceDate.setHours(0, 0, 0, 0);
      return practiceDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcomingPractices.length === 0) {
    return '**No Upcoming Practices**\n\nYou don\'t have any practices scheduled. Create a practice plan to see your next practice.';
  }

  const nextPractice = upcomingPractices[0];

  let summary = `**Next Practice: ${nextPractice.title}**\n\n`;
  summary += `- **Date:** ${formatDate(nextPractice.date)}\n`;
  summary += `- **Duration:** ${formatDuration(nextPractice.duration_minutes)}\n`;

  if (nextPractice.location) {
    summary += `- **Location:** ${nextPractice.location}\n`;
  }

  if (nextPractice.periods_count) {
    summary += `- **Periods:** ${nextPractice.periods_count}\n`;
  }

  if (nextPractice.drills_count) {
    summary += `- **Drills:** ${nextPractice.drills_count}\n`;
  }

  if (nextPractice.notes) {
    summary += `\n**Notes:** ${nextPractice.notes}\n`;
  }

  // Days until practice
  const daysUntil = Math.ceil(
    (new Date(nextPractice.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil === 0) {
    summary += `\n**Practice Day!**`;
  } else if (daysUntil === 1) {
    summary += `\n*Practice is tomorrow!*`;
  } else {
    summary += `\n*${daysUntil} days until practice*`;
  }

  return summary;
}

/**
 * Resolve past practices list
 */
export function resolvePastPractices(practices: PracticePlanData[], limit: number = 5): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPractices = practices
    .filter((p) => {
      const practiceDate = new Date(p.date);
      practiceDate.setHours(0, 0, 0, 0);
      return practiceDate < today;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  if (pastPractices.length === 0) {
    return '**No Past Practices**\n\nYou haven\'t had any practices yet this season.';
  }

  let summary = `**Recent Practices**\n\n`;

  for (const practice of pastPractices) {
    summary += `**${practice.title}**\n`;
    summary += `  ${formatDate(practice.date)} | ${formatDuration(practice.duration_minutes)}`;
    if (practice.location) {
      summary += ` | ${practice.location}`;
    }
    summary += '\n';
    if (practice.periods_count || practice.drills_count) {
      summary += `  ${practice.periods_count || 0} periods, ${practice.drills_count || 0} drills\n`;
    }
    summary += '\n';
  }

  return summary;
}

/**
 * Resolve upcoming practices list
 */
export function resolveUpcomingPractices(practices: PracticePlanData[], limit: number = 5): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingPractices = practices
    .filter((p) => {
      const practiceDate = new Date(p.date);
      practiceDate.setHours(0, 0, 0, 0);
      return practiceDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit);

  if (upcomingPractices.length === 0) {
    return '**No Upcoming Practices**\n\nYou don\'t have any practices scheduled. Create a practice plan to see your upcoming schedule.';
  }

  let summary = `**Upcoming Practices**\n\n`;

  for (const practice of upcomingPractices) {
    const daysUntil = Math.ceil(
      (new Date(practice.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    summary += `**${practice.title}**\n`;
    summary += `  ${formatDate(practice.date)}`;
    if (daysUntil === 0) {
      summary += ' **(Today!)**';
    } else if (daysUntil === 1) {
      summary += ' **(Tomorrow)**';
    } else {
      summary += ` *(${daysUntil} days)*`;
    }
    summary += '\n';
    summary += `  Duration: ${formatDuration(practice.duration_minutes)}`;
    if (practice.location) {
      summary += ` | ${practice.location}`;
    }
    summary += '\n';
    if (practice.periods_count || practice.drills_count) {
      summary += `  ${practice.periods_count || 0} periods, ${practice.drills_count || 0} drills\n`;
    }
    summary += '\n';
  }

  return summary;
}

/**
 * Format a full practice plan with all details (periods, drills, equipment)
 */
export function formatPracticeDetails(practice: PracticePlanWithDetails): string {
  let summary = `**${practice.title}**\n`;
  summary += `${formatDate(practice.date)} | ${formatDuration(practice.duration_minutes)}\n`;

  if (practice.location) {
    summary += `Location: ${practice.location}\n`;
  }

  if (practice.notes) {
    summary += `\n*Notes: ${practice.notes}*\n`;
  }

  // Collect all equipment across all drills
  const allEquipment = new Set<string>();

  if (practice.periods && practice.periods.length > 0) {
    summary += `\n---\n\n**Practice Breakdown (${practice.periods.length} periods)**\n\n`;

    for (const period of practice.periods) {
      summary += `### ${period.name} (${formatDuration(period.duration_minutes)})\n`;
      if (period.period_type && period.period_type !== 'other') {
        summary += `*Type: ${period.period_type}*\n`;
      }
      if (period.notes) {
        summary += `*${period.notes}*\n`;
      }

      if (period.drills && period.drills.length > 0) {
        summary += '\n';
        for (const drill of period.drills) {
          summary += `**${drill.drill_order}. ${drill.drill_name}**`;
          if (drill.position_group) {
            summary += ` *(${drill.position_group})*`;
          }
          summary += '\n';

          if (drill.description) {
            summary += `   ${drill.description}\n`;
          }

          if (drill.play_codes && drill.play_codes.length > 0) {
            summary += `   Plays: ${drill.play_codes.join(', ')}\n`;
          }

          if (drill.equipment_needed) {
            summary += `   Equipment: ${drill.equipment_needed}\n`;
            // Add to overall equipment list
            drill.equipment_needed.split(',').forEach(e => allEquipment.add(e.trim()));
          }
        }
      } else {
        summary += '\n*No drills added to this period*\n';
      }
      summary += '\n';
    }
  } else {
    summary += '\n*No periods added to this practice plan yet*\n';
  }

  // Equipment summary
  if (allEquipment.size > 0) {
    summary += '\n---\n\n**Equipment Needed:**\n';
    allEquipment.forEach(e => {
      summary += `- ${e}\n`;
    });
  }

  return summary;
}

/**
 * Resolve detailed last practice query (with drills)
 */
export function resolveLastPracticeDetails(practice: PracticePlanWithDetails | null): string {
  if (!practice) {
    return '**No Past Practices**\n\nYou haven\'t had any practices yet. Your first practice plan will appear here after the scheduled date passes.';
  }

  let summary = `**Last Practice Details**\n\n`;
  summary += formatPracticeDetails(practice);

  // Add relative time
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAgo = Math.ceil(
    (today.getTime() - new Date(practice.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysAgo === 1) {
    summary += `\n*This practice was yesterday*`;
  } else {
    summary += `\n*${daysAgo} days since this practice*`;
  }

  return summary;
}

/**
 * Resolve detailed next practice query (with drills)
 */
export function resolveNextPracticeDetails(practice: PracticePlanWithDetails | null): string {
  if (!practice) {
    return '**No Upcoming Practices**\n\nYou don\'t have any practices scheduled. Create a practice plan to see your next practice.';
  }

  let summary = `**Next Practice Details**\n\n`;
  summary += formatPracticeDetails(practice);

  // Days until practice
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil(
    (new Date(practice.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil === 0) {
    summary += `\n**Practice Day!**`;
  } else if (daysUntil === 1) {
    summary += `\n*Practice is tomorrow!*`;
  } else {
    summary += `\n*${daysUntil} days until practice*`;
  }

  return summary;
}

/**
 * Resolve practice drills query - what drills did we do?
 */
export function resolvePracticeDrills(practice: PracticePlanWithDetails | null): string {
  if (!practice) {
    return '**No Practice Data**\n\nNo practice plan found to show drills from.';
  }

  const allDrills: { drill: (typeof practice.periods)[0]['drills'][0]; periodName: string }[] = [];

  for (const period of practice.periods || []) {
    for (const drill of period.drills || []) {
      allDrills.push({ drill, periodName: period.name });
    }
  }

  if (allDrills.length === 0) {
    return `**${practice.title}** - ${formatDateShort(practice.date)}\n\n*No drills have been added to this practice plan yet.*`;
  }

  let summary = `**Drills from ${practice.title}** - ${formatDateShort(practice.date)}\n\n`;
  summary += `Total: ${allDrills.length} drills\n\n`;

  // Group by position group
  const byPosition = new Map<string, typeof allDrills>();
  for (const item of allDrills) {
    const group = item.drill.position_group || 'All/Team';
    if (!byPosition.has(group)) {
      byPosition.set(group, []);
    }
    byPosition.get(group)!.push(item);
  }

  for (const [position, drills] of byPosition) {
    summary += `**${position}** (${drills.length} drills)\n`;
    for (const { drill, periodName } of drills) {
      summary += `- ${drill.drill_name}`;
      if (drill.description) {
        summary += `: ${drill.description}`;
      }
      summary += ` *(${periodName})*\n`;
    }
    summary += '\n';
  }

  return summary;
}

/**
 * Resolve practice equipment query - what equipment do we need?
 */
export function resolvePracticeEquipment(practice: PracticePlanWithDetails | null): string {
  if (!practice) {
    return '**No Practice Data**\n\nNo practice plan found to show equipment from.';
  }

  const allEquipment = new Set<string>();
  const equipmentByPeriod = new Map<string, Set<string>>();

  for (const period of practice.periods || []) {
    for (const drill of period.drills || []) {
      if (drill.equipment_needed) {
        if (!equipmentByPeriod.has(period.name)) {
          equipmentByPeriod.set(period.name, new Set());
        }
        drill.equipment_needed.split(',').forEach(e => {
          const trimmed = e.trim();
          allEquipment.add(trimmed);
          equipmentByPeriod.get(period.name)!.add(trimmed);
        });
      }
    }
  }

  if (allEquipment.size === 0) {
    return `**${practice.title}** - ${formatDateShort(practice.date)}\n\n*No equipment specified for this practice. Add equipment to drills in your practice plan.*`;
  }

  let summary = `**Equipment for ${practice.title}** - ${formatDateShort(practice.date)}\n\n`;

  // Overall equipment list
  summary += `**Equipment Checklist (${allEquipment.size} items):**\n`;
  Array.from(allEquipment).sort().forEach(e => {
    summary += `- [ ] ${e}\n`;
  });

  // Equipment by period
  if (equipmentByPeriod.size > 1) {
    summary += '\n**By Period:**\n';
    for (const [period, equipment] of equipmentByPeriod) {
      summary += `- **${period}:** ${Array.from(equipment).join(', ')}\n`;
    }
  }

  return summary;
}

/**
 * Get practice count statistics
 */
export function resolvePracticeStats(practices: PracticePlanData[]): string {
  if (!practices || practices.length === 0) {
    return '**No Practice Data**\n\nYou haven\'t created any practice plans yet.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPractices = practices.filter((p) => {
    const practiceDate = new Date(p.date);
    practiceDate.setHours(0, 0, 0, 0);
    return practiceDate < today;
  });

  const upcomingPractices = practices.filter((p) => {
    const practiceDate = new Date(p.date);
    practiceDate.setHours(0, 0, 0, 0);
    return practiceDate >= today;
  });

  // Calculate total practice time
  const totalMinutes = pastPractices.reduce((sum, p) => sum + p.duration_minutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Average practice duration
  const avgDuration = pastPractices.length > 0
    ? Math.round(totalMinutes / pastPractices.length)
    : 0;

  let summary = `**Practice Statistics**\n\n`;
  summary += `- Total Practice Plans: ${practices.length}\n`;
  summary += `- Practices Completed: ${pastPractices.length}\n`;
  summary += `- Practices Upcoming: ${upcomingPractices.length}\n\n`;

  if (pastPractices.length > 0) {
    summary += `**Training Time**\n`;
    summary += `- Total Practice Time: ${totalHours} hours\n`;
    summary += `- Average Duration: ${formatDuration(avgDuration)}\n`;
  }

  return summary;
}
