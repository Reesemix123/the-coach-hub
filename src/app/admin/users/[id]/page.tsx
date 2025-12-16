'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Building2,
  Users,
  Calendar,
  Clock,
  RefreshCw,
  AlertCircle,
  Key,
  UserX,
  UserCheck,
  ExternalLink,
  Activity
} from 'lucide-react';
import {
  UserDetail,
  UserDerivedStatus,
  UserRole,
  AuditLog
} from '@/types/admin';

// Status badge colors
const STATUS_COLORS: Record<UserDerivedStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-yellow-100 text-yellow-800',
  deactivated: 'bg-red-100 text-red-800',
  never_logged_in: 'bg-gray-100 text-gray-800'
};

const STATUS_LABELS: Record<UserDerivedStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  deactivated: 'Deactivated',
  never_logged_in: 'Never Logged In'
};

const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform Admin',
  owner: 'Owner',
  coach: 'Coach'
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  // State
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Fetch user details
  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to fetch user');
      }
      const data: UserDetail = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Reset password
  const handleResetPassword = async () => {
    setActionLoading('reset');
    setActionResult(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_email: true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setTemporaryPassword(data.temporary_password);
      setShowPasswordModal(true);
      setActionResult({
        type: 'success',
        message: data.email_sent
          ? 'Password reset successfully. Email sent to user.'
          : 'Password reset successfully. Email could not be sent.'
      });
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reset password'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Deactivate user
  const handleDeactivate = async () => {
    setActionLoading('deactivate');
    setActionResult(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deactivateReason, send_email: true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate user');
      }

      setShowDeactivateModal(false);
      setDeactivateReason('');
      setActionResult({
        type: 'success',
        message: 'User deactivated successfully'
      });
      fetchUser(); // Refresh user data
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to deactivate user'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Reactivate user
  const handleReactivate = async () => {
    setActionLoading('reactivate');
    setActionResult(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_email: true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate user');
      }

      setActionResult({
        type: 'success',
        message: 'User reactivated successfully'
      });
      fetchUser(); // Refresh user data
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reactivate user'
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error || 'User not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              {user.full_name || user.email}
            </h1>
            {user.is_platform_admin && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                <Shield className="w-4 h-4" />
                Platform Admin
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[user.derived_status]}`}>
              {STATUS_LABELS[user.derived_status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 font-mono">{user.id}</p>
        </div>
        <button
          onClick={fetchUser}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          actionResult.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 ${
            actionResult.type === 'success' ? 'text-green-500' : 'text-red-500'
          }`} />
          <span className={actionResult.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {actionResult.message}
          </span>
          <button
            onClick={() => setActionResult(null)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
                <p className="text-gray-900">{user.email}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <User className="w-4 h-4" />
                  Full Name
                </div>
                <p className="text-gray-900">{user.full_name || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Shield className="w-4 h-4" />
                  Role
                </div>
                <p className="text-gray-900">{ROLE_LABELS[user.role] || user.role}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  Created
                </div>
                <p className="text-gray-900">{formatDate(user.created_at)}</p>
              </div>
            </div>

            {user.is_deactivated && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <h3 className="text-sm font-semibold text-red-800 mb-2">Deactivation Details</h3>
                <div className="text-sm text-red-700 space-y-1">
                  <p>Deactivated: {formatDate(user.deactivated_at)}</p>
                  {user.deactivation_reason && (
                    <p>Reason: {user.deactivation_reason}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Organization Card */}
          {user.organization && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
                <Link
                  href={`/admin/organizations/${user.organization.id}`}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  View <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.organization.name}</p>
                  <p className="text-sm text-gray-500">{user.organization.status}</p>
                </div>
              </div>
            </div>
          )}

          {/* Teams Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Teams ({user.teams.length})</h2>
            {user.teams.length === 0 ? (
              <p className="text-gray-500">No teams</p>
            ) : (
              <div className="space-y-3">
                {user.teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{team.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {user.recent_activity.length === 0 ? (
              <p className="text-gray-500">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {user.recent_activity.map((log: AuditLog) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{log.action}</p>
                      {log.target_name && (
                        <p className="text-xs text-gray-500">{log.target_name}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Login Status Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Login Status</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  Last Active
                </div>
                <p className="text-gray-900">{formatRelativeTime(user.user_status?.last_login_at || null)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  First Login
                </div>
                <p className="text-gray-900">{formatDate(user.user_status?.first_login_at || null)}</p>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Login Count</div>
                <p className="text-gray-900">{user.user_status?.login_count || 0}</p>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={handleResetPassword}
                disabled={actionLoading !== null || user.is_deactivated}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'reset' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Reset Password
              </button>

              {user.is_deactivated ? (
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'reactivate' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Reactivate User
                </button>
              ) : (
                <button
                  onClick={() => setShowDeactivateModal(true)}
                  disabled={actionLoading !== null || user.is_platform_admin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserX className="w-4 h-4" />
                  Deactivate User
                </button>
              )}

              {user.is_platform_admin && (
                <p className="text-xs text-gray-500 text-center">
                  Platform admins cannot be deactivated
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showPasswordModal && temporaryPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Password Reset</h3>
            <p className="text-sm text-gray-600 mb-4">
              The user&apos;s password has been reset. Here is the temporary password:
            </p>
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <p className="text-center font-mono text-xl font-bold text-gray-900 tracking-wider">
                {temporaryPassword}
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              An email with this password has been sent to the user. They should change their password after logging in.
            </p>
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setTemporaryPassword(null);
              }}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Deactivate User</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to deactivate <strong>{user.email}</strong>? They will not be able to log in until reactivated.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Enter reason for deactivation..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setDeactivateReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={actionLoading === 'deactivate'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === 'deactivate' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserX className="w-4 h-4" />
                )}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
