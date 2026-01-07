import { format } from 'date-fns';
import { GameWeekContext } from '@/lib/services/game-week.service';
import { History, Trophy, XCircle, MinusCircle } from 'lucide-react';

interface GameWeekHeaderProps {
  context: GameWeekContext;
}

export default function GameWeekHeader({ context }: GameWeekHeaderProps) {
  const { opponent, gameDate, daysUntilGame, isHistorical, daysAgo, gameResult, teamScore, opponentScore } = context;

  if (!opponent || !gameDate) {
    return null;
  }

  // Historical mode - viewing a past game
  if (isHistorical && daysAgo !== undefined) {
    const resultColors = {
      win: 'bg-green-50 border-green-300 text-green-900',
      loss: 'bg-red-50 border-red-300 text-red-900',
      tie: 'bg-yellow-50 border-yellow-300 text-yellow-900',
      none: 'bg-gray-50 border-gray-300 text-gray-900'
    };

    const resultColor = gameResult ? resultColors[gameResult] : resultColors.none;

    const ResultIcon = gameResult === 'win' ? Trophy
      : gameResult === 'loss' ? XCircle
      : gameResult === 'tie' ? MinusCircle
      : History;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {/* Left: Title and opponent */}
          <div>
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-gray-400" />
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                Game Prep Review
              </h1>
            </div>
            <p className="text-lg text-gray-600 mt-2">
              vs. {opponent} • {format(gameDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Right: Game Result */}
          <div
            className={`
              px-6 py-4 rounded-lg border-2 text-center
              ${resultColor}
            `}
          >
            {teamScore !== null && teamScore !== undefined ? (
              <>
                <div className="flex items-center gap-2 justify-center">
                  <ResultIcon className="w-5 h-5" />
                  <span className="text-2xl font-bold">
                    {gameResult === 'win' ? 'W' : gameResult === 'loss' ? 'L' : 'T'}
                  </span>
                </div>
                <div className="text-xl font-semibold mt-1">
                  {teamScore} - {opponentScore}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {daysAgo} {daysAgo === 1 ? 'day' : 'days'} ago
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {daysAgo}
                </div>
                <div className="text-sm">
                  {daysAgo === 1 ? 'Day' : 'Days'} Ago
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Future game mode - original countdown display
  if (daysUntilGame === null) {
    return null;
  }

  // Determine urgency color
  const urgency = daysUntilGame <= 2 ? 'red' : daysUntilGame <= 4 ? 'yellow' : 'green';
  const urgencyColors = {
    red: 'bg-red-50 border-red-300 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    green: 'bg-green-50 border-green-300 text-green-900'
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {/* Left: Title and opponent */}
        <div>
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
            Game Week Command Center
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            vs. {opponent} • {format(gameDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Right: Countdown */}
        <div
          className={`
            px-6 py-4 rounded-lg border-2
            ${urgencyColors[urgency]}
          `}
        >
          <div className="text-3xl font-bold">
            {daysUntilGame}
          </div>
          <div className="text-sm">
            {daysUntilGame === 1 ? 'Day' : 'Days'} Until Game
          </div>
        </div>
      </div>
    </div>
  );
}
