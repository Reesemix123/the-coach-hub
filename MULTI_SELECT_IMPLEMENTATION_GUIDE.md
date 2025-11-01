# Multi-Select System Implementation Guide

## Overview

This guide shows how to implement the reusable multi-select system for **both Playbook and Film management**. The system provides a unified UX pattern for selecting multiple items and performing bulk operations.

## Architecture

```
Reusable Components:
├── useMultiSelect hook      → Selection state management
├── useKeyboardShortcuts hook → Escape & Cmd+A support
├── SelectionBadge component  → Hover-to-reveal circular checkbox
├── BulkActionBar component   → Floating bottom action bar
└── bulkOperations utils      → Common DB operations
```

---

## Quick Start: 3 Steps to Add Multi-Select

### Step 1: Add Hooks

```tsx
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function MyPage() {
  const items = [...]; // Your data (plays, videos, games, etc.)

  // Add multi-select hook
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount
  } = useMultiSelect<string>(); // or <number> for numeric IDs

  // Add keyboard shortcuts
  useKeyboardShortcuts({
    onSelectAll: () => selectAll(items.map(item => item.id)),
    onClearSelection: clearSelection,
    enabled: items.length > 0
  });

  // ... rest of component
}
```

### Step 2: Add Selection Badge to Items

```tsx
import SelectionBadge from '@/components/SelectionBadge';

// In your item card/row rendering:
<div className="relative group"> {/* Add 'group' class */}
  <SelectionBadge
    isSelected={isSelected(item.id)}
    onToggle={() => toggleSelect(item.id)}
  />

  {/* Your existing item content */}
</div>
```

### Step 3: Add Bulk Action Bar

```tsx
import BulkActionBar from '@/components/BulkActionBar';

<BulkActionBar
  selectedCount={selectedCount}
  totalCount={items.length}
  itemName="play" // or "video", "game", etc.
  primaryActions={[
    {
      label: 'New Game Plan',
      onClick: handleCreateGamePlan,
      variant: 'primary'
    }
  ]}
  secondaryActions={[
    {
      label: 'Delete',
      onClick: handleBulkDelete,
      variant: 'danger'
    }
  ]}
  onSelectAll={() => selectAll(items.map(i => i.id))}
  onClear={clearSelection}
/>
```

---

## Complete Example: Playbook Multi-Select

### File: `/src/app/teams/[teamId]/playbook/page.tsx`

```tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import SelectionBadge from '@/components/SelectionBadge';
import BulkActionBar from '@/components/BulkActionBar';
import { bulkArchive, bulkDelete, confirmBulkOperation } from '@/utils/bulkOperations';

export default function TeamPlaybookPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [plays, setPlays] = useState<Play[]>([]);
  const [filteredPlays, setFilteredPlays] = useState<Play[]>([]);
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-select hooks
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount,
  } = useMultiSelect<string>(); // Using play_code as ID

  useKeyboardShortcuts({
    onSelectAll: () => selectAll(filteredPlays.map(p => p.play_code)),
    onClearSelection: clearSelection,
    enabled: filteredPlays.length > 0,
  });

  // Fetch data
  useEffect(() => {
    fetchPlays();
    fetchGamePlans();
  }, [teamId]);

  async function fetchPlays() {
    const { data } = await supabase
      .from('playbook_plays')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_archived', false);

    setPlays(data || []);
    setFilteredPlays(data || []);
  }

  async function fetchGamePlans() {
    const { data } = await supabase
      .from('game_plans')
      .select('*')
      .eq('team_id', teamId);

    setGamePlans(data || []);
  }

  // Bulk operations
  async function handleCreateGamePlan() {
    if (selectedCount === 0) return;

    const name = prompt('Game Plan Name:');
    if (!name) return;

    try {
      // Create game plan
      const { data: newPlan, error: planError } = await supabase
        .from('game_plans')
        .insert({ team_id: teamId, name })
        .select()
        .single();

      if (planError) throw planError;

      // Add plays to game plan
      const selectedArray = Array.from(selectedIds);
      const gamePlanPlays = selectedArray.map((playCode, index) => ({
        game_plan_id: newPlan.id,
        play_code: playCode,
        call_number: index + 1,
        sort_order: index,
      }));

      const { error: playsError } = await supabase
        .from('game_plan_plays')
        .insert(gamePlanPlays);

      if (playsError) throw playsError;

      alert(`Game plan "${name}" created with ${selectedCount} plays!`);
      clearSelection();
      fetchGamePlans();

    } catch (error) {
      console.error('Error creating game plan:', error);
      alert('Error creating game plan');
    }
  }

  async function handleAddToExistingGamePlan(gamePlanId: string) {
    if (selectedCount === 0) return;

    try {
      // Get max call number
      const { data: existing } = await supabase
        .from('game_plan_plays')
        .select('call_number, sort_order')
        .eq('game_plan_id', gamePlanId)
        .order('call_number', { ascending: false })
        .limit(1);

      const nextCallNumber = existing && existing.length > 0 ? existing[0].call_number + 1 : 1;
      const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      // Add plays
      const selectedArray = Array.from(selectedIds);
      const newPlays = selectedArray.map((playCode, index) => ({
        game_plan_id: gamePlanId,
        play_code: playCode,
        call_number: nextCallNumber + index,
        sort_order: nextSortOrder + index,
      }));

      const { error } = await supabase
        .from('game_plan_plays')
        .insert(newPlays);

      if (error) throw error;

      const gamePlan = gamePlans.find(gp => gp.id === gamePlanId);
      alert(`${selectedCount} plays added to "${gamePlan?.name}"`);
      clearSelection();

    } catch (error) {
      console.error('Error adding plays:', error);
      alert('Error adding plays to game plan');
    }
  }

  async function handleBulkArchive() {
    if (!confirmBulkOperation('archive', selectedCount, 'play')) return;

    const selectedArray = Array.from(selectedIds);
    const result = await bulkArchive('playbook_plays', 'play_code', selectedArray);

    if (result.success) {
      alert(`${selectedCount} plays archived`);
      clearSelection();
      fetchPlays();
    } else {
      alert('Error archiving plays: ' + result.error);
    }
  }

  async function handleBulkDelete() {
    if (!confirmBulkOperation('delete', selectedCount, 'play')) return;

    // Get play IDs from codes (since delete needs the ID field)
    const playsToDelete = plays.filter(p => selectedIds.has(p.play_code));
    const playIds = playsToDelete.map(p => p.id);

    const result = await bulkDelete('playbook_plays', 'id', playIds);

    if (result.success) {
      alert(`${selectedCount} plays deleted`);
      clearSelection();
      fetchPlays();
    } else {
      alert('Error deleting plays: ' + result.error);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-6">
        <h1>Team Playbook</h1>

        <div className="flex gap-2">
          <button onClick={() => setViewMode('grid')}>Grid</button>
          <button onClick={() => setViewMode('list')}>List</button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlays.map(play => (
            <div
              key={play.id}
              className={`
                relative group
                bg-white border rounded-xl p-6 transition-all
                ${isSelected(play.play_code)
                  ? 'border-blue-500 border-2 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-400'
                }
              `}
            >
              {/* Selection Badge */}
              <SelectionBadge
                isSelected={isSelected(play.play_code)}
                onToggle={() => toggleSelect(play.play_code)}
              />

              {/* Play content */}
              <div onClick={() => router.push(`/playbook?teamId=${teamId}`)}>
                <h3 className="text-lg font-semibold">{play.play_name}</h3>
                <p className="text-sm text-gray-600">{play.play_code}</p>
                <p className="text-sm text-gray-600">{play.attributes?.formation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedCount === filteredPlays.length && filteredPlays.length > 0}
                  onChange={() => {
                    if (selectedCount === filteredPlays.length) {
                      clearSelection();
                    } else {
                      selectAll(filteredPlays.map(p => p.play_code));
                    }
                  }}
                />
              </th>
              <th className="px-6 py-3 text-left">Code</th>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Formation</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlays.map(play => (
              <tr
                key={play.id}
                className={isSelected(play.play_code) ? 'bg-blue-50' : ''}
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={isSelected(play.play_code)}
                    onChange={() => toggleSelect(play.play_code)}
                  />
                </td>
                <td className="px-6 py-4">{play.play_code}</td>
                <td className="px-6 py-4">{play.play_name}</td>
                <td className="px-6 py-4">{play.attributes?.formation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        totalCount={filteredPlays.length}
        itemName="play"
        primaryActions={[
          {
            label: '+ New Game Plan',
            onClick: handleCreateGamePlan,
            variant: 'primary'
          },
          ...(gamePlans.length > 0 ? [{
            label: '+ Add to Existing',
            onClick: () => {
              // Show dropdown menu logic here
              // or use a modal to select game plan
            },
            variant: 'success' as const
          }] : [])
        ]}
        secondaryActions={[
          { label: 'Archive', onClick: handleBulkArchive },
          { label: 'Delete', onClick: handleBulkDelete, variant: 'danger' },
        ]}
        onSelectAll={() => selectAll(filteredPlays.map(p => p.play_code))}
        onClear={clearSelection}
      />
    </div>
  );
}
```

