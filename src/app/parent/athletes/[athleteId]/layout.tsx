import { createClient, createServiceClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ athleteId: string }>;
}

/**
 * Athlete profile layout — auth guard + ownership verification.
 *
 * Verifies that:
 * 1. The user is authenticated
 * 2. The user is a parent (has a parent_profiles row)
 * 3. The parent owns this athlete profile (created_by_parent_id) OR is linked
 *    to the athlete via player_parent_links → players → athlete_seasons
 *
 * Redirects to /parent if any check fails.
 */
export default async function AthleteProfileLayout({
  children,
  params,
}: LayoutProps) {
  const { athleteId } = await params;
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // 2. Verify parent identity — use service client (bypasses recursive RLS)
  const serviceSupabase = createServiceClient();
  const { data: parentProfile } = await serviceSupabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) redirect('/parent');

  // 3a. Check direct ownership — use service client
  const { data: ownedProfile } = await serviceSupabase
    .from('athlete_profiles')
    .select('id')
    .eq('id', athleteId)
    .eq('created_by_parent_id', parentProfile.id)
    .maybeSingle();

  if (ownedProfile) {
    return <>{children}</>;
  }

  // 3b. Check linked access: athlete_seasons → players → player_parent_links
  const { data: linkedSeason } = await serviceSupabase
    .from('athlete_seasons')
    .select(`
      id,
      roster_id,
      players!inner (
        id,
        player_parent_links!inner (
          parent_id
        )
      )
    `)
    .eq('athlete_profile_id', athleteId)
    .limit(1)
    .maybeSingle();

  // Check if any linked player_parent_links row matches this parent
  const linked = linkedSeason?.players as unknown as {
    id: string;
    player_parent_links: { parent_id: string }[];
  } | null;

  const hasLink = linked?.player_parent_links?.some(
    (l) => l.parent_id === parentProfile.id
  );

  if (hasLink) {
    return <>{children}</>;
  }

  // Not authorized — redirect
  redirect('/parent');
}
