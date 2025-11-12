# Player Position Fix Guide

## The Problem

**Issue**: Players are showing up with incorrect position codes in the analytics page, causing stats to not display.

**Root Cause - Multi-Position Players**: Your players have multiple positions (e.g., a player who plays both QB and Holder). The player system correctly stores all positions in a JSONB column called `position_depths`:

```json
{
  "H": 1,
  "QB": 2
}
```

However, the `primary_position` field (used by analytics) was being set to the **first** position alphabetically. So if you selected QB and H, the primary_position would be 'H' (Holder - special teams) instead of 'QB' (Quarterback - offense), because 'H' comes before 'QB' alphabetically.

## Multi-Position System Explained

The player system is designed to handle multi-position players (common in youth football):

- **position_depths** (JSONB): Stores ALL positions a player can play with their depth chart order
  - Example: `{"QB": 1, "S": 2}` means 1st string QB, 2nd string Safety
- **primary_position** (TEXT): The "main" position for analytics/stats filtering
- **position_group** (TEXT): 'offense', 'defense', or 'special_teams'

The problem was that `primary_position` wasn't being set intelligently for multi-position players.

## Standard Position Codes

### Offense
- **QB** = Quarterback
- **RB** = Running Back
- **FB** = Fullback
- **X** = Split End (outside WR)
- **Z** = Flanker (outside WR)
- **Y** = Slot/TE (inside receiver)
- **TE** = Tight End
- **LT** = Left Tackle
- **LG** = Left Guard
- **C** = Center
- **RG** = Right Guard
- **RT** = Right Tackle

### Defense
- **DE** = Defensive End
- **DT** = Defensive Tackle
- **DT1** = Defensive Tackle 1
- **DT2** = Defensive Tackle 2
- **NT** = Nose Tackle
- **LB** = Linebacker
- **MLB** = Middle Linebacker
- **SAM** = Strong Side LB
- **WILL** = Weak Side LB
- **LCB** = Left Cornerback
- **RCB** = Right Cornerback
- **S** = Safety
- **FS** = Free Safety
- **SS** = Strong Safety

### Special Teams
- **K** = Kicker
- **P** = Punter
- **LS** = Long Snapper
- **H** = Holder
- **KR** = Kick Returner
- **PR** = Punt Returner

## How to Fix

### Solution: Two-Part Fix

The fix involves:
1. **Smart Primary Position Script** - Sets `primary_position` intelligently based on position priority
2. **Updated Analytics Filtering** - Already deployed! Analytics now checks ALL positions, not just primary

### Option 1: Smart Multi-Position Fix (Recommended)

Use this to intelligently set primary_position for multi-position players.

**What it does:**
- Prioritizes offense/defense positions over special teams positions
- Example: A player with `{"H": 1, "QB": 2}` will get `primary_position = "QB"` (not "H")
- Priority order: Skill positions > OL > DBs > LBs > DL > Special Teams

**How to run:**

1. **Run in Supabase SQL Editor**:
   - Go to Supabase Dashboard → SQL Editor
   - Open a new query
   - Copy/paste the contents of `fix-multi-position-primary.sql`
   - Click "Run"
2. **Review the output** showing before/after
3. **Commit if correct**: Type `COMMIT;` and run
4. **Or rollback**: Type `ROLLBACK;` if you need to edit

**This is the recommended fix for multi-position players.**

### Option 2: Quick Test Player Update

Use this if you want to completely replace player positions (not just fix primary_position).

1. **Edit the script** `update-test-players.sql` to match your jersey numbers to desired positions
2. **Run in Supabase SQL Editor** (same steps as Option 1)
3. **Review and commit/rollback**

⚠️ **Warning**: This overwrites ALL positions in position_depths. Use Option 1 if you want to preserve multi-position assignments.

### Option 3: Automatic Name-Based Fix

Use this if your test players are named like "QB Test", "RB Test", etc.

