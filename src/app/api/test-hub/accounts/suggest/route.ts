/**
 * API: POST /api/test-hub/accounts/suggest
 * Uses Gemini Flash to analyze test steps and suggest what account types are needed.
 * Admin only.
 *
 * Body: { setupSteps: string[], testSteps: string[], category: string }
 * Returns: { suggestions: Array<{ type: 'coach' | 'parent', label: string, reason: string }> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// ---------------------------------------------------------------------------
// Gemini Flash model (simpler classification task — Flash is sufficient)
// ---------------------------------------------------------------------------

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

const model = googleAI('gemini-2.5-flash');

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------

interface SuggestBody {
  setupSteps: string[];
  testSteps: string[];
  category: string;
}

interface AccountSuggestion {
  type: 'coach' | 'parent';
  label: string;
  reason: string;
}

interface SuggestResponse {
  suggestions: AccountSuggestion[];
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate body
    const body: SuggestBody = await request.json();

    if (!Array.isArray(body.setupSteps) || !Array.isArray(body.testSteps)) {
      return NextResponse.json(
        { error: 'setupSteps and testSteps must be arrays' },
        { status: 400 }
      );
    }

    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    // Build prompt
    const prompt = `You are analyzing QA test steps for a youth football coaching application called Youth Coach Hub.
Based on the test steps below, determine what types of test user accounts are needed.

Return ONLY valid JSON with no markdown, no code fences, no preamble:
{
  "suggestions": [
    { "type": "coach", "label": "Head Coach", "reason": "Steps require creating a team and managing roster" },
    { "type": "parent", "label": "Parent User", "reason": "Steps test parent-facing features like viewing clips" }
  ]
}

Rules:
- "coach" accounts are needed when steps mention: creating teams, managing roster, uploading film, creating playbook, managing schedules, inviting parents, admin functions
- "parent" accounts are needed when steps mention: viewing as parent, parent portal, clips, reports, RSVP, parent messaging, athlete profiles
- Return an empty array if no accounts are needed (e.g. public page tests)
- Most test cases need at least a coach account
- Each suggestion needs a short descriptive label and a brief reason

Feature category: ${body.category}

Setup steps:
${body.setupSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Test steps:
${body.testSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

    const result = await generateText({ model, prompt });
    const jsonText = result.text.trim();

    // Strip any accidental markdown code fences
    const cleaned = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed: SuggestResponse = JSON.parse(cleaned);

    return NextResponse.json({ suggestions: parsed.suggestions ?? [] });
  } catch (error) {
    console.error('POST /api/test-hub/accounts/suggest error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
