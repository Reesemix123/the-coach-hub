// src/app/teams/[teamId]/strategy-assistant/questions/page.tsx
// Strategic Questions - Interactive form for coaches to answer game prep questions

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MessageSquare, CheckCircle, Circle } from 'lucide-react';
import StrategicQuestionsForm from './StrategicQuestionsForm';

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string }>;
}

export default async function StrategicQuestionsPage({ params, searchParams }: PageProps) {
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

  // Fetch strategic questions
  const { data: questions } = await supabase
    .from('strategic_questions')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .order('sort_order', { ascending: true });

  const questionsByCategory = questions?.reduce((acc: any, q: any) => {
    if (!acc[q.category]) {
      acc[q.category] = [];
    }
    acc[q.category].push(q);
    return acc;
  }, {}) || {};

  const totalQuestions = questions?.length || 0;
  const answeredQuestions = questions?.filter((q: any) => q.coach_response)?.length || 0;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  const categories = [
    { id: 'offensive_strategy', label: 'Offensive Strategy', icon: '⚡' },
    { id: 'defensive_strategy', label: 'Defensive Strategy', icon: '🛡️' },
    { id: 'special_teams', label: 'Special Teams', icon: '🦶' },
    { id: 'personnel', label: 'Personnel', icon: '👥' },
    { id: 'situational', label: 'Situational', icon: '🎯' }
  ];

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
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Strategic Questions</h1>
            <p className="text-lg text-gray-600">
              {team.name} vs {game.opponent}
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-semibold text-gray-900">{progressPercent}%</div>
            <div className="text-sm text-gray-600">{answeredQuestions}/{totalQuestions} answered</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gray-900 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Empty State */}
      {totalQuestions === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Questions Generated Yet</h2>
          <p className="text-gray-600 mb-6">
            Strategic questions will be generated when you create a strategy report.
          </p>
          <Link
            href={`/teams/${teamId}/strategy-assistant?game=${gameId}`}
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Generate Strategy Report
          </Link>
        </div>
      )}

      {/* Questions by Category */}
      {totalQuestions > 0 && (
        <div className="space-y-8">
          {categories.map((category) => {
            const categoryQuestions = questionsByCategory[category.id] || [];
            if (categoryQuestions.length === 0) return null;

            const categoryAnswered = categoryQuestions.filter((q: any) => q.coach_response).length;

            return (
              <section key={category.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <h2 className="text-xl font-semibold text-gray-900">{category.label}</h2>
                  </div>
                  <span className="text-sm text-gray-600">
                    {categoryAnswered}/{categoryQuestions.length} answered
                  </span>
                </div>

                <StrategicQuestionsForm
                  teamId={teamId}
                  gameId={gameId}
                  questions={categoryQuestions}
                  category={category.id}
                />
              </section>
            );
          })}

          {/* Submit All Reminder */}
          {answeredQuestions > 0 && answeredQuestions < totalQuestions && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-sm text-yellow-800 mb-2">
                <strong>Great progress!</strong> You've answered {answeredQuestions} out of {totalQuestions} questions.
              </div>
              <div className="text-sm text-yellow-700">
                Complete the remaining {totalQuestions - answeredQuestions} questions to finalize your game strategy.
              </div>
            </div>
          )}

          {/* All Done */}
          {answeredQuestions === totalQuestions && totalQuestions > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <div className="text-lg font-semibold text-green-900 mb-2">
                All Questions Answered!
              </div>
              <div className="text-sm text-green-700 mb-4">
                You've completed your strategic questionnaire. Review your preparation checklist next.
              </div>
              <Link
                href={`/teams/${teamId}/strategy-assistant/checklist?game=${gameId}`}
                className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
              >
                View Preparation Checklist →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
