'use client';

import { useState } from 'react';
import { X, Save, ArrowRight, Scissors } from 'lucide-react';
import { formatTimeMs } from '@/types/timeline';
import Link from 'next/link';

interface SliceModalProps {
  isOpen: boolean;
  startTimeMs: number;
  endTimeMs: number;
  gameId: string;
  teamId: string;
  onSave: (playData?: { playCode?: string; notes?: string }) => Promise<void>;
  onCancel: () => void;
}

export function SliceModal({
  isOpen,
  startTimeMs,
  endTimeMs,
  gameId,
  teamId,
  onSave,
  onCancel,
}: SliceModalProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const durationMs = endTimeMs - startTimeMs;
  const durationSec = Math.round(durationMs / 1000);

  const handleQuickSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ notes: notes.trim() || undefined });
    } finally {
      setIsSaving(false);
    }
  };

  // Build URL for full tag page with timestamps
  const tagPageUrl = `/teams/${teamId}/film/${gameId}/tag?start=${Math.round(startTimeMs / 1000)}&end=${Math.round(endTimeMs / 1000)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Scissors size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Play Sliced</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Time info */}
          <div className="bg-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Start</span>
              <span className="font-mono font-medium text-gray-900">{formatTimeMs(startTimeMs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">End</span>
              <span className="font-mono font-medium text-gray-900">{formatTimeMs(endTimeMs)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium text-gray-900">{durationSec} seconds</span>
            </div>
          </div>

          {/* Quick notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Quick Note (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Great catch by #21, Missed tackle..."
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {/* Quick Save */}
          <button
            onClick={handleQuickSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Quick Save Play'}
          </button>

          {/* Link to full tag page */}
          <Link
            href={tagPageUrl}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span>Add Full Play Details</span>
            <ArrowRight size={18} />
          </Link>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SliceModal;
