# Implementation Roadmap
## The Coach Hub - Coach Productivity Platform

**Date:** 2025-11-01
**Vision:** Help coaches be more effective in preparation activities
**Scope:** Coach-focused productivity tool, NOT team communication platform

---

## Clarified Scope (Based on User Feedback)

### ✅ IN SCOPE

**V1 Features (MVP - Build Now):**
1. **Film Library & Tagging**
   - Upload game film (own team AND opponent)
   - Accept any video format/source (Hudl, YouTube, local files)
   - Tag plays: down, distance, formation, result, yards
   - Own team film + Opponent scouting film
   - NO practice film (they don't film practices)

2. **Digital Playbook Builder**
   - Drag-and-drop play designer (already built)
   - 40+ formations (already built)
   - Save plays to team playbook

3. **Analytics Dashboard**
   - Team performance metrics
   - Tiered analytics (Little League → HS Advanced)
   - Actionable insights for game planning

4. **Game Planning**
   - Select plays for wristband
   - Print wristband cards
   - Print coach sheets

5. **Practice Planning** ⭐ NEW FEATURE
   - Design practice drills
   - Set practice schedule
   - (Need to define what this looks like)

6. **Multi-Coach Collaboration**
   - Invite coaching staff (Owner, Coach, Analyst roles)
   - Multiple coaches tag film, share workload
   - Team workspace for staff

7. **Multi-Sport Support** (Architecture)
   - Database: generic "sport" field (not football-only)
   - UI: sport-specific formations/terminology
   - V1: Football only, but architected for future sports

**V2+ Features (Future Versions):**
1. **Player Highlight Reels** (for recruiting)
   - Cut highlights from tagged plays
   - Export for college recruiting
   - Share links with recruiters

2. **Additional Sports**
   - Basketball playbook builder
   - Baseball/softball
   - (Depends on market demand)

### ❌ OUT OF SCOPE

- ❌ Practice film upload/tagging (they don't film practices)
- ❌ Parent communication (not a team management tool)
- ❌ Player messaging (coaches text players directly)
- ❌ Attendance tracking (use clipboard at practice)
- ❌ Team social features (photos, posts)
- ❌ Payment processing (not relevant to coaching prep)

---

## Feature Deep Dive

### 1. Opponent Scouting (Film Upload)

**Requirement:** Coaches need to upload opponent film from various sources

**Sources:**
- Hudl (download video file)
- YouTube (coaches screen record or download)
- Local video files (MP4, MOV, etc.)
- DVDs ripped to video
- Phone recordings of film sessions

**Implementation:**
```typescript
// Film upload flow
interface Video {
  id: string;
  game_id: string;
  name: string;
  file_path: string;      // Supabase Storage path
  is_opponent_film: boolean;  // ← NEW FIELD
  opponent_team_name?: string; // ← For scouting
  video_source?: string;      // 'hudl', 'youtube', 'local', etc.
}
```

**UI Flow:**
1. Coach goes to `/teams/[teamId]/film`
2. Clicks "Upload Film"
3. Modal asks:
   - "Is this your team's film or opponent scouting film?"
   - If opponent: "Which opponent?" (dropdown of teams from schedule)
   - Upload video file OR paste YouTube link
4. Video processes, ready to tag

**Tagging Opponent Film:**
- Tag opponent plays: "Lions run Power Right from I-Form on 1st down"
- Build tendencies: "Lions blitz on 3rd & 7+ 65% of the time"
- Analytics show opponent patterns
- Use insights for game planning

### 2. Practice Planning (New Feature)

**User Need:** Coaches want to plan practices in the app

**Typical Practice Structure:**
```
PRACTICE PLAN - Tuesday, Nov 5, 2024 (90 minutes)

WARMUP (10 min)
- Dynamic stretching
- Agility ladder

INDIVIDUAL DRILLS (20 min)
- OL: Stance and starts
- RB: Ball security drill
- WR: Route running (slants, posts)
- QB: Footwork and drops

TEAM PERIODS (40 min)
- Inside run (vs. scout defense)
  → Run plays: 22 Dive, 23 Blast, 24 Power
- Pass skeleton (7 on 7)
  → Pass plays: 80 Levels, 81 Mesh, 85 Curl
- Red zone (11 on 11)
  → Plays from wristband

CONDITIONING (10 min)
- Gassers

SPECIAL TEAMS (10 min)
- Kickoff coverage

NOTES:
- Focus on 3rd down conversions
- Emphasize gap integrity on defense
```

**Implementation Concept:**

**Database Schema:**
```sql
CREATE TABLE practice_plans (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  date DATE,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE practice_periods (
  id UUID PRIMARY KEY,
  practice_plan_id UUID REFERENCES practice_plans(id),
  period_order INT,
  name VARCHAR(100),          -- "Individual Drills", "Team Period"
  duration_minutes INT,
  period_type VARCHAR(50),    -- 'drill', 'team', 'special_teams'
  notes TEXT
);

CREATE TABLE practice_drills (
  id UUID PRIMARY KEY,
  period_id UUID REFERENCES practice_periods(id),
  drill_order INT,
  drill_name VARCHAR(200),
  position_group VARCHAR(50), -- 'OL', 'RB', 'WR', etc.
  description TEXT,
  play_codes TEXT[]           -- Array of play codes to practice
);
```

**UI:**
```
/teams/[teamId]/practice
  → List of practice plans
  [+ Create Practice Plan]

/teams/[teamId]/practice/new
  → Practice Plan Builder
  - Date picker
  - Add periods (drag-and-drop timeline)
  - Add drills to periods
  - Link plays from playbook to practice
  - Print practice plan for clipboard
```

**Integration with Playbook:**
- "Practice these plays" → Select from playbook
- Prints with diagrams for coaches
- Players run the plays, coaches use printed sheets

**Priority:** P1 (V1) - Coaches requested this

### 3. Multi-Sport Architecture

**Requirement:** Keep option open for basketball, baseball, etc.

**Database Changes:**
```sql
ALTER TABLE teams
  ADD COLUMN sport VARCHAR(50) DEFAULT 'football';
  -- Values: 'football', 'basketball', 'baseball', 'soccer', etc.

ALTER TABLE playbook_plays
  ADD COLUMN sport VARCHAR(50) DEFAULT 'football';
  -- Play formations are sport-specific
```

**Configuration Architecture:**
```typescript
// src/config/sportsConfig.ts

interface SportConfig {
  formations: FormationConfig;
  positions: string[];
  playTypes: string[];
  metrics: MetricConfig;
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  football: {
    formations: FOOTBALL_FORMATIONS,  // Current footballConfig.ts
    positions: ['QB', 'RB', 'WR', ...],
    playTypes: ['Run', 'Pass', 'Play Action'],
    metrics: FOOTBALL_METRICS
  },
  basketball: {
    formations: BASKETBALL_SETS,      // Future
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    playTypes: ['Man Set', 'Zone Set', 'Press Break'],
    metrics: BASKETBALL_METRICS
  },
  // Future sports...
};

export function getSportConfig(sport: string): SportConfig {
  return SPORT_CONFIGS[sport] || SPORT_CONFIGS.football;
}
```

**UI:**
```typescript
// Team creation flow
<select name="sport">
  <option value="football">Football</option>
  <option value="basketball" disabled>Basketball (Coming Soon)</option>
  <option value="baseball" disabled>Baseball (Coming Soon)</option>
</select>

// Playbook builder adapts based on team.sport
const config = getSportConfig(team.sport);
const formations = config.formations;
```

**V1:** Football only (existing code)
**V2+:** Add basketball, baseball configs

---

## Application Structure (Final)

### URL Structure
```
MARKETING (Logged Out)
/                           → Marketing home
/about                      → About page
/pricing                    → Pricing tiers
/auth/login                 → Login
/auth/signup                → Sign up

TEAM WORKSPACE (Logged In)
/teams                      → Team selector (if multiple teams)
/teams/new                  → Create team onboarding

/teams/[teamId]             → Team dashboard (coaching staff home)
  /schedule                 → Games calendar
  /playbook                 → Digital playbook
  /playbook/print/[id]      → Print wristband/coach sheet
  /film                     → Film library (own + opponent)
  /film/[gameId]            → Film room (tag plays)
  /players                  → Roster & depth chart
  /analytics                → Team analytics
  /practice                 → Practice plans ⭐ NEW
  /practice/[planId]        → View/edit practice plan ⭐ NEW
  /settings                 → Team settings (invite, tier)

ACCOUNT (User-Level)
/account                    → User profile
/account/teams              → Team memberships
```

### Navigation
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] The Coach Hub     [Bears Football ▼]        [@]     │
├─────────────────────────────────────────────────────────────┤
│ Schedule  Playbook  Film  Players  Analytics  Practice  ⚙️ │
└─────────────────────────────────────────────────────────────┘
```

**Tab Order (Left to Right):**
1. **Schedule** - When are games?
2. **Playbook** - What plays do we run?
3. **Film** - How did we execute? What does opponent do?
4. **Players** - Who's on the team? (Depth chart)
5. **Analytics** - What's working? What needs adjustment?
6. **Practice** - How do we prepare this week? ⭐ NEW
7. **Settings** - Team config (gear icon on right)

---

## Team Dashboard (Coaching Mission Control)

```
┌─────────────────────────────────────────────────────────────┐
│ BEARS FOOTBALL - COACHING STAFF DASHBOARD          5-2     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COACHING PREP STATUS                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │   42    │  │   12    │  │   38    │  │    3    │        │
│  │ Plays   │  │ Film    │  │ Plays   │  │Practice │        │
│  │ in Book │  │ Uploaded│  │ Tagged  │  │  Plans  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  NEXT GAME PREP (vs Tigers, Friday 7pm)                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ ✅ Tigers film uploaded (3 games)            │           │
│  │ ⏳ Tendencies tagged (60% complete)          │           │
│  │ ⏳ Game plan wristband (12/18 plays)         │           │
│  │ ✅ Tuesday practice plan created             │  ← NEW   │
│  │ ⏳ Thursday practice plan (not started)      │  ← NEW   │
│  └──────────────────────────────────────────────┘           │
│  [Finish Scouting] [Build Game Plan] [Plan Practice]       │
│                                                             │
│  STAFF ACTIVITY (This Week)                                 │
│  • Coach Smith tagged 15 plays in vs. Lions                │
│  • Coach Johnson added 3 new run concepts                  │
│  • You uploaded Tigers game film (Week 3)                  │
│  • You created practice plan for Tuesday                   │  ← NEW
│                                                             │
│  COACHING INSIGHTS (Last 3 Games)                           │
│  📈 Success Rate: 54% (up from 48%)                         │
│  ⚠️  3rd Down Conv: 28% (league avg: 38%)                   │
│  ✅ Red Zone TD: 67% (excellent)                            │
│  [View Full Analytics]                                     │
│                                                             │
│  QUICK ACTIONS                                              │
│  [+ Upload Film] [+ Build Play] [+ Plan Practice]          │  ← NEW
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) - RESTRUCTURE
**Goal:** Team-first architecture, clean navigation

