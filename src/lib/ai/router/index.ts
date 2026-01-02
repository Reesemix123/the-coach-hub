/**
 * AI Router
 *
 * Exports for the intent classification and routing system.
 */

export {
  classifyIntent,
  type Intent,
  type ClassificationResult,
  type ClassificationEntities,
} from './intent-classifier';

export {
  routeMessage,
  generateRoutedResponse,
  type RouterResult,
} from './smart-router';
