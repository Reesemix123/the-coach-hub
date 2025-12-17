# Youth Coach Hub - AI System Architecture Plan

## Executive Summary

This document outlines the architecture for Youth Coach Hub's AI capabilities, starting with a help chatbot and expanding into coaching intelligence and automated film tagging. The system uses a modular, provider-based architecture that avoids vendor lock-in while maintaining cost-effectiveness.

**Key Strategic Decisions:**
- **Gemini as unified AI provider** - Single integration for help chat, coaching analysis, and video understanding
- **Supabase for all data** - Snowflake only needed later at 500+ paying teams for cross-team analytics
- **"Accelerator" framing** - AI speeds up coach work rather than replacing judgment
- **Confidence-based outputs** - Coaches confirm/fix rather than trust blindly
- **Training data flywheel** - Every correction improves future accuracy

---

## End State Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    YOUTH COACH HUB - AI CAPABILITIES                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐            │
│  │   HELP CHAT     │   │    COACHING     │   │    FILM AI      │            │
│  │                 │   │   ASSISTANT     │   │    TAGGING      │            │
│  │  "How do I      │   │  "What plays    │   │  Auto-tag 120   │            │
│  │   upload film?" │   │   are missing   │   │  plays in 30    │            │
│  │                 │   │   from my       │   │  minutes vs     │            │
│  │  Phase 1 (MVP)  │   │   playbook?"    │   │  3 hours        │            │
│  │                 │   │                 │   │                 │            │
│  │  Gemini Flash   │   │  Phase 2        │   │  Phase 3        │            │
│  │  ~$0.0002/msg   │   │  Gemini Pro     │   │  Gemini Pro     │            │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘            │
│           │                     │                     │                      │
│           └─────────────────────┴─────────────────────┘                      │
│                                 │                                            │
│                                 ▼                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      UNIFIED AI SERVICE LAYER                          │  │
│  │                                                                        │  │
│  │   • Provider Interface (swap models easily)                           │  │
│  │   • Context Providers (static → semantic → RAG)                       │  │
│  │   • Intent Router (direct questions to right model)                   │  │
│  │   • Semantic Layer (translate coach questions to data queries)        │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                 │                                            │
│                                 ▼                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           SUPABASE                                     │  │
│  │                                                                        │  │
│  │   Teams │ Games │ Plays │ Playbooks │ Analytics │ AI Training Data    │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### 1. AI Provider Layer

Abstraction allowing easy model switching without code changes.

```typescript
// Interface that all AI providers implement
interface AIProvider {
  id: string
  name: string
  generateResponse(
    messages: Message[],
    context: string,
    options?: ProviderOptions
  ): Promise<ReadableStream>
}

// Implementations
class GeminiFlashProvider implements AIProvider { }  // MVP - help chat
class GeminiProProvider implements AIProvider { }    // Phase 2 - coaching
class ClaudeProvider implements AIProvider { }       // Future option
```

**Why This Matters:**
- AI landscape evolves fast; avoid lock-in
- Switch providers in one line of code
- A/B test different models easily
- Use different models for different tasks

---

### 2. Context Provider Layer

Manages what knowledge the AI has access to for each query.

```typescript
interface ContextProvider {
  id: string
  getContext(userId: string, query: string): Promise<string>
}

// Phase 1: Static app knowledge
class StaticContextProvider implements ContextProvider {
  // Returns pre-written app documentation
}

// Phase 2: User's actual data via semantic layer
class SemanticContextProvider implements ContextProvider {
  // Translates query → data fetch → formatted context
}

// Phase 3: Football knowledge base
class RAGContextProvider implements ContextProvider {
  // Vector similarity search for relevant content
}
```

---

### 3. Semantic Layer

Translates coach language into structured data queries. Single source of truth for metrics.

```typescript
// Metric definitions used everywhere (dashboard, chat, exports)
const metrics = {
  successRate: {
    name: 'Success Rate',
    description: '40%+ of needed yards on 1st, 60%+ on 2nd, 100% on 3rd/4th',
    calculate: (plays: Play[]) => { /* consistent calculation */ }
  },
  explosivePlay: {
    name: 'Explosive Play', 
    description: 'Run 12+ yards or pass 16+ yards',
    calculate: (play: Play) => { /* consistent definition */ }
  }
}

// Concept resolvers translate questions to data
const concepts = {
  teamTendencies: {
    description: 'Run/pass ratio, formation usage, down-and-distance patterns',
    resolve: async (teamId, gameRange) => {
      // Query Supabase, calculate metrics, format for AI
    }
  },
  opponentAnalysis: {
    description: 'Defensive tendencies and weaknesses',
    resolve: async (opponentId) => { /* ... */ }
  }
}
```

