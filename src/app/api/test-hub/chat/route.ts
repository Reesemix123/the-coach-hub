/**
 * API: POST /api/test-hub/chat
 * AI chat for the Test Hub — context-aware assistant for testers.
 *
 * System prompt layers:
 *   1. Role definition
 *   2. App feature context (generateAIContext from features.ts)
 *   3. Guide markdown content (loaded from src/content/guide/)
 *   4. Active test case context (fetched from DB)
 *   5. Tester instruction
 *
 * Uses Gemini 2.5 Flash via Vercel AI SDK streamText().
 * Logs messages to chat_messages with intent='test_hub'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { generateAIContext } from '@/content/features';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Gemini model
// ---------------------------------------------------------------------------

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

const model = googleAI('gemini-2.5-flash');

// ---------------------------------------------------------------------------
// Guide content loader (mirrors static-context.ts pattern)
// ---------------------------------------------------------------------------

let cachedGuideContent: string | null = null;

function loadGuideContent(): string {
  if (cachedGuideContent) return cachedGuideContent;

  const guidePath = path.join(process.cwd(), 'src/content/guide');
  const sections: string[] = [];

  try {
    const dirs = fs.readdirSync(guidePath, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const categoryPath = path.join(guidePath, dir.name);
      const categoryName = dir.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      sections.push(`\n## ${categoryName}\n`);

      const files = fs.readdirSync(categoryPath);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(categoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: markdown } = matter(content);

        sections.push(`### ${frontmatter.title || file.replace('.md', '')}\n`);
        sections.push(markdown.trim());
        sections.push('\n');
      }
    }
  } catch (error) {
    console.error('[test-hub-chat] Error loading guide content:', error);
  }

  cachedGuideContent = sections.join('\n');
  return cachedGuideContent;
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TestHubChatRequest {
  messages: ChatMessage[];
  testCaseId: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify tester or admin access
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_tester, is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_tester && !profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request
    const body: TestHubChatRequest = await request.json();
    const { messages, testCaseId, sessionId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    if (!testCaseId || !sessionId) {
      return NextResponse.json({ error: 'testCaseId and sessionId are required' }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Build system prompt
    // -----------------------------------------------------------------------

    // Layer 1: Role definition
    const roleDefinition = `You are a testing assistant for Youth Coach Hub, a youth football coaching application. Your job is to help testers understand features, interpret test instructions, and complete test cases successfully. Be concise and practical.`;

    // Layer 2: App feature context
    const appContext = generateAIContext();

    // Layer 3: Guide markdown content
    const guideContent = loadGuideContent();

    // Layer 4: Active test case context (fetched from DB)
    let testCaseContext = '';
    const { data: testCase } = await supabase
      .from('test_cases')
      .select('title, description, category')
      .eq('id', testCaseId)
      .single();

    const { data: steps } = await supabase
      .from('test_steps')
      .select('step_type, display_order, instruction, expected_outcome')
      .eq('test_case_id', testCaseId)
      .order('display_order', { ascending: true });

    if (testCase) {
      const setupSteps = (steps || []).filter(s => s.step_type === 'setup');
      const testSteps = (steps || []).filter(s => s.step_type === 'test');

      const formatSteps = (list: typeof steps) =>
        (list || [])
          .map((s, i) => `${i + 1}. ${s.instruction}${s.expected_outcome ? ` → Expected: ${s.expected_outcome}` : ''}`)
          .join('\n');

      testCaseContext = `
ACTIVE TEST CASE:
Title: ${testCase.title}
Description: ${testCase.description || 'No description'}
Category: ${testCase.category}

${setupSteps.length > 0 ? `Setup Steps:\n${formatSteps(setupSteps)}\n` : ''}Test Steps:
${formatSteps(testSteps)}`;
    }

    // Layer 5: Tester instruction
    const testerInstruction = `The tester is currently working through this test case. Answer questions about what steps mean, what they should observe, or how features work. If asked something unrelated to Youth Coach Hub or this test case, redirect them politely.`;

    // Combine all layers
    const systemPrompt = [
      roleDefinition,
      '\n--- APP FEATURES ---\n',
      appContext,
      '\n--- USER GUIDE ---\n',
      guideContent,
      '\n--- CURRENT TEST CONTEXT ---\n',
      testCaseContext,
      '\n--- INSTRUCTIONS ---\n',
      testerInstruction,
    ].join('\n');

    // -----------------------------------------------------------------------
    // Generate streaming response
    // -----------------------------------------------------------------------

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    const { textStream } = result;

    // Log user message (fire and forget)
    const chatSessionId = sessionId; // Use the test session ID for grouping
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage && latestUserMessage.role === 'user') {
      supabase.from('chat_messages').insert({
        user_id: user.id,
        team_id: null,
        role: 'user',
        content: latestUserMessage.content,
        intent: 'test_hub',
        topic: testCase?.category || null,
        session_id: chatSessionId,
      });
    }

    // Stream response and log assistant message on completion
    let fullResponse = '';

    const stream = new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            fullResponse += chunk;
            controller.enqueue(chunk);
          }

          // Log assistant response (fire and forget)
          supabase.from('chat_messages').insert({
            user_id: user.id,
            team_id: null,
            role: 'assistant',
            content: fullResponse,
            intent: 'test_hub',
            topic: testCase?.category || null,
            session_id: chatSessionId,
          });

          controller.close();
        } catch (error) {
          console.error('[test-hub-chat] Streaming error:', error);
          controller.enqueue("I'm sorry, I encountered an error. Please try again.");
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Intent': 'test_hub',
      },
    });
  } catch (error) {
    console.error('[test-hub-chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
