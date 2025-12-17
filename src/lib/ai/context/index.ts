/**
 * Context Providers
 *
 * Export all available context providers for the AI chat system.
 */

export * from './types';
export { staticContextProvider } from './static-context';

// Default context provider for the help chat
export { staticContextProvider as defaultContextProvider } from './static-context';
