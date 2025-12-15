'use client';

import { useState, useEffect } from 'react';
import { PlayCircle, Clock } from 'lucide-react';
import { filmSessionService, ResumePosition } from '@/lib/services/film-session.service';

interface ResumeTaggingButtonProps {
  gameId: string;
  currentVideoId?: string;
  currentPositionMs?: number;
  onResume?: (videoId: string, positionMs: number) => void;
}

export function ResumeTaggingButton({
  gameId,
  currentVideoId,
  currentPositionMs,
  onResume
}: ResumeTaggingButtonProps) {
  const [resumePosition, setResumePosition] = useState<ResumePosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResumePosition();
  }, [gameId]);

  const loadResumePosition = async () => {
    try {
      setIsLoading(true);
      const position = await filmSessionService.getResumePosition(gameId);
      setResumePosition(position);
    } catch (error) {
      console.error('Error loading resume position:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = () => {
    if (resumePosition) {
      onResume?.(resumePosition.videoId, resumePosition.positionMs);
    }
  };

  // Don't show if no resume position or already at that position
  if (isLoading) {
    return null;
  }

  if (!resumePosition) {
    return null;
  }

  // Don't show if we're already at or near the resume position
  const isAtPosition =
    currentVideoId === resumePosition.videoId &&
    currentPositionMs !== undefined &&
    Math.abs(currentPositionMs - resumePosition.positionMs) < 5000; // Within 5 seconds

  if (isAtPosition) {
    return null;
  }

  return (
    <button
      onClick={handleResume}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
    >
      <PlayCircle className="w-4 h-4" />
      <span>Resume Where You Left Off</span>
      <span className="text-blue-200 text-xs">
        ({resumePosition.positionFormatted}
        {resumePosition.quarter && ` - Q${resumePosition.quarter}`})
      </span>
    </button>
  );
}

/**
 * Compact version for inline use
 */
export function ResumeTaggingBadge({
  gameId,
  onResume
}: {
  gameId: string;
  onResume?: (videoId: string, positionMs: number) => void;
}) {
  const [resumePosition, setResumePosition] = useState<ResumePosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResumePosition();
  }, [gameId]);

  const loadResumePosition = async () => {
    try {
      const position = await filmSessionService.getResumePosition(gameId);
      setResumePosition(position);
    } catch (error) {
      console.error('Error loading resume position:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !resumePosition) {
    return null;
  }

  return (
    <button
      onClick={() => onResume?.(resumePosition.videoId, resumePosition.positionMs)}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
      title={`Resume at ${resumePosition.positionFormatted} in ${resumePosition.videoName}`}
    >
      <Clock className="w-3 h-3" />
      <span>Resume: {resumePosition.positionFormatted}</span>
    </button>
  );
}
