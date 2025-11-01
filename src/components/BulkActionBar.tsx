/**
 * BulkActionBar Component
 *
 * Generic floating action bar for bulk operations across different content types.
 * Appears at bottom of viewport when items are selected.
 *
 * Features:
 * - Responsive (bottom on desktop, top on mobile)
 * - Customizable actions via props
 * - Selection count and clear button
 * - Smooth slide-up animation
 * - Accessible keyboard navigation
 *
 * @example
 * // For Playbook
 * <BulkActionBar
 *   selectedCount={selectedPlayCodes.size}
 *   totalCount={filteredPlays.length}
 *   itemName="play"
 *   primaryActions={[
 *     { label: 'New Game Plan', onClick: handleCreateGamePlan, variant: 'primary' },
 *     { label: 'Add to Existing', onClick: handleAddToExisting, variant: 'success' }
 *   ]}
 *   secondaryActions={[
 *     { label: 'Archive', onClick: handleArchive },
 *     { label: 'Delete', onClick: handleDelete, variant: 'danger' }
 *   ]}
 *   onSelectAll={handleSelectAll}
 *   onClear={handleClearSelection}
 * />
 *
 * // For Film
 * <BulkActionBar
 *   selectedCount={selectedVideoIds.size}
 *   totalCount={videos.length}
 *   itemName="video"
 *   primaryActions={[
 *     { label: 'Create Playlist', onClick: handleCreatePlaylist, variant: 'primary' },
 *     { label: 'Combine Videos', onClick: handleCombineVideos, variant: 'success' }
 *   ]}
 *   secondaryActions={[
 *     { label: 'Delete', onClick: handleDelete, variant: 'danger' },
 *     { label: 'Export', onClick: handleExport }
 *   ]}
 *   onSelectAll={handleSelectAll}
 *   onClear={handleClearSelection}
 * />
 */

'use client';

interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'default';
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  itemName: string; // 'play', 'video', 'game', etc.
  primaryActions?: BulkAction[];
  secondaryActions?: BulkAction[];
  onSelectAll?: () => void;
  onClear: () => void;
  showSelectAll?: boolean;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  itemName,
  primaryActions = [],
  secondaryActions = [],
  onSelectAll,
  onClear,
  showSelectAll = true,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const itemText = selectedCount === 1 ? itemName : `${itemName}s`;
  const canSelectMore = showSelectAll && selectedCount < totalCount;

  const getButtonClasses = (variant: BulkAction['variant'] = 'default') => {
    const baseClasses = 'px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm';

    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700`;
      case 'success':
        return `${baseClasses} bg-green-600 text-white hover:bg-green-700`;
      case 'danger':
        return `${baseClasses} border border-red-300 text-red-600 hover:bg-red-50`;
      default:
        return `${baseClasses} border border-gray-300 text-gray-700 hover:bg-gray-50`;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-900 shadow-2xl z-50 animate-slide-up">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-gray-900">
              ✓ {selectedCount} {itemText} selected
            </span>

            {canSelectMore && onSelectAll && (
              <button
                onClick={onSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Select All ({totalCount})
              </button>
            )}

            <button
              onClick={onClear}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>

          <button
            onClick={onClear}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close action bar"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Primary Actions */}
          {primaryActions.map((action, index) => (
            <button
              key={`primary-${index}`}
              onClick={action.onClick}
              disabled={action.disabled}
              className={getButtonClasses(action.variant)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </button>
          ))}

          {/* Secondary Actions */}
          {secondaryActions.map((action, index) => (
            <button
              key={`secondary-${index}`}
              onClick={action.onClick}
              disabled={action.disabled}
              className={getButtonClasses(action.variant)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announce selection count to screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {selectedCount} {itemText} selected
      </div>
    </div>
  );
}