---

## Complete Example: Film Multi-Select

### File: `/src/app/film/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import SelectionBadge from '@/components/SelectionBadge';
import BulkActionBar from '@/components/BulkActionBar';
import { bulkDelete, confirmBulkOperation } from '@/utils/bulkOperations';

export default function FilmPage() {
  const supabase = createClient();

  const [videos, setVideos] = useState<Video[]>([]);

  // Multi-select hooks
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount,
  } = useMultiSelect<string>(); // Using video ID

  useKeyboardShortcuts({
    onSelectAll: () => selectAll(videos.map(v => v.id)),
    onClearSelection: clearSelection,
    enabled: videos.length > 0,
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    setVideos(data || []);
  }

  // Bulk operations
  async function handleCombineVideos() {
    if (selectedCount < 2) {
      alert('Select at least 2 videos to combine');
      return;
    }

    const name = prompt('Name for combined video:');
    if (!name) return;

    try {
      // Create virtual video group
      const selectedArray = Array.from(selectedIds);
      const { data: group, error: groupError } = await supabase
        .from('video_groups')
        .insert({ name, team_id: null }) // or get team_id from context
        .select()
        .single();

      if (groupError) throw groupError;

      // Create virtual video record
      const { error: videoError } = await supabase
        .from('videos')
        .insert({
          name: name,
          is_virtual: true,
          source_video_ids: selectedArray,
          virtual_name: name,
          video_count: selectedCount,
          video_group_id: group.id,
        });

      if (videoError) throw videoError;

      alert(`Combined ${selectedCount} videos into "${name}"`);
      clearSelection();
      fetchVideos();

    } catch (error) {
      console.error('Error combining videos:', error);
      alert('Error combining videos');
    }
  }

  async function handleBulkDelete() {
    if (!confirmBulkOperation('delete', selectedCount, 'video')) return;

    const selectedArray = Array.from(selectedIds);
    const result = await bulkDelete('videos', 'id', selectedArray);

    if (result.success) {
      alert(`${selectedCount} videos deleted`);
      clearSelection();
      fetchVideos();
    } else {
      alert('Error deleting videos: ' + result.error);
    }
  }

  async function handleExportVideos() {
    alert('Export functionality coming soon!');
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-3xl font-semibold mb-6">Game Film</h1>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map(video => (
          <div
            key={video.id}
            className={`
              relative group
              bg-white border rounded-xl overflow-hidden transition-all
              ${isSelected(video.id)
                ? 'border-blue-500 border-2 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-400'
              }
            `}
          >
            {/* Selection Badge */}
            <SelectionBadge
              isSelected={isSelected(video.id)}
              onToggle={() => toggleSelect(video.id)}
            />

            {/* Video thumbnail/content */}
            <div className="p-6">
              <div className="aspect-video bg-gray-100 rounded mb-4 flex items-center justify-center">
                {video.is_virtual ? '🎬' : '📹'}
              </div>
              <h3 className="text-lg font-semibold">{video.name}</h3>
              <p className="text-sm text-gray-600">
                {video.is_virtual
                  ? `${video.video_count} videos combined`
                  : new Date(video.created_at).toLocaleDateString()
                }
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        totalCount={videos.length}
        itemName="video"
        primaryActions={[
          {
            label: 'Combine Videos',
            onClick: handleCombineVideos,
            variant: 'primary'
          },
        ]}
        secondaryActions={[
          { label: 'Export', onClick: handleExportVideos },
          { label: 'Delete', onClick: handleBulkDelete, variant: 'danger' },
        ]}
        onSelectAll={() => selectAll(videos.map(v => v.id))}
        onClear={clearSelection}
      />
    </div>
  );
}
```

---

## Component API Reference

### useMultiSelect<T>()

**Returns:**
- `selectedIds: Set<T>` - Set of selected IDs
- `isSelected(id: T): boolean` - Check if item is selected
- `toggleSelect(id: T): void` - Toggle selection
- `selectAll(ids: T[]): void` - Select all provided IDs
- `clearSelection(): void` - Clear all selections
- `selectedCount: number` - Count of selected items

### useKeyboardShortcuts(options)

**Options:**
- `onSelectAll: () => void` - Called on Cmd/Ctrl+A
- `onClearSelection: () => void` - Called on Escape
- `enabled: boolean` - Enable/disable shortcuts

### SelectionBadge

**Props:**
- `isSelected: boolean` - Whether item is selected
- `onToggle: () => void` - Called when clicked
- `position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
- `size?: 'sm' | 'md' | 'lg'`

