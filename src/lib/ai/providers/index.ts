/**
 * AI Providers
 *
 * Export all available AI providers. The system is designed to be
 * provider-agnostic, allowing easy swapping between models.
 */

export { GeminiFlashProvider, geminiFlashProvider } from './gemini-flash';

// Default provider for the help chat
export { geminiFlashProvider as defaultProvider } from './gemini-flash';
