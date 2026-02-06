# CLAUDE.md

Guidance for Claude Code when working in this repository.

---

## Documentation Updates

**Before updating any user-facing documentation or AI context, read `DOCUMENTATION_PROCESS.md`.**

When adding or changing features, you MUST ask the user:
> "Should I update the Feature Registry (`features.ts`) to keep the AI Assistant and User Guide in sync?"

Do NOT update `src/content/features.ts` without user confirmation.

---

## Overview

**Youth Coach Hub** is a football coaching platform built for commercial use. Coaches manage teams, build digital playbooks, analyze game film, and track analytics.

**Tech Stack:** Next.js 15 (App Router) | React 19 | TypeScript (strict) | Tailwind CSS v4 | Supabase (PostgreSQL + Auth + Storage) | Turbopack | React Hook Form + Zod v4 | Lucide React icons

**Path alias:** `@/*` maps to `./src/*`

---

## Development Standards

**Git:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`). Feature branches (`feature/`, `fix/`, `refactor/`). Never commit secrets.

**Code:** TypeScript strict mode, no `any`. Server Components by default; `'use client'` only for interactivity. No external state management (useState + Supabase queries). Follow `DESIGN_SYSTEM.md` for marketing pages.

**Security:** All tables use Row Level Security (RLS). Never disable RLS. Auth required for protected routes.

**Database Migrations:**
- Create migration files in `supabase/migrations/` with sequential numbering (e.g., `127_description.sql`)
- Do NOT run migrations directly — only create SQL files and inform the user
- Frontend code depending on new DB functions should include fallback logic until deployed

---

## Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── auth/                     # Login, callback, error
│   ├── film/[gameId]/            # Game film viewer + play tagging
│   ├── playbook/                 # Playbook CRUD
│   ├── setup/                    # Team creation/management
│   ├── teams/[teamId]/           # Team dashboard (schedule, playbook, analytics)
│   │   └── players/[playerId]/   # Player detail
│   ├── layout.tsx                # Root layout with nav
│   └── page.tsx                  # Homepage
├── components/
│   ├── playbuilder/              # Modular PlayBuilder (see below)
│   ├── film/                     # Film system components (see Film System below)
│   │   ├── context/              # FilmContext, reducer, actions, selectors
│   │   └── panels/               # Extracted film panel components
│   │       ├── hooks/            # useMarkers, useTimelinePlayback, etc.
│   │       └── sections/         # Tagging form field groups
│   ├── AuthGuard.tsx             # Auth protection wrapper
│   └── UserMenu.tsx              # User dropdown
├── config/
│   ├── footballConfig.ts         # SINGLE SOURCE OF TRUTH (~2100 lines)
│   └── footballRules.ts          # Formation validation rules
├── types/football.ts             # All football TypeScript interfaces
├── lib/
│   ├── services/                 # Business logic services
│   │   ├── camera-sync.service.ts    # Multi-camera timeline sync
│   │   ├── play-tagging.service.ts   # Play instance CRUD
│   │   ├── video-marker.service.ts   # Game marker CRUD
│   │   └── analytics.service.ts      # Analytics calculations
│   ├── video/                    # Video playback infrastructure
│   │   └── VideoPlaybackManager.ts
│   └── errors/                   # Error handling utilities
│       └── client-error-logger.ts
└── utils/supabase/
    ├── client.ts                 # Browser Supabase client
    └── server.ts                 # Server Supabase client
```

---

## Key Patterns

### Supabase Client
```typescript
// Browser (client components)
import { createClient } from '@/utils/supabase/client'
// Server (server components, API routes)
import { createClient } from '@/utils/supabase/server'
```

### Naming Conventions
- **Files:** camelCase (utilities), PascalCase (components)
- **Database:** snake_case (`play_code`, `team_id`)
- **TypeScript:** PascalCase (interfaces/types), camelCase (variables)

### JSONB Query Pattern
```typescript
const { data } = await supabase
  .from('playbook_plays')
  .select('*')
  .eq('attributes->odk', 'offense')
  .eq('attributes->formation', 'Shotgun Spread');
```

---

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `teams` | Team info | `id`, `name`, `level`, `colors` (JSONB), `user_id` |
| `playbook_plays` | Digital playbook | `play_code` (unique), `attributes` (JSONB), `diagram` (JSONB), `team_id` (null = personal) |
| `games` | Game records | `opponent`, `team_score`, `opponent_score`, `game_result`, `team_id` |
| `videos` | Game film | `file_path` (Storage), `url`, `game_id` |
| `play_instances` | Film play tags | `play_code` (FK), `video_id`, `down`, `distance`, `yard_line`, `yards_gained`, `result` |
| `players` | Team roster | `jersey_number`, `primary_position`, `position_group`, `depth_order` |

**JSONB columns:** `playbook_plays.attributes` stores play metadata (odk, formation, playType, personnel, etc.). `playbook_plays.diagram` stores player positions and routes. See `types/football.ts` for `PlayAttributes` and `PlayDiagram` interfaces.

**RLS:** Users see only their own teams/games/videos. Play instances are team-scoped. Personal playbooks (team_id = NULL) are user-scoped.

---

## PlayBuilder System

The PlayBuilder renders an SVG football field (700x400px) where coaches position players, draw routes, and assign plays.

**Coordinate system:**
- Line of scrimmage (LOS): y = 200
- Offense: y >= 200 | Defense: y < 200 | Neutral zone: y = 194-206

**footballConfig.ts** is the single source of truth for all formations (40+ offensive, defensive, special teams), play attributes, blocking assignments, route types, and coverage schemes. All formations and attributes are defined here.

