/**
 * Bulk Operations Utility
 *
 * Common patterns for bulk database operations with Supabase.
 * Provides reusable functions for archive, delete, and update operations.
 */

import { createClient } from '@/utils/supabase/client';

/**
 * Bulk archive items (set is_archived = true)
 */
export async function bulkArchive(
  tableName: string,
  idField: string,
  ids: string[] | number[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from(tableName)
      .update({ is_archived: true })
      .in(idField, ids);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`Error archiving items from ${tableName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk delete items
 */
export async function bulkDelete(
  tableName: string,
  idField: string,
  ids: string[] | number[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .in(idField, ids);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting items from ${tableName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk update field value
 */
export async function bulkUpdate<T>(
  tableName: string,
  idField: string,
  ids: string[] | number[],
  updates: Partial<T>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from(tableName)
      .update(updates)
      .in(idField, ids);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`Error updating items in ${tableName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Confirm dialog helper for destructive operations
 */
export function confirmBulkOperation(
  operation: 'archive' | 'delete' | 'update',
  count: number,
  itemName: string
): boolean {
  const itemText = count === 1 ? itemName : `${itemName}s`;

  switch (operation) {
    case 'archive':
      return confirm(
        `Archive ${count} ${itemText}? They will be hidden from your ${itemName} list.`
      );
    case 'delete':
      return confirm(
        `Permanently delete ${count} ${itemText}? This cannot be undone.`
      );
    case 'update':
      return confirm(`Update ${count} ${itemText}?`);
    default:
      return false;
  }
}