**Example Flow:**
```
Coach: "How's my run game trending?"
         ↓
Intent Classifier: "coaching_analysis" → Route to Gemini Pro
         ↓
Semantic Layer: Invoke teamTendencies(teamId, last4Games, filter=run)
         ↓
Context: "Your run game last 4 games: 45% success rate (down from 52%)..."
         ↓
Gemini Pro: Generates insight with specific recommendations
```

---

### 4. Intent Router (Phase 2)

Classifies questions and routes to appropriate provider.

```typescript
class IntentRouter {
  private classifier: GeminiFlashProvider  // Cheap, fast classification
  
  async route(query: string): Promise<{
    intent: 'help' | 'coaching' | 'general',
    provider: AIProvider,
    contextProviders: ContextProvider[]
  }> {
    // Use Flash to classify, then route accordingly
  }
}
```

| Intent | Provider | Context | Example |
|--------|----------|---------|---------|
| help | Gemini Flash | Static app docs | "How do I tag a play?" |
| coaching | Gemini Pro | Semantic + User data | "What formations work on 3rd down?" |
| general | Gemini Flash | Static | "What is Cover 2?" |

---

## Phase 1: Help Chat MVP

### What Gets Built

1. **Provider interfaces** - Abstract base for all AI providers
2. **Gemini Flash provider** - First implementation
3. **Static context provider** - App documentation
4. **Chat service** - Orchestrates conversations
5. **API route** - `/api/chat` with streaming
6. **Rate limiting** - Tier-based (20/50/unlimited per day)
7. **Chat UI** - Apple-aesthetic components
8. **Help page** - `/help` route
9. **Semantic layer interfaces** - Stubs for Phase 2

### File Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts              # Streaming API endpoint
│   └── (authenticated)/
│       └── help/
│           └── page.tsx              # Help chat page
│
├── components/
│   └── chat/
│       ├── chat-container.tsx        # Main wrapper
│       ├── chat-messages.tsx         # Message list
│       ├── chat-input.tsx            # Input field
│       ├── chat-message.tsx          # Single message
│       └── chat-typing-indicator.tsx # Loading state
│
├── lib/
│   └── ai/
│       ├── index.ts                  # Public exports
│       ├── types.ts                  # Shared interfaces
│       ├── providers/
│       │   ├── base-provider.ts      # Abstract interface
│       │   ├── gemini-flash.ts       # Flash implementation
│       │   └── index.ts
│       ├── context/
│       │   ├── static-context.ts     # App knowledge
│       │   ├── context-provider.ts   # Interface
│       │   └── index.ts
│       ├── semantic/                 # Phase 2 stubs
│       │   ├── types.ts              # Interfaces only
│       │   └── metrics.ts            # Definitions only
│       └── chat-service.ts           # Main orchestrator
│
├── content/
│   └── help/
│       └── app-knowledge.md          # App documentation
│
└── hooks/
    └── use-chat.ts                   # React state hook
```

### Database Schema

```sql
-- Rate limiting table
CREATE TABLE chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat usage"
  ON chat_usage FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_chat_usage_user_date ON chat_usage(user_id, date);
```

### Rate Limits

| Tier | Daily Messages | Est. Monthly Cost |
|------|----------------|-------------------|
| Basic (free) | 20 | ~$0.08 |
| Plus ($29/mo) | 50 | ~$0.20 |
| Premium ($79/mo) | Unlimited | ~$2.00 |

---

## Phase 2: Coaching Intelligence

### New Capabilities

- Answer questions using team's actual data
- Compare team performance to opponents
- Recommend practice focus areas
- Formation and play effectiveness analysis

### Implementation

1. Implement metric definitions in semantic layer
2. Build concept resolvers for common queries
3. Add Gemini Pro provider
4. Create intent classifier
5. Implement smart router
6. Add conversation persistence

### Example Queries Enabled

| Query | Data Accessed |
|-------|---------------|
| "How's my run game trending?" | Last 4 games, run plays, success rate |
| "What formations work on 3rd down?" | All 3rd down plays, formation stats |
| "Compare us to Lincoln High" | Team tendencies vs opponent tendencies |
| "What should we work on this week?" | Recent performance gaps |

---

## Phase 3: AI Film Tagging

### The Differentiator

Youth Coach Hub works with **any film quality** - sideline, endzone, drone, phone camera. This is the opposite of Hudl which requires standardized setups.

### The "Accelerator" UX

```
Traditional: Watch → Pause → Enter 15 fields → Next → Repeat 120x = 3 hours
Accelerated: Upload → AI pre-fills → Coach confirms/fixes → Done in 30 min
```

### Confidence-Based Interface

```
┌─────────────────────────────────────────────────────────────┐
│  Play 7 of 68                                               │
│                                                             │
│  AI Suggestions:                           Confidence: 87%  │
│                                                             │
│  Formation    ●●●○○  Shotgun Spread       [✓] [Change]     │
│  Play Type    ●●●●○  Pass Short           [✓] [Change]     │
│  Result       ●●●○○  Complete, 8 yards    [✓] [Change]     │
│  Ball Carrier ●●○○○  #22                  [✓] [Change]     │
│                                                             │
│  ⚠️ Couldn't detect: Down (camera angle)  [Add manually]   │
│                                                             │
│              [Accept All]        [Next Play →]              │
└─────────────────────────────────────────────────────────────┘
```

### Training Data Flywheel

```
Coaches use AI tagging
         ↓
