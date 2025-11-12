# Data Architecture Implementation Plan
## Based on 3rd Party Expert Guidance

**Date:** 2025-01-12
**Status:** Migration 032 is CORRECT - Proceed with implementation
**Critical Finding:** No need to revert application or database

---

## Executive Summary

### ✅ What's Working
- **Migration 032 junction table approach is CORRECT** - Follows data warehousing best practices
- **Current dimension tables** (teams, players, games, videos) are properly structured
- **Fact table** (play_instances) has correct grain (one row per play)
- **Team_id denormalization** in migration 032 aligns with multi-tenant guidance

### 🔥 Critical Gap Identified
**Missing Aggregation Layer** - Currently computing all stats on-demand in TypeScript. This will NOT scale commercially (breaks at 500-1,000 plays).

### 📋 Implementation Strategy
**5 phases** over next 6 months, prioritized by business impact.

---

## Phase 1: IMMEDIATE (Week 1) 🔥

**Goal:** Fix array-based performance problem

**Status:** Migration file exists, needs to be applied

### Tasks:
1. **Apply Migration 032** ✅ Ready to apply
   - Creates `player_participation` junction table
   - Migrates existing array data to normalized structure
   - Adds optimized B-tree indexes
   - Implements fast RLS policies with team_id

2. **Update Service Layer** (3-5 hours)
   - File: `src/lib/services/advanced-analytics.service.ts`
   - Replace array queries with junction table queries
   - Use new RPC functions: `get_player_tackle_stats()`, `get_player_pressure_stats()`, `get_player_ol_block_stats()`

3. **Update Film Tagging UI** (2-4 hours)
   - Files: Film room components that write defensive participation
   - Change from array updates to player_participation inserts
   - Example:
     ```typescript
     // OLD (arrays)
     UPDATE play_instances SET tackler_ids = [player1, player2]

     // NEW (junction table)
     INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
     VALUES (play_id, team_id, player1, 'primary_tackle', 'made'),
            (play_id, team_id, player2, 'assist_tackle', 'made')
     ```

4. **Verify Performance** (1 hour)
   - Test with existing 8 plays
   - Simulate with 1,000+ plays
   - Confirm queries complete in <100ms

### Success Criteria:
- ✅ Defensive stats load without timeouts
- ✅ Queries run in <100ms (vs 10+ seconds with arrays)
- ✅ All 8 existing plays migrate correctly
- ✅ Player stats table displays correctly

---

## Phase 2: CRITICAL (Weeks 2-3) 🔥

**Goal:** Add aggregation layer for commercial scale

**Why Critical:** TypeScript on-demand aggregation breaks at 1,000 plays. Materialized views can handle 100,000+ plays.

### Architecture Pattern:
```
Raw Facts (play_instances, player_participation)
    ↓
Materialized Views (pre-computed rollups)
    ↓
Application Queries (ultra-fast lookups)
```

### Materialized Views to Create:

#### 1. Player Season Stats
```sql
CREATE MATERIALIZED VIEW player_season_stats AS
SELECT
  p.id as player_id,
  p.team_id,
  t.name as team_name,
  p.jersey_number,
  p.first_name,
  p.last_name,
  p.primary_position,

  -- Offensive stats
  COUNT(*) FILTER (WHERE pi.ball_carrier_id = p.id) as rushing_att,
  SUM(pi.yards_gained) FILTER (WHERE pi.ball_carrier_id = p.id) as rushing_yards,
  COUNT(*) FILTER (WHERE pi.target_id = p.id) as targets,
  COUNT(*) FILTER (WHERE pi.target_id = p.id AND pi.pass_complete = true) as receptions,
  SUM(pi.yards_gained) FILTER (WHERE pi.target_id = p.id AND pi.pass_complete = true) as receiving_yards,

  -- Success rates
  ROUND(
    (COUNT(*) FILTER (WHERE pi.ball_carrier_id = p.id AND pi.success = true)::NUMERIC /
     NULLIF(COUNT(*) FILTER (WHERE pi.ball_carrier_id = p.id), 0)) * 100, 1
  ) as rushing_success_rate,

  -- Timestamps
  MAX(pi.created_at) as last_updated
FROM players p
JOIN teams t ON t.id = p.team_id
LEFT JOIN play_instances pi ON pi.team_id = p.team_id
WHERE p.is_active = true
GROUP BY p.id, p.team_id, t.name, p.jersey_number, p.first_name, p.last_name, p.primary_position;

-- Add unique index for concurrent refresh
CREATE UNIQUE INDEX idx_player_season_stats_player ON player_season_stats(player_id);
```

