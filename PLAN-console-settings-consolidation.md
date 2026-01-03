# Plan: Console & Settings Consolidation

## Overview

Eliminate the Console section entirely and consolidate all functionality into the Team Settings page. Owner-only features will appear as additional tabs. The subscription tier will be prominently displayed at the top of Settings.

---

## Current State

### Console Pages (to be eliminated)
| Page | Route | Functionality |
|------|-------|---------------|
| Overview | `/console` | Dashboard with teams count, users, games, plays, token usage, billing status, alerts |
| Teams | `/console/teams` | List all owned teams with tier, status, member count, tokens |
| Team Detail | `/console/teams/[teamId]` | Single team management, change plan, usage stats, recent games |
| People | `/console/people` | All users across teams, deactivate/reactivate, resend invites |
| Usage | `/console/usage` | Time-series charts, usage by team, period selection |
| Billing | `/console/billing` | MRR, subscription statuses, Stripe portal, all team subscriptions |

### Current Settings Structure
| Tab | Route | Functionality |
|-----|-------|---------------|
| Team Info | `/teams/[teamId]/settings` | Team colors |
| Team Members | `/teams/[teamId]/settings` | View members (read-only for coaches) |
| Usage & Tokens | `/teams/[teamId]/settings` | Token balance card |
| Onboarding | `/teams/[teamId]/settings` | Tour, checklist |
| Addons | `/teams/[teamId]/settings/addons` | Purchase tokens |

---

## New Settings Structure

