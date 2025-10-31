# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Titan First Read - Codebase Architecture

## Overview

**Titan First Read** is a comprehensive football coaching platform built with Next.js 15, React 19, TypeScript, and Supabase. It enables coaches to manage teams, build digital playbooks, analyze game film, and track performance analytics.

### Application Type
- **Framework**: Next.js 15 (App Router)
- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Build Tool**: Turbopack (via `next dev --turbopack`)

### Commercial Intent & Development Standards

**This application is being developed with the intention of commercial use.** All development should follow professional standards appropriate for a production software product.

#### GitHub Best Practices

**Branch Strategy:**
- `main` branch should remain stable and deployable
- Create feature branches for new work: `feature/description`, `fix/description`, `refactor/description`
- Current active branch: `refactor/playbuilder-modular`
- Merge to main only after testing and review

**Commit Standards:**
- Write clear, descriptive commit messages
- Use conventional commit format when possible: `feat:`, `fix:`, `refactor:`, `docs:`
- Example: `feat: Add team detail pages with schedule, playbook summary, and analytics tabs`
- Commit frequently with logical, atomic changes
- Never commit sensitive information (API keys, tokens, credentials)

**Code Quality:**
- Maintain TypeScript strict mode compliance
- Follow the established Apple-like aesthetic (black/white/gray, minimal design)
- Test database operations thoroughly, especially RLS policies
- Document complex business logic (especially in footballConfig.ts)
- Use meaningful variable and function names

**Security Considerations:**
- All database tables use Row Level Security (RLS)
- Never disable RLS in production
- User authentication required for all protected routes
- Store sensitive configuration in environment variables
- Regular security audits of Supabase policies

**Production Readiness:**
- Code should be production-grade from the start
- Consider scalability in architectural decisions
- Maintain proper error handling and user feedback
- Log errors appropriately for debugging
- Performance optimization for large playbooks and film libraries

---

## High-Level Architecture

### Tech Stack
```
Frontend:
- Next.js 15 (App Router, Server Components)
- React 19 (Client Components for interactivity)
- TypeScript (strict mode)
- Tailwind CSS v4 (@tailwindcss/postcss)
- Lucide React (icons)

Backend & Database:
- Supabase (PostgreSQL)
- Supabase Auth (user authentication)
- Supabase Storage (file uploads)
- Row Level Security (RLS) policies

Form Handling:
- React Hook Form
- Zod v4 (schema validation)
- @hookform/resolvers

State Management:
- React hooks (useState, useEffect)
- Supabase client for data fetching
- No external state management library
```

### Architecture Pattern
- **Server-Side Rendering (SSR)**: Default for pages
- **Client-Side Rendering (CSR)**: Interactive components marked with `'use client'`
- **API Routes**: Minimal usage (one route at `/api/playbook/extract`)
- **Middleware**: Auth session refresh for all routes
- **Path Aliases**: `@/*` maps to `./src/*`

---

## Directory Structure

