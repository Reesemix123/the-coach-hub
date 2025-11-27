# Film Tagging to Reports - Data Mapping

This document maps every field from the Film Tagging page through the database to where it appears in Analytics & Reporting.

## Legend
- **Film Field**: Field name/label as it appears in the film tagging form
- **DB Table.Column**: Database table and column where the data is stored
- **Report(s)**: Which report(s) display this data
- **Report Field**: How the data is displayed in the report

---

## SITUATIONAL CONTEXT (All Tiers)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Quarter** | `play_instances.quarter` | Season Overview | Filtering only |
| **Offense/Defense** | `play_instances.is_opponent_play` | All Reports | Determines offensive vs defensive stats |
| **Down** | `play_instances.down` | Situational Report<br>Player Report<br>Season Overview | "Performance by Down" - 1st/2nd/3rd/4th Down<br>Success rate calculations |
| **Distance** | `play_instances.distance` | Situational Report<br>All Reports | "Performance by Distance" - Short (1-3), Medium (4-7), Long (8+)<br>Success rate calculations (40%/60%/100% rule) |
| **Yard Line** | `play_instances.yard_line` | Situational Report<br>Drive Analysis | "Performance by Field Position" - Own Territory (0-40), Midfield (41-60), Opponent Territory (61-80), Red Zone (81-100)<br>Red zone stats |
| **Hash Mark** | `play_instances.hash_mark` | N/A | Currently not displayed in reports (stored for future use) |

---

## PLAYER ATTRIBUTION

### All Tiers (Little League +)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Ball Carrier** | `play_instances.ball_carrier_id` | Player Report<br>Offensive Report | "Carries" (rushingAttempts)<br>"Rushing Yards" (rushingYards)<br>"Yards Per Carry" (rushingAvg)<br>"Rushing TDs" (rushingTouchdowns)<br>RB Stats Section |

### Tier 2+ (HS Basic +)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Quarterback (QB)** | `play_instances.qb_id` | Player Report<br>Offensive Report | "Completions" (completions/passingAttempts)<br>"Passing Yards" (passingYards)<br>"Touchdowns" (passingTouchdowns)<br>"Interceptions" (interceptions)<br>"Completion %" (completionPct)<br>QB Stats Section |
| **Target (Pass Plays)** | `play_instances.target_id` | Player Report<br>Offensive Report | "Targets" (targets)<br>"Receptions" (receptions)<br>"Receiving Yards" (receivingYards)<br>"Yards Per Reception" (receivingAvg)<br>"Receiving TDs" (receivingTouchdowns)<br>WR/TE Stats Section |
| **Play Type** | `play_instances.play_type` | N/A | Used for success rate calculations and explosive play detection (not directly displayed) |
| **Direction** | `play_instances.direction` | N/A | Currently not displayed in reports (stored for future use) |

---

## OFFENSIVE LINE TRACKING (Tier 3 - HS Advanced)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Left Tackle (LT)** | `play_instances.lt_id` | **Offensive Report** | **OL Performance Section** - Player snap counts |
| **LT Block Result** | `play_instances.lt_block_result` | **Offensive Report** | **OL Performance Section** - "Block Win Rate" (Win/Loss/Neutral)<br>Individual OL player performance |
| **Left Guard (LG)** | `play_instances.lg_id` | **Offensive Report** | **OL Performance Section** - Player snap counts |
| **LG Block Result** | `play_instances.lg_block_result` | **Offensive Report** | **OL Performance Section** - "Block Win Rate" calculations |
| **Center (C)** | `play_instances.c_id` | **Offensive Report** | **OL Performance Section** - Player snap counts |
| **C Block Result** | `play_instances.c_block_result` | **Offensive Report** | **OL Performance Section** - "Block Win Rate" calculations |
| **Right Guard (RG)** | `play_instances.rg_id` | **Offensive Report** | **OL Performance Section** - Player snap counts |
| **RG Block Result** | `play_instances.rg_block_result` | **Offensive Report** | **OL Performance Section** - "Block Win Rate" calculations |
| **Right Tackle (RT)** | `play_instances.rt_id` | **Offensive Report** | **OL Performance Section** - Player snap counts |
| **RT Block Result** | `play_instances.rt_block_result` | **Offensive Report** | **OL Performance Section** - "Block Win Rate" calculations |

