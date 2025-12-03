'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface SubscriptionSuccessBannerProps {
  teamName?: string;
}

export default function SubscriptionSuccessBanner({ teamName }: SubscriptionSuccessBannerProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-900">
              Subscription activated successfully!
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              {teamName ? `${teamName} is` : "Your team is"} now set up and ready to go. Start building your playbook!
            </p>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="p-1 text-green-600 hover:text-green-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
