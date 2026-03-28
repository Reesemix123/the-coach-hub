import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <>
      <style>{`
        #coach-nav { display: none !important; }
        #coach-banner { display: none !important; }
        main.pt-24 { padding-top: 0 !important; }
      `}</style>
      {children}
    </>
  );
}
