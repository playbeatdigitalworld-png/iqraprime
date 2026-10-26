/**
 * CatalogStats — verified provider catalog metrics + highlights sampling.
 *
 * Numbers policy (owner mandate): NEVER invent catalog totals. The baked
 * values below were measured live from the provider's own Xtream API
 * (scripts/catalog-counts.ts, scripts/catalog-episodes-sweep.ts) and are
 * refreshed opportunistically from the provider when this module is used.
 * Every value that reaches the client is a real provider measurement.
 *
 * Highlights: credential-free catalog samples for the public home rails
 * (live channels with logos, latest VOD, latest series). Browsing payloads
 * never contain stream credentials — same boundary as iptvCatalog.
 */

import { starIptvProvider } from './starIptvProvider.js';
import { iptvCatalog, type CatalogLine } from './iptvCatalog.js';

const UA = 'AetherStream-PrivatePilot/1.0';
const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|red\s*light|for\s*grown|private\s*\(18/i;

/** Verified live measurements (scripts/catalog-counts.json + episodes-estimate.json). */
export interface CatalogStats {
  live: { total: number; familySafe: number; categories: number };
  vod: { total: number; familySafe: number; categories: number };
  series: { total: number; familySafe: number; categories: number };
  episodes: number | null;
  episodesMethod?: 'sweep' | 'sampled' | null;
  episodesSampled?: number | null;
  measuredAt: string;
  source: 'provider-cache' | 'provider-live' | 'verified-build';
}

// Measured 2026-10-07/08 via provider player_api
// (see scripts/catalog-counts.json + scripts/episodes-estimate.json)
const BAKED: CatalogStats = {
  live: { total: 14177, familySafe: 14111, categories: 262 },
  vod: { total: 219999, familySafe: 219323, categories: 256 },
  series: { total: 17168, familySafe: 17162, categories: 101 },
  episodes: 512461,
  episodesMethod: 'sampled',
  episodesSampled: 812,
  measuredAt: '2026-10-07T22:53:12.418Z',
  source: 'verified-build',
};

let memoryStats: CatalogStats = { ...BAKED };
let refreshInflight: Promise<void> | null = null;
let lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 30 * 60_000; // refresh from provider at most every 30 min

export interface HighlightItem {
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

interface HighlightsPayload {
  live: HighlightItem[];
  vod: HighlightItem[];
  series: HighlightItem[];
  line: string;
}

let highlightsCache: { at: number; payload: HighlightsPayload } | null = null;
const HIGHLIGHTS_TTL_MS = 30 * 60_000;
/** Total wall-clock budget for one highlights build (serverless-safe). */
const HIGHLIGHTS_BUDGET_MS = 32 * 1000;

async function playerApi(action: string, extra = '', timeoutMs = 90000): Promise<any> {
  const vault = starIptvProvider.getVaultLine();
  if (!vault) throw new Error('vault line unavailable');
  const url = `${vault.serverUrl.replace(/\/+$/, '')}/player_api.php?username=${encodeURIComponent(vault.username)}&password=${encodeURIComponent(vault.password)}&action=${action}${extra}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

/** Opportunistic provider refresh; serves baked numbers until it lands. */
function scheduleRefresh(): void {
  if (refreshInflight) return;
  if (Date.now() - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
  refreshInflight = (async () => {
    try {
      const [live, vod, series] = await Promise.all([
        playerApi('get_live_categories').catch(() => null),
        playerApi('get_vod_categories').catch(() => null),
        playerApi('get_series_categories').catch(() => null),
      ]);
      // Category-level refresh is cheap; full stream recounts run only when a
      // sweep artifact is injected at build time (baked stays authoritative).
      if (Array.isArray(live) || Array.isArray(vod) || Array.isArray(series)) {
        memoryStats = {
          ...memoryStats,
          live: Array.isArray(live) ? { ...memoryStats.live, categories: live.length } : memoryStats.live,
          vod: Array.isArray(vod) ? { ...memoryStats.vod, categories: vod.length } : memoryStats.vod,
          series: Array.isArray(series) ? { ...memoryStats.series, categories: series.length } : memoryStats.series,
          source: 'provider-cache',
        };
      }
      lastRefreshAt = Date.now();
    } catch {
      lastRefreshAt = Date.now();
    } finally {
      refreshInflight = null;
    }
  })();
}

export function getCatalogStats(): CatalogStats {
  scheduleRefresh();
  return memoryStats;
}

/** Allows a build/deploy step to inject freshly swept numbers (episodes). */
export function applyMeasuredStats(patch: Partial<CatalogStats>): void {
  memoryStats = { ...memoryStats, ...patch };
}

function mapHighlight(s: any, prefix: 'live' | 'vod' | 'ser'): HighlightItem | null {
  if (!s) return null;
  const name = String(s.name || '');
  if (!name || ADULT.test(name) || Number(s.is_adult) === 1) return null;
  const numericId = Number(s.stream_id || s.series_id);
  if (!numericId) return null;
  return {
    id: `${prefix}-${numericId}`,
    numericId,
    name,
    poster: String(s.stream_icon || s.cover || '') || undefined,
    group: String(s.category_name || ''),
    categoryId: String(s.category_id || ''),
    rating: s.rating ? String(s.rating) : undefined,
    added: s.added ? String(s.added) : undefined,
    isSeries: prefix === 'ser' ? true : undefined,
  };
}

/**
 * Credential-free catalog samples for the home page rails.
 *
 * Serverless-safe design (Vercel 60s / memory caps): the 220K-entry VOD list
 * is NEVER fetched whole. Instead:
 *  - live  : full get_live_streams (≈14K entries, small) sampled by artwork
 *  - vod   : items from up to 6 "latest" VOD categories, merged by `added`
 *  - series: full get_series (≈17K entries, small), newest first
 * Every branch is time-budgeted and failures degrade to empty arrays so the
 * endpoint always answers inside the function budget with REAL content only.
 */
export async function getCatalogHighlights(): Promise<HighlightsPayload> {
  const vault = starIptvProvider.getVaultLine();
  if (highlightsCache && Date.now() - highlightsCache.at < HIGHLIGHTS_TTL_MS) {
    return { ...highlightsCache.payload, line: vault ? vault.providerName : highlightsCache.payload.line };
  }

  const line: CatalogLine | null = vault
    ? { key: 'vault', serverUrl: vault.serverUrl, username: vault.username, password: vault.password, label: vault.providerName || 'Star IPTV' }
    : null;
  if (!line) throw new Error('vault line unavailable');

  const started = Date.now();
  const remaining = () => Math.max(0, HIGHLIGHTS_BUDGET_MS - (Date.now() - started));
  /** Hard deadline race — a hung provider fetch can never exceed the budget. */
  const budgeted = <T,>(p: Promise<T>): Promise<T | null> =>
    Promise.race([
      p.catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), remaining() || 1)),
    ]);

  // ---- live: search-index ladder first (snapshot-backed, outage-proof),
  // direct full list as fallback (≈14K rows) ----
  const livePromise = (async (): Promise<HighlightItem[]> => {
    let all: HighlightItem[] = [];
    try {
      const idx = await iptvCatalog.searchIndex(line, 'live', { budgetMs: Math.min(25_000, remaining() || 25_000) });
      all = (idx.items || []).map((it) => ({
        id: it.id, numericId: it.numericId, name: it.name, poster: it.poster,
        group: it.group, categoryId: it.categoryId, rating: it.rating, added: it.added,
      }));
    } catch { /* fall through to the direct provider list */ }
    if (!all.length) {
      const raw = await playerApi('get_live_streams', '', Math.min(30000, remaining() || 30000));
      all = (Array.isArray(raw) ? raw : [])
        .map((s: any) => mapHighlight(s, 'live'))
        .filter(Boolean) as HighlightItem[];
    }
    const withArt = all.filter((s) => s.poster);
    const step = Math.max(1, Math.floor(withArt.length / 24));
    return withArt.filter((_, i) => i % step === 0).slice(0, 24);
  })();

  // ---- vod: category-sampled (the 220K full list would blow the function budget) ----
  const vodPromise = (async (): Promise<HighlightItem[]> => {
    const cats = await iptvCatalog.categories(line, 'vod');
    const recent = cats
      .filter((c) => /202[3-6]|\bnew\b|latest|release|now playing|top/i.test(c.name))
      .slice(0, 6);
    const picked = recent.length ? recent : cats.slice(0, 3);
    const merged: HighlightItem[] = [];
    for (const cat of picked) {
      if (remaining() < 6000) break; // keep the response inside budget
      try {
        const items = await iptvCatalog.items(line, 'vod', cat.id);
        for (const it of items) {
          merged.push({
            id: it.id,
            numericId: it.numericId,
            name: it.name,
            poster: it.poster,
            group: cat.name,
            categoryId: it.categoryId,
            rating: it.rating,
            added: it.added,
          });
        }
      } catch { /* skip slow category */ }
    }
    return merged
      .sort((a, b) => Number(b.added || 0) - Number(a.added || 0))
      .slice(0, 24);
  })();

  // ---- series: search-index ladder first (snapshot-backed), direct full
  // list as fallback (≈17K rows) ----
  const seriesPromise = (async (): Promise<HighlightItem[]> => {
    let all: HighlightItem[] = [];
    try {
      const idx = await iptvCatalog.searchIndex(line, 'series', { budgetMs: Math.min(25_000, remaining() || 25_000) });
      all = (idx.items || []).map((it) => ({
        id: it.id, numericId: it.numericId, name: it.name, poster: it.poster,
        group: it.group, categoryId: it.categoryId, rating: it.rating, added: it.added,
      }));
    } catch { /* fall through to the direct provider list */ }
    if (!all.length) {
      const raw = await playerApi('get_series', '', Math.min(30000, remaining() || 30000));
      all = (Array.isArray(raw) ? raw : [])
        .map((s: any) => mapHighlight(s, 'ser'))
        .filter(Boolean as unknown as (v: any) => v is HighlightItem);
    }
    return all
      .sort((a, b) => Number(b.added || 0) - Number(a.added || 0))
      .slice(0, 24);
  })();

  const [liveR, vodR, seriesR] = await Promise.all([
    budgeted(livePromise),
    budgeted(vodPromise),
    budgeted(seriesPromise),
  ]);
  const live = liveR || [];
  const vod = vodR || [];
  const series = seriesR || [];

  if (!live.length && !vod.length && !series.length) {
    throw new Error('provider catalog unavailable');
  }

  const payload: HighlightsPayload = { live, vod, series, line: vault ? vault.providerName : 'Star IPTV' };
  highlightsCache = { at: Date.now(), payload };
  return payload;
}
