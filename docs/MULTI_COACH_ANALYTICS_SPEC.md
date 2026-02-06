# Multi-Coach & Analytics Architecture Spec

> Extracted from CLAUDE.md to keep the main file focused on coding guidance.
> This document contains the design spec for features in development.

---

## Overview

**Target Audience:** Little League through High School coaches
**Key Features Being Added:**
1. Multi-coach team collaboration
2. 4-tier analytics system (Little League → High School Advanced → AI-Powered future)
3. Comprehensive player tracking and drive-level analytics

## Multi-Coach System

**Current Limitation:** Each team has single owner (`teams.user_id`)

**New Architecture:** Team membership system with roles

**Database Schema:**
```sql
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'coach', 'analyst', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ,
  UNIQUE(team_id, user_id)
);
```

**Roles:**
- **Owner:** Full control (head coach) - create/delete team, manage members, all permissions
- **Coach:** Edit playbook, tag plays, view analytics, manage roster
- **Analyst:** Create/edit playbook, tag plays, view analytics (cannot manage team settings or roster)
- **Viewer:** Read-only access (for parents, players)

**RLS Policy Changes:**
All tables (games, videos, play_instances, players) now check:
```sql
-- Old: auth.uid() = teams.user_id
-- New: auth.uid() IN (
--   SELECT user_id FROM team_memberships WHERE team_id = X
--   UNION
--   SELECT user_id FROM teams WHERE id = X
-- )
```

**Play Attribution:**
```sql
ALTER TABLE play_instances
  ADD COLUMN tagged_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN reviewed_by_user_id UUID REFERENCES auth.users(id);
```

**UI Changes:**
- Team settings: "Manage Coaches" section with invite flow
- Team dropdown: Shows "Your Teams" + "Teams You Coach"
- Play list: Optional "Tagged by: Coach Smith" badge
- Analytics: Filter by tagger

---

## Tier System Overview

Youth Coach Hub has **two distinct tier concepts**:

1. **Subscription Tiers** (`basic`, `plus`, `premium`) - Controls billing and capacity limits
2. **Tagging Tiers** (`quick`, `standard`, `comprehensive`) - Controls play tagging depth per game

### Subscription Tiers (Billing)

Stored in `subscriptions.tier`. Controls capacity limits, not feature access.

| Tier | Games/Month | Storage | Retention | Cameras | Coaches |
|------|-------------|---------|-----------|---------|---------|
| **Basic** | 2 | 5GB | 30 days | 1 | 1 |
| **Plus** | 6 | 25GB | 90 days | 3 | 3 |
| **Premium** | Unlimited | 100GB | 1 year | 5 | 10 |

**All features are available on all subscription tiers.** Tiers only differ by capacity.

### Tagging Tiers (Per-Game)

Stored in `games.tagging_tier`. Controls which fields are shown when tagging plays.

**Quick Tag** - Track the game, remember the season
- Fields: Play type, direction, result, yards, scoring

**Standard Tag** - Understand what's working, prepare for next week
- Fields: Quick fields + formation, personnel, hash, down/distance, player attribution

**Comprehensive Tag** - Evaluate and develop every player
- Fields: Standard fields + OL tracking (5 positions), defensive tracking, situational flags

### AI-Assisted Tagging

AI analysis level maps directly to the game's tagging tier:
- `quick` → Gemini Flash (fast, basic fields)
- `standard` → Gemini Pro (detailed analysis)
- `comprehensive` → Gemini Pro (full analysis)

AI pre-fills fields with confidence scores. Coaches confirm or correct.

---

## Database Schema Additions

**Players Table:**
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  jersey_number VARCHAR(3) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  primary_position VARCHAR(20),
  position_group VARCHAR(20),
  depth_order INTEGER,
  is_active BOOLEAN,
  grade_level VARCHAR(20),
  notes TEXT
);
```

**Drives Table:**
```sql
CREATE TABLE drives (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  team_id UUID REFERENCES teams(id),
  drive_number INTEGER,
  quarter INTEGER,
  start_yard_line INTEGER,
  end_yard_line INTEGER,
  plays_count INTEGER,
  yards_gained INTEGER,
  first_downs INTEGER,
  result TEXT,
  points INTEGER
);
```

**Play Instances Additions:**
```sql
-- Context (Standard+)
ALTER TABLE play_instances
  ADD COLUMN quarter INTEGER,
  ADD COLUMN time_remaining INTEGER,
  ADD COLUMN score_differential INTEGER,
  ADD COLUMN drive_id UUID REFERENCES drives(id);

-- Player attribution (Standard+)
ALTER TABLE play_instances
  ADD COLUMN qb_id UUID REFERENCES players(id),
  ADD COLUMN ball_carrier_id UUID REFERENCES players(id),
  ADD COLUMN target_id UUID REFERENCES players(id);

-- Offensive line (Comprehensive)
ALTER TABLE play_instances
  ADD COLUMN lt_id UUID, ADD COLUMN lt_block_result TEXT,
  ADD COLUMN lg_id UUID, ADD COLUMN lg_block_result TEXT,
  ADD COLUMN c_id UUID, ADD COLUMN c_block_result TEXT,
  ADD COLUMN rg_id UUID, ADD COLUMN rg_block_result TEXT,
  ADD COLUMN rt_id UUID, ADD COLUMN rt_block_result TEXT;

-- Defensive tracking (Comprehensive)
ALTER TABLE play_instances
  ADD COLUMN tackler_ids UUID[],
  ADD COLUMN missed_tackle_ids UUID[],
  ADD COLUMN pressure_player_ids UUID[],
  ADD COLUMN sack_player_id UUID,
  ADD COLUMN coverage_player_id UUID,
  ADD COLUMN coverage_result TEXT;

-- Situational (Comprehensive)
ALTER TABLE play_instances
  ADD COLUMN has_motion BOOLEAN,
  ADD COLUMN is_play_action BOOLEAN,
  ADD COLUMN facing_blitz BOOLEAN,
  ADD COLUMN box_count INTEGER,
  ADD COLUMN is_tfl BOOLEAN,
  ADD COLUMN is_sack BOOLEAN;

-- Multi-coach attribution (All tiers)
ALTER TABLE play_instances
  ADD COLUMN tagged_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN reviewed_by_user_id UUID;
```

---

## Service Layer Architecture

**`team-membership.service.ts`:** inviteCoach, acceptInvite, removeCoach, updateRole, getTeamMembers, getUserTeams

**`advanced-analytics.service.ts`:** Drive analytics (PPD, 3-and-outs, RZ%), player stats by tier, OL block win rates, defensive stats, situational splits, explosive plays, play concept rankings

**`drive.service.ts`:** createDrive, autoGroupPlays, updateDriveMetadata, calculateDriveStats

---

## Key Algorithms

**Success Rate:**
```typescript
function calculateSuccess(down: number, distance: number, gain: number): boolean {
  if (down === 1) return gain >= 0.40 * distance;
  if (down === 2) return gain >= 0.60 * distance;
  return gain >= distance;
}
```

**Explosive Play:** Run >= 10 yards, Pass >= 15 yards

**Havoc Rate:** (TFL + Sacks + Forced Fumbles + PBU + INT) / Defensive Snaps

---

## Migration Strategy

- All new columns are nullable (backward compatible)
- `teams.user_id` remains as primary owner
- `team_memberships` is additive
- Old RLS policies work via UNION with new membership checks
- Tagging tier defaults to 'standard' for new games

---

*Extracted from CLAUDE.md on 2026-02-03*
