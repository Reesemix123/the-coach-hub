# Application Flow Analysis & Redesign Proposal
## The Coach Hub - Team-First Architecture

**Date:** 2025-11-01
**Objective:** Restructure application to follow team-workspace best practices

---

## Executive Summary

**Current Problem:** The application has conflicting mental models - some features are top-level (Film Library, Playbook), while others are team-scoped. This creates confusion about where work happens and doesn't match the intended use case of team-based coaching.

**Proposed Solution:** Adopt a **workspace-first architecture** where all work happens within team context, similar to Slack, Notion, or Linear. Home page becomes a marketing/dashboard hybrid, and logged-in users primarily live in their team workspace.

---

## Current State Analysis

### Current Application Structure

```
/                           → Home page (generic features)
/about                      → About page
/contact                    → Contact page
/auth/login                 → Login
/setup                      → Team creation

TOP-LEVEL USER FEATURES (❌ Problem: No team context)
/film                       → Film library (all user's games across teams)
/playbook                   → Playbook builder (personal? team? unclear)

TEAM-SCOPED FEATURES (✅ Correct pattern)
/teams                      → List of user's teams
/teams/[teamId]             → Team dashboard
  /schedule                 → Team schedule
  /playbook                 → Team playbook
  /film                     → Team film (DUPLICATE of top-level)
  /players                  → Team roster
  /analytics                → Team analytics
  /settings                 → Team settings
```

### Problems Identified

1. **Conflicting Feature Locations**
   - Film exists at both `/film` (top-level) and `/teams/[teamId]/film` (team-level)
   - Playbook exists at both `/playbook` (builder) and `/teams/[teamId]/playbook`
   - Users must decide: "Do I go to /film or /teams/X/film?"

2. **Unclear Primary Workspace**
   - After login, where should users land?
   - No persistent "you are working in Team X" context
   - Each feature feels isolated rather than part of a team workspace

3. **Personal vs Team Ambiguity**
   - Database allows `team_id = NULL` for personal playbooks
   - But the use case is team-based coaching, not personal use
   - Creates confusion about ownership and sharing

4. **Home Page Misalignment**
   - Shows generic features to logged-in users
   - No value for returning users who know the app
   - Wastes prime real estate (post-login landing page)

5. **Navigation Complexity**
   - Top nav: About, Contact, Film, Setup
   - Team nav: Schedule, Playbook, Film, Players, Analytics, Settings
   - User must understand which context they're in

---

## Best Practice Analysis

### Successful Team-Based Apps

#### **Slack** - Channel/Workspace First
- Login → Redirect to primary workspace
- Persistent workspace context in URL (`/client/T123ABC/...`)
- Workspace switcher in sidebar
- All features scoped to workspace
- Home = workspace selector (if multiple)

#### **Notion** - Workspace First
- Login → Redirect to last workspace
- Sidebar always shows workspace name
- All pages belong to a workspace
- Workspace switcher at top of sidebar
- Home = workspace selector

#### **Linear** - Team First
- Login → Redirect to primary team
- Team switcher in top-left
- All issues, projects scoped to team
- Team URL: `linear.app/teamname/...`
- No top-level "personal" features

#### **Asana** - Workspace First
- Login → Redirect to last workspace
- All projects/tasks belong to workspace
- Workspace switcher prominent
- Clear hierarchy: Workspace > Team > Project

### Common Patterns (Industry Best Practices)

1. **Workspace-First URLs**
   ```
   /[workspace]/feature   ← Clear context in URL
   NOT /feature (ambiguous)
   ```

2. **Single Source of Truth**
   - Each feature exists in ONE place only
   - No duplicate routes
   - Clear mental model

3. **Persistent Context**
   - URL always shows current workspace
   - UI always shows workspace name
   - Easy to switch workspaces without losing place

4. **Smart Redirects**
   - Logged out user → Marketing home
   - Logged in, no teams → Onboarding
   - Logged in, has teams → Primary team workspace

5. **Progressive Disclosure**
   - Show team switcher only if user is on multiple teams
   - Hide workspace features until user selects a workspace

---

## Proposed Application Flow

### User Journey Map

