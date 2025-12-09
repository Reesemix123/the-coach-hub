// src/lib/entitlements/index.ts
// Centralized exports for the entitlements module

// Entitlements Service
export {
  EntitlementsService,
  createEntitlementsService,
  checkCanCreateGame,
  checkCanAddCamera,
  checkCanAccessGame,
  type EntitlementResult,
  type GameLimits,
  type VideoRequirements,
  type TierInfo,
  type TierComparisonItem
} from './entitlements-service';

// Token Service
export {
  TokenService,
  createTokenService,
  canCreateGame,
  formatTokenStatus,
  type TokenBalance,
  type TokenTransaction,
  type TokenBalanceSummary,
  type ConsumeTokenResult,
  type AddTokensResult,
  type TokenTransactionType,
  type TokenSource
} from './token-service';

// Video Validation Service
export {
  VideoValidationService,
  createVideoValidationService,
  validateVideoUpload,
  isValidVideoFile,
  getAcceptedFormats,
  getMaxFileSize,
  CAMERA_LABELS,
  type VideoValidationResult,
  type PreUploadValidation,
  type PostUploadValidation,
  type VideoMetadata
} from './video-validation-service';

// Enforcement Service
export {
  EnforcementService,
  createEnforcementService,
  enforceTierLimits,
  getExpiringGames,
  runExpirationCheck,
  type EnforcementResult,
  type ExpiringGame,
  type ExpirationResult,
  type TierLimits
} from './enforcement-service';
