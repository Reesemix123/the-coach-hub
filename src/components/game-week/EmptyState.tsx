import Link from 'next/link';
import { Trophy, Calendar, AlertCircle, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  type: 'off_season' | 'bye_week' | 'no_games';
  teamId: string;
}

interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export default function EmptyState({ type, teamId }: EmptyStateProps) {
  const config: Record<string, EmptyStateConfig> = {
    off_season: {
      icon: Trophy,
      title: 'Off-Season',
      description: 'Schedule your first game to start using Game Week Command Center.',
      actionLabel: 'Add Game',
      actionHref: `/teams/${teamId}/schedule`
    },
    bye_week: {
      icon: Calendar,
      title: 'Bye Week',
      description: 'No game this week. Great time to catch up on film and playbook work.',
      actionLabel: 'Review Playbook',
      actionHref: `/teams/${teamId}/playbook`
    },
    no_games: {
      icon: AlertCircle,
      title: 'No Games Scheduled',
      description: 'Add games to your schedule to use Game Week features.',
      actionLabel: 'Add Game',
      actionHref: `/teams/${teamId}/schedule`
    }
  };

  const { icon: Icon, title, description, actionLabel, actionHref } = config[type];

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <Icon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{description}</p>
      <Link
        href={actionHref}
        className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
