/**
 * API: POST /api/test-hub/generate
 * Generates AI test cases for a list of feature keys using Gemini 2.5 Pro.
 * Processes features with a concurrency limit of 3.
 * Admin only.
 *
 * Body: { featureKeys: string[], suiteId: string }
 * Returns: { created: number, failed: string[] }
 *
 * Feature key format: "{categoryId}/{featureIndex}"
 * Example: "film/0" resolves to the first feature in the 'film' category.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { APP_FEATURES } from '@/content/features';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Gemini 2.5 Pro model (not Flash — full reasoning for test case generation)
// ---------------------------------------------------------------------------

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

const model = googleAI('gemini-2.5-pro');

// ---------------------------------------------------------------------------
// Concurrency limit
// ---------------------------------------------------------------------------

const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Guide content loaders
// ---------------------------------------------------------------------------

/**
 * Loads the markdown body of a specific guide page by its guidePath.
 * guidePath examples:
 *   '/guide/film/uploading-film'  → src/content/guide/film/uploading-film.md
 *   '/parent/guide/parent-profile/overview' → src/content/guide/parent-profile/overview.md
 */
function loadGuideForFeature(guidePath: string): string {
  const cleanPath = guidePath
    .replace(/^\/guide\//, '')
    .replace(/^\/parent\/guide\//, '');

  const filePath = path.join(process.cwd(), 'src/content/guide', cleanPath + '.md');

  try {
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { content: markdown } = matter(raw);
    return markdown.trim();
  } catch {
    return '';
  }
}

/**
 * Loads the index.md for the category that the guidePath belongs to.
 * Provides additional context about the broader feature area.
 */
function loadCategoryGuide(guidePath: string): string {
  const cleanPath = guidePath
    .replace(/^\/guide\//, '')
    .replace(/^\/parent\/guide\//, '');

  const parts = cleanPath.split('/');
  if (parts.length === 0) return '';

  const indexPath = path.join(process.cwd(), 'src/content/guide', parts[0], 'index.md');

  try {
    if (!fs.existsSync(indexPath)) return '';
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const { content: markdown } = matter(raw);
    return markdown.trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Feature key resolution
// ---------------------------------------------------------------------------

interface ResolvedFeature {
  name: string;
  description: string;
  guidePath?: string;
  categoryId: string;
}

/**
 * Resolves a feature key string to a feature definition from APP_FEATURES.
 *
 * Key format: "{categoryId}/{featureIndex}"
 * Example: "film/2" → third feature in the 'film' category
 */
function resolveFeatureKey(key: string): ResolvedFeature | null {
  const [categoryId, indexStr] = key.split('/');
  if (!categoryId) return null;

  const category = APP_FEATURES.find((c) => c.id === categoryId);
  if (!category) return null;

  const index = parseInt(indexStr ?? '0', 10);
  if (isNaN(index) || index < 0 || index >= category.features.length) return null;

  const feature = category.features[index];
  return {
    name: feature.name,
    description: feature.description,
    guidePath: feature.guidePath,
    categoryId: category.id,
  };
}

// ---------------------------------------------------------------------------
// Parsed generation result
// ---------------------------------------------------------------------------

interface GeneratedStepRaw {
  instruction: string;
  expected_outcome: string | null;
}

interface GeneratedTestCase {
  title: string;
  description: string;
  category: string;
  estimated_minutes: number;
  setup_steps: GeneratedStepRaw[];
  test_steps: GeneratedStepRaw[];
}

// ---------------------------------------------------------------------------
// Per-feature generation + insertion
// ---------------------------------------------------------------------------

async function generateForFeature(
  featureKey: string,
  suiteId: string,
  serviceClient: SupabaseClient,
  createdBy: string
): Promise<void> {
  const feature = resolveFeatureKey(featureKey);
  if (!feature) {
    throw new Error(`Unknown feature key: ${featureKey}`);
  }

  // Assemble guide context from the specific page and the category index
  const featureGuide = feature.guidePath ? loadGuideForFeature(feature.guidePath) : '';
  const categoryGuide = feature.guidePath ? loadCategoryGuide(feature.guidePath) : '';
  const guideContent = [categoryGuide, featureGuide].filter(Boolean).join('\n\n');

  const prompt = `You are creating QA test cases for a youth football coaching application called Youth Coach Hub.
Given the feature description and user guide content below, generate a complete test case.

Return ONLY valid JSON with no markdown, no code fences, no preamble:
{
  "title": "short feature name",
  "description": "one sentence describing what this tests",
  "category": "one of: teams|film|playbook|analytics|communication-hub|subscriptions|roles|practice|game-week|player-profiles",
  "estimated_minutes": number,
  "setup_steps": [
    { "instruction": "step text", "expected_outcome": "what correct setup looks like or null" }
  ],
  "test_steps": [
    { "instruction": "action the tester takes", "expected_outcome": "what the tester should observe" }
  ]
}

Feature name: ${feature.name}
Feature description: ${feature.description}
User guide content:
${guideContent || 'No guide content available for this feature.'}

Rules:
- Setup steps are prerequisites: login, navigate to the right page, create any required data
- Test steps are the actual verification actions a non-technical person can perform
- Expected outcomes must be specific and observable — not "it works" but "a green confirmation message appears"
- 3-5 setup steps, 4-8 test steps is the target range
- Write for a volunteer football coach who is not technical but knows the sport
- If guide content is unavailable for this feature, generate reasonable steps from the feature description alone`;

  const result = await generateText({ model, prompt });
  const jsonText = result.text.trim();

  // Strip any accidental markdown code fences
  const cleaned = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const parsed: GeneratedTestCase = JSON.parse(cleaned);

  // Insert test_case
  const { data: testCase, error: caseError } = await serviceClient
    .from('test_cases')
    .insert({
      suite_id: suiteId,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      status: 'pending_review',
      auto_generated: true,
      source_feature_key: featureKey,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (caseError || !testCase) {
    throw new Error(`Failed to insert test case for ${featureKey}: ${caseError?.message}`);
  }

  // Build step rows — setup steps first, then test steps
  const stepRows = [
    ...parsed.setup_steps.map((step, i) => ({
      test_case_id: testCase.id,
      step_type: 'setup' as const,
      display_order: i + 1,
      instruction: step.instruction,
      expected_outcome: step.expected_outcome ?? null,
    })),
    ...parsed.test_steps.map((step, i) => ({
      test_case_id: testCase.id,
      step_type: 'test' as const,
      display_order: i + 1,
      instruction: step.instruction,
      expected_outcome: step.expected_outcome ?? null,
    })),
  ];

  if (stepRows.length > 0) {
    const { error: stepsError } = await serviceClient.from('test_steps').insert(stepRows);
    if (stepsError) {
      throw new Error(`Failed to insert steps for ${featureKey}: ${stepsError.message}`);
    }
  }
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

    const body = await request.json();
    const { featureKeys, suiteId } = body as { featureKeys: string[]; suiteId: string };

    if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
      return NextResponse.json({ error: 'featureKeys must be a non-empty array' }, { status: 400 });
    }

    if (!suiteId || typeof suiteId !== 'string') {
      return NextResponse.json({ error: 'suiteId is required' }, { status: 400 });
    }

    // Verify suite exists
    const { data: suite } = await supabase
      .from('test_suites')
      .select('id')
      .eq('id', suiteId)
      .single();

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    // Use service client for inserts — bypasses RLS since admin has already been verified
    const serviceClient = createServiceClient();

    const results: { key: string; success: boolean; error?: string }[] = [];

    // Process in chunks of CONCURRENCY (3 at a time)
    for (let i = 0; i < featureKeys.length; i += CONCURRENCY) {
      const chunk = featureKeys.slice(i, i + CONCURRENCY);

      const chunkResults = await Promise.allSettled(
        chunk.map((key) => generateForFeature(key, suiteId, serviceClient, user.id))
      );

      chunkResults.forEach((result, index) => {
        const key = chunk[index];
        if (result.status === 'fulfilled') {
          results.push({ key, success: true });
        } else {
          const errorMessage = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          console.error(`[test-hub/generate] Failed for key "${key}":`, errorMessage);
          results.push({ key, success: false, error: errorMessage });
        }
      });
    }

    const created = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).map((r) => r.key);

    return NextResponse.json({ created, failed }, { status: 200 });
  } catch (error) {
    console.error('POST /api/test-hub/generate error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
