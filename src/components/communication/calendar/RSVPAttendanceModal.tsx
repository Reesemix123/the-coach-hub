'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, HelpCircle, Clock, Users, Loader2, Send } from 'lucide-react';

interface ParentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

interface RSVPRecord {
  id: string;
  event_id: string;
  parent_id: string;
  family_status: 'attending' | 'not_attending' | 'maybe';
  child_exceptions: Array<{
    player_id: string;
    status: string;
    note?: string;
  }>;
  note: string | null;
  responded_at: string;
  parent_profiles: ParentProfile;
}

interface RSVPSummary {
  attending: number;
  not_attending: number;
  maybe: number;
  no_response: number;
  total_parents: number;
}

interface RSVPAttendanceModalProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'attending' | 'not_attending' | 'maybe' | 'no_response';

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  attending: { label: 'Attending', icon: Check, color: 'text-green-700', bgColor: 'bg-green-50' },
  not_attending: { label: 'Not Attending', icon: XCircle, color: 'text-red-700', bgColor: 'bg-red-50' },
  maybe: { label: 'Maybe', icon: HelpCircle, color: 'text-amber-700', bgColor: 'bg-amber-50' },
  no_response: { label: 'No Response', icon: Clock, color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

export function RSVPAttendanceModal({
  eventId,
  eventTitle,
  isOpen,
  onClose,
}: RSVPAttendanceModalProps) {
  const [rsvps, setRsvps] = useState<RSVPRecord[]>([]);
  const [summary, setSummary] = useState<RSVPSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('attending');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRSVPs();
      setReminderResult(null);
    }
  }, [isOpen, eventId]);

  async function fetchRSVPs() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communication/events/${eventId}/rsvp`);
      if (!response.ok) {
        throw new Error('Failed to fetch RSVPs');
      }

      const data = await response.json();
      setRsvps(data.rsvps || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReminder() {
    try {
      setSendingReminder(true);
      setReminderResult(null);

      const response = await fetch(`/api/communication/events/${eventId}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to send reminders');
      }

      const data = await response.json();
      setReminderResult(data.message);
    } catch (err) {
      setReminderResult(err instanceof Error ? err.message : 'Failed to send reminders');
    } finally {
      setSendingReminder(false);
    }
  }

  if (!isOpen) return null;

  const filteredRsvps = rsvps.filter(r => r.family_status === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">RSVP Attendance</h2>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-4 gap-3 px-6 pt-5 pb-4">
                {(Object.keys(TAB_CONFIG) as TabType[]).map(tab => {
                  const config = TAB_CONFIG[tab];
                  const count = tab === 'no_response' ? summary.no_response :
                    tab === 'not_attending' ? summary.not_attending :
                    summary[tab as 'attending' | 'maybe'];
                  const Icon = config.icon;

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`
                        p-3 rounded-lg border text-center transition-all
                        ${activeTab === tab
                          ? 'border-gray-900 ring-1 ring-gray-900'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className={`flex items-center justify-center gap-1.5 mb-1 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{config.label}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Reminder Section (only for no_response tab) */}
            {activeTab === 'no_response' && summary && summary.no_response > 0 && (
              <div className="px-6 pb-3">
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    {summary.no_response} parent{summary.no_response !== 1 ? "s haven't" : " hasn't"} responded yet
                  </p>
                  <button
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {sendingReminder ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send Reminder
                  </button>
                </div>
                {reminderResult && (
                  <p className="mt-2 text-sm text-gray-600">{reminderResult}</p>
                )}
              </div>
            )}

            {/* RSVP List */}
            <div className="overflow-y-auto flex-1 px-6 py-3 border-t border-gray-100">
              {activeTab === 'no_response' ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    {summary?.no_response || 0} parent{(summary?.no_response || 0) !== 1 ? 's' : ''} haven&apos;t responded yet.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Use &quot;Send Reminder&quot; to nudge them.
                  </p>
                </div>
              ) : filteredRsvps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    No parents in this category
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredRsvps.map((rsvp) => {
                    const parent = rsvp.parent_profiles;
                    const statusConfig = TAB_CONFIG[rsvp.family_status as TabType];
                    const StatusIcon = statusConfig?.icon || HelpCircle;

                    return (
                      <li key={rsvp.id} className="py-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${statusConfig?.bgColor || 'bg-gray-100'} flex items-center justify-center`}>
                              <StatusIcon className={`w-4 h-4 ${statusConfig?.color || 'text-gray-500'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {parent.first_name} {parent.last_name}
                              </p>
                              <p className="text-xs text-gray-500">{parent.email}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">
                            {formatResponseTime(rsvp.responded_at)}
                          </span>
                        </div>

                        {/* Child exceptions */}
                        {rsvp.child_exceptions && rsvp.child_exceptions.length > 0 && (
                          <div className="ml-11 mt-2 space-y-1">
                            {rsvp.child_exceptions.map((exception, i) => (
                              <div
                                key={i}
                                className="text-xs text-gray-500 flex items-center gap-1"
                              >
                                <span className="font-medium">Exception:</span>
                                <span>{exception.status}</span>
                                {exception.note && <span>- {exception.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Note */}
                        {rsvp.note && (
                          <p className="ml-11 mt-1 text-xs text-gray-500 italic">
                            &quot;{rsvp.note}&quot;
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            {summary && (
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>
                    {summary.total_parents} total families ·{' '}
                    {summary.total_parents - summary.no_response} responded
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatResponseTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
