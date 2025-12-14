# Tiered Film Tagging System Specification

## Overview

This document specifies a tiered tagging system that simplifies the film tagging experience by showing only relevant fields based on the coach's selected depth level. The system includes three tiers: **Quick**, **Standard**, and **Comprehensive**.

> **Naming Note:** Tagging tiers (Quick/Standard/Comprehensive) are intentionally distinct from subscription tiers (Basic/Plus/Premium) to avoid confusion. All subscription levels can access all tagging depths — the difference is in AI assistance and storage limits.

---

## Tier Definitions

| Tier | Purpose | Coach Question | Enables | Time per Play |
|------|---------|----------------|---------|---------------|
| **Quick** | Game summary | "What happened?" | Game record, season stats, turnover tracking, big play highlights | ~15-20 sec |
| **Standard** | Play analysis | "Why did it work?" | Play/scheme effectiveness, situational tendencies, opponent prep, coaching decision insights | ~30-45 sec |
| **Comprehensive** | Player evaluation | "How did each player perform?" | Player grades, position group analysis, development tracking, lineup decisions | ~2-3 min |

### UI Copy for Tier Selector

#### Quick
**Track the game, remember the season**

Capture game essentials: score, total yards, turnovers, and key moments. Get a clear record of what happened without the time investment.

#### Standard
**Understand what's working, prepare for next week**

Add play-level context to see which plays and formations succeed in different situations. Identify tendencies and adjust your game plan.

#### Comprehensive
**Evaluate and develop every player**

Full player-level tracking including grades, assignments, and individual performance metrics. Know exactly who's contributing and where to focus practice time.

---

## AI Assist Integration (Future)

### Strategic Alignment

The Quick tier fields were intentionally designed to align with what AI can reliably detect from variable-quality game film:

| Field Type | AI Confidence | Tier |
|------------|---------------|------|
| Play boundaries (snap → whistle) | 75-85% | Quick |
| Run vs Pass | 70-80% | Quick |
| Basic formation | 60-75% | Quick |
| Field zone / yard line | 60-70% | Quick |
| Result (gain/loss/turnover) | 65-75% | Quick |
| Player attribution (who touched ball) | 30-50% | Standard |
| Player grades and assignments | N/A | Comprehensive |

### Commercial Model

- **AI Assist is a paid feature** (Plus and Premium subscriptions)
- Free (Basic subscription) users tag manually but benefit from simplified Quick tier
- Future consideration: Allow free users a "taste" (e.g., AI on first 5 plays per game)

### Future Implementation Placeholder

```typescript
// TODO: Future AI Assist integration
// When AI assist is enabled (paid subscribers only):
// 1. On play slice, send frame(s) to AI service
// 2. Pre-populate Quick-tier fields with AI suggestions
// 3. Visually indicate AI-filled fields (subtle highlight or icon)
// 4. Track corrections for model improvement
// 5. Store tag_source ('manual' | 'ai' | 'ai_corrected') for analytics
```

### Database Consideration (Optional for MVP)

Consider adding metadata columns for future AI integration:

```sql
-- Optional: Add now to avoid future migration
tag_source VARCHAR(15) DEFAULT 'manual' -- 'manual', 'ai', 'ai_corrected'
ai_confidence DECIMAL(3,2) -- 0.00 to 1.00 (nullable)
```

---

## Tier Selection UX

### When & Where
- Tier selection appears when the coach enters the tagging interface, **BEFORE** they can tag the first play
- After film is loaded and plays are sliced, show a modal or prominent selector requiring tier choice before proceeding
- This is a **required selection** - coaches cannot skip it

### Persistence
- Store the selected tier at the game/film level
- All plays in that game use the same tier

### Upgrading
- Allow one-way upgrade only: Quick → Standard → Comprehensive
- **Do NOT allow downgrading** mid-game
- Show confirmation when upgrading: "Upgrading will add more fields to tag. Previously tagged plays won't have this data unless you re-tag them. Continue?"

### No Default
- Always require explicit tier selection per game
- No account-level default preference

### Tier Indicator
- Display a subtle tier badge in the tagging interface header showing the current tier
- Small pill/badge style (e.g., "Standard")

### Help Section
Include an expandable "Which should I choose?" section in the tier selector:
- "Choose **Quick** if you have limited time or just want to track the game"
- "Choose **Standard** if you're preparing for your next opponent"
- "Choose **Comprehensive** if you're evaluating individual players"

### Component Style
- Card-based selector with Apple aesthetic
- Show tier name, tagline, description, and estimated time per play
- Generous whitespace, subtle shadows
- Clean accordion styling for help section

---

## Field Mapping

### Offense

