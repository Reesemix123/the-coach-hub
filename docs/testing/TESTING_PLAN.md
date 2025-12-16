# Youth Coach Hub - Comprehensive Testing Plan

## Overview

This document outlines the comprehensive testing strategy for Youth Coach Hub using Playwright for end-to-end testing. The plan is derived from the User Guide documentation and covers all documented features.

---

## Test Environment Setup

### Prerequisites
- Node.js 18+
- Playwright installed (`npm install -D @playwright/test`)
- Test database (separate from production)
- Supabase test project or local Supabase instance

### Environment Variables
```env
TEST_SUPABASE_URL=<test-supabase-url>
TEST_SUPABASE_ANON_KEY=<test-anon-key>
TEST_BASE_URL=http://localhost:3000
```

---

## Seed Data Requirements

### 1. User Profiles

| User | Email | Role | Purpose |
|------|-------|------|---------|
| `owner_user` | owner@test.com | Owner | Primary test account, owns teams |
| `coach_user` | coach@test.com | Coach | Invited coach, limited permissions |
| `coach_user_2` | coach2@test.com | Coach | Second coach for multi-coach tests |
| `new_user` | newuser@test.com | None | Fresh account for onboarding tests |
| `multi_team_owner` | multiowner@test.com | Owner | Owns multiple teams |

### 2. Teams

| Team | Owner | Plan | Purpose |
|------|-------|------|---------|
| `Test Team Basic` | owner_user | Basic | Basic plan feature limits |
| `Test Team Plus` | owner_user | Plus | Plus plan features (3 cameras) |
| `Test Team Premium` | multi_team_owner | Premium | Premium features (5 cameras) |
| `Empty Team` | owner_user | Basic | Empty state testing |

### 3. Players (Per Team)

**Test Team Plus - Full Roster (22 players minimum)**

| Position | Jersey | Name | Notes |
|----------|--------|------|-------|
| QB | 12 | Test Quarterback | Starter |
| QB | 7 | Backup QB | 2nd string |
| RB | 22 | Test Runningback | Starter |
| RB | 33 | Backup RB | 2nd string |
| WR | 1 | Test WR1 | X Receiver |
| WR | 11 | Test WR2 | Z Receiver |
| WR | 81 | Test Slot | Slot |
| TE | 88 | Test TE | Starter |
| LT | 72 | Test LT | Starter |
| LG | 66 | Test LG | Starter |
| C | 55 | Test Center | Starter |
| RG | 64 | Test RG | Starter |
| RT | 78 | Test RT | Starter |
| DE | 91 | Test DE1 | Starter |
| DE | 95 | Test DE2 | Starter |
| DT | 97 | Test DT1 | Starter |
| DT | 93 | Test DT2 | Starter |
| LB | 54 | Test MLB | Starter |
| LB | 52 | Test OLB1 | Starter |
| LB | 56 | Test OLB2 | Starter |
| CB | 21 | Test CB1 | Starter |
| CB | 24 | Test CB2 | Starter |
| S | 29 | Test FS | Starter |
| S | 31 | Test SS | Starter |
| K | 3 | Test Kicker | Special Teams |
| P | 4 | Test Punter | Special Teams |

### 4. Games

| Game | Team | Opponent | Date | Result | Purpose |
|------|------|----------|------|--------|---------|
| Game 1 | Test Team Plus | Opponent A | -14 days | Win 28-14 | Historical data |
| Game 2 | Test Team Plus | Opponent B | -7 days | Loss 21-24 | Historical data |
| Game 3 | Test Team Plus | Opponent C | +7 days | Pending | Upcoming game |
| Game 4 | Test Team Plus | Opponent D | +14 days | Pending | Upcoming game |
| Opponent Scout 1 | Test Team Plus | Scout Team X | -7 days | N/A | Opponent scouting film |

### 5. Playbook Plays

**Offensive Plays (15 minimum)**