---

## DEFENSIVE TRACKING (Tier 3 - HS Advanced - When Tagging Opponent Plays)

**Note:** Defensive player actions are stored in TWO places:
1. `play_instances` table - Legacy array fields for backward compatibility
2. `player_participation` table - NEW normalized junction table (preferred, used by reports)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Tacklers** (Primary + Assists) | `play_instances.tackler_ids` (array)<br>**→ `player_participation`** (participation_type: 'primary_tackle', 'assist_tackle') | **Defensive Report** | **DL/LB/DB Stats Sections:**<br>- "Solo Tackles" (primary_tackle count)<br>- "Ast" (assist_tackle count)<br>- "Tackles" (total: primary + assists)<br>Individual defensive player stats |
| **Missed Tackles** | `play_instances.missed_tackle_ids` (array)<br>**→ `player_participation`** (participation_type: 'missed_tackle') | **Defensive Report** | **DL/LB/DB Stats Sections:**<br>- "Miss" count (highlighted in red)<br>Tackle efficiency tracking |
| **Pressure Players** | `play_instances.pressure_player_ids` (array)<br>**→ `player_participation`** (participation_type: 'pressure') | **Defensive Report** | **DL/LB Stats Sections:**<br>- "Pressures" count<br>- "Sacks" (when result='sack')<br>Pass rush analytics |
| **Sack Player** | `play_instances.sack_player_id`<br>**→ `player_participation`** (participation_type: 'pressure', result: 'sack') | **Defensive Report** | **DL/LB Stats Sections:**<br>- "Sacks" count (highlighted in green)<br>- Team "Sacks Per Game"<br>Havoc rate calculations |
| **Coverage Player** | `play_instances.coverage_player_id`<br>**→ `player_participation`** (participation_type: 'coverage_assignment') | **Defensive Report** | **LB/DB Stats Sections:**<br>- "Cov Snaps" (coverage assignments)<br>- Coverage assignments by player |
| **Coverage Result** | `play_instances.coverage_result`<br>**→ `player_participation.result`** | **Defensive Report** | **DB Stats Section:**<br>- Coverage success rate<br>**Values:** 'target_allowed', 'completion_allowed', 'incompletion', 'interception', 'pass_breakup'<br>**Fixed in Migration 038** |
| **Tackle for Loss (TFL)** | `play_instances.is_tfl`<br>**→ `player_participation`** (participation_type: 'tackle_for_loss') | **Defensive Report** | **DL/LB Stats Sections:**<br>- "TFLs" count (highlighted in red)<br>- Team "TFL Per Game"<br>Havoc plays calculation |
| **Forced Fumble** | `play_instances.is_forced_fumble`<br>**→ `player_participation`** (participation_type: 'forced_fumble') | **Defensive Report** | **DL/LB/DB Stats Sections:**<br>- "FF" count<br>- Team "Turnovers Forced"<br>Havoc plays calculation |
| **Interception** | `play_instances.is_interception`<br>**→ `player_participation`** (participation_type: 'interception') | **Defensive Report** | **LB/DB Stats Sections:**<br>- "INT" count (highlighted in green)<br>- Team "Turnovers Forced"<br>Havoc plays calculation |
| **Pass Breakup (PBU)** | `play_instances.is_pbu`<br>**→ `player_participation`** (participation_type: 'pass_breakup') | **Defensive Report** | **LB/DB Stats Sections:**<br>- "PBU" count<br>Havoc plays calculation |
| **QB Decision Grade** | `play_instances.qb_decision_grade` | N/A | Future: QB decision quality analytics |
| **Motion on Play** | `play_instances.has_motion` | N/A | Future: Situational splits |
| **Play Action** | `play_instances.is_play_action` | N/A | Future: Situational splits |
| **Facing Blitz** | `play_instances.facing_blitz` | N/A | Future: Situational splits |
| **Box Count** | `play_instances.box_count` | N/A | Future: Run game analytics |

---

