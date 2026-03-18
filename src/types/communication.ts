/**
 * Communication Hub TypeScript Types
 * Matches database schema from migrations 138-143
 */

// ======================
// ENUMS
// ======================

export type TeamMembershipRole = 'owner' | 'coach' | 'analyst' | 'viewer' | 'team_admin';

export type EventType =
  | 'practice'
  | 'game'
  | 'meeting'
  | 'scrimmage'
  | 'team_bonding'
  | 'film_session'
  | 'parent_meeting'
  | 'fundraiser'
  | 'other';

export type NotificationChannel = 'sms' | 'email' | 'both';

export type ParentRelationship = 'mother' | 'father' | 'guardian' | 'stepmother' | 'stepfather' | 'other';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type ConsentType = 'account_creation' | 'video_sharing' | 'data_usage';

export type PlanTier = 'rookie' | 'varsity' | 'all_conference' | 'all_state';

export type PlanStatus = 'active' | 'expired' | 'cancelled';

export type CoachOverrideStatus = 'grace_period' | 'limited';

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export type PositionGroup = 'offense' | 'defense' | 'special_teams';

export type RSVPStatus = 'attending' | 'not_attending' | 'maybe';

export type MessageSenderType = 'owner' | 'coach' | 'team_admin' | 'parent';

export type NotificationType = 'announcement' | 'event' | 'video_shared' | 'report_shared' | 'rsvp_reminder' | 'invitation';

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';

export type MuxAssetStatus = 'preparing' | 'ready' | 'errored';

export type VideoShareType = 'team' | 'individual';

export type ReportType = 'player_summary' | 'game_recap' | 'season_progress' | 'individual';

export type ReportVisibility = 'parents' | 'specific_parent';

export type GameSummaryStatus = 'draft' | 'published';

export type ExternalPlatform = 'vimeo';

export type ExternalAccountStatus = 'active' | 'disconnected' | 'expired';

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';

export type PrivacySetting = 'public' | 'unlisted' | 'private';

export type MuxCleanupStatus = 'pending' | 'completed' | 'retained';

// ======================
// PARENT SYSTEM
// ======================

export interface ParentProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notification_preference: NotificationChannel;
  avatar_url: string | null;
  is_champion: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerParentLink {
  id: string;
  player_id: string;
  parent_id: string;
  relationship: ParentRelationship;
  is_primary_contact: boolean;
  created_at: string;
}

export interface TeamParentAccess {
  id: string;
  team_id: string;
  parent_id: string;
  access_level: 'full' | 'view_only';
  status: 'active' | 'invited' | 'removed';
  joined_at: string;
}

export interface ParentInvitation {
  id: string;
  team_id: string;
  player_id: string;
  invited_by: string;
  parent_email: string;
  parent_name: string | null;
  relationship: string | null;
  invitation_token: string;
  token_expires_at: string;
  auto_resend_at: string;
  auto_resend_sent: boolean;
  status: InvitationStatus;
  accepted_at: string | null;
  created_at: string;
}

export interface ParentConsentLog {
  id: string;
  parent_id: string | null;
  team_id: string | null;
  consent_type: ConsentType;
  consented: boolean;
  consent_text: string;
  ip_address: string | null;
  user_agent: string | null;
  consented_at: string;
}

export interface ParentEmailChange {
  id: string;
  parent_id: string;
  old_email: string;
  new_email: string;
  requested_by: string;
  confirmation_token: string;
  confirmed_at: string | null;
  status: 'pending' | 'confirmed' | 'expired';
  created_at: string;
}

// ======================
// PLANS & BILLING
// ======================

export interface TeamCommunicationPlan {
  id: string;
  team_id: string;
  purchased_by: string;
  purchaser_role: 'owner' | 'coach' | 'team_admin';
  stripe_payment_id: string;
  stripe_product_id: string | null;
  plan_tier: PlanTier;
  max_parents: number | null; // null for unlimited
  max_team_videos: number;
  team_videos_used: number;
  includes_reports: boolean;
  activated_at: string;
  expires_at: string;
  content_accessible_until: string | null;
  mux_cleanup_at: string | null;
  coach_override_status: CoachOverrideStatus | null;
  grace_period_ends_at: string | null;
  status: PlanStatus;
  created_at: string;
}

export interface VideoTopupPurchase {
  id: string;
  team_id: string;
  communication_plan_id: string | null;
  purchased_by: string;
  stripe_payment_id: string;
  videos_added: number;
  videos_used: number;
  purchased_at: string;
}

export interface TeamCoachHistory {
  id: string;
  team_id: string;
  coach_id: string;
  action: 'joined' | 'left' | 'transferred' | 'downgraded' | 'upgraded';
  previous_coach_id: string | null;
  communication_plan_status: 'unaffected' | 'grace_period' | 'limited' | null;
  notes: string | null;
  created_at: string;
}

// ======================
// COMMUNICATION FEATURES
// ======================