**Tasks:**
1. ✅ Create `TeamSwitcher` component
2. ✅ Update middleware for smart redirects
3. ✅ Create team dashboard page
4. ✅ Update global header with team context
5. ✅ Remove duplicate top-level routes (`/film`, `/playbook`)
6. ✅ Test: Logged-in user redirects to `/teams/[teamId]`

**Database:** No changes (structure already supports team-first)

**Deliverable:** Team-first navigation working, no duplicate routes

---

### Phase 2: Opponent Scouting (Week 2) - FILM ENHANCEMENT
**Goal:** Coaches can upload opponent film for scouting

**Tasks:**
1. ✅ Add `is_opponent_film` field to `videos` table
2. ✅ Add `opponent_team_name` field
3. ✅ Update film upload modal:
   - "Own team or opponent film?"
   - "Which opponent?" (if opponent)
4. ✅ Update film library UI:
   - Filter: Own Team / Opponent / All
   - Visual distinction (badge: "vs. Lions - Opponent")
5. ✅ Update analytics to separate own/opponent
6. ✅ Test: Upload opponent film, tag plays, see tendencies

**Database Migration:**
```sql
ALTER TABLE videos
  ADD COLUMN is_opponent_film BOOLEAN DEFAULT FALSE,
  ADD COLUMN opponent_team_name VARCHAR(100);

CREATE INDEX idx_videos_is_opponent ON videos(is_opponent_film);
```

