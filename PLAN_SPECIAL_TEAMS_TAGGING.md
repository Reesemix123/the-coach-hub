# Plan: Special Teams Film Tagging

## Overview

Add comprehensive special teams play tagging to the film tagging system. Currently, the tagging modal only supports "Offense" and "Defense" modes. This plan adds a third mode: "Special Teams" with unit-specific tagging forms.

---

## Current State Analysis

### What Exists:
1. **Film Tagging UI** (`/src/app/teams/[teamId]/film/[gameId]/page.tsx`)
   - Toggle between "Offense" and "Defense" using `isTaggingOpponent` boolean
   - Form captures context (down, distance, yard line, hash), results, and player attribution
   - Tier-based progressive disclosure (context → players → OL → defense tabs)

2. **Special Teams Formations** (`footballConfig.ts`)
   - 5 formations defined: Kickoff, Kick Return, Punt, Punt Return, Field Goal
   - 24 plays total across all units
   - Helper functions for play paths: `getKickoffPlayPaths()`, `getKickReturnPlayPaths()`, etc.

3. **Special Teams Attributes** (`footballConfig.ts`)
   - `unit`: Kickoff, Kick Return, Punt, Punt Return, Field Goal, PAT
   - `kickoffType`: Deep, Squib, Onside variants
   - `puntType`: Standard, Directional, Pooch, Rugby, Sky
   - `returnScheme`: Middle, Left, Right, Wall, Wedge, Fake

4. **Database** (`play_instances` table)
   - Has `play_type` field that includes 'kick' and 'pat' options
   - No dedicated special teams columns

---

## Proposed Changes

### Phase 1: Database Schema Extension

**New Migration: `039_special_teams_tracking.sql`**

```sql
-- Add special teams tracking columns to play_instances
ALTER TABLE play_instances
  -- Unit identification
  ADD COLUMN IF NOT EXISTS special_teams_unit TEXT CHECK (special_teams_unit IN (
    'kickoff', 'kick_return', 'punt', 'punt_return', 'field_goal', 'pat'
  )),

  -- Kicking plays (Kickoff, Punt, FG, PAT)
  ADD COLUMN IF NOT EXISTS kicker_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS kick_result TEXT CHECK (kick_result IN (
    'made', 'missed', 'blocked', 'touchback', 'fair_catch',
    'returned', 'out_of_bounds', 'onside_recovered', 'onside_lost',
    'fake_success', 'fake_fail', 'muffed'
  )),
  ADD COLUMN IF NOT EXISTS kick_distance INTEGER, -- For FG: distance of attempt; For Punt/KO: hang time or distance

  -- Return plays (Kick Return, Punt Return)
  ADD COLUMN IF NOT EXISTS returner_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS return_yards INTEGER,
  ADD COLUMN IF NOT EXISTS is_fair_catch BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_touchback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_muffed BOOLEAN DEFAULT FALSE,

  -- Punt specific
  ADD COLUMN IF NOT EXISTS punter_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS punt_type TEXT CHECK (punt_type IN (
    'standard', 'directional_left', 'directional_right', 'pooch', 'rugby', 'sky'
  )),
  ADD COLUMN IF NOT EXISTS gunner_tackle_id UUID REFERENCES players(id), -- Which gunner made tackle

  -- Kickoff specific
  ADD COLUMN IF NOT EXISTS kickoff_type TEXT CHECK (kickoff_type IN (
    'deep_center', 'deep_left', 'deep_right',
    'squib_center', 'squib_left', 'squib_right',
    'onside_center', 'onside_left', 'onside_right'
  )),

  -- Long snapper tracking
  ADD COLUMN IF NOT EXISTS long_snapper_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS snap_quality TEXT CHECK (snap_quality IN ('good', 'low', 'high', 'wide', 'fumbled')),

  -- Holder tracking (FG/PAT)
  ADD COLUMN IF NOT EXISTS holder_id UUID REFERENCES players(id),

  -- Coverage/Return player tracking (who made tackle on coverage)
  ADD COLUMN IF NOT EXISTS coverage_tackler_id UUID REFERENCES players(id),

  -- Penalty tracking
  ADD COLUMN IF NOT EXISTS penalty_on_play BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS penalty_type TEXT,
  ADD COLUMN IF NOT EXISTS penalty_yards INTEGER;

-- Index for special teams queries
CREATE INDEX IF NOT EXISTS idx_play_instances_st_unit ON play_instances(special_teams_unit);
CREATE INDEX IF NOT EXISTS idx_play_instances_kicker ON play_instances(kicker_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_returner ON play_instances(returner_id);
```

