'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Users, Loader2 } from 'lucide-react';

interface ReadReceipt {
  parent_id: string;
  parent_name: string;
  email: string;
  read_at: string;
}

interface UnreadParent {
  parent_id: string;
  parent_name: string;
  email: string;
}

interface ReadReceiptStats {
  total_recipients: number;
  read_count: number;
  unread_count: number;
  read_receipts: ReadReceipt[];
  unread_parents: UnreadParent[];
}

interface ReadReceiptModalProps {
  announcementId: string;
  announcementTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReadReceiptModal({
  announcementId,
  announcementTitle,
  isOpen,
  onClose,
}: ReadReceiptModalProps) {
  const [stats, setStats] = useState<ReadReceiptStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'read' | 'unread'>('read');

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, announcementId]);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/communication/announcements/${announcementId}/stats`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch read receipts');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const readPercentage = stats
    ? stats.total_recipients > 0
      ? Math.round((stats.read_count / stats.total_recipients) * 100)
      : 0
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Read Receipts</h2>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{announcementTitle}</p>
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
        ) : stats ? (
          <>
            {/* Stats Bar */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {stats.read_count} of {stats.total_recipients} read
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {readPercentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${readPercentage}%` }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveTab('read')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'read'
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Read ({stats.read_count})
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'unread'
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Unread ({stats.unread_count})
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 px-6 py-3">
              {activeTab === 'read' ? (
                stats.read_receipts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    No one has read this yet
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {stats.read_receipts.map((receipt) => (
                      <li
                        key={receipt.parent_id}
                        className="py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {receipt.parent_name}
                            </p>
                            <p className="text-xs text-gray-500">{receipt.email}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatReadTime(receipt.read_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                stats.unread_parents.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    Everyone has read this announcement
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {stats.unread_parents.map((parent) => (
                      <li
                        key={parent.parent_id}
                        className="py-3 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {parent.parent_name}
                          </p>
                          <p className="text-xs text-gray-500">{parent.email}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function formatReadTime(timestamp: string): string {
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