**Deliverable:** Opponent scouting film workflow complete

---

### Phase 3: Practice Planning (Week 3-4) - NEW FEATURE
**Goal:** Coaches can plan practices in the app

**Tasks:**
1. ✅ Create database schema:
   - `practice_plans` table
   - `practice_periods` table
   - `practice_drills` table
2. ✅ Create `/teams/[teamId]/practice` page (list view)
3. ✅ Create `/teams/[teamId]/practice/new` (builder)
4. ✅ Practice plan builder UI:
   - Add periods (warmup, drills, team, conditioning)
   - Add drills to periods
   - Link plays from playbook
   - Set durations
5. ✅ Print practice plan (PDF/printer-friendly)
6. ✅ Add "Practice" tab to team navigation
7. ✅ Test: Create practice plan, print, use at practice

**Database Migration:**
```sql
CREATE TABLE practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_minutes INT DEFAULT 90,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE practice_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_plan_id UUID REFERENCES practice_plans(id) ON DELETE CASCADE,
  period_order INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  duration_minutes INT NOT NULL,
  period_type VARCHAR(50),
  notes TEXT
);

CREATE TABLE practice_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES practice_periods(id) ON DELETE CASCADE,
  drill_order INT NOT NULL,
  drill_name VARCHAR(200) NOT NULL,
  position_group VARCHAR(50),
  description TEXT,
  play_codes TEXT[]  -- Array of play codes to practice
);

-- RLS policies
ALTER TABLE practice_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_drills ENABLE ROW LEVEL SECURITY;

-- Policies (team members only)
CREATE POLICY "Team members can view practice plans"
  ON practice_plans FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    UNION SELECT id FROM teams WHERE user_id = auth.uid()
  ));

-- Similar policies for INSERT, UPDATE, DELETE
```

