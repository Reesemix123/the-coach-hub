'use client';

import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

export function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Share feedback"
        aria-label="Share feedback"
      >
        <MessageCircleQuestion size={20} />
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

export default FeedbackButton;
