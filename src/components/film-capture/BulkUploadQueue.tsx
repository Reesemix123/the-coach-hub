// src/components/film-capture/BulkUploadQueue.tsx
// Pure presentational queue list for the bulk film-capture uploader.
// All state lives in useBulkUpload — this component just renders.

'use client'

import { Loader2, Check, X, AlertCircle } from 'lucide-react'
import { formatBytes } from '@/lib/utils/resumable-upload'
import type { UploadItem } from '@/hooks/useBulkUpload'

interface BulkUploadQueueProps {
  queue: UploadItem[]
  onRemove: (id: string) => void
  onLabelChange: (id: string, label: string) => void
  onRetry: (id: string) => void
}

export function BulkUploadQueue({
  queue,
  onRemove,
  onLabelChange,
  onRetry,
}: BulkUploadQueueProps) {
  if (queue.length === 0) return null

  return (
    <ul className="space-y-2">
      {queue.map((item, idx) => (
        <UploadQueueItem
          key={item.id}
          item={item}
          index={idx}
          onRemove={onRemove}
          onLabelChange={onLabelChange}
          onRetry={onRetry}
        />
      ))}
    </ul>
  )
}

interface UploadQueueItemProps {
  item: UploadItem
  index: number
  onRemove: (id: string) => void
  onLabelChange: (id: string, label: string) => void
  onRetry: (id: string) => void
}

function UploadQueueItem({
  item,
  index,
  onRemove,
  onLabelChange,
  onRetry,
}: UploadQueueItemProps) {
  const labelDisabled = item.status === 'uploading' || item.status === 'done'

  return (
    <li className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-mono w-6 shrink-0">{index + 1}.</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-xs text-gray-500">{formatBytes(item.file.size)}</p>
        </div>

        <input
          type="text"
          placeholder="Clip label (optional)"
          value={item.clipLabel}
          onChange={e => onLabelChange(item.id, e.target.value)}
          disabled={labelDisabled}
          className="hidden sm:block w-40 px-2 py-1 text-xs border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
        />

        <StatusBadge status={item.status} />

        {item.status === 'queued' && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.file.name}`}
            className="p-1 text-gray-400 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        )}

        {item.status === 'error' && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="px-2 py-1 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700"
          >
            Retry
          </button>
        )}
      </div>

      {(item.status === 'uploading' || item.status === 'done') && (
        <div className="mt-2">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${item.percent}%` }}
            />
          </div>
          {item.details && (
            <p className="text-xs text-gray-500 mt-1">{item.details}</p>
          )}
        </div>
      )}

      {item.status === 'error' && item.error && (
        <p className="text-xs text-red-600 mt-1.5">{item.error}</p>
      )}
    </li>
  )
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  switch (status) {
    case 'uploading':
      return <Loader2 size={16} className="animate-spin text-gray-700" />
    case 'done':
      return <Check size={16} className="text-green-600" />
    case 'error':
      return <AlertCircle size={16} className="text-red-600" />
    case 'cancelled':
      return <X size={16} className="text-gray-400" />
    case 'queued':
    default:
      return <span className="w-2 h-2 rounded-full bg-gray-300" />
  }
}
