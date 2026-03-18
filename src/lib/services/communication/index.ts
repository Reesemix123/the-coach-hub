/**
 * Communication Hub Services
 * Re-exports all communication-related services
 */

// Parent management
export * from './parent.service';

// Plan and billing
export * from './plan.service';

// Notification dispatch (email + SMS)
export * from './notification.service';

// Announcements
export * from './announcement.service';

// Calendar + Events
export * from './event.service';

// RSVP
export * from './rsvp.service';

// Phase 3: Video sharing
export * from './video.service';

// Direct messaging (coach <-> parent)
export * from './messaging.service';

// TODO: Phase 4
// export * from './report.service';

// Phase 5: Vimeo OAuth + external video sharing
export * from './vimeo.service';