| Field | Quick | Standard | Comprehensive |
|-------|:-----:|:--------:|:-------------:|
| Drive Context | ✓ | ✓ | ✓ |
| Situation (Down, Distance, Yard Line, Hash) | ✓ | ✓ | ✓ |
| Play (from playbook) | ✓ | ✓ | ✓ |
| Formation | ✓ | ✓ | ✓ |
| Play Type (Run/Pass) | ✓ | ✓ | ✓ |
| Result | ✓ | ✓ | ✓ |
| Yards Gained | ✓ | ✓ | ✓ |
| First Down | ✓ | ✓ | ✓ |
| Notes | ✓ | ✓ | ✓ |
| Fumbled | ✓ | ✓ | ✓ |
| Direction | | ✓ | ✓ |
| QB | | ✓ | ✓ |
| Ball Carrier | | ✓ | ✓ |
| Target (pass plays) | | ✓ | ✓ |
| Drop | | ✓ | ✓ |
| Contested Catch | | ✓ | ✓ |
| QB Performance section | | | ✓ |
| RB Performance section | | | ✓ |
| Receiver Performance section | | | ✓ |
| O-Line Performance section | | | ✓ |
| Special Events section | | | ✓ |

### Defense

| Field | Quick | Standard | Comprehensive |
|-------|:-----:|:--------:|:-------------:|
| Drive Context | ✓ | ✓ | ✓ |
| Situation (Down, Distance, Yard Line, Hash) | ✓ | ✓ | ✓ |
| Opponent Play Type | ✓ | ✓ | ✓ |
| Result | ✓ | ✓ | ✓ |
| Yards Gained | ✓ | ✓ | ✓ |
| First Down | ✓ | ✓ | ✓ |
| Notes | ✓ | ✓ | ✓ |
| Big Plays (TFL, Sack, Forced Fumble, Pass Breakup) | ✓ | ✓ | ✓ |
| Formation | | ✓ | ✓ |
| Opponent Player Number | | ✓ | ✓ |
| Pass Rush / Pressured QB | | ✓ | ✓ |
| Coverage (Player in Coverage) | | ✓ | ✓ |
| Opponent QB Evaluation | | ✓ | ✓ |
| Tacklers (multi-select + primary) | | ✓ | ✓ |
| Missed Tackles | | | ✓ |
| DL Performance section | | | ✓ |
| LB Performance section | | | ✓ |
| DB Performance section | | | ✓ |

### Special Teams

| Field | Quick | Standard | Comprehensive |
|-------|:-----:|:--------:|:-------------:|
| Special Teams Unit | ✓ | ✓ | ✓ |
| Result | ✓ | ✓ | ✓ |
| Distance/Yards | ✓ | ✓ | ✓ |
| Fair Catch / Touchback / Muffed | ✓ | ✓ | ✓ |
| Penalty on Play | ✓ | ✓ | ✓ |
| Kicker / Punter / Returner | | ✓ | ✓ |
| Kickoff Type / Punt Type | | ✓ | ✓ |
| Blocked By | | ✓ | ✓ |
| Coverage Tackler / Gunner | | | ✓ |
| Long Snapper | | | ✓ |
| Snap Quality | | | ✓ |
| Holder | | | ✓ |

---

## Tagging Interface Implementation

### Conditional Rendering
- Based on the game's selected tier, show/hide fields accordingly
- Fields not in the tier should **not render at all** (not disabled, not collapsed—gone)

### Remove Old Tier Labels
Remove all existing "Tier 3" labels from collapsible sections:
- QB Performance
- RB Performance
- Receiver Performance
- O-Line Performance
- Defensive Stats
- DL Performance
- LB Performance
- DB Performance

### Section Organization
- Keep the existing section groupings
- Only render sections that apply to the selected tier

### Form Validation
- Only validate fields that are visible for the selected tier
- Required fields should only be enforced for visible fields

### Incomplete Play Indicator
- On play tiles/list, show a small visual indicator (dot or icon) on plays missing data for the current tier level
- Helps coaches identify which plays need additional tagging after an upgrade

### Smooth Transitions
- If a coach upgrades mid-game, animate new fields appearing
- Previously tagged plays retain their data; new fields will be empty for those plays

---

## Report Updates

### Tier Requirement Messaging

Replace all instances of "Tier 2+ feature" and "Tier 3 feature" with new naming:

| Report Section | Min Tier | Message When Data Missing |
|----------------|----------|---------------------------|
| QB Stats | Standard | "Tag games at **Standard** level to see quarterback statistics." |
| RB Stats | Standard | "Tag games at **Standard** level to see running back statistics." |
| WR/TE Stats | Standard | "Tag games at **Standard** level to see receiver statistics." |
| Tackler Attribution | Standard | "Tag games at **Standard** level to see tackler statistics." |
| O-Line Performance | Comprehensive | "Tag games at **Comprehensive** level to see offensive line performance." |
| DL Stats | Comprehensive | "Tag games at **Comprehensive** level to see defensive line statistics." |
| LB Stats | Comprehensive | "Tag games at **Comprehensive** level to see linebacker statistics." |
| DB Stats | Comprehensive | "Tag games at **Comprehensive** level to see defensive back statistics." |