#### **Journey 1: New Head Coach (Owner)**

```
1. Visit thecoachhub.com
   → Marketing home page
   → See: Features, pricing, testimonials, CTA "Get Started"

2. Click "Get Started" → Sign up
   → Create account

3. Post-signup redirect → /teams/new (onboarding)
   → "Welcome! Let's set up your team"
   → Form: Team name, level (LL/MS/HS), colors
   → Submit → Creates team, user becomes owner

4. Redirect → /teams/[teamId] (team dashboard)
   → Welcome message: "Team created! Next steps:"
   → Cards: "Invite coaches", "Build playbook", "Upload film"

5. User stays in /teams/[teamId]/* for all work
   → /teams/[teamId]/playbook to build plays
   → /teams/[teamId]/film to upload games
   → /teams/[teamId]/players to add roster
   → /teams/[teamId]/settings to invite coaches
```

#### **Journey 2: Invited Coach**

```
1. Receives email: "You've been invited to join [Team Name] on The Coach Hub"
   → Click link → /teams/[teamId]/join?token=abc123

2. If not logged in → Sign up/login flow
   → After auth, redirect back to join link

3. Accept invite → Automatically added to team
   → Redirect → /teams/[teamId] (team dashboard)
   → See: "You're now part of [Team Name]"

4. User works in team workspace
   → Can tag plays: /teams/[teamId]/film/[gameId]
   → Can view analytics: /teams/[teamId]/analytics
   → Can view playbook: /teams/[teamId]/playbook (read-only if analyst)
```

#### **Journey 3: Returning User (Multi-Team)**

```
1. Visit thecoachhub.com (already logged in)
   → Redirect → /teams/[primaryTeamId]
   → Primary team = most recently accessed OR first team created

2. User sees team workspace
   → Team name in header
   → Team switcher dropdown (if user is on multiple teams)

3. Switch teams
   → Click team switcher → Select different team
   → URL changes to /teams/[otherTeamId]
   → All content updates to new team context

4. User continues work in team context
   → All features at /teams/[teamId]/*
   → No top-level features to confuse context
```

---

## Proposed Structure

### New Application Architecture

```
MARKETING (Logged Out)
/                           → Home: Features, pricing, testimonials, CTA
/about                      → About the platform
/contact                    → Contact/support
/pricing                    → Pricing tiers (future)
/auth/login                 → Login
/auth/signup                → Sign up

WORKSPACE SELECTOR (Logged In, No Active Workspace)
/teams                      → List of teams + "Create New Team" button
/teams/new                  → Create team onboarding

TEAM WORKSPACE (Primary Context)
/teams/[teamId]             → Team dashboard/home
  /schedule                 → Games schedule & calendar
  /playbook                 → Digital playbook (build + browse)
  /film                     → Film library for this team
  /film/[gameId]            → Film room (tag plays)
  /players                  → Roster & depth chart
  /players/[playerId]       → Player analytics (future)
  /analytics                → Team analytics
  /settings                 → Team settings (invite, tier, etc.)

ACCOUNT SETTINGS (User-Level)
/account                    → User profile, password, preferences
/account/teams              → All teams user belongs to
/account/notifications      → Notification settings
```

### Removed Routes (Eliminate Ambiguity)

```
❌ /film                    → Move to /teams/[teamId]/film
❌ /playbook                → Move to /teams/[teamId]/playbook
❌ /setup                   → Consolidate to /teams/new
```

---

## Home Page Strategy

### For Logged-Out Users (Marketing)

**Purpose:** Convert visitors to sign-ups

**Content:**
- Hero: "The Digital Playbook & Film Analysis Platform for Youth & High School Football"
- Value props:
  - "Build your digital playbook with drag-and-drop play builder"
  - "Analyze game film with advanced tagging and analytics"
  - "Collaborate with your coaching staff in real-time"
- Social proof: Testimonials, team logos, stats ("500+ teams use The Coach Hub")
- Pricing preview
- CTA: "Start Free Trial" / "Get Started"

**Design:**
- Clean, professional (Apple-like aesthetic maintained)
- Screenshots of playbook builder, film room, analytics
- Clear differentiation from logged-in experience

