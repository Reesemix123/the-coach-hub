'use client';

import { useState } from 'react';
import { Mail, Phone, Star, Users, Loader2 } from 'lucide-react';

interface ParentChild {
  player_id: string;
  player_name: string;
  jersey_number: number | null;
  position_group: string | null;
  relationship: string;
  is_primary_contact: boolean;
}

interface ParentCardProps {
  parent: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    notification_preference: string;
    is_champion: boolean;
    joined_at: string;
    children: ParentChild[];
  };
  teamId: string;
  onUpdate: () => void;
}

export function ParentCard({ parent, teamId, onUpdate }: ParentCardProps) {
  const [togglingChampion, setTogglingChampion] = useState(false);

  async function toggleChampion() {
    setTogglingChampion(true);
    try {
      const res = await fetch(`/api/communication/parents/${parent.id}/champion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChampion: !parent.is_champion, teamId }),
      });
      if (res.ok) onUpdate();
    } catch {
      // silently fail
    } finally {
      setTogglingChampion(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-lg flex-shrink-0">
            {parent.first_name[0]}{parent.last_name[0]}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {parent.first_name} {parent.last_name}
              </h3>
              {parent.is_champion && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                  <Star className="w-3 h-3 fill-amber-400" />
                  Champion
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {parent.email}
              </span>
              {parent.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {parent.phone}
                </span>
              )}
            </div>

            {/* Children */}
            {parent.children.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <div className="flex flex-wrap gap-2">
                  {parent.children.map((child) => (
                    <span
                      key={child.player_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                    >
                      #{child.jersey_number ?? '?'} {child.player_name}
                      <span className="text-gray-400">({child.relationship})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Champion toggle */}
        <button
          onClick={toggleChampion}
          disabled={togglingChampion}
          title={parent.is_champion ? 'Remove champion status' : 'Make parent champion'}
          className={`
            p-2 rounded-lg transition-colors
            ${parent.is_champion
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-gray-300 hover:text-amber-400 hover:bg-gray-50'
            }
          `}
        >
          {togglingChampion ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Star className={`w-5 h-5 ${parent.is_champion ? 'fill-amber-400' : ''}`} />
          )}
        </button>
      </div>
    </div>
  );
}
