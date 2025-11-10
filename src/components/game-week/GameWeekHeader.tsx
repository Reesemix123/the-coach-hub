import { format } from 'date-fns';
import { GameWeekContext } from '@/lib/services/game-week.service';

interface GameWeekHeaderProps {
  context: GameWeekContext;
}

export default function GameWeekHeader({ context }: GameWeekHeaderProps) {
  const { opponent, gameDate, daysUntilGame } = context;

  if (!opponent || !gameDate || daysUntilGame === null) {
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