| Play Code | Name | Formation | Type | Tags |
|-----------|------|-----------|------|------|
| P-001 | Inside Zone | I-Form Pro | Run | Base, 1st Down |
| P-002 | Outside Zone | Shotgun Spread | Run | Base |
| P-003 | Power | I-Form Strong | Run | Short Yardage |
| P-004 | Counter | Shotgun | Run | Misdirection |
| P-005 | Slant Flat | Shotgun Spread | Pass | Quick Game |
| P-006 | Curl Flat | Shotgun Trips | Pass | 3rd Down |
| P-007 | Four Verticals | Shotgun Spread | Pass | Deep Shot |
| P-008 | Mesh | Shotgun Empty | Pass | Red Zone |
| P-009 | Screen Left | Shotgun | Pass | 3rd & Long |
| P-010 | Draw | Shotgun | Run | 3rd Down |
| P-011 | Jet Sweep | Pistol | Run | Gadget |
| P-012 | PA Boot | I-Form | Pass | Play Action |
| P-013 | Hitch | Shotgun | Pass | Quick Game |
| P-014 | Smash | Shotgun Twins | Pass | Cover 2 Beater |
| P-015 | Levels | Shotgun Trips | Pass | Zone Beater |

**Defensive Plays (10 minimum)**

| Play Code | Name | Formation | Coverage |
|-----------|------|-----------|----------|
| D-001 | Base 4-3 | 4-3 Over | Cover 3 |
| D-002 | Nickel | Nickel | Cover 2 |
| D-003 | Dime | Dime | Cover 4 |
| D-004 | Goal Line | Goal Line | Man |
| D-005 | Fire Zone | 3-4 | Cover 3 Blitz |
| D-006 | Man Free | 4-3 | Man Cover 1 |
| D-007 | Tampa 2 | Nickel | Tampa 2 |
| D-008 | Quarters | 4-3 | Cover 4 |
| D-009 | Pinch | 4-3 Under | Cover 3 |
| D-010 | Overload | 3-4 | Zone Blitz |

**Special Teams Plays (5 minimum)**

| Play Code | Name | Type |
|-----------|------|------|
| ST-001 | Kickoff Deep | Kickoff |
| ST-002 | Kickoff Onside | Kickoff |
| ST-003 | Punt Regular | Punt |
| ST-004 | FG Right | Field Goal |
| ST-005 | PAT | Extra Point |

### 6. Film/Videos

| Video | Game | Camera | Duration | Purpose |
|-------|------|--------|----------|---------|
| game1_main.mp4 | Game 1 | Main (Sideline) | 45 min | Primary film |
| game1_endzone.mp4 | Game 1 | End Zone | 45 min | Multi-camera test |
| game2_main.mp4 | Game 2 | Main | 50 min | Film with tags |
| opponent_scout.mp4 | Opponent Scout 1 | Main | 30 min | Scouting film |

### 7. Tagged Play Instances

**Game 1 - 30 tagged plays across all three tagging levels**

| Play # | Down | Distance | Yard Line | Play Code | Result | Tagging Level |
|--------|------|----------|-----------|-----------|--------|---------------|
| 1 | 1 | 10 | 25 | P-001 | +4 | Quick |
| 2 | 2 | 6 | 29 | P-005 | +8, 1st | Quick |
| 3 | 1 | 10 | 37 | P-002 | +12, Explosive | Standard |
| 4 | 1 | 10 | 49 | P-006 | +6 | Standard |
| 5 | 2 | 4 | 45 | P-003 | +5, 1st | Standard |
| ... | ... | ... | ... | ... | ... | ... |
| 30 | 3 | 8 | 32 | P-006 | +10, 1st | Comprehensive |

*(Full 30 plays covering various situations: 1st/2nd/3rd/4th downs, red zone, goal line, 2-minute drill)*

### 8. Practice Plans & Templates

| Practice | Type | Duration | Periods |
|----------|------|----------|---------|
| Monday Practice | Template | 120 min | 8 periods |
| Tuesday Practice | Template | 90 min | 6 periods |
| Game Week Practice | Scheduled | 120 min | 8 periods |

### 9. Schedule Events

| Event | Type | Date | Time |
|-------|------|------|------|
| Practice 1 | Practice | +1 day | 3:30 PM |
| Practice 2 | Practice | +2 days | 3:30 PM |
| Game vs Opponent C | Game | +7 days | 7:00 PM |
| Team Meeting | Event | +3 days | 6:00 PM |

---

## Test Suites

### Suite 1: Authentication & Onboarding

**File:** `tests/auth/auth.spec.ts`

