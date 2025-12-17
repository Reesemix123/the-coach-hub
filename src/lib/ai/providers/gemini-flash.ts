/**
 * Gemini Flash Provider
 *
 * AI provider implementation using Google's Gemini 1.5 Flash model
 * via the Vercel AI SDK for streaming responses.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import type { AIProvider, Message } from '../types';

// Create Google AI instance with explicit API key
// Supports both GOOGLE_GENERATIVE_AI_API_KEY (SDK default) and GOOGLE_AI_API_KEY
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

export class GeminiFlashProvider implements AIProvider {
  id = 'gemini-flash';
  name = 'Gemini 2.0 Flash';

  // Use gemini-2.0-flash-exp (current available model)
  private model = googleAI('gemini-2.0-flash-exp');

  async generateResponse(
    messages: Message[],
    systemContext: string
  ): Promise<ReadableStream<string>> {
    const result = streamText({
      model: this.model,
      system: systemContext,
      messages: messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    // Convert AI SDK stream to standard ReadableStream<string>
    const { textStream } = result;

    return new ReadableStream<string>({
      async start(controller) {
        try {
          let hasContent = false;
          for await (const chunk of textStream) {
            hasContent = true;
            controller.enqueue(chunk);
          }
          // If no content was received, send a fallback message
          if (!hasContent) {
            controller.enqueue("I'm sorry, I couldn't generate a response. Please try again.");
          }
          controller.close();
        } catch (error) {
          console.error('Gemini streaming error:', error);
          // Send error message through the stream so user sees something
          const errorStr = error instanceof Error ? error.message : String(error);
          const isRateLimited = errorStr.includes('429') ||
                               errorStr.includes('RESOURCE_EXHAUSTED') ||
                               errorStr.includes('quota');
          const isDailyLimit = errorStr.includes('PerDay');
          let errorMessage: string;
          if (isDailyLimit) {
            errorMessage = "The AI service has reached its daily limit. Please try again tomorrow, or check out the User Guide in the meantime!";
          } else if (isRateLimited) {
            errorMessage = "I'm currently experiencing high demand. Please wait a moment and try again.";
          } else {
            errorMessage = "I'm sorry, I encountered an error. Please try again in a moment.";
          }
          controller.enqueue(errorMessage);
          controller.close();
        }
      },
    });
  }
}

// Export singleton instance
export const geminiFlashProvider = new GeminiFlashProvider();
