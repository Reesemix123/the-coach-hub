# Claude Code Prompt: Youth Coach Hub Documentation System

## Context

You are building an in-app documentation/help system for **Youth Coach Hub**, a football coaching SaaS application. This documentation will live inside the application as a top-level navigation item. The system must be maintainable as features evolve and include automated screenshot generation using Playwright.

**Tech Stack:**
- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase (Auth, Database, Storage)
- Stripe (Subscriptions)

**Design Philosophy:**
- Apple-like aesthetic: clean, minimal, generous whitespace
- Neutral colors (white, black, gray with subtle accents)
- Crisp sans-serif typography (Inter or system fonts)
- Simple balanced layouts with clear hierarchy through scale and contrast
- No heavy decoration; every element serves a purpose

---

## Overview: What We're Building

### 1. Navigation Addition
Add a "Guide" menu item to the top navigation bar (between existing nav items and the user menu). This opens the documentation interface.

### 2. Documentation Interface
A dedicated page/modal with:
- Left sidebar showing documentation sections (collapsible categories)
- Main content area displaying selected documentation
- "View Complete Guide" button that shows full documentation
- Breadcrumb navigation
- Search functionality (future enhancement, stub for now)

### 3. Automated Screenshots
Playwright scripts that capture screenshots of key application screens, automatically updating documentation images when the UI changes.

### 4. Maintenance System
A structured approach to keep documentation current as features evolve.

---

## Phase 1: Documentation Structure & Content

### Create Documentation Content Files

Create a `docs/` directory in the project root with markdown files organized by topic. The documentation system will read these files and render them.

**File Structure:**
```
docs/
├── index.md                    # Overview/Welcome
├── getting-started/
│   ├── index.md               # Getting started overview
│   ├── creating-account.md
│   ├── creating-first-team.md
│   └── inviting-coaches.md
├── teams/
│   ├── index.md
│   ├── team-settings.md
│   ├── roster-management.md
│   └── seasons.md
├── playbook/
│   ├── index.md
│   ├── creating-plays.md
│   ├── organizing-playbook.md
│   └── play-builder.md
├── film/
│   ├── index.md
│   ├── uploading-film.md
│   ├── tagging-plays.md
│   ├── tagging-levels.md        # Quick/Standard/Comprehensive
│   └── multi-camera.md
├── analytics/
│   ├── index.md
│   ├── team-analytics.md
│   ├── season-trends.md
│   └── player-stats.md
├── roles-permissions/
│   ├── index.md
│   ├── owner-head-coach.md
│   ├── assistant-coach.md
│   └── managing-team-members.md
├── subscriptions/
│   ├── index.md
│   ├── tier-comparison.md       # Basic/Plus/Premium features
│   ├── upgrading.md
│   └── billing.md
├── ai-features/
│   ├── index.md
│   ├── ai-assistant.md          # Coming soon
│   └── ai-film-tagging.md       # Coming soon
└── support/
    ├── index.md
    ├── providing-feedback.md
    └── reporting-bugs.md
```

### Documentation Content Outline

Write each markdown file with the following structure:
- Frontmatter with title, description, order (for sorting)
- Clear headings (H2, H3 only—no H1 since title is in frontmatter)
- Short, scannable paragraphs
- Screenshot placeholders using format: `![Description](/docs/screenshots/filename.png)`
- Tip/Note callouts using blockquotes with emoji: `> 💡 **Tip:** ...`

**Example Markdown Structure:**
```markdown
---
title: "Uploading Game Film"
description: "Learn how to upload game footage from multiple camera angles"
order: 1
---

Upload game film directly from your phone, camera, or drone. Youth Coach Hub supports multiple camera angles for a complete view of every play.

## Supported Formats

We accept most common video formats including MP4, MOV, and AVI. Files are automatically processed for playback optimization.

## Upload Steps

Navigate to the **Film** tab and select your team. Click **Upload Film** to begin.

![Film upload interface](/docs/screenshots/film-upload.png)

> 💡 **Tip:** Name your uploads by opponent and date (e.g., "vs Lions - Week 3") to keep your film library organized.

## Multi-Camera Support

Based on your subscription tier, you can upload multiple camera angles per game:

| Tier | Camera Angles |
|------|---------------|
| Basic | 1 |
| Plus | 3 |
| Premium | 5 |

Each angle is synced to the same play timeline, allowing you to switch views during review.
```

