'use client';

import { useState, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface InviteParentFormProps {
  teamId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const RELATIONSHIPS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'stepmother', label: 'Stepmother' },
  { value: 'stepfather', label: 'Stepfather' },
  { value: 'other', label: 'Other' },
];

export function InviteParentForm({ teamId, onSuccess, onCancel }: InviteParentFormProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playerId, setPlayerId] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [relationship, setRelationship] = useState('guardian');

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number')
          .eq('team_id', teamId)
          .order('jersey_number', { ascending: true });

        if (!error && data) {
          setPlayers(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingPlayers(false);
      }
    }
    fetchPlayers();
  }, [teamId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!playerId || !parentEmail) {
      setError('Please select a player and enter an email');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/communication/parents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          playerId,
          parentEmail: parentEmail.trim().toLowerCase(),
          parentName: parentName.trim() || undefined,
          relationship,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Player Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Player <span className="text-red-500">*</span>
          </label>
          {loadingPlayers ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading players...
            </div>
          ) : (
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">Select a player</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.jersey_number ?? '?'} {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Relationship */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Relationship
          </label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parent Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="parent@example.com"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parent Name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Invitation
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
