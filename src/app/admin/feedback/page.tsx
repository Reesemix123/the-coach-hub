'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Send,
  User,
  Monitor
} from 'lucide-react';

interface FeedbackReport {
  id: string;
  user_id: string;
  team_id: string | null;
  type: 'bug' | 'confusing' | 'missing' | 'suggestion';
  description: string;
  page_url: string | null;
  screenshot_url: string | null;
  browser_info: {
    userAgent?: string;
    platform?: string;
    screenWidth?: number;
    screenHeight?: number;
  } | null;
  status: 'new' | 'reviewing' | 'need_info' | 'in_progress' | 'planned' | 'resolved' | 'wont_fix';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  teams?: {
    id: string;
    name: string;
  };
  has_unread_reply?: boolean;
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

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  reviewing: { label: 'Reviewing', color: 'bg-yellow-100 text-yellow-700' },
  need_info: { label: 'Need Info', color: 'bg-orange-100 text-orange-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  planned: { label: 'Planned', color: 'bg-indigo-100 text-indigo-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  wont_fix: { label: 'Won\'t Fix', color: 'bg-gray-100 text-gray-700' },
};

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackReport | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    fetchFeedbacks();
  }, [filterType, filterStatus]);

  useEffect(() => {
    if (selectedFeedback) {
      setAdminNote(selectedFeedback.admin_note || '');
      setNewStatus(selectedFeedback.status);
      fetchMessages(selectedFeedback.id);
    }
  }, [selectedFeedback]);

  async function fetchFeedbacks() {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // First, fetch feedback reports with team data
      let query = supabase
        .from('feedback_reports')
        .select(`
          *,
          teams:team_id (id, name)
        `)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching feedbacks:', error);
        return;
      }

      // Fetch user profiles separately (user_id references auth.users, not profiles directly)
      const userIds = [...new Set((data || []).map(f => f.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

      // Check for unread replies and attach profile data
      const feedbacksWithReplies = await Promise.all(
        (data || []).map(async (feedback) => {
          const { data: latestMessage } = await supabase
            .from('feedback_messages')
            .select('sender_type, created_at')
            .eq('feedback_id', feedback.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...feedback,
            profiles: profilesMap.get(feedback.user_id) || null,
            has_unread_reply: latestMessage?.sender_type === 'user' &&
              new Date(latestMessage.created_at) > new Date(feedback.updated_at),
          };
        })
      );

      setFeedbacks(feedbacksWithReplies);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchMessages(feedbackId: string) {
    setIsLoadingMessages(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('feedback_messages')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleSaveAndNotify() {
    if (!selectedFeedback) return;

    setIsSaving(true);
    try {
      const supabase = createClient();

      // Update the feedback report
      const { error: updateError } = await supabase
        .from('feedback_reports')
        .update({
          status: newStatus,
          admin_note: adminNote || null,
        })
        .eq('id', selectedFeedback.id);

      if (updateError) {
        console.error('Error updating feedback:', updateError);
        return;
      }

      // Create notification for the user
      const statusChanged = newStatus !== selectedFeedback.status;
      const noteChanged = adminNote !== selectedFeedback.admin_note;

      if (statusChanged || noteChanged) {
        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedFeedback.user_id,
            type: 'feedback_update',
            reference_id: selectedFeedback.id,
            title: 'Your feedback was updated',
            body: `Status: ${statusLabels[newStatus].label}${adminNote ? ` - "${adminNote.substring(0, 50)}${adminNote.length > 50 ? '...' : ''}"` : ''}`,
          });

        if (notifyError) {
          console.error('Error creating notification:', notifyError);
        }
      }

      // Update local state
      setSelectedFeedback({
        ...selectedFeedback,
        status: newStatus as FeedbackReport['status'],
        admin_note: adminNote,
      });

      setFeedbacks(prev =>
        prev.map(f =>
          f.id === selectedFeedback.id
            ? { ...f, status: newStatus as FeedbackReport['status'], admin_note: adminNote }
            : f
        )
      );
    } catch (err) {
      console.error('Error saving feedback:', err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReply() {
    if (!selectedFeedback || !replyMessage.trim()) return;

    setIsSaving(true);
    try {
      const supabase = createClient();

      // Insert the message
      const { error: messageError } = await supabase
        .from('feedback_messages')
        .insert({
          feedback_id: selectedFeedback.id,
          sender_type: 'admin',
          message: replyMessage.trim(),
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        return;
      }

      // Create notification for the user
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedFeedback.user_id,
          type: 'feedback_reply',
          reference_id: selectedFeedback.id,
          title: 'New response to your feedback',
          body: replyMessage.substring(0, 100) + (replyMessage.length > 100 ? '...' : ''),
        });

      if (notifyError) {
        console.error('Error creating notification:', notifyError);
      }

      // Refresh messages
      await fetchMessages(selectedFeedback.id);
      setReplyMessage('');
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setIsSaving(false);
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

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function parseBrowserInfo(info: FeedbackReport['browser_info']): { browser: string; os: string } {
    if (!info?.userAgent) return { browser: 'Unknown', os: 'Unknown' };

    const ua = info.userAgent;
    let browser = 'Unknown';
    let os = info.platform || 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return { browser, os };
  }

  const filteredFeedbacks = feedbacks.filter(f =>
    f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Feedback</h1>
          <p className="text-gray-600 mt-1">Review and respond to user feedback</p>
        </div>

        <div className="flex gap-6">
          {/* List View */}
          <div className={`${selectedFeedback ? 'w-1/3' : 'w-full'} transition-all duration-300`}>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search feedback..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="all">All Types</option>
                  <option value="bug">Bug Reports</option>
                  <option value="confusing">Confusing</option>
                  <option value="missing">Missing</option>
                  <option value="suggestion">Suggestions</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="need_info">Need Info</option>
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                  <option value="resolved">Resolved</option>
                  <option value="wont_fix">Won't Fix</option>
                </select>
              </div>
            </div>

            {/* Feedback List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                </div>
              ) : filteredFeedbacks.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No feedback found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredFeedbacks.map((feedback) => {
                    const TypeIcon = typeLabels[feedback.type]?.icon || MessageSquare;
                    const isSelected = selectedFeedback?.id === feedback.id;

                    return (
                      <button
                        key={feedback.id}
                        onClick={() => setSelectedFeedback(feedback)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-gray-50 border-l-2 border-gray-900' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {feedback.has_unread_reply ? (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <TypeIcon size={14} className="text-gray-500" />
                              <span className="text-sm font-medium text-gray-900">
                                {typeLabels[feedback.type]?.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {feedback.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-500">
                                {feedback.profiles?.full_name || feedback.profiles?.email}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[feedback.status]?.color}`}>
                                {statusLabels[feedback.status]?.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatTimeAgo(feedback.created_at)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail View */}
          {selectedFeedback && (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-gray-100">
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
                >
                  <ArrowLeft size={16} />
                  Back to list
                </button>

                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const TypeIcon = typeLabels[selectedFeedback.type]?.icon || MessageSquare;
                    return <TypeIcon size={18} className="text-gray-700" />;
                  })()}
                  <h2 className="text-lg font-semibold text-gray-900">
                    {typeLabels[selectedFeedback.type]?.label}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                  <div className="flex items-center gap-1.5">
                    <User size={14} />
                    <span>{selectedFeedback.profiles?.full_name || selectedFeedback.profiles?.email}</span>
                  </div>
                  {selectedFeedback.teams && (
                    <span className="text-gray-400">
                      Team: {selectedFeedback.teams.name}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{formatDate(selectedFeedback.created_at)}</span>
                  </div>
                </div>

                {selectedFeedback.browser_info && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                    <Monitor size={12} />
                    <span>
                      {parseBrowserInfo(selectedFeedback.browser_info).browser} / {parseBrowserInfo(selectedFeedback.browser_info).os}
                    </span>
                    {selectedFeedback.page_url && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="truncate max-w-xs">{selectedFeedback.page_url}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* User's Message */}
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    User's Message
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {selectedFeedback.description}
                    </p>
                  </div>
                </div>

                {/* Screenshot */}
                {selectedFeedback.screenshot_url && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Screenshot
                    </h3>
                    <a
                      href={selectedFeedback.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={selectedFeedback.screenshot_url}
                        alt="Screenshot"
                        className="rounded-lg border border-gray-200 max-h-64 object-contain hover:opacity-90 transition-opacity"
                      />
                      <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <ExternalLink size={12} />
                        Click to view full size
                      </span>
                    </a>
                  </div>
                )}

                {/* Conversation */}
                {messages.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Conversation
                    </h3>
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.sender_type === 'admin'
                              ? 'bg-gray-900 text-white ml-8'
                              : 'bg-blue-50 text-gray-900 mr-8'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                            <span>{msg.sender_type === 'admin' ? 'You' : 'User'}</span>
                            <span>•</span>
                            <span>{formatDate(msg.created_at)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply (when need_info) */}
                {selectedFeedback.status === 'need_info' && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Send Reply
                    </h3>
                    <div className="flex gap-2">
                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        rows={2}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyMessage.trim() || isSaving}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="new">New</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="need_info">Need Info</option>
                      <option value="in_progress">In Progress</option>
                      <option value="planned">Planned</option>
                      <option value="resolved">Resolved</option>
                      <option value="wont_fix">Won't Fix</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Admin Note (visible to user)
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add a note for the user..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveAndNotify}
                    disabled={isSaving}
                    className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save & Notify User'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
