// src/app/teams/[teamId]/strategy-assistant/questions/StrategicQuestionsForm.tsx
// Client component for answering strategic questions

'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, Circle, Save } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  coach_response: string | null;
  response_options: any;
  responded_at: string | null;
}

interface Props {
  teamId: string;
  gameId: string;
  questions: Question[];
  category: string;
}

export default function StrategicQuestionsForm({ teamId, gameId, questions, category }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    questions.forEach((q) => {
      initial[q.id] = q.coach_response || '';
    });
    return initial;
  });

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const supabase = createClient();

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value
    }));
    // Clear saved indicator when user starts typing again
    if (saved[questionId]) {
      setSaved((prev) => ({
        ...prev,
        [questionId]: false
      }));
    }
  };

  const handleSaveResponse = async (questionId: string) => {
    setSaving((prev) => ({ ...prev, [questionId]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('strategic_questions')
        .update({
          coach_response: responses[questionId] || null,
          responded_at: responses[questionId] ? new Date().toISOString() : null,
          responded_by: user?.id || null
        })
        .eq('id', questionId);

      if (error) throw error;

      setSaved((prev) => ({ ...prev, [questionId]: true }));

      // Clear saved indicator after 2 seconds
      setTimeout(() => {
        setSaved((prev) => ({ ...prev, [questionId]: false }));
      }, 2000);
    } catch (error) {
      console.error('Error saving response:', error);
      alert('Failed to save response. Please try again.');
    } finally {
      setSaving((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, questionId: string) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveResponse(questionId);
    }
  };

  return (
    <div className="space-y-6">
      {questions.map((question, idx) => {
        const hasResponse = !!responses[question.id];
        const isSaving = saving[question.id];
        const isSaved = saved[question.id];

        return (
          <div
            key={question.id}
            className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start gap-3 mb-3">
              {hasResponse ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <label className="block text-base font-medium text-gray-900 mb-1">
                  {idx + 1}. {question.question_text}
                </label>

                {/* Multiple Choice Options (if provided) */}
                {question.response_options && Array.isArray(question.response_options) && (
                  <div className="space-y-2 mb-3">
                    {question.response_options.map((option: string, optIdx: number) => (
                      <label
                        key={optIdx}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={responses[question.id] === option}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                        />
                        {option}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value=""
                        checked={
                          responses[question.id] !== '' &&
                          !question.response_options?.includes(responses[question.id])
                        }
                        onChange={() => {
                          // Clear to allow custom input
                          handleResponseChange(question.id, '');
                        }}
                        className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                      />
                      Other (specify below)
                    </label>
                  </div>
                )}

                {/* Free-form Text Response */}
                <textarea
                  value={responses[question.id] || ''}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, question.id)}
                  placeholder={
                    question.response_options
                      ? 'Or enter your own answer...'
                      : 'Enter your response...'
                  }
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                />

                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-500">
                    {question.responded_at && (
                      <span>
                        Last saved:{' '}
                        {new Date(question.responded_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleSaveResponse(question.id)}
                    disabled={isSaving}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isSaved
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Response'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
        <strong>Tip:</strong> Press Cmd/Ctrl + Enter to quickly save your response.
      </div>
    </div>
  );
}