```
titan-first-read/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── about/               # Static about page
│   │   ├── api/                 # API routes
│   │   │   └── playbook/
│   │   │       └── extract/     # Playbook extraction endpoint
│   │   ├── auth/                # Authentication pages
│   │   │   ├── callback/        # OAuth callback handler
│   │   │   ├── login/           # Login page
│   │   │   └── auth-code-error/ # Error handling
│   │   ├── contact/             # Contact page
│   │   ├── film/                # Game film management
│   │   │   └── [gameId]/        # Individual game film viewer
│   │   ├── playbook/            # Playbook CRUD interface
│   │   ├── setup/               # Team setup/management
│   │   ├── teams/               # Team pages
│   │   │   └── [teamId]/        # Team detail pages
│   │   │       ├── analytics/   # Team analytics dashboard
│   │   │       └── players/     # Player management
│   │   │           └── [playerId]/ # Player detail pages
│   │   ├── layout.tsx           # Root layout with nav
│   │   ├── page.tsx             # Homepage
│   │   └── globals.css          # Global styles
│   │
│   ├── components/              # React components
│   │   ├── playbuilder/         # Modular PlayBuilder components
│   │   │   ├── PlayBuilder.tsx  # Main PlayBuilder component
│   │   │   ├── BacksSection.tsx
│   │   │   ├── DBSection.tsx
│   │   │   ├── DefensiveLineSection.tsx
│   │   │   ├── FormationMetadata.tsx
│   │   │   ├── LinebackersSection.tsx
│   │   │   ├── OffensiveLineSection.tsx
│   │   │   ├── ReceiversSection.tsx
│   │   │   ├── ValidationModal.tsx
│   │   │   └── index.ts
│   │   ├── AuthGuard.tsx        # Auth protection wrapper
│   │   └── UserMenu.tsx         # User dropdown menu
│   │
│   ├── config/                  # Configuration files
│   │   ├── footballConfig.ts    # SINGLE SOURCE OF TRUTH (2099 lines)
│   │   └── footballRules.ts     # Formation validation rules
│   │
│   ├── types/                   # TypeScript type definitions
│   │   └── football.ts          # All football-related types
│   │
│   ├── lib/                     # Business logic
│   │   └── services/
│   │       └── analytics.service.ts  # Analytics calculations
│   │
│   └── utils/                   # Utility functions
│       └── supabase/            # Supabase client setup
│           ├── client.ts        # Browser client
│           └── server.ts        # Server client
│
├── supabase/                    # Database migrations
│   └── migrations/
│       ├── 001_normalize_playbook_plays.sql
│       ├── 002_create_play_instances.sql
│       ├── 003_add_rls_policies.sql
│       └── 004_fix_rls_policies.sql
│
├── public/                      # Static assets
├── middleware.ts                # Auth middleware
├── next.config.ts               # Next.js configuration
├── tsconfig.json                # TypeScript configuration
├── postcss.config.mjs           # PostCSS configuration
├── package.json                 # Dependencies
└── .env.local                   # Environment variables
```

---

## Key Directories & Their Purposes

### `/src/app` - Next.js App Router
The App Router structure follows Next.js 15 conventions:
- **Server Components by default**: Pages render on server unless marked `'use client'`
- **Dynamic routes**: `[gameId]`, `[teamId]`, `[playerId]` for dynamic routing
- **layout.tsx**: Shared navigation bar and page structure
- **page.tsx**: Route endpoints

**Key Pages:**
- `/` - Homepage with features overview
- `/playbook` - Playbook management interface
- `/film` - Game film viewer and play tagging
- `/teams/[teamId]` - Team dashboard with schedule, playbook summary, analytics tabs
- `/setup` - Team creation and management

### `/src/components` - React Components

**PlayBuilder System** (`/components/playbuilder/`):
The play builder is modularized into position-specific sections:
- **PlayBuilder.tsx**: Main orchestrator (Phase 1 & 2 complete)
- **Offense Sections**: OffensiveLineSection, BacksSection, ReceiversSection
- **Defense Sections**: DefensiveLineSection, LinebackersSection, DBSection
- **Helpers**: FormationMetadata, ValidationModal

This component renders an SVG football field (700x400px) where coaches can:
1. Select formation (offense/defense/special teams)
2. Position players via drag-and-drop
3. Draw routes and assign plays
4. Validate formations against football rules
5. Save to database

### `/src/config` - Configuration (THE BRAIN)

**footballConfig.ts** (2099 lines) - SINGLE SOURCE OF TRUTH:
This is the most critical file in the codebase. It defines:
- All offensive formations (Shotgun, I-Form, Wing-T, etc.)
- All defensive formations (4-3, 3-4, Nickel, Dime, etc.)
- Special teams formations (Kickoff, Punt, etc.)
- Play attributes (personnel, run concepts, pass concepts, coverage)
- Blocking assignments and route types
- Position groups and player roles
- Gap numbering system (holes 0-9)

**footballRules.ts** (371 lines):
Football rules validation system:
- Formation legality (7 on line, 4 in backfield)
- Offsides detection
- Motion rules (1 player in motion, must be off LOS)
- Neutral zone enforcement
- Position type classification

### `/src/types` - TypeScript Types