```typescript
// Test Cases
1.1 - New user can create account with email/password
1.2 - User can sign in with existing credentials
1.3 - User can sign out
1.4 - Invalid credentials show error message
1.5 - Password reset flow works
1.6 - OAuth sign-in works (if configured)
1.7 - Unauthenticated users redirected to login
1.8 - New user sees onboarding tour prompt
1.9 - User can skip onboarding tour
1.10 - User can replay onboarding tour from settings
1.11 - Getting started checklist shows on dashboard
1.12 - Checklist items complete when actions taken
1.13 - Checklist can be dismissed
```

### Suite 2: Team Management

**File:** `tests/teams/team-management.spec.ts`

```typescript
// Test Cases
2.1 - Owner can create new team
2.2 - Team creation requires plan selection
2.3 - Team appears in team switcher after creation
2.4 - Owner can edit team name
2.5 - Owner can set team colors
2.6 - Team colors reflect in navigation icon
2.7 - Owner can view team settings
2.8 - Coach can view team settings (limited)
2.9 - User can switch between multiple teams
2.10 - Empty team shows appropriate empty states
```

### Suite 3: Team Members & Permissions

**File:** `tests/teams/permissions.spec.ts`

```typescript
// Test Cases
3.1 - Owner can access Console
3.2 - Coach cannot access Console
3.3 - Owner can invite coach via email
3.4 - Invited coach receives invite (check DB)
3.5 - Coach can accept invite and join team
3.6 - Coach appears in team members list
3.7 - Owner can remove coach from team
3.8 - Removed coach loses team access
3.9 - Coach can access playbook
3.10 - Coach can create/edit plays
3.11 - Coach can tag film
3.12 - Coach can view analytics
3.13 - Coach cannot manage billing
3.14 - Coach cannot invite other coaches
3.15 - Coach cannot delete team
```

### Suite 4: Roster Management

**File:** `tests/roster/roster.spec.ts`

```typescript
// Test Cases
4.1 - Can view roster in list view
4.2 - Can switch to depth chart view
4.3 - Can add new player with all fields
4.4 - Jersey number is required
4.5 - Can assign multiple positions to player
4.6 - Can set player depth (starter, backup)
4.7 - Can edit existing player
4.8 - Can deactivate player
4.9 - Deactivated players hidden by default
4.10 - Can view deactivated players
4.11 - Can reactivate player
4.12 - Depth chart shows correct positions
4.13 - Depth chart updates when player edited
4.14 - Can filter roster by position group
4.15 - Player count displays correctly
```

### Suite 5: Schedule & Calendar

**File:** `tests/schedule/schedule.spec.ts`

```typescript
// Test Cases
5.1 - Calendar displays current month
5.2 - Can navigate between months
5.3 - Games show on correct dates
5.4 - Practices show on correct dates
5.5 - Events show on correct dates
5.6 - Can create new game
5.7 - Can create opponent scouting game
5.8 - Can create practice event
5.9 - Can create general event
5.10 - Can edit game details
5.11 - Can record game result
5.12 - Quarter-by-quarter scoring works
5.13 - Game result updates team record
5.14 - Can delete event
5.15 - Clicking event navigates to detail
```

### Suite 6: Playbook - Play Creation

**File:** `tests/playbook/play-creation.spec.ts`

```typescript
// Test Cases
6.1 - Can access playbook page
6.2 - Can create new offensive play
6.3 - Can create new defensive play
6.4 - Can create special teams play
6.5 - Play code auto-generates (P-XXX format)
6.6 - Can select formation from dropdown
6.7 - Formation loads correct player positions
6.8 - Can name play
6.9 - Can set play type (run/pass)
6.10 - Can set personnel grouping
6.11 - Can add custom tags
6.12 - Play saves successfully
6.13 - Saved play appears in playbook list
6.14 - Cannot save without required fields
```

### Suite 7: Playbook - Play Builder

**File:** `tests/playbook/play-builder.spec.ts`