### For Logged-In Users (Dashboard/Redirect)

**Option A: Immediate Redirect (Recommended)**
- Detect logged-in user → Redirect to `/teams/[primaryTeamId]`
- No home page for logged-in users
- Faster, less friction
- **Used by:** Slack, Linear, Notion

**Option B: Team Switcher Dashboard**
- Show all teams user belongs to
- Quick stats per team (games, plays, members)
- "Continue where you left off" section
- **Used by:** Asana, Trello

**Recommendation: Option A** because:
- Faster for single-team users (majority)
- Team switcher in header handles multi-team
- Less code to maintain
- Clearer mental model

---

## Navigation Structure

### Global Header (Always Visible)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] The Coach Hub    [Team: Bears Football ▼]    [@] │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **Logo:** Click to go to /teams/[teamId] (current team home)
- **Team Switcher:** Dropdown showing all teams, click to switch
- **User Menu:** Avatar/initials → Account Settings, Logout

### Team Navigation (When in Team Context)

```
┌─────────────────────────────────────────────────────────────┐
│  Schedule  Playbook  Film  Players  Analytics  Settings     │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows team name and record (5-2)
- Active tab highlighted
- Persists across all team pages
- **Similar to:** GitHub repo tabs, Linear project tabs

### Mobile Navigation

```
┌─────────────────────┐
│ ☰  Bears Football ▼ │  ← Hamburger + Team switcher
└─────────────────────┘

Hamburger Menu:
├ Schedule
├ Playbook
├ Film
├ Players
├ Analytics
├ Settings
├─────────
├ Switch Team
├ Account Settings
└ Logout
```

---

## Implementation Changes

### 1. File Structure Changes

**Move/Remove Files:**
```
❌ DELETE: /src/app/film/page.tsx (move logic to team film)
❌ DELETE: /src/app/playbook/page.tsx (keep as builder, but redirect to team context)
✅ KEEP: /src/app/teams/[teamId]/film/page.tsx (primary film page)
✅ KEEP: /src/app/teams/[teamId]/playbook/page.tsx (primary playbook page)
```

**New Files:**
```
✅ CREATE: /src/app/page.tsx (new marketing home)
✅ CREATE: /src/components/TeamSwitcher.tsx
✅ CREATE: /src/app/account/page.tsx (user settings)
✅ CREATE: /src/middleware.ts updates (smart redirects)
```

### 2. Database Schema Updates

**No changes needed!** The schema already supports the team-first model:
- `teams` table
- `team_memberships` table (from multi-coach feature)
- All resources have `team_id` foreign key

**Optional cleanup:**
```sql
-- Remove personal playbooks (if any exist)
DELETE FROM playbook_plays WHERE team_id IS NULL;

-- Enforce team_id requirement going forward
ALTER TABLE playbook_plays
  ALTER COLUMN team_id SET NOT NULL;
```

### 3. Middleware Logic (Smart Redirects)

**File:** `/src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();
  const url = request.nextUrl;

  // Public routes (marketing)
  const publicRoutes = ['/', '/about', '/contact', '/pricing'];
  if (publicRoutes.includes(url.pathname) && !user) {
    return NextResponse.next(); // Show marketing page
  }

  // Auth routes
  if (url.pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Protected routes require login
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Logged in user visiting home → redirect to primary team
  if (url.pathname === '/') {
    const primaryTeam = await getPrimaryTeam(user.id);
    if (primaryTeam) {
      return NextResponse.redirect(
        new URL(`/teams/${primaryTeam.id}`, request.url)
      );
    } else {
      // No teams → onboarding
      return NextResponse.redirect(new URL('/teams/new', request.url));
    }
  }

  // Old routes → redirect to team context
  if (url.pathname === '/film') {
    const primaryTeam = await getPrimaryTeam(user.id);
    return NextResponse.redirect(
      new URL(`/teams/${primaryTeam.id}/film`, request.url)
    );
  }

  if (url.pathname === '/playbook') {
    const primaryTeam = await getPrimaryTeam(user.id);
    return NextResponse.redirect(
      new URL(`/teams/${primaryTeam.id}/playbook`, request.url)
    );
  }

  return NextResponse.next();
}
```

### 4. Component Updates

**TeamSwitcher Component:**
```typescript
// src/components/TeamSwitcher.tsx
'use client';

