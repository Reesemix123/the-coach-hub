/**
 * Smart Router
 *
 * Routes user messages to the appropriate AI provider and context:
 * - help → Gemini Flash + static context
 * - coaching → Gemini Pro + semantic context
 * - parent_help → Gemini Flash + parent context (no team data)
 * - general → Gemini Flash + minimal context
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message, AIProvider } from '../types';
import { classifyIntent, type ClassificationResult } from './intent-classifier';
import { geminiFlashProvider, geminiProProvider } from '../providers';
import { staticContextProvider, semanticContextProvider, generateParentAIContext } from '../context';

export interface RouterResult {
  provider: AIProvider;
  context: string;
  classification: ClassificationResult;
}

const GENERAL_CONTEXT = `You are a helpful football coaching assistant. Answer general football questions clearly and concisely. Focus on youth and high school football concepts when relevant.`;

/**
 * Route a user message to the appropriate provider and context
 */
export async function routeMessage(
  messages: Message[],
  userId: string,
  supabase: SupabaseClient,
  userRole: 'coach' | 'parent' = 'coach'
): Promise<RouterResult> {
  // Get the latest user message
  const latestMessage = messages.filter((m) => m.role === 'user').pop();
  const query = latestMessage?.content || '';

  // Classify intent (pass userRole so parents always get parent_help)
  const classification = await classifyIntent(query, userRole);

  // Route based on intent
  switch (classification.intent) {
    case 'help':
      return routeToHelp(userId, query, classification);

    case 'coaching':
      return routeToCoaching(userId, query, supabase, classification);

    case 'parent_help':
      return routeToParentHelp(classification);

    case 'general':
    default:
      return routeToGeneral(classification);
  }
}

async function routeToHelp(
  userId: string,
  query: string,
  classification: ClassificationResult
): Promise<RouterResult> {
  // Use Flash for speed with static documentation context
  const context = await staticContextProvider.getContext(userId, query);

  return {
    provider: geminiFlashProvider,
    context,
    classification,
  };
}

async function routeToCoaching(
  userId: string,
  query: string,
  supabase: SupabaseClient,
  classification: ClassificationResult
): Promise<RouterResult> {
  // Set up semantic context provider
  semanticContextProvider.setSupabase(supabase);
  semanticContextProvider.setEntities(classification.entities);

  // Use Pro for quality with team data context
  const context = await semanticContextProvider.getContext(userId, query);

  return {
    provider: geminiProProvider,
    context,
    classification,
  };
}

async function routeToGeneral(
  classification: ClassificationResult
): Promise<RouterResult> {
  // Use Flash for speed with minimal context
  return {
    provider: geminiFlashProvider,
    context: GENERAL_CONTEXT,
    classification,
  };
}

async function routeToParentHelp(
  classification: ClassificationResult
): Promise<RouterResult> {
  // Use Flash for speed with parent-specific context — no team data, no semantic layer
  const context = generateParentAIContext();

  return {
    provider: geminiFlashProvider,
    context,
    classification,
  };
}

/**
 * Generate a response using the routed provider and context
 */
export async function generateRoutedResponse(
  messages: Message[],
  userId: string,
  supabase: SupabaseClient,
  userRole: 'coach' | 'parent' = 'coach'
): Promise<{
  stream: ReadableStream<string>;
  classification: ClassificationResult;
}> {
  const { provider, context, classification } = await routeMessage(
    messages,
    userId,
    supabase,
    userRole
  );

  const stream = await provider.generateResponse(messages, context);

  return {
    stream,
    classification,
  };
}
