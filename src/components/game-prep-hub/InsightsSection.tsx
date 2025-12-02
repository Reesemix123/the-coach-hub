'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Target, Users, Clock, X, Check, ArrowRight } from 'lucide-react';
import type { PrepInsight } from '@/lib/services/game-prep-hub.service';
import { markInsightReviewed, dismissInsight } from '@/lib/services/game-prep-hub.client';

interface InsightsSectionProps {
  insights: PrepInsight[];
  prepPlanId: string;
  onInsightUpdate: (insight: PrepInsight) => void;
  onInsightDismiss: (insightId: string) => void;
}

export default function InsightsSection({
  insights,
  prepPlanId,
  onInsightUpdate,
  onInsightDismiss
}: InsightsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Sort by priority, then by reviewed status
  const sortedInsights = [...insights].sort((a, b) => {
    if (a.is_reviewed !== b.is_reviewed) return a.is_reviewed ? 1 : -1;
    return a.priority - b.priority;
  });

  const handleMarkReviewed = async (insight: PrepInsight, notes?: string) => {
    setSavingId(insight.id);
    try {
      await markInsightReviewed(insight.id, notes);
      onInsightUpdate({
        ...insight,
        is_reviewed: true,
        coach_notes: notes || null
      });
    } catch (error) {
      console.error('Failed to mark insight as reviewed:', error);
    } finally {
      setSavingId(null);
    }
  };

  const handleDismiss = async (insightId: string) => {
    setSavingId(insightId);
    try {
      await dismissInsight(insightId);
      onInsightDismiss(insightId);
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    } finally {
      setSavingId(null);
    }
  };

  if (insights.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">No insights available yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Insights are generated from your film analysis. Tag more plays to get better insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedInsights.map(insight => (
        <InsightCard
          key={insight.id}
          insight={insight}
          isExpanded={expandedId === insight.id}
          isSaving={savingId === insight.id}
          onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
          onMarkReviewed={handleMarkReviewed}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

interface InsightCardProps {
  insight: PrepInsight;
  isExpanded: boolean;
  isSaving: boolean;
  onToggle: () => void;
  onMarkReviewed: (insight: PrepInsight, notes?: string) => void;
  onDismiss: (insightId: string) => void;
}

function InsightCard({
  insight,
  isExpanded,
  isSaving,
  onToggle,
  onMarkReviewed,
  onDismiss
}: InsightCardProps) {
  const [notes, setNotes] = useState(insight.coach_notes || '');

  const getCategoryIcon = () => {
    switch (insight.category) {
      case 'opponent_tendency':
        return <Target className="w-4 h-4" />;
      case 'matchup_advantage':
        return <TrendingUp className="w-4 h-4" />;
      case 'matchup_concern':
        return <TrendingDown className="w-4 h-4" />;
      case 'own_strength':
        return <TrendingUp className="w-4 h-4" />;
      case 'own_weakness':
        return <AlertTriangle className="w-4 h-4" />;
      case 'situational':
        return <Clock className="w-4 h-4" />;
      case 'personnel':
        return <Users className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getPriorityColor = () => {
    if (insight.is_reviewed) return 'bg-gray-50 border-gray-200';
    switch (insight.priority) {
      case 1:
        return 'bg-red-50 border-red-200';
      case 2:
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getPriorityBadge = () => {
    if (insight.is_reviewed) {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Reviewed
        </span>
      );
    }
    switch (insight.priority) {
      case 1:
        return (
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            Critical
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            Important
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            Info
          </span>
        );
    }
  };

  return (
    <div className={`border rounded-lg transition-all ${getPriorityColor()} ${insight.is_reviewed ? 'opacity-75' : ''}`}>
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start justify-between text-left"
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 ${
            insight.is_reviewed ? 'text-gray-400' :
            insight.priority === 1 ? 'text-red-500' :
            insight.priority === 2 ? 'text-amber-500' :
            'text-blue-500'
          }`}>
            {getCategoryIcon()}
          </span>
          <div>
            <h3 className={`font-medium ${insight.is_reviewed ? 'text-gray-500' : 'text-gray-900'}`}>
              {insight.title}
            </h3>
            {!isExpanded && (
              <p className={`text-sm mt-0.5 line-clamp-1 ${insight.is_reviewed ? 'text-gray-400' : 'text-gray-600'}`}>
                {insight.description}
              </p>
            )}
          </div>
        </div>
        {getPriorityBadge()}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200/50 pt-3">
          <p className="text-sm text-gray-700 mb-3">{insight.description}</p>

          {/* Data stats if available */}
          {insight.data_json && Object.keys(insight.data_json).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(insight.data_json).map(([key, value]) => (
                <span key={key} className="px-2 py-1 bg-white/50 rounded text-xs text-gray-600">
                  {formatStatKey(key)}: {formatStatValue(value)}
                </span>
              ))}
            </div>
          )}

          {/* Suggested action */}
          {insight.suggested_action && (
            <div className="flex items-start gap-2 mb-3 p-2 bg-white/50 rounded">
              <ArrowRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">{insight.suggested_action}</p>
            </div>
          )}

          {/* Coach notes input */}
          {!insight.is_reviewed && (
            <div className="mb-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes about this insight..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                rows={2}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!insight.is_reviewed ? (
              <>
                <button
                  onClick={() => onMarkReviewed(insight, notes)}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Mark Reviewed
                </button>
                <button
                  onClick={() => onDismiss(insight.id)}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Dismiss
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-500">
                {insight.coach_notes ? `Notes: "${insight.coach_notes}"` : 'Reviewed'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function formatStatValue(value: unknown): string {
  if (typeof value === 'number') {
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
  return String(value);
}
