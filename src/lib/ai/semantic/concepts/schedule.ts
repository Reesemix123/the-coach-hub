/**
 * Schedule Concept Resolver
 *
 * Analyzes team schedule and game information.
 * Answers questions about upcoming games, past games, record, and game details.
 */

import type { GameData, ConceptParams } from '../types';

export interface ScheduleResult {
  summary: string;
  hasData: boolean;
  record?: {
    wins: number;
    losses: number;
    ties: number;
  };
  upcomingGames?: GameData[];
  pastGames?: GameData[];
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
 * Format time for display
 */
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  // Time is stored as HH:MM:SS, convert to readable format
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Get record string (e.g., "5-2-0")
 */
function getRecordString(wins: number, losses: number, ties: number): string {
  if (ties > 0) {
    return `${wins}-${losses}-${ties}`;
  }
  return `${wins}-${losses}`;
}

/**
 * Resolve schedule-related queries
 */
export function resolveSchedule(
  games: GameData[],
  params: ConceptParams
): ScheduleResult {
  if (!games || games.length === 0) {
    return {
      summary: '**No Games Found**\n\nYou haven\'t added any games to your schedule yet. Go to your team\'s Schedule page to add games.',
      hasData: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Split games into past and upcoming
  const pastGames = games.filter((g) => {
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate < today;
  });

  const upcomingGames = games.filter((g) => {
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate >= today;
  });

  // Calculate record from past games
  const wins = pastGames.filter((g) => g.game_result === 'win').length;
  const losses = pastGames.filter((g) => g.game_result === 'loss').length;
  const ties = pastGames.filter((g) => g.game_result === 'tie').length;

  // Filter by opponent if specified
  const targetOpponent = params.opponent;
  if (targetOpponent) {
    const opponentGames = games.filter((g) =>
      g.opponent.toLowerCase().includes(targetOpponent!.toLowerCase())
    );

    if (opponentGames.length === 0) {
      return {
        summary: `**No Games Found Against "${targetOpponent}"**\n\nI couldn't find any games against that opponent in your schedule.`,
        hasData: false,
      };
    }

    // Build response for specific opponent
    let summary = `**Games vs ${opponentGames[0].opponent}**\n\n`;

    for (const game of opponentGames) {
      const gameDate = new Date(game.date);
      const isPast = gameDate < today;

      if (isPast && game.team_score !== null && game.opponent_score !== null) {
        const result = game.game_result === 'win' ? 'W' : game.game_result === 'loss' ? 'L' : 'T';
        summary += `- ${formatDate(game.date)}: **${result}** ${game.team_score}-${game.opponent_score}`;
      } else if (isPast) {
        summary += `- ${formatDate(game.date)}: *(no score recorded)*`;
      } else {
        summary += `- ${formatDate(game.date)}`;
        if (game.start_time) {
          summary += ` at ${formatTime(game.start_time)}`;
        }
      }
      if (game.location) {
        summary += ` @ ${game.location}`;
      }
      summary += '\n';
    }

    return {
      summary,
      hasData: true,
      upcomingGames: opponentGames.filter((g) => new Date(g.date) >= today),
      pastGames: opponentGames.filter((g) => new Date(g.date) < today),
    };
  }

  // Build comprehensive schedule summary
  let summary = '';

  // Record section
  if (pastGames.length > 0) {
    summary += `**Season Record: ${getRecordString(wins, losses, ties)}**\n\n`;
  }

  // Upcoming games section
  if (upcomingGames.length > 0) {
    summary += `**Upcoming Games (${upcomingGames.length})**\n`;
    // Show next 3 upcoming games
    const nextGames = upcomingGames.slice(0, 3);
    for (const game of nextGames) {
      summary += `- **${game.opponent}** - ${formatDate(game.date)}`;
      if (game.start_time) {
        summary += ` at ${formatTime(game.start_time)}`;
      }
      if (game.location) {
        summary += `\n  Location: ${game.location}`;
      }
      if (game.week_number) {
        summary += `\n  Week ${game.week_number}`;
      }
      summary += '\n';
    }
    if (upcomingGames.length > 3) {
      summary += `\n*...and ${upcomingGames.length - 3} more games*\n`;
    }
  } else {
    summary += '**No Upcoming Games**\n\n';
  }

  // Past games section
  if (pastGames.length > 0) {
    summary += `\n**Recent Results**\n`;
    // Show last 3 games
    const recentGames = pastGames.slice(-3).reverse();
    for (const game of recentGames) {
      if (game.team_score !== null && game.opponent_score !== null) {
        const result = game.game_result === 'win' ? 'W' : game.game_result === 'loss' ? 'L' : 'T';
        summary += `- **${result}** vs ${game.opponent} (${game.team_score}-${game.opponent_score})`;
      } else {
        summary += `- vs ${game.opponent} *(no score recorded)*`;
      }
      if (game.week_number) {
        summary += ` - Week ${game.week_number}`;
      }
      summary += '\n';
    }
  }

  return {
    summary,
    hasData: true,
    record: { wins, losses, ties },
    upcomingGames,
    pastGames,
  };
}

/**
 * Resolve record-specific queries
 */
export function resolveRecord(games: GameData[]): string {
  const pastGames = games.filter((g) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate < today && g.game_result;
  });

  if (pastGames.length === 0) {
    return '**No Completed Games**\n\nYou haven\'t recorded any game results yet.';
  }

  const wins = pastGames.filter((g) => g.game_result === 'win').length;
  const losses = pastGames.filter((g) => g.game_result === 'loss').length;
  const ties = pastGames.filter((g) => g.game_result === 'tie').length;
  const gamesPlayed = wins + losses + ties;

  let summary = `**Season Record: ${getRecordString(wins, losses, ties)}**\n\n`;
  summary += `- Games Played: ${gamesPlayed}\n`;
  summary += `- Wins: ${wins}\n`;
  summary += `- Losses: ${losses}\n`;
  if (ties > 0) {
    summary += `- Ties: ${ties}\n`;
  }

  const winPct = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(0) : 0;
  summary += `- Win Percentage: ${winPct}%\n`;

  // Calculate points for/against
  const gamesWithScores = pastGames.filter(
    (g) => g.team_score !== null && g.opponent_score !== null
  );
  if (gamesWithScores.length > 0) {
    const pointsFor = gamesWithScores.reduce((sum, g) => sum + (g.team_score || 0), 0);
    const pointsAgainst = gamesWithScores.reduce((sum, g) => sum + (g.opponent_score || 0), 0);
    summary += `\n**Scoring**\n`;
    summary += `- Points For: ${pointsFor} (${(pointsFor / gamesWithScores.length).toFixed(1)} per game)\n`;
    summary += `- Points Against: ${pointsAgainst} (${(pointsAgainst / gamesWithScores.length).toFixed(1)} per game)\n`;
    summary += `- Point Differential: ${pointsFor - pointsAgainst > 0 ? '+' : ''}${pointsFor - pointsAgainst}\n`;
  }

  return summary;
}

/**
 * Resolve upcoming game queries (next game)
 */
export function resolveNextGame(games: GameData[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingGames = games
    .filter((g) => {
      const gameDate = new Date(g.date);
      gameDate.setHours(0, 0, 0, 0);
      return gameDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcomingGames.length === 0) {
    return '**No Upcoming Games**\n\nYou don\'t have any games scheduled. Add games to your team schedule to see upcoming matchups.';
  }

  const nextGame = upcomingGames[0];
  let summary = `**Next Game: vs ${nextGame.opponent}**\n\n`;
  summary += `- **Date:** ${formatDate(nextGame.date)}\n`;

  if (nextGame.start_time) {
    summary += `- **Time:** ${formatTime(nextGame.start_time)}\n`;
  }

  if (nextGame.location) {
    summary += `- **Location:** ${nextGame.location}\n`;
  }

  if (nextGame.week_number) {
    summary += `- **Week:** ${nextGame.week_number}\n`;
  }

  if (nextGame.notes) {
    summary += `- **Notes:** ${nextGame.notes}\n`;
  }

  // Days until game
  const daysUntil = Math.ceil(
    (new Date(nextGame.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil === 0) {
    summary += `\n**Game Day!**`;
  } else if (daysUntil === 1) {
    summary += `\n*Game is tomorrow!*`;
  } else {
    summary += `\n*${daysUntil} days until game*`;
  }

  return summary;
}

/**
 * Resolve past game results
 */
export function resolvePastGames(games: GameData[], limit: number = 5): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastGames = games
    .filter((g) => {
      const gameDate = new Date(g.date);
      gameDate.setHours(0, 0, 0, 0);
      return gameDate < today;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  if (pastGames.length === 0) {
    return '**No Past Games**\n\nYou haven\'t played any games yet this season.';
  }

  let summary = `**Recent Games**\n\n`;

  for (const game of pastGames) {
    if (game.team_score !== null && game.opponent_score !== null) {
      const result = game.game_result === 'win' ? 'W' : game.game_result === 'loss' ? 'L' : 'T';
      summary += `**${result}** vs ${game.opponent} (${game.team_score}-${game.opponent_score})\n`;
      summary += `  ${formatDate(game.date)}`;
      if (game.location) {
        summary += ` @ ${game.location}`;
      }
      summary += '\n\n';
    } else {
      summary += `vs ${game.opponent} *(no score recorded)*\n`;
      summary += `  ${formatDate(game.date)}\n\n`;
    }
  }

  return summary;
}