**Deliverable:** Practice planning feature complete

---

### Phase 4: Multi-Sport Architecture (Week 5) - FUTURE-PROOFING
**Goal:** Prepare codebase for basketball, baseball, etc.

**Tasks:**
1. ✅ Add `sport` field to `teams` table
2. ✅ Add `sport` field to `playbook_plays` table
3. ✅ Create `src/config/sportsConfig.ts` abstraction
4. ✅ Refactor `footballConfig.ts` to be `football` in `sportsConfig`
5. ✅ Update playbook builder to use `getSportConfig(team.sport)`
6. ✅ Update analytics to use sport-specific metrics
7. ✅ UI: Show "Football" in team creation, disable other sports
8. ✅ Test: Existing football teams work unchanged

**Database Migration:**
```sql
ALTER TABLE teams
  ADD COLUMN sport VARCHAR(50) DEFAULT 'football'
  CHECK (sport IN ('football', 'basketball', 'baseball', 'soccer'));

ALTER TABLE playbook_plays
  ADD COLUMN sport VARCHAR(50) DEFAULT 'football';

CREATE INDEX idx_teams_sport ON teams(sport);
CREATE INDEX idx_playbook_plays_sport ON playbook_plays(sport);
```

**Deliverable:** Multi-sport architecture in place, football works as before

---

### Phase 5: Marketing & Onboarding (Week 6) - GROWTH
**Goal:** Convert visitors to users

**Tasks:**
1. ✅ Create marketing home page (`/`)
   - Hero: "The Digital Coach's Office"
   - Features: Playbook, Film, Analytics, Practice Planning
   - Testimonials
   - CTA: "Start Coaching Smarter"
2. ✅ Create pricing page (`/pricing`)
   - Little League: $29/month
   - HS Basic: $79/month
   - HS Advanced: $149/month
3. ✅ Create `/teams/new` onboarding flow
   - Step 1: Team name, sport, level
   - Step 2: Colors
   - Step 3: "What's next?" (quick actions)
4. ✅ Update `/about` page (coach-focused)
5. ✅ Test: New user signup → create team → use features

**Deliverable:** Marketing site + smooth onboarding

---

### Phase 6: Polish & Testing (Week 7) - QUALITY
**Goal:** Production-ready V1

**Tasks:**
1. ✅ Add keyboard shortcuts (Cmd+K)
2. ✅ Add breadcrumbs for context
3. ✅ Mobile optimization (all pages)
4. ✅ Error handling (network failures, etc.)
5. ✅ Loading states (skeletons)
6. ✅ User testing with 2-3 real coaches
7. ✅ Bug fixes based on feedback
8. ✅ Performance optimization

**Deliverable:** V1 ready for beta launch

---

## V2+ Features (Future Roadmap)

### V2.1: Player Highlight Reels (3-6 months after V1)
**Goal:** Help players get recruited