---

### Phase 2: TypeScript Type Updates

**Update `/src/types/football.ts`**

Add to `PlayInstance` interface:
```typescript
// Special Teams fields
special_teams_unit?: 'kickoff' | 'kick_return' | 'punt' | 'punt_return' | 'field_goal' | 'pat';

// Kicking
kicker_id?: string;
kick_result?: 'made' | 'missed' | 'blocked' | 'touchback' | 'fair_catch' |
              'returned' | 'out_of_bounds' | 'onside_recovered' | 'onside_lost' |
              'fake_success' | 'fake_fail' | 'muffed';
kick_distance?: number;

// Returns
returner_id?: string;
return_yards?: number;
is_fair_catch?: boolean;
is_touchback?: boolean;
is_muffed?: boolean;

// Punt
punter_id?: string;
punt_type?: 'standard' | 'directional_left' | 'directional_right' | 'pooch' | 'rugby' | 'sky';
gunner_tackle_id?: string;

// Kickoff
kickoff_type?: 'deep_center' | 'deep_left' | 'deep_right' |
               'squib_center' | 'squib_left' | 'squib_right' |
               'onside_center' | 'onside_left' | 'onside_right';

// Snapping/Holding
long_snapper_id?: string;
snap_quality?: 'good' | 'low' | 'high' | 'wide' | 'fumbled';
holder_id?: string;

// Coverage
coverage_tackler_id?: string;

// Penalties
penalty_on_play?: boolean;
penalty_type?: string;
penalty_yards?: number;
```

Add new constant:
```typescript
export const SPECIAL_TEAMS_KICK_RESULTS = [
  'made', 'missed', 'blocked', 'touchback', 'fair_catch',
  'returned', 'out_of_bounds', 'onside_recovered', 'onside_lost',
  'fake_success', 'fake_fail', 'muffed'
] as const;

export const SPECIAL_TEAMS_PENALTIES = [
  'Illegal Block', 'Holding', 'Offsides', 'Illegal Formation',
  'Fair Catch Interference', 'Kick Catch Interference', 'Running Into Kicker',
  'Roughing the Kicker', 'Illegal Touching', 'Invalid Fair Catch Signal'
] as const;
```

---

### Phase 3: UI Changes - Film Tagging Modal

**Update `/src/app/teams/[teamId]/film/[gameId]/page.tsx`**

#### 3.1 Add State Variables
```typescript
// Change from boolean to enum
const [taggingMode, setTaggingMode] = useState<'offense' | 'defense' | 'specialTeams'>('offense');
const [specialTeamsUnit, setSpecialTeamsUnit] = useState<string>('');
```

#### 3.2 Update Toggle UI (Three-way toggle)
Replace the current two-button toggle with a three-button toggle:

```
[  Offense  ] [  Defense  ] [ Special Teams ]
```

When "Special Teams" is selected, show a dropdown for unit selection:
- Kickoff
- Kick Return
- Punt
- Punt Return
- Field Goal
- PAT

#### 3.3 Drive Context for Special Teams
Special teams plays have different drive relationships:

**Part of current drive (show drive selector):**
- Punt (ends your offensive drive)
- Field Goal (ends your offensive drive)
- PAT (part of scoring drive)
- Punt Return (part of your defensive "drive" - what opponent faced)

