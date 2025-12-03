import { ReactNode } from 'react';
import { OnboardingWrapper } from '@/components/onboarding';

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamId } = await params;

  // OnboardingWrapper provides: tour modal, checklist sidebar, and state management
  return (
    <OnboardingWrapper teamId={teamId}>
      {children}
    </OnboardingWrapper>
  );
}
