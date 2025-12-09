# Youth Coach Hub — Subscription System Implementation Specification

**Version:** 1.0  
**Last Updated:** December 8, 2025  
**Audience:** Claude Code Implementation

---

## Document Purpose

This specification defines the complete subscription and entitlements system for Youth Coach Hub, a commercial football coaching application. Claude Code should use this document as the authoritative reference when implementing the subscription infrastructure.

---

## Part 1: Context Overview

### Application Summary

Youth Coach Hub is a football coaching platform targeting high school and little league coaches. The application provides:

- Team and roster management
- Visual playbook creation (PlayBuilder)
- Game film upload and analysis with timestamp-based play tagging
- Opponent scouting
- Team and player analytics

### Technology Stack

- **Framework:** Next.js 15 with TypeScript
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (bucket: `game_videos`)
- **Payments:** Stripe
- **Styling:** Tailwind CSS with Apple-inspired aesthetic

### Design Philosophy

- Clean, minimal interfaces with generous whitespace
- Modular architecture for commercial scalability
- Centralized configuration as single source of truth
- Empathetic design for budget-conscious youth sports coaches

### Key Architectural Principle

**All entitlement logic must flow through a centralized Entitlements Service.** Features should never check subscription status directly—they query the entitlements service which interprets the user's tier and returns capabilities. This enables:

- Easy tier modifications without touching feature code
- Consistent enforcement across all features
- Clean upgrade/downgrade handling
- Future A/B testing of tier configurations

---

## Part 2: Tier Definitions

### The Three Tiers

| Attribute | Basic | Plus | Premium |
|-----------|-------|------|---------|
| **Display Name** | Basic | Plus | Premium |
| **Tagline** | Essential Game Planning | Full Season Workflow | Year-Round Performance |
| **Target User** | New coaches, small programs | Active coaches who scout opponents | Clubs, advanced programs |

### Game & Storage Limits

| Attribute | Basic | Plus | Premium |
|-----------|-------|------|---------|
| Active Games | 2 total (1 team + 1 opponent) | Unlimited (retention-based) | Unlimited (retention-based) |
| Retention Period | 30 days | 180 days | 365 days |
| Cameras per Game | 1 | 3 | 5 |

### Upload Token System

| Attribute | Basic | Plus | Premium |
|-----------|-------|------|---------|
| Monthly Tokens | 2 | 4 | 8 |
| Rollover Cap | 2 | 5 | 10 |
| Extra Token Purchase | Yes | Yes | Yes |

### Video Requirements (All Tiers)

| Requirement | Value |
|-------------|-------|
| Max Duration per Camera | 3 hours (10,800 seconds) |
| Max Resolution | 1080p |
| Max Frame Rate | 60 fps |
| Accepted Formats | .mp4 (required), others optional |

### AI Features

| Feature | Basic | Plus | Premium |
|---------|-------|------|---------|
| AI Chat | Included | Included | Included |
| AI Film Tagging | Future: Purchased credits only | Future: Monthly credit allocation | Future: High monthly credit allocation |

**Important:** AI Film Tagging is NOT launching with MVP. The system should include placeholder fields but the feature remains disabled. When it launches (target: before 2026 football season), it will use a credit-based system—never "unlimited."

### Non-Game Storage

All tiers receive unlimited storage for non-video assets (playbooks, documents, images).

---

## Part 3: Core Concepts

### 3.1 What is a "Game"?

A **Game** is a container entity representing a single football game. It can hold multiple camera angles (video files). 