---

## Phase 2: React Components

### 2.1 Documentation Navigation Config

Create a configuration file that defines the documentation structure.

**File: `src/config/docs-navigation.ts`**
```typescript
export interface DocSection {
  title: string;
  slug: string;
  icon?: string; // Lucide icon name
  children?: DocSection[];
  comingSoon?: boolean;
}

export const docsNavigation: DocSection[] = [
  {
    title: "Getting Started",
    slug: "getting-started",
    icon: "Rocket",
    children: [
      { title: "Creating Your Account", slug: "creating-account" },
      { title: "Creating Your First Team", slug: "creating-first-team" },
      { title: "Inviting Coaches", slug: "inviting-coaches" },
    ],
  },
  {
    title: "Teams",
    slug: "teams",
    icon: "Users",
    children: [
      { title: "Team Settings", slug: "team-settings" },
      { title: "Roster Management", slug: "roster-management" },
      { title: "Seasons", slug: "seasons" },
    ],
  },
  {
    title: "Playbook",
    slug: "playbook",
    icon: "BookOpen",
    children: [
      { title: "Creating Plays", slug: "creating-plays" },
      { title: "Organizing Your Playbook", slug: "organizing-playbook" },
      { title: "Play Builder", slug: "play-builder" },
    ],
  },
  {
    title: "Film",
    slug: "film",
    icon: "Video",
    children: [
      { title: "Uploading Film", slug: "uploading-film" },
      { title: "Tagging Plays", slug: "tagging-plays" },
      { title: "Tagging Levels", slug: "tagging-levels" },
      { title: "Multi-Camera", slug: "multi-camera" },
    ],
  },
  {
    title: "Analytics",
    slug: "analytics",
    icon: "BarChart3",
    children: [
      { title: "Team Analytics", slug: "team-analytics" },
      { title: "Season Trends", slug: "season-trends" },
      { title: "Player Stats", slug: "player-stats" },
    ],
  },
  {
    title: "Roles & Permissions",
    slug: "roles-permissions",
    icon: "Shield",
    children: [
      { title: "Owner / Head Coach", slug: "owner-head-coach" },
      { title: "Assistant Coach", slug: "assistant-coach" },
      { title: "Managing Team Members", slug: "managing-team-members" },
    ],
  },
  {
    title: "Subscriptions",
    slug: "subscriptions",
    icon: "CreditCard",
    children: [
      { title: "Tier Comparison", slug: "tier-comparison" },
      { title: "Upgrading Your Plan", slug: "upgrading" },
      { title: "Billing & Payments", slug: "billing" },
    ],
  },
  {
    title: "AI Features",
    slug: "ai-features",
    icon: "Sparkles",
    children: [
      { title: "AI Assistant", slug: "ai-assistant", comingSoon: true },
      { title: "AI Film Tagging", slug: "ai-film-tagging", comingSoon: true },
    ],
  },
  {
    title: "Support",
    slug: "support",
    icon: "HelpCircle",
    children: [
      { title: "Providing Feedback", slug: "providing-feedback" },
      { title: "Reporting Bugs", slug: "reporting-bugs" },
    ],
  },
];
```

### 2.2 Guide Page Component

Create a dedicated page for the documentation viewer.

**File: `src/app/guide/page.tsx`**
**File: `src/app/guide/[...slug]/page.tsx`** (for nested routes)

This should include:
- Sidebar with collapsible sections (use state to track expanded sections)
- Main content area that renders markdown
- Responsive design (sidebar collapses to menu on mobile)
- Smooth transitions between sections

### 2.3 Documentation Renderer

Use `react-markdown` with plugins for rendering:
- `remark-gfm` for tables and strikethrough
- `rehype-highlight` for code syntax highlighting
- Custom components for images, callouts, and tables

**File: `src/components/docs/DocRenderer.tsx`**

### 2.4 Navigation Link

Add "Guide" to the main navigation.

**Update: `src/components/navigation/` or wherever your nav component lives**

