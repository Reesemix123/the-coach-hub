'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Clock,
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FeedbackReport {
  id: string;
  type: 'bug' | 'confusing' | 'missing' | 'suggestion' | 'feature_request' | 'praise';
  description: string;
  screenshot_url: string | null;
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
  feature_request: { label: 'Feature request', icon: Lightbulb },
  praise: { label: 'Positive feedback', icon: MessageSquare },
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

export default function FeedbackDetailPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = use(params);
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchFeedback();
    markNotificationsRead();
  }, [feedbackId]);

  async function fetchFeedback() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Fetch feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('id', feedbackId)
        .eq('user_id', user.id)
        .single();

      if (feedbackError || !feedbackData) {
        console.error('Error fetching feedback:', feedbackError);
        router.push('/feedback');
        return;
      }

      setFeedback(feedbackData);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('feedback_messages')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      }

      setMessages(messagesData || []);
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function markNotificationsRead() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Mark all notifications for this feedback as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('reference_id', feedbackId)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  }

  async function handleSendReply() {
    if (!feedback || !replyMessage.trim()) return;

    setIsSending(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          feedback_id: feedback.id,
          sender_type: 'user',
          message: replyMessage.trim(),
        });

      if (error) {
        console.error('Error sending reply:', error);
        return;
      }

      // Refresh messages
      const { data: newMessages } = await supabase
        .from('feedback_messages')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      setMessages(newMessages || []);
      setReplyMessage('');
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setIsSending(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!feedback) {
    return null;
  }

  const TypeIcon = typeLabels[feedback.type]?.icon || MessageSquare;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/feedback"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back to Feedback
        </Link>
      </div>

      {/* Feedback Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TypeIcon size={20} className="text-gray-700" />
            <h1 className="text-lg font-semibold text-gray-900">
              {typeLabels[feedback.type]?.label}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className={`text-sm px-3 py-1 rounded-full ${statusLabels[feedback.status]?.color}`}>
              {statusLabels[feedback.status]?.label}
            </span>
            <span className="text-sm text-gray-500">
              {statusLabels[feedback.status]?.description}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <Clock size={14} />
            <span>Submitted {formatDate(feedback.created_at)}</span>
          </div>
        </div>

        {/* Your Message */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Your Message
          </h2>
          <p className="text-gray-900 whitespace-pre-wrap">
            {feedback.description}
          </p>

          {feedback.screenshot_url && (
            <div className="mt-4">
              <a
                href={feedback.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ImageIcon size={14} />
                View screenshot
              </a>
            </div>
          )}
        </div>

        {/* Conversation - all admin-user communication happens here */}
        {messages.length > 0 && (
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              Conversation
            </h2>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.sender_type === 'user'
                      ? 'bg-gray-100 ml-8'
                      : 'bg-gray-900 text-white mr-8'
                  }`}
                >
                  <div className={`flex items-center gap-2 text-xs mb-2 ${
                    msg.sender_type === 'user' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    <span>{msg.sender_type === 'user' ? 'You' : 'Youth Coach Hub'}</span>
                    <span>•</span>
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reply Form - show for active feedback (not resolved/won't fix) */}
        {feedback.status !== 'resolved' && feedback.status !== 'wont_fix' && (() => {
          const lastMessage = messages[messages.length - 1];
          const lastWasFromUser = lastMessage?.sender_type === 'user';
          const isNeedInfo = feedback.status === 'need_info';

          // If need_info and user already replied, show waiting message
          if (isNeedInfo && lastWasFromUser) {
            return (
              <div className="p-6 bg-blue-50">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-blue-600" />
                  <div>
                    <h2 className="text-sm font-medium text-blue-800">
                      Reply sent
                    </h2>
                    <p className="text-sm text-blue-700 mt-0.5">
                      We'll review your response and get back to you soon.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          // Show reply form - highlighted if need_info, normal otherwise
          const isUrgent = isNeedInfo && !lastWasFromUser;

          return (
            <div className={`p-6 ${isUrgent ? 'bg-orange-50' : 'bg-gray-50'}`}>
              {isUrgent && (
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={16} className="text-orange-600" />
                  <h2 className="text-sm font-medium text-orange-800">
                    We need more information from you
                  </h2>
                </div>
              )}
              {!isUrgent && (
                <h2 className="text-sm font-medium text-gray-700 mb-3">
                  Add a message
                </h2>
              )}

              <div className="space-y-3">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none ${
                    isUrgent
                      ? 'border-orange-200 focus:ring-orange-500'
                      : 'border-gray-200 focus:ring-gray-900'
                  }`}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || isSending}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    isUrgent
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Resolved Status */}
        {feedback.status === 'resolved' && (
          <div className="p-6 bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <div>
                <h2 className="text-sm font-medium text-green-800">
                  This has been resolved
                </h2>
                <p className="text-sm text-green-700 mt-0.5">
                  Thank you for your feedback!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
