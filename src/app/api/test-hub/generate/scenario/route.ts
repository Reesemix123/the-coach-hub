/**
 * API: POST /api/test-hub/generate/scenario
 * Generates an AI scenario test suite preview using Gemini 2.5 Pro.
 * Returns a preview object without saving to the database — the caller
 * reviews the output and POSTs to /scenario/save to persist it.
 * Admin only.
 *
 * Body: { description: string, featureCategoryId: string, suiteName: string }
 * Returns: { suiteName, precondition, setupSteps, testSteps }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { APP_FEATURES } from '@/content/features';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Gemini 2.5 Pro model
// ---------------------------------------------------------------------------

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

const model = googleAI('gemini-2.5-pro');

// ---------------------------------------------------------------------------
// Guide content loaders (mirrors generate/route.ts)
// ---------------------------------------------------------------------------

/**
 * Loads all guide pages for features in the given category and concatenates them.
 * Provides rich context for scenario generation without needing a specific guidePath.
 */
function loadCategoryGuideContent(categoryId: string): string {
  const category = APP_FEATURES.find(c => c.id === categoryId);
  if (!category) return '';

  const guideDir = path.join(process.cwd(), 'src/content/guide', categoryId);

  // Try to load category index first
  const indexPath = path.join(guideDir, 'index.md');
  const parts: string[] = [];

  try {
    if (fs.existsSync(indexPath)) {
      const raw = fs.readFileSync(indexPath, 'utf-8');
      const { content } = matter(raw);
      if (content.trim()) parts.push(content.trim());
    }
  } catch {
    // index.md missing or unreadable — continue
  }

  // Load individual feature guide pages for this category
  for (const feature of category.features) {
    if (!feature.guidePath) continue;

    const cleanPath = feature.guidePath
      .replace(/^\/guide\//, '')
      .replace(/^\/parent\/guide\//, '');

    const filePath = path.join(process.cwd(), 'src/content/guide', cleanPath + '.md');

    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { content } = matter(raw);
      if (content.trim()) parts.push(content.trim());
    } catch {
      // File unreadable — skip
    }
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Route handler
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
    const body = await request.json() as {
      description?: unknown;
      featureCategoryId?: unknown;
      suiteName?: unknown;
    };

    const { description, featureCategoryId, suiteName } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    if (!featureCategoryId || typeof featureCategoryId !== 'string') {
      return NextResponse.json({ error: 'featureCategoryId is required' }, { status: 400 });
    }

    if (!suiteName || typeof suiteName !== 'string' || !suiteName.trim()) {
      return NextResponse.json({ error: 'suiteName is required' }, { status: 400 });
    }

    // Resolve category
    const category = APP_FEATURES.find(c => c.id === featureCategoryId);
    if (!category) {
      return NextResponse.json({ error: 'Unknown feature category' }, { status: 400 });
    }

    // Load guide content for the category
    const guideContent = loadCategoryGuideContent(featureCategoryId);

    // Fetch existing test cases in this category for deduplication context
    const { data: existingCasesData } = await supabase
      .from('test_cases')
      .select('title')
      .eq('category', featureCategoryId)
      .in('status', ['active', 'pending_review']);

    const existingCases = existingCasesData ?? [];

    const prompt = `You are creating a QA test case for a youth football coaching application called Youth Coach Hub.
The tester will be testing a specific scenario defined by a precondition. Write setup steps that actively establish that precondition — not just navigate to a page. The precondition must be achievable by a non-technical tester using only the app UI.

Return ONLY valid JSON with no markdown, no code fences, no preamble:
{
  "suiteName": "the suite name",
  "precondition": "one sentence describing the state that must be true before testing begins",
  "setup_steps": [
    { "instruction": "action to establish the precondition", "expected_outcome": "what correct setup looks like" }
  ],
  "test_steps": [
    { "instruction": "action the tester takes", "expected_outcome": "what the tester should observe" }
  ]
}

Scenario description: ${description.trim()}
Suite name: ${suiteName.trim()}
Feature area: ${category.name}
Feature area description: ${category.description}

Available features in this area:
${category.features.map(f => `- ${f.name}: ${f.description}`).join('\n')}

User guide content for this area:
${guideContent || 'No guide content available.'}

Existing test cases in this area (for context — avoid duplicating these):
${existingCases.map(c => `- ${c.title}`).join('\n') || 'None yet.'}

Rules:
- Setup steps must actively establish the precondition — login, create data, navigate, configure settings
- Test steps verify the scenario behavior after the precondition is met
- Expected outcomes must be specific and observable
- 3-6 setup steps, 4-8 test steps
- Write for a volunteer football coach who is not technical but knows the sport`;

    const result = await generateText({ model, prompt });
    const jsonText = result.text.trim();

    // Strip any accidental markdown code fences
    const cleaned = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

    const parsed = JSON.parse(cleaned) as {
      suiteName: string;
      precondition: string;
      setup_steps: Array<{ instruction: string; expected_outcome: string | null }>;
      test_steps: Array<{ instruction: string; expected_outcome: string | null }>;
    };

    return NextResponse.json({
      suiteName: parsed.suiteName,
      precondition: parsed.precondition,
      setupSteps: parsed.setup_steps,
      testSteps: parsed.test_steps,
    });
  } catch (error) {
    console.error('POST /api/test-hub/generate/scenario error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