Add between existing nav items:
```tsx
<Link 
  href="/guide" 
  className="text-gray-600 hover:text-black transition-colors"
>
  Guide
</Link>
```

Or use a modal/slide-over approach if you prefer the documentation to overlay the current page.

---

## Phase 3: Playwright Screenshot Automation

### 3.1 Playwright Setup

Install and configure Playwright for automated screenshots.

```bash
npm install -D @playwright/test
npx playwright install
```

**File: `playwright.config.ts`**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/screenshots',
  outputDir: './public/docs/screenshots',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 3.2 Screenshot Scripts

Create screenshot capture scripts organized by documentation section.

**File: `e2e/screenshots/capture-screenshots.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

// Test user credentials (create a dedicated test account)
const TEST_USER = {
  email: 'docs-screenshots@youthcoachhub.com',
  password: process.env.DOCS_TEST_PASSWORD,
};

test.describe('Documentation Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/teams');
  });

  test.describe('Getting Started', () => {
    test('dashboard overview', async ({ page }) => {
      await page.goto('/teams');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/dashboard-overview.png',
        fullPage: false,
      });
    });

    test('create team modal', async ({ page }) => {
      await page.goto('/teams');
      await page.click('text=Create Team');
      await page.waitForSelector('[role="dialog"]');
      await page.screenshot({ 
        path: 'public/docs/screenshots/create-team-modal.png',
      });
    });
  });

  test.describe('Film', () => {
    test('film upload interface', async ({ page }) => {
      await page.goto('/film');
      // Navigate to a specific team's film section
      await page.click('text=Select a team');
      await page.click('text=Demo Team'); // Adjust to your test team
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/film-upload.png',
      });
    });

    test('tagging interface', async ({ page }) => {
      await page.goto('/film/[game-id]'); // Adjust to actual test game
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/tagging-interface.png',
      });
    });

    test('tagging tier selector', async ({ page }) => {
      await page.goto('/film/[game-id]');
      // Trigger tier selector modal
      await page.click('[data-testid="tier-selector"]');
      await page.waitForSelector('[role="dialog"]');
      await page.screenshot({ 
        path: 'public/docs/screenshots/tagging-tiers.png',
      });
    });
  });

  test.describe('Playbook', () => {
    test('playbook list', async ({ page }) => {
      await page.goto('/playbook');
      await page.click('text=Select a team');
      await page.click('text=Demo Team');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/playbook-list.png',
      });
    });

    test('play builder', async ({ page }) => {
      await page.goto('/playbook/new');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/play-builder.png',
      });
    });
  });

  test.describe('Analytics', () => {
    test('team analytics dashboard', async ({ page }) => {
      await page.goto('/teams/[team-id]/analytics'); // Adjust
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/team-analytics.png',
      });
    });
  });

  test.describe('Settings', () => {
    test('team settings', async ({ page }) => {
      await page.goto('/teams/[team-id]/settings');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/team-settings.png',
      });
    });

    test('team members management', async ({ page }) => {
      await page.goto('/teams/[team-id]/members');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/team-members.png',
      });
    });
  });

  test.describe('Subscriptions', () => {
    test('pricing page', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/pricing-tiers.png',
        fullPage: true,
      });
    });

    test('subscription management', async ({ page }) => {
      await page.goto('/settings/subscription');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: 'public/docs/screenshots/subscription-management.png',
      });
    });
  });
});
```

### 3.3 NPM Scripts

Add convenience scripts to `package.json`:

```json
{
  "scripts": {
    "docs:screenshots": "playwright test e2e/screenshots/",
    "docs:screenshots:update": "playwright test e2e/screenshots/ --update-snapshots"
  }
}
```

---

## Phase 4: Key Documentation Content

### 4.1 Subscription Tiers (Critical for Commercial)

**File: `docs/subscriptions/tier-comparison.md`**

