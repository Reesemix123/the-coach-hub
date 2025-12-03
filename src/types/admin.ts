// src/types/admin.ts
// TypeScript types for Admin Console entities

// ============================================================================
// Organization
// ============================================================================

export type OrganizationStatus = 'active' | 'suspended' | 'churned';

export interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
  status: OrganizationStatus;
  stripe_customer_id: string | null;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithOwner extends Organization {
  owner?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface OrganizationWithTeams extends Organization {
  teams?: Team[];
}

// ============================================================================
// Subscription
// ============================================================================

export type SubscriptionTier = 'basic' | 'plus' | 'premium' | 'ai_powered';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'waived';

export interface Subscription {
  id: string;
  team_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_waived: boolean;
  billing_waived_reason: string | null;
  billing_waived_by: string | null;
  billing_waived_at: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithTeam extends Subscription {
  team?: {
    id: string;
    name: string;
    organization_id: string | null;
  };
}

// ============================================================================
// AI Credits
// ============================================================================

export interface AICredits {
  id: string;
  team_id: string;
  credits_allowed: number;
  credits_used: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface AICreditsBalance {
  credits_allowed: number;
  credits_used: number;
  credits_remaining: number;
  period_end: string;
}

// ============================================================================
// Platform Config
// ============================================================================

export interface PlatformConfig {
  id: string;
  key: string;
  value: unknown; // JSONB - type depends on key
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

// Typed config values
export interface TierConfigValue {
  name: string;
  description: string;
  ai_credits: number;
  price_monthly: number;
  max_coaches: number;
  storage_gb: number;
  features: string[];
}

export interface TierConfigs {
  basic: TierConfigValue;
  plus: TierConfigValue;
  premium: TierConfigValue;
  ai_powered: TierConfigValue;
}

export interface TrialConfig {
  trial_enabled: boolean;
  trial_duration_days: number;
  trial_allowed_tiers: SubscriptionTier[];
  trial_ai_credits_limit: number;
}

// ============================================================================
// Audit Log
// ============================================================================

export type AuditTargetType = 'organization' | 'team' | 'user' | 'subscription' | 'config' | 'system';

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: AuditTargetType | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
}

// Common audit actions
export type AuditAction =
  | 'organization.created'
  | 'organization.updated'
  | 'organization.suspended'
  | 'organization.reactivated'
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.waived'
  | 'user.invited'
  | 'user.removed'
  | 'user.role_changed'
  | 'config.updated'
  | 'ai_credits.allocated'
  | 'ai_credits.used'
  | 'system.migration.teams_to_organizations';

// ============================================================================
// Invoice
// ============================================================================

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  organization_id: string;
  stripe_invoice_id: string | null;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  invoice_pdf_url: string | null;
  line_items: InvoiceLineItem[] | null;
  created_at: string;
}

export interface InvoiceLineItem {
  description: string;
  amount_cents: number;
  quantity: number;
  team_name?: string;
}

// ============================================================================
// Extended Profile (with admin fields)
// ============================================================================

export interface ProfileWithAdmin {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  is_platform_admin: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Team (extended with organization)
// ============================================================================

export interface Team {
  id: string;
  name: string;
  level: string | null;
  colors: {
    primary?: string;
    secondary?: string;
  } | null;
  user_id: string;
  organization_id: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TeamWithSubscription extends Team {
  subscription?: Subscription | null;
  ai_credits?: AICreditsBalance | null;
}

export interface TeamWithOrganization extends Team {
  organization?: Organization | null;
}

// ============================================================================
// Dashboard/Summary Types
// ============================================================================

export interface OrganizationSummary {
  id: string;
  name: string;
  status: OrganizationStatus;
  teams_count: number;
  active_users_count: number;
  total_mrr_cents: number;
  created_at: string;
}

export interface PlatformSummary {
  total_organizations: number;
  active_organizations: number;
  total_teams: number;
  total_users: number;
  active_users_30d: number;
  total_mrr_cents: number;
  total_arr_cents: number;
  subscriptions_by_tier: Record<SubscriptionTier, number>;
  subscriptions_by_status: Record<SubscriptionStatus, number>;
}

export interface RevenueMetrics {
  mrr_cents: number;
  arr_cents: number;
  mrr_change_percent: number;
  new_subscriptions_count: number;
  churned_subscriptions_count: number;
  average_revenue_per_team_cents: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateOrganizationRequest {
  name: string;
  owner_user_id?: string; // Optional - defaults to current user
  billing_email?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  billing_email?: string;
  status?: OrganizationStatus;
}

export interface UpdateSubscriptionRequest {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  billing_waived?: boolean;
  billing_waived_reason?: string;
}

export interface WaiveBillingRequest {
  reason: string;
}

export interface AllocateAICreditsRequest {
  credits_allowed: number;
  period_start?: string;
  period_end?: string;
}

// ============================================================================
// Impersonation Sessions
// ============================================================================

export type ImpersonationEndReason = 'expired' | 'manual_logout' | 'admin_revoked';

export interface ImpersonationSession {
  id: string;
  session_token: string;
  admin_user_id: string;
  target_user_id: string;
  organization_id: string | null;
  reason: string;
  created_at: string;
  expires_at: string;
  ended_at: string | null;
  ended_reason: ImpersonationEndReason | null;
}

export interface ImpersonationSessionWithDetails extends ImpersonationSession {
  admin?: {
    email: string;
    full_name: string | null;
  };
  target?: {
    email: string;
    full_name: string | null;
  };
  organization?: {
    name: string;
  };
}

export interface CreateImpersonationRequest {
  target_user_id: string;
  organization_id?: string;
  reason: string;
  duration_minutes?: number; // Default 60
}

export interface ImpersonationResponse {
  session_token: string;
  expires_at: string;
  redirect_url: string;
}

// ============================================================================
// Organization Browser Types
// ============================================================================

export type OrganizationDerivedStatus = 'active' | 'trialing' | 'past_due' | 'churned' | 'inactive';

export interface OrganizationListItem {
  id: string;
  name: string;
  owner_email: string;
  owner_name: string | null;
  derived_status: OrganizationDerivedStatus;
  teams_count: number;
  users_count: number;
  mrr_cents: number;
  created_at: string;
  last_activity_at: string | null;
}

export interface OrganizationDetail extends Organization {
  owner: {
    id: string;
    email: string;
    full_name: string | null;
    last_active_at: string | null;
  };
  derived_status: OrganizationDerivedStatus;
  teams: TeamWithSubscription[];
  users: ProfileWithAdmin[];
  total_mrr_cents: number;
  total_ai_credits_used: number;
  total_ai_credits_allowed: number;
  recent_activity: AuditLog[];
}

export interface OrganizationListResponse {
  organizations: OrganizationListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OrganizationFilters {
  search?: string;
  status?: OrganizationDerivedStatus;
  tier?: SubscriptionTier;
  has_past_due?: boolean;
  sort_by?: 'name' | 'created_at' | 'mrr' | 'teams_count' | 'last_activity';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// ============================================================================
// User Browser Types
// ============================================================================

export type UserRole = 'platform_admin' | 'owner' | 'coach' | 'analyst' | 'viewer';

export type UserDerivedStatus = 'active' | 'inactive' | 'deactivated' | 'never_logged_in';

export interface UserStatus {
  id: string;
  user_id: string;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number;
  last_login_ip: string | null;
  last_login_user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  derived_status: UserDerivedStatus;
  organization_id: string | null;
  organization_name: string | null;
  teams_count: number;
  is_platform_admin: boolean;
  is_deactivated: boolean;
  last_active_at: string | null;
  created_at: string;
}

export interface UserDetail {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  derived_status: UserDerivedStatus;
  is_platform_admin: boolean;
  is_deactivated: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
  deactivation_reason: string | null;
  organization: {
    id: string;
    name: string;
    status: OrganizationStatus;
  } | null;
  teams: {
    id: string;
    name: string;
    role: string;
    organization_id: string | null;
  }[];
  user_status: UserStatus | null;
  recent_activity: AuditLog[];
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserFilters {
  search?: string;
  status?: UserDerivedStatus;
  role?: UserRole;
  organization_id?: string;
  is_platform_admin?: boolean;
  is_deactivated?: boolean;
  sort_by?: 'email' | 'full_name' | 'created_at' | 'last_active_at' | 'teams_count';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface ResetPasswordRequest {
  send_email?: boolean; // Whether to send email notification (default true)
}

export interface ResetPasswordResponse {
  success: boolean;
  temporary_password: string;
  email_sent: boolean;
  expires_at: string;
}

export interface DeactivateUserRequest {
  reason?: string;
  send_email?: boolean; // Whether to send email notification (default true)
}

export interface ReactivateUserRequest {
  send_email?: boolean; // Whether to send email notification (default true)
}
