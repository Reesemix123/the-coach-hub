'use client';

import { useState } from 'react';
import { Clock, RefreshCw, X, Loader2, User } from 'lucide-react';

interface InvitationCardProps {
  invitation: {
    id: string;
    parent_email: string;
    parent_name: string | null;
    relationship: string | null;
    status: string;
    created_at: string;
    token_expires_at: string;
    auto_resend_sent: boolean;
    player_name: string;
  };
  teamId: string;
  onUpdate: () => void;
}

export function InvitationCard({ invitation, teamId, onUpdate }: InvitationCardProps) {
  const [acting, setActing] = useState<'resend' | 'revoke' | null>(null);

  const isExpired = new Date(invitation.token_expires_at) < new Date();
  const sentAgo = getTimeAgo(invitation.created_at);

  async function handleAction(action: 'resend' | 'revoke') {
    setActing(action);
    try {
      const res = await fetch('/api/communication/parents/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invitation.id, action }),
      });
      if (res.ok) onUpdate();
    } catch {
      // silently fail
    } finally {
      setActing(null);
    }
  }

  return (
    <div className={`bg-white rounded-lg border p-4 ${isExpired ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 text-sm">
                {invitation.parent_name || invitation.parent_email}
              </p>
              {isExpired && (
                <span className="text-xs text-amber-600 font-medium">Expired</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {invitation.parent_name ? invitation.parent_email : ''} · for {invitation.player_name}
              {invitation.relationship ? ` (${invitation.relationship})` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {sentAgo}
          </span>

          <button
            onClick={() => handleAction('resend')}
            disabled={acting !== null}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Resend invitation"
          >
            {acting === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>

          <button
            onClick={() => handleAction('revoke')}
            disabled={acting !== null}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Revoke invitation"
          >
            {acting === 'revoke' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