1. **Run** `fix-player-positions.sql` in Supabase SQL Editor
2. The script detects position names in player names and updates them automatically
3. **Review and commit/rollback**

### Option 4: Manual Updates

Use this if you need fine-grained control.

1. **Check current positions**: Run `check-player-positions.sql`
2. **Edit** `manual-position-update-template.sql` with your specific updates
3. **Run and commit**

## Running SQL Scripts in Supabase

### Method 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"New query"**
4. Copy the entire contents of the SQL file
5. Paste into the editor
6. Click **"Run"** or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)
7. Review the output
8. If using transactions (BEGIN/COMMIT), type `COMMIT;` in a new line and run again

### Method 2: Supabase CLI

```bash
# If you have the Supabase CLI installed
supabase db execute --file scripts/update-test-players.sql
```

### Method 3: psql (Advanced)

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the script
\i scripts/update-test-players.sql
```

## After Fixing

Once you've run the fix script:

1. **Refresh the analytics page** in your browser
2. **Check the console** - you should now see:
   ```
   📊 All unique positions found: ["QB", "RB", "X", "TE", "LT", ...]
   📊 All positions from position_depths: ["QB", "RB", "H", "X", "TE", ...]
   🔍 Found 1 QBs
   ```
3. **The position group stats should now display** for all your players

## How Multi-Position Filtering Works Now

The analytics system has been updated to handle multi-position players properly:

**Before (broken):**
```typescript
// Only checked primary_position
const qbStats = allPlayerStats.filter(s => s.position === 'QB');
// Player with {"H": 1, "QB": 2} and primary_position="H" → NOT FOUND
```

**After (fixed):**
```typescript
// Checks ALL positions in position_depths
const qbStats = allPlayerStats.filter(s => playerPlaysPosition(s, 'QB'));
// Player with {"H": 1, "QB": 2} → FOUND! (because QB is in their position_depths)
```

**What this means:**
- ✅ A player can appear in multiple position group stats
- ✅ Example: A player with `{"QB": 1, "S": 2}` will show in BOTH QB stats AND Safety stats
- ✅ This reflects reality - multi-position players contribute to multiple position groups
- ✅ The `primary_position` is still used for sorting/priority, but not for exclusion

## Multi-Position Best Practices

When creating players:

1. **List positions in order of importance** (1st string, 2nd string, etc.)
2. **Primary offensive/defensive position first**, special teams second
3. **Examples:**
   - Quarterback who also holds: `{"QB": 1, "H": 2}`
   - Running back who also returns kicks: `{"RB": 1, "KR": 2}`
   - Safety who also plays linebacker: `{"S": 1, "LB": 2}`

The system will automatically:
- Set `primary_position` to the most important position for analytics
- Show the player in all relevant position group filters
- Display all positions on the roster and depth charts

## Preventing Issues in the Future

The player creation modal in `/teams/[teamId]/players` correctly shows all position codes:
- ✅ **QB** (Quarterback)
- ✅ **H** (Holder)
- ✅ You can select multiple positions with depth order

**Tips:**
- Put main position as 1st string
- Put secondary positions as 2nd, 3rd string
- Special teams positions are usually lower priority (2nd-4th string)

## Files Created

- ✅ `check-player-positions.sql` - View current positions
- ✅ `fix-player-positions.sql` - Auto-fix based on names
- ✅ `manual-position-update-template.sql` - Manual update template
- ✅ `update-test-players.sql` - Quick jersey# → position mapping
- ✅ `README-POSITION-FIX.md` - This guide

## Need Help?

If the scripts don't work for your specific case, you can manually update players in the Supabase table editor:

1. Go to **Table Editor** → **players**
2. Find the player row
3. Edit the columns:
   - `primary_position`: Set to position code (e.g., 'QB')
   - `position_group`: Set to 'offense', 'defense', or 'special_teams'
   - `position_depths`: Set to `{"QB": 1}` format
4. Click **Save**

Remember: The position code must match the standard codes listed above for analytics to work correctly.
