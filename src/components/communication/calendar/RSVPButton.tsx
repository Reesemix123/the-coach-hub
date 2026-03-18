'use client';

import { useState } from 'react';
import { Check, X, HelpCircle } from 'lucide-react';
import { FamilyRSVPModal } from './FamilyRSVPModal';

interface RSVPButtonProps {
  eventId: string;
  teamId: string;
  currentStatus: 'attending' | 'not_attending' | 'maybe' | null;
  onRSVPSubmitted?: (status: string) => void;
}

export function RSVPButton({
  eventId,
  teamId,
  currentStatus,
  onRSVPSubmitted,
}: RSVPButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmitted = (status: string) => {
    onRSVPSubmitted?.(status);
    setIsModalOpen(false);
  };

  // No response yet
  if (!currentStatus) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 rounded-lg px-4 py-2.5 font-medium transition-colors"
        >
          RSVP
        </button>
        <FamilyRSVPModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          eventId={eventId}
          teamId={teamId}
          onSubmitted={handleSubmitted}
        />
      </>
    );
  }

  // Has responded - show status badge
  const statusConfig = {
    attending: {
      icon: Check,
      label: 'Attending',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    not_attending: {
      icon: X,
      label: 'Not Attending',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    maybe: {
      icon: HelpCircle,
      label: 'Maybe',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  };

  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex flex-col items-center sm:items-start gap-1 group"
      >
        <div
          className={`${config.className} border rounded-full px-4 py-1.5 flex items-center gap-2 transition-all group-hover:shadow-sm`}
        >
          <Icon className="w-4 h-4" />
          <span className="font-medium text-sm">{config.label}</span>
        </div>
        <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
          Tap to change
        </span>
      </button>
      <FamilyRSVPModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventId={eventId}
        teamId={teamId}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}
