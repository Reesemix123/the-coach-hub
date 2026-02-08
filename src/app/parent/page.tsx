import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Video,
  Bell,
  FileText,
  MessageCircle,
  ChevronRight,
  Users,
} from 'lucide-react';

export default async function ParentDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get parent profile
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) {
    redirect('/');
  }

  // Get teams parent has access to
  const { data: teamAccess } = await supabase
    .from('team_parent_access')
    .select(`
      team_id,
      teams (
        id,
        name,
        colors
      )
    `)
    .eq('parent_id', parentProfile.id)
    .eq('status', 'active');

  // Get children (players linked to this parent)
  const { data: children } = await supabase
    .from('player_parent_links')
    .select(`
      relationship,
      players (
        id,
        first_name,
        last_name,
        jersey_number,
        team_id
      )
    `)
    .eq('parent_id', parentProfile.id);

  const teams = teamAccess?.map(ta => ta.teams).filter(Boolean) || [];
  const playersByTeam = new Map<string, typeof children>();

  children?.forEach(child => {
    if (child.players) {
      const teamId = (child.players as { team_id: string }).team_id;
      if (!playersByTeam.has(teamId)) {
        playersByTeam.set(teamId, []);
      }
      playersByTeam.get(teamId)?.push(child);
    }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome, {parentProfile.first_name}!
        </h1>
        <p className="mt-1 text-gray-600">
          Stay connected with your player&apos;s team
        </p>
      </div>

      {/* Teams */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">No Teams Yet</h2>
          <p className="mt-2 text-gray-600">
            You haven&apos;t been added to any teams yet. Ask your child&apos;s coach to send you an invitation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((team) => {
            const teamData = team as { id: string; name: string; colors?: { primary?: string } };
            const teamPlayers = playersByTeam.get(teamData.id) || [];

            return (
              <div
                key={teamData.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Team header */}
                <div
                  className="px-6 py-4 border-b border-gray-100"
                  style={{
                    backgroundColor: teamData.colors?.primary
                      ? `${teamData.colors.primary}10`
                      : '#f9fafb',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {teamData.name}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {teamPlayers.length === 1
                          ? `${(teamPlayers[0].players as { first_name: string }).first_name}'s team`
                          : `${teamPlayers.length} players`}
                      </p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-full"
                      style={{
                        backgroundColor: teamData.colors?.primary || '#6b7280',
                      }}
                    />
                  </div>
                </div>

                {/* Quick actions grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  <QuickAction
                    href={`/parent/teams/${teamData.id}/announcements`}
                    icon={Bell}
                    label="Announcements"
                    badge={0}
                  />
                  <QuickAction
                    href={`/parent/teams/${teamData.id}/calendar`}
                    icon={Calendar}
                    label="Schedule"
                  />
                  <QuickAction
                    href={`/parent/teams/${teamData.id}/videos`}
                    icon={Video}
                    label="Videos"
                  />
                  <QuickAction
                    href={`/parent/teams/${teamData.id}/reports`}
                    icon={FileText}
                    label="Reports"
                  />
                  <QuickAction
                    href={`/parent/teams/${teamData.id}/messages`}
                    icon={MessageCircle}
                    label="Messages"
                    badge={0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings link */}
      <div className="mt-8">
        <Link
          href="/parent/settings"
          className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-700">Account Settings</span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-gray-50 transition-colors relative"
    >
      <Icon className="w-6 h-6 text-gray-600" />
      <span className="text-sm text-gray-700">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-1/4 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}
