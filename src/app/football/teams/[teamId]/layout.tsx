import { ReactNode } from 'react';

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamLayout({ children }: TeamLayoutProps) {
  // Onboarding is now handled at the root layout level
  // The GlobalOnboardingProvider extracts teamId from the URL
  return <>{children}</>;
}
