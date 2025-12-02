'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import type { PrepPrompt } from '@/lib/services/game-prep-hub.service';
import { answerPrompt, clearPromptAnswer } from '@/lib/services/game-prep-hub.client';

interface GuidedPromptsSectionProps {
  prompts: PrepPrompt[];
  playbook: { play_code: string; play_name: string }[];
  onPromptUpdate: (prompt: PrepPrompt) => void;
}

export default function GuidedPromptsSection({
  prompts,
  playbook,
  onPromptUpdate
}: GuidedPromptsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group prompts by category
  const groupedPrompts: Record<string, PrepPrompt[]> = {};
  prompts.forEach(prompt => {
    if (!groupedPrompts[prompt.category]) {
      groupedPrompts[prompt.category] = [];
    }
    groupedPrompts[prompt.category].push(prompt);
  });

  // Sort prompts within each group
  Object.keys(groupedPrompts).forEach(category => {
    groupedPrompts[category].sort((a, b) => a.sort_order - b.sort_order);
  });

  const categoryOrder = [
    'offensive_identity',
    'defensive_identity',
    'special_teams_identity',
    'situational',
    'personnel',
    'adjustments'
  ];

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'offensive_identity':
        return 'Offensive Identity';
      case 'defensive_identity':
        return 'Defensive Identity';
      case 'special_teams_identity':
        return 'Special Teams';
      case 'situational':
        return 'Situational';
      case 'personnel':
        return 'Personnel';
      case 'adjustments':
        return 'Adjustments';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-4">
      {categoryOrder.map(category => {
        const categoryPrompts = groupedPrompts[category];
        if (!categoryPrompts || categoryPrompts.length === 0) return null;

        const answeredCount = categoryPrompts.filter(p => p.responded_at).length;

        return (
          <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {getCategoryLabel(category)}
              </h3>
              <span className="text-xs text-gray-500">
                {answeredCount}/{categoryPrompts.length} answered
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {categoryPrompts.map(prompt => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  playbook={playbook}
                  isExpanded={expandedId === prompt.id}
                  onToggle={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                  onUpdate={onPromptUpdate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PromptCardProps {
  prompt: PrepPrompt;
  playbook: { play_code: string; play_name: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (prompt: PrepPrompt) => void;
}

function PromptCard({ prompt, playbook, isExpanded, onToggle, onUpdate }: PromptCardProps) {
  const [response, setResponse] = useState(prompt.response_text || '');
  const [selectedPlays, setSelectedPlays] = useState<string[]>(prompt.response_plays || []);
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    prompt.response_text ? prompt.response_text.split('||') : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const isAnswered = !!prompt.responded_at;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let responseText: string | undefined;
      let responsePlays: string[] | undefined;

      if (prompt.response_type === 'text') {
        responseText = response;
      } else if (prompt.response_type === 'single_choice') {
        responseText = selectedOptions[0];
      } else if (prompt.response_type === 'multi_choice') {
        responseText = selectedOptions.join('||');
      } else if (prompt.response_type === 'play_select') {
        responsePlays = selectedPlays;
      }

      await answerPrompt(prompt.id, responseText, responsePlays);
      onUpdate({
        ...prompt,
        response_text: responseText || null,
        response_plays: responsePlays || null,
        responded_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save response:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await clearPromptAnswer(prompt.id);
      setResponse('');
      setSelectedPlays([]);
      setSelectedOptions([]);
      onUpdate({
        ...prompt,
        response_text: null,
        response_plays: null,
        responded_at: null
      });
    } catch (error) {
      console.error('Failed to clear response:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOption = (option: string) => {
    if (prompt.response_type === 'single_choice') {
      setSelectedOptions([option]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    }
  };

  const togglePlay = (playCode: string) => {
    setSelectedPlays(prev =>
      prev.includes(playCode)
        ? prev.filter(p => p !== playCode)
        : [...prev, playCode]
    );
  };

  return (
    <div className={`${isAnswered ? 'bg-green-50/50' : ''}`}>
      {/* Question header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {isAnswered ? (
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${isAnswered ? 'text-green-700' : 'text-gray-900'}`}>
              {prompt.question_text}
            </p>
            {isAnswered && !isExpanded && (
              <p className="text-xs text-green-600 mt-0.5 truncate max-w-md">
                {formatResponsePreview(prompt)}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Help text */}
          {prompt.help_text && (
            <p className="text-xs text-gray-500 mb-3 ml-7">{prompt.help_text}</p>
          )}

          {/* Response input based on type */}
          <div className="ml-7">
            {prompt.response_type === 'text' && (
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                rows={3}
              />
            )}

            {(prompt.response_type === 'single_choice' || prompt.response_type === 'multi_choice') && (
              <div className="space-y-2">
                {(prompt.response_options as string[] || []).map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option)}
                    className={`w-full px-3 py-2 text-sm text-left rounded-lg border transition-colors ${
                      selectedOptions.includes(option)
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {selectedOptions.includes(option) ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-gray-300" />
                      )}
                      {option}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {prompt.response_type === 'play_select' && (
              <div className="space-y-2">
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {playbook.map((play) => (
                    <button
                      key={play.play_code}
                      onClick={() => togglePlay(play.play_code)}
                      className={`w-full px-2 py-1.5 text-sm text-left rounded transition-colors ${
                        selectedPlays.includes(play.play_code)
                          ? 'bg-green-100 text-green-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {selectedPlays.includes(play.play_code) ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <span className="w-3 h-3" />
                        )}
                        <span className="font-mono text-xs text-gray-500">{play.play_code}</span>
                        <span className="truncate">{play.play_name}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {selectedPlays.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {selectedPlays.length} play{selectedPlays.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                Save
              </button>
              {isAnswered && (
                <button
                  onClick={handleClear}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatResponsePreview(prompt: PrepPrompt): string {
  if (prompt.response_plays && prompt.response_plays.length > 0) {
    return prompt.response_plays.slice(0, 3).join(', ') +
      (prompt.response_plays.length > 3 ? ` +${prompt.response_plays.length - 3} more` : '');
  }
  if (prompt.response_text) {
    const text = prompt.response_text.replace(/\|\|/g, ', ');
    return text.length > 60 ? text.slice(0, 57) + '...' : text;
  }
  return '';
}
