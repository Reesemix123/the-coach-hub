/**
 * useKeyboardShortcuts Hook
 *
 * Handles common keyboard shortcuts for multi-select interfaces
 * - Escape: Clear selection
 * - Cmd/Ctrl+A: Select all
 *
 * @example
 * useKeyboardShortcuts({
 *   onSelectAll: handleSelectAll,
 *   onClearSelection: handleClearSelection,
 *   enabled: selectedCount > 0 || items.length > 0
 * });
 */

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onSelectAll,
  onClearSelection,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Clear selection
      if (e.key === 'Escape' && onClearSelection) {
        onClearSelection();
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && onSelectAll) {
        e.preventDefault();
        onSelectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectAll, onClearSelection, enabled]);
}
