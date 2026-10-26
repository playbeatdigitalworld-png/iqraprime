/**
 * Aether Stream OTT Domain Models & Interfaces
 */

export type UserRole = 'admin' | 'customer' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export type SubscriptionTier = 'free' | 'premium' | 'iptv_vip';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  packageName: string;
  activationDate: string;
  expiryDate: string;
  maxDevices: number;
  activeDevices: number;
  autoRenew: boolean;
  iptvCredentials?: {
    username: string;
    serverHost: string;
    m3uUrlMasked: string;
    epgUrl: string;
  };
}

export type ContentRightsStatus =
  | 'PUBLIC_DOMAIN'
  | 'OPEN_LICENSE'
  | 'PUBLIC_BROADCAST'
  | 'FREE_TO_AIR'
  | 'AUTHORIZED_RESELLER'
  | 'TRAILER_ONLY';

export interface Channel {
  id: string;
  channelName: string;
  logo: string;
  country: string;
  language: string;
  category: 'News' | 'Documentaries' | 'Science & Tech' | 'Sports' | 'Entertainment' | 'Culture';
  streamUrl: string;
  sourceUrl: string;
  sourceName: string;
  rightsStatus: ContentRightsStatus;
  commercialUse: boolean;
  attributionRequired: boolean;
  attribution?: string;
  lastVerified: string;
  enabled: boolean;
  epgProgram?: {
    current: string;
    next: string;
    startTime: string;
    endTime: string;
  };
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  poster: string;
  backdrop: string;
  year: number;
  genre: string[];
  duration: string; // e.g. "1h 36m"
  language: string;
  rating: string; // e.g. "PG", "Approved", "8.1"
  videoUrl?: string; // empty if trailer only
  trailerUrl: string;
  source: string;
  license: string; // e.g. "Public Domain", "CC-BY 4.0", "Open Source Cinematic"
  licenseUrl: string;
  attribution: string;
  rightsStatus: ContentRightsStatus;
  featured?: boolean;
  trending?: boolean;
  enabled: boolean;
}

