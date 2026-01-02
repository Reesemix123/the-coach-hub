/**
 * AI Providers
 *
 * Export all available AI providers. The system is designed to be
 * provider-agnostic, allowing easy swapping between models.
 */

export { GeminiFlashProvider, geminiFlashProvider } from './gemini-flash';
export { GeminiProProvider, geminiProProvider } from './gemini-pro';

// Default provider for the help chat (Flash for speed/cost)
export { geminiFlashProvider as defaultProvider } from './gemini-flash';

// Coaching provider for team analysis (Pro for quality)
export { geminiProProvider as coachingProvider } from './gemini-pro';