Coaches correct mistakes
         ↓
Corrections stored as training data
         ↓
Models improve over time
         ↓
Better accuracy attracts more coaches
         ↓
More corrections = better models
         ↓
Competitive moat
```

### Implementation

1. Film quality assessment module
2. Frame extraction (or Gemini native video)
3. Confidence-based tagging prompts
4. Correction capture system
5. AI training data tables
6. Cost tracking per analysis

---

## Phase 4: Advanced Features (Future)

| Feature | Description | Trigger |
|---------|-------------|---------|
| RAG for football knowledge | "What's a good play against Cover 3?" | When content library built |
| Practice plan generation | AI-recommended drills | When coaching data mature |
| Voice input | Hands-free for busy coaches | Mobile app launch |
| Cross-team benchmarking | "How do we compare?" | 500+ teams, consider Snowflake |
| Opponent scouting reports | Auto-generated from film | Film AI mature |

---

## Technology Decisions

### Why Gemini (Not Claude/OpenAI)?

| Factor | Decision |
|--------|----------|
| Video understanding | Gemini 1.5 Pro has native video input (no frame extraction) |
| Unified platform | Same provider for help, coaching, and film reduces complexity |
| Cost | Flash is cheapest for simple queries |
| Context window | 1M tokens handles large context |
| Upgrade path | Flash → Pro is seamless |

### Why Supabase (Not Snowflake)?

| Factor | Decision |
|--------|----------|
| Data volume | Youth football data won't stress PostgreSQL |
| Transactional needs | Real-time tagging requires OLTP |
| Cost | Predictable monthly vs consumption billing |
| Existing setup | Auth, RLS already working |
| Future | Add Snowflake only if cross-team analytics needed at 500+ teams |

### Why Semantic Layer (Not Direct SQL)?

| Factor | Decision |
|--------|----------|
| Accuracy | AI doesn't hallucinate metric definitions |
| Consistency | Same calculations power dashboard AND chat |
| Security | AI never touches raw SQL |
| Maintainability | Define once, use everywhere |
| Trust | Coaches see consistent numbers |

---

## Cost Projections

### Phase 1 (Help Chat)
```
100 coaches × 30 messages/month × $0.0002 = $0.60/month
1,000 coaches × 30 messages/month × $0.0002 = $6.00/month
```

### Phase 2 (Coaching Analysis)
```
1,000 coaches × 20 coaching queries/month × $0.003 = $60/month
```

### Phase 3 (Film Tagging)
```
1,000 teams × 10 games/season × $0.50-2.00/game = $500-2,000/month
(during season only)
```

**All well within profitable margins at $29-79/month price points.**

---

## Success Metrics

### Phase 1
- [ ] Help chat accessible at `/help`
- [ ] Responses stream in real-time
- [ ] Rate limits enforced by tier
- [ ] 90%+ of app questions answered accurately
- [ ] Architecture supports provider swapping

### Phase 2
- [ ] Coaching queries return accurate team data
- [ ] Same metrics shown in dashboard and chat
- [ ] Intent classification routes correctly 95%+ of time

### Phase 3
- [ ] 70%+ of tags pre-filled correctly by AI
- [ ] Coach tagging time reduced by 60%+
- [ ] Correction capture rate 100%
- [ ] Model accuracy improves month-over-month

---

## Appendix: App Knowledge Content (MVP)

The AI needs comprehensive knowledge about Youth Coach Hub. This content will be injected as system context:

### Topics to Cover

1. **Getting Started**
   - Creating an account
   - Setting up a team
   - Inviting assistant coaches
   - Understanding subscription tiers

2. **Film Management**
   - Uploading game film
   - Supported formats and sizes
   - Multi-camera angles
   - Processing status

3. **Play Tagging**
   - Quick vs Standard vs Comprehensive tagging
   - Required fields by tier
   - Tagging workflow
   - Keyboard shortcuts

4. **Playbook Builder**
   - Creating formations
   - Drawing plays
   - Organizing playbook
   - Sharing with team

5. **Analytics**
   - Understanding metrics
   - Viewing tendencies
   - Down and distance analysis
   - Formation effectiveness

6. **Opponent Scouting**
   - Adding opponents
   - Uploading opponent film
   - Scouting reports

7. **Account & Billing**
   - Changing subscription
   - Managing team members
   - Data export

---

## Next Steps

1. Mark: Complete manual setup (API key, environment variables)
2. Claude Code: Build Phase 1 MVP
3. Mark: Test with beta coaches
4. Iterate based on feedback
5. Phase 2 when analytics features launch