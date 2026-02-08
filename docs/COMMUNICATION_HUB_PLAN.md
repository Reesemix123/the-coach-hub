# Communication Hub — Complete Implementation Plan (Revised)

## Document Purpose

This is the comprehensive implementation plan for building the Communication Hub module within Youth Coach Hub. It incorporates all architectural decisions, database schema, integration specifications, business rules, and implementation phases. This document reflects decisions made during the planning review session.

---

## 1. Overview

### What Is Communication Hub?

Communication Hub is a new module within Youth Coach Hub that enables coaches to communicate with parents, share video content, publish player reports, and coordinate team logistics (schedules, RSVPs, locations). It is the intersection of TeamSnap's coordination features with Youth Coach Hub's existing film analysis and reporting capabilities.

### Why It Matters

No competitor combines team communication with integrated film/video sharing. TeamSnap doesn't do film. Hudl doesn't do parent communication. Youth Coach Hub owns the middle ground. This module is also the foundation for the future app store version of the application — the parent-facing experience is the primary candidate for a native iOS/Android app.

### Target Users

- **Coaches** (existing users): Create and share content, manage teams
- **Team Admins** (new role in existing system): Handle logistics, invitations, purchases — typically the "team mom"
- **Parents** (new user type): Consume content, RSVP, communicate with coaches
- **Parent Champions** (new designation): Trusted parents who help onboard others

### Design Principles