### Header Section (Always Visible)
**Subscription Tier Banner** - Displayed at top of Settings page, above tabs

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ Plus Plan                                          [Manage Plan] │
│  4 film uploads/mo • 3 cameras • 90-day retention    (owner only)   │
│  Renews: Feb 15, 2026                                               │
└─────────────────────────────────────────────────────────────────────┘
```

- **All roles see**: Tier name, key limits, renewal date
- **Owners also see**: "Manage Plan" button

### Tab Structure

| Tab | Visible To | Content |
|-----|------------|---------|
| **Subscription** | All (owners can edit) | Plan details, token usage, upgrade options |
| **Team** | All (owners can edit) | Team name, colors, level |
| **Members** | All (owners can edit) | Member list, invite/remove (owner only) |
| **Usage** | All | Token balance, usage charts, purchase tokens (owner only) |
| **Billing** | Owner only | Payment method, Stripe portal, billing history |
| **Onboarding** | All | Tour, checklist |

---

## Detailed Tab Specifications

### 1. Subscription Tab (NEW - First Tab)

**Purpose**: Front-and-center view of the team's subscription

**For All Roles (Read-Only for Coaches)**:
- Current tier with visual badge (Basic/Plus/Premium)
- Plan features and limits:
  - Film uploads per month (with usage bar)
  - Cameras per game
  - Video retention period
  - Coach seats
- Token balance (subscription + purchased)
- Renewal/billing date
- Trial status (if applicable)

**For Owners (Additional)**:
- "Change Plan" button → opens tier selection modal
- "Upgrade" call-to-action if on Basic
- Subscription status (active, trialing, past_due, waived)
- Cancel/modify subscription options

**Data Source**: Merge from `/api/console/teams/[teamId]` and `/api/console/billing`

---

### 2. Team Tab (Enhanced from Team Info)

**For All Roles**:
- Team name (read-only display)
- Team level (Youth, JV, Varsity, College)
- Team colors with preview

**For Owners**:
- Edit team name
- Edit team level
- Edit colors with save button

**No Changes Needed**: Mostly keep existing, just ensure edit controls hidden for coaches

---

### 3. Members Tab (Enhanced from Team Members)

**For All Roles**:
- Team owner display (with badge)
- Member list with:
  - Name/email
  - Role (Owner, Coach)
  - Join date
  - Last active

**For Owners (Additional)**:
- "Invite Coach" button → invite modal
- Remove member button per row
- Change role dropdown (future: coach → analyst)
- Pending invites section with resend/cancel

**Data Source**: Merge from `/api/console/people` (filtered to current team)

---

### 4. Usage Tab (Enhanced from Usage & Tokens)

**For All Roles**:
- Token Balance Card:
  - Subscription tokens (used/available)
  - Purchased tokens (available)
  - Visual progress bar
- How tokens work explanation
- Usage stats:
  - Games this period
  - Plays tagged
  - Active users

**For Owners (Additional)**:
- "Purchase Tokens" section (moved from Addons page)
  - Team film tokens purchase
  - Opponent scouting tokens purchase
  - Pricing and quantity selector
- Usage trend charts (simplified from Console Usage):
  - Games over time
  - Plays tagged over time
  - Token consumption

**Data Source**: Merge `/api/console/usage` (single team) + `/api/teams/[teamId]/tokens`

---

### 5. Billing Tab (NEW - Owner Only)

**Purpose**: Centralized billing management for the team

**Content**:
- Payment Method section:
  - Current payment method (card ending in XXXX)
  - "Manage Payment Method" → Stripe portal
- Current subscription:
  - Tier and price
  - Billing cycle (monthly/annual)
  - Next billing date
  - Amount due
- Billing history (future enhancement)
- "Change Plan" button (duplicated for convenience)

**Data Source**: `/api/console/billing` (filtered to current team)

---

### 6. Onboarding Tab (Keep As-Is)

No changes needed. Keep current functionality:
- Tour status
- Getting started checklist
- Watch tour / reset checklist buttons

---

## Multi-Team Handling

Since Console is eliminated, multi-team owners need alternate access:

### Option A: Enhanced Homepage Dashboard (Recommended)
- Homepage shows all teams with summary cards
- Each card shows: tier badge, token usage, subscription status
- Click team → goes to team dashboard
- "Settings" button per team → goes to that team's settings
- "Create Team" button on homepage

### Option B: Team Switcher in Settings
- Settings page has team dropdown at top
- Can switch between teams without leaving Settings
- Shows aggregate stats for "All Teams" view

**Recommendation**: Go with Option A - keeps it simple, homepage becomes the multi-team hub.

---

## Migration Plan

### Phase 1: Add Subscription Banner to Settings
1. Create `SubscriptionBanner` component
2. Fetch subscription data in Settings page
3. Display tier, limits, renewal at top of page
4. Add "Manage Plan" button (owner only)

### Phase 2: Add Subscription Tab
1. Create new tab as first tab in Settings
2. Build subscription details UI
3. Integrate "Change Plan" modal from Console
4. Add upgrade CTAs

### Phase 3: Enhance Members Tab
1. Add invite functionality (from Console People)
2. Add remove member functionality
3. Add pending invites section
4. Keep read-only view for coaches

### Phase 4: Enhance Usage Tab
1. Move token purchase from Addons page
2. Add simplified usage charts
3. Combine subscription + purchased token display

### Phase 5: Add Billing Tab (Owner Only)
1. Create new tab (hidden from coaches)
2. Move payment method management
3. Add Stripe portal integration
4. Show billing summary

### Phase 6: Update Homepage for Multi-Team
1. Enhance team cards with subscription info
2. Add "Create Team" prominent button
3. Show aggregate stats for owners with multiple teams

### Phase 7: Remove Console
1. Update all navigation to remove Console links
2. Remove `/console` routes
3. Remove Console API routes (or repurpose)
4. Update any redirects

### Phase 8: Cleanup
1. Remove unused components (ConsoleNav, etc.)
2. Remove/consolidate duplicate API endpoints
3. Update documentation

---

## Files to Create/Modify

### New Components
- `src/components/settings/SubscriptionBanner.tsx`
- `src/components/settings/SubscriptionTab.tsx`
- `src/components/settings/BillingTab.tsx`
- `src/components/settings/MembersTab.tsx` (enhanced)
- `src/components/settings/UsageTab.tsx` (enhanced)

### Modified Files
- `src/app/teams/[teamId]/settings/page.tsx` - Major rewrite
- `src/app/page.tsx` (or homepage) - Add multi-team dashboard
- `src/components/TeamNavigation.tsx` - Update nav items

### Files to Delete (Phase 7)
- `src/app/console/` (entire directory)
- `src/app/api/console/` (entire directory, or consolidate)
- `src/components/console/` (entire directory)

### API Changes
- May consolidate Console APIs into team-specific endpoints
- `/api/teams/[teamId]/subscription` - subscription details
- `/api/teams/[teamId]/members` - member management
- `/api/teams/[teamId]/usage` - usage stats

---

## UI Mockup - New Settings Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Settings                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ⚡ Plus Plan                                        [Manage Plan] │  │
│  │  4 uploads/mo • 3 cameras • 90-day retention                       │  │
│  │  Next billing: Feb 15, 2026 • $29/mo                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────┐     │
│  │Subscription│   Team     │  Members   │   Usage    │  Billing*  │     │
│  └────────────┴────────────┴────────────┴────────────┴────────────┘     │
│                                                                          │
│  [Tab Content Area]                                                      │
│                                                                          │
│  * = Owner only                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Questions Resolved

1. ✅ **Console scope**: Eliminate entirely, move to Settings tabs
2. ✅ **Tier placement**: Both - banner at top + detailed Subscription tab
3. ✅ **Coach visibility**: Coaches see tier info (read-only)

---

## Estimated Scope

- **New components**: 5
- **Major file rewrites**: 2-3
- **Files to delete**: ~15-20 (Console section)
- **API consolidation**: Moderate

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Subscription Banner) for quick visible progress
3. Iterate through phases, testing each before proceeding
