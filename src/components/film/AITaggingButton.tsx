'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Upload, Brain } from 'lucide-react';
import type { TaggingTier } from '@/types/football';

interface AITaggingButtonProps {
  teamId: string;
  videoId: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  tier?: TaggingTier;
  onPredictionsReceived: (predictions: AITagPredictions, predictionId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export interface AITagPredictions {
  play_type?: { value: string; confidence: number };
  direction?: { value: string; confidence: number };
  result?: { value: string; confidence: number };
  yards_gained?: { value: number; confidence: number };
  formation?: { value: string; confidence: number };
  personnel?: { value: string; confidence: number };
  hash?: { value: string; confidence: number };
  down?: { value: number; confidence: number };
  distance?: { value: number; confidence: number };
  field_zone?: { value: string; confidence: number };
  quarter?: { value: number; confidence: number };
  motion?: { value: boolean; confidence: number };
  play_action?: { value: boolean; confidence: number };
  run_concept?: { value: string; confidence: number };
  pass_concept?: { value: string; confidence: number };
  // Special Teams fields
  special_teams_unit?: { value: string; confidence: number };
  kick_result?: { value: string; confidence: number };
  kick_distance?: { value: number; confidence: number };
  return_yards?: { value: number; confidence: number };
  is_touchback?: { value: boolean; confidence: number };
  is_fair_catch?: { value: boolean; confidence: number };
  is_muffed?: { value: boolean; confidence: number };
  punt_type?: { value: string; confidence: number };
  kickoff_type?: { value: string; confidence: number };
  reasoning?: string;
}

type AnalysisPhase = 'idle' | 'preparing' | 'uploading' | 'analyzing' | 'complete' | 'error';

interface PhaseConfig {
  icon: React.ReactNode;
  text: string;
  subtext?: string;
}

const PHASE_CONFIG: Record<AnalysisPhase, PhaseConfig> = {
  idle: {
    icon: <Sparkles className="h-4 w-4" />,
    text: 'AI Suggest',
  },
  preparing: {
    icon: <Upload className="h-4 w-4 animate-pulse" />,
    text: 'Preparing video...',
    subtext: 'Checking cache',
  },
  uploading: {
    icon: <Upload className="h-4 w-4 animate-bounce" />,
    text: 'Uploading to AI...',
    subtext: 'This may take a moment',
  },
  analyzing: {
    icon: <Brain className="h-4 w-4 animate-pulse" />,
    text: 'Analyzing play...',
    subtext: 'AI is watching',
  },
  complete: {
    icon: <Sparkles className="h-4 w-4" />,
    text: 'Done!',
  },
  error: {
    icon: <Sparkles className="h-4 w-4" />,
    text: 'Try Again',
  },
};

export function AITaggingButton({
  teamId,
  videoId,
  clipStartSeconds,
  clipEndSeconds,
  tier = 'quick',
  onPredictionsReceived,
  onError,
  disabled = false,
  className = '',
}: AITaggingButtonProps) {
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const isProcessing = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  const handleAnalyze = async () => {
    if (isProcessing || disabled) return;

    // Validate clip - 2 to 60 seconds for meaningful analysis
    const duration = clipEndSeconds - clipStartSeconds;
    if (duration < 2) {
      onError?.('Clip must be at least 2 seconds long');
      return;
    }
    if (duration > 60) {
      onError?.('Clip must be 60 seconds or less');
      return;
    }

    setPhase('preparing');
    setStatusMessage('');

    try {
      const response = await fetch(`/api/teams/${teamId}/ai-tagging/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          clipStartSeconds,
          clipEndSeconds,
          tier,
        }),
      });

      // Check if it's an SSE stream or error response
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        // Error response
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      if (!contentType?.includes('text/event-stream')) {
        throw new Error('Unexpected response type');
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);

            // Process complete event
            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);
                handleSSEEvent(eventType, data);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setPhase('error');
      onError?.(error instanceof Error ? error.message : 'Failed to analyze clip');
    }
  };

  const handleSSEEvent = (eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case 'status':
        const phase = data.phase as string;
        const message = data.message as string;

        if (phase === 'preparing') {
          setPhase('preparing');
        } else if (phase === 'uploaded') {
          // Was not cached, had to upload
          setPhase('analyzing');
          setStatusMessage(`Video uploaded`);
        } else if (phase === 'cached') {
          // Was cached, quick transition
          setPhase('analyzing');
          setStatusMessage('Video ready');
        } else if (phase === 'analyzing') {
          setPhase('analyzing');
        }
        break;

      case 'complete':
        setPhase('complete');
        const predictions = data.predictions as AITagPredictions;
        const predictionId = data.predictionId as string;
        onPredictionsReceived(predictions, predictionId);

        // Reset to idle after a moment
        setTimeout(() => setPhase('idle'), 1500);
        break;

      case 'error':
        setPhase('error');
        onError?.(data.error as string || 'Analysis failed');

        // Reset to idle after a moment
        setTimeout(() => setPhase('idle'), 3000);
        break;
    }
  };

  const config = PHASE_CONFIG[phase];

  return (
    <button
      onClick={handleAnalyze}
      disabled={isProcessing || disabled}
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-emerald-600
        text-white font-medium rounded-lg
        hover:bg-emerald-700
        disabled:opacity-70 disabled:cursor-not-allowed
        transition-all duration-200
        min-w-[140px] justify-center
        ${className}
      `}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        config.icon
      )}
      <span className="flex flex-col items-start">
        <span>{config.text}</span>
        {config.subtext && isProcessing && (
          <span className="text-xs opacity-75">{config.subtext}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Compact version of the AI tagging button for inline use
 */
export function AITaggingButtonCompact({
  teamId,
  videoId,
  clipStartSeconds,
  clipEndSeconds,
  tier = 'quick',
  onPredictionsReceived,
  onError,
  disabled = false,
  className = '',
}: AITaggingButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('');

  const handleAnalyze = async () => {
    if (isAnalyzing || disabled) return;

    const duration = clipEndSeconds - clipStartSeconds;
    if (duration < 2 || duration > 60) {
      onError?.('Clip must be 2-60 seconds');
      return;
    }

    setIsAnalyzing(true);
    setStatusText('Preparing...');

    try {
      const response = await fetch(`/api/teams/${teamId}/ai-tagging/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, clipStartSeconds, clipEndSeconds, tier }),
      });

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.phase === 'analyzing') setStatusText('Analyzing...');
              if (data.phase === 'uploaded') setStatusText('Analyzing...');
              if (data.predictions) {
                onPredictionsReceived(data.predictions, data.predictionId);
              }
              if (data.error) throw new Error(data.error);
            } catch {}
          }
        }
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed');
    } finally {
      setIsAnalyzing(false);
      setStatusText('');
    }
  };

  return (
    <button
      onClick={handleAnalyze}
      disabled={isAnalyzing || disabled}
      title="Get AI suggestions for this play"
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5
        text-sm font-medium rounded-md
        bg-emerald-100 text-emerald-700
        hover:bg-emerald-200
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{statusText || 'AI...'}</span>
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI</span>
        </>
      )}
    </button>
  );
}