- Apple-like aesthetic: clean, minimal, generous whitespace, neutral colors
- Every element serves a clear purpose
- Positive framing on all parent-facing data
- Mobile-first for parent experience (they'll primarily use phones)
- Coach experience optimized for desktop/tablet (complex content management)

---

## 2. User Roles & Permissions

### Role Definitions

| Role | Description | Implementation |
|---|---|---|
| **Head Coach** | Full control over team, content, and settings | `team_memberships.role = 'owner'` |
| **Assistant Coach** | Can share video and reports, cannot delete or manage billing | `team_memberships.role = 'coach'` |
| **Team Admin** | Manages logistics, invitations, purchases. Cannot share video or reports | `team_memberships.role = 'team_admin'` (NEW) |
| **Parent** | Consumes content, RSVPs, messages coach | `parent_profiles` table |
| **Parent Champion** | Trusted parent who can resend invites and view onboarding status | `parent_profiles.is_champion = true` |

### Permission Matrix

| Action | Head Coach | Asst Coach | Team Admin | Parent | Parent Champion |
|---|---|---|---|---|---|
| Send announcements | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage calendar/events | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage parent roster | ✅ | ✅ | ✅ | ❌ | ❌ |
| Purchase communication plan | ✅ | ❌ | ✅ | ❌ | ❌ |
| Purchase video top-ups | ✅ | ❌ | ✅ | ❌ | ❌ |
| Share video to parents (team) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Share individual player clips | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish reports to parents | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add notes/comments to reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Share to Vimeo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite parents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Resend parent invitations | ✅ | ✅ | ✅ | ❌ | ✅ |
| View parent onboarding status | ✅ | ✅ | ✅ | ❌ | ✅ |
| Change parent email | ✅ | ✅ | ✅ | ❌ | ❌ |
| View announcements | ✅ | ✅ | ✅ | ✅ | ✅ |
| View schedule + RSVP | ✅ | ✅ | ✅ | ✅ | ✅ |
| View shared videos | ✅ | ✅ | ✅ | ✅ | ✅ |
| View shared reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send direct messages | ✅ | ✅ | ✅ | ✅ (to coach only) | ✅ |

### Multi-Team Parents

A parent with children on multiple teams has ONE account with a team switcher. The parent sees all teams they're linked to, grouped by child name. One login, multiple team views.

### Parent Email Changes

Parents CANNOT change their own email address. They must request the change through a coach or team admin. The flow is:

1. Coach/team admin updates the email in the parent roster
2. System sends a new confirmation magic link to the new email
3. Parent confirms by clicking the link
4. Old email is deactivated
5. Change is logged for audit trail

---

## 3. Pricing Model

### Coach Subscriptions (Existing — Unchanged)

The coach's existing subscription tiers (Basic free, Plus $29/mo, Premium $79/mo) remain unchanged. These cover coaching tools: film analysis, playbook, AI tagging, analytics.

**Requirement:** Coach must have an active Plus ($29/mo) or Premium ($79/mo) subscription to enable Communication Hub for their team.

### Team Communication Plans (New — Season-Based)

Purchased as a one-time payment per season (6 months from activation date). Typically purchased by the team mom, booster club, or head coach on behalf of the team.

| Plan | Price/Season | Max Parents | Team Videos | Individual Clips | Reports | SMS + Email |
|---|---|---|---|---|---|---|
| **Rookie** | $149 | 20 | 10/season | Unlimited | Full | ✅ |
| **Varsity** | $249 | 40 | 10/season | Unlimited | Full | ✅ |
| **All-Conference** | $349 | 60 | 10/season | Unlimited | Full | ✅ |
| **All-State** | $449 | Unlimited | 10/season | Unlimited | Full | ✅ |

**Key pricing rules:**
- Tiers differentiate ONLY by parent count — all features are identical across tiers
- All tiers include 10 team video shares per season
- Individual player clips (coach sends a specific play to one player's parents) are UNLIMITED and do NOT count against the 10 team video limit
- All tiers include full reporting with positive framing
- All tiers include both SMS and email notifications
- "Season" = 6 months from activation date

### Video Top-Up Packs

Teams that need more than 10 team videos can purchase additional packs:

| Pack | Price | Additional Videos | Per-Video Cost |
|---|---|---|---|
| **5-Pack** | $39 | 5 | $7.80 |

One option only. Stackable — teams can buy multiple packs. Each pack is tied to the active communication plan and expires when the plan expires. No unlimited video option exists.

### Stripe Product Configuration

```
Stripe Products:
├── Coach Subscriptions (existing, recurring monthly)
│   ├── Basic (free)
│   ├── Plus ($29/mo)
│   └── Premium ($79/mo)
│
├── Team Communication Plans (new, one-time payments)
│   ├── Rookie ($149)
│   ├── Varsity ($249)
│   ├── All-Conference ($349)
│   └── All-State ($449)
│
└── Video Top-Up Packs (new, one-time payments)
    └── 5-Pack ($39)
```

---

## 4. Database Schema

### Schema Integration Notes

**IMPORTANT:** This schema integrates with existing tables:
- Uses existing `players` table (NOT `team_rosters`)
- Extends existing `team_memberships` table with new role
- Extends existing `team_events` table with new columns

### Update Existing Tables

```sql
-- Add 'team_admin' role to team_memberships
ALTER TABLE team_memberships
DROP CONSTRAINT IF EXISTS team_memberships_role_check;

ALTER TABLE team_memberships
ADD CONSTRAINT team_memberships_role_check
CHECK (role IN ('owner', 'coach', 'analyst', 'viewer', 'team_admin'));

-- Extend team_events table for Communication Hub
ALTER TABLE team_events
  ADD COLUMN IF NOT EXISTS event_type_v2 TEXT CHECK (event_type_v2 IN ('practice', 'game', 'meeting', 'team_event', 'other')),
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_notes TEXT,
  ADD COLUMN IF NOT EXISTS opponent TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'both' CHECK (notification_channel IN ('sms', 'email', 'both')),
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;

-- Migrate existing event_type to event_type_v2 if needed
UPDATE team_events SET event_type_v2 = event_type WHERE event_type_v2 IS NULL;
```

### Parent System

```sql
-- Parent user profiles (linked to Supabase Auth)
CREATE TABLE parent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  notification_preference TEXT DEFAULT 'both' CHECK (notification_preference IN ('sms', 'email', 'both')),
  avatar_url TEXT,
  is_champion BOOLEAN DEFAULT false, -- Parent Champion designation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Links parents to their children (uses existing players table)
CREATE TABLE player_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('mother', 'father', 'guardian', 'stepmother', 'stepfather', 'other')),
  is_primary_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, parent_id)
);

-- Controls parent access to specific teams
CREATE TABLE team_parent_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'full' CHECK (access_level IN ('full', 'view_only')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, parent_id)
);

-- Magic link invitation system
CREATE TABLE parent_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  parent_email TEXT NOT NULL,
  parent_name TEXT,
  relationship TEXT,
  invitation_token UUID DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMPTZ DEFAULT (now() + interval '72 hours'),
  auto_resend_at TIMESTAMPTZ DEFAULT (now() + interval '72 hours'),
  auto_resend_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, parent_email)
);

-- COPPA compliance consent tracking
CREATE TABLE parent_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parent_profiles(id),
  team_id UUID REFERENCES teams(id),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('account_creation', 'video_sharing', 'data_usage')),
  consented BOOLEAN NOT NULL,
  consent_text TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  consented_at TIMESTAMPTZ DEFAULT now()
);

-- Audit trail for parent email changes
CREATE TABLE parent_email_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parent_profiles(id),
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  requested_by UUID NOT NULL,
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Communication Plans & Billing

```sql
-- Season-based communication plan purchases
CREATE TABLE team_communication_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL,
  purchaser_role TEXT NOT NULL CHECK (purchaser_role IN ('coach', 'team_admin')),
  stripe_payment_id TEXT NOT NULL,
  stripe_product_id TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('rookie', 'varsity', 'all_conference', 'all_state')),
  max_parents INTEGER, -- NULL for unlimited (all_state)
  max_team_videos INTEGER NOT NULL DEFAULT 10,
  team_videos_used INTEGER DEFAULT 0,
  includes_reports BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- activated_at + 6 months
  content_accessible_until TIMESTAMPTZ, -- expires_at + 30 days
  mux_cleanup_at TIMESTAMPTZ, -- expires_at + 30 days (aligned with access cutoff)
  coach_override_status TEXT CHECK (coach_override_status IN ('grace_period', 'limited')),
  grace_period_ends_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video top-up pack purchases
CREATE TABLE video_topup_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  communication_plan_id UUID REFERENCES team_communication_plans(id),
  purchased_by UUID NOT NULL,
  stripe_payment_id TEXT NOT NULL,
  videos_added INTEGER NOT NULL DEFAULT 5,
  videos_used INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

-- Coach-team relationship history for cancellation handling
CREATE TABLE team_coach_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  coach_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('joined', 'left', 'transferred', 'downgraded', 'upgraded')),
  previous_coach_id UUID,
  communication_plan_status TEXT CHECK (communication_plan_status IN ('unaffected', 'grace_period', 'limited')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Communication Features

```sql
-- Coach/admin broadcast announcements with position group targeting
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('coach', 'assistant_coach', 'team_admin')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  -- Urgent priority overrides parent notification preferences and uses both channels
  notification_channel TEXT DEFAULT 'both' CHECK (notification_channel IN ('sms', 'email', 'both')),
  -- Position group targeting (NULL = all parents)
  target_position_group TEXT CHECK (target_position_group IN ('offense', 'defense', 'special_teams')),
  attachments JSONB DEFAULT '[]',
  shared_video_id UUID, -- FK added after shared_videos table created
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Read tracking for announcements
CREATE TABLE announcement_reads (
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (announcement_id, parent_id)
);

-- RSVP tracking with family-based response and per-child exceptions
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES team_events(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id),
  -- Family-level default response
  family_status TEXT NOT NULL CHECK (family_status IN ('attending', 'not_attending', 'maybe')),
  -- Per-child exceptions stored as JSONB: [{"player_id": "uuid", "status": "not_attending", "note": "sick"}]
  child_exceptions JSONB DEFAULT '[]',
  note TEXT,
  responded_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, parent_id)
);

-- Direct messages (coach <-> parent)
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('coach', 'assistant_coach', 'team_admin', 'parent')),
  sender_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('coach', 'parent')),
  recipient_id UUID NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification delivery log with rate limiting support
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('parent', 'coach', 'admin')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('announcement', 'event', 'video_shared', 'report_shared', 'rsvp_reminder', 'invitation')),
  subject TEXT,
  body_preview TEXT,
  external_id TEXT, -- Twilio SID or Resend message ID
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- SMS auto-response tracking (for one-way SMS)
CREATE TABLE sms_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  inbound_body TEXT,
  auto_response_sent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Video Sharing (Mux-Powered)

```sql
-- Videos shared with parents (via Mux)
CREATE TABLE shared_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  mux_asset_id TEXT NOT NULL,
  mux_playback_id TEXT NOT NULL,
  mux_asset_status TEXT DEFAULT 'preparing' CHECK (mux_asset_status IN ('preparing', 'ready', 'errored')),
  -- Mux auto-generates thumbnails
  thumbnail_time DECIMAL DEFAULT 0, -- seconds into video for thumbnail
  duration_seconds INTEGER,
  share_type TEXT NOT NULL DEFAULT 'team' CHECK (share_type IN ('team', 'individual')),
  coach_notes TEXT,
  source_film_id UUID,
  source_tag_id UUID,
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  publish_confirmed BOOLEAN NOT NULL DEFAULT false,
  publish_confirmed_at TIMESTAMPTZ,
  -- Signed URL config: 24-hour expiration
  signed_url_expires_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK to announcements
ALTER TABLE announcements
ADD CONSTRAINT announcements_shared_video_fk
FOREIGN KEY (shared_video_id) REFERENCES shared_videos(id);

-- Track which specific parents received individual video shares
CREATE TABLE video_share_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES shared_videos(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  parent_id UUID REFERENCES parent_profiles(id),
  viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  UNIQUE(video_id, parent_id)
);

-- Confirmation log for video publishing (audit trail)
CREATE TABLE video_publish_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES shared_videos(id),
  coach_id UUID REFERENCES auth.users(id),
  confirmation_text TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT now()
);
```

### External Video Sharing (Vimeo Only)

```sql
-- Coach's connected Vimeo account
CREATE TABLE coach_external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'vimeo' CHECK (platform = 'vimeo'),
  platform_account_id TEXT,
  platform_account_name TEXT,
  -- Tokens stored encrypted via Supabase Vault
  access_token_vault_id TEXT NOT NULL,
  refresh_token_vault_id TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  UNIQUE(coach_id, platform)
);

