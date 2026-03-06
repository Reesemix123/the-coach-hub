'use client';

import { CreditCard, Users, Film, Clock } from 'lucide-react';

interface PlanStatusData {
  plan_tier: string;
  status: string;
  activated_at: string;
  expires_at: string;
  max_parents: number | null;
  parent_count: number;
  max_team_videos: number;
  team_videos_used: number;
  total_videos_remaining: number;
  days_remaining: number;
  coach_override_status: string | null;
}

interface PlanStatusCardProps {
  plan: PlanStatusData;
}

const TIER_LABELS: Record<string, string> = {
  rookie: 'Rookie',
  varsity: 'Varsity',
  all_conference: 'All-Conference',
  all_state: 'All-State',
};

/**
 * Displays the current active communication plan with usage stats for
 * parents, team videos, and season expiration.
 */
export function PlanStatusCard({ plan }: PlanStatusCardProps) {
  const tierLabel = TIER_LABELS[plan.plan_tier] ?? plan.plan_tier;

  const parentPercent = plan.max_parents
    ? Math.round((plan.parent_count / plan.max_parents) * 100)
    : 0;

  const videoPercent = Math.round((plan.team_videos_used / plan.max_team_videos) * 100);

  // Topup credits = whatever remains beyond the base allocation
  const baseRemaining = plan.max_team_videos - plan.team_videos_used;
  const topupRemaining = plan.total_videos_remaining - baseRemaining;

  const daysColor =
    plan.days_remaining > 30
      ? 'bg-green-50 text-green-700'
      : plan.days_remaining > 7
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900">{tierLabel} Plan</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Active since {new Date(plan.activated_at).toLocaleDateString()}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${daysColor}`}
            >
              <Clock className="w-3.5 h-3.5" />
              {plan.days_remaining} days left
            </span>
          </div>
        </div>

        {plan.coach_override_status && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {plan.coach_override_status === 'grace_period'
              ? 'Grace period active — coach subscription needs renewal'
              : 'Limited mode — video sharing and reports paused'}
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {/* Parents */}
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            Parents
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {plan.parent_count}
            <span className="text-sm font-normal text-gray-400">
              /{plan.max_parents ?? '\u221E'}
            </span>
          </p>
          {plan.max_parents && (
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${parentPercent > 90 ? 'bg-red-500' : 'bg-gray-900'}`}
                style={{ width: `${Math.min(parentPercent, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Team Videos */}
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Film className="w-4 h-4" />
            Team Videos
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {plan.team_videos_used}
            <span className="text-sm font-normal text-gray-400">/{plan.max_team_videos}</span>
          </p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${videoPercent > 90 ? 'bg-red-500' : 'bg-gray-900'}`}
              style={{ width: `${Math.min(videoPercent, 100)}%` }}
            />
          </div>
          {topupRemaining > 0 && (
            <p className="text-xs text-gray-400 mt-1">+{topupRemaining} from top-ups</p>
          )}
        </div>

        {/* Season Expiration */}
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock className="w-4 h-4" />
            Season Ends
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {new Date(plan.expires_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{new Date(plan.expires_at).getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
