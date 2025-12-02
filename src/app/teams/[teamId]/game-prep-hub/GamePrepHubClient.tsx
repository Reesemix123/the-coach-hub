'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronRight, Lightbulb, CheckSquare, MessageSquare, StickyNote, Film, Clipboard, BookOpen, Users, Calendar, Dumbbell } from 'lucide-react';
import type { PrepPlanWithDetails, PrepInsight, PrepPrompt, PrepTask } from '@/lib/services/game-prep-hub.service';
import type { Game } from '@/types/football';
import InsightsSection from '@/components/game-prep-hub/InsightsSection';
import PrepChecklistSidebar from '@/components/game-prep-hub/PrepChecklistSidebar';
import GuidedPromptsSection from '@/components/game-prep-hub/GuidedPromptsSection';
import CoachNotesSection from '@/components/game-prep-hub/CoachNotesSection';

interface GamePrepHubClientProps {
  teamId: string;
  teamName: string;
  gameId: string;
  game: Game;
  prepPlan: PrepPlanWithDetails;
  playbook: { play_code: string; play_name: string }[];
  daysUntilGame: number;
}

export default function GamePrepHubClient({
  teamId,
  teamName,
  gameId,
  game,
  prepPlan,
  playbook,
  daysUntilGame
}: GamePrepHubClientProps) {
  const router = useRouter();
  const [insights, setInsights] = useState<PrepInsight[]>(prepPlan.insights);
  const [prompts, setPrompts] = useState<PrepPrompt[]>(prepPlan.prompts);
  const [tasks, setTasks] = useState<PrepTask[]>(prepPlan.tasks);
  const [notes, setNotes] = useState({
    general: prepPlan.general_notes || '',
    offensive: prepPlan.offensive_notes || '',
    defensive: prepPlan.defensive_notes || '',
    special_teams: prepPlan.special_teams_notes || ''
  });

  // Collapsible section states - default to collapsed
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Progress tracking for display
  const promptsAnswered = prompts.filter(p => p.responded_at).length;
  const criticalInsights = insights.filter(i => i.priority === 1 && !i.is_reviewed).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push(`/teams/${teamId}/game-week?game=${gameId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Game Prep Hub
          </h1>
          <p className="text-sm text-gray-600">
            vs {game.opponent} • {game.date ? formatDate(game.date) : 'Date TBD'}
          </p>
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex gap-6">
        {/* Left Column - Checklist Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6">
            <PrepChecklistSidebar
              tasks={tasks}
              prepPlanId={prepPlan.id}
              teamId={teamId}
              gameId={gameId}
              daysUntilGame={daysUntilGame}
              onTaskUpdate={(updatedTask) => {
                setTasks(prev => prev.map(t =>
                  t.id === updatedTask.id ? updatedTask : t
                ));
              }}
              onTaskCreate={(newTask) => {
                setTasks(prev => [...prev, newTask]);
              }}
              onTaskDelete={(taskId) => {
                setTasks(prev => prev.filter(t => t.id !== taskId));
              }}
            />
          </div>
        </div>

        {/* Center Column - Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Strategic Insights */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setInsightsExpanded(!insightsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Strategic Insights</h2>
                {criticalInsights > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    {criticalInsights} critical
                  </span>
                )}
              </div>
              {insightsExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {insightsExpanded && (
              <div className="px-4 pb-4">
                <InsightsSection
                  insights={insights}
                  prepPlanId={prepPlan.id}
                  onInsightUpdate={(updatedInsight) => {
                    setInsights(prev => prev.map(i =>
                      i.id === updatedInsight.id ? updatedInsight : i
                    ));
                  }}
                  onInsightDismiss={(insightId) => {
                    setInsights(prev => prev.filter(i => i.id !== insightId));
                  }}
                />
              </div>
            )}
          </section>

          {/* Guided Prompts */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setQuestionsExpanded(!questionsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Strategic Questions</h2>
                <span className="text-sm text-gray-500">
                  {promptsAnswered}/{prompts.length} answered
                </span>
              </div>
              {questionsExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {questionsExpanded && (
              <div className="px-4 pb-4">
                <GuidedPromptsSection
                  prompts={prompts}
                  playbook={playbook}
                  onPromptUpdate={(updatedPrompt) => {
                    setPrompts(prev => prev.map(p =>
                      p.id === updatedPrompt.id ? updatedPrompt : p
                    ));
                  }}
                />
              </div>
            )}
          </section>

          {/* Coach Notes */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-gray-900">Coach Notes</h2>
              </div>
              {notesExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {notesExpanded && (
              <div className="px-4 pb-4">
                <CoachNotesSection
                  prepPlanId={prepPlan.id}
                  notes={notes}
                  onNotesUpdate={(category, value) => {
                    setNotes(prev => ({ ...prev, [category]: value }));
                  }}
                />
              </div>
            )}
          </section>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="w-44 flex-shrink-0">
          <div className="sticky top-6">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="space-y-1">
                <Link
                  href={`/teams/${teamId}/film`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <Film className="w-4 h-4 text-gray-400" />
                  Film Room
                </Link>
                <Link
                  href={`/teams/${teamId}/game-plan?game=${gameId}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <Clipboard className="w-4 h-4 text-gray-400" />
                  Game Plan
                </Link>
                <Link
                  href={`/teams/${teamId}/playbook`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  Playbook
                </Link>
                <Link
                  href={`/teams/${teamId}/practice`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <Dumbbell className="w-4 h-4 text-gray-400" />
                  Plan Practice
                </Link>
                <Link
                  href={`/teams/${teamId}/players`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <Users className="w-4 h-4 text-gray-400" />
                  Roster
                </Link>
                <Link
                  href={`/teams/${teamId}/schedule`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Schedule
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
