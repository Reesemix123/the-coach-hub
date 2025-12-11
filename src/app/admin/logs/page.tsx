'use client';

// /admin/logs - Logs & Audit Dashboard
// Platform admin view of audit logs, error logs, and auth logs

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  Shield,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Activity
} from 'lucide-react';

// Types
type LogTab = 'audit' | 'errors' | 'auth';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  stack_trace: string | null;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  source: string | null;
  endpoint: string | null;
}

interface AuthLogEntry {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  status: 'success' | 'failure';
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

// Tab Button Component
function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  badge
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
          active ? 'bg-white text-gray-900' : 'bg-gray-200 text-gray-700'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color = 'gray'
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'gray' | 'red' | 'yellow' | 'green';
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// Audit Logs Table Component
function AuditLogsTable({ logs }: { logs: AuditLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No audit logs found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Actor
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Action
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Target
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-600">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-900">{log.actor_email || 'Unknown'}</span>
              </td>
              <td className="py-3 px-4">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                  {log.action}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">
                {log.target_type && (
                  <span>
                    {log.target_type}
                    {log.target_name && `: ${log.target_name}`}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Error Logs Table Component
function ErrorLogsTable({ logs }: { logs: ErrorLogEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No error logs found
      </div>
    );
  }

  const severityColors = {
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700'
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
        >
          <div
            className="p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityColors[log.severity]}`}>
                    {log.severity.toUpperCase()}
                  </span>
                  {log.source && (
                    <span className="text-xs text-gray-500">{log.source}</span>
                  )}
                  {log.endpoint && (
                    <span className="text-xs text-gray-400 truncate max-w-xs">{log.endpoint}</span>
                  )}
                </div>
                <p className="text-sm text-gray-900 truncate">{log.message}</p>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          {expandedId === log.id && log.stack_trace && (
            <div className="px-4 pb-4">
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                {log.stack_trace}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Auth Logs Table Component
function AuthLogsTable({ logs }: { logs: AuthLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No auth logs found
      </div>
    );
  }

  const actionLabels: Record<string, string> = {
    login: 'Login',
    logout: 'Logout',
    signup: 'Sign Up',
    password_reset: 'Password Reset',
    password_change: 'Password Change',
    email_change: 'Email Change',
    mfa_enable: 'MFA Enabled',
    mfa_disable: 'MFA Disabled',
    token_refresh: 'Token Refresh',
    session_end: 'Session End'
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Action
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              IP Address
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-600">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-900">{log.user_email || 'Unknown'}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-700">
                  {actionLabels[log.action] || log.action}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {log.status}
                </span>
                {log.failure_reason && (
                  <p className="text-xs text-gray-500 mt-1">{log.failure_reason}</p>
                )}
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">
                {log.ip_address || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Pagination Component
function Pagination({
  page,
  totalPages,
  onPageChange
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <div className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState<LogTab>('audit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  // Error logs state
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [errorPage, setErrorPage] = useState(1);
  const [errorTotal, setErrorTotal] = useState(0);
  const [errorStats, setErrorStats] = useState({ errors_24h: 0, warnings_24h: 0, info_24h: 0 });

  // Auth logs state
  const [authLogs, setAuthLogs] = useState<AuthLogEntry[]>([]);
  const [authPage, setAuthPage] = useState(1);
  const [authTotal, setAuthTotal] = useState(0);
  const [authStats, setAuthStats] = useState({ logins_24h: 0, failures_24h: 0, signups_24h: 0 });

  const pageSize = 50;

  const fetchAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        page_size: pageSize.toString()
      });
      if (searchQuery) params.set('action', searchQuery);

      const res = await fetch(`/api/admin/logs/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    }
  }, [auditPage, searchQuery]);

  const fetchErrorLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: errorPage.toString(),
        page_size: pageSize.toString()
      });
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/logs/errors?${params}`);
      if (!res.ok) throw new Error('Failed to fetch error logs');
      const data = await res.json();
      setErrorLogs(data.logs);
      setErrorTotal(data.total);
      setErrorStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch error logs');
    }
  }, [errorPage, searchQuery]);

  const fetchAuthLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: authPage.toString(),
        page_size: pageSize.toString()
      });
      if (searchQuery) params.set('user_email', searchQuery);

      const res = await fetch(`/api/admin/logs/auth?${params}`);
      if (!res.ok) throw new Error('Failed to fetch auth logs');
      const data = await res.json();
      setAuthLogs(data.logs);
      setAuthTotal(data.total);
      setAuthStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch auth logs');
    }
  }, [authPage, searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchAuditLogs(),
        fetchErrorLogs(),
        fetchAuthLogs()
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchAuditLogs, fetchErrorLogs, fetchAuthLogs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when tab changes (to update stats)
  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    else if (activeTab === 'errors') fetchErrorLogs();
    else if (activeTab === 'auth') fetchAuthLogs();
  }, [activeTab, fetchAuditLogs, fetchErrorLogs, fetchAuthLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAuditPage(1);
    setErrorPage(1);
    setAuthPage(1);
    fetchData();
  };

  const auditTotalPages = Math.ceil(auditTotal / pageSize);
  const errorTotalPages = Math.ceil(errorTotal / pageSize);
  const authTotalPages = Math.ceil(authTotal / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <FileText className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Logs & Audit</h1>
            <p className="text-sm text-gray-500">Monitor system activity and debug issues</p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton
          label="Audit Logs"
          icon={FileText}
          active={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
        />
        <TabButton
          label="Error Logs"
          icon={AlertTriangle}
          active={activeTab === 'errors'}
          onClick={() => setActiveTab('errors')}
          badge={errorStats.errors_24h}
        />
        <TabButton
          label="Auth Logs"
          icon={Shield}
          active={activeTab === 'auth'}
          onClick={() => setActiveTab('auth')}
        />
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'audit'
                ? 'Search by action...'
                : activeTab === 'errors'
                ? 'Search error messages...'
                : 'Search by user email...'
            }
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      {/* Loading State */}
      {loading && !auditLogs.length && !errorLogs.length && !authLogs.length ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Admin Activity ({auditTotal.toLocaleString()} entries)
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Tracks billing events, subscription changes, tier upgrades, Stripe webhooks, and system migrations.
                </p>
              </div>
              <AuditLogsTable logs={auditLogs} />
              <Pagination
                page={auditPage}
                totalPages={auditTotalPages}
                onPageChange={setAuditPage}
              />
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Errors (24h)"
                  value={errorStats.errors_24h}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  label="Warnings (24h)"
                  value={errorStats.warnings_24h}
                  icon={AlertTriangle}
                  color="yellow"
                />
                <StatCard
                  label="Info (24h)"
                  value={errorStats.info_24h}
                  icon={Activity}
                  color="gray"
                />
              </div>

              {/* Error Logs */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Error Log ({errorTotal.toLocaleString()} entries)
                </h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Application errors, API failures, and warnings. Logging not yet implemented - this will track errors as they occur in production.
                </p>
                <ErrorLogsTable logs={errorLogs} />
                <Pagination
                  page={errorPage}
                  totalPages={errorTotalPages}
                  onPageChange={setErrorPage}
                />
              </div>
            </>
          )}

          {/* Auth Tab */}
          {activeTab === 'auth' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Logins (24h)"
                  value={authStats.logins_24h}
                  icon={User}
                  color="green"
                />
                <StatCard
                  label="Failed Attempts (24h)"
                  value={authStats.failures_24h}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  label="New Signups (24h)"
                  value={authStats.signups_24h}
                  icon={Clock}
                  color="gray"
                />
              </div>

              {/* Auth Logs */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Authentication Events ({authTotal.toLocaleString()} entries)
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    User logins, signups, password resets, and failed attempts. Logging not yet implemented - this will track auth events for security monitoring.
                  </p>
                </div>
                <AuthLogsTable logs={authLogs} />
                <Pagination
                  page={authPage}
                  totalPages={authTotalPages}
                  onPageChange={setAuthPage}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