**Game Properties:**
- Belongs to a team
- Has a type: "team" (your team's game) or "opponent" (scouting film)
- Has a date and opponent name
- Contains 0 to N camera files (based on tier limit)
- Expires after the tier's retention period
- All cameras in a game share the same expiration

### 3.2 What is an "Upload Token"?

An **Upload Token** is consumed when creating a new Game entity. 

**Token Rules:**
- Creating a new Game = 1 token consumed
- Adding additional cameras to an existing Game = 0 tokens
- Tokens refresh monthly on subscription billing date
- Unused tokens roll over up to the tier's cap
- Extra tokens can be purchased à la carte
- Purchased tokens do not expire with billing cycle (separate pool)

### 3.3 What is a "Camera"?

A **Camera** is a single video file attached to a Game. 

**Camera Properties:**
- Belongs to exactly one Game
- Has upload timestamp
- Has video metadata (duration, resolution, fps)
- Shares Game's expiration date
- Can have play tags associated with timestamps

### 3.4 Active vs. Expired vs. Locked Games

| Status | Description | User Can View | Analytics Available | Counts Against Limit |
|--------|-------------|---------------|---------------------|---------------------|
| Active | Within retention period | Yes | Yes | Yes |
| Expired | Past retention period | No | No | No (deleted) |
| Locked | Exceeds tier limits after downgrade | No | No | Yes (until deleted) |

---

## Part 4: Implementation Phases

---

### Phase 0: Trial Period Deactivation

**Goal:** Disable existing trial functionality without deleting it, allowing future reactivation.

#### Background

A trial period feature was previously built to allow new users to try the application. This needs to be deactivated for the initial commercial launch but preserved for potential future use.

#### Business Requirements

1. Trial signup option must not appear in UI
2. Trial-related code should remain in codebase (commented or feature-flagged)
3. Any existing trial users should be handled gracefully
4. Trial configuration should be switchable via database/config

#### Implementation Approach

**Option A: Feature Flag (Recommended)**
```
Add to platform_config or tier_config:
  trial_enabled: false
  trial_duration_days: 14 (preserved for future)
  trial_tier_key: 'basic' (which tier trials get)
```

All trial UI and logic checks this flag before displaying/executing.

**Option B: Environment Variable**
```
NEXT_PUBLIC_TRIALS_ENABLED=false
```

Simpler but requires redeploy to change.

#### What to Deactivate

1. **UI Elements:**
   - "Start Free Trial" buttons
   - Trial signup forms
   - Trial period countdown displays
   - "Trial ending soon" notifications

2. **Backend Logic:**
   - Trial creation endpoints (return 404 or "Trials not available")
   - Trial-to-paid conversion prompts
   - Trial expiration jobs (can remain but won't find anything)

3. **Stripe:**
   - If trial was handled via Stripe trial periods, ensure new subscriptions don't include trial_period_days

#### What to Preserve

- Database tables/columns for trial tracking
- Trial-related service functions (just don't call them)
- Trial UI components (just don't render them)
- Any trial analytics/reporting

#### Handling Existing Trial Users

**If any users are currently on trial:**
1. Option A: Let trials expire naturally, then require subscription
2. Option B: Convert to Basic tier with limited grace period
3. Option C: Grandfather them with a manual subscription

**Recommendation:** Option A is cleanest if trial count is low. Check database for active trials before deciding.

#### Files Likely Affected

```
/src/components/auth/ or /src/components/pricing/
  - Trial signup components (hide/disable)
  
/src/app/api/
  - Trial creation endpoints (disable or remove routes)
  
/src/lib/
  - Trial service functions (keep but don't invoke)
  
Database:
  - platform_config: add trial_enabled = false
  - subscriptions: status = 'trialing' users need handling
```

#### Acceptance Criteria

- [ ] No trial signup option visible in UI
- [ ] Trial creation API returns appropriate "not available" response
- [ ] Existing trial code preserved (not deleted)
- [ ] Feature flag or config controls trial availability
- [ ] Any existing trial users identified and plan documented
- [ ] Future reactivation requires only config change (not code deploy)

#### Commercial Considerations

- Trials may return after you validate pricing/conversion rates
- Keeping code intact reduces future development cost
- Clear "trials disabled" state prevents confusion during testing

---

### Phase 1: Tier Configuration Foundation

**Goal:** Establish the single source of truth for all tier definitions.

#### Business Requirements

1. All tier attributes must be queryable from a central configuration
2. Tier definitions must be easily modifiable without code changes
3. System must support future tiers without schema changes
4. Stripe price IDs must be linkable to tiers

#### Data Entities

**TierConfig Entity:**
```
tier_key: string (unique identifier: 'basic', 'plus', 'premium')
display_name: string
description: string
tagline: string

// Game Limits
max_active_games: integer | null (null = unlimited/retention-based)
max_team_games: integer | null (for Basic: 1)
max_opponent_games: integer | null (for Basic: 1)
retention_days: integer
max_cameras_per_game: integer

// Upload Tokens
monthly_upload_tokens: integer
token_rollover_cap: integer

// Video Requirements  
max_video_duration_seconds: integer (10800 for all)
max_resolution: string ('1080p')
max_fps: integer (60)

// AI Features
ai_chat_enabled: boolean (true for all)
ai_film_tagging_enabled: boolean (false for MVP)
ai_film_credits_monthly: integer (placeholder, 0 for MVP)

// Stripe Integration
stripe_price_id_monthly: string
stripe_price_id_yearly: string
price_monthly_cents: integer
price_yearly_cents: integer

// Metadata
sort_order: integer
is_active: boolean
```

#### Validation Rules

- tier_key must be unique and lowercase alphanumeric
- retention_days must be > 0
- max_cameras_per_game must be >= 1
- monthly_upload_tokens must be >= 1
- token_rollover_cap must be >= monthly_upload_tokens

#### Commercial Considerations

- Store Stripe price IDs in tier config for easy reference, but Stripe remains source of truth for actual pricing
- Include price_cents fields for display purposes (cache, not authoritative)
- is_active flag allows soft-deprecation of tiers without deletion

#### Acceptance Criteria

- [ ] Tier config table exists with all three tiers seeded
- [ ] Application can query tier config by tier_key
- [ ] Tier config includes all attributes from specification
- [ ] Changing a tier attribute in database reflects in application without code deploy

---

### Phase 2: Subscription Management

**Goal:** Track each team's subscription status and tier.

#### Business Requirements

1. Each team has exactly one subscription record
2. Subscription links to tier_config via tier_key
3. Subscription tracks Stripe relationship
4. Subscription status reflects Stripe webhook events
5. Support trial periods (future capability)

#### Data Entities

**Subscription Entity:**
```
id: uuid
team_id: uuid (foreign key to teams, unique)
tier_key: string (foreign key to tier_config)
status: enum ('trialing', 'active', 'past_due', 'canceled', 'none')

// Stripe References
stripe_customer_id: string
stripe_subscription_id: string
stripe_price_id: string

// Billing Period
current_period_start: timestamp
current_period_end: timestamp
trial_ends_at: timestamp | null
cancel_at_period_end: boolean

// Metadata
created_at: timestamp
updated_at: timestamp
```

#### Validation Rules

- team_id must be unique (one subscription per team)
- tier_key must reference valid tier_config
- status transitions must follow valid state machine:
  - none → trialing | active
  - trialing → active | canceled
  - active → past_due | canceled
  - past_due → active | canceled
  - canceled → active (re-subscribe)

#### Commercial Considerations

- Default new teams to 'none' status (no subscription)
- Consider whether to offer limited functionality at 'none' or require subscription
- past_due status allows grace period before feature lockout

#### Acceptance Criteria

- [ ] Subscription table exists with proper constraints
- [ ] New teams created without subscription (status: 'none')
- [ ] Subscription tier_key properly references tier_config
- [ ] Subscription status can be updated via Stripe webhooks

---

### Phase 3: Upload Token System

**Goal:** Implement token allocation, consumption, rollover, and purchase tracking.

#### Business Requirements

1. Tokens refresh monthly on billing cycle
2. Unused tokens roll over up to tier cap
3. Token balance = subscription tokens + purchased tokens
4. Purchased tokens tracked separately (don't expire with billing cycle)
5. Creating a game consumes 1 token from subscription pool first, then purchased

#### Data Entities

**TokenBalance Entity:**
```
id: uuid
team_id: uuid (foreign key, unique)

// Subscription Tokens (reset monthly)
subscription_tokens_available: integer
subscription_tokens_used_this_period: integer
period_start: timestamp
period_end: timestamp

// Purchased Tokens (separate pool)
purchased_tokens_available: integer

// Metadata
last_rollover_at: timestamp
created_at: timestamp
updated_at: timestamp
```

**TokenTransaction Entity (audit log):**
```
id: uuid
team_id: uuid
transaction_type: enum ('monthly_allocation', 'rollover', 'consumption', 'purchase', 'refund', 'admin_adjustment')
amount: integer (positive for credits, negative for debits)
balance_after: integer
source: enum ('subscription', 'purchased')
reference_id: string | null (game_id for consumption, stripe_id for purchase)
notes: string | null
created_at: timestamp
```

#### Token Lifecycle Logic

**Monthly Refresh (on billing cycle):**
```
1. Calculate rollover: min(subscription_tokens_available, tier.token_rollover_cap)
2. New balance = rollover + tier.monthly_upload_tokens
3. Cap at tier.token_rollover_cap + tier.monthly_upload_tokens (or just rollover_cap, TBD)
4. Reset subscription_tokens_used_this_period to 0
5. Update period_start/period_end
6. Log transaction
```

**Token Consumption (creating game):**
```
1. Check total available (subscription + purchased)
2. If total < 1, reject with "No tokens available"
3. Deduct from subscription_tokens_available first
4. If subscription = 0, deduct from purchased_tokens_available
5. Log transaction with game_id reference
```

**Token Purchase:**
```
1. Validate Stripe payment success
2. Add to purchased_tokens_available
3. Log transaction with stripe_payment_id reference
```

#### Validation Rules

- Cannot consume token if total available < 1
- Rollover cannot exceed tier's rollover_cap
- Purchased tokens are always separate from subscription tokens
- All token changes must create transaction log entry

#### Commercial Considerations

- Token transaction log enables support debugging and usage analytics
- Separate purchased pool prevents "use it or lose it" frustration
- Consider token expiration for purchased tokens (e.g., 1 year) - NOT for MVP
- Transaction log supports refund workflows

#### Acceptance Criteria

- [ ] Token balance table tracks subscription and purchased tokens separately
- [ ] Monthly refresh correctly calculates rollover
- [ ] Creating game consumes token and logs transaction
- [ ] Insufficient tokens prevents game creation with clear error
- [ ] Token purchase flow adds to purchased pool

---

### Phase 4: Game Container Architecture

**Goal:** Restructure games to be containers for multiple camera files.

#### Business Requirements

1. Game is a container entity with metadata
2. Cameras are child entities of Games
3. Camera count limited by tier
4. Game creation consumes token; camera addition does not
5. All cameras inherit game's expiration

#### Data Entities

**Game Entity (updated):**
```
id: uuid
team_id: uuid (foreign key)
game_type: enum ('team', 'opponent')

// Game Metadata
opponent_name: string
game_date: date
location: string | null
team_score: integer | null
opponent_score: integer | null
game_result: enum ('win', 'loss', 'tie') | null
notes: text | null

// Expiration
expires_at: timestamp (calculated: created_at + tier.retention_days)
is_locked: boolean (default false)
locked_reason: string | null

// Metadata
created_at: timestamp
updated_at: timestamp
```

**Camera Entity (new or renamed from videos):**
```
id: uuid
game_id: uuid (foreign key to games)
camera_label: string (e.g., 'End Zone', 'Sideline', 'Press Box')
camera_order: integer (for display sorting)

// Video File
storage_path: string
file_name: string
file_size_bytes: integer
mime_type: string

// Video Metadata
duration_seconds: integer
resolution_width: integer
resolution_height: integer
fps: integer

// Processing Status
upload_status: enum ('pending', 'processing', 'ready', 'failed')
thumbnail_url: string | null

// Metadata
uploaded_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### Validation Rules

**On Game Creation:**
- team_id must reference valid team
- game_type must be 'team' or 'opponent'
- If tier has max_active_games limit:
  - Count current active (non-expired, non-locked) games
  - If at limit, reject creation
- For Basic tier specifically:
  - Count team games (max 1) and opponent games (max 1) separately
- Must have available upload token
- Calculate expires_at from tier.retention_days

**On Camera Upload:**
- game_id must reference valid, non-expired, non-locked game
- Count existing cameras for game
- If count >= tier.max_cameras_per_game, reject
- Validate video metadata:
  - duration_seconds <= tier.max_video_duration_seconds
  - resolution <= 1080p (1920x1080)
  - fps <= tier.max_fps
- File format must be .mp4

#### Commercial Considerations

- Camera labeling (End Zone, Sideline, etc.) adds professional feel
- Video metadata validation prevents storage abuse
- Upload status enables async processing pipeline
- is_locked + locked_reason supports downgrade UX

#### Acceptance Criteria

- [ ] Games can be created as containers without immediate video
- [ ] Multiple cameras can be attached to single game
- [ ] Camera count respects tier limit
- [ ] Video validation rejects oversized/invalid files
- [ ] Game expiration calculated correctly per tier

---

### Phase 5: Video Upload Validation Service

**Goal:** Centralized validation of all video uploads before storage.

#### Business Requirements

1. Validate file format before upload begins
2. Validate video metadata after upload (or via client-side pre-check)
3. Reject non-compliant videos with clear error messages
4. Support future format expansion

#### Validation Pipeline

```
1. PRE-UPLOAD CHECKS (client-side):
   - File extension is .mp4
   - File size within Supabase limits (current: 100MB, may increase)
   - User has permission to upload to target game

2. UPLOAD TO STORAGE:
   - Stream to Supabase Storage
   - Generate unique storage path: {team_id}/{game_id}/{camera_id}.mp4

3. POST-UPLOAD VALIDATION:
   - Extract video metadata (ffprobe or similar)
   - Validate duration <= 10,800 seconds (3 hours)
   - Validate resolution <= 1920x1080
   - Validate fps <= 60
   - If validation fails: delete uploaded file, return error

4. FINALIZATION:
   - Update camera record with metadata
   - Generate thumbnail
   - Set upload_status = 'ready'
```

#### Error Messages (User-Friendly)

| Validation Failure | Error Message |
|-------------------|---------------|
| Wrong format | "Please upload an MP4 video file." |
| Too long | "Video must be 3 hours or less. Your video is X hours Y minutes." |
| Resolution too high | "Maximum resolution is 1080p. Please re-export your video at 1080p or lower." |
| FPS too high | "Maximum frame rate is 60fps. Your video is Xfps." |
| Camera limit reached | "Your plan allows up to X camera angles per game. Upgrade to add more angles." |
| No tokens | "You've used all your game uploads this month. Purchase additional uploads or wait until your next billing cycle." |

#### Commercial Considerations

- Client-side pre-validation improves UX (fail fast)
- Clear upgrade prompts on limit errors (not just rejections)
- Metadata extraction enables future analytics features
- Thumbnail generation improves film list UI

#### Acceptance Criteria

- [ ] .mp4 format enforced
- [ ] Duration validation works correctly
- [ ] Resolution validation works correctly  
- [ ] FPS validation works correctly
- [ ] Clear error messages displayed to user
- [ ] Failed uploads cleaned up from storage

---

### Phase 6: Entitlements Service

**Goal:** Centralized service that answers "can this team do X?"

#### Business Requirements

1. Single point of truth for all capability checks
2. Features never query subscription directly
3. Supports capability checks and limit queries
4. Returns actionable information (not just yes/no)

#### Service Interface

```typescript
interface EntitlementsService {
  // Capability checks
  canCreateGame(teamId: string, gameType: 'team' | 'opponent'): Promise<EntitlementResult>
  canAddCamera(teamId: string, gameId: string): Promise<EntitlementResult>
  canAccessGame(teamId: string, gameId: string): Promise<EntitlementResult>
  canUseAiChat(teamId: string): Promise<EntitlementResult>
  canUseAiFilmTagging(teamId: string): Promise<EntitlementResult>
  
  // Limit queries
  getGameLimits(teamId: string): Promise<GameLimits>
  getTokenBalance(teamId: string): Promise<TokenBalance>
  getCameraLimit(teamId: string): Promise<number>
  getVideoRequirements(teamId: string): Promise<VideoRequirements>
  
  // Usage queries
  getActiveGameCount(teamId: string): Promise<GameCount>
  getCamerasForGame(gameId: string): Promise<number>
  
  // Tier info
  getCurrentTier(teamId: string): Promise<TierInfo>
  getTierComparison(teamId: string): Promise<TierComparison>
}

interface EntitlementResult {
  allowed: boolean
  reason?: string // Why not allowed
  upgradeOption?: string // Which tier would allow this
  currentUsage?: number
  limit?: number
}

interface GameLimits {
  maxActiveGames: number | null // null = unlimited
  maxTeamGames: number | null
  maxOpponentGames: number | null
  retentionDays: number
  currentActiveGames: number
  currentTeamGames: number
  currentOpponentGames: number
}

interface TokenBalance {
  subscriptionAvailable: number
  purchasedAvailable: number
  totalAvailable: number
  monthlyAllocation: number
  rolloverCap: number
  periodEndsAt: Date
}

interface VideoRequirements {
  maxDurationSeconds: number
  maxResolutionWidth: number
  maxResolutionHeight: number
  maxFps: number
  acceptedFormats: string[]
}
```

#### Implementation Pattern

```typescript
// Example: Checking if team can create a game
async function canCreateGame(teamId: string, gameType: 'team' | 'opponent'): Promise<EntitlementResult> {
  // 1. Get team's subscription and tier
  const subscription = await getSubscription(teamId)
  if (subscription.status !== 'active') {
    return { allowed: false, reason: 'No active subscription' }
  }
  
  const tier = await getTierConfig(subscription.tier_key)
  
  // 2. Check token availability
  const tokens = await getTokenBalance(teamId)
  if (tokens.totalAvailable < 1) {
    return { 
      allowed: false, 
      reason: 'No upload tokens available',
      currentUsage: tokens.totalAvailable,
      limit: tier.monthly_upload_tokens
    }
  }
  
  // 3. Check game limits (if applicable)
  if (tier.max_active_games !== null) {
    const gameCount = await getActiveGameCount(teamId)
    
    if (gameType === 'team' && tier.max_team_games !== null) {
      if (gameCount.teamGames >= tier.max_team_games) {
        return {
          allowed: false,
          reason: 'Team game limit reached',
          upgradeOption: 'plus',
          currentUsage: gameCount.teamGames,
          limit: tier.max_team_games
        }
      }
    }
    
    if (gameType === 'opponent' && tier.max_opponent_games !== null) {
      if (gameCount.opponentGames >= tier.max_opponent_games) {
        return {
          allowed: false,
          reason: 'Opponent game limit reached',
          upgradeOption: 'plus',
          currentUsage: gameCount.opponentGames,
          limit: tier.max_opponent_games
        }
      }
    }
  }
  
  // 4. All checks passed
  return { allowed: true }
}
```

#### Commercial Considerations

- upgradeOption field enables contextual upsell prompts
- Usage/limit information supports progress indicators in UI
- Service abstraction allows A/B testing tier configurations
- Caching tier config improves performance

#### Acceptance Criteria

- [ ] Entitlements service implemented with all interface methods
- [ ] All feature code uses entitlements service (not direct subscription queries)
- [ ] EntitlementResult includes upgrade suggestions when appropriate
- [ ] Service correctly interprets all three tier configurations

---

### Phase 7: Stripe Integration

**Goal:** Bi-directional sync between Stripe and application subscription state.

#### Business Requirements

1. Users can subscribe via Stripe Checkout
2. Users can manage billing via Stripe Customer Portal
3. Webhook events update application state
4. Tier changes (upgrade/downgrade) handled correctly

#### Stripe Setup

**Products to Create:**
```
Product: Youth Coach Hub - Basic
  Price: $X/month (price_basic_monthly)
  Price: $Y/year (price_basic_yearly)
  
Product: Youth Coach Hub - Plus
  Price: $X/month (price_plus_monthly)
  Price: $Y/year (price_plus_yearly)
  
Product: Youth Coach Hub - Premium
  Price: $X/month (price_premium_monthly)
  Price: $Y/year (price_premium_yearly)

Product: Extra Upload Token
  Price: $X each (price_extra_token)
```

**Metadata on Stripe Products:**
```
tier_key: 'basic' | 'plus' | 'premium'
```

#### Webhook Events to Handle

| Event | Action |
|-------|--------|
| checkout.session.completed | Create/update subscription record |
| customer.subscription.created | Sync subscription details |
| customer.subscription.updated | Handle tier change, status change |
| customer.subscription.deleted | Set status to 'canceled' |
| invoice.payment_succeeded | Refresh tokens if new period |
| invoice.payment_failed | Set status to 'past_due' |

#### Upgrade Flow

```
1. User clicks "Upgrade to Plus" 
2. Create Stripe Checkout session for Plus price
3. User completes payment
4. Webhook: customer.subscription.updated
5. Update subscription.tier_key to 'plus'
6. Entitlements service now returns Plus capabilities
7. UI reflects new limits immediately
```

#### Downgrade Flow

```
1. User clicks "Downgrade to Basic" in Stripe Portal
2. Stripe schedules downgrade for period end (cancel_at_period_end pattern)
   OR immediate downgrade (prorate)
3. Webhook: customer.subscription.updated
4. If immediate: 
   a. Update subscription.tier_key to 'basic'
   b. Run downgrade enforcement (see Phase 8)
5. If scheduled:
   a. Set cancel_at_period_end = true
   b. Show user "Downgrading on [date]"
   c. Run enforcement when subscription.updated fires at period end
```

#### Commercial Considerations

- Use Stripe Customer Portal for billing management (reduces support burden)
- Store Stripe IDs in application for quick lookups
- Implement idempotent webhook handling
- Log all webhook events for debugging

#### Acceptance Criteria

- [ ] Stripe products created with correct metadata
- [ ] Checkout flow creates subscription
- [ ] Webhook handler processes all required events
- [ ] Upgrade immediately reflects in entitlements
- [ ] Downgrade triggers enforcement logic

---

### Phase 8: Downgrade and Expiration Enforcement

**Goal:** Handle tier changes and game expiration gracefully.

#### Business Requirements

1. Games exceeding new tier limits are locked
2. Locked games show clear messaging
3. Games past retention are expired/deleted
4. Re-upgrade unlocks games within retention window

#### Downgrade Enforcement Logic

**When user downgrades (e.g., Plus → Basic):**

```
1. Get new tier limits:
   - Basic: 2 active games (1 team, 1 opponent), 30-day retention, 1 camera

2. Identify games to lock:
   a. Get all active (non-expired) games for team
   b. Sort by created_at DESC (keep newest)
   c. For Basic: Keep newest 1 team game, newest 1 opponent game
   d. Mark all others as: is_locked = true, locked_reason = 'downgrade_excess'

3. Handle camera excess (edge case):
   a. If any kept game has > 1 camera (new Basic limit)
   b. Lock excess cameras OR lock entire game
   c. Recommendation: Lock entire game with reason 'camera_limit_exceeded'

4. Recalculate expiration:
   a. Update expires_at for all games based on new retention period
   b. Any game now past expiration → schedule for deletion
```

#### Expiration Enforcement (Scheduled Job)

**Run daily (or hourly):**

```
1. Find all games where expires_at < NOW() AND deleted_at IS NULL
2. For each expired game:
   a. Delete all camera files from storage
   b. Delete camera records
   c. Soft-delete game (set deleted_at) OR hard-delete
   d. Log deletion
```

#### Re-Upgrade Unlocking

**When user upgrades (e.g., Basic → Plus):**

```
1. Find all locked games for team where:
   - is_locked = true
   - expires_at > NOW() (still within ANY retention window)
   
2. For each locked game:
   - Check if game would be within new tier limits
   - If yes: is_locked = false, locked_reason = null
   - Recalculate expires_at based on new tier retention

3. Note: Games already deleted cannot be recovered
```

#### Locked Game UI

```
- Grayed out in game list
- Click shows modal: "This game is locked. Upgrade to [tier] to access."
- No video playback
- No analytics
- No play tagging
- Shows expiration countdown: "Will be deleted in X days"
```

#### Commercial Considerations

- Grace period before deletion (e.g., 7 days after lock) gives upgrade opportunity
- Clear upgrade prompts on locked content
- Consider email notification when games are locked/approaching deletion
- Soft-delete pattern allows support recovery in edge cases

#### Acceptance Criteria

- [ ] Downgrade locks excess games
- [ ] Locked games show appropriate UI messaging
- [ ] Expiration job deletes old games and files
- [ ] Re-upgrade unlocks eligible games
- [ ] No data loss bugs (games deleted prematurely)

---

### Phase 9: UI Components

**Goal:** User-facing components for subscription management and usage display.

#### Required Components

**1. Pricing Page**
- Display all three tiers with feature comparison
- Highlight recommended tier (Plus)
- Show current tier if subscribed
- Upgrade/downgrade CTAs
- Apple-aesthetic: clean cards, generous whitespace

**2. Usage Dashboard (in Settings or Team page)**
```
┌─────────────────────────────────────────┐
│ Your Plan: Plus                         │
│ Next billing: January 8, 2026           │
├─────────────────────────────────────────┤
│ Game Uploads                            │
│ ████████░░░░░░░░ 3 of 4 this month     │
│ + 2 rollover available                  │
│ [Buy More Uploads]                      │
├─────────────────────────────────────────┤
│ Active Games                            │
│ 7 games · 143 days average remaining    │
├─────────────────────────────────────────┤
│ Storage                                 │
│ 12.4 GB used                            │
└─────────────────────────────────────────┘
```

**3. Upgrade Prompts (Contextual)**
- When hitting game limit: "Upgrade to Plus for unlimited games"
- When hitting camera limit: "Upgrade to add more camera angles"
- When token exhausted: "Get more uploads" modal with purchase option

**4. Game Card States**
```
Active: Normal display
Expiring Soon (≤7 days): Yellow badge "Expires in X days"
Locked: Grayed out with lock icon, "Upgrade to unlock"
```

**5. Upload Flow Enhancement**
- Show remaining tokens before upload
- Camera angle selector (if tier allows multiple)
- Video requirements reminder
- Progress indicator with validation status

#### Commercial Considerations

- Upgrade prompts should feel helpful, not naggy
- Show value of upgrade (what they gain), not just limits
- One-click upgrade flow (pre-fill current context)
- Usage dashboard builds awareness without alarming

#### Acceptance Criteria

- [ ] Pricing page displays all tiers accurately
- [ ] Usage dashboard shows real-time token/game counts
- [ ] Upgrade prompts appear at appropriate moments
- [ ] Game cards reflect lock/expiration status
- [ ] Upload flow validates against tier requirements

---

### Phase 10: Future-Proofing for AI Film Tagging

**Goal:** Infrastructure placeholders for AI features launching before 2026 season.

#### What to Build Now

1. **Database fields** (disabled):
   - tier_config: ai_film_tagging_enabled (false), ai_film_credits_monthly (0)
   - Placeholder for ai_credits table structure

2. **Entitlements service method** (returns false):
   - canUseAiFilmTagging(teamId) → { allowed: false, reason: 'Coming soon' }

3. **UI placeholder**:
   - "AI Film Tagging - Coming 2026" badge on pricing page
   - Grayed out feature in feature list

#### What NOT to Build Now

- Actual tagging logic
- Credit consumption tracking
- Purchase flow for AI credits
- Any AI model integration

#### AI Credits Concept (For Future Reference)

When AI Film Tagging launches:
- Basic: Purchase credits only (no monthly allocation)
- Plus: X credits/month included
- Premium: Y credits/month included (higher than Plus, but NOT unlimited)

**Credit = one video processed for auto-tagging**

This will require:
- ai_credits table (similar to upload tokens)
- Credit consumption on tagging request
- Credit purchase flow
- Usage display in dashboard

#### Commercial Considerations

- "Coming soon" creates anticipation without commitment
- Credit-based model (not unlimited) protects margins on AI costs
- Separate credit pool from upload tokens (different value props)

#### Acceptance Criteria

- [ ] Database has placeholder fields for AI features
- [ ] Entitlements service has AI method (returns disabled)
- [ ] Pricing page shows "Coming 2026" for AI tagging
- [ ] No actual AI functionality implemented

---

## Part 5: Implementation Checklist

### Phase 0: Trial Deactivation
- [ ] Identify all trial-related UI components
- [ ] Add trial_enabled feature flag to config (set to false)
- [ ] Hide/disable trial signup buttons and forms
- [ ] Update trial API endpoints to return "not available"
- [ ] Check for existing trial users and document handling plan
- [ ] Verify no trial options visible in production UI

### Database Changes
- [ ] Create tier_config table
- [ ] Seed Basic, Plus, Premium tiers
- [ ] Create/update subscriptions table
- [ ] Create token_balance table
- [ ] Create token_transactions table
- [ ] Update games table (add expires_at, is_locked, locked_reason)
- [ ] Create cameras table (or rename videos)
- [ ] Add RLS policies for all new tables

### Backend Services
- [ ] Implement EntitlementsService
- [ ] Implement TokenService (allocation, consumption, rollover)
- [ ] Implement VideoValidationService
- [ ] Implement GameExpirationJob
- [ ] Implement DowngradeEnforcementService

### Stripe Integration
- [ ] Create Stripe products and prices
- [ ] Implement checkout session creation
- [ ] Implement customer portal session
- [ ] Implement webhook handler for all events
- [ ] Map Stripe price IDs to tier_config

### API Routes
- [ ] GET /api/entitlements (current user's capabilities)
- [ ] GET /api/subscription (current subscription details)
- [ ] POST /api/subscription/checkout (initiate Stripe checkout)
- [ ] POST /api/subscription/portal (get portal URL)
- [ ] POST /api/tokens/purchase (buy extra tokens)
- [ ] POST /api/games (create game, consume token)
- [ ] POST /api/games/[id]/cameras (upload camera)

### UI Components
- [ ] PricingPage with tier comparison
- [ ] UsageDashboard component
- [ ] UpgradePrompt component (reusable)
- [ ] GameCard with status states
- [ ] UploadFlow with validation
- [ ] LockedGameModal

### Testing
- [ ] Unit tests for EntitlementsService
- [ ] Unit tests for TokenService
- [ ] Integration tests for Stripe webhooks
- [ ] E2E test: new user → subscribe → upload → hit limit → upgrade
- [ ] E2E test: downgrade → games locked → re-upgrade → unlocked

---

## Part 6: Reference Data

### Tier Matrix (Quick Reference)

| | Basic | Plus | Premium |
|---|---|---|---|
| Active Games | 2 (1+1) | ∞ | ∞ |
| Retention | 30 days | 180 days | 365 days |
| Cameras/Game | 1 | 3 | 5 |
| Monthly Tokens | 2 | 4 | 8 |
| Rollover Cap | 2 | 5 | 10 |
| Max Duration | 3h | 3h | 3h |
| Max Resolution | 1080p | 1080p | 1080p |
| Max FPS | 60 | 60 | 60 |
| AI Chat | ✓ | ✓ | ✓ |
| AI Film Tagging | Future: $ | Future: Credits | Future: More Credits |

### Status Enums

**Subscription Status:** trialing, active, past_due, canceled, none

**Game Status (derived):** active, expiring_soon, locked, expired

**Upload Status:** pending, processing, ready, failed

**Token Transaction Type:** monthly_allocation, rollover, consumption, purchase, refund, admin_adjustment

---

## Part 7: Notes for Claude Code

### Priority Order

Implement in this order to maintain working state throughout:

0. **Phase 0:** Trial deactivation (clean slate before new system)
1. **Phase 1 + 2:** Tier config and subscriptions (foundation)
2. **Phase 6:** Entitlements service (other phases depend on this)
3. **Phase 3:** Token system
4. **Phase 4 + 5:** Game/camera architecture with validation
5. **Phase 7:** Stripe integration
6. **Phase 8:** Downgrade/expiration logic
7. **Phase 9:** UI components
8. **Phase 10:** AI placeholders

### Key Files to Create/Modify

```
/src/lib/entitlements/
  entitlements-service.ts
  token-service.ts
  video-validation-service.ts

/src/lib/stripe/
  stripe-client.ts
  webhook-handler.ts
  checkout.ts
  portal.ts

/src/app/api/
  entitlements/route.ts
  subscription/route.ts
  subscription/checkout/route.ts
  subscription/portal/route.ts
  tokens/purchase/route.ts
  games/route.ts
  games/[id]/cameras/route.ts

/src/components/subscription/
  PricingPage.tsx
  UsageDashboard.tsx
  UpgradePrompt.tsx
  
/src/components/film/
  GameCard.tsx (update)
  UploadFlow.tsx (update)
  LockedGameModal.tsx
```

### Configuration Pattern

All tier data should come from the database tier_config table, but for type safety, create a TypeScript interface that mirrors the structure:

```typescript
// /src/types/subscription.ts
interface TierConfig {
  tierKey: 'basic' | 'plus' | 'premium'
  displayName: string
  // ... all fields
}
```

### Testing Strategy

- Mock Stripe in development (use test mode keys)
- Create seed scripts for test scenarios
- Build admin tools to manually adjust subscriptions for testing

---

*End of Specification*