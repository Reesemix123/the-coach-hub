'use client'

import { useState } from 'react'
import { useMobile, type MobilePlayer } from '@/app/(mobile)/MobileContext'
import RosterListView from './components/RosterListView'
import DepthChartView from './components/DepthChartView'
import PlayerEditSheet from './components/PlayerEditSheet'
import PlayerPickerSheet from './components/PlayerPickerSheet'
import GameLineupView from './components/GameLineupView'

type ViewMode = 'roster' | 'depth'

export default function MobileRosterPage() {
  const { teamId, activeGameId, players, playersLoading, bumpLineupVersion, refreshPlayers } =
    useMobile()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (sessionStorage.getItem('ych-roster-view') as ViewMode) || 'roster'
    } catch {
      return 'roster'
    }
  })

  const [editingPlayer, setEditingPlayer] = useState<MobilePlayer | null>(null)
  const [highlightPosition, setHighlightPosition] = useState<string | undefined>(undefined)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [addPrePosition, setAddPrePosition] = useState<string | undefined>(undefined)
  const [pickerPosition, setPickerPosition] = useState<string | null>(null)

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode)
    try {
      sessionStorage.setItem('ych-roster-view', mode)
    } catch {}
  }

  function handleEditPlayer(player: MobilePlayer, position?: string) {
    setEditingPlayer(player)
    setHighlightPosition(position)
  }

  function handleAddPlayer(position?: string) {
    setAddPrePosition(position)
    setShowAddSheet(true)
  }

  function handleSaved() {
    refreshPlayers()
  }

  // Active game → GameLineupView
  if (activeGameId && teamId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
        <GameLineupView
          activeGameId={activeGameId}
          teamId={teamId}
          players={players}
          playersLoading={playersLoading}
          bumpLineupVersion={bumpLineupVersion}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Roster</h1>
        <button
          type="button"
          onClick={() => handleAddPlayer()}
          className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)] active:text-[var(--text-secondary)] transition-colors"
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add</span>
        </button>
      </div>

      {/* Segmented Control */}
      <div className="px-4 pb-3">
        <div className="flex bg-[var(--bg-pill-inactive)] rounded-lg p-0.5">
          {(['roster', 'depth'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => handleViewModeChange(mode)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                viewMode === mode ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
              }`}
            >
              {mode === 'roster' ? 'Roster' : 'Depth Chart'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'roster' ? (
        <RosterListView
          players={players}
          playersLoading={playersLoading}
          onEditPlayer={handleEditPlayer}
        />
      ) : (
        <DepthChartView
          players={players}
          playersLoading={playersLoading}
          teamId={teamId ?? ''}
          onEditPlayer={handleEditPlayer}
          onPickPlayer={pos => setPickerPosition(pos)}
          onPlayersChanged={handleSaved}
        />
      )}

      {/* Edit Player Sheet */}
      {editingPlayer && teamId && (
        <PlayerEditSheet
          player={editingPlayer}
          highlightPosition={highlightPosition}
          teamId={teamId}
          allPlayers={players}
          onClose={() => {
            setEditingPlayer(null)
            setHighlightPosition(undefined)
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Add Player Sheet */}
      {showAddSheet && teamId && (
        <PlayerEditSheet
          player={null}
          preSelectedPosition={addPrePosition}
          teamId={teamId}
          allPlayers={players}
          onClose={() => {
            setShowAddSheet(false)
            setAddPrePosition(undefined)
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Player Picker Sheet (for empty depth chart positions) */}
      {pickerPosition && teamId && (
        <PlayerPickerSheet
          position={pickerPosition}
          allPlayers={players}
          teamId={teamId}
          onClose={() => setPickerPosition(null)}
          onPlayerAdded={handleSaved}
        />
      )}
    </div>
  )
}
