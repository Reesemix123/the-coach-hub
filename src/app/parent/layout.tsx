import { createClient, createServiceClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { BottomTabBar } from '@/components/parent/BottomTabBar';
import { ParentTopBar } from '@/components/parent/ParentTopBar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Verify user is a parent
  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) {
    // Not a parent account, redirect to main app
    redirect('/');
  }

  // Fetch all active teams this parent has access to
  const { data: teamAccess } = await supabase
    .from('team_parent_access')
    .select('team_id, teams (id, name)')
    .eq('parent_id', parentProfile.id)
    .eq('status', 'active');

  const teams = (teamAccess || [])
    .map(ta => ta.teams as unknown as { id: string; name: string })
    .filter(Boolean);
  const teamId = teams.length > 0 ? teams[0].id : null;
  const parentName = `${parentProfile.first_name} ${parentProfile.last_name}`;

  // Fetch first athlete profile owned by this parent (for nav link)
  // Uses service client because athlete_profiles RLS subquery on parent_profiles
  // can fail due to recursive RLS evaluation. We already verified parentProfile.id above.
  const serviceClient = createServiceClient();
  const [{ data: athleteProfile }, { data: coachProfile }] = await Promise.all([
    serviceClient
      .from('athlete_profiles')
      .select('id, athlete_first_name')
      .eq('created_by_parent_id', parentProfile.id)
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hide the root layout coach navbar and payment banner when parent layout is active */}
      <style>{`
        #coach-nav { display: none !important; }
        #coach-banner { display: none !important; }
        main.pt-24 { padding-top: 0 !important; }
      `}</style>

      <ParentTopBar
        parentName={parentName}
        teams={teams}
        defaultTeamId={teamId}
      />

      {/* Main content — pb-24 keeps content clear of the tab bar */}
      <main className="pb-24">{children}</main>

      {/* iOS-style bottom tab bar */}
      <BottomTabBar
        teamId={teamId}
        teams={teams}
        parentName={parentName}
        athleteProfileId={athleteProfile?.id ?? null}
        athleteName={athleteProfile?.athlete_first_name ?? null}
        hasCoachProfile={!!coachProfile}
      />

      {/* PWA install prompt — parent-only, self-contained client component */}
      <InstallPrompt />
    </div>
  );
}
