// src/app/teams/[teamId]/strategy-assistant/page.tsx
// Game Strategy Assistant - Rule-based strategic insights and game prep
// Future: AI-enabled chat interface

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Lightbulb, Target, TrendingUp, AlertCircle, CheckSquare, MessageSquare } from 'lucide-react';
import { generateStrategyReport, saveStrategyReport, type StrategyReport } from '@/lib/services/strategy-assistant.service';

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string }>;
}

export default async function StrategyAssistantPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { teamId } = resolvedParams;
  const gameId = resolvedSearchParams.game;

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get team
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single();

  if (!team) {
    return <div>Team not found</div>;
  }

  // If no game specified, show game selector
  if (!gameId) {
    const { data: upcomingGames } = await supabase
      .from('games')
      .select('id, opponent, date')
      .eq('team_id', teamId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(5);

    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link
            href={`/teams/${teamId}/game-week`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Game Week
          </Link>
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Strategy Station</h1>
          <p className="text-gray-600">AI-powered game preparation assistant (coming soon)</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Game</h2>
          <p className="text-gray-600 mb-6">Choose an upcoming game to generate strategic insights and preparation plans.</p>

          <div className="space-y-3">
            {upcomingGames?.map((game: any) => (
              <Link
                key={game.id}
                href={`/teams/${teamId}/strategy-assistant?game=${game.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">vs {game.opponent}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(game.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">Generate Report →</div>
                </div>
              </Link>
            ))}

            {(!upcomingGames || upcomingGames.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No upcoming games scheduled.{' '}
                <Link href={`/teams/${teamId}/schedule`} className="text-gray-900 underline">
                  Add a game
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get game details
  const { data: game } = await supabase
    .from('games')
    .select('opponent, date')
    .eq('id', gameId)
    .single();

  if (!game) {
    return <div>Game not found</div>;
  }

  // Check if report already exists (check for insights)
  const { data: existingInsights } = await supabase
    .from('strategic_insights')
    .select('id')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .limit(1);

  const reportExists = existingInsights && existingInsights.length > 0;

  // Generate report (always fresh for latest data)
  let report: StrategyReport;
  try {
    report = await generateStrategyReport(teamId, gameId);

    // Save to database if it doesn't exist yet
    if (!reportExists) {
      await saveStrategyReport(teamId, gameId, report);
    }
  } catch (error) {
    console.error('Error generating strategy report:', error);
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Generating Report</h2>
          <p className="text-red-700">
            Unable to generate strategy report. Please ensure you have tagged film for both your team and the opponent.
          </p>
        </div>
      </div>
    );
  }

  const daysUntilGame = Math.ceil(
    (new Date(game.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Data quality badge color
  const qualityColor =
    report.dataQuality === 'high' ? 'bg-green-100 text-green-800' :
    report.dataQuality === 'medium' ? 'bg-yellow-100 text-yellow-800' :
    'bg-gray-100 text-gray-800';

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/teams/${teamId}/game-week`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Game Week
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Strategy Station</h1>
            <p className="text-lg text-gray-600">
              {team.name} vs {game.opponent} • {daysUntilGame} days until game
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${qualityColor}`}>
              {report.dataQuality === 'high' ? '✓ High Confidence' :
               report.dataQuality === 'medium' ? '⚠ Medium Confidence' :
               '! Limited Data'}
            </span>
          </div>
        </div>

        {/* Data Quality Explanation */}
        {report.dataQuality !== 'high' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Limited Data Available:</strong> Only {report.filmTaggedCount.own} of your plays and{' '}
                {report.filmTaggedCount.opponent} opponent plays tagged. Tag more film for better insights.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Insights */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strategic Insights */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Strategic Insights</h2>
            </div>

            <div className="space-y-4">
              {report.insights.slice(0, 5).map((insight, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-900 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        insight.priority === 1
                          ? 'bg-red-100 text-red-800'
                          : insight.priority === 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Priority {insight.priority}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded capitalize">
                      {insight.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-gray-900 mt-3">{insight.title}</h3>
                  <p className="text-sm text-gray-600 mt-2">{insight.description}</p>

                  {insight.recommendations && insight.recommendations.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-1">Recommendations:</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {insight.recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {report.insights.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No insights generated. Tag more film to enable strategic analysis.
                </div>
              )}
            </div>
          </section>

          {/* Opponent Tendencies */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Opponent Tendencies</h2>
            </div>

            {report.opponentTendencies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Down</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Distance</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Run %</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Pass %</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Plays</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Success %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.opponentTendencies.map((tendency, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-900">
                          {tendency.down === 1 ? '1st' : tendency.down === 2 ? '2nd' : tendency.down === 3 ? '3rd' : '4th'}
                        </td>
                        <td className="py-2 px-3 text-gray-600 capitalize">{tendency.distanceRange}</td>
                        <td className="py-2 px-3 text-right text-gray-900">{tendency.runPct.toFixed(0)}%</td>
                        <td className="py-2 px-3 text-right text-gray-900">{tendency.passPct.toFixed(0)}%</td>
                        <td className="py-2 px-3 text-right text-gray-600">{tendency.playCount}</td>
                        <td className="py-2 px-3 text-right text-gray-900">{tendency.successRate.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No opponent film tagged. Scout opponent games to see their tendencies.
              </div>
            )}
          </section>

          {/* Team Strengths & Weaknesses */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Your Team Analysis</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-green-800 mb-2">Strengths</h3>
                <ul className="space-y-2">
                  {report.teamStrengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-gray-700">✓ {strength}</li>
                  ))}
                  {report.teamStrengths.length === 0 && (
                    <li className="text-sm text-gray-500">Tag more film to identify strengths</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-red-800 mb-2">Areas to Improve</h3>
                <ul className="space-y-2">
                  {report.teamWeaknesses.map((weakness, idx) => (
                    <li key={idx} className="text-sm text-gray-700">• {weakness}</li>
                  ))}
                  {report.teamWeaknesses.length === 0 && (
                    <li className="text-sm text-gray-500">Tag more film to identify weaknesses</li>
                  )}
                </ul>
              </div>
            </div>

            {report.topPlays.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Performing Plays</h3>
                <div className="space-y-2">
                  {report.topPlays.slice(0, 3).map((play, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 font-medium">{play.name || play.code}</span>
                      <span className="text-green-700">{play.successRate.toFixed(0)}% success</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-6">
          {/* Strategic Questions */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Strategic Questions</h2>
            </div>

            <div className="space-y-3">
              {report.strategicQuestions.slice(0, 3).map((q, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-medium text-gray-900 mb-1">{q.question}</div>
                  <div className="text-gray-500 text-xs">{q.category.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-3">
                {report.strategicQuestions.length} questions to guide your game plan
              </div>
              <Link
                href={`/teams/${teamId}/strategy-assistant/questions?game=${gameId}`}
                className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Answer Questions
              </Link>
            </div>
          </section>

          {/* Preparation Checklist */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Prep Checklist</h2>
            </div>

            <div className="space-y-2">
              {report.preparationChecklist.slice(0, 5).map((item, idx) => (
                <div key={idx} className="text-sm text-gray-700">
                  <span className="text-gray-400">☐</span> {item.item}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-3">
                {report.preparationChecklist.length} items to complete
              </div>
              <Link
                href={`/teams/${teamId}/strategy-assistant/checklist?game=${gameId}`}
                className="block w-full px-4 py-2 text-center text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Full Checklist
              </Link>
            </div>
          </section>

          {/* AI Chat Placeholder */}
          <section className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Strategy Coach</h2>
            <p className="text-sm text-gray-600 mb-4">
              Coming soon: Chat with AI to explore strategy insights, ask questions, and get personalized recommendations.
            </p>
            <button
              disabled
              className="w-full px-4 py-2 text-sm font-medium text-gray-400 bg-gray-200 rounded-lg cursor-not-allowed"
            >
              Chat Interface (Coming Soon)
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