-- Log of all external video shares
CREATE TABLE external_video_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('shared_video', 'film_session', 'highlight_reel')),
  source_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'vimeo' CHECK (platform = 'vimeo'),
  external_url TEXT,
  external_video_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  privacy_setting TEXT NOT NULL DEFAULT 'unlisted' CHECK (privacy_setting IN ('public', 'unlisted', 'private')),
  watermark_applied BOOLEAN NOT NULL DEFAULT true, -- Always true, required
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'processing', 'complete', 'failed')),
  upload_progress INTEGER DEFAULT 0,
  upload_error TEXT,
  confirmation_text TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Reports & Game Summaries

```sql
-- Curated reports shared with parents (positive framing)
CREATE TABLE shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('player_summary', 'game_recap', 'season_progress', 'individual')),
  player_id UUID REFERENCES players(id),
  game_id UUID,
  coach_id UUID REFERENCES auth.users(id),
  coach_notes TEXT,
  report_data JSONB NOT NULL, -- Positively-framed data snapshot
  visibility TEXT DEFAULT 'parents' CHECK (visibility IN ('parents', 'specific_parent')),
  target_parent_id UUID REFERENCES parent_profiles(id),
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  shared_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Track parent views of reports
CREATE TABLE report_views (
  report_id UUID REFERENCES shared_reports(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, parent_id)
);

-- Game summaries with AI co-pilot assistance
CREATE TABLE game_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  game_id UUID,
  coach_id UUID REFERENCES auth.users(id),
  coach_raw_notes TEXT,
  ai_draft TEXT,
  published_text TEXT,
  opponent TEXT,
  score_us INTEGER,
  score_them INTEGER,
  game_date DATE,
  player_highlights JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Mux Asset Cleanup

```sql
-- Automated Mux asset cleanup queue (30-day cleanup aligned with parent access)
CREATE TABLE mux_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_plan_id UUID REFERENCES team_communication_plans(id),
  mux_asset_id TEXT NOT NULL,
  scheduled_cleanup_at TIMESTAMPTZ NOT NULL, -- plan expires_at + 30 days
  cleaned_up_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'retained')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Coach Cancellation & Plan Lifecycle