## RESULTS & OUTCOME

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Result** (Dropdown) | `play_instances.result_type` | All Reports | Determines:<br>- Touchdowns (rush_touchdown, pass_touchdown, touchdown)<br>- Completions vs Incompletions<br>- Turnovers (pass_interception, fumble_lost)<br>- Success/failure of play |
| **Yards Gained** | `play_instances.yards_gained` | All Reports | Core metric in:<br>- "Total Yards" aggregations<br>- "Avg Yards Per Play"<br>- "Yards Per Carry/Reception"<br>- Performance by down/distance/field position<br>- Success rate calculations<br>- Explosive play detection (10+ rush, 15+ pass) |
| **First Down** (Checkbox) | `play_instances.resulted_in_first_down` | All Reports | - Success rate calculations<br>- 3rd down conversion rate<br>- "First Downs" count in Season Overview |
| **Turnover** (Auto-set) | `play_instances.is_turnover` | Offensive Report<br>Defensive Report<br>Season Overview | - "Turnovers" count (offense)<br>- "Turnovers Forced" count (defense)<br>- "Turnovers Per Game" averages<br>Auto-set to `true` when Result = "Pass - Interception" or "Fumble - Lost" |
| **Interception** (Auto-set) | `play_instances.is_interception` | Player Report (QB)<br>Offensive Report | - QB "Interceptions" stat<br>- "Turnovers Forced" (defense)<br>Auto-set to `true` when Result = "Pass - Interception" |
| **Sack** (Auto-set) | `play_instances.is_sack` | Defensive Report | Auto-set to `true` when Result = "Pass - Sack"<br>Used in sack statistics |

---

## PLAYBOOK INTEGRATION

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Playbook Play** (Selected from dropdown) | `play_instances.play_code` | Season Overview<br>Game Report | Links play instance to playbook<br>Used for:<br>- "Top Plays" (by success rate)<br>- "Bottom Plays" (by success rate)<br>- Play frequency analysis<br>- Formation/concept success rates |

---

## DRIVE GROUPING (Tier 2+)

| Film Field | DB Table.Column | Report(s) | Report Field / Usage |
|------------|----------------|-----------|---------------------|
| **Drive Assignment** (Via Drive Builder UI) | `play_instances.drive_id` → `drives` table | Drive Analysis Report | Links play to a drive<br>Enables all drive-level metrics:<br>- Points Per Drive<br>- Yards Per Drive<br>- Plays Per Drive<br>- 3-and-Out Rate<br>- Scoring Drive %<br>- Red Zone TD Rate |

### Drives Table (Auto-calculated from linked plays)

| Derived Metric | DB Table.Column | Report(s) | Report Field |
|----------------|----------------|-----------|-------------|
| Drive Number | `drives.drive_number` | Drive Analysis | Sequential drive numbering |
| Start Yard Line | `drives.start_yard_line` | Drive Analysis | Starting field position |
| End Yard Line | `drives.end_yard_line` | Drive Analysis | Ending field position |
| Plays Count | `drives.plays_count` | Drive Analysis | "Avg Plays Per Drive" |
| Yards Gained | `drives.yards_gained` | Drive Analysis | "Avg Yards Per Drive" |
| First Downs | `drives.first_downs` | Drive Analysis | Drive efficiency metric |
| Points | `drives.points` | Drive Analysis | "Points Per Drive"<br>"Total Points" |
| Drive Result | `drives.result` | Drive Analysis | touchdown, field_goal, punt, turnover, downs, etc. |
| 3-and-Out | `drives.three_and_out` | Drive Analysis | "3-and-Out Rate"<br>Auto-calculated: plays ≤ 3 AND first_downs = 0 |
| Reached Red Zone | `drives.reached_red_zone` | Drive Analysis | "Red Zone Drives"<br>Auto-calculated: max yard_line ≥ 80 |
| Scoring Drive | `drives.scoring_drive` | Drive Analysis | "Scoring Drive Rate"<br>Auto-calculated: points > 0 |
| Offensive/Defensive | `drives.is_offensive_drive` | Drive Analysis | Splits drive analytics into offense vs defense sections |

---

## COMPUTED/DERIVED FIELDS (Not Tagged, Auto-Calculated)

