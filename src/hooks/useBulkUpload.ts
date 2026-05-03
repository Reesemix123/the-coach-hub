// src/hooks/useBulkUpload.ts
// Sequential bulk-upload queue for large media files.
// Uses TUS resumable uploads to Supabase Storage, then calls a metadata
// endpoint to persist the per-file record.
//
// Drain-loop pattern: each iteration re-reads the latest queue snapshot,
// so files appended (or retried) mid-batch are picked up automatically.

'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  uploadFile as resumableUpload,
  formatBytes,
  formatTime,
  type UploadProgress,
} from '@/lib/utils/resumable-upload'

export type UploadItemStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled'

export interface UploadItem {
  id: string
  file: File
  clipLabel: string
  status: UploadItemStatus
  percent: number
  details: string | null
  error?: string
}

export type BuildMetadataPayload = (
  item: UploadItem,
  gameId: string,
  storagePath: string,
  clipOrder: number,
) => Record<string, unknown>

export interface UseBulkUploadOptions {
  bucketName: string
  metadataEndpoint: string
  buildMetadataPayload: BuildMetadataPayload
}

export interface UseBulkUploadReturn {
  queue: UploadItem[]
  isProcessing: boolean
  appendFiles: (files: File[]) => void
  removeItem: (id: string) => void
  updateClipLabel: (id: string, label: string) => void
  retryItem: (id: string) => void
  startBatch: (gameId: string) => Promise<{ allDone: boolean; queueLength: number }>
  resetQueue: () => void
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function useBulkUpload(opts: UseBulkUploadOptions): UseBulkUploadReturn {
  const [queue, _setQueue] = useState<UploadItem[]>([])
  const queueRef = useRef<UploadItem[]>([])
  const processingRef = useRef(false)
  const lastGameIdRef = useRef<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Keep queueRef in sync with state for synchronous reads inside the drain loop.
  // All queue mutations go through this wrapper.
  const setQueue = useCallback((updater: (prev: UploadItem[]) => UploadItem[]) => {
    const next = updater(queueRef.current)
    queueRef.current = next
    _setQueue(next)
  }, [])

  const appendFiles = useCallback((files: File[]) => {
    if (files.length === 0) return
    setQueue(prev => [
      ...prev,
      ...files.map<UploadItem>(f => ({
        id: crypto.randomUUID(),
        file: f,
        clipLabel: '',
        status: 'queued',
        percent: 0,
        details: null,
      })),
    ])
  }, [setQueue])

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id))
  }, [setQueue])

  const updateClipLabel = useCallback((id: string, label: string) => {
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, clipLabel: label } : q)))
  }, [setQueue])

  const uploadOne = useCallback(
    async (item: UploadItem, gameId: string, clipOrder: number) => {
      setQueue(prev =>
        prev.map(q =>
          q.id === item.id ? { ...q, status: 'uploading', percent: 0, error: undefined } : q,
        ),
      )

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const timestamp = Date.now()
        const sanitized = sanitizeFileName(item.file.name)
        const storagePath = `${user.id}/${timestamp}_${sanitized}`

        const result = await resumableUpload(supabase, opts.bucketName, storagePath, item.file, {
          onProgress: (p: UploadProgress) => {
            setQueue(prev =>
              prev.map(q =>
                q.id === item.id
                  ? {
                      ...q,
                      percent: p.percentage,
                      details:
                        `${formatBytes(p.bytesUploaded)} of ${formatBytes(p.bytesTotal)}` +
                        (p.remainingTime > 0 ? ` — ${formatTime(p.remainingTime)} remaining` : ''),
                    }
                  : q,
              ),
            )
          },
        })

        if (!result.success) {
          throw new Error(result.error || 'Storage upload failed')
        }

        // Persist metadata. On failure, clean up the orphaned storage object.
        const payload = opts.buildMetadataPayload(item, gameId, storagePath, clipOrder)
        const res = await fetch(opts.metadataEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          await supabase.storage.from(opts.bucketName).remove([storagePath])
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || 'Failed to save metadata')
        }

        setQueue(prev =>
          prev.map(q =>
            q.id === item.id ? { ...q, status: 'done', percent: 100 } : q,
          ),
        )
      } catch (err) {
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : q,
          ),
        )
      }
    },
    [opts, setQueue],
  )

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setIsProcessing(true)

    // clipOrder counts already-completed items + 1 to support resume scenarios
    let clipOrder = queueRef.current.filter(q => q.status === 'done').length + 1

    // Each iteration re-reads queueRef to pick up appendFiles/retryItem mid-batch.
    while (true) {
      const next = queueRef.current.find(q => q.status === 'queued')
      if (!next) break
      await uploadOne(next, lastGameIdRef.current, clipOrder)
      clipOrder++
    }

    processingRef.current = false
    setIsProcessing(false)
  }, [uploadOne])

  const startBatch = useCallback(
    async (gameId: string): Promise<{ allDone: boolean; queueLength: number }> => {
      lastGameIdRef.current = gameId
      await drainQueue()
      const finalQueue = queueRef.current
      return {
        allDone: finalQueue.length > 0 && finalQueue.every(q => q.status === 'done'),
        queueLength: finalQueue.length,
      }
    },
    [drainQueue],
  )

  const retryItem = useCallback(
    (id: string) => {
      setQueue(prev =>
        prev.map(q =>
          q.id === id
            ? { ...q, status: 'queued', error: undefined, percent: 0, details: null }
            : q,
        ),
      )
      // If a batch isn't already running and we know the gameId, drain immediately.
      // Otherwise the in-flight loop will pick up the requeued item on its next iteration.
      if (!processingRef.current && lastGameIdRef.current) {
        void drainQueue()
      }
    },
    [drainQueue, setQueue],
  )

  const resetQueue = useCallback(() => {
    setQueue(() => [])
  }, [setQueue])

  return {
    queue,
    isProcessing,
    appendFiles,
    removeItem,
    updateClipLabel,
    retryItem,
    startBatch,
    resetQueue,
  }
}
