/**
 * useMultiSelect Hook
 *
 * Reusable hook for managing multi-select state across different content types
 * (plays, films, games, etc.)
 *
 * @example
 * const {
 *   selectedIds,
 *   isSelected,
 *   toggleSelect,
 *   selectAll,
 *   clearSelection,
 *   selectedCount
 * } = useMultiSelect<string>(); // or useMultiSelect<number>() for numeric IDs
 */

import { useState, useCallback } from 'react';

interface UseMultiSelectReturn<T> {
  selectedIds: Set<T>;
  isSelected: (id: T) => boolean;
  toggleSelect: (id: T) => void;
  selectAll: (ids: T[]) => void;
  clearSelection: () => void;
  selectedCount: number;
  setSelectedIds: (ids: Set<T>) => void;
}

export function useMultiSelect<T = string>(): UseMultiSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const isSelected = useCallback(
    (id: T) => selectedIds.has(id),
    [selectedIds]
  );

  const toggleSelect = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size,
    setSelectedIds,
  };
}
