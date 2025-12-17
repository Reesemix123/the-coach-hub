'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

/**
 * HelpChatButton
 *
 * Navigation button that links to the AI help chat page.
 */
export function HelpChatButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/help')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      title="AI Help Chat"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Help</span>
    </button>
  );
}

export default HelpChatButton;