### State Machine

```
FULL ACCESS
  Coach has Plus/Premium subscription + Communication plan is active
  → All features work

GRACE PERIOD (14 days)
  Coach downgrades to Basic (free) while plan is active
  → Banner warning shown to coach and team admin
  → All features still work during grace period
  → If coach upgrades within 14 days → returns to FULL ACCESS

LIMITED MODE
  Grace period expires OR coach leaves team while plan is active
  → Announcements, calendar, RSVP: WORKING
  → Previous videos and reports: VIEWABLE
  → New video shares: PAUSED
  → New report publishes: PAUSED
  → Team admin sees detailed status with options
  → Parents see simplified "some features paused" message
  → If new coach with Plus/Premium joins → returns to FULL ACCESS

EXPIRED
  Communication plan expires (6 months from activation)
  → 30-day read-only grace period for parents
  → No new content can be created
  → After 30 days: parent access deactivated, Mux assets deleted

ARCHIVED
  30 days after plan expiration with no renewal
  → Mux assets deleted to stop storage charges
  → Content preserved in database but not accessible
  → Parent accounts persist for future seasons
```

### Key Rules

1. The communication plan belongs to the TEAM, not the coach. It survives coach changes.
2. Parents paid for it — they shouldn't lose access because of coach billing issues.
3. Only video sharing and report publishing require an active coach subscription. Everything else works with just the team plan.
4. No refunds on season plans (include in Terms of Service).
5. Coach transfer is supported — new coach inherits the team's communication plan.

