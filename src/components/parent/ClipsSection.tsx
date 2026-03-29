'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ClipCard } from './ClipCard';

interface ClipData {
  id: string;
  seasonId: string;
  opponent: string;
  gameDate: string | null;
  playResult: string | null;
  playType: string | null;
  coachNote: string | null;
  playbackUrl: string | null;
  locked: boolean;
}

const UNIT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'offense', label: 'Offense' },
  { key: 'defense', label: 'Defense' },
  { key: 'special_teams', label: 'Special Teams' },
] as const;

interface ClipsSectionProps {
  athleteId: string;
  seasonId: string;
}

export function ClipsSection({ athleteId, seasonId }: ClipsSectionProps) {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchClips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parent/athletes/${athleteId}/clips?seasonId=${seasonId}`
      );
      if (res.ok) {
        const data = await res.json();
        setClips(data.clips ?? []);
      }
    } catch {
      // Fail silently — clips section is supplementary
    } finally {
      setLoading(false);
    }
  }, [athleteId, seasonId]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Simple filter by play type keyword (play_code or result contains unit keyword)
  const filtered = filter === 'all'
    ? clips
    : clips.filter((c) => {
        const text = `${c.playType ?? ''} ${c.playResult ?? ''}`.toLowerCase();
        if (filter === 'offense') return text.includes('run') || text.includes('pass') || text.includes('rush') || text.includes('screen') || text.includes('rpo');
        if (filter === 'defense') return text.includes('tackle') || text.includes('sack') || text.includes('interception') || text.includes('pressure') || text.includes('coverage');
        if (filter === 'special_teams') return text.includes('kick') || text.includes('punt') || text.includes('return') || text.includes('fg') || text.includes('pat');
        return true;
      });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (clips.length === 0) return null;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {UNIT_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              filter === key
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-gray-100 text-[#6b7280] hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((clip) => (
          <ClipCard
            key={clip.id}
            playbackUrl={clip.playbackUrl}
            opponent={clip.opponent}
            gameDate={clip.gameDate}
            playResult={clip.playResult}
            coachNote={clip.coachNote}
            locked={clip.locked}
          />
        ))}
      </div>

      {filtered.length === 0 && clips.length > 0 && (
        <p className="text-sm text-[#6b7280] text-center py-4">
          No clips match this filter
        </p>
      )}
    </div>
  );
}