**football.ts**: Core type definitions matching database schema:
```typescript
interface Player           // Player position on field diagram
interface Route            // Route path for players
interface PlayDiagram      // Complete play visualization
interface PlayAttributes   // Play metadata (ODK, formation, etc.)
interface PlaybookPlay     // Database table: playbook_plays
interface Team             // Database table: teams
interface Game             // Database table: games
interface Video            // Database table: videos
interface PlayerRecord     // Database table: players
interface PlayResult       // Film analysis results
```

### `/src/lib/services` - Business Logic

**analytics.service.ts**:
Calculates team and player statistics:
- Success rate calculations
- Yards per play
- Down-and-distance analytics
- Red zone efficiency
- Play frequency analysis

---

## Important Patterns & Conventions

### 1. Supabase Client Pattern
Two separate clients for different contexts:
```typescript
// Browser (client components)
import { createClient } from '@/utils/supabase/client'

// Server (server components, API routes)
import { createClient } from '@/utils/supabase/server'
```

### 2. Authentication Flow
- Middleware refreshes auth sessions on every request
- `AuthGuard.tsx` component protects authenticated routes
- Supabase handles OAuth and email/password auth
- Row Level Security (RLS) enforces data isolation

### 3. Type Safety
- All database tables have corresponding TypeScript interfaces
- Zod schemas validate form inputs
- Strict TypeScript configuration (`strict: true`)

### 4. Component Patterns
```typescript
// Client components for interactivity
'use client';
import { useState, useEffect } from 'react';

// Server components (default)
// Can use async/await directly
async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### 5. Naming Conventions
- **Files**: camelCase for utilities, PascalCase for components
- **Database**: snake_case (e.g., `play_code`, `team_id`)
- **TypeScript**: PascalCase for interfaces/types, camelCase for variables
- **CSS**: Tailwind utility classes

### 6. State Management
- Local state with `useState` for UI state
- Supabase queries for data fetching
- No Redux/Zustand - keeping it simple
- Real-time subscriptions available but not yet implemented

---

## Database Structure (Supabase/PostgreSQL)

### Schema Overview

**Core Tables:**
```sql
teams                    -- Team information
  id (UUID, PK)
  name (TEXT)
  level (TEXT)
  colors (JSONB)
  user_id (UUID, FK)
  created_at (TIMESTAMPTZ)

playbook_plays          -- Digital playbook
  id (UUID, PK)
  team_id (UUID, FK, nullable)  -- NULL = personal playbook
  play_code (TEXT, UNIQUE)
  play_name (TEXT)
  attributes (JSONB)     -- PlayAttributes (formation, odk, etc.)
  diagram (JSONB)        -- PlayDiagram (players, routes)
  page_number (INT)
  image_url (TEXT)
  pdf_url (TEXT)
  extracted_text (TEXT)
  is_archived (BOOLEAN)
  created_at (TIMESTAMPTZ)
  updated_at (TIMESTAMPTZ)

games                   -- Game records
  id (UUID, PK)
  name (TEXT)
  date (DATE)
  opponent (TEXT)
  team_id (UUID, FK)
  user_id (UUID, FK)
  team_score (INT)
  opponent_score (INT)
  game_result (TEXT)     -- 'win', 'loss', 'tie'
  created_at (TIMESTAMPTZ)

videos                  -- Game film videos
  id (UUID, PK)
  name (TEXT)
  file_path (TEXT)       -- Supabase Storage path
  url (TEXT)
  game_id (UUID, FK)
  created_at (TIMESTAMPTZ)

play_instances          -- Film analysis (play tagging)
  id (UUID, PK)
  video_id (UUID, FK)
  play_code (TEXT, FK)   -- References playbook_plays
  team_id (UUID, FK)
  timestamp_start (INT)  -- Video timestamp in seconds
  timestamp_end (INT)
  down (INT, 1-4)
  distance (INT)
  yard_line (INT, 0-100)
  hash_mark (TEXT)       -- 'left', 'middle', 'right'
  result (TEXT)
  yards_gained (INT)
  resulted_in_first_down (BOOLEAN)
  is_turnover (BOOLEAN)
  is_opponent_play (BOOLEAN)
  notes (TEXT)
  tags (JSONB)
  created_at (TIMESTAMPTZ)
  updated_at (TIMESTAMPTZ)
