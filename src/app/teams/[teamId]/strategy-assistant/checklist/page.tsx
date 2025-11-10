// src/app/teams/[teamId]/strategy-assistant/checklist/page.tsx
// Preparation Checklist - Track game week preparation tasks

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CheckSquare, Circle, CheckCircle, AlertCircle } from 'lucide-react';
import ChecklistForm from './ChecklistForm';

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string }>;
}

export default async function PreparationChecklistPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { teamId } = resolvedParams;
  const gameId = resolvedSearchParams.game;

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  if (!gameId) {
    redirect(`/teams/${teamId}/strategy-assistant`);
  }

  // Get team and game
  const [teamResult, gameResult] = await Promise.all([
    supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single(),

    supabase
      .from('games')
      .select('opponent, date')
      .eq('id', gameId)
      .single()
  ]);

  if (!teamResult.data || !gameResult.data) {
    return <div>Team or game not found</div>;
  }

  const team = teamResult.data;
  const game = gameResult.data;

  // Calculate days until game
  const daysUntilGame = Math.ceil(
    (new Date(game.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch checklist items
  const { data: checklistItems } = await supabase
    .from('preparation_checklist')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .order('priority', { ascending: true })
    .order('sort_order', { ascending: true });

  const itemsByCategory = checklistItems?.reduce((acc: any, item: any) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {}) || {};

  const totalItems = checklistItems?.length || 0;
  const completedItems = checklistItems?.filter((item: any) => item.is_completed)?.length || 0;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Priority counts
  const mustDoItems = checklistItems?.filter((item: any) => item.priority === 1) || [];
  const shouldDoItems = checklistItems?.filter((item: any) => item.priority === 2) || [];
  const niceToHaveItems = checklistItems?.filter((item: any) => item.priority === 3) || [];

  const mustDoComplete = mustDoItems.filter((item: any) => item.is_completed).length;
  const shouldDoComplete = shouldDoItems.filter((item: any) => item.is_completed).length;

  // Status message based on progress
  let statusMessage = '';
  let statusColor = 'text-gray-600';

  if (progressPercent === 100) {
    statusMessage = '🎉 All preparation tasks complete! Ready for game day.';
    statusColor = 'text-green-700';
  } else if (daysUntilGame <= 2 && mustDoComplete < mustDoItems.length) {
    statusMessage = `⚠️ Game in ${daysUntilGame} days! ${mustDoItems.length - mustDoComplete} critical tasks remaining.`;
    statusColor = 'text-red-700';
  } else if (daysUntilGame <= 4 && progressPercent < 50) {
    statusMessage = `⏰ Game in ${daysUntilGame} days. Stay on track with your preparation.`;
    statusColor = 'text-yellow-700';
  } else {
    statusMessage = `${daysUntilGame} days until game. Keep up the good work!`;
    statusColor = 'text-gray-700';
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/teams/${teamId}/strategy-assistant?game=${gameId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Strategy Station
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
              Preparation Checklist
            </h1>
            <p className="text-lg text-gray-600">
              {team.name} vs {game.opponent}
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-semibold text-gray-900">{progressPercent}%</div>
            <div className="text-sm text-gray-600">{completedItems}/{totalItems} complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              progressPercent === 100 ? 'bg-green-600' : 'bg-gray-900'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Status Message */}
        <div className={`text-sm font-medium ${statusColor}`}>{statusMessage}</div>
      </div>

      {/* Priority Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-red-900">Must Do</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900">
            {mustDoComplete}/{mustDoItems.length}
          </div>
          <div className="text-xs text-red-700">Critical for game prep</div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-yellow-900">Should Do</span>
            <CheckSquare className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {shouldDoComplete}/{shouldDoItems.length}
          </div>
          <div className="text-xs text-yellow-700">Important tasks</div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900">Nice to Have</span>
            <Circle className="w-5 h-5 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {niceToHaveItems.filter((item: any) => item.is_completed).length}/{niceToHaveItems.length}
          </div>
          <div className="text-xs text-gray-600">Extra polish</div>
        </div>
      </div>

      {/* Empty State */}
      {totalItems === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Checklist Generated Yet</h2>
          <p className="text-gray-600 mb-6">
            A preparation checklist will be generated when you create a strategy report.
          </p>
          <Link
            href={`/teams/${teamId}/strategy-assistant?game=${gameId}`}
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Generate Strategy Report
          </Link>
        </div>
      )}

      {/* Checklist by Category */}
      {totalItems > 0 && (
        <div className="space-y-6">
          {Object.keys(itemsByCategory).map((category) => {
            const items = itemsByCategory[category];
            const categoryComplete = items.filter((item: any) => item.is_completed).length;

            return (
              <section key={category} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 capitalize">
                    {category.replace(/_/g, ' ')}
                  </h2>
                  <span className="text-sm text-gray-600">
                    {categoryComplete}/{items.length} complete
                  </span>
                </div>

                <ChecklistForm teamId={teamId} gameId={gameId} items={items} />
              </section>
            );
          })}

          {/* Completion Message */}
          {progressPercent === 100 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <div className="text-lg font-semibold text-green-900 mb-2">
                All Tasks Complete! 🎉
              </div>
              <div className="text-sm text-green-700 mb-4">
                You've completed all preparation tasks. Your team is ready for game day.
              </div>
              <Link
                href={`/teams/${teamId}/strategy-assistant?game=${gameId}`}
                className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
              >
                Review Full Strategy Report
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
