# Admin Console Implementation Plan

## Project Context

This is an existing football game film analysis application called Youth Coach Hub. The core application is functional — coaches can create teams, upload game film, tag plays, view analytics, and invite team members.

We are now adding two administrative layers:
1. **Athletic Director Console** — For customers (school athletic directors or head coaches) to manage their teams, users, billing, and usage
2. **Platform Admin Console** — For the application owner to manage all customers, monitor revenue/costs, and provide support

## Critical Constraint: Preserve Existing Functionality

The application has existing database tables, API routes, and UI components that are working. When implementing these blocks:

- **DO NOT** drop or recreate existing tables
- **DO NOT** remove existing columns
- **DO** use additive migrations (ADD COLUMN, CREATE TABLE)
- **DO** maintain backward compatibility with existing API responses
- **DO** check for existing implementations before creating new ones
- **ASK** before modifying any existing files if unsure about impact

## Current Known Entities (verify before modifying)

These likely exist in some form:
- User (authentication, profile)
- Team (team details, settings)
- TeamMembership or similar (user-team relationship with roles)
- Game (uploaded games)
- Play (tagged plays)
- AnalyticsTier or similar (tier selection)

Before modifying any entity, read the existing schema and understand current structure.

## Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Admin                            │
│              (admin.youthcoachhub.com)                     │
│   - All organizations, users, revenue, costs, logs          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ manages
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Organization                             │
│              (School / Athletic Department)                  │
│   - Owner: Athletic Director or Head Coach                  │
│   - Billing account (Stripe Customer)                       │
│   - Settings, notifications                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ contains
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Team(s)                               │
│              (JV, Varsity, Jr High, etc.)                   │
│   - Individual subscription per team                        │
│   - Own tier selection (locked to subscription)             │
│   - Own AI credit allocation                                │
│   - Members with roles                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ contains
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Team Members                              │
│              (Coaches, Analysts, Viewers)                   │
│   - Role-based permissions                                  │
│   - Can belong to multiple teams                            │
└─────────────────────────────────────────────────────────────┘
```

## New Entities to Create

These are new and should not conflict with existing tables:

1. **Organization** — Groups teams under one billing account
2. **Subscription** — Links team to Stripe subscription and tier
3. **AICredits** — Tracks AI usage per team per billing period
4. **PlatformConfig** — Key-value store for admin settings
5. **AuditLog** — Records admin actions and important events
6. **Invoice** (or use Stripe data) — Billing history

## Key Design Decisions

### Billing
- Billing is per-team, not per-organization
- Each team has its own tier and subscription
- Organization is the Stripe Customer; teams are Stripe Subscriptions
- Stripe Customer Portal handles payment method updates

### Tiers
- Tiers are fixed packages (Little League, HS Basic, HS Pro, etc.)
- Tier controls both analytics features AND AI credit allocation
- Existing tier selection UI remains but becomes gated by subscription

### AI Credits
- AI credits are per-team, not pooled across organization
- Credits reset each billing period
- Credits are defined per tier in platform configuration

### Trial
- Trial availability is controlled by platform admin
- Trial is not visible to customers unless enabled
- Trial has configurable duration, allowed tiers, and AI credit limits

### Roles
- Platform Admin: Application owner (separate from customer hierarchy)
- Organization Owner: Athletic Director or Head Coach
- Team roles: Owner, Coach, Analyst, Viewer (existing)

## Implementation Phases

### Phase 1: Foundation
- Block 1: Data Model (new tables, extend existing)
- Block 2: Platform Configuration System

### Phase 2: Billing
- Block 8: Stripe Integration
- Block 9: Tier Enforcement
- Block 7: AD Console - Billing UI

### Phase 3: Athletic Director Console
- Block 3: Overview Dashboard
- Block 4: Teams Management
- Block 5: People Management
- Block 6: Usage Analytics

### Phase 4: Platform Admin Console
- Block 11: Dashboard
- Block 12: Organizations Browser
- Block 13: Users Browser
- Block 14: Revenue & Billing
- Block 16: Logs & Audit

### Phase 5: Advanced Features
- Block 10: AI Credits Tracking
- Block 15: Costs & Profitability
- Block 17: System Management
- Block 18: Trial System

## Tech Stack Notes

[ADD YOUR TECH STACK HERE - for example:]
- Frontend: Next.js / React
- Backend: [your backend]
- Database: [your database]
- Auth: [your auth provider]
- Payments: Stripe (to be integrated)

## File Structure Expectations

[ADD YOUR FILE STRUCTURE HERE if you have conventions, or let Claude Code discover it]

## API Conventions

[ADD YOUR API CONVENTIONS HERE - REST? GraphQL? Route patterns?]

## UI Conventions

- Apple-like aesthetic: clean, minimal, generous whitespace
- Neutral colors: white, black, gray
- Subtle shadows, thin dividers
- Sans-serif typography
- No heavy decoration

## Before Starting Any Block

1. Read existing schema for entities being modified
2. Check existing API routes that might overlap
3. Confirm file locations and naming conventions
4. Ask if unsure about any existing implementation
