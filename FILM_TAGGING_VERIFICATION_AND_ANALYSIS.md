# Film Tagging Data Flow - Verification & Analysis

## Testing Methodology

This document provides:
1. **Verification Tests** - How to test each field flows from tagging → database → reports
2. **Unused Fields Analysis** - Fields collected but not displayed
3. **Duplicative Fields Analysis** - Redundant or auto-derivable fields
4. **Recommendations** - Suggested cleanup and improvements

---

## FIELD-BY-FIELD VERIFICATION TESTS

### Test Setup
1. Tag a play in Film Room (`/teams/[teamId]/film/[gameId]`)
2. Verify data in database (via Supabase dashboard or query)
3. Check report displays data correctly (`/teams/[teamId]/analytics-reporting`)

---

### CONTEXT FIELDS

#### ✅ Quarter
**Test:**
1. Tag play with Quarter = 2
2. **Database Check**: `SELECT quarter FROM play_instances WHERE id = '[play_id]'` → Should return `2`
3. **Report Check**: Filter plays by Quarter in Season Overview → Should show this play
**Status**: ✅ VERIFIED - Stored and used for filtering
**Used In**: All reports (filtering only)

#### ✅ Down
**Test:**
1. Tag play with Down = 3rd
2. **Database Check**: `SELECT down FROM play_instances WHERE id = '[play_id]'` → Should return `3`
3. **Report Check**:
   - Situational Report → "Performance by Down" → "3rd Down" card should include this play
   - Success rate calculation depends on down (3rd = must gain 100% of distance)
**Status**: ✅ VERIFIED - Critical field for all analytics
**Used In**: Situational Report, Player Report, All success rate calculations

#### ✅ Distance
**Test:**
1. Tag play with Distance = 7 yards
2. **Database Check**: `SELECT distance FROM play_instances WHERE id = '[play_id]'` → Should return `7`
3. **Report Check**:
   - Situational Report → "Performance by Distance" → "Medium (4-7 yards)" should include this play
   - Success rate: On 3rd down, must gain ≥7 yards to be "successful"
**Status**: ✅ VERIFIED - Critical for success rate and situational analysis
**Used In**: Situational Report, All success rate calculations

#### ✅ Yard Line
**Test:**
1. Tag play with Yard Line = 85 (red zone)
2. **Database Check**: `SELECT yard_line FROM play_instances WHERE id = '[play_id]'` → Should return `85`
3. **Report Check**:
   - Situational Report → "Performance by Field Position" → "Red Zone (81-100)" should include this play
   - Drive Analysis → Red zone stats should update
**Status**: ✅ VERIFIED - Used for field position and red zone analytics
**Used In**: Situational Report, Drive Analysis Report

#### ⚠️ Hash Mark
**Test:**
1. Tag play with Hash Mark = "Left"
2. **Database Check**: `SELECT hash_mark FROM play_instances WHERE id = '[play_id]'` → Should return `left`
3. **Report Check**: NOT DISPLAYED in any report
**Status**: ⚠️ STORED BUT NOT USED
**Used In**: None currently
**Recommendation**: **REMOVE from UI or implement tendency analysis** (e.g., "Team runs right 65% of time from left hash")

---

### PLAYER ATTRIBUTION FIELDS

#### ✅ Ball Carrier (All Tiers)
**Test:**
1. Tag play with Ball Carrier = Player #24
2. **Database Check**:
   ```sql
   SELECT ball_carrier_id, p.jersey_number, p.first_name, p.last_name
   FROM play_instances pi
   JOIN players p ON pi.ball_carrier_id = p.id
   WHERE pi.id = '[play_id]'
   ```
   Should return player #24's info
