import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ athleteProfileId: null });

  const { data: parent } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!parent) return NextResponse.json({ athleteProfileId: null });

  const serviceClient = createServiceClient();
  const { data: athlete } = await serviceClient
    .from('athlete_profiles')
    .select('id, athlete_first_name, athlete_last_name')
    .eq('created_by_parent_id', parent.id)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    athleteProfileId: athlete?.id ?? null,
    athleteFirstName: athlete?.athlete_first_name ?? null,
    athleteLastName: athlete?.athlete_last_name ?? null,
  });
}