interface Team {
  id: string;
  name: string;
  level: string;
}

export default function TeamSwitcher({
  teams,
  currentTeamId
}: {
  teams: Team[];
  currentTeamId: string;
}) {
  const currentTeam = teams.find(t => t.id === currentTeamId);

  return (
    <div className="relative">
      <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100">
        <span className="font-semibold">{currentTeam?.name}</span>
        <svg className="w-4 h-4">▼</svg>
      </button>

      {/* Dropdown menu */}
      <div className="absolute top-full mt-2 bg-white border rounded-lg shadow-lg">
        {teams.map(team => (
          <a
            key={team.id}
            href={`/teams/${team.id}`}
            className="block px-4 py-2 hover:bg-gray-50"
          >
            {team.name}
            {team.id === currentTeamId && <span>✓</span>}
          </a>
        ))}
        <hr />
        <a href="/teams/new" className="block px-4 py-2 hover:bg-gray-50">
          + Create New Team
        </a>
      </div>
    </div>
  );
}
```

**Updated GlobalHeader:**
```typescript
// src/app/layout.tsx or components/GlobalHeader.tsx
<header>
  <Logo />

  {user && currentTeamId && (
    <TeamSwitcher teams={userTeams} currentTeamId={currentTeamId} />
  )}

  <UserMenu user={user} />
</header>
```

### 5. New Home Page (Marketing)

**File:** `/src/app/page.tsx`

```typescript
export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Logged in? Redirect to team (middleware should handle this)
  // This is backup logic
  if (user) {
    redirect('/teams'); // Middleware will redirect to primary team
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          The Digital Playbook for Youth & High School Football
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
          Build plays, analyze film, and track performance—all in one platform
          designed for coaches who want to elevate their program.
        </p>
        <a
          href="/auth/signup"
          className="inline-block px-8 py-4 bg-black text-white text-lg font-semibold rounded-lg hover:bg-gray-800"
        >
          Get Started Free
        </a>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-2xl font-bold mb-4">Digital Playbook</h3>
            <p className="text-gray-600">
              Drag-and-drop play builder with 40+ formations.
              No more paper wristbands.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4">Film Analysis</h3>
            <p className="text-gray-600">
              Tag plays, track tendencies, and see what's working with
              advanced analytics.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4">Team Collaboration</h3>
            <p className="text-gray-600">
              Invite your coaching staff. Everyone works from the same
              playbook in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-12">
            Trusted by Youth & High School Programs
          </h2>
          {/* Testimonials, logos, etc. */}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6">
          Ready to Go Digital?
        </h2>
        <a
          href="/auth/signup"
          className="inline-block px-8 py-4 bg-black text-white text-lg font-semibold rounded-lg hover:bg-gray-800"
        >
          Start Your Free Trial
        </a>
      </section>
    </div>
  );
}
```

---

## Migration Plan

### Phase 1: Add New Structure (No Breaking Changes)
1. Create `TeamSwitcher` component
2. Create `/account` routes
3. Create new marketing home page at `/` (with logged-in check)
4. Update middleware with smart redirects
5. Test: Logged-in users redirect correctly

### Phase 2: Deprecate Old Routes (Soft Launch)
1. Add warning banners to `/film` and `/playbook` (top-level)
   - "This page is moving! Redirecting to team workspace..."
2. Auto-redirect after 3 seconds
3. Monitor analytics: Are users still accessing old routes?

### Phase 3: Remove Old Routes (Hard Launch)
1. Delete `/src/app/film/page.tsx`
2. Delete `/src/app/playbook/page.tsx` (or repurpose as onboarding tool)
3. Update all internal links to point to team routes
4. Celebrate! 🎉

### Phase 4: Marketing Polish
1. Add testimonials to home page
2. Add pricing page
3. Add onboarding videos
4. SEO optimization

---

## Benefits of This Approach

### For Users
✅ **Clear mental model:** All work happens in team workspace
✅ **Less navigation confusion:** No duplicate features
✅ **Faster workflow:** Direct to workspace, less clicking
✅ **Better collaboration:** Obvious team context
✅ **Mobile-friendly:** Cleaner navigation hierarchy

### For Development
✅ **Simpler codebase:** One version of each feature
✅ **Easier permissions:** All checks are team-scoped
✅ **Better URL structure:** RESTful and semantic
✅ **Easier testing:** Clear contexts to test
✅ **Future-proof:** Easy to add team-level features

### For Business
✅ **Better onboarding:** Clear path from signup to value
✅ **Higher engagement:** Users stay in workspace
✅ **Clearer metrics:** Track team-level usage
✅ **Upsell opportunities:** Team plans, add-ons
✅ **Competitive positioning:** Matches industry leaders

---

## Comparison: Before vs After

### Before (Current State)

```
User logs in → Sees generic home page
  ├ Not sure where to go
  ├ Clicks "Film" (top nav)
  │   ├ Sees all games across all teams (confusing)
  │   └ "Which team is this for?"
  ├ Clicks "Teams"
  │   ├ Sees list of teams
  │   ├ Clicks team
  │   │   ├ Sees team page
  │   │   └ Clicks "Film" tab
  │   │       └ "Wait, is this different from /film?"
  └ Frustrated, unclear workflow
