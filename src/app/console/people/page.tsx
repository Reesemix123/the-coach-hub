'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import {
  Users,
  AlertCircle,
  ChevronLeft,
  MoreHorizontal,
  Mail,
  UserMinus,
  UserPlus,
  Clock
} from 'lucide-react';

interface TeamInfo {
  id: string;
  name: string;
  role: string;
}

interface UserData {
  id: string;
  name: string | null;
  email: string;
  teams: TeamInfo[];
  primary_role: string;
  last_active_at: string | null;
  status: 'active' | 'pending' | 'deactivated';
  invited_at?: string;
}

interface PeopleData {
  users: UserData[];
  summary: {
    total: number;
    active: number;
    pending: number;
    deactivated: number;
  };
}

type FilterType = 'all' | 'active' | 'pending' | 'deactivated';

export default function ConsolePeoplePage() {
  const [user, setUser] = useState<User | null>(null);
  const [peopleData, setPeopleData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      setActionMenuOpen(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/console/people');
      if (response.ok) {
        const data = await response.json();
        setPeopleData(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load people');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }

    setLoading(false);
  }

  async function handleDeactivate(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/console/people/${userId}/deactivate`, {
        method: 'POST'
      });
      if (response.ok) {
        await loadData();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to deactivate user');
      }
    } catch (err) {
      alert('Failed to deactivate user');
    }
    setActionLoading(null);
    setActionMenuOpen(null);
  }

  async function handleReactivate(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/console/people/${userId}/reactivate`, {
        method: 'POST'
      });
      if (response.ok) {
        await loadData();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to reactivate user');
      }
    } catch (err) {
      alert('Failed to reactivate user');
    }
    setActionLoading(null);
    setActionMenuOpen(null);
  }

  async function handleResendInvite(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/console/people/${userId}/resend-invite`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
      } else {
        alert(data.error || 'Failed to resend invite');
      }
    } catch (err) {
      alert('Failed to resend invite');
    }
    setActionLoading(null);
    setActionMenuOpen(null);
  }

  function formatLastActive(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  function getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'coach': return 'bg-blue-100 text-blue-800';
      case 'analyst': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock className="w-3 h-3" />Pending</span>;
      case 'deactivated':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Deactivated</span>;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading people...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!user) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
            <p className="text-gray-600 mb-8">Please sign in to access the console.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading People</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); loadData(); }}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const filteredUsers = peopleData?.users.filter(u => {
    if (filter === 'all') return true;
    return u.status === filter;
  }) || [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-4">
              <Link
                href="/console"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                People
              </h1>
            </div>
            <p className="text-gray-600 ml-11">
              Manage access across all teams
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Filter Pills */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({peopleData?.summary.total || 0})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'active'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({peopleData?.summary.active || 0})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({peopleData?.summary.pending || 0})
            </button>
            <button
              onClick={() => setFilter('deactivated')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'deactivated'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Deactivated ({peopleData?.summary.deactivated || 0})
            </button>
          </div>

          {/* People Table */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {filter === 'all' ? 'No users found' : `No ${filter} users`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Teams</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Last Active</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((person) => (
                    <tr key={person.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4">
                        <div className="font-medium text-gray-900">{person.email}</div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {person.teams.slice(0, 3).map((team) => (
                            <Link
                              key={team.id}
                              href={`/teams/${team.id}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              {team.name}
                              <span className="ml-1 text-gray-500">({team.role})</span>
                            </Link>
                          ))}
                          {person.teams.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                              +{person.teams.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(person.primary_role)}`}>
                          {person.primary_role}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-gray-600">
                        {formatLastActive(person.last_active_at)}
                      </td>
                      <td className="py-4">
                        {getStatusBadge(person.status)}
                      </td>
                      <td className="py-4">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === person.id ? null : person.id);
                            }}
                            disabled={actionLoading === person.id}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === person.id ? (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            ) : (
                              <MoreHorizontal className="w-4 h-4" />
                            )}
                          </button>

                          {/* Dropdown Menu */}
                          {actionMenuOpen === person.id && (
                            <div
                              className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {person.status === 'active' && (
                                <button
                                  onClick={() => handleDeactivate(person.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                                >
                                  <UserMinus className="w-4 h-4" />
                                  Deactivate
                                </button>
                              )}
                              {person.status === 'deactivated' && (
                                <button
                                  onClick={() => handleReactivate(person.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 text-left"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Reactivate
                                </button>
                              )}
                              {person.status === 'pending' && (
                                <button
                                  onClick={() => handleResendInvite(person.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 text-left"
                                >
                                  <Mail className="w-4 h-4" />
                                  Resend Invite
                                </button>
                              )}
                              {person.status !== 'pending' && (
                                <button
                                  onClick={() => handleResendInvite(person.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 text-left"
                                >
                                  <Mail className="w-4 h-4" />
                                  Send Reminder
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
