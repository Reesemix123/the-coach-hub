'use client';

import { AlertCircle } from 'lucide-react';
import { formatTimeMs } from '@/types/timeline';

interface GapIndicatorProps {
  resumeTimeMs: number | null;
  currentTimeMs: number;
}

export function GapIndicator({ resumeTimeMs, currentTimeMs }: GapIndicatorProps) {
  return (
    <div className="bg-black px-4 py-3 flex items-center justify-center gap-3 border-b border-gray-800">
      <AlertCircle className="text-yellow-400" size={18} />
      <p className="text-white text-sm">
        {resumeTimeMs !== null ? (
          <>
            Film resumes at{' '}
            <span className="font-mono font-semibold text-yellow-400">
              {formatTimeMs(resumeTimeMs)}
            </span>
            <span className="text-gray-400 ml-2">
              (in {formatTimeMs(resumeTimeMs - currentTimeMs)})
            </span>
          </>
        ) : (
          'No more film available for this camera'
        )}
      </p>
    </div>
  );
}

export default GapIndicator;
