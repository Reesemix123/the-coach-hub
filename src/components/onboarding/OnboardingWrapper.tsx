'use client';

import { ReactNode } from 'react';
import OnboardingProvider from './OnboardingProvider';
import OnboardingTourModal from './OnboardingTourModal';
import OnboardingChecklist from './OnboardingChecklist';

interface OnboardingWrapperProps {
  children: ReactNode;
  teamId: string;
}

export default function OnboardingWrapper({ children, teamId }: OnboardingWrapperProps) {
  return (
    <OnboardingProvider teamId={teamId}>
      <div className="flex min-h-screen">
        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>

        {/* Checklist sidebar */}
        <OnboardingChecklist teamId={teamId} />
      </div>

      {/* Tour modal */}
      <OnboardingTourModal />
    </OnboardingProvider>
  );
}
