// Creator Hub — typed frontend API client.
// Carries the same session token as the main api service (pilot session or
// Supabase access token). No secrets are ever stored here.
const BASE = '/api/creator-hub';

function pilotToken(): string | null {
  try {
    const raw = localStorage.getItem('aether_pilot_session');
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string })?.token || null;
  } catch { return null; }
}

async function authFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  const token = pilotToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else {
    try {
      const { supabase } = await import('./supabase.js');
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch { /* anonymous */ }
  }
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = (body as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

const get = <T,>(path: string) => authFetchJson<T>(`${BASE}${path}`);
const post = <T,>(path: string, body?: unknown) => authFetchJson<T>(`${BASE}${path}`, { method: 'POST', body: body == null ? undefined : JSON.stringify(body) });
const put = <T,>(path: string, body?: unknown) => authFetchJson<T>(`${BASE}${path}`, { method: 'PUT', body: body == null ? undefined : JSON.stringify(body) });
const del = <T,>(path: string) => authFetchJson<T>(`${BASE}${path}`, { method: 'DELETE' });

// ---- shared shapes ----------------------------------------------------------
export interface CreatorHubFlags {
  CREATOR_HUB_ENABLED: boolean;
  CREATOR_UPLOAD_ENABLED: boolean;
  CREATOR_MONETIZATION_ENABLED: boolean;
  PAYOUTS_ENABLED: boolean;
  PAID_CONTENT_ENABLED: boolean;
}

export interface AccessInfo { tier: 'free' | 'paid'; entitled: boolean; free_until: string | null; reason: string }

export interface CreatorVideoCard {
  id: string; title: string; description: string | null; kind: 'video' | 'short' | 'live';
  category_id: string | null; status: string; published_at: string | null;
  duration_seconds: number | null; valid_views: number; likes_count: number; comments_count: number;
  access: AccessInfo; thumb_url: string | null; created_at: string;
  creator: { id: string; handle: string; display_name: string; is_verified: boolean; total_followers: number } | null;
}

export interface CreatorVideoFull extends CreatorVideoRowLite {
  access: AccessInfo;
  storage_path: string | null; thumb_path: string | null;
  rejection_reason: string | null;
}
interface CreatorVideoRowLite {
  id: string; title: string; description: string | null; kind: 'video' | 'short' | 'live';
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'taken_down';
  access_tier: 'free' | 'paid' | 'auto'; duration_seconds: number | null; size_bytes: number | null;
  mime_type: string | null; valid_views: number; watch_seconds: number;
  likes_count: number; comments_count: number; storage_path: string | null;
  created_at: string; published_at: string | null; rejection_reason: string | null;
}

export interface EarningsSummary {
  creator_id: string; eligible_views: number;
  rate_usd_per_10000_valid_views: number;
  estimated_earnings_usd: number; paid_out_usd: number; pending_withdrawal_usd: number;
  available_for_withdrawal_usd: number; min_eligible_views: number;
  monetization_eligible: boolean; minimum_withdrawal_usd: number;
  label: 'Estimated Earnings'; disclaimer: string;
}

export interface CreatorSettings {
  min_eligible_views: number; payout_per_10000_valid_views_usd: number; minimum_withdrawal_usd: number;
  free_access_percentage: number; paid_access_percentage: number; free_access_duration_days: number;
  moderation_enabled: boolean; auto_publish_shorts: boolean;
  min_watch_seconds: number; dedupe_window_minutes: number;
  max_sessions_per_hour_per_ip: number; max_watch_heartbeat_seconds: number; suspicion_threshold: number;
}

// ---- public -------------------------------------------------------------------
export const creatorHubApi = {
  getFlags: () => get<{ flags: CreatorHubFlags; settings: Partial<CreatorSettings>; persistence: 'sql' | 'memory' }>('/flags'),
  getCategories: () => get<{ categories: Array<{ id: string; slug: string; name: string }> }>('/categories'),
  listVideos: (q: { kind?: string; category_id?: string; sort?: string; q?: string; limit?: number; offset?: number } = {}) =>
    get<{ videos: CreatorVideoCard[] }>(`/videos?${new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString()}`),
  getVideo: (id: string) => get<{ video: CreatorVideoCard }>(`/videos/${id}`),
  startWatch: (id: string) => post<{ sessionId: string; playbackUrl: string | null; access: AccessInfo; minWatchSeconds: number; heartbeatSeconds: number }>(`/videos/${id}/watch/start`),
  heartbeat: (sessionId: string, deltaSeconds: number, playing: boolean) => post<{ ok: true; watch_seconds: number; is_suspicious: boolean }>(`/watch/${sessionId}/heartbeat`, { deltaSeconds, playing }),
  endWatch: (sessionId: string) => post<{ ok: true; validView: boolean; is_valid: boolean; invalid_reason: string | null }>(`/watch/${sessionId}/end`),
  likeVideo: (id: string) => post<{ liked: boolean }>(`/videos/${id}/like`),
  listComments: (id: string) => get<{ comments: Array<{ id: string; user_id: string | null; content: string; created_at: string }> }>(`/videos/${id}/comments`),
  addComment: (id: string, content: string) => post<{ comment: { id: string; content: string; created_at: string } }>(`/videos/${id}/comments`, { content }),
  reportVideo: (videoId: string, content: string) => post<{ ok: true; report_id: string }>('/reports', { video_id: videoId, content }),
  submitCopyrightReport: (payload: Record<string, string>) => post<{ ok: true; report_id: string }>('/copyright-reports', payload),
  getCreatorProfile: (handle: string) => get<{ creator: { id: string; handle: string; display_name: string }; profile: { bio: string | null; total_followers: number; total_likes: number; total_views: number; is_verified: boolean } | null; videos: CreatorVideoCard[] }>(`/creators/${handle}`),
  toggleFollow: (creatorId: string) => post<{ following: boolean }>(`/creators/${creatorId}/follow`),
  rollup: () => post<{ ok: true; creators: number; entries: number }>('/cron/rollup'),

  // ---- creator portal ---------------------------------------------------------
  me: () => get<{
    creator: { id: string; handle: string; display_name: string; email: string; status: string; monetization_enabled: boolean; created_at: string };
    profile: { bio: string | null; avatar_url: string | null; total_followers: number; total_likes: number; total_views: number } | null;
    earnings: EarningsSummary; flags: CreatorHubFlags; settings: CreatorSettings;
    copyright_status: { active_strikes: number; max_strikes: number; note: string };
    persistence: 'sql' | 'memory';
  }>('/me'),
  updateMe: (patch: { display_name?: string }) => put<{ creator: { display_name: string } }>('/me', patch),
  updateProfile: (patch: { bio?: string; avatar_url?: string | null }) => put<{ profile: unknown }>('/me/profile', patch),
  dashboard: () => get<{
    videos: { total: number; by_status: Record<string, number> };
    totals: { valid_views: number; watch_hours: number; likes: number; comments: number; followers: number };
    views_last_7_days: Record<string, number>;
    earnings: EarningsSummary; persistence: 'sql' | 'memory';
  }>('/me/dashboard'),
  myVideos: (q: { status?: string; kind?: string } = {}) => get<{ videos: CreatorVideoFull[] }>(`/me/videos?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  createVideo: (payload: { title: string; description?: string; kind?: string; category_id?: string | null }) => post<{ video: CreatorVideoFull }>('/me/videos', payload),
  updateVideo: (id: string, patch: Record<string, unknown>) => put<{ video: CreatorVideoFull }>(`/me/videos/${id}`, patch),
  deleteVideo: (id: string) => del<{ ok: true }>(`/me/videos/${id}`),
  getUploadUrl: (id: string, mime: string, sizeBytes: number) => post<{ signedUrl: string; token: string; path: string; bucket: string; max_bytes: number }>(`/me/videos/${id}/upload-url`, { mime, sizeBytes }),
  uploadComplete: (id: string, durationSeconds?: number) => post<{ video: CreatorVideoFull; moderation: string }>(`/me/videos/${id}/upload-complete`, durationSeconds ? { durationSeconds } : {}),
  submitForReview: (id: string) => post<{ video: CreatorVideoFull }>(`/me/videos/${id}/submit`),
  analytics: (days = 30) => get<{ range_days: number; total_valid_views: number; per_day: Record<string, { views: number; watch_seconds: number }>; top_videos: Array<{ id: string; title: string; valid_views: number; watch_seconds: number; likes: number }> }>(`/me/analytics?days=${days}`),
  myEarnings: () => get<{ summary: EarningsSummary; ledger: Array<{ id: string; entry_type: string; views: number; amount_usd: number; description: string | null; created_at: string }>; label: string; disclaimer: string }>('/me/earnings'),
  myWithdrawals: () => get<{ withdrawals: Array<{ id: string; amount_usd: number; status: string; created_at: string; processed_at: string | null; admin_note: string | null; payout_ref: string | null }> }>('/me/withdrawals'),
  requestWithdrawal: (amount_usd: number, method_id: string | null) => post<{ withdrawal: { id: string; amount_usd: number; status: string } }>('/me/withdrawals', { amount_usd, method_id }),
  payoutMethods: () => get<{ methods: Array<{ id: string; method_type: string; label: string; details: Record<string, unknown>; is_default: boolean; created_at: string }> }>('/me/payout-methods'),
  addPayoutMethod: (payload: { method_type: string; label: string; details: Record<string, string>; is_default?: boolean }) => post<{ method: { id: string } }>('/me/payout-methods', payload),
  deletePayoutMethod: (id: string) => del<{ ok: true }>(`/me/payout-methods/${id}`),
  myFollowers: () => get<{ total: number; followers: Array<{ user_id: string; followed_at: string }> }>('/me/followers'),
  myNotifications: () => get<{ notifications: Array<{ id: string; type: string; title: string; body: string | null; read_at: string | null; created_at: string }> }>('/me/notifications'),
  markNotificationsRead: (ids?: string[]) => post<{ ok: true }>('/me/notifications/read', ids ? { ids } : {}),
  myStrikes: () => get<{ strikes: Array<{ id: string; reason: string; severity: number; status: string; created_at: string; video_id: string | null }>; active_count: number }>('/me/strikes'),
};

// ---- admin ---------------------------------------------------------------------
export const creatorHubAdminApi = {
  overview: () => get<{ totals: Record<string, number>; flags: CreatorHubFlags; settings: CreatorSettings; persistence: 'sql' | 'memory' }>('/admin/overview'),
  qa: () => get<{ persistence_mode: string; hint: string; table_counts: Record<string, number>; flags: CreatorHubFlags; settings: CreatorSettings; storage_bucket: string }>('/admin/qa'),
  qaRecheck: () => post<{ persistence_mode: string }>('/admin/qa/recheck'),
  qaSeedCreator: () => post<{ creator: { id: string; handle: string; email: string }; login_hint: { email: string; password: string; note: string } }>('/admin/qa/seed-creator'),
  listCreators: (q: { status?: string; q?: string } = {}) => get<{ creators: Array<{ id: string; handle: string; display_name: string; email: string; status: string; monetization_enabled: boolean; access_tier_override: string | null; created_at: string; total_views: number; total_followers: number }> }>(`/admin/creators?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  createCreator: (payload: { handle: string; email: string; display_name: string; status?: string }) => post<{ creator: { id: string; handle: string }; generated_password: string | null; note: string }>('/admin/creators', payload),
  updateCreator: (id: string, patch: Record<string, unknown>) => put<{ creator: unknown }>(`/admin/creators/${id}`, patch),
  listVideos: (q: { status?: string; creator_id?: string; q?: string } = {}) => get<{ videos: Array<CreatorVideoFull & { creator: { id: string; handle: string; display_name: string } | null }> }>(`/admin/videos?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  approveVideo: (id: string) => post<{ video: unknown }>(`/admin/videos/${id}/approve`),
  rejectVideo: (id: string, reason: string) => post<{ video: unknown }>(`/admin/videos/${id}/reject`, { reason }),
  takedownVideo: (id: string, reason: string, issueStrike = true) => post<{ video: unknown; strike: { strike_count: number; auto_suspended: boolean } | null }>(`/admin/videos/${id}/takedown`, { reason, issue_strike: issueStrike }),
  setVideoAccess: (id: string, access_tier: string, free_until?: string | null) => post<{ video: unknown }>(`/admin/videos/${id}/access`, { access_tier, free_until }),
  setCreatorAccess: (id: string, access_tier_override: string | null) => post<{ creator: unknown }>(`/admin/creators/${id}/access`, { access_tier_override }),
  listReports: () => get<{ reports: Array<{ id: string; video_id: string; content: string; status: string; created_at: string; video: { id: string; title: string; status: string } | null }> }>('/admin/reports'),
  resolveReport: (id: string, status: string) => post<{ report: unknown }>(`/admin/reports/${id}/resolve`, { status }),
  listCopyrightReports: () => get<{ reports: Array<{ id: string; video_id: string | null; reporter_name: string; reporter_email: string; details: string; status: string; created_at: string }> }>('/admin/copyright-reports'),
  copyrightAction: (id: string, action: 'resolve' | 'dismiss' | 'takedown_and_strike', note?: string) => post<{ report: unknown; strike: unknown }>(`/admin/copyright-reports/${id}/action`, { action, note }),
  listStrikes: (creatorId?: string) => get<{ strikes: Array<{ id: string; creator_id: string; video_id: string | null; reason: string; severity: number; status: string; created_at: string }> }>(`/admin/strikes${creatorId ? `?creator_id=${creatorId}` : ''}`),
  issueStrike: (creator_id: string, reason: string, severity = 1, video_id?: string | null) => post<{ strike_count: number; auto_suspended: boolean }>('/admin/strikes', { creator_id, reason, severity, video_id }),
  reverseStrike: (id: string) => post<{ strike: unknown }>(`/admin/strikes/${id}/reverse`),
  earningsAll: () => get<{ earnings: EarningsSummary[]; label: string }>('/admin/earnings'),
  ledger: (creatorId: string) => get<{ ledger: Array<{ id: string; entry_type: string; views: number; amount_usd: number; description: string | null; created_at: string }> }>(`/admin/earnings/${creatorId}/ledger`),
  adjustEarnings: (creatorId: string, amount_usd: number, description: string) => post<{ summary: EarningsSummary }>(`/admin/earnings/${creatorId}/adjust`, { amount_usd, description }),
  listWithdrawals: (status?: string) => get<{ withdrawals: Array<{ id: string; creator_id: string; amount_usd: number; status: string; created_at: string; admin_note: string | null; payout_ref: string | null }> }>(`/admin/withdrawals${status ? `?status=${status}` : ''}`),
  processWithdrawal: (id: string, action: 'approve' | 'reject' | 'mark_paid', opts: { admin_note?: string; payout_ref?: string } = {}) => post<{ withdrawal: unknown }>(`/admin/withdrawals/${id}/process`, { action, ...opts }),
  payoutMethods: (creatorId?: string) => get<{ methods: Array<{ id: string; creator_id: string; method_type: string; label: string; details: Record<string, unknown>; is_default: boolean }> }>(`/admin/payout-methods${creatorId ? `?creator_id=${creatorId}` : ''}`),
  fraudSessions: (onlySuspicious = false) => get<{ sessions: Array<{ id: string; video_title: string | null; viewer_user_id: string | null; viewer_key: string; watch_seconds: number; heartbeats: number; started_at: string; ended_at: string | null; is_valid: boolean; invalid_reason: string | null; is_suspicious: boolean; suspicion_score: number; suspicion_notes: string[] }> }>(`/admin/fraud/sessions${onlySuspicious ? '?only_suspicious=1' : ''}`),
  reviewSession: (id: string, action: 'validate' | 'invalidate') => post<{ session: unknown }>(`/admin/fraud/sessions/${id}/${action}`),
  getSettings: () => get<{ settings: CreatorSettings; flags: CreatorHubFlags }>('/admin/settings'),
  saveSettings: (patch: Partial<CreatorSettings>) => put<{ settings: CreatorSettings }>('/admin/settings', patch),
  setFlag: (key: string, enabled: boolean) => put<{ flags: CreatorHubFlags }>(`/admin/flags/${key}`, { enabled }),
};

// direct upload to Supabase Storage using the signed upload URL
export async function uploadToSignedUrl(signedUrl: string, token: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'true', 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  void token;
}
