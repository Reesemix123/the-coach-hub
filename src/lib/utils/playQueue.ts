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
// Connectivity check
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
