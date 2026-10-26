// Creator Hub shared types (server-side)
export type CreatorStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type VideoStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'taken_down';
export type VideoKind = 'video' | 'short' | 'live';
export type AccessTier = 'free' | 'paid' | 'auto';
export type EngagementType = 'like' | 'comment' | 'report';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';
export type StrikeStatus = 'active' | 'expired' | 'reversed';

export interface CreatorRow {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  email: string;
  status: CreatorStatus;
  monetization_enabled: boolean;
  access_tier_override: AccessTier | null;
  suspended_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfileRow {
  creator_id: string;
  avatar_url: string | null;
  bio: string | null;
  links: unknown;
  total_followers: number;
  total_likes: number;
  total_views: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorVideoRow {
  id: string;
  creator_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  kind: VideoKind;
  status: VideoStatus;
  access_tier: AccessTier;
  free_until: string | null;
  storage_path: string | null;
  storage_bucket: string;
  thumb_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  rejection_reason: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  published_at: string | null;
  valid_views: number;
  watch_seconds: number;
  likes_count: number;
  comments_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WatchSessionRow {
  id: string;
  video_id: string;
  creator_id: string;
  viewer_user_id: string | null;
  viewer_key: string;
  ip_hash: string | null;
  user_agent: string | null;
  watch_seconds: number;
  heartbeats: number;
  started_at: string;
  last_heartbeat_at: string | null;
  ended_at: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
  is_suspicious: boolean;
  suspicion_score: number;
  suspicion_notes: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface VideoViewRow {
  id: string;
  video_id: string;
  creator_id: string;
  session_id: string;
  viewer_user_id: string | null;
  viewer_key: string;
  watched_seconds: number;
  source: string | null;
  ip_hash: string | null;
  created_at: string;
}

export interface EngagementRow {
  id: string;
  video_id: string;
  creator_id: string;
  user_id: string | null;
  type: EngagementType;
  content: string | null;
  status: ReportStatus;
  details: Record<string, unknown>;
  ip_hash: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CreatorEarningsRow {
  creator_id: string;
  eligible_views: number;
  estimated_earnings_usd: number;
  paid_out_usd: number;
  pending_withdrawal_usd: number;
  last_computed_at: string | null;
  updated_at: string;
}

export interface LedgerRow {
  id: string;
  creator_id: string;
  video_id: string | null;
  entry_type: 'view_credit' | 'adjustment' | 'withdrawal_hold' | 'withdrawal_paid' | 'reversal';
  views: number;
  amount_usd: number;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WithdrawalRow {
  id: string;
  creator_id: string;
  method_id: string | null;
  amount_usd: number;
  status: WithdrawalStatus;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  payout_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutMethodRow {
  id: string;
  creator_id: string;
  method_type: 'bank' | 'paypal' | 'wise' | 'other';
  label: string;
  details: Record<string, unknown>;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrikeRow {
  id: string;
  creator_id: string;
  video_id: string | null;
  reason: string;
  severity: number;
  status: StrikeStatus;
  issued_by: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CopyrightReportRow {
  id: string;
  video_id: string | null;
  reporter_name: string;
  reporter_email: string;
  reporter_user_id: string | null;
  original_work_url: string | null;
  details: string;
  status: ReportStatus;
  resolution_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  creator_id: string;
  type: 'info' | 'approval' | 'rejection' | 'strike' | 'payout' | 'system';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface CreatorSettings {
  id: number;
  min_eligible_views: number;
  payout_per_10000_valid_views_usd: number;
  minimum_withdrawal_usd: number;
  free_access_percentage: number;
  paid_access_percentage: number;
  free_access_duration_days: number;
  moderation_enabled: boolean;
  auto_publish_shorts: boolean;
  min_watch_seconds: number;
  dedupe_window_minutes: number;
  max_sessions_per_hour_per_ip: number;
  max_watch_heartbeat_seconds: number;
  suspicion_threshold: number;
  updated_at: string;
}

export interface CreatorFlags {
  CREATOR_HUB_ENABLED: boolean;
  CREATOR_UPLOAD_ENABLED: boolean;
  CREATOR_MONETIZATION_ENABLED: boolean;
  PAYOUTS_ENABLED: boolean;
  PAID_CONTENT_ENABLED: boolean;
}

export const DEFAULT_SETTINGS: CreatorSettings = {
  id: 1,
  min_eligible_views: 10000,
  payout_per_10000_valid_views_usd: 5.0,
  minimum_withdrawal_usd: 15.0,
  free_access_percentage: 50,
  paid_access_percentage: 50,
  free_access_duration_days: 2,
  moderation_enabled: true,
  auto_publish_shorts: false,
  min_watch_seconds: 30,
  dedupe_window_minutes: 30,
  max_sessions_per_hour_per_ip: 12,
  max_watch_heartbeat_seconds: 20,
  suspicion_threshold: 60,
  updated_at: new Date(0).toISOString(),
};

export const DEFAULT_FLAGS: CreatorFlags = {
  CREATOR_HUB_ENABLED: true,
  CREATOR_UPLOAD_ENABLED: true,
  CREATOR_MONETIZATION_ENABLED: false,
  PAYOUTS_ENABLED: false,
  PAID_CONTENT_ENABLED: false,
};

export interface CreatorIdentity {
  userId: string; // raw Supabase auth uuid
  email: string;
}
