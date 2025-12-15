'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { FilmAnalysisStatus } from '@/types/football';
import { filmSessionService, FilmAnalysisInfo } from '@/lib/services/film-session.service';

interface FilmAnalysisStatusPanelProps {
  gameId: string;
  initialStatus?: FilmAnalysisStatus;
  onStatusChange?: (status: FilmAnalysisStatus) => void;
}

export function FilmAnalysisStatusPanel({
  gameId,
  initialStatus,
  onStatusChange
}: FilmAnalysisStatusPanelProps) {
  const [info, setInfo] = useState<FilmAnalysisInfo | null>(null);
  const [isLoading, setIsLoading] = useState(!initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'complete' | 'uncomplete' | null>(null);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadInfo();
  }, [gameId]);

  const loadInfo = async () => {
    try {
      setIsLoading(true);
      const [analysisInfo, activityTime] = await Promise.all([
        filmSessionService.getAnalysisInfo(gameId),
        filmSessionService.getTimeSinceLastActivity(gameId)
      ]);
      setInfo(analysisInfo);
      setLastActivity(activityTime);
    } catch (error) {
      console.error('Error loading analysis info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    // First validate
    const validation = await filmSessionService.validateCanComplete(gameId);
    setWarnings(validation.warnings);

    if (validation.warnings.length > 0) {
      setConfirmAction('complete');
      setShowConfirm(true);
    } else {
      await doMarkComplete();
    }
  };

  const doMarkComplete = async () => {
    try {
      setIsUpdating(true);
      setShowConfirm(false);
      await filmSessionService.markAnalysisComplete(gameId);
      await loadInfo();
      onStatusChange?.('complete');
    } catch (error) {
      console.error('Error marking complete:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnmarkComplete = () => {
    setConfirmAction('uncomplete');
    setShowConfirm(true);
  };

  const doUnmarkComplete = async () => {
    try {
      setIsUpdating(true);
      setShowConfirm(false);
      await filmSessionService.markAnalysisInProgress(gameId);
      await loadInfo();
      onStatusChange?.('in_progress');
    } catch (error) {
      console.error('Error unmarking complete:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = (status: FilmAnalysisStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: FilmAnalysisStatus) => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  const getStatusColor = (status: FilmAnalysisStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-24" />
      </div>
    );
  }

  const status = info?.status || 'not_started';

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Film Analysis</h4>
            <p className="text-sm text-gray-600">{getStatusLabel(status)}</p>
          </div>
        </div>

        {status === 'complete' ? (
          <button
            onClick={handleUnmarkComplete}
            disabled={isUpdating}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Edit'
            )}
          </button>
        ) : (
          <button
            onClick={handleMarkComplete}
            disabled={isUpdating}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Mark Complete'
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
        <span>{info?.playCount || 0} plays tagged</span>
        {lastActivity && <span>Last activity: {lastActivity}</span>}
      </div>

      {/* Completion info */}
      {status === 'complete' && info?.completedAt && (
        <p className="mt-2 text-xs text-gray-500">
          Completed {new Date(info.completedAt).toLocaleString()}
        </p>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmAction === 'complete' ? 'Mark Analysis Complete?' : 'Resume Editing?'}
            </h3>

            {confirmAction === 'complete' && warnings.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Warnings:</p>
                    <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                      {warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-4">
              {confirmAction === 'complete'
                ? 'This will calculate final scores from your tagged plays. You can always edit later.'
                : 'This will allow you to continue editing the film analysis.'}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'complete' ? doMarkComplete : doUnmarkComplete}
                className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${
                  confirmAction === 'complete'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmAction === 'complete' ? 'Mark Complete' : 'Resume Editing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