```markdown
---
title: "Subscription Tiers"
description: "Compare features across Basic, Plus, and Premium plans"
order: 1
---

Youth Coach Hub offers flexible pricing designed for volunteer coaches and youth programs. Start free and upgrade as your needs grow.

## Plan Comparison

| Feature | Basic (Free) | Plus ($29/mo) | Premium ($79/mo) |
|---------|--------------|---------------|------------------|
| Teams | 1 | 3 | Unlimited |
| Games Stored | 1 | Unlimited | Unlimited |
| Camera Angles | 1 | 3 | 5 |
| Playbook Plays | 25 | Unlimited | Unlimited |
| AI Assistant | — | ✓ | ✓ |
| AI Film Tagging | — | Limited | Full Access |
| Analytics | Basic | Standard | Advanced |
| Priority Support | — | — | ✓ |

## Which Plan Is Right for You?

**Basic (Free)** — Perfect for trying out the platform. Tag one game, build a small playbook, and see if Youth Coach Hub fits your coaching style.

**Plus ($29/month)** — Ideal for most youth and JV coaches. Unlimited game storage, multi-camera support, and AI-powered tools to save time on film review.

**Premium ($79/month)** — For programs that need it all. Advanced analytics, maximum camera angles, and full AI capabilities for comprehensive film analysis.

> 💡 **Tip:** Annual plans save you 2 months—pay for 10 months, get 12.

![Pricing comparison](/docs/screenshots/pricing-tiers.png)
```

### 4.2 Tagging Levels

**File: `docs/film/tagging-levels.md`**

```markdown
---
title: "Film Tagging Levels"
description: "Choose the right tagging depth for your coaching goals"
order: 3
---

Youth Coach Hub offers three tagging levels so you can match your time investment to your coaching goals. Choose the level that fits your needs for each game.

## Quick Tagging

**Best for:** Recording what happened

Capture the essentials in 15-20 seconds per play. Track score, yards, turnovers, and penalties. Walk away with a clear record of the game.

**You'll answer:** "What happened in this game?"

**Enables:** Game record, season stats, turnover tracking

## Standard Tagging

**Best for:** Understanding what works

Add play-level context in 30-45 seconds per play. See which plays succeed in different situations and identify tendencies.

**You'll answer:** "Why did it work or not work?"

**Enables:** Play effectiveness analysis, situational tendencies, game plan adjustments, opponent scouting

## Comprehensive Tagging

**Best for:** Player development

Full player-level tracking in 2-3 minutes per play. Evaluate individual performance, track player grades, and make informed lineup decisions.

**You'll answer:** "How did each player perform?"

**Enables:** Player grades, position group analysis, development tracking, playing time decisions

![Tagging level selector](/docs/screenshots/tagging-tiers.png)

> 💡 **Tip:** You can use different tagging levels for different games. Use Quick for regular season games and Comprehensive for playoff preparation.

## How Tagging Level Affects Analytics

| Analytics Feature | Quick | Standard | Comprehensive |
|-------------------|-------|----------|---------------|
| Game summaries | ✓ | ✓ | ✓ |
| Season statistics | ✓ | ✓ | ✓ |
| Play success rates | — | ✓ | ✓ |
| Situational analysis | — | ✓ | ✓ |
| Player grades | — | — | ✓ |
| Position reports | — | — | ✓ |
```

### 4.3 Roles & Permissions

**File: `docs/roles-permissions/owner-head-coach.md`**

```markdown
---
title: "Owner / Head Coach"
description: "Full control over your team and subscription"
order: 1
---

The Owner (typically the Head Coach) has full administrative control over the team and subscription.

## Owner Capabilities

**Team Management**
- Create and delete teams
- Edit team settings (name, level, colors)
- Manage roster and player information
- Set season dates

**People Management**
- Invite assistant coaches
- Set member roles and permissions
- Remove team members

**Film & Playbook**
- Upload and delete game film
- Create, edit, and organize plays
- Access all tagging levels
- Delete any tagged plays

**Subscription & Billing**
- View and change subscription tier
- Update payment method
- View billing history
- Cancel subscription

**Analytics**
- Access all analytics dashboards
- Export reports

> ⚠️ **Important:** There can only be one Owner per team. To transfer ownership, contact support.

## Managing Your Team

Navigate to **Teams** → Select your team → **Settings** to access team configuration.

![Team settings](/docs/screenshots/team-settings.png)

To manage team members, go to **Settings** → **Team Members**.

![Team members management](/docs/screenshots/team-members.png)
```

**File: `docs/roles-permissions/assistant-coach.md`**

