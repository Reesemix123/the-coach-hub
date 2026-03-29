'use client';

import { useRouter, usePathname } from 'next/navigation';

interface Season {
  id: string;
  seasonYear: number;
  sport: string;
  teamName: string;
}

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string;
}

export function SeasonSelector({ seasons, selectedSeasonId }: SeasonSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const season = seasons.find((s) => s.id === e.target.value);
    if (season) {
      router.push(`${pathname}?season=${season.seasonYear}`);
    }
  }

  return (
    <select
      value={selectedSeasonId}
      onChange={handleChange}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]"
    >
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.seasonYear} {s.sport.charAt(0).toUpperCase() + s.sport.slice(1)} — {s.teamName}
        </option>
      ))}
    </select>
  );
}
