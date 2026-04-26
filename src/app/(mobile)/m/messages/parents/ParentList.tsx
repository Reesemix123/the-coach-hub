'use client'

import { useCommHub, type ParentWithChildren, type PendingInvite } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Tier limit bar
// ---------------------------------------------------------------------------

function TierLimitBar({ count, limit }: { count: number; limit: number | null }) {
  const nearLimit = limit !== null && count >= limit - 2

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">
          {limit !== null ? `${count} / ${limit} parents` : `${count} parents`}
        </span>
        {nearLimit && limit !== null && (
          <button
            type="button"
            className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 active:bg-amber-100"
          >
            Upgrade for more
          </button>
        )}
      </div>
      {limit !== null && (
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              count >= limit ? 'bg-red-400' : nearLimit ? 'bg-amber-400' : 'bg-[#B8CA6E]'
            }`}
            style={{ width: `${Math.min((count / limit) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Parent card
// ---------------------------------------------------------------------------

function ParentCard({
  item,
  onTap,
}: {
  item: ParentWithChildren
  onTap: () => void
}) {
  const { parent, children } = item
  const fullName = `${parent.first_name} ${parent.last_name}`
  const athleteNames = children.map(c => c.player_name).join(', ')

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-white rounded-xl px-4 py-3.5 text-left active:opacity-70 transition-opacity shadow-sm"
    >
      <div className="flex items-center gap-3">
        {/* Avatar initials */}
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-gray-600">
            {parent.first_name[0]}{parent.last_name[0]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
            {parent.is_champion && (
              <span title="Team Champion" className="text-amber-500 text-xs">★</span>
            )}
          </div>
          {athleteNames && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{athleteNames}</p>
          )}
          <p className="text-xs text-gray-400 truncate mt-0.5">{parent.email}</p>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pending invite row
// ---------------------------------------------------------------------------

function InviteRow({
  invite,
  onTap,
}: {
  invite: PendingInvite
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-white rounded-xl px-4 py-3.5 text-left active:opacity-70 transition-opacity shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 truncate">{invite.parent_email}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">Invited</span>
            <span className="text-[10px] text-gray-400">{relativeTime(invite.created_at)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
        <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M21 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
      <p className="text-sm font-medium text-gray-500 text-center">No parents yet</p>
      <p className="text-xs text-gray-400 text-center">Invite parents to keep them in the loop</p>
      <button
        type="button"
        onClick={onInvite}
        className="mt-2 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl px-5 py-2.5 text-sm font-semibold active:bg-[#a8b85e]"
      >
        Invite Parent
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParentList
// ---------------------------------------------------------------------------

interface ParentListProps {
  onSelectParent: (parent: ParentWithChildren) => void
  onSelectInvite: (invite: PendingInvite) => void
  onInvite: () => void
}

export default function ParentList({ onSelectParent, onSelectInvite, onInvite }: ParentListProps) {
  const { parents, pendingInvites, parentsLoading, parentCount, parentLimit } = useCommHub()

  if (parentsLoading) {
    return (
      <div className="px-4 space-y-3 mt-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-4 animate-pulse shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100" />
              <div className="flex-1">
                <div className="h-3.5 bg-gray-100 rounded w-1/2 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const hasContent = parents.length > 0 || pendingInvites.length > 0

  if (!hasContent) {
    return <EmptyState onInvite={onInvite} />
  }

  // Sort active parents alphabetically by last name
  const sortedParents = [...parents].sort((a, b) =>
    a.parent.last_name.localeCompare(b.parent.last_name)
  )

  return (
    <div className="pb-24">
      <TierLimitBar count={parentCount} limit={parentLimit} />

      {/* Active parents */}
      {sortedParents.length > 0 && (
        <div className="px-4 mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Active ({sortedParents.length})
          </p>
          <div className="space-y-2">
            {sortedParents.map(item => (
              <ParentCard
                key={item.parent.id}
                item={item}
                onTap={() => onSelectParent(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Pending Invitations ({pendingInvites.length})
          </p>
          <div className="space-y-2">
            {pendingInvites.map(invite => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onTap={() => onSelectInvite(invite)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Invite button fixed at bottom */}
      <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom))] left-0 right-0 px-4 py-3 bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7] to-transparent">
        <button
          type="button"
          onClick={onInvite}
          className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors"
        >
          Invite Parent
        </button>
      </div>
    </div>
  )
}