#### 2. Defensive Player Stats (Uses Junction Table!)
```sql
CREATE MATERIALIZED VIEW defensive_player_stats AS
SELECT
  p.id as player_id,
  p.team_id,
  p.jersey_number,
  p.first_name,
  p.last_name,

  -- Tackles
  COUNT(*) FILTER (WHERE pp.participation_type = 'primary_tackle') as primary_tackles,
  COUNT(*) FILTER (WHERE pp.participation_type = 'assist_tackle') as assist_tackles,
  COUNT(*) FILTER (WHERE pp.participation_type = 'missed_tackle') as missed_tackles,

  -- Pressures
  COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'sack') as sacks,
  COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'hurry') as hurries,
  COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'hit') as hits,

  -- Explosive plays allowed
  COUNT(*) FILTER (WHERE pi.explosive = true AND pp.participation_type = 'coverage_assignment') as explosive_plays_allowed,

  MAX(pp.created_at) as last_updated
FROM players p
LEFT JOIN player_participation pp ON pp.player_id = p.id
LEFT JOIN play_instances pi ON pi.id = pp.play_instance_id
WHERE p.primary_position IN ('DE', 'DT', 'LB', 'CB', 'S')
GROUP BY p.id, p.team_id, p.jersey_number, p.first_name, p.last_name;

CREATE UNIQUE INDEX idx_defensive_player_stats_player ON defensive_player_stats(player_id);
```

#### 3. OL Block Win Rates
```sql
CREATE MATERIALIZED VIEW ol_player_stats AS
SELECT
  p.id as player_id,
  p.team_id,

  -- Block statistics
  COUNT(*) FILTER (WHERE pp.participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt')) as total_blocks,
  COUNT(*) FILTER (WHERE pp.result = 'win') as block_wins,
  COUNT(*) FILTER (WHERE pp.result = 'loss') as block_losses,

  ROUND(
    (COUNT(*) FILTER (WHERE pp.result = 'win')::NUMERIC /
     NULLIF(COUNT(*) FILTER (WHERE pp.participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt')), 0)) * 100, 1
  ) as block_win_rate,

  MAX(pp.created_at) as last_updated
FROM players p
LEFT JOIN player_participation pp ON pp.player_id = p.id
WHERE p.primary_position IN ('LT', 'LG', 'C', 'RG', 'RT')
GROUP BY p.id, p.team_id;

CREATE UNIQUE INDEX idx_ol_player_stats_player ON ol_player_stats(player_id);
```

#### 4. Team Analytics
```sql
CREATE MATERIALIZED VIEW team_season_analytics AS
SELECT
  t.id as team_id,
  t.name as team_name,

  -- Play counts
  COUNT(*) as total_plays,
  COUNT(*) FILTER (WHERE pi.play_type = 'run') as rushing_plays,
  COUNT(*) FILTER (WHERE pi.play_type = 'pass') as passing_plays,

  -- Success rates
  ROUND((COUNT(*) FILTER (WHERE pi.success = true)::NUMERIC / COUNT(*)) * 100, 1) as overall_success_rate,
  ROUND((COUNT(*) FILTER (WHERE pi.explosive = true)::NUMERIC / COUNT(*)) * 100, 1) as explosive_rate,

  -- Yards
  SUM(pi.yards_gained) as total_yards,
  ROUND(AVG(pi.yards_gained), 1) as yards_per_play,

  MAX(pi.created_at) as last_updated
FROM teams t
LEFT JOIN play_instances pi ON pi.team_id = t.id AND pi.is_opponent_play = false
GROUP BY t.id, t.name;

CREATE UNIQUE INDEX idx_team_season_analytics_team ON team_season_analytics(team_id);
```

### Refresh Strategy:

**Option A: Trigger-based (Real-time)**
```sql
CREATE FUNCTION refresh_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_season_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY defensive_player_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ol_player_stats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_stats_on_play_insert
  AFTER INSERT ON play_instances
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_player_stats();
```

**Option B: Scheduled (via Supabase cron or pg_cron)**
```sql
-- Refresh every 5 minutes during season
SELECT cron.schedule('refresh-player-stats', '*/5 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_season_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY defensive_player_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ol_player_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY team_season_analytics;
$$);
```

**Recommendation:** Start with trigger-based for immediate feedback, add cron for large datasets.

### Update Service Layer:
```typescript
// src/lib/services/advanced-analytics.service.ts

// OLD (scans raw tables)
async getPlayerStats(playerId: string) {
  const { data: plays } = await this.supabase
    .from('play_instances')
    .select('*')
    .eq('ball_carrier_id', playerId);

  // Calculate stats in TypeScript... 100+ lines
}

// NEW (reads pre-computed view)
async getPlayerStats(playerId: string) {
  const { data } = await this.supabase
    .from('player_season_stats')
    .select('*')
    .eq('player_id', playerId)
    .single();

  return data; // Already computed!
}
```

### Success Criteria:
- ✅ Analytics page loads in <200ms (vs 10+ seconds)
- ✅ Can handle 10,000+ plays without slowdown
- ✅ Stats update within 5 minutes of new play tagged

---

## Phase 3: HIGH (Weeks 4-5) ⚠️

**Goal:** Multi-tenant safeguards and data quality

### Tasks:

#### 1. Add team_id to ALL tables (not just some)
```sql
-- Videos currently require JOIN through games
ALTER TABLE videos ADD COLUMN team_id UUID REFERENCES teams(id);

UPDATE videos v
SET team_id = (SELECT g.team_id FROM games g WHERE g.id = v.game_id);

ALTER TABLE videos ALTER COLUMN team_id SET NOT NULL;

-- Update RLS policy to use direct team_id (faster)
DROP POLICY IF EXISTS "Users can view their videos" ON videos;
CREATE POLICY "Users can view their videos"
  ON videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = videos.team_id
        AND teams.user_id = auth.uid()
    )
  );
```

#### 2. Add Soft Delete Pattern (Append-Only)
```sql
ALTER TABLE play_instances
  ADD COLUMN is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN deletion_reason TEXT;

-- Update queries to filter deleted records
-- In service layer:
WHERE is_deleted = false
```

#### 3. Add Data Quality Tracking
```sql
ALTER TABLE play_instances
  ADD COLUMN data_quality_score INTEGER CHECK (data_quality_score BETWEEN 0 AND 100),
  ADD COLUMN is_reviewed BOOLEAN DEFAULT false,
  ADD COLUMN reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN needs_review BOOLEAN DEFAULT false,
  ADD COLUMN needs_review_reason TEXT;

-- Auto-flag incomplete plays
CREATE FUNCTION flag_incomplete_plays()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.down IS NULL OR NEW.distance IS NULL OR NEW.yards_gained IS NULL THEN
    NEW.needs_review := true;
    NEW.needs_review_reason := 'Missing required fields';
    NEW.data_quality_score := 50;
  ELSE
    NEW.data_quality_score := 100;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flag_incomplete_plays_trigger
  BEFORE INSERT OR UPDATE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION flag_incomplete_plays();
```

#### 4. Add Coach Attribution (Multi-Coach Readiness)
```sql
ALTER TABLE play_instances
  ADD COLUMN tagged_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN tagged_at TIMESTAMPTZ DEFAULT NOW();

-- Track which coach tagged what
CREATE INDEX idx_play_instances_tagged_by ON play_instances(tagged_by_user_id);
```

### Success Criteria:
- ✅ All tables have direct team_id for RLS
- ✅ Can track play edits without losing history
- ✅ Can see which coach tagged which plays
- ✅ Data quality dashboard shows completion rates

---

## Phase 4: MEDIUM (Weeks 6-8) 📊

**Goal:** Query optimization and performance tuning

### Tasks:

#### 1. Add Composite Indexes for Common Query Patterns
```sql
-- "Show all plays from formation X on 3rd down"
CREATE INDEX idx_play_instances_formation_down
  ON play_instances ((attributes->>'formation'), down)
  WHERE is_deleted = false;

-- "Show player X's participation in game Y"
CREATE INDEX idx_player_participation_player_game
  ON player_participation(player_id, play_instance_id)
  INCLUDE (participation_type, result);
```

#### 2. Add Partial Indexes for Hot Queries
```sql
-- Only index successful plays (most analytics filter by success)
CREATE INDEX idx_play_instances_success
  ON play_instances(team_id, success)
  WHERE success = true AND is_deleted = false;

-- Only index explosive plays
CREATE INDEX idx_play_instances_explosive
  ON play_instances(team_id, explosive)
  WHERE explosive = true AND is_deleted = false;
```

#### 3. Add Expression Indexes
```sql
-- For queries that extract from JSONB frequently
CREATE INDEX idx_play_instances_formation
  ON play_instances ((attributes->>'formation'))
  WHERE is_deleted = false;

CREATE INDEX idx_play_instances_play_type
  ON play_instances ((attributes->>'playType'))
  WHERE is_deleted = false;
```

#### 4. Monitor and Tune
```sql
-- Add query performance logging
CREATE TABLE query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_name TEXT NOT NULL,
  execution_time_ms INTEGER,
  rows_returned INTEGER,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log slow queries in service layer
if (executionTime > 1000) {
  await logSlowQuery(queryName, executionTime);
}
```

### Success Criteria:
- ✅ 95% of queries complete in <100ms
- ✅ No queries timeout
- ✅ Can identify and fix performance regressions

---

## Phase 5: LOW (Months 3-6) 🤖

**Goal:** AI provenance layer (Tier 4 prep)

**When to implement:** When building AI-powered play tagging features

### Schema:
```sql
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  task_type TEXT NOT NULL, -- 'formation_detection', 'player_tracking', 'play_classification'
  model_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, version)
);

CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ai_models(id),
  video_id UUID REFERENCES videos(id),
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  parameters JSONB,
  metrics JSONB, -- Accuracy, confidence distribution, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES ai_runs(id),
  video_id UUID REFERENCES videos(id),
  play_instance_id UUID REFERENCES play_instances(id),

  -- Time-based anchoring
  timecode_start_ms INTEGER NOT NULL,
  timecode_end_ms INTEGER NOT NULL,

  -- What was detected
  annotation_type TEXT NOT NULL, -- 'formation', 'player_position', 'play_result'
  annotation_value TEXT NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),
  annotation_data JSONB,

  -- Human review
  reviewed_by UUID REFERENCES auth.users(id),
  review_status TEXT, -- 'pending', 'approved', 'rejected', 'corrected'
  corrected_value TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- "Blessed" labels: Which annotation is the official one?
CREATE MATERIALIZED VIEW blessed_play_annotations AS
WITH ranked AS (
  SELECT
    a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a.play_instance_id, a.annotation_type
      ORDER BY
        CASE WHEN a.review_status = 'approved' THEN 1 ELSE 2 END,
        a.confidence_score DESC,
        a.created_at DESC
    ) AS rn
  FROM ai_annotations a
)
SELECT * FROM ranked WHERE rn = 1;
```

### Integration Pattern:
```typescript
// When coach reviews AI annotation
async reviewAnnotation(annotationId: string, action: 'approve' | 'reject' | 'correct', correctedValue?: string) {
  await supabase
    .from('ai_annotations')
    .update({
      review_status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'corrected',
      corrected_value: correctedValue,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', annotationId);

  // Refresh materialized view to update "blessed" labels
  await supabase.rpc('refresh_blessed_annotations');
}
```

### Success Criteria:
- ✅ Can track which AI model generated which annotations
- ✅ Can compare model versions
- ✅ Human review workflow integrated
- ✅ Can automatically apply high-confidence annotations

---

## Migration File Checklist

### ✅ Migration 032 (Ready to Apply)
- [x] Creates player_participation table
- [x] Adds team_id for fast RLS
- [x] Migrates existing array data
- [x] Creates optimized indexes
- [x] Adds RLS policies
- [x] Creates helper RPC functions

