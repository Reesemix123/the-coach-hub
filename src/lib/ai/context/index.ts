/**
 * Context Providers
 *
 * Export all available context providers for the AI chat system.
 */

export * from './types';
export { staticContextProvider } from './static-context';
export { semanticContextProvider } from './semantic-context';

// Default context provider for the help chat
export { staticContextProvider as defaultContextProvider } from './static-context';

// Coaching context provider for team analytics
export { semanticContextProvider as coachingContextProvider } from './semantic-context';