```

### JSONB Columns (Key Feature)

The database uses JSONB extensively for flexibility:

**playbook_plays.attributes** (PlayAttributes):
```json
{
  "odk": "offense",
  "formation": "Shotgun Spread",
  "playType": "Pass",
  "personnel": "11 (1RB-1TE-3WR)",
  "passConcept": "Levels",
  "protection": "5-Man (Slide)",
  "motion": "Jet",
  "customTags": ["3rd Down", "Red Zone"]
}
```

**playbook_plays.diagram** (PlayDiagram):
```json
{
  "odk": "offense",
  "formation": "Shotgun Spread",
  "players": [
    {
      "position": "QB",
      "x": 300,
      "y": 260,
      "label": "QB",
      "assignment": "Pass",
      "isPrimary": true,
      "motionType": "None"
    }
  ],
  "routes": [
    {
      "id": "route-1",
      "playerId": "player-0",
      "path": [{"x": 300, "y": 260}, {"x": 300, "y": 100}],
      "type": "pass",
      "routeType": "Go/Streak/9",
      "isPrimary": true
    }
  ]
}
```

### Indexes
```sql
-- Performance optimizations
CREATE INDEX idx_playbook_plays_attributes ON playbook_plays USING GIN (attributes);
CREATE INDEX idx_playbook_plays_odk ON playbook_plays ((attributes->>'odk'));
CREATE INDEX idx_playbook_plays_formation ON playbook_plays ((attributes->>'formation'));
CREATE INDEX idx_play_instances_video ON play_instances(video_id);
CREATE INDEX idx_play_instances_play_code ON play_instances(play_code);
```

### Row Level Security (RLS)
All tables have RLS enabled:
- Users can only see their own teams, games, videos
- Play instances are team-scoped
- Personal playbooks (team_id = NULL) are user-scoped

---

## The Playbook/Football Play System Architecture

### The "Single Source of Truth" Philosophy

The entire play system is built around **footballConfig.ts** (2099 lines). This file defines:

1. **Formations** - Exact player positioning for 40+ formations
2. **Attributes** - All possible play characteristics
3. **Rules** - Gap numbering, blocking schemes, assignments

### Formation System

**Structure:**
```typescript
interface FormationConfig {
  [key: string]: Player[];
}

const OFFENSIVE_FORMATIONS: FormationConfig = {
  'Shotgun Spread': [
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    // ... 11 players total
  ]
}
```

**Coordinate System:**
- Canvas: 700px wide × 400px tall
- Line of scrimmage (LOS): y = 200
- Offense: y >= 200 (at or behind LOS)
- Defense: y < 200 (ahead of LOS)
- Neutral zone: y = 194-206

### Play Builder Workflow

1. **Select ODK** (Offense/Defense/Special Teams)
2. **Choose Formation** from footballConfig
3. **Load Formation** - Players positioned on SVG canvas
4. **Customize**:
   - Drag players to new positions
   - Assign routes/blocks (offense)
   - Assign coverage/blitz (defense)
   - Add pre-snap motion
5. **Validate** against footballRules
6. **Save** to database as JSONB

### Assignment System

**Offensive Linemen:**
- Block types: Run Block, Pass Block, Pull
- Block responsibilities: Nose, 3-tech, Mike LB, A-gap, etc.
- Draggable block direction indicator

**Skill Positions (RB/WR/TE):**
- Unified assignment dropdown (run or pass)
- Routes: Go, Post, Corner, Curl, Slant, etc.
- Actions: Block, Draw Route (Custom)

**Defensive Players:**
- Coverage assignments: Man, Zone, Flat, Deep Half, etc.
- Blitz gaps: A, B, C, D
- Coverage depths and zone endpoints

### Validation System (footballRules.ts)

**Offensive Rules:**
- Exactly 7 players on LOS
- Maximum 4 in backfield
- No players ahead of LOS (offsides)
- Eligible receivers on ends of line

**Motion Rules:**
- Only 1 player in motion at snap
- Motion player must be off LOS
- Cannot move toward LOS
- Linemen cannot be in motion

**Defensive Rules:**
- No players behind LOS (offsides)
- Neutral zone awareness

### Play Code Generation
```typescript
// Auto-generated: P-001, P-002, P-003...
const lastCode = await getLastPlayCode();
const nextNum = parseInt(lastCode.match(/\d+/)) + 1;
const newCode = `P-${nextNum.toString().padStart(3, '0')}`;
```

### Dummy Formations (Phase 2)
- Defense plays can include "dummy offense" for reference
- Offense plays can include "dummy defense" for coverage reads
- Flagged with `isDummy: true` to distinguish from main formation

---

## Unique & Complex Parts of the Codebase

### 1. SVG Football Field Renderer
The PlayBuilder renders a full football field in SVG with:
- Yard lines (every 5 yards)
- Hash marks
- Line of scrimmage
- Neutral zone visualization
- Draggable players with labels
- Route drawing with click-to-add waypoints
- Motion path indicators
- Block direction arrows
- Coverage zone dropdowns

**Technical challenges:**
- SVG coordinate system mapping
- Mouse/touch event handling
- Real-time drag with constraints
- Path smoothing for routes

### 2. Formation Validation Engine
Real-time validation as users build plays:
```typescript
const validation = validateOffensiveFormation(players);
// Returns: { isValid, errors[], warnings[] }