**footballRules.ts** validates formations: 7 on LOS, max 4 in backfield, offsides detection, motion rules (1 player, off LOS, not toward LOS).

**Modular components** in `src/components/playbuilder/`:
- `PlayBuilder.tsx` — Main orchestrator
- Position sections: `OffensiveLineSection`, `BacksSection`, `ReceiversSection`, `DefensiveLineSection`, `LinebackersSection`, `DBSection`
- Helpers: `FormationMetadata`, `ValidationModal`

**Play codes** are auto-generated: `P-001`, `P-002`, etc.

**Dummy formations:** Defense plays can include dummy offense (and vice versa), flagged with `isDummy: true`.

---

## Film System Architecture (Post-Refactor)

The film tagging system was refactored from a 6,493-line "god component" to a modular architecture. See `docs/REFACTOR_PLAN.md` for full history.

### Component Tree
```
GameFilmPage (tag/page.tsx, ~849 lines)
├── FilmProvider (context)
│   └── GameFilmPageInner
│       ├── FilmPageHeader — Game info, tier badge, back button
│       ├── StatusBar — Resume button, score, tagging status
│       ├── VideoPlaybackPanel — Video element, error states, camera switch overlay
│       ├── TagPageUnifiedTimeline — Multi-camera timeline visualization
│       ├── MarkerControls — Period/custom markers, marker timeline
│       ├── PlayTimelineBar — Tagged plays visualization
│       ├── PlayListPanel — Filtered play list with edit/delete/jump
│       ├── TaggingPanel — Modal form for tagging plays
│       └── DirectorsCut — Multi-camera switching (dynamic import)
```

### Extracted Hooks (in `panels/hooks/`)
| Hook | Purpose | Lines |
|------|---------|-------|
| `useMarkers` | Marker CRUD, quarter detection, menu close | ~220 |
| `useTimelinePlayback` | Camera switch, virtual playback, timeline state | ~500 |
| `useFilmDataFetching` | Load game, videos, plays, players, drives | ~150 |
| `useVideoManagement` | Video selection, URL management | ~120 |
| `usePlayTagging` | Tag modal state, play editing | ~100 |
| `useGameScoring` | Score tracking, tier selection | ~150 |
| `useVideoUpload` | Resumable upload with tus-js-client | ~200 |
| `useTaggingForm` | Form-adjacent state (AI predictions, field styling) | ~180 |
| `useTagSubmission` | Form submission logic, drive assignment | ~610 |

### Services (in `lib/services/`)
| Service | Purpose |
|---------|---------|
| `CameraSyncService` | Offset calculations, gap detection, lane building, coverage checks |
| `PlayTaggingService` | Play instance CRUD, validation, player participation |
| `VideoMarkerService` | Game marker CRUD, quarter detection, auto-generation |
| `TimelinePlaybackService` | Active clip lookup, sync offset, clip placement |
| `AnalyticsService` | Success rate, yards per play, situational analysis |

### State Management Pattern
1. **FilmContext** — Shared state via useReducer (data, playback, tagging, timeline)
2. **useFilmStateBridge** — Connects tag page local state to context (allows gradual migration)
3. **Selectors** — 30+ selector functions in `filmSelectors.ts` for derived state
4. **Local state** — UI-only state (collapsed panels, selected checkboxes) stays in components

### Error Handling Flow
```
Component error → ErrorBoundary catches
                → clientError() logs to console (dev)
                → POST /api/errors/report (prod)
                → logError() → Supabase error_logs table
```

### Testing
- **Unit tests:** 146 tests via Vitest (`npm run test:unit`)
- **Integration tests:** 14 tests via Playwright (`npm run test:e2e`)
- **Bundle analysis:** `npm run analyze` (uses @next/bundle-analyzer)

---

## UI/UX Guidelines

**Two design themes during transition:**

1. **Marketing pages (Dark)** — See `DESIGN_SYSTEM.md`. Background `#0d1117`, accent `#a3e635` (lime green).
2. **App/Dashboard pages (Light)** — White backgrounds, dark text. Migrating to dark gradually.

**Brand colors (Tailwind):** `bg-brand-dark`, `bg-brand-surface`, `bg-brand-elevated`, `bg-brand-green`, `bg-brand-green-light`

### Form Inputs (CRITICAL)

Always add `text-gray-900` to inputs, selects, and textareas on app pages. Without it, typed text is nearly invisible.

```typescript
// Standard input
className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
```

### Buttons

**App:** Primary `bg-black text-white hover:bg-gray-800` | Secondary `border border-gray-300 text-gray-700 hover:bg-gray-50`

**Marketing:** Primary `bg-brand-green text-brand-dark hover:bg-brand-green-light` | Secondary `bg-white/10 text-white hover:bg-white/20 border border-white/20`

### Typography

**App:** Headings `text-gray-900` | Body `text-gray-600` | Labels `text-sm font-medium text-gray-700`

**Marketing:** Headings `text-white` | Body `text-gray-300` | Labels `text-sm font-medium text-gray-300`

---

## Related Docs

- `DESIGN_SYSTEM.md` — Marketing page design system
- `DOCUMENTATION_PROCESS.md` — How to update user-facing docs
- `docs/MULTI_COACH_ANALYTICS_SPEC.md` — Multi-coach and analytics tier design spec
- `docs/REFACTOR_PLAN.md` — Film system refactor plan and completion status
- `docs/FILM_STATE_MACHINE.md` — State machine documentation for film tagging page