```typescript
// Test Cases
7.1 - Play builder canvas loads
7.2 - Players display at formation positions
7.3 - Can drag player to new position
7.4 - Can select player to edit
7.5 - Can assign route to receiver
7.6 - Route draws on canvas
7.7 - Can assign blocking to lineman
7.8 - Block direction indicator shows
7.9 - Can add pre-snap motion
7.10 - Motion path displays correctly
7.11 - Can draw custom route with waypoints
7.12 - Can delete route
7.13 - Formation validation shows warnings
7.14 - 7-on-line rule enforced
7.15 - Offsides detection works
7.16 - Can add dummy defense to offensive play
7.17 - Can add dummy offense to defensive play
```

### Suite 8: Playbook - Management

**File:** `tests/playbook/playbook-management.spec.ts`

```typescript
// Test Cases
8.1 - Playbook displays in list view
8.2 - Can switch to grid view
8.3 - Can switch to formation view
8.4 - Can filter by play type (O/D/ST)
8.5 - Can filter by formation
8.6 - Can filter by personnel
8.7 - Can filter by tags
8.8 - Search finds plays by name
8.9 - Search finds plays by code
8.10 - Can duplicate play
8.11 - Duplicated play has new code
8.12 - Can edit existing play
8.13 - Can delete play
8.14 - Delete requires confirmation
8.15 - Can archive play
8.16 - Archived plays hidden by default
8.17 - Can view archived plays
8.18 - Can restore archived play
```

### Suite 9: Film - Upload

**File:** `tests/film/upload.spec.ts`

```typescript
// Test Cases
9.1 - Film page shows games list
9.2 - Can select game to view film
9.3 - Empty game shows upload prompt
9.4 - Can upload MP4 video
9.5 - Can upload MOV video
9.6 - Upload shows progress indicator
9.7 - Video appears after processing
9.8 - Can add additional camera (Plus/Premium)
9.9 - Camera limit enforced by plan
9.10 - Can rename camera/video
9.11 - Can delete video
9.12 - Storage usage updates after upload
9.13 - Over-limit upload blocked with message
```

### Suite 10: Film - Tagging

**File:** `tests/film/tagging.spec.ts`

```typescript
// Test Cases
10.1 - Video player loads and plays
10.2 - Can mark play start time
10.3 - Can mark play end time
10.4 - Tagging form appears after marking
10.5 - Can select tagging level (Quick/Standard/Comprehensive)
10.6 - Quick level shows minimal fields
10.7 - Standard level shows additional fields
10.8 - Comprehensive level shows all fields
10.9 - Can enter down and distance
10.10 - Can enter yard line and hash
10.11 - Can select play from playbook
10.12 - Can enter yards gained
10.13 - Can mark first down
10.14 - Can mark turnover
10.15 - Play saves successfully
10.16 - Saved play appears in play list
10.17 - Next play auto-populates context
10.18 - Can edit existing tagged play
10.19 - Can delete tagged play
10.20 - Keyboard shortcuts work (space, arrows)
```

### Suite 11: Film - Multi-Camera

**File:** `tests/film/multi-camera.spec.ts`

```typescript
// Test Cases
11.1 - Multiple cameras display in video group
11.2 - Can switch between camera views
11.3 - Camera labels display correctly
11.4 - Can initiate sync process
11.5 - Can mark sync point on primary
11.6 - Can mark sync point on secondary
11.7 - Sync offset calculates correctly
11.8 - Synced cameras play together
11.9 - Switching cameras maintains playhead position
11.10 - Can edit sync offset manually
11.11 - Can remove camera from group
```

### Suite 12: Film - Comprehensive Tagging

**File:** `tests/film/comprehensive-tagging.spec.ts`

```typescript
// Test Cases
12.1 - Can select QB for play
12.2 - Can select ball carrier
12.3 - Can select target (pass plays)
12.4 - Can grade QB decision (0-2)
12.5 - Can grade QB accuracy
12.6 - Can grade RB vision/elusiveness
12.7 - Can grade each OL (5 positions)
12.8 - OL block win/loss tracking
12.9 - Can select tackler(s)
12.10 - Can mark missed tackles
12.11 - Can mark pressures
12.12 - Can mark sacks
12.13 - Can mark TFL
12.14 - Can grade coverage
12.15 - All grades save correctly
12.16 - Grades appear in analytics
```

### Suite 13: Practice Planning

**File:** `tests/practice/practice-planning.spec.ts`