```markdown
---
title: "Assistant Coach"
description: "Collaborate on film review and playbook without admin access"
order: 2
---

Assistant Coaches can contribute to film review and playbook development without access to administrative functions.

## Assistant Coach Capabilities

**Can Do:**
- View all games and film
- Tag plays (limited by team's subscription tier)
- View and use the playbook
- Add plays to playbook (if enabled by Owner)
- View analytics dashboards
- Add comments and notes

**Cannot Do:**
- Delete games or film
- Delete plays created by others
- Edit team settings
- Invite or remove team members
- Access billing or subscription settings
- Export full reports (can view only)

## Getting Started as an Assistant

When the Head Coach invites you, you'll receive an email with a link to join the team.

1. Click the invitation link
2. Create your account (or sign in if you already have one)
3. You'll be added to the team automatically

> 💡 **Tip:** Ask your Head Coach to assign you specific games for film review to coordinate your team's efforts.
```

### 4.4 Support & Feedback

**File: `docs/support/providing-feedback.md`**

```markdown
---
title: "Providing Feedback"
description: "Help us make Youth Coach Hub better"
order: 1
---

We're building Youth Coach Hub for coaches like you, and your feedback shapes the product.

## Ways to Share Feedback

**In-App Feedback**
Click the **Feedback** button in the bottom-right corner of any page. Describe what's working, what's not, or what you wish the app could do.

**Feature Requests**
Have an idea for a new feature? Use the feedback button and select "Feature Request." Tell us what you're trying to accomplish and how a new feature would help.

**Rate Your Experience**
After using key features, you may see a quick satisfaction survey. Your ratings help us prioritize improvements.

## What Makes Great Feedback

- **Be specific:** "The tagging interface is hard to use on my phone" is more helpful than "the app is confusing"
- **Include context:** What were you trying to do? What happened?
- **Share your setup:** Phone or computer? What browser? How many players on your roster?

> 💡 We read every piece of feedback. While we can't respond to each one individually, your input directly influences our roadmap.
```

**File: `docs/support/reporting-bugs.md`**

```markdown
---
title: "Reporting Bugs"
description: "Found a problem? Here's how to report it"
order: 2
---

If something isn't working right, we want to know.

## How to Report a Bug

1. Click the **Feedback** button (bottom-right corner)
2. Select **Report a Problem**
3. Describe what happened and what you expected to happen
4. If possible, include:
   - Steps to reproduce the issue
   - What device/browser you're using
   - Screenshots (you can paste or upload them)

## Common Issues & Quick Fixes

**Video won't upload**
- Check your file format (MP4, MOV, AVI supported)
- Ensure the file is under 2GB
- Try a different browser if the upload stalls

**Can't see my team**
- Refresh the page
- Check that you're logged into the correct account
- Verify your invitation was accepted

**Analytics not showing**
- Analytics require at least one tagged game
- Processing can take a few minutes after tagging

## Urgent Issues

For critical problems that prevent you from using the app during a game or practice, email **support@youthcoachhub.com** with "URGENT" in the subject line.
```

### 4.5 AI Features (Coming Soon)

**File: `docs/ai-features/index.md`**

```markdown
---
title: "AI Features"
description: "AI-powered tools to save time and improve your coaching"
order: 1
---

Youth Coach Hub is building AI features designed specifically for youth and high school coaches. Our goal: reduce the tedious parts of film review so you can focus on coaching.

## What's Coming

**AI Assistant** — A coaching assistant that knows your team's data. Ask questions like "What plays work best on third down?" or "How has our rushing game improved this season?" and get answers based on your actual game film.

**AI Film Tagging** — Let AI handle the basics. Our system will pre-tag play results, formations, and personnel based on video analysis, reducing your tagging time by 50-70%. You'll always have final say—AI suggests, you confirm.

## Our Approach

We're building AI as an **accelerator**, not a replacement. You know your team better than any algorithm. AI handles the tedious parts while you make the coaching decisions.

> 🔔 **Stay Updated:** We'll notify you when AI features launch. Plus and Premium subscribers will get early access.

## Current Status

| Feature | Status |
|---------|--------|
| AI Assistant | In Development |
| AI Film Tagging | Coming Soon |
```

---

## Phase 5: Maintenance System

### 5.1 Documentation Maintenance Workflow