---

## 6. Parent Onboarding Flow

### Invitation Process

1. **Coach or Team Admin adds parents:** Goes to team roster, enters parent email addresses for each player.
2. **System sends email invitation:** Magic link expires after 72 hours.
3. **Auto-resend:** If not accepted within 72 hours, system auto-resends once.
4. **Parent Champion can resend:** Designated Parent Champions can also resend invitations and see who hasn't joined.
5. **Parent clicks link → account creation:** Pre-filled form, parent adds name/phone/password.
6. **Consent checkbox (required):** COPPA-compliant consent with exact text logged.
7. **Account created → team dashboard.**

---

## 7. Video Sharing Architecture

### Mux Integration

**Signed URL Configuration:**
- Expiration: 24 hours
- Refresh on play if within 1 hour of expiration
- All parent-facing videos use signed playback URLs

**Thumbnail Generation:**
- Mux auto-generates thumbnails
- Default: frame at 0 seconds
- Coach can optionally specify thumbnail_time

### Video Types

| Type | Counts Against Limit | Audience |
|---|---|---|
| **Team video** | YES (10/season + top-ups) | All parents |
| **Individual clip** | NO (unlimited) | Specific player's parents |

---

## 8. External Video Sharing (Vimeo Only)

### Vimeo Integration

- OAuth for account connection
- Tokens encrypted via Supabase Vault
- Default privacy: Unlisted
- Watermark always applied (required, no opt-out)
- Coach needs Vimeo Pro or higher for API uploads

**Note:** YouTube integration deferred to post-launch due to OAuth verification timeline.

---

## 9. Notification System

### Channels

| Channel | Provider | Notes |
|---|---|---|
| **Email** | Resend (existing) | All notification types |
| **SMS** | Twilio | One-way only, auto-response for inbound |

### Notification Rules

1. **Global preference:** Parents set default channel preference (SMS, email, or both)
2. **Urgent override:** Announcements marked "urgent" use BOTH channels regardless of parent preference
3. **One-way SMS:** Inbound SMS replies trigger auto-response: "This number doesn't receive replies. Message your coach through the app."

### Position Group Targeting

Announcements can target:
- All parents (default)
- Offense parents only
- Defense parents only
- Special Teams parents only

Based on child's `position_group` in `players` table.

---

## 10. RSVP System

### Family-Based RSVP

Parents RSVP once for all their children on the team, with ability to mark individual exceptions.

**Data Model:**
```json
{
  "family_status": "attending",
  "child_exceptions": [
    {"player_id": "uuid", "status": "not_attending", "note": "Has a cold"}
  ]
}
```

### No RSVP Deadlines (v1)