```typescript
// Test Cases
13.1 - Practice page loads
13.2 - Can create new practice plan
13.3 - Can set practice title and date
13.4 - Can set duration and location
13.5 - Can add period to practice
13.6 - Can set period type (warmup, drill, etc.)
13.7 - Can set period duration
13.8 - Can add drill to period
13.9 - Can assign position group to drill
13.10 - Can link playbook plays to drill
13.11 - Timeline visualization updates
13.12 - Can mark periods as concurrent
13.13 - Can save practice plan
13.14 - Practice appears in list
13.15 - Can edit practice plan
13.16 - Can duplicate practice
13.17 - Can delete practice
```

### Suite 14: Practice Templates

**File:** `tests/practice/templates.spec.ts`

```typescript
// Test Cases
14.1 - Can create practice as template
14.2 - Template toggle visible in form
14.3 - Template requires name
14.4 - Template saves successfully
14.5 - Template appears in Templates tab
14.6 - Can create practice from template
14.7 - Template content populates new practice
14.8 - Can edit template
14.9 - Can delete template
14.10 - Template doesn't create schedule event
```

### Suite 15: Analytics - Season Overview

**File:** `tests/analytics/season-overview.spec.ts`

```typescript
// Test Cases
15.1 - Analytics page loads
15.2 - Season overview displays
15.3 - Offensive metrics show
15.4 - Defensive metrics show
15.5 - Special teams metrics show
15.6 - Overall metrics show
15.7 - Metrics calculate correctly from tagged plays
15.8 - Zero state shows when no data
15.9 - Can filter by date range
15.10 - Metrics update with filter
```

### Suite 16: Analytics - Game Report

**File:** `tests/analytics/game-report.spec.ts`

```typescript
// Test Cases
16.1 - Can select game for report
16.2 - Scoring summary displays
16.3 - Quarter breakdown shows
16.4 - Offensive stats accurate
16.5 - Defensive stats accurate
16.6 - Play-by-play available
16.7 - Comparison to season average shows
16.8 - Can export/print report
```

### Suite 17: Analytics - Offensive Report

**File:** `tests/analytics/offensive-report.spec.ts`

```typescript
// Test Cases
17.1 - Team offensive stats display
17.2 - QB stats show correctly
17.3 - RB stats show correctly
17.4 - WR/TE stats show correctly
17.5 - OL grades show (comprehensive data)
17.6 - Formation breakdown accurate
17.7 - Play concept analysis shows
17.8 - Success rate by situation
17.9 - Can filter by game
17.10 - Export functionality works
```

### Suite 18: Analytics - Defensive Report

**File:** `tests/analytics/defensive-report.spec.ts`

```typescript
// Test Cases
18.1 - Team defensive stats display
18.2 - DL stats show correctly
18.3 - LB stats show correctly
18.4 - DB stats show correctly
18.5 - Tackle leaders accurate
18.6 - Sack/TFL tracking works
18.7 - Opponent tendency analysis
18.8 - Situational defense stats
18.9 - Can filter by game
```

### Suite 19: Analytics - Player Report

**File:** `tests/analytics/player-report.spec.ts`

```typescript
// Test Cases
19.1 - Can select player
19.2 - Player stats display by position
19.3 - Game log shows
19.4 - Situational splits accurate
19.5 - Trend data displays
19.6 - Comparison to team average
19.7 - All positions have appropriate stats
```

### Suite 20: Analytics - Drive Analysis

**File:** `tests/analytics/drive-analysis.spec.ts`

```typescript
// Test Cases
20.1 - Drive analysis page loads
20.2 - Points per drive calculates
20.3 - Drive success rate accurate
20.4 - Plays per drive shows
20.5 - Drive outcomes breakdown
20.6 - Starting field position analysis
20.7 - Red zone efficiency
```

### Suite 21: Subscriptions & Billing

**File:** `tests/billing/subscriptions.spec.ts`

```typescript
// Test Cases
21.1 - Can view current plan
21.2 - Plan features display correctly
21.3 - Can initiate upgrade
21.4 - Can initiate downgrade
21.5 - Billing portal accessible (owner only)
21.6 - Usage shows correctly (games, storage)
21.7 - Token balance displays
21.8 - Feature limits enforced by plan
```

### Suite 22: Support & Feedback

**File:** `tests/support/feedback.spec.ts`

