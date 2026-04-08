'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface TimeTrackerProps {
  sessionId: string;
}

// ============================================
// HELPERS
// ============================================

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

// ============================================
// COMPONENT
// ============================================

export function TimeTracker({ sessionId }: TimeTrackerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * POSTs a new time log entry and starts the running timer.
   */
  const startNewLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-hub/sessions/${sessionId}/time`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Failed to create time log (${res.status})`);
      const data = (await res.json()) as { id: string };
      setActiveLogId(data.id);
      setIsRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    }
  }, [sessionId]);

  /**
   * PATCHes the active log with ended_at and stops the timer.
   */
  const pauseLog = useCallback(async () => {
    if (!activeLogId) return;
    try {
      const res = await fetch(
        `/api/test-hub/sessions/${sessionId}/time/${activeLogId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ended_at: new Date().toISOString() }),
        }
      );
      if (!res.ok) throw new Error(`Failed to pause time log (${res.status})`);
      setIsRunning(false);
      setActiveLogId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause timer');
    }
  }, [activeLogId, sessionId]);

  // Create the first log on mount
  useEffect(() => {
    startNewLog();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick every second while running; clear interval on unmount or pause
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleToggle = () => {
    if (isRunning) {
      pauseLog();
    } else {
      startNewLog();
    }
  };

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
      {/* Elapsed time */}
      <span className="font-mono text-lg text-gray-900 tabular-nums">
        {formatElapsed(elapsed)}
      </span>

      {/* Play / Pause toggle */}
      <button
        onClick={handleToggle}
        title={isRunning ? 'Pause timer' : 'Resume timer'}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isRunning
            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            : 'bg-black text-white hover:bg-gray-800'
        }`}
      >
        {isRunning ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Inline error (non-blocking) */}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
