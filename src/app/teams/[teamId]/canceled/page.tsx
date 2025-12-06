// Post-cancellation summary page - shows content built and resubscribe option
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Play,
  Film,
  Tag,
  Users,
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';

interface ContentSummary {
  plays_created: number;
  games_recorded: number;
  plays_tagged: number;
  videos_uploaded: number;
  total_film_minutes: number;
  practice_plans: number;
  players_on_roster: number;
  drives_analyzed: number;
}

interface TeamSummary {
  team_name: string;
  subscription_ended_at: string | null;
  days_until_data_unavailable: number | null;
  can_resubscribe: boolean;
  content_summary: ContentSummary;
}

export default function CanceledSubscriptionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchSummary();
  }, [teamId]);

  const fetchSummary = async () => {
    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Fetch team summary
      const response = await fetch(`/api/teams/${teamId}/summary`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load team summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load team summary');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <Link
            href="/"
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">No data available</div>
          <Link
            href="/"
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const content = summary.content_summary;
  const totalItems = content.plays_created +
    content.games_recorded +
    content.plays_tagged +
    content.players_on_roster;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Your Subscription Has Ended
              </h1>
              <p className="text-gray-600">
                {summary.team_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Countdown Warning */}
        {summary.days_until_data_unavailable !== null && summary.days_until_data_unavailable > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-amber-900 mb-1">
                  {summary.days_until_data_unavailable} Days Remaining
                </h2>
                <p className="text-sm text-amber-700">
                  Resubscribe within {summary.days_until_data_unavailable} days to regain full access to all your team data.
                  After this period, your data will no longer be accessible.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grace period expired */}
        {(summary.days_until_data_unavailable === null || summary.days_until_data_unavailable <= 0) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-red-900 mb-1">
                  Grace Period Expired
                </h2>
                <p className="text-sm text-red-700">
                  Your 30-day grace period has expired. Your data is no longer accessible.
                  Please contact support if you need assistance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Here's What You've Built with {summary.team_name}
          </h2>

          {totalItems > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {content.plays_created > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Play className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.plays_created}</div>
                  <div className="text-sm text-gray-600">Plays Created</div>
                </div>
              )}

              {content.games_recorded > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.games_recorded}</div>
                  <div className="text-sm text-gray-600">Games on File</div>
                </div>
              )}

              {content.plays_tagged > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Tag className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.plays_tagged}</div>
                  <div className="text-sm text-gray-600">Plays Tagged</div>
                </div>
              )}

              {content.videos_uploaded > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Film className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.videos_uploaded}</div>
                  <div className="text-sm text-gray-600">Videos Uploaded</div>
                </div>
              )}

              {content.total_film_minutes > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.total_film_minutes}</div>
                  <div className="text-sm text-gray-600">Minutes of Film</div>
                </div>
              )}

              {content.players_on_roster > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-5 w-5 text-teal-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.players_on_roster}</div>
                  <div className="text-sm text-gray-600">Players on Roster</div>
                </div>
              )}

              {content.drives_analyzed > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ArrowRight className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.drives_analyzed}</div>
                  <div className="text-sm text-gray-600">Drives Analyzed</div>
                </div>
              )}

              {content.practice_plans > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Calendar className="h-5 w-5 text-pink-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{content.practice_plans}</div>
                  <div className="text-sm text-gray-600">Practice Plans</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No content has been created yet.
            </div>
          )}
        </div>

        {/* Resubscribe CTA */}
        {summary.can_resubscribe && (
          <div className="bg-black text-white rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-3">
              Don't Lose Your Progress
            </h2>
            <p className="text-gray-300 mb-6 max-w-lg mx-auto">
              Resubscribe now to regain full access to your playbooks, game film, analytics, and all the work you've put into {summary.team_name}.
            </p>
            <Link
              href={`/pricing?team=${teamId}&resubscribe=true`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Resubscribe Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Data retention notice */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            Your data is retained on our servers and may be used in anonymized form to improve our AI features.
            See our <Link href="/privacy" className="underline hover:text-gray-900">Privacy Policy</Link> for details.
          </p>
        </div>
      </div>
    </div>
  );
}