| Computed Field | Calculation Logic | Report(s) | Report Field |
|----------------|------------------|-----------|-------------|
| **Success** | Based on down/distance/yards:<br>- 1st down: ≥40% of distance<br>- 2nd down: ≥60% of distance<br>- 3rd/4th down: ≥100% of distance (first down) | All Reports | "Success Rate" percentages |
| **Explosive** | Based on play type/yards:<br>- Run: ≥10 yards<br>- Pass: ≥15 yards | Season Overview<br>Future: Explosive Play report | "Explosive Plays" count |
| **Havoc Rate** | Defensive plays that are:<br>TFL OR Sack OR Forced Fumble OR PBU OR Interception<br>Divided by total defensive snaps | Defensive Report | "Havoc Rate" - Disruptive plays percentage |
| **Completion %** | Completions ÷ Pass Attempts × 100 | Player Report (QB)<br>Offensive Report<br>Defensive Report | "Completion %" (offense)<br>"Completion % Allowed" (defense) |
| **Yards Per Carry** | Rushing Yards ÷ Rushing Attempts | Player Report (RB)<br>Offensive Report | "Yards Per Carry" (YPC) |
| **Yards Per Reception** | Receiving Yards ÷ Receptions | Player Report (WR/TE)<br>Offensive Report | "Yards Per Reception" (YPR) |
| **Yards Per Play** | Total Yards ÷ Total Plays | All Reports | "Avg Yards Per Play"<br>"Yards Per Play Allowed" |
| **3rd Down Conversion Rate** | 3rd down conversions ÷ 3rd down attempts × 100 | Offensive Report | "3rd Down Conversion %" |
| **3rd Down Stop Rate** | 3rd down stops ÷ 3rd down attempts × 100 | Defensive Report | "3rd Down Stop Rate" |
| **Red Zone TD Rate** | Offensive:<br>Red zone TDs ÷ Red zone attempts × 100<br><br>Defensive:<br>Red zone TDs allowed ÷ Red zone drives × 100 | Offensive Report<br>Defensive Report<br>Drive Analysis | "Red Zone TD Rate"<br>"Red Zone Stop Rate" (defense) |

---

## REPORTS REFERENCE

### Report Categories

1. **Overview**
   - Season Overview Report
   - Game Report

2. **Performance**
   - Offensive Report
   - Defensive Report
   - Special Teams Report

3. **Analysis**
   - Player Report
   - Situational Report
   - Drive Analysis Report

### Data Sources by Report

| Report | Primary Data Sources | Key Metrics |
|--------|---------------------|-------------|
| **Season Overview** | `play_instances`, `playbook_plays` | Plays, yards, success rate, first downs, turnovers, top/bottom plays |
| **Game Report** | `play_instances` (filtered by game) | Same as Season Overview, game-specific |
| **Offensive Report** | `play_instances` (is_opponent_play = false), `players`, `playbook_plays`<br>**Sections:** AllQBStatsSection, AllRBStatsSection, AllWRTEStatsSection, OLPerformanceSection | **Team Metrics:** Volume, efficiency, ball security, possession<br>**QB Stats:** Completions, yards, TDs, INTs, sacks (by player)<br>**RB Stats:** Rushing + receiving stats (by player)<br>**WR/TE Stats:** Targets, receptions, yards, TDs (by player)<br>**OL Stats:** Block win rate by position and player |
| **Defensive Report** | `play_instances` (is_opponent_play = true), `players`, **`player_participation`** (Tier 3)<br>**Sections:** AllDLStatsSection, AllLBStatsSection, AllDBStatsSection | **Team Metrics:** Yards allowed, efficiency, disruptive plays, havoc rate<br>**DL Stats:** Tackles, pressures, sacks, TFLs, FFs (by player from player_participation)<br>**LB Stats:** Tackles, pressures, sacks, coverage, TFLs, INTs, PBUs (by player)<br>**DB Stats:** Tackles, coverage assignments, INTs, PBUs, FFs (by player) |
| **Special Teams Report** | `calculate_team_metrics` RPC | Kickoff, punt, return performance |
| **Player Report** | `play_instances`, `players` | Position-specific stats, performance by down, success rate |
| **Situational Report** | `play_instances` | Performance by down, distance, field position |
| **Drive Analysis Report** | `drives`, `play_instances` | Points per drive, yards per drive, 3-and-outs, scoring %, red zone efficiency |

---

## ANALYTICS TIER DIFFERENCES

### Little League (Tier 1)
**Tagged Fields:**
- Situational Context: Quarter, Down, Distance, Yard Line, Hash
- Ball Carrier only
- Result, Yards Gained, First Down