```

### After (Proposed State)

```
User logs in → Redirects to /teams/[teamId] (Bears Football)
  ├ Immediately in team context
  ├ Team name visible in header
  ├ All features scoped to current team
  ├ Clicks "Film" tab
  │   └ Sees Bears Football games only
  ├ Clicks "Playbook" tab
  │   └ Sees Bears playbook
  ├ Wants to switch to other team?
  │   └ Clicks team switcher → Selects "Lions Football"
  │       └ URL changes to /teams/[otherTeamId]
  │       └ All content updates to Lions
  └ Clear, consistent workflow
```

---

## Open Questions for Discussion

1. **Personal Playbooks:**
   - Should we allow personal (non-team) playbooks?
   - Use case: Coach building plays before creating team?
   - **Recommendation:** No. Force team creation first. Keeps model simple.

2. **Team Dashboard Content:**
   - What should `/teams/[teamId]` show?
   - Options:
     - Quick stats (record, recent games, upcoming)
     - Recent activity feed
     - Quick actions ("Upload film", "Build play")
   - **Recommendation:** Combination. Quick stats + recent activity + action cards.

3. **Team Switcher for Single-Team Users:**
   - Show team name but no dropdown?
   - Or hide completely if user only has one team?
   - **Recommendation:** Always show team name. Hide dropdown chevron if only one team.

4. **Onboarding Flow:**
   - Create team immediately after signup?
   - Or show "welcome" page first with tutorial?
   - **Recommendation:** Immediate team creation. Less friction. Tutorial can be in-app.

5. **Multi-Sport Future:**
   - Currently football-specific
   - If we add basketball, baseball, etc., how does this affect structure?
   - **Recommendation:** Keep team-first model. Add `sport` field to teams table. Team settings let you choose sport. Playbook builder adapts to sport.

---

## Recommended Next Steps

1. **Review this document** with team/stakeholders
2. **Create wireframes** for new home page and team switcher
3. **User testing** (if possible): Show proposed flow to 2-3 coaches
4. **Prioritize implementation:**
   - P0 (Must have): Middleware redirects, team switcher
   - P1 (Should have): Marketing home page, account settings
   - P2 (Nice to have): Onboarding tutorial, activity feed
5. **Phased rollout** (see Migration Plan above)

---

## Conclusion

The current application structure creates confusion by mixing top-level and team-scoped features. By adopting a **workspace-first architecture** aligned with industry best practices (Slack, Notion, Linear), we can:

- Provide a clearer mental model for users
- Reduce navigation complexity
- Improve onboarding and engagement
- Create a scalable foundation for future features

The proposed changes are **backward compatible** (can be phased in), **technically straightforward** (mostly routing and redirects), and **high-impact** (significantly improves UX).

**Recommendation: Proceed with implementation.**

---

*Document prepared by: Claude Code*
*Last updated: 2025-11-01*
