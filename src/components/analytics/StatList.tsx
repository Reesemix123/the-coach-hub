/**
 * StatList Component
 *
 * Compact stat display for "list" view mode.
 * Shows multiple stats in a dense, easy-to-scan format.
 *
 * @example
 * <StatList
 *   stats={[
 *     { label: 'Total Plays', value: '456' },
 *     { label: 'YPP', value: '5.2' },
 *     { label: 'Success Rate', value: '48%' },
 *   ]}
 *   columns={3}
 * />
 */

interface Stat {
  label: string;
  value: string | number;
}

interface StatListProps {
  stats: Stat[];
  columns?: 2 | 3 | 4;
}

export default function StatList({
  stats,
  columns = 3,
}: StatListProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-x-8 gap-y-3`}>
      {stats.map((stat, index) => (
        <div key={index} className="flex items-baseline justify-between border-b border-gray-200 pb-2">
          <span className="text-sm text-gray-600">{stat.label}:</span>
          <span className="text-sm font-semibold text-gray-900 ml-2">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
