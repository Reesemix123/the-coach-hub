'use client';

import { Info } from 'lucide-react';

interface GameReadyIndicatorProps {
  teamId: string;
  gameId: string;
  overallReadiness: number;
  filmProgress: number;
  gamePlanProgress: number;
  playbookProgress: number;
  practiceProgress: number;
  rosterProgress: number;
  criticalInsightsCount: number;
  daysUntilGame: number | null;
}

export default function GameReadyIndicator({
  teamId,
  gameId,
  overallReadiness,
  filmProgress,
  gamePlanProgress,
  playbookProgress,
  practiceProgress,
  rosterProgress,
  criticalInsightsCount,
  daysUntilGame
}: GameReadyIndicatorProps) {
  // Determine color based on readiness
  const getColor = (value: number) => {
    if (value >= 75) return { fill: '#22c55e', text: 'text-green-600', bg: 'bg-green-50' }; // green-500
    if (value >= 40) return { fill: '#eab308', text: 'text-yellow-600', bg: 'bg-yellow-50' }; // yellow-500
    if (value >= 10) return { fill: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' }; // red-500
    return { fill: '#9ca3af', text: 'text-gray-500', bg: 'bg-gray-50' }; // gray-400
  };

  const colors = getColor(overallReadiness);

  // SVG donut chart calculations
  const size = 120;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (overallReadiness / 100) * circumference;
  const dashArray = `${progress} ${circumference - progress}`;

  return (
    <div className={`${colors.bg} border border-gray-200 rounded-xl p-4 overflow-visible`}>
      <div className="flex items-center gap-6 overflow-visible">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.fill}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${colors.text}`}>{overallReadiness}%</span>
            <span className="text-xs text-gray-500">Ready</span>
          </div>
        </div>

        {/* Progress Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Game Ready</h3>
              <div className="group relative inline-block">
                <button className="text-gray-400 hover:text-gray-600 p-1">
                  <Info className="w-4 h-4" />
                </button>
                <div className="absolute left-0 top-full mt-1 z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  <p className="font-semibold mb-2">How Readiness is Calculated:</p>
                  <p className="text-gray-300 mb-2">
                    Progress is based on completing checklist tasks in each category.
                  </p>
                  <div className="space-y-1 text-gray-300">
                    <div className="flex justify-between">
                      <span>Film</span>
                      <span className="font-mono">{filmProgress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Game Plan</span>
                      <span className="font-mono">{gamePlanProgress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Playbook</span>
                      <span className="font-mono">{playbookProgress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Plan Practice</span>
                      <span className="font-mono">{practiceProgress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Roster</span>
                      <span className="font-mono">{rosterProgress}%</span>
                    </div>
                  </div>
                  <p className="mt-2 text-gray-400 border-t border-gray-700 pt-2 text-center">
                    Average: <span className="text-white font-semibold">{overallReadiness}%</span>
                  </p>
                  {/* Arrow pointer */}
                  <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
              </div>
            </div>
            {daysUntilGame !== null && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
                {daysUntilGame === 0 ? 'Game Day!' :
                 daysUntilGame === 1 ? '1 day away' :
                 `${daysUntilGame} days`}
              </span>
            )}
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <ProgressItem label="Film" value={filmProgress} />
            <ProgressItem label="Game Plan" value={gamePlanProgress} />
            <ProgressItem label="Playbook" value={playbookProgress} />
            <ProgressItem label="Plan Practice" value={practiceProgress} />
            <ProgressItem label="Roster" value={rosterProgress} />
          </div>

          {/* Critical insights badge */}
          {criticalInsightsCount > 0 && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                {criticalInsightsCount} critical insight{criticalInsightsCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProgressItemProps {
  label: string;
  value: number;
}

function ProgressItem({ label, value }: ProgressItemProps) {
  const getBarColor = (v: number) => {
    if (v >= 75) return 'bg-green-500';
    if (v >= 40) return 'bg-yellow-500';
    if (v >= 10) return 'bg-red-500';
    return 'bg-gray-300';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600 w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(value)} rounded-full transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-gray-700 font-medium w-8 text-right">{value}%</span>
    </div>
  );
}