**Features:**
- Coach tags plays: "Highlight for Player #22"
- System auto-cuts highlights from tagged plays
- Export video file (MP4)
- Generate shareable link
- Player can send to college coaches

**UI:**
```
/teams/[teamId]/players/[playerId]/highlights
  → List of highlight-tagged plays
  [Create Highlight Reel]
  → Select plays, system stitches video
  [Download] [Share Link]
```

**Database:**
```sql
ALTER TABLE play_instances
  ADD COLUMN is_highlight BOOLEAN DEFAULT FALSE,
  ADD COLUMN highlight_player_id UUID REFERENCES players(id);

CREATE TABLE highlight_reels (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  name VARCHAR(200),
  video_url TEXT,
  created_at TIMESTAMPTZ
);
```

### V2.2: Additional Sports
- Basketball playbook builder
- Baseball/softball
- Soccer

### V2.3: Advanced Scouting
- Opponent tendency reports (auto-generated)
- "They run X play 60% on 1st & 10 from their own 20"
- Export scouting report PDF

### V2.4: Mobile App
- Native iOS/Android for coaches
- Quick film tagging on sideline
- View analytics on tablet

---

## Success Metrics (V1)

### User Engagement
- **Active Teams:** 50 teams using app weekly (first 3 months)
- **Film Tagged:** 500+ plays tagged per team per season
- **Playbook Usage:** 30+ plays built per team
- **Multi-Coach:** 70% of teams have 2+ coaches invited

### Time Savings (Survey After 30 Days)
- **Film Study:** "I save X hours/week" (target: 3+ hours)
- **Play Design:** "Digital playbook is X times faster" (target: 3x)
- **Game Planning:** "Creating wristbands is X times faster" (target: 5x)

### Revenue (if paid tiers)
- **Paid Conversion:** 30% of teams upgrade from free trial
- **MRR:** $5,000/month by Month 6

---

## Technical Stack Summary

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Components:** React 19
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (video files)
- **Real-time:** Supabase subscriptions (future)

### Hosting
- **Frontend:** Vercel (Next.js hosting)
- **Database:** Supabase cloud
- **Video:** Supabase Storage (or future: AWS S3 + CloudFront)

---

## Open Questions

### Practice Planning Design
- What's the ideal UI for building practice plans?
- Drag-and-drop timeline? Form-based?
- Do coaches want drill library (pre-made drills)?
- Integration with playbook: Just link play codes, or embed diagrams?

### Video Processing
- Current: Upload full video, tag manually
- Future: Auto-detect plays from video? (AI/ML)
- Future: Auto-tag down/distance from scoreboard OCR?

### Pricing Strategy
- Free tier? (Limited to X plays, X film uploads)
- Or free trial only (14 days), then paid?
- Team vs. per-coach pricing?

### Multi-Sport Priority
- Which sport after football? Basketball or baseball?
- Different analytics for different sports
- Different formations, positions, terminology

---

## Next Steps

### Immediate (This Week)
1. **User approves roadmap** ✅
2. **Begin Phase 1:** Team-first restructure
   - Create TeamSwitcher
   - Update middleware
   - Remove duplicate routes
3. **Test with existing features**

### This Month
1. Complete Phase 1 (restructure)
2. Complete Phase 2 (opponent scouting)
3. Begin Phase 3 (practice planning)

### Next 3 Months
1. Complete all 6 phases (V1 feature-complete)
2. Beta test with 5-10 real coaches
3. Launch V1 publicly

---

## Conclusion

**Clear Vision:**
- Coach productivity tool (NOT team communication)
- Save coaches 6+ hours/week on prep
- Actionable insights for better coaching

**V1 Scope:**
- ✅ Film tagging (own + opponent scouting)
- ✅ Digital playbook builder
- ✅ Analytics dashboard
- ✅ Game planning & wristbands
- ✅ Practice planning (NEW)
- ✅ Multi-coach collaboration
- ✅ Multi-sport architecture (football V1)

**V2+ Scope:**
- Player highlight reels (recruiting)
- Additional sports (basketball, baseball)
- Advanced scouting reports
- Mobile app

**Timeline:** 7 weeks to V1, then beta testing

**Ready to proceed with Phase 1?**

---

*Roadmap Date: 2025-11-01*
*Status: Awaiting approval to begin implementation*
