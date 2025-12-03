# Coach-Focused Application Vision
## Youth Coach Hub - Coaching Staff Productivity Platform

**Date:** 2025-11-01
**Core Vision:** Help coaches be more effective in preparation activities so they have the resources and actionable insights to be better coaches when working with players.

---

## Target Audience Clarity

### PRIMARY USERS (Who We Build For)
✅ **Head Coach** - Team leader, owns playbook, makes game plans
✅ **Assistant Coaches** - Offensive/defensive coordinators, position coaches
✅ **Analysts** - Tag film, track stats (high school programs)
✅ **Graduate Assistants** - Support staff (if HS/youth program has them)

### NOT PRIMARY USERS (Out of Scope)
❌ **Players** - They execute the plays, don't need to use the app
❌ **Parents** - No communication, availability, or payment features
❌ **Fans** - No public-facing content or highlights

### FOCUS AREAS

**What Coaches Do AWAY from Players:**
1. **Film Study** - Watch game/practice film, identify tendencies
2. **Play Design** - Build playbook, design new plays
3. **Game Planning** - Create game-specific play sheets, wristbands
4. **Analytics** - Understand what's working, adjust strategy
5. **Scouting** - Study opponent tendencies (future feature)
6. **Practice Planning** - Design drills, set practice schedule (future)

**What Coaches Do WITH Players (Out of Scope for App):**
- Running practice
- Teaching plays
- Giving feedback
- Building relationships
- Motivating players

---

## Revised Competitive Landscape

### Apps We Should Compare Against

#### ✅ RELEVANT COMPARISONS (Coach Preparation Tools)

**1. Hudl (Film Analysis)**
- **Focus:** Film breakdown, tagging, tendencies
- **Users:** Coaching staff only (players have separate "Hudl Highlights" app)
- **Value:** Actionable insights from film study
- **What we adopt:** Film tagging, analytics, game context

**2. Hudl IQ (Play Diagramming - Discontinued but relevant)**
- **Focus:** Digital playbook, play design
- **Users:** Coaching staff
- **Value:** Faster play creation than paper
- **What we adopt:** Digital playbook builder concept

**3. XOS Digital (Playbook Management)**
- **Focus:** Digital playbooks, game planning
- **Users:** Coaching staff
- **Value:** No more paper, easy updates
- **What we adopt:** Playbook organization, wristband printing

**4. Krossover (Film + Analytics)**
- **Focus:** Automated film breakdown, analytics
- **Users:** Coaching staff
- **Value:** Save time on film tagging
- **What we adopt:** Analytics-driven insights

