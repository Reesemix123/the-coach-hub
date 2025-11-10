// src/components/PracticeTimeline.tsx
'use client';

interface TimelinePeriod {
  id: string;
  name: string;
  duration_minutes: number;
  start_time: number | null;
  is_concurrent?: boolean;
  period_type?: string;
}

interface PracticeTimelineProps {
  periods: TimelinePeriod[];
  totalDuration?: number;
}

export default function PracticeTimeline({ periods, totalDuration }: PracticeTimelineProps) {
  if (periods.length === 0) {
    return null;
  }

  // Calculate positions for each period
  const periodsWithPositions = periods.map((period, index) => {
    let startTime = period.start_time;

    // If start_time is null, calculate sequential position
    if (startTime === null) {
      startTime = 0;
      for (let i = 0; i < index; i++) {
        const prevPeriod = periods[i];
        if (prevPeriod.start_time !== null) {
          startTime = Math.max(startTime, prevPeriod.start_time + prevPeriod.duration_minutes);
        }
      }
    }

    return {
      ...period,
      calculatedStart: startTime,
      calculatedEnd: startTime + period.duration_minutes
    };
  });

  // Calculate total timeline length
  const maxEndTime = Math.max(
    ...periodsWithPositions.map(p => p.calculatedEnd),
    totalDuration || 0
  );

  // Group concurrent periods into rows
  const rows: typeof periodsWithPositions[] = [];
  periodsWithPositions.forEach(period => {
    // Find a row where this period fits (no overlap)
    let placed = false;
    for (const row of rows) {
      const hasOverlap = row.some(p =>
        !(p.calculatedEnd <= period.calculatedStart || p.calculatedStart >= period.calculatedEnd)
      );
      if (!hasOverlap) {
        row.push(period);
        placed = true;
        break;
      }
    }
    // If no row fits, create new row
    if (!placed) {
      rows.push([period]);
    }
  });

  // Color mapping for period types
  const getColor = (type?: string) => {
    switch (type) {
      case 'warmup': return 'bg-yellow-400 border-yellow-600';
      case 'drill': return 'bg-blue-400 border-blue-600';
      case 'team': return 'bg-purple-400 border-purple-600';
      case 'special_teams': return 'bg-green-400 border-green-600';
      case 'conditioning': return 'bg-red-400 border-red-600';
      default: return 'bg-gray-400 border-gray-600';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">Practice Timeline</h3>
        <span className="text-sm text-gray-600">({maxEndTime} min total)</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Time markers */}
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>0:00</span>
          {[25, 50, 75].map(pct => {
            const time = Math.floor((maxEndTime * pct) / 100);
            return time > 0 && time < maxEndTime ? (
              <span key={pct}>{Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}</span>
            ) : null;
          })}
          <span>{Math.floor(maxEndTime / 60)}:{String(maxEndTime % 60).padStart(2, '0')}</span>
        </div>

        {/* Timeline rows */}
        <div className="space-y-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="relative h-16 bg-gray-50 rounded border border-gray-200">
              {row.map(period => {
                const leftPercent = (period.calculatedStart / maxEndTime) * 100;
                const widthPercent = (period.duration_minutes / maxEndTime) * 100;

                return (
                  <div
                    key={period.id}
                    className={`absolute top-1 bottom-1 ${getColor(period.period_type)} rounded shadow border-2 overflow-hidden`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`
                    }}
                  >
                    <div className="px-2 py-1 h-full flex flex-col justify-center">
                      <div className="text-xs font-semibold text-white truncate">
                        {period.name}
                      </div>
                      <div className="text-xs text-white/90">
                        {period.duration_minutes}m
                        {period.is_concurrent && ' ⚡'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-400 border border-yellow-600 rounded"></div>
            <span className="text-gray-600">Warmup</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-400 border border-blue-600 rounded"></div>
            <span className="text-gray-600">Drill</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-400 border border-purple-600 rounded"></div>
            <span className="text-gray-600">Team</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-400 border border-green-600 rounded"></div>
            <span className="text-gray-600">Special Teams</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-400 border border-red-600 rounded"></div>
            <span className="text-gray-600">Conditioning</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">⚡ = Concurrent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
