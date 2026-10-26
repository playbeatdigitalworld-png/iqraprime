/**
 * Aether Stream Frontend API Client
 */

import type {
  AdminDeviceRecord,
  AdminStats,
  AdminWatchHistoryRecord,
  CatalogCategory,
  CatalogHighlights,
  CatalogItem,
  CatalogMovieInfo,
  CatalogSeriesInfo,
  CatalogStatsInfo,
  Channel,
  DeviceInfo,
  IPTVLiveCategory,
  M3UChannel,
  MemberAccount,
  MemberIptvLineMasked,
  Movie,
  PilotSettings,
  StarIPTVLog,
  StarIPTVPackage,
  StarIPTVVaultConfig,
  Subscription,
  TakedownRequest,
  User,
  WatchProgress,
} from '../types/index.js';

const BASE_URL = '/api';

const PILOT_SESSION_KEY = 'aether_pilot_session';

function getStoredPilotToken(): string | null {
  try {
    const raw = localStorage.getItem(PILOT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed?.token || null;
  } catch {
    return null;
  }
}

/**
 * fetch wrapper that attaches the caller's session token (backend pilot
 * session or Supabase access token). Provider credentials are NEVER stored
 * client-side — this only carries the app's own session token.
 */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  const token = getStoredPilotToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    try {
      const { supabase } = await import('./supabase.js');
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // ignore — unauthenticated request
    }
  }
  return fetch(url, { ...init, headers });
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await authFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to login');
    }
    return res.json() as Promise<{ success: boolean; user: User; subscription?: Subscription; token: string }>;
  },

  async register(name: string, email: string, password: string) {
    const res = await authFetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to register');
    }
    return res.json() as Promise<{ success: boolean; user: User; subscription: Subscription; token: string }>;
  },

  async getMe(token?: string) {
    const res = await authFetch(`${BASE_URL}/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json() as Promise<{ user: User; subscription: Subscription }>;
  },

  // Content
  async getChannels() {
    const res = await authFetch(`${BASE_URL}/content/channels`);
    if (!res.ok) throw new Error('Failed to load channels');
    const data = await res.json();
    return data.channels as Channel[];
  },

  async getMovies() {
    const res = await authFetch(`${BASE_URL}/content/movies`);
    if (!res.ok) throw new Error('Failed to load movies');
    const data = await res.json();
    return data.movies as Movie[];
  },

  async getContinueWatching(userId?: string) {
    const res = await authFetch(`${BASE_URL}/content/continue-watching?userId=${userId || ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.continueWatching as WatchProgress[];
  },

  async recordProgress(data: { contentId: string; contentType?: 'movie' | 'channel'; positionSeconds: number; durationSeconds: number; userId?: string }) {
    await authFetch(`${BASE_URL}/content/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  },

  async getWatchlist(userId?: string) {
    const res = await authFetch(`${BASE_URL}/content/watchlist?userId=${userId || ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.watchlist as Array<{ type: 'channel' | 'movie'; data: Channel | Movie }>;
  },

  async toggleWatchlist(contentId: string, userId?: string) {
    const res = await authFetch(`${BASE_URL}/content/watchlist/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, userId }),
    });
    return res.json() as Promise<{ success: boolean; inList: boolean; contentId: string }>;
  },

  // Subscriptions & Plans
  async getPlans() {
    const res = await authFetch(`${BASE_URL}/subscriptions/plans`);
    return res.json();
  },

  async getMySubscription(userId?: string) {
    const res = await authFetch(`${BASE_URL}/subscriptions/my-subscription?userId=${userId || ''}`);
    return res.json();
  },

  async orderPlan(payload: { planId: string; packageId?: string; paymentMethod: string; name?: string; email?: string; userId?: string }) {
    const res = await authFetch(`${BASE_URL}/subscriptions/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Pilot Settings & Member Management
  async getPilotSettings() {
    const res = await authFetch(`${BASE_URL}/pilot/settings`);
    return res.json() as Promise<{ settings: PilotSettings }>;
  },

  async updatePilotSettings(payload: Partial<PilotSettings>) {
    const res = await authFetch(`${BASE_URL}/pilot/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<{ success: boolean; settings: PilotSettings }>;
  },

  async getMembers() {
    const res = await authFetch(`${BASE_URL}/admin/members`);
    return res.json() as Promise<{
      members: MemberAccount[];
      slots: { total: number; current: number; active: number; remaining: number; maxDevicesPerUser: number };
    }>;
  },

  async createMember(name: string, email: string, password: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create member');
    }
    return res.json() as Promise<{ success: boolean; member: MemberAccount }>;
  },

  async toggleMember(id: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/${id}/toggle`, { method: 'POST' });
    return res.json() as Promise<{ success: boolean; status: 'active' | 'disabled' }>;
  },

  async deleteMember(id: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/${id}`, { method: 'DELETE' });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async resetMemberPassword(id: string, password: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.json();
  },

  // Full provider catalog (Star IPTV line) — live/VOD/series browsing.
  // Browsing payloads contain no credentials; playback URLs resolve per-user.
  async getCatalogCategories(type: 'live' | 'vod' | 'series') {
    const res = await authFetch(`${BASE_URL}/catalog/categories?type=${type}`);
    if (!res.ok) throw new Error('Catalog unavailable');
    return res.json() as Promise<{ categories: CatalogCategory[]; line: string }>;
  },

  async getCatalogItems(type: 'live' | 'vod' | 'series', categoryId: string, page = 1, limit = 60) {
    const res = await authFetch(`${BASE_URL}/catalog/items?type=${type}&categoryId=${encodeURIComponent(categoryId)}&page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Catalog unavailable');
    return res.json() as Promise<{ items: CatalogItem[]; page: number; totalInCategory: number; line: string }>;
  },

  async searchCatalog(type: 'live' | 'vod' | 'series', q: string, categoryId?: string) {
    const res = await authFetch(`${BASE_URL}/catalog/search?type=${type}&q=${encodeURIComponent(q)}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ''}`);
    if (!res.ok) throw new Error('Catalog search unavailable');
    return res.json() as Promise<{ items: CatalogItem[]; scope: string; line: string }>;
  },

  async getCatalogMovie(numericId: number) {
    const res = await authFetch(`${BASE_URL}/catalog/movie/${numericId}`);
    if (!res.ok) throw new Error('Movie info unavailable');
    return res.json() as Promise<{ movie: CatalogMovieInfo }>;
  },

  async getCatalogSeries(numericId: number) {
    const res = await authFetch(`${BASE_URL}/catalog/series/${numericId}`);
    if (!res.ok) throw new Error('Series info unavailable');
    return res.json() as Promise<{ series: CatalogSeriesInfo }>;
  },

  async resolveCatalogPlay(type: 'live' | 'vod' | 'series', itemId: string, episodeId?: string) {
    const res = await authFetch(`${BASE_URL}/catalog/play?type=${type}&itemId=${encodeURIComponent(itemId)}${episodeId ? `&episodeId=${encodeURIComponent(episodeId)}` : ''}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Playback resolution failed');
    return data as { kind: 'hls' | 'mp4'; url: string; title?: string; line: string };
  },

  // Verified provider catalog metrics (real totals from the provider API)
  async getCatalogStats() {
    const res = await fetch(`${BASE_URL}/catalog/stats`);
    if (!res.ok) throw new Error('Catalog stats unavailable');
    return res.json() as Promise<{ stats: CatalogStatsInfo }>;
  },

  // Credential-free home rail samples (live channels / latest movies / series)
  async getCatalogHighlights() {
    const res = await fetch(`${BASE_URL}/catalog/highlights`);
    if (!res.ok) throw new Error('Catalog highlights unavailable');
    return res.json() as Promise<CatalogHighlights>;
  },

  // Member self-service line ("Simple Player") — credentials stay server-side
  async getMyLine() {
    const res = await authFetch(`${BASE_URL}/me/line`);
    if (!res.ok) throw new Error('Unauthorized');
    return res.json() as Promise<{ line: MemberIptvLineMasked | null; selfManaged: boolean }>;
  },

  async connectMyLine(payload: { serverUrl?: string; username?: string; password?: string; m3uUrl?: string }) {
    const res = await authFetch(`${BASE_URL}/me/line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Line verification failed');
    return data as {
      success: boolean;
      message: string;
      line: MemberIptvLineMasked;
      probe?: { ok: boolean; message: string; expiresAt?: string; maxConnections?: number };
    };
  },

  async disconnectMyLine() {
    const res = await authFetch(`${BASE_URL}/me/line`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to disconnect line');
    return data as { success: boolean; message: string };
  },

  // Per-member Star IPTV line assignment (admin only; credentials stay server-side)
  async getAllIptvLines() {
    const res = await authFetch(`${BASE_URL}/admin/iptv-lines`);
    return res.json() as Promise<{ lines: MemberIptvLineMasked[] }>;
  },

  async getMemberIptvLine(memberId: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/${memberId}/iptv-line`);
    return res.json() as Promise<{ line: MemberIptvLineMasked }>;
  },

  async assignMemberIptvLine(
    memberId: string,
    payload: { serverUrl: string; username: string; password: string; m3uUrl?: string; epgUrl?: string; providerName?: string; status?: 'active' | 'disabled' },
  ) {
    const res = await authFetch(`${BASE_URL}/admin/members/${memberId}/iptv-line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to assign Star IPTV line');
    return data as {
      success: boolean;
      message: string;
      line: MemberIptvLineMasked;
      probe?: { ok: boolean; message: string; expiresAt?: string; maxConnections?: number };
    };
  },

  async clearMemberIptvLine(memberId: string) {
    const res = await authFetch(`${BASE_URL}/admin/members/${memberId}/iptv-line`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to unassign Star IPTV line');
    return data as { success: boolean; message: string };
  },

  async revokeDevice(userId: string, deviceId: string) {
    const res = await authFetch(`${BASE_URL}/devices/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId }),
    });
    return res.json() as Promise<{ success: boolean; devices: DeviceInfo[]; message: string }>;
  },

  // Star IPTV Credentials Vault & M3U / EPG
  async getStarIPTVConfig() {
    const res = await authFetch(`${BASE_URL}/iptv/config`);
    return res.json() as Promise<{
      config: StarIPTVVaultConfig;
      logs: StarIPTVLog[];
    }>;
  },

  async updateStarIPTVConfig(payload: {
    providerName?: string;
    serverUrl?: string;
    username?: string;
    password?: string;
    m3uUrl?: string;
    epgUrl?: string;
    apiUrl?: string;
    apiKey?: string;
    resellerId?: string;
  }) {
    const res = await authFetch(`${BASE_URL}/iptv/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async testStarIPTVConnection() {
    const res = await authFetch(`${BASE_URL}/iptv/test-connection`, { method: 'POST' });
    return res.json() as Promise<{ status: string; statusCode?: number; latencyMs?: number; message: string; timestamp: string }>;
  },

  async testM3U(url?: string) {
    const res = await authFetch(`${BASE_URL}/iptv/test-m3u`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json() as Promise<{ status: string; valid: boolean; channelCount?: number; latencyMs?: number; message: string }>;
  },

  async testEPG(url?: string) {
    const res = await authFetch(`${BASE_URL}/iptv/test-epg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json() as Promise<{ status: string; valid: boolean; latencyMs?: number; message: string }>;
  },

  async importM3U(url?: string) {
    const res = await authFetch(`${BASE_URL}/iptv/import-m3u`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json() as Promise<{ success: boolean; channels: M3UChannel[]; count: number; message: string }>;
  },

  async getM3UChannels() {
    const res = await authFetch(`${BASE_URL}/iptv/m3u-channels`);
    return res.json() as Promise<{ channels: M3UChannel[]; total: number }>;
  },

  async toggleM3UChannel(id: string, enabled?: boolean) {
    const res = await authFetch(`${BASE_URL}/iptv/m3u-channels/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  async bulkToggleM3UChannels(enabled: boolean, group?: string) {
    const res = await authFetch(`${BASE_URL}/iptv/m3u-channels/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, group }),
    });
    return res.json() as Promise<{ success: boolean; count: number }>;
  },

  async getIPTVCategories() {
    const res = await authFetch(`${BASE_URL}/iptv/categories`);
    return res.json() as Promise<{ categories: IPTVLiveCategory[]; total: number }>;
  },

  async importIPTVCategory(categoryId: string) {
    const res = await authFetch(`${BASE_URL}/iptv/import-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
    });
    return res.json() as Promise<{ success: boolean; count: number; categoryName: string; channels: M3UChannel[] }>;
  },

  async getStarIPTVPackages() {
    const res = await authFetch(`${BASE_URL}/iptv/packages`);
    return res.json() as Promise<{ packages: StarIPTVPackage[]; source: string; note?: string }>;
  },

  // Admin
  async getAdminStats() {
    const res = await authFetch(`${BASE_URL}/admin/stats`);
    return res.json() as Promise<{ stats: AdminStats; logs: Array<{ id: string; timestamp: string; action: string; details: string }> }>;
  },

  async getAdminChannels() {
    const res = await authFetch(`${BASE_URL}/admin/channels`);
    const data = await res.json();
    return data.channels as Channel[];
  },

  async toggleChannel(channelId: string, enabled?: boolean) {
    const res = await authFetch(`${BASE_URL}/admin/channels/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, enabled }),
    });
    return res.json();
  },

  async getAdminMovies() {
    const res = await authFetch(`${BASE_URL}/admin/movies`);
    const data = await res.json();
    return data.movies as Movie[];
  },

  async toggleMovie(movieId: string, enabled?: boolean) {
    const res = await authFetch(`${BASE_URL}/admin/movies/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, enabled }),
    });
    return res.json();
  },

  async getTakedowns() {
    const res = await authFetch(`${BASE_URL}/admin/takedowns`);
    const data = await res.json();
    return data.takedowns as TakedownRequest[];
  },

  async processTakedown(id: string, action: 'DISABLE_AND_ACCEPT' | 'REJECT' | 'UNDER_REVIEW', notes?: string) {
    const res = await authFetch(`${BASE_URL}/admin/takedowns/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    });
    return res.json();
  },

  async getAdminDevices() {
    const res = await authFetch(`${BASE_URL}/admin/devices`);
    return res.json() as Promise<{ devices: AdminDeviceRecord[]; total: number }>;
  },

  async revokeAdminDevice(userId: string, deviceId: string) {
    const res = await authFetch(`${BASE_URL}/devices/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId }),
    });
    return res.json();
  },

  async getAdminWatchHistory() {
    const res = await authFetch(`${BASE_URL}/admin/watch-history`);
    return res.json() as Promise<{ history: AdminWatchHistoryRecord[]; total: number }>;
  },

  // Public DMCA / Takedown Report
  async submitTakedownReport(payload: {
    contentId?: string;
    contentTitle?: string;
    claimantName: string;
    claimantEmail: string;
    copyrightOwner?: string;
    allegedInfringementUrl?: string;
    statement: string;
  }) {
    const res = await authFetch(`${BASE_URL}/takedown/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit report');
    }
    return res.json() as Promise<{ success: boolean; ticketNumber: string; message: string }>;
  },
};