**5. General Productivity Apps (Workspace Model)**
- **Notion** - Coach can organize scouting reports, notes
- **Linear** - Track tasks for coaching staff
- **Slack** - Staff communication (but we don't need this feature)

#### ❌ NOT RELEVANT COMPARISONS (Team Management Tools)

**TeamSnap** - Parent communication, availability, payments → ❌ Not our focus
**SportsEngine** - League management, registration → ❌ Not our focus
**TeamLinkt** - Parent messaging, photos → ❌ Not our focus

---

## Revised Application Purpose

### The "Coach's Office" Metaphor

Think of Youth Coach Hub as the **digital coach's office** where the coaching staff:

```
PHYSICAL COACH'S OFFICE               THE COACH HUB
─────────────────────────────────────────────────────────
Whiteboard with plays           →     Digital playbook builder
Filing cabinet of game film     →     Film library & tagging
Clipboard with stats            →     Analytics dashboard
Laminated play sheets           →     Printable wristbands
Stack of opponent film          →     Opponent game tagging
Practice plan notebook          →     (Future feature)
```

**Key Insight:** Players never enter the coach's office to use these tools. Coaches do the work here, then bring the results (plays, game plan) to practice.

---

## Feature Prioritization (Aligned with Vision)

### CORE FEATURES (Coach Productivity)

**1. Digital Playbook Builder** ⭐ UNIQUE DIFFERENTIATOR
- **Purpose:** Faster play design than paper
- **User:** Head coach, coordinators
- **Value:**
  - Design plays in minutes, not hours
  - Standardized notation (no sloppy drawings)
  - Easy to update, no re-printing entire playbook
  - Share with staff instantly
- **Output:** Wristband cards, coach sheets, iPad references

**2. Film Library & Tagging** ⭐ TIME SAVER
- **Purpose:** Organize game film, tag plays for review
- **User:** All coaching staff
- **Value:**
  - Find "all 3rd downs" in 2 clicks vs. 30 minutes of scrubbing
  - Identify tendencies ("We run right on 1st down 65% of the time")
  - Build highlight reels for specific situations
  - Tag opponent film to prepare game plan
- **Output:** Actionable insights ("Their defense blitzes on 3rd & long")

**3. Analytics Dashboard** ⭐ INSIGHT DRIVER
- **Purpose:** See what's working, what's not
- **User:** Head coach, coordinators
- **Value:**
  - "Our pass plays on 1st down have 72% success rate"
  - "We're only 22% on 3rd & 7+, need shorter passing concepts"
  - "Red zone TD rate is 45%, league average is 58%"
  - Data-driven adjustments to game plan
- **Output:** Charts, reports, coaching decisions

**4. Game Planning** ⭐ GAME-DAY PREP
- **Purpose:** Build game-specific play selection
- **User:** Head coach, coordinators
- **Value:**
  - Select 15-20 plays for this week's game plan
  - Print wristbands with play numbers
  - Print coach sheets with formations
  - Organize by situation (short yardage, red zone, 2-minute)
- **Output:** Physical wristbands, coach call sheets

**5. Roster Management** (Supporting Feature)
- **Purpose:** Track who plays what positions
- **User:** Coaches (NOT parents/players)
- **Value:**
  - Depth chart for personnel decisions
  - Know who can play multiple positions
  - Substitute players in play diagrams
- **Output:** Depth chart for coaches, not a "team roster" for parents

**6. Schedule** (Supporting Feature)
- **Purpose:** Know when games are, organize film by game
- **User:** Coaches
- **Value:**
  - Context for film ("Week 5 vs. Lions")
  - Prepare for upcoming opponent
- **Output:** Calendar for coaching staff prep

### OUT OF SCOPE (Not Coach Preparation)

❌ **Parent Communication** - Use GroupMe, text, email
❌ **Player Messaging** - Coaches text players directly
❌ **Attendance Tracking** - Coaches take attendance on paper/clipboard
❌ **Availability ("Who can make practice?")** - Handle via text
❌ **Team Photos/Social** - Use Facebook, Instagram
❌ **Payment Processing** - Not relevant to coaching preparation
❌ **Fan Highlights** - Players can use Hudl Highlights separately

---

## Revised Application Flow (Coach-Focused)

### User Journey: Head Coach (Owner)

```
MONDAY (After Weekend Game)
1. Login → /teams/bears-football/film
2. Upload game film from Saturday
3. Tag plays while watching film
   - Down, distance, formation, result
   - "3rd & 6, Shotgun Spread, Pass, +8 yards, First Down"
4. Tags auto-generate analytics

TUESDAY (Film Review with Staff)
1. Login → /teams/bears-football/analytics
2. Review what worked:
   - "Our run game averaged 5.8 YPC - excellent"
   - "But 0% success on 3rd & 5+, need better pass concepts"
3. Identify adjustments for next game

WEDNESDAY (Game Planning)
1. Login → /teams/bears-football/playbook
2. Design 2 new pass plays for 3rd & medium
3. Tag plays as "vs. Tigers game plan"
4. Add to this week's wristband

THURSDAY (Practice Prep)
1. Login → /teams/bears-football/playbook/wristband
2. Print wristbands with 18 plays
3. Print coach sheets with formations/assignments
4. Bring physical materials to practice

FRIDAY (Opponent Prep)
1. Login → /teams/bears-football/film
2. Watch Tigers film (uploaded from Hudl exchange)
3. Tag their tendencies:
   - "They blitz Cover 0 on 3rd & 7+"
   - "They run power left 60% in red zone"
4. Adjust game plan based on scouting

SATURDAY (Game Day)
Coaches use PHYSICAL wristbands/sheets at game
(App is not used during game - this is player interaction time)
```

### User Journey: Assistant Coach (Invited)

```
1. Receives email: "You've been invited to join Bears Football coaching staff"
2. Click link → Sign up
3. Redirect → /teams/bears-football (team workspace)
4. Head coach has already:
   - Uploaded film
   - Built playbook
   - Set up roster
5. Assistant coach can:
   - Tag film (save head coach time)
   - View analytics (see what's working)
   - View playbook (study plays)
   - Cannot: Delete plays, change settings (role = Coach, not Owner)

Use case: "Offensive coordinator tags all offensive plays,
          Defensive coordinator tags all defensive plays,
          Splits the film study workload"
```

---

## Comparison: What Hudl Does vs. What We Do

### Hudl's Model (Two Separate Apps)

**Hudl Coach (Desktop/iPad)** - For coaching staff
- Upload film
- Tag plays
- Build highlights
- Analytics
- **Users:** Coaches only

**Hudl Highlights (Mobile)** - For players
- View personal highlights
- Share to social media
- Recruiting profiles
- **Users:** Players, parents, fans

### Our Model (Single App, Coach-Only)

**Youth Coach Hub** - For coaching staff
- Film library & tagging (like Hudl Coach)
- Analytics (like Hudl Coach)
- **PLUS:** Digital playbook builder (Hudl doesn't have this!)
- **PLUS:** Game plan wristbands (Hudl doesn't have this!)
- **Users:** Coaches only

**We DON'T build a "player app"** - That's out of scope

---

## Revised User Roles (Coach-Focused)

### Role Hierarchy

**1. Owner (Head Coach)**
- Create team
- Invite staff
- Full access to all features
- Can delete team, remove coaches
- **Use case:** Head coach who runs the program

**2. Coach (Assistant Coach, Coordinators)**
- Tag film
- View analytics
- View playbook (read-only OR edit, configurable)
- Cannot: Invite/remove staff, delete team, change tier
- **Use case:** Offensive coordinator, defensive coordinator, position coaches

**3. Analyst (Film Analyst, Graduate Assistant)**
- Tag film
- View analytics (read-only)
- View playbook (read-only)
- Cannot: Edit playbook, change settings
- **Use case:** High school programs with dedicated film person

### NO PLAYER/PARENT ROLES

❌ We do not have "Player" or "Parent" user types
❌ Players don't log into the app
❌ Parents don't receive notifications from the app

**Rationale:** This is a coach productivity tool, not a team communication platform.

---

## Feature Comparison (Aligned with Vision)

| Feature | Hudl | XOS | Krossover | TeamSnap | **Youth Coach Hub** | **Priority** |
|---------|------|-----|-----------|----------|-----------|--------------|
| Film upload & storage | ✅ | ✅ | ✅ | ❌ | ✅ | **P0** |
| Film tagging | ✅ | ✅ | ✅ | ❌ | ✅ | **P0** |
| Analytics/stats | ✅ | ⚠️ | ✅ | ❌ | ✅ | **P0** |
| Digital playbook builder | ❌ | ✅ | ❌ | ❌ | ✅ | **P0** ⭐ |
| Game plan wristbands | ❌ | ✅ | ❌ | ❌ | ✅ | **P0** ⭐ |
| Multi-coach collaboration | ✅ | ✅ | ✅ | ⚠️ | ✅ | **P0** |
| Opponent scouting | ✅ | ✅ | ✅ | ❌ | ✅ | **P1** |
| Player highlights (for recruiting) | ✅ | ❌ | ⚠️ | ❌ | ❌ | **Out of scope** |
| Parent communication | ❌ | ❌ | ❌ | ✅ | ❌ | **Out of scope** |
| Team messaging | ❌ | ❌ | ❌ | ✅ | ❌ | **Out of scope** |
| Attendance tracking | ❌ | ❌ | ❌ | ✅ | ❌ | **Out of scope** |

---

## Revised Navigation (Coach Workspace)

### Global Header
```
[Logo] Youth Coach Hub    [Bears Football ▼]    [@Coach]
                            Coaching Staff
```

**Team Switcher:**
```
┌────────────────────────────┐
│ Bears Football (Owner)  ✓  │  ← Current team
│ Lions Youth (Coach)        │  ← Another team they coach
├────────────────────────────┤
│ + Create New Team          │
└────────────────────────────┘
```

### Team Navigation (Coach-Focused Tabs)
```
Schedule  Playbook  Film  Players  Analytics  Settings
```

**Tab Purposes:**

1. **Schedule** - Games list for film organization context
2. **Playbook** - Build plays, create game plans, print wristbands
3. **Film** - Upload, tag, review game/practice film
4. **Players** - Roster, depth chart (for coaches, not parents)
5. **Analytics** - What's working, what needs adjustment
6. **Settings** - Invite coaches, set tier, team info

---

## Team Dashboard (Coach-Focused)

### Purpose: "Mission Control" for Coaching Staff

```
┌─────────────────────────────────────────────────────────┐
│ BEARS FOOTBALL - COACHING STAFF DASHBOARD        5-2    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  COACHING PREP STATUS                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   42    │  │   12    │  │   38    │  │   85%   │    │
│  │ Plays   │  │ Film    │  │ Plays   │  │ Tagged  │    │
│  │ in Book │  │ Uploaded│  │ Tagged  │  │ This Wk │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                         │
│  NEXT GAME PREP                                         │
│  Friday, Nov 8 @ 7:00 PM vs Tigers                      │
│  ┌────────────────────────────────────────────┐         │
│  │ ✅ Tigers film uploaded (3 games)          │         │
│  │ ⏳ Tendencies tagged (60% complete)        │         │
│  │ ⏳ Game plan wristband (12/18 plays)       │         │
│  │ ❌ Practice plan not created               │         │
│  └────────────────────────────────────────────┘         │
│  [Finish Scouting] [Build Game Plan]                   │
│                                                         │
│  STAFF ACTIVITY (This Week)                             │
│  • Coach Smith tagged 15 plays in vs. Lions            │
│  • Coach Johnson added 3 new run concepts              │
│  • You uploaded Tigers game film (Week 3)              │
│                                                         │
│  COACHING INSIGHTS (Last 3 Games)                       │
│  📈 Success Rate: 54% (up from 48%)                     │
│  ⚠️  3rd Down Conv: 28% (league avg: 38%)              │
│  ✅ Red Zone TD: 67% (excellent)                        │
│  [View Full Analytics]                                 │
│                                                         │
│  QUICK ACTIONS                                          │
│  [+ Upload Film] [+ Build Play] [+ Print Wristband]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Difference from TeamSnap-style Dashboard:**
- ❌ No "Who's attending practice?"
- ❌ No "Parent messages"
- ❌ No "Team photos"
- ✅ Focus on coaching prep status
- ✅ Focus on game planning progress
- ✅ Focus on actionable insights

---

## Value Proposition (Aligned with Vision)

### For Head Coaches

**Problem:**
- Spend 10+ hours/week on admin tasks (drawing plays, organizing film, calculating stats)
- Less time actually coaching players
- Hard to identify what's working without hours of film review

**Solution (Youth Coach Hub):**
- Build digital playbook in 1/3 the time vs. hand-drawing
- Tag film in real-time, find tendencies instantly
- Auto-generated analytics show what to adjust
- **Result:** Save 6 hours/week, more effective coaching with players

### For Assistant Coaches

**Problem:**
- Head coach does all the work, assistants feel disconnected
- No visibility into game plan or analytics
- Can't help with film breakdown (don't have access)

**Solution (Youth Coach Hub):**
- Invited to team workspace, can tag film to help head coach
- View analytics together, collaborative game planning
- Everyone on same page with digital playbook
- **Result:** Coaching staff works as unit, better preparation

### For Program Directors / Athletic Directors

**Problem:**
- Want coaches focused on developing players, not admin work
- Need coaches to use data to improve, not just "gut feel"
- Hard to track coaching staff effectiveness

**Solution (Youth Coach Hub):**
- Coaches spend less time on admin, more on player development
- Data-driven decisions improve win rate and player growth
- Can see coaching activity (film tagging, play development)
- **Result:** Better coaching quality, better player outcomes

---

## Messaging & Marketing (Aligned with Vision)

### Home Page (Logged Out)

**Hero:**
> "The Digital Coach's Office for Football"
>
> Save 6 hours per week on film study and play design.
> Get back to what matters—coaching your players.

**Value Props:**
1. **Digital Playbook Builder**
   "Design plays in minutes, not hours. No more hand-drawing 50 plays."

2. **Film Tagging & Analytics**
   "Find 'all 3rd downs' in 2 clicks. See what's working. Adjust faster."

3. **Game Plan Wristbands**
   "Print wristbands and coach sheets in seconds. No more laminating."

**CTA:** "Start Coaching Smarter" (not "Sign Up Free")

**Testimonial (Example):**
> "I used to spend 8 hours every Sunday drawing plays and watching film.
> Now I do it in 2 hours and have data to back up my decisions.
> I'm a better coach because I have more time to focus on my players."
>
> — Coach Mike Johnson, Bears Youth Football

### Pricing Page (Future)

**Tiers aligned with coaching needs:**

**Little League Tier** ($29/month)
- 1 team
- 2 coaches
- Basic playbook (20 plays)
- Basic film tagging
- Basic analytics

**High School Basic** ($79/month)
- 1 team
- 5 coaches
- Unlimited playbook
- Advanced film tagging
- Drive analytics
- Player attribution

**High School Advanced** ($149/month)
- 1 team
- Unlimited coaches
- Everything in Basic
- Opponent scouting
- OL/Defensive player tracking
- Practice planning (future)

**NOT team communication pricing** (e.g., "$5/player" like TeamSnap)

---

## Implementation Changes (Based on Vision)

### What Stays the Same
✅ Team-first URL structure (`/teams/[teamId]/feature`)
✅ TeamSwitcher in header
✅ Multi-coach collaboration
✅ Film, playbook, analytics features

### What Changes

**1. Remove Player/Parent Features**
❌ Delete any planned "parent communication" features
❌ Delete any "player profiles" for recruiting
❌ Delete any "team messaging" features
✅ Keep roster (for depth chart), but it's for coaches, not parents

**2. Simplify Team Settings**
- User roles: Owner, Coach, Analyst (not Player, Parent)
- Invitation flow: "Invite Coach" (not "Invite Player/Parent")
- Team info: Name, level, colors (not parent contact info)

**3. Focus Dashboard on Coaching Prep**
- Quick stats about coaching work (plays built, film tagged)
- Next game prep checklist
- Staff activity feed
- NOT: Player availability, parent messages, team photos

**4. Marketing Messaging**
- Target: Coaches, athletic directors
- NOT: Parents looking for team management
- Emphasize: Coaching productivity, preparation, insights
- NOT: Communication, payments, availability

---

## Questions for Clarification

1. **Practice Film:** Do coaches want to upload/tag practice film, or just game film?
   - If yes → Same tagging as game film, just mark as "practice"
   - If no → Film feature is game-only

2. **Opponent Film:** Do coaches upload opponent film, or just their own?
   - If yes → Tag opponent plays for scouting
   - If no → Film feature is own team only

3. **Multi-Sport:** You mentioned football focus. Stick with football only?
   - If yes → Keep football-specific terminology
   - If no → Make generic "sport" field for future

4. **Practice Planning:** Future feature or not needed?
   - Coaches design drills, practice schedule
   - Or is that outside scope of "preparation for games"?

5. **Recruiting:** High school coaches want player highlight reels?
   - If yes → Add "Create Highlight Reel" from tagged plays
   - If no → Stay focused on game planning only

---

## Final Recommendation

**Proceed with coach-focused, preparation-oriented architecture:**

✅ **Keep:** Team-first URLs, multi-coach, film/playbook/analytics
✅ **Remove:** Any player/parent features, team communication
✅ **Focus:** "Digital coach's office" where staff prepares for games
✅ **Value prop:** Save time on admin, get insights, be better coach

**This is a BETTER, more focused product than trying to be "Hudl + TeamSnap combined".**

- Clear target audience (coaches)
- Clear use case (preparation, not communication)
- Clear differentiation (playbook builder + film in one app)
- Simpler to build (no parent features to worry about)
- Easier to market ("Coaching productivity" vs. "Team management")

---

*Document updated: 2025-11-01*
*Vision: Coach productivity tool, not team communication platform*
