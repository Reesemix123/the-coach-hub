'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  LogOut,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';

interface Session {
  id: string;
  device_name: string;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  device_type: string;
  ip_address: string | null;
  location: string | null;
  created_at: string;
  last_active_at: string;
  is_current: boolean;
  is_revoked: boolean;
}

interface SessionsData {
  sessions: Session[];
  active_count: number;
  session_limit: number;
  can_add_more: boolean;
}

export default function ActiveSessionsManager() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/user/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      const response = await fetch(`/api/user/sessions?session_id=${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllOther = async () => {
    try {
      setRevokingAll(true);
      const response = await fetch('/api/user/sessions?revoke_all=true', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span>Error loading sessions</span>
        </div>
        <button
          onClick={fetchSessions}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600" />
              Active Sessions
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage devices where you&apos;re signed in
            </p>
          </div>
          {data && (
            <div className="text-sm text-gray-500">
              {data.active_count} of {data.session_limit} devices
            </div>
          )}
        </div>
      </div>

      {/* Session List */}
      <div className="divide-y divide-gray-100">
        {data?.sessions.map((session) => (
          <div
            key={session.id}
            className={`px-6 py-4 ${session.is_current ? 'bg-green-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    session.is_current
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {getDeviceIcon(session.device_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {session.device_name || 'Unknown Device'}
                    </span>
                    {session.is_current && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        This device
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                    {session.browser && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {session.browser}
                        {session.browser_version && ` ${session.browser_version}`}
                        {session.os && ` on ${session.os}`}
                        {session.os_version && ` ${session.os_version}`}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(session.last_active_at)}
                      </span>
                      {session.location && (
                        <span className="text-gray-400">
                          {session.location}
                        </span>
                      )}
                      {session.ip_address && (
                        <span className="text-gray-400 font-mono text-xs">
                          {session.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!session.is_current && (
                <button
                  onClick={() => revokeSession(session.id)}
                  disabled={revoking === session.id}
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {revoking === session.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Sign out
                </button>
              )}
            </div>
          </div>
        ))}

        {data?.sessions.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No active sessions found
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {data && data.sessions.length > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Sign out from all other devices
            </p>
            <button
              onClick={revokeAllOther}
              disabled={revokingAll}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
            >
              {revokingAll ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign out all other devices
            </button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {data && !data.can_add_more && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              You&apos;ve reached your device limit ({data.session_limit} devices).
              Sign out from another device to sign in here.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