export interface WatchProgress {
  contentId: string;
  contentType: 'movie' | 'channel';
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  title: string;
  poster: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  deviceType: 'mobile' | 'desktop' | 'smart_tv' | 'tablet';
  browser: string;
  os: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface StarIPTVConfig {
  apiUrl: string;
  username: string;
  apiKeyMasked: string;
  resellerId: string;
  status: 'Connected' | 'Authentication Failed' | 'Invalid Credentials' | 'Invalid Endpoint' | 'Permission Denied' | 'API Unavailable' | 'Configuration required';
  lastChecked?: string;
  logs: StarIPTVLog[];
}

export interface StarIPTVLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  action: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface StarIPTVPackage {
  id: string;
  name: string;
  durationDays: number;
  creditsRequired: number;
  connections: number;
  category: string;
  description: string;
  priceUsd: number;
}

export interface TakedownRequest {
  id: string;
  contentId: string;
  contentTitle: string;
  claimantName: string;
  claimantEmail: string;
  copyrightOwner: string;
  allegedInfringementUrl: string;
  statement: string;
  status: 'PENDING' | 'ACCEPTED_REMOVED' | 'REJECTED' | 'UNDER_REVIEW';
  createdAt: string;
  reviewedAt?: string;
  notes?: string;
}

export interface PilotSettings {
  privateMode: boolean;
  commercialMode: boolean;
  publicRegistration: boolean;
  paymentsEnabled: boolean;
  maxPrivateUsers: number;
  maxDevicesPerUser: number;
  currentMembers: number;
  activeMembers: number;
  remainingSlots: number;
}

export interface MemberAccount {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  role: 'admin' | 'member';
  devicesCount: number;
  accountExpiry?: string;
  createdAt: string;
  lastActiveAt?: string;
}

/**
 * Per-member Star IPTV line assignment (Private Pilot multi-line support).
 * Credentials are stored STRICTLY server-side; the frontend only ever
 * receives the masked summary shape below.
 */
export interface MemberIptvLine {
  userId: string;
  providerName?: string;
  serverUrl: string;
  username: string;
  password: string;
  m3uUrl?: string; // optional override; defaults derived from serverUrl + credentials
  epgUrl?: string;
  expiresAt?: string; // ISO — probed from the provider (player_api exp_date)
  maxConnections?: number; // probed from the provider
  activeConnections?: number; // last probe observation
  lastProbeStatus?: string;
  lastProbeAt?: string;
  status: 'active' | 'disabled';
  assignedBy?: string;
  assignedAt: string;
}

export interface MemberIptvLineMasked {
  userId: string;
  assigned: boolean;
  providerName?: string;
  usernameMasked?: string;
  serverHost?: string;
  m3uUrlMasked?: string;
  epgUrlMasked?: string;
  expiresAt?: string;
  maxConnections?: number;
  activeConnections?: number;
  status?: 'active' | 'disabled';
  assignedAt?: string;
  lastProbeStatus?: string;
  lastProbeAt?: string;
}

/**
 * Full provider catalog (Star IPTV line) — browsing shapes.
 * These NEVER contain credentials; playback URLs are resolved per-user
 * at /api/catalog/play against the caller's own assigned line.
 */
export type CatalogType = 'live' | 'vod' | 'series';

export interface CatalogCategory {
  id: string;
  name: string;
}

export interface CatalogItem {
  id: string;            // live-<id> | vod-<id> | ser-<id>
  numericId: number;
  name: string;
  poster?: string;
  group: string;
  categoryId: string;
  rating?: string;
  added?: string;
  containerExt?: string;
  isSeries?: boolean;
  episodeRunTime?: number;
  plot?: string;
  genre?: string;
  releaseDate?: string;
}

export interface CatalogMovieInfo {
  id: string;
  numericId: number;
  name: string;
  plot: string;
  poster: string;
  backdrop: string;
  genre: string;
  duration: string;
  releasedate: string;
  rating: string;
  youtubeTrailer: string;
  containerExt: string;
  line: string;
}

export interface CatalogEpisode {
  id: string;
  episodeNum: number;
  season: number;
  title: string;
  containerExt: string;
  info?: { duration: string };
}

export interface CatalogSeriesInfo {
  id: string;
  numericId: number;
  name: string;
  plot: string;
  poster: string;
  backdrop: string;
  genre: string;
  cast: string;
  releaseDate: string;
  rating: string;
  episodeRunTime?: number;
  seasons: Array<{ season: number; episodes: CatalogEpisode[] }>;
  line: string;
}

/** Verified provider catalog totals (real measurements, never invented). */
export interface CatalogStatsInfo {
  live: { total: number; familySafe: number; categories: number };
  vod: { total: number; familySafe: number; categories: number };
  series: { total: number; familySafe: number; categories: number };
  episodes: number | null;
  /** How episodes was measured: exact sweep or uniform-random sample extrapolation. */
  episodesMethod?: 'sweep' | 'sampled' | null;
  episodesSampled?: number | null;
  measuredAt: string;
  source: 'provider-cache' | 'provider-live' | 'verified-build';
}

/** Credential-free home rail sample (live channels / latest movies / series). */
export interface CatalogHighlightItem {
  id: string;
  numericId: number;
  name: string;
  poster?: string;
  group: string;
  categoryId: string;
  rating?: string;
  added?: string;
  isSeries?: boolean;
}

export interface CatalogHighlights {
  live: CatalogHighlightItem[];
  vod: CatalogHighlightItem[];
  series: CatalogHighlightItem[];
  line: string;
}

export interface M3UChannel {  id: string;
  name: string;
  group: string;
  logo: string;
  streamUrl: string;
  tvgId?: string;
  tvgName?: string;
  enabled: boolean;
  order: number;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  startTime: string; // e.g. "20:00" or ISO
  endTime: string;   // e.g. "21:30" or ISO
  current?: boolean;
}

export interface IPTVLiveCategory {
  category_id: string;
  category_name: string;
  icon?: string;
  stream_count?: number;
}

export interface StarIPTVVaultConfig {
  providerName: string;
  serverUrl: string;
  username: string;
  passwordMasked: string;
  m3uUrlMasked: string;
  epgUrlMasked: string;
  hasPassword: boolean;
  hasM3u: boolean;
  hasEpg: boolean;
  status: string;
  lastChecked?: string;
}

export interface AdminStats {
  totalUsers: number;
  maxPrivateUsers: number;
  activeMembers: number;
  remainingSlots: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
  totalChannels: number;
  activeChannels: number;
  m3uImportedCount: number;
  totalMovies: number;
  activeMovies: number;
  pendingTakedowns: number;
  starIptvStatus: string;
  epgStatus: string;
  systemHealth: 'optimal' | 'warning' | 'degraded';
}

export interface AdminDeviceRecord {
  userId: string;
  userName: string;
  userEmail: string;
  device: DeviceInfo;
}

export interface AdminWatchHistoryRecord {
  id: string;
  userId: string;
  userName: string;
  contentId: string;
  contentTitle: string;
  contentType: 'channel' | 'movie';
  watchedAt: string;
  progressPercentage: number;
}