Parents can RSVP anytime up until the event starts. Deadlines may be added in future versions.

---

## 11. Third-Party Service Setup

| Service | Action | Timeline | Est. Cost |
|---|---|---|---|
| **Mux** | Create account, obtain API credentials | Day 1 | Usage-based |
| **Twilio** | Create account, phone number, A2P 10DLC registration | Day 1 (A2P: 2-4 weeks) | $1.50/mo + $0.0079/SMS |
| **Vimeo** | Register developer app | Week 1 | Free |
| **Google Places** | Enable Places API | Day 1 | Free tier |
| **Stripe** | Create new products | Week 1 | 2.9% + $0.30/tx |

**Critical:** Start Twilio A2P 10DLC registration immediately — carriers block unregistered SMS.

---

## 12. Environment Variables

```
# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Vimeo OAuth
VIMEO_CLIENT_ID=
VIMEO_CLIENT_SECRET=
VIMEO_REDIRECT_URI=

# Google Places
GOOGLE_PLACES_API_KEY=
```

---

## 13. Implementation Phases

### Phase 1: Foundation (April 2026)

- [ ] Extend `team_memberships` with 'team_admin' role
- [ ] Extend `team_events` table with new columns
- [ ] Create parent system tables + RLS policies
- [ ] Parent invitation system (magic link emails)
- [ ] Parent account creation with COPPA consent
- [ ] Parent Champion designation and limited permissions
- [ ] Communication plan purchase flow (Stripe)
- [ ] Plan status tracking and expiration logic

### Phase 2: Communication (May 2026)

- [ ] Announcements with position group targeting
- [ ] Read receipt tracking and dashboard
- [ ] Google Places location autocomplete
- [ ] Family-based RSVP with per-child exceptions
- [ ] Notification system: Resend email + Twilio SMS
- [ ] Urgent notification override logic
- [ ] One-way SMS with auto-response
- [ ] Notification rate limiting

### Phase 3: Video Sharing (Late May 2026)

- [ ] Mux integration: upload, encoding, playback
- [ ] 24-hour signed URL generation
- [ ] Mux thumbnail auto-generation
- [ ] Share video to team with publish confirmation
- [ ] Share individual clips (unlimited)
- [ ] Video counter tracking
- [ ] Video top-up purchases
- [ ] Video view tracking and analytics

### Phase 4: Reports & Summaries (June 2026)

- [ ] Shared reports with positive framing
- [ ] Coach notes on reports
- [ ] Game summary AI co-pilot (Gemini Flash)
- [ ] Coach review/edit flow
- [ ] Report view tracking

### Phase 5: External Sharing & Messaging (June-July 2026)

- [ ] Vimeo OAuth integration
- [ ] External share with required watermark
- [ ] Direct messaging (coach ↔ parent)
- [ ] Message read status

### Phase 6: Polish & Launch (July 2026)

- [ ] Mobile-responsive parent views
- [ ] PWA setup with offline sync strategy
- [ ] Coach cancellation state machine
- [ ] 30-day Mux cleanup automation
- [ ] Parent email change flow
- [ ] Load testing
- [ ] Security audit

### Post-Launch

- [ ] Push notifications via PWA
- [ ] YouTube integration (after OAuth verification)
- [ ] Photo sharing
- [ ] Volunteer sign-ups
- [ ] Native iOS/Android app (Capacitor)

---

## 14. Git Strategy

```
v-comm-hub-phase-1  → Foundation
v-comm-hub-phase-2  → Communication
v-comm-hub-phase-3  → Video Sharing
v-comm-hub-phase-4  → Reports & Summaries
v-comm-hub-phase-5  → External Sharing & Messaging
v-comm-hub-v1.0     → Production Launch
```

---

## End of Document

This plan incorporates all decisions from the planning review:
- Uses existing `players` table
- Adds 'team_admin' to existing `team_memberships`
- Family RSVP with per-child exceptions
- Global notification preference with urgent override
- One-way SMS with auto-response
- Position group announcement targeting
- 24-hour Mux signed URLs
- 30-day Mux cleanup
- Parent Champion with limited admin
- Vimeo only (YouTube deferred)