export interface Announcement {
  id: string;
  team_id: string;
  sender_id: string;
  sender_role: 'owner' | 'coach' | 'team_admin';
  title: string;
  body: string;
  priority: AnnouncementPriority;
  notification_channel: NotificationChannel;
  target_position_group: PositionGroup | null;
  attachments: AnnouncementAttachment[];
  shared_video_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementAttachment {
  name: string;
  url: string;
  type: string;
}

export interface AnnouncementRead {
  announcement_id: string;
  parent_id: string;
  read_at: string;
}

export interface ChildException {
  player_id: string;
  status: RSVPStatus;
  note?: string;
}

export interface EventRSVP {
  id: string;
  event_id: string;
  parent_id: string;
  family_status: RSVPStatus;
  child_exceptions: ChildException[];
  note: string | null;
  responded_at: string;
  updated_at: string;
}

export interface DirectMessage {
  id: string;
  team_id: string;
  sender_type: MessageSenderType;
  sender_id: string;
  recipient_type: 'coach' | 'parent';
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationLogEntry {
  id: string;
  team_id: string | null;
  recipient_id: string;
  recipient_type: 'parent' | 'coach' | 'admin';
  channel: 'sms' | 'email';
  notification_type: NotificationType;
  subject: string | null;
  body_preview: string | null;
  external_id: string | null;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string;
}

export interface SMSAutoResponse {
  id: string;
  from_phone: string;
  to_phone: string;
  inbound_body: string | null;
  auto_response_sent: boolean;
  created_at: string;
}

// ======================
// VIDEO SHARING
// ======================

export interface SharedVideo {
  id: string;
  team_id: string;
  coach_id: string;
  title: string;
  description: string | null;
  mux_asset_id: string;
  mux_playback_id: string;
  mux_asset_status: MuxAssetStatus;
  thumbnail_time: number;
  duration_seconds: number | null;
  share_type: VideoShareType;
  coach_notes: string | null;
  source_film_id: string | null;
  source_tag_id: string | null;
  notification_channel: NotificationChannel;
  publish_confirmed: boolean;
  publish_confirmed_at: string | null;
  signed_url_expires_hours: number;
  created_at: string;
}

export interface VideoShareTarget {
  id: string;
  video_id: string;
  player_id: string | null;
  parent_id: string | null;
  viewed_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

export interface VideoPublishConfirmation {
  id: string;
  video_id: string;
  coach_id: string;
  confirmation_text: string;
  confirmed_at: string;
}

export interface MuxCleanupQueueEntry {
  id: string;
  communication_plan_id: string | null;
  mux_asset_id: string;
  scheduled_cleanup_at: string;
  cleaned_up_at: string | null;
  status: MuxCleanupStatus;
  created_at: string;
}

// ======================
// REPORTS
// ======================

export interface PlayerHighlight {
  player_id: string;
  highlight_text: string;
}

export interface SharedReport {
  id: string;
  team_id: string;
  report_type: ReportType;
  player_id: string | null;
  game_id: string | null;
  coach_id: string;
  coach_notes: string | null;
  report_data: Record<string, unknown>;
  visibility: ReportVisibility;
  target_parent_id: string | null;
  notification_channel: NotificationChannel;
  shared_at: string;
  expires_at: string | null;
}

export interface ReportView {
  report_id: string;
  parent_id: string;
  viewed_at: string;
}

export interface GameSummary {
  id: string;
  team_id: string;
  game_id: string | null;
  coach_id: string;
  coach_raw_notes: string | null;
  ai_draft: string | null;
  published_text: string | null;
  opponent: string | null;
  score_us: number | null;
  score_them: number | null;
  game_date: string | null;
  player_highlights: PlayerHighlight[];
  status: GameSummaryStatus;
  notification_channel: NotificationChannel;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ======================
// EXTERNAL SHARING
// ======================

export interface CoachExternalAccount {
  id: string;
  coach_id: string;
  platform: ExternalPlatform;
  platform_account_id: string | null;
  platform_account_name: string | null;
  access_token_vault_id: string;
  refresh_token_vault_id: string | null;
  token_expires_at: string | null;
  connected_at: string;
  status: ExternalAccountStatus;
}

export interface ExternalVideoShare {
  id: string;
  coach_id: string;
  team_id: string;
  source_type: 'shared_video' | 'film_session' | 'highlight_reel';
  source_id: string;
  platform: ExternalPlatform;
  external_url: string | null;
  external_video_id: string | null;
  title: string;
  description: string | null;
  privacy_setting: PrivacySetting;
  watermark_applied: boolean;
  upload_status: UploadStatus;
  upload_progress: number;
  upload_error: string | null;
  confirmation_text: string;
  published_at: string | null;
  created_at: string;
}

// ======================
// EXTENDED TEAM EVENTS
// ======================

export interface TeamEventExtended {
  id: string;
  team_id: string;
  event_type: EventType;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_notes: string | null;
  opponent: string | null;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  notification_channel: NotificationChannel;
  start_datetime: string | null;
  end_datetime: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  until?: string;
  count?: number;
  byDay?: string[];
}

// ======================
// HELPER TYPES
// ======================

export interface VideoCredits {
  base_remaining: number;
  topup_remaining: number;
  total_remaining: number;
}

export interface ParentWithChildren {
  parent: ParentProfile;
  children: Array<{
    player_id: string;
    player_name: string;
    jersey_number: number | null;
    relationship: ParentRelationship;
    is_primary_contact: boolean;
  }>;
}

export interface AnnouncementWithReadStatus extends Announcement {
  is_read: boolean;
  read_at: string | null;
}

export interface EventWithRSVP extends TeamEventExtended {
  rsvp: EventRSVP | null;
  rsvp_summary: {
    attending: number;
    not_attending: number;
    maybe: number;
    no_response: number;
  };
}

// Plan tier limits
export const PLAN_TIER_LIMITS: Record<PlanTier, number | null> = {
  rookie: 20,
  varsity: 40,
  all_conference: 60,
  all_state: null, // unlimited
};

export const PLAN_TIER_PRICES: Record<PlanTier, number> = {
  rookie: 149,
  varsity: 249,
  all_conference: 349,
  all_state: 449,
};

export const VIDEO_TOPUP_PACK = {
  videos: 5,
  price: 39,
} as const;
