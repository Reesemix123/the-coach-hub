/**
 * Sync Engine — processes the offline play queue against Supabase.
 * FIFO order. Network errors stop processing. Constraint errors skip and continue.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getQueue,
  updateQueueEntry,
  type QueueEntry,
  type PlayInsertEntry,
  type PlayUpdateEntry,
} from './playQueue'

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function isNetworkError(error: { message?: string } | null): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('fetch') || msg.includes('network') || msg.includes('offline') || msg.includes('internet')
}

// ---------------------------------------------------------------------------
// Process queue
// ---------------------------------------------------------------------------

export async function processQueue(
  gameId: string,
  teamId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; failed: number; remaining: number }> {
  const queue = getQueue(gameId)
  if (queue.length === 0) return { synced: 0, failed: 0, remaining: 0 }

  // Sort by createdAt for FIFO processing
  const sorted = [...queue].sort((a, b) => a.createdAt - b.createdAt)

  let synced = 0
  let failed = 0
  let stopProcessing = false

  for (const entry of sorted) {
    if (stopProcessing) break
    if (entry.status === 'synced') { synced++; continue }
    if (entry.status !== 'pending' && entry.status !== 'failed') continue

    if (entry.type === 'play_insert') {
      const result = await processPlayInsert(gameId, entry, supabase)
      if (result === 'synced') synced++
      else if (result === 'network_error') { failed++; stopProcessing = true }
      else failed++
    } else if (entry.type === 'play_update') {
      const result = await processPlayUpdate(gameId, entry, supabase)
      if (result === 'synced') synced++
      else if (result === 'skipped') { /* will retry next cycle */ }
      else if (result === 'network_error') { failed++; stopProcessing = true }
      else failed++
    }
  }

  // Clean up synced entries
  try {
    const current = getQueue(gameId)
    const remaining = current.filter(e => e.status !== 'synced')
    localStorage.setItem(`ych-play-queue-${gameId}`, JSON.stringify(remaining))
  } catch {}

  const remainingCount = getQueue(gameId).filter(
    e => e.status === 'pending' || e.status === 'failed'
  ).length

  return { synced, failed, remaining: remainingCount }
}

// ---------------------------------------------------------------------------
// Process a single play_insert entry
// ---------------------------------------------------------------------------

async function processPlayInsert(
  gameId: string,
  entry: PlayInsertEntry,
  supabase: SupabaseClient
): Promise<'synced' | 'failed' | 'network_error'> {
  updateQueueEntry(gameId, entry.localId, 'play_insert', { status: 'syncing' })

  try {
    const { data: insertedPlay, error } = await supabase
      .from('play_instances')
      .insert(entry.payload)
      .select('id')
      .single()

    if (error) {
      if (isNetworkError(error)) {
        updateQueueEntry(gameId, entry.localId, 'play_insert', {
          status: 'failed',
          error: error.message,
        })
        return 'network_error'
      }
      // Constraint/data error — mark failed, continue processing others
      updateQueueEntry(gameId, entry.localId, 'play_insert', {
        status: 'failed',
        error: error.message,
      })
      return 'failed'
    }

    // Insert attribution rows with the DB id
    if (insertedPlay?.id && entry.attributionRows.length > 0) {
      try {
        const rows = entry.attributionRows.map(row => ({
          ...row,
          play_instance_id: insertedPlay.id,
        }))
        await supabase.from('player_participation').insert(rows)
      } catch (e) {
        // Attribution failure doesn't fail the play sync
        console.error('[SyncEngine] Attribution insert failed:', e)
      }
    }

    updateQueueEntry(gameId, entry.localId, 'play_insert', {
      status: 'synced',
      syncedAt: Date.now(),
    })
    return 'synced'
  } catch {
    updateQueueEntry(gameId, entry.localId, 'play_insert', {
      status: 'failed',
      error: 'Unexpected error',
    })
    return 'network_error'
  }
}

// ---------------------------------------------------------------------------
// Process a single play_update entry
// ---------------------------------------------------------------------------

async function processPlayUpdate(
  gameId: string,
  entry: PlayUpdateEntry,
  supabase: SupabaseClient
): Promise<'synced' | 'failed' | 'network_error' | 'skipped'> {
  // Check if parent play is synced — update needs the row to exist in DB
  const queue = getQueue(gameId)
  const parentInsert = queue.find(
    e => e.type === 'play_insert' && e.localId === entry.localId
  )
  // If parent is in the queue but not synced, skip this update for now
  if (parentInsert && parentInsert.status !== 'synced') {
    return 'skipped'
  }

  updateQueueEntry(gameId, entry.localId, 'play_update', { status: 'syncing' })

  try {
    const { error } = await supabase
      .from('play_instances')
      .update({ [entry.field]: entry.value })
      .eq('local_id', entry.localId)

    if (error) {
      if (isNetworkError(error)) {
        updateQueueEntry(gameId, entry.localId, 'play_update', {
          status: 'failed',
          error: error.message,
        })
        return 'network_error'
      }
      updateQueueEntry(gameId, entry.localId, 'play_update', {
        status: 'failed',
        error: error.message,
      })
      return 'failed'
    }

    updateQueueEntry(gameId, entry.localId, 'play_update', {
      status: 'synced',
      syncedAt: Date.now(),
    })
    return 'synced'
  } catch {
    updateQueueEntry(gameId, entry.localId, 'play_update', {
      status: 'failed',
      error: 'Unexpected error',
    })
    return 'network_error'
  }
}
