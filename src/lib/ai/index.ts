// src/lib/ai/index.ts
// AI Module Exports
// Services for AI features including help chat and future film tagging

// Legacy AI service (for film tagging, etc.)
export {
  AIService,
  createAIService,
  checkAIAccess,
  type AIServiceResult,
  type AIErrorCode,
  type ChatMessage as LegacyChatMessage,
  type ChatSession,
  type FilmTaggingResult,
  type AIUsageSummary
} from './ai-service';

// New modular AI system
export * from './types';
export * from './providers';
export * from './context';
export * from './semantic';
export * from './router';
export { ChatService, chatService } from './chat-service';
