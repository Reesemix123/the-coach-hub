// Simple analytics event dispatcher for tracking user interactions
// Currently uses console logging as a stub - can be extended to integrate
// with analytics providers (Mixpanel, Amplitude, PostHog, etc.)

type AnalyticsEvent = {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
};

// In-memory event queue for development/debugging
const eventQueue: AnalyticsEvent[] = [];

// Set to true to enable console logging of events
const DEBUG_ANALYTICS = process.env.NODE_ENV === 'development';

/**
 * Track a generic analytics event
 */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  const analyticsEvent: AnalyticsEvent = {
    event,
    properties,
    timestamp: new Date().toISOString(),
  };

  eventQueue.push(analyticsEvent);

  if (DEBUG_ANALYTICS) {
    console.log('[Analytics]', event, properties || '');
  }

  // TODO: Send to analytics provider
  // Example integrations:
  // - posthog.capture(event, properties)
  // - mixpanel.track(event, properties)
  // - amplitude.logEvent(event, properties)
}

// ============================================
// Feature Demo Specific Events
// ============================================

/**
 * Track when a feature demo modal is opened
 */
export function trackFeatureModalOpen(featureId: string): void {
  trackEvent('feature_modal_opened', {
    feature_id: featureId,
    source: 'homepage',
  });
}

/**
 * Track when a user clicks the primary CTA in a feature modal
 */
export function trackFeatureModalCTAClick(featureId: string, ctaLabel: string): void {
  trackEvent('feature_modal_cta_clicked', {
    feature_id: featureId,
    cta_label: ctaLabel,
    source: 'homepage',
  });
}

/**
 * Track when a user clicks the secondary CTA in a feature modal
 */
export function trackFeatureModalSecondaryCTAClick(featureId: string, action: string): void {
  trackEvent('feature_modal_secondary_cta_clicked', {
    feature_id: featureId,
    action,
    source: 'homepage',
  });
}

/**
 * Track when a feature demo modal is closed
 */
export function trackFeatureModalClose(featureId: string, method: 'escape' | 'click_outside' | 'close_button'): void {
  trackEvent('feature_modal_closed', {
    feature_id: featureId,
    close_method: method,
    source: 'homepage',
  });
}

/**
 * Track video playback events in demo modals
 */
export function trackFeatureVideoEvent(
  featureId: string,
  action: 'play' | 'pause' | 'ended' | 'error'
): void {
  trackEvent('feature_video_interaction', {
    feature_id: featureId,
    action,
    source: 'homepage',
  });
}

// ============================================
// Debug Utilities
// ============================================

/**
 * Get all tracked events (for debugging)
 */
export function getEventQueue(): AnalyticsEvent[] {
  return [...eventQueue];
}

/**
 * Clear the event queue (for testing)
 */
export function clearEventQueue(): void {
  eventQueue.length = 0;
}
