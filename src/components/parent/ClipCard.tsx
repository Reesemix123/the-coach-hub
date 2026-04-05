'use client';

import { Lock } from 'lucide-react';
import { VideoPlayer } from '@/components/communication/videos/VideoPlayer';

interface ClipCardProps {
  playbackUrl: string | null;
  opponent: string;
  gameDate: string | null;
  playResult: string | null;
  coachNote: string | null;
  locked: boolean;
}

function resultBadgeColor(result: string | null): string {
  if (!result) return 'bg-gray-100 text-gray-600';
  const r = result.toLowerCase();
  if (r.includes('touchdown') || r.includes('td')) return 'bg-green-100 text-green-800';
  if (r.includes('complete') || r.includes('first_down')) return 'bg-blue-100 text-blue-800';
  if (r.includes('interception') || r.includes('fumble')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ClipCard({
  playbackUrl,
  opponent,
  gameDate,
  playResult,
  coachNote,
  locked,
}: ClipCardProps) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
      {/* Video or lock overlay */}
      <div className="relative aspect-video bg-gray-900">
        {locked || !playbackUrl ? (
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.04)] flex flex-col items-center justify-center gap-2">
            <Lock className="w-8 h-8 text-[#6b7280]" />
            <p className="text-xs text-[#6b7280]">
              {locked ? "Your coach hasn't shared this clip yet" : 'Processing…'}
            </p>
          </div>
        ) : (
          <VideoPlayer
            playbackUrl={playbackUrl}
            thumbnailUrl={null}
            title={`vs ${opponent}`}
          />
        )}
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#1a1a1a] flex-1 truncate">
            vs {opponent}
          </p>
          {playResult && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${resultBadgeColor(playResult)}`}
            >
              {playResult.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        {gameDate && (
          <p className="text-xs text-[#6b7280] mt-0.5">{formatDate(gameDate)}</p>
        )}
        {coachNote && !locked && (
          <p className="text-xs text-[#6b7280] mt-1.5 italic leading-relaxed">
            &ldquo;{coachNote}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
