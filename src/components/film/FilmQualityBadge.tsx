'use client';

import { useState, useEffect } from 'react';
import { Video, Info, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface FilmQualityBadgeProps {
  teamId: string;
  videoId: string;
  onAssessmentComplete?: (assessment: FilmQualityAssessment) => void;
  compact?: boolean;
  className?: string;
}

export interface FilmQualityAssessment {
  cameraAngle: string;
  stability: string;
  fieldVisibility: string;
  qualityScore: number;
  audio: {
    available: boolean;
    quality?: string;
    canHearWhistle?: boolean;
    canHearCadence?: boolean;
  };
  aiCapabilities: Record<string, { expected_confidence: string; notes?: string }>;
  improvementTips: string[];
}

function getQualityColor(score: number): string {
  if (score >= 8) return 'text-green-600 bg-green-50';
  if (score >= 6) return 'text-yellow-600 bg-yellow-50';
  if (score >= 4) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function getQualityLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  return 'Poor';
}

export function FilmQualityBadge({
  teamId,
  videoId,
  onAssessmentComplete,
  compact = false,
  className = '',
}: FilmQualityBadgeProps) {
  const [assessment, setAssessment] = useState<FilmQualityAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Check for existing assessment on mount
  useEffect(() => {
    checkExistingAssessment();
  }, [videoId]);

  const checkExistingAssessment = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/ai-tagging/quality-assessment?videoId=${videoId}`
      );
      const data = await response.json();

      if (data.exists && data.assessment) {
        setAssessment(data.assessment);
        onAssessmentComplete?.(data.assessment);
      }
    } catch (err) {
      console.error('Failed to check assessment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runAssessment = async () => {
    setIsAssessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/ai-tagging/quality-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Assessment failed');
      }

      setAssessment(data.assessment);
      onAssessmentComplete?.(data.assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assess video');
    } finally {
      setIsAssessing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking quality...</span>
      </div>
    );
  }

  // No assessment yet - show button to assess
  if (!assessment) {
    return (
      <div className={className}>
        <button
          onClick={runAssessment}
          disabled={isAssessing}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
        >
          {isAssessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Assessing film quality...</span>
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              <span>Assess Film Quality</span>
            </>
          )}
        </button>
        {error && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>
    );
  }

  // Compact badge view
  if (compact) {
    const colorClass = getQualityColor(assessment.qualityScore);
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium rounded-md ${colorClass} ${className}`}
        title={`Film Quality: ${assessment.qualityScore}/10`}
      >
        <Video className="h-3.5 w-3.5" />
        <span>{assessment.qualityScore}/10</span>
      </button>
    );
  }

  // Full assessment view
  const colorClass = getQualityColor(assessment.qualityScore);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Film Quality</span>
        </div>
        <div className={`px-3 py-1 text-sm font-semibold rounded-full ${colorClass}`}>
          {assessment.qualityScore}/10 - {getQualityLabel(assessment.qualityScore)}
        </div>
      </div>

      {/* Details Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Camera</div>
          <div className="text-sm font-medium text-gray-900 capitalize">
            {assessment.cameraAngle}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Stability</div>
          <div className="text-sm font-medium text-gray-900 capitalize">
            {assessment.stability}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Field View</div>
          <div className="text-sm font-medium text-gray-900 capitalize">
            {assessment.fieldVisibility}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Audio</div>
          <div className="text-sm font-medium text-gray-900">
            {assessment.audio.available ? (
              <span className="capitalize">{assessment.audio.quality}</span>
            ) : (
              <span className="text-gray-400">None</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Capabilities */}
      {assessment.aiCapabilities && Object.keys(assessment.aiCapabilities).length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            AI Detection Confidence
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(assessment.aiCapabilities).map(([field, cap]) => (
              <div
                key={field}
                className={`px-2 py-1 text-xs rounded ${
                  cap.expected_confidence === 'high'
                    ? 'bg-green-100 text-green-700'
                    : cap.expected_confidence === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
                title={cap.notes || ''}
              >
                {field.replace(/_/g, ' ')}:{' '}
                <span className="font-medium capitalize">{cap.expected_confidence}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Tips */}
      {assessment.improvementTips && assessment.improvementTips.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Tips for Better Film
          </div>
          <ul className="space-y-1">
            {assessment.improvementTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
