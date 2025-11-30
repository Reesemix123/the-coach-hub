'use client';

import { useState } from 'react';
import { Plus, Check, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import MiniPlayDiagram from '@/components/MiniPlayDiagram';
import type { PlaybookPlay, PlayMatchScore, PlayRelationshipWithDetails, PlayDiagram } from '@/types/football';
import { KEY_INDICATORS } from '@/config/gamePlanCategories';

interface PlayCardProps {
  play: PlaybookPlay;
  matchScore?: PlayMatchScore;
  counters: PlayRelationshipWithDetails[];
  isInGamePlan: boolean;
  activeSituationLabel?: string;
  onAdd: () => void;
}

export default function PlayCard({
  play,
  matchScore,
  counters,
  isInGamePlan,
  activeSituationLabel,
  onAdd
}: PlayCardProps) {
  const [showDiagram, setShowDiagram] = useState(false);
  const { attributes, diagram } = play;

  // Get match score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  // Get key indicator label
  const getIndicatorLabel = (indicatorId?: string) => {
    if (!indicatorId) return null;
    const indicator = KEY_INDICATORS.find(i => i.id === indicatorId);
    return indicator?.label || indicatorId;
  };

  return (
    <div
      className={`p-3 border rounded-lg transition-colors ${
        isInGamePlan
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{play.play_code}</span>
            {matchScore && (
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded cursor-help ${getScoreColor(matchScore.score)}`}
                title={`Matchup Score: Projected success rate vs ${matchScore.confidence === 'high' ? 'this opponent (60+ plays analyzed)' : matchScore.confidence === 'medium' ? 'this opponent (20-59 plays analyzed)' : 'opponent (limited data)'}`}
              >
                {matchScore.score}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 truncate">{play.play_name}</p>
        </div>

        {/* Add button */}
        <button
          onClick={onAdd}
          disabled={isInGamePlan}
          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
            isInGamePlan
              ? 'text-green-600 cursor-default'
              : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title={isInGamePlan ? 'Already in game plan' : 'Add to game plan'}
        >
          {isInGamePlan ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Attributes */}
      <div className="flex flex-wrap gap-1 mb-2">
        {attributes?.formation && (
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {attributes.formation}
          </span>
        )}
        {attributes?.playType && (
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {attributes.playType}
          </span>
        )}
        {attributes?.passConcept && (
          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
            {attributes.passConcept}
          </span>
        )}
        {attributes?.runConcept && (
          <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
            {attributes.runConcept}
          </span>
        )}
      </div>

      {/* Match score reasoning */}
      {matchScore && matchScore.reasoning && matchScore.reasoning !== 'Standard matchup' && matchScore.reasoning !== 'Standard defensive matchup' && (
        <p className="text-xs text-gray-500 mb-2">
          {activeSituationLabel && <span className="font-medium text-blue-600">{activeSituationLabel}: </span>}
          {matchScore.reasoning}
        </p>
      )}

      {/* Play Diagram Toggle */}
      {diagram && (
        <div className="mb-2">
          <button
            onClick={() => setShowDiagram(!showDiagram)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showDiagram ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDiagram ? 'Hide Diagram' : 'Show Diagram'}
          </button>
          {showDiagram && (
            <div className="mt-2 flex justify-center">
              <MiniPlayDiagram
                diagram={diagram as PlayDiagram}
                attributes={attributes}
                width={180}
                height={100}
              />
            </div>
          )}
        </div>
      )}

      {/* Counter relationships */}
      {counters.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          {counters.map(counter => (
            <div key={counter.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Link2 className="w-3 h-3" />
              <span>
                Counter: <span className="font-medium">{counter.counter_play_code}</span>
                {counter.key_position && (
                  <span className="text-gray-500">
                    {' '}| Watch {counter.key_position}
                    {counter.key_indicator && ` for ${getIndicatorLabel(counter.key_indicator)}`}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
