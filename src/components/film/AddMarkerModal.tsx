'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { MarkerType } from '@/types/football';
import { MARKER_COLORS, MARKER_LABELS } from '@/types/football';

interface AddMarkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (markerType: MarkerType, label?: string, quarter?: number) => void;
  currentTimestamp: string;
}

export default function AddMarkerModal({
  isOpen,
  onClose,
  onAdd,
  currentTimestamp
}: AddMarkerModalProps) {
  const [markerType, setMarkerType] = useState<MarkerType>('custom');
  const [customLabel, setCustomLabel] = useState('');
  const [quarter, setQuarter] = useState<number | undefined>(undefined);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = customLabel || MARKER_LABELS[markerType];
    onAdd(markerType, label, quarter);

    // Reset form
    setMarkerType('custom');
    setCustomLabel('');
    setQuarter(undefined);
    onClose();
  };

  const markerTypeOptions: { value: MarkerType; label: string }[] = [
    { value: 'quarter_start', label: 'Quarter Start' },
    { value: 'quarter_end', label: 'Quarter End' },
    { value: 'halftime', label: 'Halftime' },
    { value: 'overtime', label: 'Overtime' },
    { value: 'big_play', label: 'Big Play' },
    { value: 'turnover', label: 'Turnover' },
    { value: 'timeout', label: 'Timeout' },
    { value: 'custom', label: 'Custom' }
  ];

  const needsQuarter = markerType === 'quarter_start' || markerType === 'quarter_end';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Video Marker</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Timestamp Display */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Timestamp</div>
            <div className="text-xl font-semibold text-gray-900">{currentTimestamp}</div>
          </div>

          {/* Marker Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Marker Type
            </label>
            <select
              value={markerType}
              onChange={(e) => setMarkerType(e.target.value as MarkerType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              {markerTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quarter (conditional) */}
          {needsQuarter && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quarter
              </label>
              <select
                value={quarter || ''}
                onChange={(e) => setQuarter(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              >
                <option value="">Select Quarter</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
                <option value="5">OT</option>
              </select>
            </div>
          )}

          {/* Custom Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label {markerType !== 'custom' && '(Optional)'}
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={MARKER_LABELS[markerType]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          {/* Color Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: MARKER_COLORS[markerType] }}
            />
            <span className="text-sm text-gray-600">
              Marker Color: {MARKER_COLORS[markerType]}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold transition-colors"
            >
              Add Marker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
