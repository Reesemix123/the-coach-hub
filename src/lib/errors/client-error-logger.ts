/**
 * Client Error Logger
 *
 * Provides structured error logging for client-side code.
 * In development: logs to console with formatting.
 * In production: sends to API route for persistence in Supabase.
 *
 * @module lib/errors/client-error-logger
 * @since Phase 4 - Hardening
 */

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorMetadata {
  [key: string]: unknown;
}

interface ErrorReport {
  severity: ErrorSeverity;
  code: string;
  message: string;
  stack?: string;
  metadata?: ErrorMetadata;
  source: 'client';
  timestamp: string;
  url: string;
  userAgent: string;
}

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Send error report to server (production only)
 */
async function sendToServer(report: ErrorReport): Promise<void> {
  try {
    await fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  } catch {
    // Silently fail - don't cause more errors
  }
}

/**
 * Format console output for development
 */
function formatConsole(
  severity: ErrorSeverity,
  code: string,
  message: string,
  metadata?: ErrorMetadata
): void {
  const colors: Record<ErrorSeverity, string> = {
    error: 'color: #ff6b6b; font-weight: bold',
    warning: 'color: #ffc107; font-weight: bold',
    info: 'color: #4fc3f7',
  };

  const label = severity.toUpperCase();
  console.groupCollapsed(`%c[${label}] ${code}`, colors[severity]);
  console.log('Message:', message);
  if (metadata && Object.keys(metadata).length > 0) {
    console.log('Metadata:', metadata);
  }
  console.log('Time:', new Date().toISOString());
  console.groupEnd();
}

/**
 * Core logging function
 */
function log(
  severity: ErrorSeverity,
  code: string,
  error: Error | string,
  metadata?: ErrorMetadata
): void {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;

  if (IS_DEV) {
    formatConsole(severity, code, message, metadata);
    if (stack && severity === 'error') {
      console.error(stack);
    }
  } else {
    // Production: send to server
    const report: ErrorReport = {
      severity,
      code,
      message,
      stack,
      metadata,
      source: 'client',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    sendToServer(report);
  }
}

/**
 * Log an error (severe issue that needs attention)
 */
export function clientError(
  code: string,
  error: Error | string,
  metadata?: ErrorMetadata
): void {
  log('error', code, error, metadata);
}

/**
 * Log a warning (potential issue, not critical)
 */
export function clientWarn(
  code: string,
  message: string,
  metadata?: ErrorMetadata
): void {
  log('warning', code, message, metadata);
}

/**
 * Log info (useful for debugging, not an error)
 */
export function clientInfo(
  code: string,
  message: string,
  metadata?: ErrorMetadata
): void {
  log('info', code, message, metadata);
}

// =============================================================================
// Film-specific helpers (pre-scoped for convenience)
// =============================================================================

/**
 * Log a film system error
 */
export function filmError(
  code: string,
  error: Error | string,
  metadata?: ErrorMetadata
): void {
  clientError(`film/${code}`, error, { module: 'film', ...metadata });
}

/**
 * Log a film system warning
 */
export function filmWarn(
  code: string,
  message: string,
  metadata?: ErrorMetadata
): void {
  clientWarn(`film/${code}`, message, { module: 'film', ...metadata });
}

/**
 * Debug logging (no-op in production)
 */
export function filmDebug(message: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.log(`[Film Debug] ${message}`, ...args);
  }
}