Create a process for keeping documentation current:

**File: `docs/MAINTENANCE.md`** (internal, not published)

```markdown
# Documentation Maintenance Guide

## When to Update Documentation

- **New Feature:** Add documentation before feature ships
- **UI Changes:** Update screenshots and instructions
- **Feature Removal:** Archive or remove related docs
- **Bug Fixes:** Update if user-facing behavior changes

## Screenshot Update Process

1. Run `npm run docs:screenshots` after UI changes
2. Review generated screenshots in `public/docs/screenshots/`
3. Commit updated screenshots with your feature branch

## Adding New Documentation

1. Create markdown file in appropriate `docs/` subdirectory
2. Add frontmatter with title, description, order
3. Update `src/config/docs-navigation.ts` to include new section
4. Add screenshot captures to `e2e/screenshots/capture-screenshots.spec.ts`
5. Run screenshot generation
6. Test locally at `/guide`

## Quality Checklist

- [ ] Screenshots are current (match production UI)
- [ ] All links work
- [ ] No placeholder text remains
- [ ] Frontmatter is complete
- [ ] Section appears in navigation
```

### 5.2 CI Integration (Optional)

Add a GitHub Action to verify documentation builds and screenshots are up-to-date:

**File: `.github/workflows/docs-check.yml`**

```yaml
name: Documentation Check

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'src/app/guide/**'
      - 'src/components/docs/**'

jobs:
  docs-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      # Optionally: run screenshot tests
      # - run: npm run docs:screenshots
```

---

## Implementation Order

Execute phases in this order:

### Sprint 1: Foundation
1. Create `docs/` directory structure
2. Create documentation navigation config
3. Build Guide page with sidebar and markdown rendering
4. Add "Guide" link to navigation
5. Write 3-4 core documentation files to test the system

### Sprint 2: Core Documentation
1. Complete all documentation markdown files
2. Write subscription tier comparison
3. Write tagging levels documentation
4. Write roles & permissions documentation
5. Write support documentation

### Sprint 3: Screenshots
1. Set up Playwright
2. Create test account with sample data
3. Write screenshot capture scripts
4. Generate initial screenshots
5. Embed screenshots in documentation

### Sprint 4: Polish & Maintenance
1. Add search functionality (optional, can stub)
2. Mobile-responsive sidebar
3. Print-friendly styles for full documentation
4. Create maintenance documentation
5. Document screenshot update process

---

## Dependencies to Install

```bash
npm install react-markdown remark-gfm rehype-highlight gray-matter
npm install -D @playwright/test
npx playwright install
```

---

## Testing Checklist

- [ ] Guide link appears in navigation
- [ ] Clicking Guide navigates to documentation page
- [ ] Sidebar shows all sections
- [ ] Sections expand/collapse properly
- [ ] Clicking a topic loads the correct content
- [ ] Markdown renders correctly (headings, tables, images, callouts)
- [ ] Screenshots display properly
- [ ] Mobile layout works (sidebar becomes hamburger menu)
- [ ] "Coming Soon" badge shows on AI features
- [ ] View Complete Guide shows all content in order

---

## Files to Create/Modify Summary

**New Files:**
- `docs/` - All markdown documentation files
- `src/config/docs-navigation.ts`
- `src/app/guide/page.tsx`
- `src/app/guide/[...slug]/page.tsx`
- `src/components/docs/DocsSidebar.tsx`
- `src/components/docs/DocRenderer.tsx`
- `src/components/docs/DocsSearch.tsx` (stub)
- `e2e/screenshots/capture-screenshots.spec.ts`
- `playwright.config.ts`

**Modified Files:**
- `src/components/navigation/` - Add Guide link
- `package.json` - Add scripts and dependencies

---

## Commercial Considerations 🔔

1. **Search functionality** will become important as documentation grows. The stub allows you to add it later without restructuring.

2. **Version-specific documentation** may be needed if you have breaking changes. Consider adding version selector in future.

3. **Localization** - If you expand internationally, the markdown-based system makes translation easier.

4. **Analytics on documentation** - Consider tracking which docs are viewed most to understand user pain points.

5. **Video tutorials** - The screenshot system can be extended to capture screen recordings for complex features.
```