### Player Report Visibility

| User's Tagging Tier | What They See |
|---------------------|---------------|
| Quick | Player Report page with message: "Tag games at **Comprehensive** level to unlock full player performance tracking. Quick tagging provides team-level statistics only." |
| Standard | Player involvement stats (plays involved, success rate, performance by down) with message for detailed grades: "Tag games at **Comprehensive** level for individual player grades and position-specific metrics." |
| Comprehensive | Full report access |

### Report Sections by Tier

| Report | Quick Sees | Standard Sees | Comprehensive Sees |
|--------|------------|---------------|-------------------|
| Season Overview | Full | Full | Full |
| Game Report | Full | Full | Full |
| Offensive Report | Volume, Efficiency, Ball Security, Possession | + QB, RB, WR Stats | + O-Line Performance |
| Defensive Report | Volume, Efficiency, Disruptive Plays (counts) | + Tackler attribution | + DL, LB, DB Stats |
| Special Teams Report | All unit totals | + Kicker/Punter/Returner attribution | + Coverage/Snapper details |
| Player Report | Message to upgrade | Player involvement, basic stats | Full grades and metrics |
| Situational Report | Full | Full | Full |
| Drive Analysis | Full | Full | Full |

### Report Message Styling
- Use a soft blue info box (similar to existing empty state styling) for tier upgrade prompts

---

## Database Considerations

### New Field
Add `tagging_tier` field to the games/films table:
- Type: enum
- Values: `quick`, `standard`, `comprehensive`
- Required: Yes (for new games after implementation)

### Schema Unchanged for Play Data
- Existing play_tags table accommodates all fields regardless of tier
- Fields not captured at lower tiers remain NULL

### Query Handling
- Reports should gracefully handle NULL values for fields not captured
- Use COALESCE or conditional aggregation as needed

---

## Analytics Tracking

Track tier selection events for product analytics:

### Events to Track

| Event | Properties |
|-------|------------|
| `tagging_tier_selected` | `tier` (quick/standard/comprehensive), `game_id`, `timestamp` |
| `tagging_tier_upgraded` | `from_tier`, `to_tier`, `game_id`, `plays_tagged_count`, `timestamp` |

---

## Future Subscription Gating

Add code structure to support future subscription-based restrictions. For now, all users can access all tagging tiers.

### Current Model (MVP)
- All subscription levels can use any tagging depth
- Free users limited by storage (1 game), not tagging features

### Future Considerations
- AI Assist available only for Plus ($29) and Premium ($79) subscribers
- Potential "taste" for free users (e.g., AI on first 5 plays)

### Placeholder Code Structure

```typescript
// Tagging tier access (all users)
const canAccessTaggingTier = (tier: TaggingTier): boolean => {
  return true; // All tiers available to all users
};

// AI Assist access (paid only)
const canUseAIAssist = (subscription: SubscriptionLevel): boolean => {
  return subscription === 'plus' || subscription === 'premium';
};

// TODO: Future - taste/trial for free users
// const getAIAssistLimit = (subscription: SubscriptionLevel): number => {
//   if (subscription === 'basic') return 5; // First 5 plays per game
//   return Infinity;
// };
```

---

## Files Likely Affected

### Tagging Interface
- Film tagging component(s)
- Tagging form components for Offense, Defense, Special Teams
- Form validation logic
- Tier selector component (new)
- Play tile/list component (add incomplete indicator)

### Database
- Games/films table schema (add tagging_tier)
- Types/interfaces for tagging tier enum

### Reports
- Offensive Report component
- Defensive Report component
- Special Teams Report component
- Player Report component
- Any shared components showing tier messages
- Remove/replace old "Tier 2" / "Tier 3" text throughout

### Analytics
- Add tier selection tracking events

---

## Design Requirements Summary

| Element | Requirement |
|---------|-------------|
| Tier selector | Card-based, Apple aesthetic, generous whitespace, subtle shadows |
| Tier cards | Show tier name, tagline, brief description, time estimate |
| Tier badge | Small, subtle pill/badge in tagging header showing current tier |
| Incomplete indicator | Small dot or icon on play tiles missing data for current tier |
| Field transitions | Animate fields appearing/disappearing if tier changes |
| Report messages | Soft blue info box for tier upgrade prompts |
| Help section | Clean accordion styling for "Which should I choose?" |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-14 | 1.0 | Initial specification |
| 2025-12-14 | 2.0 | Renamed tiers to Quick/Standard/Comprehensive to avoid subscription naming conflict. Added AI assist notes and commercial model alignment. |