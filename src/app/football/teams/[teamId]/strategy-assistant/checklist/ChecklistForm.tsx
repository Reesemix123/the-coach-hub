// src/app/teams/[teamId]/strategy-assistant/checklist/ChecklistForm.tsx
// Client component for checklist items

'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, Circle, AlertCircle, StickyNote } from 'lucide-react';

interface ChecklistItem {
  id: string;
  item_text: string;
  priority: 1 | 2 | 3;
  is_completed: boolean;
  notes: string | null;
  completed_at: string | null;
  is_auto_generated: boolean;
}

interface Props {
  teamId: string;
  gameId: string;
  items: ChecklistItem[];
}

export default function ChecklistForm({ teamId, gameId, items }: Props) {
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    items.forEach((item) => {
      initial[item.id] = item.is_completed;
    });
    return initial;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.id] = item.notes || '';
    });
    return initial;
  });

  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const supabase = createClient();

  const handleToggleComplete = async (itemId: string, currentState: boolean) => {
    const newState = !currentState;

    // Optimistic update
    setCompletedItems((prev) => ({
      ...prev,
      [itemId]: newState
    }));

    setUpdating((prev) => ({ ...prev, [itemId]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('preparation_checklist')
        .update({
          is_completed: newState,
          completed_at: newState ? new Date().toISOString() : null,
          completed_by: newState ? user?.id : null
        })
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating checklist item:', error);
      // Revert optimistic update
      setCompletedItems((prev) => ({
        ...prev,
        [itemId]: currentState
      }));
      alert('Failed to update item. Please try again.');
    } finally {
      setUpdating((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleSaveNotes = async (itemId: string) => {
    setUpdating((prev) => ({ ...prev, [itemId]: true }));

    try {
      const { error } = await supabase
        .from('preparation_checklist')
        .update({
          notes: notes[itemId] || null
        })
        .eq('id', itemId);

      if (error) throw error;

      // Hide notes field after saving
      setShowNotes((prev) => ({ ...prev, [itemId]: false }));
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please try again.');
    } finally {
      setUpdating((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const getPriorityBadge = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">
            <AlertCircle className="w-3 h-3" />
            Must Do
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
            Should Do
          </span>
        );
      case 3:
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
            Nice to Have
          </span>
        );
    }
  };

  // Sort: incomplete first, then by priority
  const sortedItems = [...items].sort((a, b) => {
    const aComplete = completedItems[a.id];
    const bComplete = completedItems[b.id];

    if (aComplete !== bComplete) {
      return aComplete ? 1 : -1; // Incomplete first
    }

    return a.priority - b.priority; // Then by priority
  });

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => {
        const isCompleted = completedItems[item.id];
        const isUpdating = updating[item.id];
        const hasNotes = !!notes[item.id];
        const showNotesField = showNotes[item.id];

        return (
          <div
            key={item.id}
            className={`border rounded-lg p-4 transition-all ${
              isCompleted
                ? 'border-gray-200 bg-gray-50'
                : item.priority === 1
                ? 'border-red-200 bg-red-50'
                : item.priority === 2
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => handleToggleComplete(item.id, isCompleted)}
                disabled={isUpdating}
                className="flex-shrink-0 mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p
                    className={`text-base ${
                      isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}
                  >
                    {item.item_text}
                  </p>
                  {getPriorityBadge(item.priority)}
                </div>

                {item.completed_at && (
                  <div className="text-xs text-gray-500 mb-2">
                    ✓ Completed{' '}
                    {new Date(item.completed_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                )}

                {/* Notes Section */}
                {!showNotesField && (
                  <button
                    onClick={() => setShowNotes((prev) => ({ ...prev, [item.id]: true }))}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 mt-1"
                  >
                    <StickyNote className="w-3 h-3" />
                    {hasNotes ? 'Edit notes' : 'Add notes'}
                  </button>
                )}

                {showNotesField && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={notes[item.id] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [item.id]: e.target.value
                        }))
                      }
                      placeholder="Add notes about this task..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveNotes(item.id)}
                        disabled={isUpdating}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                      >
                        {isUpdating ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button
                        onClick={() => {
                          setShowNotes((prev) => ({ ...prev, [item.id]: false }));
                          // Reset notes to original value
                          setNotes((prev) => ({
                            ...prev,
                            [item.id]: item.notes || ''
                          }));
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {hasNotes && !showNotesField && (
                  <div className="mt-2 text-sm text-gray-600 bg-gray-100 rounded p-2 border border-gray-200">
                    {notes[item.id]}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
