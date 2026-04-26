/**
 * Offline play queue — localStorage-backed FIFO queue for sideline tracker plays.
 * Stores play inserts and enrichment updates that failed or were created offline.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayInsertEntry {
  type: 'play_insert'
  localId: string
  payload: Record<string, unknown>
  attributionRows: Record<string, unknown>[]
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  error?: string
  createdAt: number
  syncedAt?: number
}

export interface PlayUpdateEntry {
  type: 'play_update'
  localId: string
  field: string
  value: unknown
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  error?: string
  createdAt: number
  syncedAt?: number
}

export type QueueEntry = PlayInsertEntry | PlayUpdateEntry

// ---------------------------------------------------------------------------
// localStorage key
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'ych-play-queue-'

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getQueue(gameId: string): QueueEntry[] {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${gameId}`)
    if (!raw) return []
    return JSON.parse(raw) as QueueEntry[]
  } catch {
    return []
  }
}

export function pushToQueue(gameId: string, entry: QueueEntry): void {
  try {
    const queue = getQueue(gameId)
    queue.push(entry)
    localStorage.setItem(`${KEY_PREFIX}${gameId}`, JSON.stringify(queue))
  } catch {
    // localStorage full or unavailable
  }
}

export function updateQueueEntry(
  gameId: string,
  localId: string,
  type: string,
  updates: Partial<QueueEntry>
): void {
  try {
    const queue = getQueue(gameId)
    const idx = queue.findIndex(e => e.localId === localId && e.type === type)
    if (idx === -1) return
    queue[idx] = { ...queue[idx], ...updates } as QueueEntry
    localStorage.setItem(`${KEY_PREFIX}${gameId}`, JSON.stringify(queue))
  } catch {}
}

export function removeFromQueue(gameId: string, localId: string, type: string): void {
  try {
    const queue = getQueue(gameId)
    const filtered = queue.filter(e => !(e.localId === localId && e.type === type))
    localStorage.setItem(`${KEY_PREFIX}${gameId}`, JSON.stringify(filtered))
  } catch {}
}

export function getPendingCount(gameId: string): number {
  const queue = getQueue(gameId)
  return queue.filter(e => e.status === 'pending' || e.status === 'failed').length
}

export function clearQueue(gameId: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${gameId}`)
  } catch {}
}

export function isPlaySynced(gameId: string, localId: string): boolean {
  const queue = getQueue(gameId)
  const entry = queue.find(e => e.type === 'play_insert' && e.localId === localId)
  return entry?.status === 'synced'
}

// ---------------------------------------------------------------------------
// Scan for orphaned queues across all games
// ---------------------------------------------------------------------------

export function getAllQueuedGameIds(): { gameId: string; teamId: string | null; pendingCount: number }[] {
  const results: { gameId: string; teamId: string | null; pendingCount: number }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(KEY_PREFIX)) continue
      const gameId = key.replace(KEY_PREFIX, '')
      const queue = getQueue(gameId)
      const pending = queue.filter(e => e.status === 'pending' || e.status === 'failed')
      if (pending.length === 0) continue

      // Extract teamId: try play_insert first, then play_update payload
      let teamId: string | null = null
      const insertEntry = queue.find(e => e.type === 'play_insert') as PlayInsertEntry | undefined
      if (insertEntry?.payload?.team_id) {
        teamId = insertEntry.payload.team_id as string
      } else {
        // Fallback: check play_update entries — updates don't have team_id directly,
        // but if any play_insert was synced, its payload may still be in the queue
        // Actually play_updates don't carry team_id. Try to find it from any entry's payload.
        for (const entry of queue) {
          if (entry.type === 'play_insert' && (entry as PlayInsertEntry).payload?.team_id) {
            teamId = (entry as PlayInsertEntry).payload.team_id as string
            break
          }
        }
      }

      results.push({ gameId, teamId, pendingCount: pending.length })
    }
  } catch {}
  return results
}

// ---------------------------------------------------------------------------
// Connectivity check
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
