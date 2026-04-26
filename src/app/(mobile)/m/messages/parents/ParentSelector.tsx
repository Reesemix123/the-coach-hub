'use client'

import { useState, useMemo } from 'react'
import { useCommHub, type ParentWithChildren } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TODO: MULTI-SPORT — pull position groups dynamically per sport
const POSITION_GROUP_FILTERS = [
  { value: '', label: 'All' },
  { value: 'offense', label: 'Offense' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_teams', label: 'Special Teams' },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentSelectorProps {
  mode: 'single' | 'multi'
  selected: string[]  // parent IDs
  onSelect: (parentIds: string[]) => void
  showAllOption?: boolean
}

// ---------------------------------------------------------------------------
// Parent row
// ---------------------------------------------------------------------------

function ParentRow({
  item,
  isSelected,
  mode,
  onToggle,
}: {
  item: ParentWithChildren
  isSelected: boolean
  mode: 'single' | 'multi'
  onToggle: () => void
}) {
  const { parent, children } = item
  const fullName = `${parent.first_name} ${parent.last_name}`
  const athleteNames = children.map(c => c.player_name).join(', ')

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--bg-card-alt)] ${
        isSelected ? 'bg-[#B8CA6E]/5' : ''
      }`}
    >
      {/* Selection indicator */}
      {mode === 'multi' ? (
        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
          isSelected ? 'bg-gray-900 border-gray-900' : 'border-[var(--border-secondary)] bg-[var(--bg-card)]'
        }`}>
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
      ) : (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
          isSelected ? 'border-gray-900' : 'border-[var(--border-secondary)]'
        }`}>
          {isSelected && (
            <div className="w-3 h-3 rounded-full bg-gray-900" />
          )}
        </div>
      )}

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {parent.first_name[0]}{parent.last_name[0]}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{fullName}</p>
          {parent.is_champion && (
            <span className="text-amber-500 text-xs" title="Team Champion">★</span>
          )}
        </div>
        {athleteNames && (
          <p className="text-xs text-[var(--text-tertiary)] truncate">{athleteNames}</p>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ParentSelector
// ---------------------------------------------------------------------------

export default function ParentSelector({
  mode,
  selected,
  onSelect,
  showAllOption = false,
}: ParentSelectorProps) {
  const { parents } = useCommHub()
  const [search, setSearch] = useState('')
  const [positionGroup, setPositionGroup] = useState('')

  const allSelected = showAllOption && selected.length === 0

  // Filter parents by search query and position group
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()

    return parents.filter(item => {
      const { parent, children } = item

      // Position group filter: match if any child has a position in that group
      // Since MobilePlayer uses position_depths (keyed by position), we match on
      // player_name presence and rely on the group label for now.
      // TODO: MULTI-SPORT — resolve position group from player's positions dynamically
      if (positionGroup) {
        const matchesGroup = children.some(() => {
          // Placeholder: always false until position data is available on ParentChild
          return false
        })
        if (!matchesGroup) return false
      }

      if (!query) return true

      const parentName = `${parent.first_name} ${parent.last_name}`.toLowerCase()
      const athleteNames = children.map(c => c.player_name.toLowerCase())

      return parentName.includes(query) || athleteNames.some(n => n.includes(query))
    })
  }, [parents, search, positionGroup])

  function toggleParent(id: string) {
    if (mode === 'single') {
      onSelect([id])
      return
    }

    if (selected.includes(id)) {
      onSelect(selected.filter(s => s !== id))
    } else {
      onSelect([...selected, id])
    }
  }

  function handleSelectAll() {
    if (allSelected) return
    onSelect([]) // empty = "all"
  }

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by parent or athlete name"
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card-alt)] rounded-xl text-sm text-[var(--text-primary)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Position group pills */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {POSITION_GROUP_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setPositionGroup(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              positionGroup === f.value
                ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Parent list */}
      <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden divide-y divide-gray-100 mx-4 shadow-sm">
        {/* All option */}
        {showAllOption && mode === 'multi' && (
          <button
            type="button"
            onClick={handleSelectAll}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--bg-card-alt)] ${
              allSelected ? 'bg-[#B8CA6E]/5' : ''
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
              allSelected ? 'bg-gray-900 border-gray-900' : 'border-[var(--border-secondary)] bg-[var(--bg-card)]'
            }`}>
              {allSelected && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">All Parents</p>
          </button>
        )}

        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No parents found</p>
          </div>
        ) : (
          filtered.map(item => (
            <ParentRow
              key={item.parent.id}
              item={item}
              isSelected={selected.includes(item.parent.id)}
              mode={mode}
              onToggle={() => toggleParent(item.parent.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
