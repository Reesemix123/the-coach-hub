import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';

export default async function ParentDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get parent profile
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) {
    redirect('/');
  }

  // Get teams parent has access to — only need id for the redirect
  const { data: teamAccess } = await supabase
    .from('team_parent_access')
    .select('team_id, teams (id)')
    .eq('parent_id', parentProfile.id)
    .eq('status', 'active');

  const teams = (teamAccess || [])
    .map(ta => ta.teams as unknown as { id: string })
    .filter(Boolean);

  if (teams.length > 0) {
    redirect(`/parent/teams/${teams[0].id}/messages`);
  }

  // No teams — show empty state (the layout handles the chrome around this)
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Users className="w-12 h-12 text-gray-300 mx-auto" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">No Teams Yet</h2>
        <p className="mt-2 text-gray-600">
          You haven&apos;t been added to any teams yet. Ask your child&apos;s coach to send you an invitation.
        </p>
      </div>
    </div>
  );
}