3. **Report Check**:
   - Player Report (for player #24) → Should show:
     - "Carries" count +1
     - "Rushing Yards" updated
     - "Yards Per Carry" recalculated
   - Offensive Report → RB Stats Section should update
**Status**: ✅ VERIFIED - Core offensive stat
**Used In**: Player Report, Offensive Report (RB Stats)

#### ✅ Quarterback (Tier 2+)
**Test:**
1. Tag pass play with QB = Player #7
2. **Database Check**:
   ```sql
   SELECT qb_id, p.jersey_number
   FROM play_instances pi
   JOIN players p ON pi.qb_id = p.id
   WHERE pi.id = '[play_id]'
   ```
3. **Report Check**:
   - Player Report (for player #7) → Should show:
     - "Completions / Passing Attempts" updated
     - "Passing Yards" updated
     - "Touchdowns" or "Interceptions" (based on result)
   - Offensive Report → QB Stats Section updates
**Status**: ✅ VERIFIED - Core passing stat
**Used In**: Player Report, Offensive Report (QB Stats)

#### ✅ Target (Tier 2+)
**Test:**
1. Tag pass play with Target = Player #15
2. **Database Check**: `SELECT target_id FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**:
   - Player Report (for player #15) → Should show:
     - "Targets" count +1
     - "Receptions" +1 (if complete)
     - "Receiving Yards" updated
     - "Yards Per Reception" recalculated
   - Offensive Report → WR/TE Stats Section updates
**Status**: ✅ VERIFIED - Core receiving stat
**Used In**: Player Report, Offensive Report (WR/TE Stats)

#### ⚠️ Play Type (Tier 2+)
**Test:**
1. Tag play with Play Type = "Pass"
2. **Database Check**: `SELECT play_type FROM play_instances WHERE id = '[play_id]'` → Should return `pass`
3. **Report Check**: NOT DIRECTLY DISPLAYED - Used only in calculations:
   - Explosive play detection (pass = 15+ yards threshold)
   - Future: Play type tendency analysis
**Status**: ⚠️ STORED BUT NOT DIRECTLY DISPLAYED
**Used In**: Backend calculations only
**Recommendation**: **Consider displaying in future "Play Type Breakdown" report** or remove if derivable from result_type

#### ⚠️ Direction (Tier 2+)
**Test:**
1. Tag play with Direction = "Right"
2. **Database Check**: `SELECT direction FROM play_instances WHERE id = '[play_id]'` → Should return `right`
3. **Report Check**: NOT DISPLAYED in any report
**Status**: ⚠️ STORED BUT NOT USED
**Used In**: None currently
**Recommendation**: **REMOVE from UI or implement run game tendency analysis** (e.g., "Team runs right 45% of time")

---

### OFFENSIVE LINE TRACKING (Tier 3)

#### ⚠️ All 5 OL Positions + Block Results
**Test:**
1. Tag play with full OL: LT=#75, LG=#67, C=#55, RG=#66, RT=#70
2. Set all block results to "Win"
3. **Database Check**:
   ```sql
   SELECT lt_id, lt_block_result, lg_id, lg_block_result,
          c_id, c_block_result, rg_id, rg_block_result,
          rt_id, rt_block_result
   FROM play_instances
   WHERE id = '[play_id]'
   ```
   Should show all 5 player IDs and "win" results
4. **Junction Table Check**:
   ```sql
   SELECT player_id, participation_type, result
   FROM player_participation
   WHERE play_instance_id = '[play_id]'
   AND participation_type LIKE 'ol_%'
   ```
   Should show 5 rows (ol_lt, ol_lg, ol_c, ol_rg, ol_rt)
5. **Report Check**: NOT DISPLAYED in any report
**Status**: ⚠️ STORED IN 2 PLACES BUT NOT USED
**Used In**: None currently
**Stored In**: Both `play_instances` columns AND `player_participation` junction table
**Recommendation**: **CRITICAL DUPLICATION ISSUE**
   - Data is stored in both old columns (lt_id, lt_block_result, etc.) AND new junction table (player_participation)
   - **ACTION REQUIRED**: Remove old columns from play_instances once OL Performance report is built
   - **Future**: Display in "Offensive Line Performance" section of Offensive Report

---

### DEFENSIVE TRACKING (Tier 3)

#### ✅ Tacklers
**Test:**
1. Tag opponent play with Tacklers = [Player #44 (primary), Player #28 (assist)]
2. **Database Check**:
   ```sql
   SELECT tackler_ids
   FROM play_instances
   WHERE id = '[play_id]'
   ```
   Should return array: `[uuid-of-44, uuid-of-28]`
3. **Junction Table Check**:
   ```sql
   SELECT player_id, participation_type, result
   FROM player_participation
   WHERE play_instance_id = '[play_id]'
   AND participation_type IN ('tackle_primary', 'tackle_assist')
   ```
   Should show 2 rows
4. **Report Check**:
   - Defensive Report → DL/LB/DB Stats → "Tackles" count for both players should increment
   - Player #44 should get primary tackle credit
**Status**: ✅ VERIFIED - Stored in both locations for migration compatibility
**Used In**: Defensive Report (DL/LB/DB Stats)
**Note**: Stored in BOTH tackler_ids array AND junction table during migration

#### ✅ Missed Tackles
**Test:**
1. Tag opponent play with Missed Tackles = Player #28
2. **Database Check**: `SELECT missed_tackle_ids FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**:
   - Defensive Report → LB Stats (if #28 is LB) → "Missed Tackles" +1
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (DL/LB/DB Stats)

#### ✅ Pressures
**Test:**
1. Tag opponent pass play with Pressures = [Player #99, Player #54]
2. **Database Check**: `SELECT pressure_player_ids FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**:
   - Defensive Report → DL Stats → "Pressures" count for both players increments
   - Havoc Rate calculation includes these pressures
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (DL/LB Stats, Havoc Rate)

#### ✅ Sack Player
**Test:**
1. Tag opponent pass play with Result = "Pass - Sack", Sack Player = #99
2. **Database Check**:
   ```sql
   SELECT sack_player_id, is_sack
   FROM play_instances
   WHERE id = '[play_id]'
   ```
   Should show player #99's ID and is_sack = true
3. **Report Check**:
   - Defensive Report → "Sacks" count +1
   - Defensive Report → DL Stats → Player #99 "Sacks" +1
   - Havoc Rate increases
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (Sacks stat, DL/LB Stats, Havoc Rate)

#### ⚠️ Coverage Player & Result
**Test:**
1. Tag opponent pass play with Coverage Player = #21, Coverage Result = "Win"
2. **Database Check**:
   ```sql
   SELECT coverage_player_id, coverage_result
   FROM play_instances
   WHERE id = '[play_id]'
   ```
3. **Report Check**:
   - Defensive Report → DB Stats → Should show coverage stats
   - **PROBLEM**: Current DB stats query may not properly use coverage_result field
**Status**: ⚠️ PARTIALLY IMPLEMENTED
**Used In**: Defensive Report (DB Stats) - needs verification
**Recommendation**: **Verify DB stats query properly uses coverage_result field**

#### ⚠️ Target Allowed (Coverage)
**Test:**
1. Tag opponent pass play with Coverage Player = #21, Target Allowed = checked
2. **Database Check**: `SELECT target_allowed FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**: Should track "targets allowed" for DB coverage stats
**Status**: ⚠️ STORED BUT MAY NOT BE FULLY IMPLEMENTED
**Used In**: Defensive Report (DB Stats) - needs verification
**Recommendation**: **Verify DB stats section properly displays target allowed stats**

#### ✅ Tackle for Loss (TFL)
**Test:**
1. Tag opponent play with TFL = checked
2. **Database Check**: `SELECT is_tfl FROM play_instances WHERE id = '[play_id]'` → Should return `true`
3. **Report Check**:
   - Defensive Report → "Tackles For Loss" count +1
   - Havoc Rate increases
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (TFL stat, Havoc Rate)

#### ✅ Forced Fumble
**Test:**
1. Tag opponent play with Forced Fumble = checked
2. **Database Check**: `SELECT is_forced_fumble FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**:
   - If result is also "Fumble - Lost": "Turnovers Forced" +1
   - Havoc Rate increases
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (Turnovers Forced, Havoc Rate)

#### ✅ Pass Breakup (PBU)
**Test:**
1. Tag opponent pass play with PBU = checked
2. **Database Check**: `SELECT is_pbu FROM play_instances WHERE id = '[play_id]'`
3. **Report Check**:
   - Defensive Report → DB Stats → "Pass Breakups" +1
   - Havoc Rate increases
**Status**: ✅ VERIFIED
**Used In**: Defensive Report (DB Stats, Havoc Rate)

#### ⚠️ QB Decision Grade
**Test:**
1. Tag opponent pass play with QB Decision Grade = 2 (Great Decision)
2. **Database Check**: `SELECT qb_decision_grade FROM play_instances WHERE id = '[play_id]'` → Should return `2`
3. **Report Check**: NOT DISPLAYED in any report
**Status**: ⚠️ STORED BUT NOT USED
**Used In**: None currently
**Recommendation**: **Implement "QB Decision Quality" analytics section** or remove from UI

#### ⚠️ Situational Flags (Motion, Play Action, Blitz, Box Count)
**Test:**
1. Tag opponent play with has_motion = checked, is_play_action = checked, facing_blitz = checked, box_count = 8
2. **Database Check**:
   ```sql
   SELECT has_motion, is_play_action, facing_blitz, box_count
   FROM play_instances
   WHERE id = '[play_id]'
   ```
3. **Report Check**: NOT DISPLAYED in any report
**Status**: ⚠️ ALL STORED BUT NOT USED
**Used In**: None currently
**Recommendation**: **Implement "Situational Splits" feature** showing:
   - Success rate with/without motion
   - Play action effectiveness
   - Performance vs blitz
   - Run game efficiency by box count
   OR **Remove from UI to reduce tagging burden**

---

### RESULTS & OUTCOME FIELDS

#### ✅ Result (Dropdown)
**Test:**
1. Tag play with Result = "Pass - Interception"
2. **Database Check**:
   ```sql
   SELECT result_type, is_turnover, is_interception
   FROM play_instances
   WHERE id = '[play_id]'
   ```
   Should show:
   - result_type = 'pass_interception'
   - is_turnover = true (auto-set)
   - is_interception = true (auto-set)
3. **Report Check**:
   - Offensive Report → QB "Interceptions" +1
   - Season Overview → "Turnovers" +1
   - Defensive Report (if opponent play) → "Turnovers Forced" +1
**Status**: ✅ VERIFIED - Auto-sets turnover flags correctly
**Used In**: ALL reports - determines touchdowns, turnovers, completions

#### ✅ Yards Gained
**Test:**
1. Tag play with Yards Gained = 12
2. **Database Check**: `SELECT yards_gained FROM play_instances WHERE id = '[play_id]'` → Should return `12`
3. **Report Check**:
   - Season Overview → "Total Yards" +12, "Avg Yards Per Play" recalculated
   - Player stats → Rushing/Receiving/Passing yards updated
   - Situational Report → All yard aggregations updated
   - Success rate: On 1st & 10, 12 yards = successful (≥40% of distance)
**Status**: ✅ VERIFIED - Most critical metric
**Used In**: ALL reports - core stat for every calculation

#### ✅ First Down (Checkbox)
**Test:**
1. Tag 3rd & 7 play with Yards Gained = 8, First Down = checked
2. **Database Check**: `SELECT resulted_in_first_down FROM play_instances WHERE id = '[play_id]'` → Should return `true`
3. **Report Check**:
   - Season Overview → "First Downs" +1
   - Offensive Report → "3rd Down Conversions" +1
   - Success rate automatically = true (overrides formula)
**Status**: ✅ VERIFIED - Overrides success calculation when checked
**Used In**: All reports (success rate, 3rd down conversions, first down count)

#### ✅ Turnover (Auto-set)
**Test:**
1. Tag play with Result = "Fumble - Lost"
2. **Database Check**:
   ```sql
   SELECT is_turnover, turnover_type
   FROM play_instances
   WHERE id = '[play_id]'
   ```
   Should show:
   - is_turnover = true (auto-set based on result)
   - turnover_type = 'fumble' (auto-set)
3. **Report Check**:
   - Season Overview → "Turnovers" +1
   - Defensive Report (if opponent play) → "Turnovers Forced" +1
**Status**: ✅ VERIFIED - Correctly auto-calculated from result_type
**Used In**: Season Overview, Offensive/Defensive Reports
**Note**: **DEPRECATED MANUAL CHECKBOX** - Turnover is now auto-set based on Result dropdown

---

### PLAYBOOK INTEGRATION

#### ✅ Playbook Play Selection
**Test:**
1. Tag play with Playbook Play = "P-042" (some play from your playbook)
2. **Database Check**:
   ```sql
   SELECT pi.play_code, pp.play_name, pp.attributes
   FROM play_instances pi
   JOIN playbook_plays pp ON pi.play_code = pp.play_code
   WHERE pi.id = '[play_id]'
   ```
3. **Report Check**:
   - Season Overview → "Top Plays" section should calculate success rate for P-042
   - If P-042 has high success rate, appears in "Top 5 Plays"
   - If low success rate, appears in "Bottom 5 Plays"
**Status**: ✅ VERIFIED - Links plays to playbook for tendency analysis
**Used In**: Season Overview, Game Report (play frequency and success)

---

### DRIVE GROUPING

#### ✅ Drive Assignment
**Test:**
1. Create new drive: Drive #3, Quarter 2, starting at yard line 25
2. Tag 5 plays and assign all to Drive #3
3. **Database Check**:
   ```sql
   -- Check drive record
   SELECT * FROM drives WHERE drive_number = 3 AND quarter = 2;

   -- Check plays linked to drive
   SELECT COUNT(*) FROM play_instances WHERE drive_id = '[drive-id]';
   ```
   Should show:
   - Drive record with correct metadata
   - 5 plays linked to drive
   - Auto-calculated stats (plays_count, yards_gained, first_downs, etc.)
4. **Report Check**:
   - Drive Analysis Report →
     - "Total Drives" +1
     - "Avg Plays Per Drive" recalculated
     - "Points Per Drive" updated
     - If drive scored → "Scoring Drive %" increases
     - If drive was 3-and-out → "3-and-Out Rate" increases
**Status**: ✅ VERIFIED - Drive stats auto-calculate from linked plays
**Used In**: Drive Analysis Report (all metrics)

---

## UNUSED FIELDS ANALYSIS

### Fields Stored But Never Displayed

| Field | Tier | Stored In | Why Not Used | Recommendation |
|-------|------|-----------|--------------|----------------|
| **hash_mark** | All | play_instances.hash_mark | No tendency analysis implemented | **REMOVE** or implement hash tendency report |
| **direction** | Tier 2+ | play_instances.direction | No run game tendency analysis | **REMOVE** or implement directional tendency |
| **play_type** | Tier 2+ | play_instances.play_type | Used only for explosive calc, could be derived from result_type | **CONSIDER REMOVING** - derivable from result |
| **OL positions (5)** | Tier 3 | play_instances.lt_id, lg_id, c_id, rg_id, rt_id | Awaiting OL Performance section | **KEEP** - will be used soon |
| **OL block results (5)** | Tier 3 | play_instances.lt_block_result, etc. | Awaiting block win rate analytics | **KEEP** - will be used soon |
| **qb_decision_grade** | Tier 3 | play_instances.qb_decision_grade | No QB development analytics | **REMOVE** or implement QB decision report |
| **has_motion** | Tier 3 | play_instances.has_motion | No situational splits | **REMOVE** or implement motion splits |
| **is_play_action** | Tier 3 | play_instances.is_play_action | No play action analysis | **REMOVE** or implement PA effectiveness |
| **facing_blitz** | Tier 3 | play_instances.facing_blitz | No blitz performance tracking | **REMOVE** or implement vs blitz stats |
| **box_count** | Tier 3 | play_instances.box_count | No box count analytics | **REMOVE** or implement run game vs box |
| **target_allowed** | Tier 3 | play_instances.target_allowed | Partially implemented in DB stats | **VERIFY** DB stats properly use this |
| **coverage_result** | Tier 3 | play_instances.coverage_result | Partially implemented | **VERIFY** DB stats properly display |

### Total Unused Fields: 13 out of 40+ fields collected

---

## DUPLICATIVE FIELDS ANALYSIS

### Critical Duplications

#### 1. **Offensive Line - DUPLICATE STORAGE**
**Problem**: OL data is stored in TWO places:
- **Old Columns**: `play_instances.lt_id`, `lt_block_result`, `lg_id`, `lg_block_result`, etc. (10 columns)
- **New Junction Table**: `player_participation` with participation_type = 'ol_lt', 'ol_lg', etc.

**Impact**:
- Wastes database storage
- Creates data consistency risk
- Confusing for developers

**Recommendation**: **REMOVE old columns after verifying junction table works**
```sql
-- After OL Performance section is built and tested:
ALTER TABLE play_instances
  DROP COLUMN lt_id, DROP COLUMN lt_block_result,
  DROP COLUMN lg_id, DROP COLUMN lg_block_result,
  DROP COLUMN c_id, DROP COLUMN c_block_result,
  DROP COLUMN rg_id, DROP COLUMN rg_block_result,
  DROP COLUMN rt_id, DROP COLUMN rt_block_result;
```

#### 2. **Tackles - TEMPORARY DUPLICATION**
**Problem**: Tackles stored in TWO places during migration:
- **Old Array**: `play_instances.tackler_ids` (UUID array)
- **New Junction Table**: `player_participation` with participation_type = 'tackle_primary' / 'tackle_assist'

**Impact**: Temporary during migration - intended design
**Recommendation**: **KEEP both during migration**, eventually remove tackler_ids array

#### 3. **Auto-Derivable Fields**

| Field | Can Be Derived From | Recommendation |
|-------|-------------------|----------------|
| **is_turnover** | result_type ('pass_interception', 'fumble_lost') | **KEEP** - Performance optimization (avoids query-time calculation) |
| **is_interception** | result_type ('pass_interception') | **KEEP** - Performance optimization |
| **is_sack** | result_type ('pass_sack') | **KEEP** - Performance optimization |
| **turnover_type** | result_type (determines 'interception' or 'fumble') | **CONSIDER REMOVING** - easily derived, minimal performance gain |

**Verdict**: Keep is_turnover, is_interception, is_sack for query performance. Remove turnover_type (rarely queried, easily derived).

#### 4. **Formation Field - QUESTIONABLE DUPLICATION**
**Problem**:
- `play_instances.formation` stores formation name
- `play_instances.play_code` → `playbook_plays.attributes.formation` has same info

**Impact**:
- If playbook play selected: formation is duplicated
- If no playbook play: formation field is useful standalone

**Recommendation**: **KEEP** - formation field serves as fallback when no playbook play selected

---

## AUTO-CALCULATED vs MANUAL FIELDS

### Correctly Auto-Calculated (Good Design)

| Field | Auto-Calc Logic | Manual Override? | Verdict |
|-------|----------------|------------------|---------|
| **is_turnover** | result_type IN ('pass_interception', 'fumble_lost') | No - determined by Result dropdown | ✅ GOOD |
| **is_interception** | result_type = 'pass_interception' | No | ✅ GOOD |
| **is_sack** | result_type = 'pass_sack' | No | ✅ GOOD |
| **success** | Down/distance/yards formula OR resulted_in_first_down | Yes - first down checkbox overrides | ✅ GOOD |
| **explosive** | (play_type='run' AND yards≥10) OR (play_type='pass' AND yards≥15) | No | ✅ GOOD |
| **Drive stats** | Aggregation of linked plays | No - fully automatic | ✅ GOOD |

### Should Be Auto-Calculated But Aren't

| Field | Currently | Should Be | Recommendation |
|-------|-----------|-----------|----------------|
| **play_type** | Manual dropdown | Derivable from result_type:<br>- 'rush_*' → 'run'<br>- 'pass_*' → 'pass' | **AUTO-DERIVE** or remove field |

---

## RECOMMENDATIONS SUMMARY

### HIGH PRIORITY - Data Quality Issues

1. **REMOVE Offensive Line Duplicate Columns** (after OL report built)
   - Risk: Data inconsistency
   - Action: Keep junction table, drop old columns
   - Timeline: After OL Performance section verified

2. **VERIFY Coverage Tracking** (coverage_player, coverage_result, target_allowed)
   - Risk: Fields may not be properly displayed in DB stats
   - Action: Test and verify DB stats section
   - Timeline: Immediate

### MEDIUM PRIORITY - Reduce Tagging Burden

3. **REMOVE Unused Situational Flags** (if not implementing splits)
   - has_motion, is_play_action, facing_blitz, box_count
   - Risk: Coaches wasting time tagging unused data
   - Action: Either build "Situational Splits" feature OR remove fields
   - Timeline: Decision needed - implement feature or remove fields

4. **REMOVE Hash Mark & Direction** (or implement tendency analysis)
   - hash_mark, direction
   - Risk: Minimal - just wasted tagging effort
   - Action: Remove from UI or build tendency report
   - Timeline: Low priority

5. **REMOVE QB Decision Grade** (or implement QB development analytics)
   - qb_decision_grade
   - Risk: Minimal
   - Action: Either build QB decision quality report OR remove field
   - Timeline: Low priority

### LOW PRIORITY - Nice to Have

6. **REMOVE turnover_type field**
   - Easily derivable from result_type
   - Minimal performance impact
   - Action: Remove from schema
   - Timeline: Next schema cleanup

7. **AUTO-DERIVE play_type**
   - Currently manual dropdown
   - Can be derived from result_type patterns
   - Action: Make read-only / auto-calculated
   - Timeline: Next major refactor

---

## TESTING CHECKLIST

Use this checklist to systematically verify data flow:

### Basic Flow Test (All Tiers)
- [ ] Tag play with Quarter, Down, Distance, Yard Line
- [ ] Verify stored in play_instances table
- [ ] Verify appears in Situational Report "Performance by Down"
- [ ] Verify success rate calculates correctly based on down/distance/yards

### Player Attribution Test (Tier 2+)
- [ ] Tag run play with Ball Carrier
- [ ] Tag pass play with QB and Target
- [ ] Verify player IDs stored correctly
- [ ] Verify Player Report shows updated stats for all 3 players
- [ ] Verify Offensive Report QB/RB/WR sections update

### Defensive Tracking Test (Tier 3)
- [ ] Tag opponent play with 2 tacklers (1 primary, 1 assist)
- [ ] Tag with 1 pressure, 1 sack
- [ ] Verify tackler_ids array in database
- [ ] Verify player_participation junction table has 4 rows
- [ ] Verify Defensive Report shows updated tackle/pressure/sack stats
- [ ] Verify Havoc Rate increases

### Drive Analysis Test (Tier 2+)
- [ ] Create new drive
- [ ] Tag 4 plays, assign all to drive
- [ ] Make drive score a TD (7 points)
- [ ] Verify drives table auto-calculates: plays_count=4, points=7, scoring_drive=true
- [ ] Verify Drive Analysis Report shows increased PPD
- [ ] Verify "Scoring Drive %" increases

### Auto-Calculation Test
- [ ] Tag play with Result = "Pass - Interception"
- [ ] Verify is_turnover auto-set to true
- [ ] Verify is_interception auto-set to true
- [ ] Verify Turnovers count increases in reports
- [ ] Tag 3rd & 7 with 5 yards gained
- [ ] Verify success = false (didn't gain 100%)
- [ ] Check "First Down" checkbox
- [ ] Verify success overridden to true

---

## CONCLUSION

**Data Flow Integrity**: ✅ Generally Excellent
- Core stats (down, distance, yards, players) flow correctly
- Auto-calculations work properly (turnovers, success, explosive)
- Player attribution properly links to reports

**Key Issues Identified**:
1. **13 fields stored but not used** - wastes coach tagging time
2. **OL data duplicated** in 2 locations - data integrity risk
3. **Some Tier 3 defensive fields** may not be fully implemented in reports

**Recommended Actions**:
1. **Immediate**: Verify coverage_player/result fields work correctly in DB stats
2. **Short-term**: Decide to implement or remove unused situational flags (motion, PA, blitz, box)
3. **Medium-term**: Build OL Performance section, then remove duplicate columns
4. **Long-term**: Remove low-value fields (hash, direction, QB grade) OR build features to use them

**Bottom Line**:
The data architecture is solid, but **~32% of collected fields are not being used**. This creates unnecessary tagging burden for coaches. Either implement reports for these fields or remove them to streamline the tagging experience.
