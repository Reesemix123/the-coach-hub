'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ChevronRight,
  Clock,
  ArrowLeft,
  Loader2,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FeedbackReport {
  id: string;
  type: 'bug' | 'confusing' | 'missing' | 'suggestion';
  description: string;
  status: 'new' | 'reviewing' | 'need_info' | 'in_progress' | 'planned' | 'resolved' | 'wont_fix';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface FeedbackMessage {
  id: string;
  feedback_id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

const typeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  bug: { label: 'Something isn\'t working', icon: AlertCircle },
  confusing: { label: 'Something is confusing', icon: HelpCircle },
  missing: { label: 'Something is missing', icon: MessageSquare },
  suggestion: { label: 'Suggestion', icon: Lightbulb },
};

const statusLabels: Record<string, { label: string; color: string; description: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700', description: 'We received your feedback' },
  reviewing: { label: 'Reviewing', color: 'bg-yellow-100 text-yellow-700', description: 'We\'re looking into this' },
  need_info: { label: 'Need Info', color: 'bg-orange-100 text-orange-700', description: 'We need more information from you' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700', description: 'We\'re working on this' },
  planned: { label: 'Planned', color: 'bg-indigo-100 text-indigo-700', description: 'This is on our roadmap' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', description: 'This has been addressed' },
  wont_fix: { label: 'Won\'t Fix', color: 'bg-gray-100 text-gray-700', description: 'We won\'t be addressing this' },
};

export default function UserFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  async function fetchFeedbacks() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching feedbacks:', error);
        return;
      }

      setFeedbacks(data || []);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Your Feedback</h1>
        <p className="text-gray-600 mt-1">Track the status of feedback you've submitted</p>
      </div>

      {/* Feedback List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback yet</h3>
          <p className="text-gray-500 mb-6">
            Use the feedback button in the top navigation to share your thoughts with us.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => {
            const TypeIcon = typeLabels[feedback.type]?.icon || MessageSquare;

            return (
              <Link
                key={feedback.id}
                href={`/feedback/${feedback.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeIcon size={16} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {typeLabels[feedback.type]?.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[feedback.status]?.color}`}>
                        {statusLabels[feedback.status]?.label}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {feedback.description}
                    </p>

                    {feedback.admin_note && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Response from Youth Coach Hub:</p>
                        <p className="text-sm text-gray-700">{feedback.admin_note}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>Submitted {formatDate(feedback.created_at)}</span>
                    </div>
                  </div>

                  <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
