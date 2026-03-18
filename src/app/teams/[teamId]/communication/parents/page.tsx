'use client';

import { use, useState, useEffect } from 'react';
import { Users, Plus, Loader2, Mail, Shield, Clock } from 'lucide-react';
import { InviteParentForm } from '@/components/communication/parents/InviteParentForm';
import { ParentCard } from '@/components/communication/parents/ParentCard';
import { InvitationCard } from '@/components/communication/parents/InvitationCard';

interface ParentRosterEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notification_preference: string;
  is_champion: boolean;
  access_level: string;
  joined_at: string;
  children: Array<{
    player_id: string;
    player_name: string;
    jersey_number: number | null;
    position_group: string | null;
    relationship: string;
    is_primary_contact: boolean;
  }>;
}

interface PendingInvitation {
  id: string;
  parent_email: string;
  parent_name: string | null;
  relationship: string | null;
  status: string;
  created_at: string;
  token_expires_at: string;
  auto_resend_sent: boolean;
  player_id: string;
  player_name: string;
}

export default function ParentRosterPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [parents, setParents] = useState<ParentRosterEntry[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);

  async function fetchRoster() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/communication/parents/roster?teamId=${teamId}`);
      if (!res.ok) throw new Error('Failed to fetch roster');
      const data = await res.json();
      setParents(data.parents || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRoster(); }, [teamId]);

  function handleInviteSuccess() {
    setShowInviteForm(false);
    fetchRoster();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <Users className="w-7 h-7" />
              Parent Roster
            </h1>
            <p className="text-gray-600 mt-1">
              {parents.length} parent{parents.length !== 1 ? 's' : ''} connected
              {invitations.length > 0 && ` · ${invitations.length} pending`}
            </p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Invite Parent
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Invite Form */}
        {showInviteForm && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <Mail className="w-5 h-5 inline mr-2" />
              Invite a Parent
            </h2>
            <InviteParentForm
              teamId={teamId}
              onSuccess={handleInviteSuccess}
              onCancel={() => setShowInviteForm(false)}
            />
          </div>
        )}

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Invitations ({invitations.length})
            </h2>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  invitation={inv}
                  teamId={teamId}
                  onUpdate={fetchRoster}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active Parents */}
        {parents.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Active Parents ({parents.length})
            </h2>
            <div className="space-y-4">
              {parents.map((parent) => (
                <ParentCard
                  key={parent.id}
                  parent={parent}
                  teamId={teamId}
                  onUpdate={fetchRoster}
                />
              ))}
            </div>
          </div>
        ) : !showInviteForm && invitations.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Parents Yet</h3>
            <p className="text-gray-600 mb-6">
              Invite parents to connect them with the team
            </p>
            <button
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Invite First Parent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