### BulkActionBar

**Props:**
- `selectedCount: number` - Number of selected items
- `totalCount: number` - Total number of items
- `itemName: string` - Singular item name ('play', 'video', etc.)
- `primaryActions?: BulkAction[]` - Main actions (blue/green buttons)
- `secondaryActions?: BulkAction[]` - Secondary actions (gray/red buttons)
- `onSelectAll?: () => void` - Select all handler
- `onClear: () => void` - Clear selection handler

**BulkAction type:**
```ts
{
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'default';
  icon?: React.ReactNode;
  disabled?: boolean;
}
```

---

## Best Practices

1. **Always add `group` class to selectable items** for hover states
2. **Use semantic IDs** (play_code, video ID) not array indices
3. **Clear selection after bulk operations** for better UX
4. **Show confirmation dialogs** for destructive operations
5. **Provide keyboard shortcuts** for power users
6. **Handle empty selection gracefully** (disable buttons or hide action bar)
7. **Test on mobile** - selection badges should be always visible, not hover-only

---

## Troubleshooting

**Q: Selection badge not appearing on hover**
A: Add `group` class to parent container

**Q: Selection cleared when filtering items**
A: This is by design. Consider persisting selection across filters if needed.

**Q: Keyboard shortcuts not working**
A: Check that `enabled` prop is true and component is mounted

**Q: Action bar covering content**
A: Add bottom padding to your page (e.g., `pb-32`) when items are selected

---

## Migration Checklist

For existing pages with checkboxes:

- [ ] Remove custom selection state (`useState<Set<string>>`)
- [ ] Replace with `useMultiSelect()` hook
- [ ] Replace checkbox UI with `<SelectionBadge />`
- [ ] Replace conditional buttons with `<BulkActionBar />`
- [ ] Add `useKeyboardShortcuts()` hook
- [ ] Test selection persistence across view changes
- [ ] Test keyboard navigation
- [ ] Test mobile touch interactions

---

## Demo Video Script

1. Show grid view with plays
2. Hover over play → selection badge appears
3. Click badge → play becomes selected (blue border)
4. Click multiple plays → selection count increases
5. Floating action bar slides up from bottom
6. Click "New Game Plan" → creates game plan with selected plays
7. Press Escape → selection clears, action bar disappears
8. Press Cmd+A → all plays selected
9. Switch to list view → selection persists
10. Filter plays → selection badges still visible on filtered items
