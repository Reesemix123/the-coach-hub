// src/lib/ai/film/index.ts
// AI Film Analysis - Main Exports

// Prompts
export {
  QUALITY_ASSESSMENT_PROMPT,
  QUICK_TAG_PROMPT,
  STANDARD_TAG_PROMPT,
  COMPREHENSIVE_TAG_PROMPT,
  buildPrompt,
} from './film-prompts';

// Model/Tier Configuration
export {
  GEMINI_MODELS,
  TIER_CONFIGS,
  getConfigForTier,
  getModelIdForTier,
  getFieldsForTier,
  getPromptForTier,
  estimateBatchTime,
  calculateCost,
  type TierConfig,
} from './model-selector';

// Gemini File Management
export {
  getOrUploadVideo,
  isVideoCached,
  invalidateVideoCache,
  cleanupExpiredCache,
  getCacheStats,
} from './gemini-file-manager';

// Play Analysis
export {
  analyzePlayClip,
  savePrediction,
  getFilmQuality,
  updateUsage,
  analyzeAndSavePlay,
  type FieldPrediction,
  type PlayPrediction,
  type AnalysisResult,
  type PlayContext,
} from './play-analyzer';

// Correction Tracking
export {
  trackCorrection,
  trackCorrections,
  identifyCorrections,
  getCorrectionStats,
  getAccuracyByField,
  exportTrainingData,
  type Correction,
  type CorrectionContext,
} from './correction-tracker';
