import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import HomePage from '@/components/home/HomePage';

export default async function FootballPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  // Unauthenticated visitor — show full football homepage with features and pricing
  return <HomePage />;
}