**Starts a NEW drive (hide drive selector, auto-create):**
- Kickoff (starts opponent's drive OR your drive after opponent scores)
- Kick Return (starts your offensive drive)

#### 3.4 Add Tab for Special Teams
Add a new tab alongside context/players/ol/defense:

```
[ Context ] [ Players ] [ OL ] [ Defense ] [ Special Teams ]
```

The Special Teams tab content changes based on `specialTeamsUnit`:

**Kickoff Form:**
- Kicker (player dropdown)
- Kickoff Type (deep/squib/onside + direction)
- Kick Result (touchback, returned, onside recovered, etc.)
- Return Yards (if returned)

**Kick Return Form:**
- Returner (player dropdown)
- Return Yards
- Is Touchback (checkbox)
- Is Fair Catch (checkbox)
- Result (TD, fumble, normal return)
- Coverage Tackler (player dropdown - opponent if we have roster)

**Punt Form:**
- Punter (player dropdown)
- Long Snapper (player dropdown)
- Snap Quality (good/low/high/wide)
- Punt Type (standard/directional/pooch/rugby/sky)
- Kick Result (fair catch, returned, touchback, blocked, muffed)
- Return Yards (if returned)
- Gunner Tackle (player dropdown for coverage)

**Punt Return Form:**
- Returner (player dropdown)
- Return Yards
- Is Fair Catch (checkbox)
- Is Muffed (checkbox)
- Result

**Field Goal/PAT Form:**
- Kicker (player dropdown)
- Holder (player dropdown)
- Long Snapper (player dropdown)
- Snap Quality
- Distance (for FG)
- Result (made/missed/blocked)
- If Fake: Show offensive form fields

#### 3.4 Form Field Rendering Logic

```typescript
// Render special teams form based on unit
const renderSpecialTeamsForm = () => {
  switch (specialTeamsUnit) {
    case 'kickoff':
      return <KickoffTaggingForm players={players} />;
    case 'kick_return':
      return <KickReturnTaggingForm players={players} />;
    case 'punt':
      return <PuntTaggingForm players={players} />;
    case 'punt_return':
      return <PuntReturnTaggingForm players={players} />;
    case 'field_goal':
    case 'pat':
      return <FieldGoalTaggingForm players={players} unit={specialTeamsUnit} />;
    default:
      return <p>Select a special teams unit</p>;
  }
};
```

#### 3.5 Update Form Submission

Modify `onSubmitTag()` to handle special teams data:

```typescript
const instanceData = {
  // ... existing fields ...

  // Special Teams fields (only if taggingMode === 'specialTeams')
  special_teams_unit: taggingMode === 'specialTeams' ? specialTeamsUnit : undefined,
  kicker_id: taggingMode === 'specialTeams' ? values.kicker_id : undefined,
  kick_result: taggingMode === 'specialTeams' ? values.kick_result : undefined,
  kick_distance: taggingMode === 'specialTeams' ? values.kick_distance : undefined,
  returner_id: taggingMode === 'specialTeams' ? values.returner_id : undefined,
  return_yards: taggingMode === 'specialTeams' ? values.return_yards : undefined,
  is_fair_catch: taggingMode === 'specialTeams' ? values.is_fair_catch : undefined,
  is_touchback: taggingMode === 'specialTeams' ? values.is_touchback : undefined,
  punter_id: taggingMode === 'specialTeams' ? values.punter_id : undefined,
  punt_type: taggingMode === 'specialTeams' ? values.punt_type : undefined,
  kickoff_type: taggingMode === 'specialTeams' ? values.kickoff_type : undefined,
  long_snapper_id: taggingMode === 'specialTeams' ? values.long_snapper_id : undefined,
  snap_quality: taggingMode === 'specialTeams' ? values.snap_quality : undefined,
  holder_id: taggingMode === 'specialTeams' ? values.holder_id : undefined,
  coverage_tackler_id: taggingMode === 'specialTeams' ? values.coverage_tackler_id : undefined,
  gunner_tackle_id: taggingMode === 'specialTeams' ? values.gunner_tackle_id : undefined,
  penalty_on_play: values.penalty_on_play || undefined,
  penalty_type: values.penalty_type || undefined,
  penalty_yards: values.penalty_yards || undefined,
};
```

---

### Phase 4: New Components (Optional - For Clean Code)

Create new component files for better organization:

```
/src/components/film/
  ├── SpecialTeamsTaggingForm.tsx  (Main wrapper)
  ├── KickoffTaggingForm.tsx
  ├── KickReturnTaggingForm.tsx
  ├── PuntTaggingForm.tsx
  ├── PuntReturnTaggingForm.tsx
  └── FieldGoalTaggingForm.tsx
```

**Note:** This could be done inline in the main page first, then refactored to components if the file gets too large.

---

### Phase 5: Analytics Integration (Future)

Create special teams analytics service:

```typescript
// /src/lib/services/special-teams-analytics.service.ts

export interface SpecialTeamsMetrics {
  // Kicking
  fieldGoalPercentage: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  patPercentage: number;
  avgPuntDistance: number;
  puntsInsideTwenty: number;
  touchbackPercentage: number;

  // Returns
  avgKickReturnYards: number;
  avgPuntReturnYards: number;
  returnTouchdowns: number;
  fairCatches: number;
  muffedPunts: number;

  // Coverage
  avgKickoffCoverageYards: number;  // Yards allowed on returns
  avgPuntCoverageYards: number;
  coverageTackles: { playerId: string; tackles: number }[];
}
```

---

## Implementation Order

### Step 1: Database Migration (30 min)
- Create `039_special_teams_tracking.sql`
- Run migration locally
- Test with sample data

### Step 2: Type Updates (15 min)
- Update `PlayInstance` interface in `football.ts`
- Add constants for kick results and penalties
- Update `PlayTagForm` interface in film page

### Step 3: UI - Three-Way Toggle (45 min)
- Replace `isTaggingOpponent` boolean with `taggingMode` enum
- Update all conditional logic that checks `isTaggingOpponent`
- Add "Special Teams" button to toggle group
- Add unit selection dropdown (appears when Special Teams selected)

### Step 4: UI - Special Teams Form (2-3 hours)
- Add special teams tab to form tabs
- Create form sections for each unit type
- Wire up player dropdowns (filter by position where applicable)
- Add kick result dropdowns
- Add penalty section

### Step 5: Form Submission (1 hour)
- Update `onSubmitTag()` to include special teams fields
- Handle editing existing special teams plays
- Test save/load cycle

### Step 6: Play List Display (30 min)
- Update play list to show special teams plays distinctly
- Add icons or badges for different units
- Show key info (kicker, returner, result) in list item

### Step 7: Testing (1 hour)
- Tag sample kickoff, punt, FG, returns
- Verify data saves correctly
- Verify editing works
- Verify filtering/sorting works

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Tagging:                                                   │
│  [ Offense ] [ Defense ] [ ● Special Teams ]                │
│                                                             │
│  Unit: [ Kickoff ▼ ]                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [ Context ] [ Special Teams ]                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Kicker:        [ #15 John Smith ▼ ]                        │
│                                                             │
│  Kickoff Type:  [ Deep Center ▼ ]                           │
│                                                             │
│  Result:        [ Touchback ▼ ]                             │
│                                                             │
│  Return Yards:  [ 25 ] (if returned)                        │
│                                                             │
│  ☐ Penalty on Play                                          │
│                                                             │
│  Notes: [________________________________]                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model Summary

| Unit | Key Fields |
|------|------------|
| **Kickoff** | kicker_id, kickoff_type, kick_result, return_yards |
| **Kick Return** | returner_id, return_yards, is_touchback, coverage_tackler_id |
| **Punt** | punter_id, long_snapper_id, snap_quality, punt_type, kick_result, return_yards, gunner_tackle_id |
| **Punt Return** | returner_id, return_yards, is_fair_catch, is_muffed |
| **Field Goal** | kicker_id, holder_id, long_snapper_id, snap_quality, kick_distance, kick_result |
| **PAT** | kicker_id, holder_id, long_snapper_id, snap_quality, kick_result |

---

## Questions Resolved

1. **Player Position Filtering**: ✅ YES - Filter dropdowns by position:
   - Punt → Show only Punters (P position)
   - Punt Return → Show Returners (WR/RB/DB positions)
   - Field Goal/PAT → Show only Kickers (K position)
   - Kickoff → Show only Kickers (K position)
   - Long Snapper → Show only LS position
   - Holder → Show QB/P positions (typical holders)

2. **Opponent Tracking**: ✅ NOT NEEDED - No opponent roster support. For YOUR coverage plays (punt/kickoff coverage), we can track which of YOUR players made the tackle (gunner, coverage player). For opponent coverage on YOUR returns, we skip tackler tracking.

3. **Drive Context**: ✅ CLARIFIED
   - **Part of drives:** Punts, Punt Returns, Field Goals, PATs
   - **NOT part of drives:** Kickoffs, Kick Returns (these START new drives)

4. **Yard Line Meaning**: For kickoffs, yard_line = where the ball was returned to (or touchback at 25). For punts, yard_line = where the ball was downed/returned to.

5. **Result Types**: The proposed kick_result options are comprehensive.

---

## Success Criteria

- [ ] Can tag a kickoff with kicker, type, and result
- [ ] Can tag a kick return with returner and return yards
- [ ] Can tag a punt with punter, snap quality, punt type, and result
- [ ] Can tag a punt return with returner and yards
- [ ] Can tag a field goal with distance, kicker, holder, snapper, and result
- [ ] Can tag a PAT with kicker, holder, snapper, and result
- [ ] Can edit existing special teams plays
- [ ] Play list shows special teams plays with appropriate badges
- [ ] Data persists correctly to database

---

*Plan created: 2025-01-28*
*Estimated total effort: 6-8 hours*