**Reports Available:**
- Season Overview (simplified)
- Player Report (basic - carries, yards, touchdowns only)

### HS Basic (Tier 2)
**Adds to Tier 1:**
- QB (Quarterback)
- Target (pass plays)
- Play Type
- Direction
- Drive grouping

**Additional Reports:**
- Drive Analysis Report
- Full Situational Report

### HS Advanced (Tier 3)
**Adds to Tier 2:**
- Offensive Line (5 positions + block results)
- Defensive Tracking (tackles, pressures, sacks, coverage, TFLs, forced fumbles, PBUs)
- Situational flags (motion, play action, blitz, box count)
- QB Decision Grades

**Additional Analytics:**
- OL block win rates (future)
- Havoc rate
- Advanced defensive metrics
- Situational splits (future)

---

## CURRENT GAPS (Fields Stored But Not Yet Displayed)

These fields are collected and stored but not yet shown in reports:

1. **Hash Mark** - Could be used for tendency analysis
2. **Direction** (Left/Middle/Right) - Could be used for run game analytics
3. **Play Type** - Used for calculations but not directly displayed
4. ~~**Offensive Line Tracking** (Tier 3)~~ - ✅ **IMPLEMENTED** in OL Performance Section (Offensive Report)
5. **QB Decision Grades** - Stored, awaiting QB development analytics
6. **Situational Flags** (motion, play action, blitz, box count) - Stored, awaiting situational splits feature
7. ~~**Coverage Result**~~ - ✅ **IMPLEMENTED** in DB Stats Section (Defensive Report) + **FIXED** in Migration 038
8. ~~**Defensive Player Tracking**~~ - ✅ **IMPLEMENTED** via player_participation table (DL/LB/DB Stats Sections)
9. **Special Teams Fields** - Special Teams Report shows basic metrics (kickoff, punt, return performance)

---

## VALIDATION RULES

### Required Fields (Little League)
- Quarter
- Down
- Distance
- Yard Line
- Ball Carrier (when tagging offense)
- Result
- Yards Gained

### Required Fields (HS Basic+)
- All Little League fields
- QB (for pass plays)
- Target (for pass plays)
- Play Type

### Required Fields (HS Advanced - Offensive)
- All HS Basic fields
- Full OL (LT, LG, C, RG, RT) + Block Results

### Required Fields (HS Advanced - Defensive)
- All HS Basic fields
- Tacklers (at least 1)
- Defensive play type

### Auto-Calculated Fields
- `is_turnover`: Auto-set when result_type = 'pass_interception' OR 'fumble_lost'
- `is_interception`: Auto-set when result_type = 'pass_interception'
- `is_sack`: Auto-set when result_type = 'pass_sack'
- `success`: Auto-calculated based on down/distance/yards formula
- `explosive`: Auto-calculated based on play_type/yards thresholds

---

## NOTES

1. **Film Tagging Page Location**: `/teams/[teamId]/film/[gameId]`
2. **Analytics & Reporting Location**: `/teams/[teamId]/analytics-reporting` ✅ **CONSOLIDATED**
3. **Legacy Analytics Page**: `/teams/[teamId]/analytics-advanced` → **DEPRECATED** (redirects to analytics-reporting)
4. **Database Tables**:
   - All play data stored in `play_instances` table
   - Tier 3 defensive actions stored in `player_participation` junction table (normalized)
   - Drive data stored in `drives` table
5. **Player Data**: Player names/positions fetched from `players` table via foreign keys
6. **Playbook Integration**: `play_code` links to `playbook_plays` table
7. **Drive Analytics**: Requires `drives` table and drive_id linkage
8. **RPC Functions**: Some aggregations use `calculate_team_metrics` Postgres function
9. **Success Formula**: Standard football analytics - 40% on 1st, 60% on 2nd, 100% on 3rd/4th
10. **Explosive Thresholds**: 10+ yards rushing, 15+ yards passing
11. **Component Architecture**: All stat sections are data-fetching components (fetch their own data via Supabase)
12. **Coverage Tracking**: Migration 038 fixed coverage_result constraint to accept detailed values ('target_allowed', 'completion_allowed', 'incompletion', 'interception', 'pass_breakup')