if (!validation.isValid) {
  // Show modal with specific errors
  // E.g., "Only 6 players on LOS. Need at least 7."
}
```

### 3. JSONB Query Patterns
Leveraging PostgreSQL JSONB for flexible queries:
```typescript
// Get all pass plays from Shotgun formations
const { data } = await supabase
  .from('playbook_plays')
  .select('*')
  .eq('attributes->odk', 'offense')
  .eq('attributes->playType', 'Pass')
  .ilike('attributes->formation', '%Shotgun%');
```

### 4. Play Instance Analytics
Film analysis connects playbook plays to game film:
```typescript
// Tag a play in video
const playInstance = {
  video_id: gameVideo.id,
  play_code: 'P-042',  // Links to playbook
  down: 3,
  distance: 7,
  yards_gained: 12,
  resulted_in_first_down: true
};

// Later: Analyze success rate of P-042 on 3rd down
```

### 5. Modular PlayBuilder Architecture
The PlayBuilder was refactored into position-specific sections:
- **Separation of concerns**: Each position group has its own component
- **Props drilling**: Parent passes players array, section filters and renders
- **Centralized updates**: All changes flow back to parent state
- **Reusable logic**: Assignment dropdowns, drag handlers shared

### 6. Pre-Snap Motion System
Complex motion system with 6 types:
- **Jet**: Fast motion across formation
- **Orbit**: Motion around backfield
- **Across**: Simple lateral motion
- **Return**: Motion then reset (must be set at snap)
- **Shift**: Formation shift (must be set at snap)
- Draggable motion endpoint for custom paths

### 7. Coverage Auto-Application
When defense selects coverage (e.g., Cover 3):
```typescript
const updatedPlayers = applyCoverageToFormation(players, 'Cover 3');
// Automatically assigns:
// - 3 deep zone defenders
// - 4 underneath zone defenders
// - Sets coverage depths
// - Assigns zone responsibilities
```

---

## Database Migrations

### Migration History

**001_normalize_playbook_plays.sql**:
- Adds `attributes` JSONB column
- Adds `diagram` JSONB column
- Migrates old columns to new JSONB structure
- Creates GIN indexes for JSONB queries
- Adds `updated_at` trigger

**002_create_play_instances.sql**:
- Creates `play_instances` table
- Links plays to video timestamps
- Adds down/distance/result tracking
- Makes play_code UNIQUE constraint

**003_add_rls_policies.sql**:
- Enables RLS on games, videos, play_instances
- Creates SELECT/INSERT/UPDATE/DELETE policies
- Enforces user_id checks

**004_fix_rls_policies.sql**:
- Fixes RLS policy edge cases
- Adjusts team/user relationships

---

## Key Technologies & Libraries

### Core Dependencies
```json
{
  "next": "15.4.6",           // Latest Next.js
  "react": "19.1.0",          // Latest React
  "react-dom": "19.1.0",
  "@supabase/supabase-js": "^2.55.0",
  "@supabase/ssr": "^0.7.0",
  "lucide-react": "^0.544.0", // Icons
  "react-hook-form": "^7.62.0",
  "@hookform/resolvers": "^5.2.1",
  "zod": "^4.1.1"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "eslint": "^9",
  "eslint-config-next": "15.4.6"
}
```

### Notable Configurations

**TypeScript (tsconfig.json):**
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- Target: ES2017
- JSX: preserve (handled by Next.js)

**Next.js (next.config.ts):**
- Webpack config to exclude canvas/encoding on client
- TypeScript build errors temporarily ignored
- ESLint errors temporarily ignored during builds

**Tailwind CSS:**
- Version 4 using PostCSS plugin
- No traditional tailwind.config file
- All config via CSS imports

---

## Development Workflow

### Getting Started
```bash
npm install
npm run dev  # Runs on http://localhost:3000
```

### Environment Variables (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Git Branch Structure
Current branch: `refactor/playbuilder-modular`
Recent commits focus on:
- Team detail pages with tabs
- Defensive system implementation
- Unified assignment system
- Blocking system refactor
- Pre-snap motion system

### Code Organization Principles
1. **Single source of truth**: footballConfig.ts owns all formations
2. **Type safety**: Everything typed, no `any`
3. **Server-first**: Use Server Components where possible
4. **Progressive enhancement**: Start with working, enhance with JavaScript
5. **Modularity**: Break large components into smaller pieces

---

## Future Considerations

### Potential Features (Based on Codebase Structure)
- **Real-time collaboration**: Supabase subscriptions for live playbook editing
- **Video playback**: Integrate video.js or similar for film analysis
- **PDF import**: Extract plays from PDF playbooks (API route exists)
- **Player stats**: Complete player tracking system (tables exist)
- **Play calling**: In-game play selection interface
- **Analytics dashboard**: Advanced charts with formation tendencies

### Performance Optimizations
- Consider React.memo for heavy components (PlayBuilder)
- Implement virtual scrolling for large play lists
- Add loading skeletons for better UX
- Consider edge caching for static formations

### Testing Strategy (Not yet implemented)
- Unit tests: footballRules validation functions
- Integration tests: Supabase client interactions
- E2E tests: PlayBuilder workflow
- Visual regression: Formation rendering

---

## Common Tasks & Patterns

### Adding a New Formation
1. Add to `footballConfig.ts` in appropriate section
2. Define 11 players with x/y coordinates
3. Test with validation system
4. Formation automatically appears in dropdown

### Adding a New Play Attribute
1. Add to `footballConfig.ts` constants
2. Update `PlayAttributes` interface in `types/football.ts`
3. Add to PlayBuilder UI
4. Database JSONB handles it automatically (no migration needed)

### Querying Plays
```typescript
const supabase = createClient();

// Get all offensive plays
const { data } = await supabase
  .from('playbook_plays')
  .select('*')
  .eq('attributes->odk', 'offense');

// Get plays by formation
const { data } = await supabase
  .from('playbook_plays')
  .select('*')
  .eq('attributes->formation', 'Shotgun Spread');
```

### Adding a New Page
1. Create folder in `src/app/[page-name]`
2. Add `page.tsx` file
3. Add link to navigation in `layout.tsx`
4. Add auth protection if needed (AuthGuard)

---

## Contact & Support

For questions about this codebase, refer to:
- **footballConfig.ts**: All formation/attribute definitions
- **footballRules.ts**: Formation validation logic
- **types/football.ts**: TypeScript interfaces
- **supabase/migrations/**: Database schema

**Key Files to Understand First:**
1. `src/config/footballConfig.ts` - The brain
2. `src/types/football.ts` - The contracts
3. `src/components/playbuilder/PlayBuilder.tsx` - The UI
4. `src/app/playbook/page.tsx` - The user flow

---

*Last Updated: 2025-10-30*
*Version: refactor/playbuilder-modular branch*