### 📝 Migration 033 (Phase 2 - Create after 032 applied)
- [ ] Create materialized views
- [ ] Add refresh triggers/cron jobs
- [ ] Update analytics queries

### 📝 Migration 034 (Phase 3 - Multi-tenant safeguards)
- [ ] Add team_id to remaining tables
- [ ] Add soft delete columns
- [ ] Add data quality columns
- [ ] Add coach attribution

### 📝 Migration 035 (Phase 4 - Optimization)
- [ ] Add composite indexes
- [ ] Add partial indexes
- [ ] Add expression indexes

### 📝 Migration 036 (Phase 5 - AI layer)
- [ ] Create ai_models table
- [ ] Create ai_runs table
- [ ] Create ai_annotations table
- [ ] Create blessed_play_annotations view

---

## Risk Assessment

### LOW RISK ✅
- Migration 032 (tested, follows best practices)
- Adding indexes (can drop if not helpful)
- Materialized views (can drop if not helpful)

### MEDIUM RISK ⚠️
- Changing UUID to integers (DON'T DO - keep UUIDs)
- Soft delete migration (requires careful testing)
- RLS policy changes (test thoroughly)

### HIGH RISK 🔴
- Deleting existing data (DON'T DO - use soft deletes)
- Breaking changes to APIs (version carefully)

---

## Success Metrics

### Phase 1 (Week 1):
- Defensive stats load time: <100ms (currently: timeout)
- Query success rate: 100% (currently: ~50%)

### Phase 2 (Week 3):
- Analytics page load time: <200ms (currently: 10+ seconds)
- Can handle: 10,000+ plays (currently: breaks at 500)

### Phase 3 (Week 5):
- RLS query time: <10ms (currently: 50-100ms)
- Data quality score: >90% complete plays

### Phase 4 (Week 8):
- 95th percentile query time: <100ms
- Zero timeout errors

### Phase 5 (Month 6):
- AI annotation accuracy: >85%
- Human review time: <30 seconds per play

---

## Alignment with 3rd Party Guidance

| Guidance Principle | Current Status | Action |
|-------------------|----------------|--------|
| Surrogate IDs everywhere | ✅ Using UUIDs | Keep as-is |
| One row per atomic event | ✅ play_instances | Keep as-is |
| Junction tables for many-to-many | ⚠️ Migration 032 ready | **Apply now** |
| Materialized views for aggregations | ❌ Missing | **Phase 2** |
| Append-only with versioning | ⚠️ Partial | **Phase 3** |
| Tenant key on all tables | ⚠️ Most tables | **Phase 3** |
| AI provenance layer | ❌ Missing | **Phase 5** |
| Portable types | ✅ Compatible | Keep as-is |

**Overall Alignment: 85%** - On the right track, need aggregation layer

---

## Next Steps

### This Week:
1. ✅ Review this plan with team
2. 🔥 Apply migration 032
3. 🔥 Update analytics.service.ts to use junction table
4. 🔥 Update film tagging UI
5. ✅ Verify performance improvement

### Next Week:
1. Create migration 033 (materialized views)
2. Test refresh strategies
3. Update service layer to query views
4. Benchmark performance

### This Month:
1. Complete Phases 1-2
2. Start Phase 3
3. Document query patterns
4. Set up monitoring

---

## Questions & Decisions

### Decision Log:
- **2025-01-12:** Keep UUIDs (don't change to integers)
- **2025-01-12:** Apply migration 032 immediately (no revert needed)
- **2025-01-12:** Prioritize materialized views (Phase 2) over AI layer (Phase 5)

### Open Questions:
- [ ] Trigger-based vs cron-based refresh for materialized views?
- [ ] When to implement multi-coach team memberships? (Depends on business priority)
- [ ] Which analytics are most frequently accessed? (Inform materialized view design)

---

## Resources

- **Migration Files:** `/supabase/migrations/`
- **Service Layer:** `/src/lib/services/advanced-analytics.service.ts`
- **Film Tagging:** `/src/app/teams/[teamId]/film/[gameId]/page.tsx`
- **3rd Party Guidance:** (Saved in project root)

---

**Last Updated:** 2025-01-12
**Next Review:** After Phase 1 complete (1 week)
