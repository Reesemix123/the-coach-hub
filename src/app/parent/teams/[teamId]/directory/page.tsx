'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { Users, ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParentChild {
  player_id: string;
  player_name: string;
  jersey_number: number | null;
  position_group: string | null;
  relationship: string | null;
}

interface ParentEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  children: ParentChild[];
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

/**
 * Deterministic color palette for parent avatars.
 * Soft pastel hues that work well against white text.
 */
const AVATAR_COLORS = [
  '#6B7280', // gray-500
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

/**
 * Returns a consistent color for a given name string by hashing the characters.
 */
function avatarColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ParentCardProps {
  parent: ParentEntry;
}

function ParentCard({ parent }: ParentCardProps) {
  const fullName = `${parent.first_name} ${parent.last_name}`;
  const bgColor = avatarColorForName(fullName);
  const sortedChildren = [...parent.children].sort((a, b) =>
    (a.jersey_number ?? 999) - (b.jersey_number ?? 999)
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        {initials(parent.first_name, parent.last_name)}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 leading-snug">{fullName}</p>

        {sortedChildren.length === 0 ? (
          <p className="text-sm text-gray-500 mt-0.5">Parent</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {sortedChildren.map((child) => (
              <li key={child.player_id} className="text-sm text-gray-600">
                {child.jersey_number !== null && child.jersey_number !== undefined
                  ? `#${child.jersey_number} `
                  : ''}
                {child.player_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function ParentDirectoryPage({ params }: PageProps) {
  const { teamId } = use(params);

  const [parents, setParents] = useState<ParentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/communication/parents/roster?teamId=${teamId}`
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Unexpected response (${response.status})`
        );
      }

      const data = await response.json();
      const sorted: ParentEntry[] = (data.parents ?? []).sort(
        (a: ParentEntry, b: ParentEntry) =>
          a.last_name.localeCompare(b.last_name) ||
          a.first_name.localeCompare(b.first_name)
      );
      setParents(sorted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load directory'
      );
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/parent"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex items-center gap-3 mb-1">
            <Users className="w-8 h-8 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">
              Team Directory
            </h1>
          </div>
          <p className="text-gray-600">Parents and families on this team</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!error && parents.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              No Parents Yet
            </h2>
            <p className="text-gray-600">
              No parents have joined this team yet.
            </p>
          </div>
        )}

        {/* Parent list */}
        {parents.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {parents.length} {parents.length === 1 ? 'parent' : 'parents'}
            </p>
            <div className="space-y-3">
              {parents.map((parent) => (
                <ParentCard key={parent.id} parent={parent} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