```typescript
// Test Cases
22.1 - Feedback button visible
22.2 - Feedback modal opens
22.3 - Can select feedback type
22.4 - Can enter feedback text
22.5 - Can attach screenshot
22.6 - Feedback submits successfully
22.7 - Can view submitted feedback
22.8 - Feedback status displays
22.9 - Can reply to feedback thread
22.10 - Notifications work
```

### Suite 23: Responsive Design

**File:** `tests/responsive/mobile.spec.ts`

```typescript
// Test Cases (viewport: 375x667)
23.1 - Navigation collapses to hamburger
23.2 - Mobile menu opens/closes
23.3 - Playbook usable on mobile
23.4 - Film viewer adapts to screen
23.5 - Forms are scrollable
23.6 - Touch interactions work
23.7 - Tables scroll horizontally
23.8 - Modals fit screen
```

### Suite 24: Error Handling

**File:** `tests/errors/error-handling.spec.ts`

```typescript
// Test Cases
24.1 - 404 page displays for invalid routes
24.2 - Network error shows user-friendly message
24.3 - Form validation errors display
24.4 - API errors handled gracefully
24.5 - Session timeout redirects to login
24.6 - Concurrent edit conflicts handled
```

---

## Playwright Configuration

**File:** `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Test Utilities

### Auth Helper

**File:** `tests/utils/auth.ts`

```typescript
import { Page } from '@playwright/test';

export async function loginAsOwner(page: Page) {
  await page.goto('/auth/login');
  await page.fill('[name="email"]', 'owner@test.com');
  await page.fill('[name="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/teams/**');
}

export async function loginAsCoach(page: Page) {
  await page.goto('/auth/login');
  await page.fill('[name="email"]', 'coach@test.com');
  await page.fill('[name="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/teams/**');
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('text=Sign Out');
  await page.waitForURL('/auth/login');
}
```

### Database Helpers

**File:** `tests/utils/database.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_KEY! // Service key for admin access
);

export async function seedTestData() {
  // Seed users, teams, players, games, plays, etc.
}

export async function cleanupTestData() {
  // Remove test data after tests complete
}

export async function resetToBaseState() {
  // Reset database to known state between test runs
}
```

---

## Test Data Seeding Script

**File:** `scripts/seed-test-data.ts`

```typescript
// This script creates all necessary test data
// Run with: npx ts-node scripts/seed-test-data.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_KEY!
);

async function seedTestData() {
  console.log('Seeding test data...');

  // 1. Create test users (via Supabase Auth Admin API)
  // 2. Create teams
  // 3. Create team memberships
  // 4. Create players
  // 5. Create playbook plays
  // 6. Create games
  // 7. Create videos (upload test files)
  // 8. Create play instances
  // 9. Create practice plans/templates
  // 10. Create schedule events

  console.log('Test data seeded successfully!');
}

seedTestData().catch(console.error);
```

---

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Seed test database
        run: npx ts-node scripts/seed-test-data.ts
        env:
          TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          TEST_SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}

      - name: Run Playwright tests
        run: npx playwright test
        env:
          TEST_BASE_URL: http://localhost:3000
          TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Test Execution Order

### Smoke Tests (Run First)
1. Auth - Login/Logout
2. Team - View Dashboard
3. Playbook - View List
4. Film - View Page
5. Analytics - View Overview

### Full Regression (Nightly)
All 24 test suites in order listed above

### PR Validation
- Smoke tests
- Tests related to changed files (via Playwright's `--only-changed`)

---

## Test Coverage Goals

| Area | Target Coverage |
|------|-----------------|
| Authentication | 100% |
| Team Management | 95% |
| Playbook | 95% |
| Film Upload | 90% |
| Film Tagging | 95% |
| Analytics | 90% |
| Practice Planning | 90% |
| Billing | 85% |
| Responsive | 80% |

---

## Next Steps

1. [ ] Set up test Supabase project
2. [ ] Create test user accounts
3. [ ] Write seed data script
4. [ ] Implement auth helper utilities
5. [ ] Write smoke test suite first
6. [ ] Implement remaining test suites
7. [ ] Set up CI/CD pipeline
8. [ ] Create test video files for film tests
9. [ ] Document test data reset procedures
10. [ ] Train team on running/writing tests
