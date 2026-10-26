/**
 * IptvCatalogService — full provider catalog (Live / VOD Movies / Series)
 * resolution for authenticated pilot users, using the caller's OWN Star IPTV
 * line (members with an assignment) or the global vault line (admin /
 * unassigned members).
 *
 * Security model:
 * - Browsing payloads (categories, items, search) contain NO credentials.
 * - Stream URLs are built ONLY at play time by the /catalog/play endpoint and
 *   embed the CALLER's own line credentials (provider HLS/progressive
 *   protocol — same boundary as the existing live playback workflow).
 * - Adult categories/items are excluded platform-wide (family pilot).
 *
 * Caching: per-line TTL caches (categories 30m, item lists 30m, details 6h,
 * global search indexes 6h with in-flight dedup) so the provider API is hit
 * minimally while keeping cold-start behavior safe.
 */

import { db } from './db/store.js';
import { starIptvProvider } from './starIptvProvider.js';
import { proxiedStreamUrl } from './streamProxy.js';
import { loadCatalogIndex, saveCatalogIndex, saveCatalogCategories, loadCatalogCategories } from './catalogIndexCache.js';
import type { AuthIdentity } from './routes/api.js';

const UA = 'AetherStream-PrivatePilot/1.0';
const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|red\s*light|for\s*grown|private\s*\(18/i;

export type CatalogType = 'live' | 'vod' | 'series';

export interface CatalogLine {
  key: string;
  serverUrl: string;
  username: string;
  password: string;
  label: string;
}

export interface CatalogCategory { id: string; name: string; count?: number; }
export interface CatalogItem {
  id: string;            // stable: live-<sid> | vod-<sid> | ser-<sid>
  numericId: number;
  name: string;
  poster?: string;
  group: string;         // category name
  categoryId: string;
  rating?: string;
  added?: string;
  containerExt?: string;
  isSeries?: boolean;
  episodeRunTime?: number;
  plot?: string;         // only for series list items (provider includes it)
  genre?: string;
  releaseDate?: string;
}

interface CacheEntry<T> { value: T; expiresAt: number; }

export interface SearchIndexResult {
  items: CatalogItem[];
  complete: boolean;
  failedCategories: string[];
  categoryCount: number;
  savedSnapshot: boolean;
}

class IptvCatalogService {
  private lineCaches = new Map<string, Map<string, CacheEntry<any>>>();

  /** Resolve the caller's catalog line: own member line, else global vault. */
  resolveLine(auth: { userId: string; role: 'admin' | 'customer' } | null): CatalogLine | null {
    if (auth && auth.role === 'customer') {
      const line = db.getIptvLine(auth.userId);
      if (line && line.status === 'active') {
        return {
          key: `member:${auth.userId}`,
          serverUrl: line.serverUrl,
          username: line.username,
          password: line.password,
          label: line.providerName || 'Star IPTV Line',
        };
      }
    }
    const vault = starIptvProvider.getVaultLine();
    if (!vault) return null;
    return {
      key: 'vault',
      serverUrl: vault.serverUrl,
      username: vault.username,
      password: vault.password,
      label: vault.providerName || 'Star IPTV Vault Line',
    };
  }

  private cacheFor(lineKey: string): Map<string, CacheEntry<any>> {
    let c = this.lineCaches.get(lineKey);
    if (!c) { c = new Map(); this.lineCaches.set(lineKey, c); }
    return c;
  }

  private async cached<T>(lineKey: string, ns: string, ttlMs: number, build: () => Promise<T>): Promise<T> {
    const cache = this.cacheFor(lineKey);
    const hit = cache.get(ns);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    const inflightNs = `inflight:${ns}`;
    const existing = cache.get(inflightNs);
    if (existing && existing.expiresAt > Date.now()) return existing.value as Promise<T>;
    const p = (async () => {
      const value = await build();
      cache.set(ns, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })().finally(() => cache.delete(inflightNs));
    cache.set(inflightNs, { value: p as any, expiresAt: Date.now() + 120000 });
    return p;
  }

  invalidate(lineKey?: string): void {
    if (lineKey) this.lineCaches.delete(lineKey);
    else this.lineCaches.clear();
  }

  private async playerApi(line: CatalogLine, action: string, extra = '', timeoutMs = 45000): Promise<any> {
    const url = `${line.serverUrl}/player_api.php?username=${encodeURIComponent(line.username)}&password=${encodeURIComponent(line.password)}&action=${action}${extra}`;
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

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  async categories(line: CatalogLine, type: CatalogType): Promise<CatalogCategory[]> {
    const action = type === 'live' ? 'get_live_categories' : type === 'vod' ? 'get_vod_categories' : 'get_series_categories';
    try {
      const cats = await this.cached(line.key, `cats:${type}`, 30 * 60_000, async () => {
        const raw = await this.playerApi(line, action);
        if (!Array.isArray(raw)) return [] as CatalogCategory[];
        const mapped = raw
          .filter((c: any) => c?.category_name && !ADULT.test(String(c.category_name)))
          .map((c: any) => ({ id: String(c.category_id), name: String(c.category_name) }));
        // Persist a durable categories snapshot (tiny object) so the browse
        // rails survive a provider outage. Awaited with a deadline — the
        // request budget impact is one small upload, at most every 30 min.
        if (mapped.length) {
          await Promise.race([
            saveCatalogCategories(line.key, type, mapped),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
          ]);
        }
        return mapped;
      });
      return cats;
    } catch (e) {
      // Provider unreachable — serve the last saved category list rather
      // than failing the whole browse page.
      const snap = await loadCatalogCategories(line.key, type, 30 * 24 * 3600_000);
      if (snap?.length) return snap as CatalogCategory[];
      throw e;
    }
  }

  // ==========================================================================
  // ITEMS (per category)
  // ==========================================================================

  async items(line: CatalogLine, type: CatalogType, categoryId: string): Promise<CatalogItem[]> {
    const ns = `items:${type}:${categoryId}`;
    return this.cached(line.key, ns, 30 * 60_000, async () => {
      try {
        let raw: any[] = [];
        if (type === 'live') {
          raw = await this.playerApi(line, 'get_live_streams', `&category_id=${encodeURIComponent(categoryId)}`);
        } else if (type === 'vod') {
          raw = await this.playerApi(line, 'get_vod_streams', `&category_id=${encodeURIComponent(categoryId)}`);
        } else {
          raw = await this.playerApi(line, 'get_series', `&category_id=${encodeURIComponent(categoryId)}`);
        }
        if (!Array.isArray(raw)) return [];
        return raw.map((s: any) => this.mapItem(s, type, categoryId)).filter(Boolean) as CatalogItem[];
      } catch (e) {
        // Provider outage — filter the durable snapshot (items carry
        // categoryId) so per-category browsing keeps working.
        const idx = await this.searchIndex(line, type, { budgetMs: 15_000 });
        const filtered = idx.items.filter((i) => i.categoryId === categoryId);
        if (filtered.length) return filtered;
        throw e;
      }
    });
  }

  private mapItem(s: any, type: CatalogType, categoryId: string): CatalogItem | null {
    if (!s) return null;
    if (type === 'live') {
      if (!s.stream_id || !s.name) return null;
      // Family pilot: exclude adult-flagged live channels platform-wide.
      if (Number(s.is_adult) === 1 || ADULT.test(String(s.name))) return null;
      return {
        id: `live-${s.stream_id}`, numericId: Number(s.stream_id), name: String(s.name),
        poster: s.stream_icon || undefined, group: '', categoryId,
        added: s.added ? String(s.added) : undefined,
      };
    }
    if (type === 'vod') {
      if (!s.stream_id || !s.name) return null;
      if (Number(s.is_adult) === 1 || ADULT.test(String(s.name))) return null;
      return {
        id: `vod-${s.stream_id}`, numericId: Number(s.stream_id), name: String(s.name),
        poster: s.stream_icon || s.cover_big || undefined, group: '', categoryId,
        rating: s.rating ? String(s.rating) : undefined,
        added: s.added ? String(s.added) : undefined,
        containerExt: s.container_extension ? String(s.container_extension) : 'mp4',
      };
    }
    // series
    if (!s.series_id || !s.name) return null;
    return {
      id: `ser-${s.series_id}`, numericId: Number(s.series_id), name: String(s.name),
      poster: s.cover || undefined, group: '', categoryId,
      rating: s.rating ? String(s.rating) : undefined,
      plot: s.plot ? String(s.plot).slice(0, 400) : undefined,
      genre: s.genre ? String(s.genre) : undefined,
      releaseDate: s.releaseDate ? String(s.releaseDate) : undefined,
      episodeRunTime: Number(s.episode_run_time) || undefined,
      isSeries: true,
    };
  }

  // ==========================================================================
  // GLOBAL SEARCH INDEX (built lazily per line, TTL 6h)
  //
  // Resilience ladder (serverless-safe, no background tasks):
  //   1. Durable snapshot (Supabase Storage) — seconds-fast cold hydration.
  //   2. Provider build — full-list fetch for live (small + fast); per-category
  //      assembly for VOD/series (their full lists stall from Vercel egress).
  //      Assembly is DEADLINE-BOUNDED with per-category retries, and partial
  //      builds NEVER overwrite a complete snapshot.
  //   3. Stale-snapshot fallback — a slightly outdated catalog beats a
  //      partial rebuild (and certainly beats an empty result).
  // ==========================================================================

  // 7 days: the daily warm crons refresh snapshots well within this window,
  // and a longer window lets the catalog survive a multi-day provider outage
  // (the provider host is DNS-controlled and can vanish without notice —
  // seen 2026-10-10 when advance.playbeat.live moved to the Vercel edge).
  private SNAPSHOT_MAX_AGE_MS = 7 * 24 * 3600_000;

  private async fetchFullList(line: CatalogLine, type: CatalogType, action: string, deadlineMs: number): Promise<CatalogItem[]> {
    try {
      const raw = await this.playerApi(line, action, '', deadlineMs);
      if (!Array.isArray(raw)) return [];
      return raw
        .map((s: any) => this.mapItem(s, type, String(s.category_id || '')))
        .filter(Boolean) as CatalogItem[];
    } catch {
      return [];
    }
  }

  /** Dedupe keep-first by stable item id (provider repeats multi-category items). */
  private dedupeById(items: CatalogItem[]): CatalogItem[] {
    const seen = new Set<string>();
    const out: CatalogItem[] = [];
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }

  /**
   * Assemble the full index from per-category fetches. Measured: every
   * category response returns in <1s from serverless egress (unlike the
   * unfiltered full list, which stalls), so 10-way parallel batches cover
   * even 231 VOD categories in ~20-40s. Failed categories are retried in
   * additional passes (up to 2), all under the caller's wall-clock deadline.
   * Returns which categories failed so partial builds are detectable.
   */
  private async assembleByCategory(line: CatalogLine, type: CatalogType, deadlineMs: number): Promise<SearchIndexResult> {
    const cats = await this.categories(line, type);
    if (!cats.length) return { items: [], complete: false, failedCategories: [], categoryCount: 0, savedSnapshot: false };
    const action = type === 'vod' ? 'get_vod_streams' : type === 'series' ? 'get_series' : 'get_live_streams';
    const deadline = Date.now() + deadlineMs;
    const PER_CAT_TIMEOUT_MS = 45_000;
    const PAR = 10;
    const collected = new Map<string, CatalogItem[]>();
    const failed = new Set<string>();

    const attempt = async (cat: CatalogCategory): Promise<CatalogItem[] | null> => {
      try {
        const raw = await this.playerApi(line, action, `&category_id=${encodeURIComponent(cat.id)}`, PER_CAT_TIMEOUT_MS);
        if (!Array.isArray(raw)) return null;
        return raw
          .map((s: any) => this.mapItem(s, type, cat.id))
          .filter(Boolean) as CatalogItem[];
      } catch {
        return null;
      }
    };

    for (let start = 0; start < cats.length; start += PAR) {
      if (Date.now() >= deadline) {
        for (const cat of cats.slice(start)) failed.add(cat.id);
        break;
      }
      const batch = cats.slice(start, start + PAR);
      const results = await Promise.allSettled(batch.map(async (cat) => ({ cat, items: await attempt(cat) })));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.items) collected.set(r.value.cat.id, r.value.items);
        else if (r.status === 'fulfilled') failed.add(r.value.cat.id);
      }
    }

    // Retry passes for failed categories (deadline-bounded, 2 extra passes).
    for (let pass = 0; pass < 2 && failed.size > 0 && Date.now() < deadline; pass++) {
      const retry = [...failed];
      failed.clear();
      for (const catId of retry) {
        if (Date.now() >= deadline) { failed.add(catId); continue; }
        const cat = cats.find((c) => c.id === catId);
        if (!cat) continue;
        const items = await attempt(cat);
        if (items) collected.set(catId, items);
        else failed.add(catId);
      }
    }

    const items: CatalogItem[] = [];
    for (const list of collected.values()) items.push(...list);
    const deduped = this.dedupeById(items);
    return {
      items: deduped,
      complete: failed.size === 0 && deduped.length > 0,
      failedCategories: [...failed],
      categoryCount: cats.length,
      savedSnapshot: false,
    };
  }

  async searchIndex(line: CatalogLine, type: CatalogType, opts?: { force?: boolean; budgetMs?: number }): Promise<SearchIndexResult> {
    const ns = `index:${type}`;
    const budget = Math.max(10_000, Math.min(opts?.budgetMs ?? 55_000, 55_000));

    const buildFresh = async (): Promise<SearchIndexResult> => {
      const built = await this.buildSearchIndex(line, type, budget);
      if (built.complete) {
        const saved = await Promise.race([
          saveCatalogIndex(line.key, type, built.items),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20_000)),
        ]);
        return { ...built, savedSnapshot: saved };
      }
      // Partial build — prefer ANY existing snapshot with more items; a
      // slightly outdated full catalog beats a fresh partial one. (A partial
      // build is never persisted.)
      const existing = await loadCatalogIndex(line.key, type, 30 * 24 * 3600_000);
      if (existing && existing.length > built.items.length) {
        return { items: existing, complete: true, failedCategories: built.failedCategories, categoryCount: built.categoryCount, savedSnapshot: false };
      }
      return built;
    };

    // Forced rebuilds bypass the in-memory cache entirely (then repopulate it).
    if (opts?.force) {
      const result = await buildFresh();
      this.cacheFor(line.key).set(ns, { value: result, expiresAt: Date.now() + 6 * 3600_000 });
      return result;
    }

    return this.cached(line.key, ns, 6 * 3600_000, async () => {
      // Durable snapshot hydration (fast path for serverless cold starts).
      const snap = await loadCatalogIndex(line.key, type, this.SNAPSHOT_MAX_AGE_MS);
      if (snap && snap.length) {
        return { items: snap, complete: true, failedCategories: [], categoryCount: 0, savedSnapshot: false };
      }
      return buildFresh();
    });
  }

  private async buildSearchIndex(line: CatalogLine, type: CatalogType, deadlineMs: number): Promise<SearchIndexResult> {
    if (type === 'live') {
      // The live full list (~14K items) completes fine from serverless egress.
      // Scope it to non-adult categories (categories() drops those) and
      // dedupe, matching the per-category assembly definition exactly.
      const [cats, direct] = await Promise.all([
        this.categories(line, type),
        this.fetchFullList(line, type, 'get_live_streams', Math.min(deadlineMs, 30_000)),
      ]);
      if (direct.length) {
        const valid = new Set(cats.map((c) => c.id));
        const items = this.dedupeById(direct.filter((it) => valid.has(it.categoryId)));
        if (items.length) {
          return { items, complete: true, failedCategories: [], categoryCount: cats.length, savedSnapshot: false };
        }
      }
      return this.assembleByCategory(line, type, deadlineMs);
    }
    // VOD (220K items / 77MB) and series full lists stall from serverless
    // egress — assemble per-category from the start (measured ~20-40s).
    return this.assembleByCategory(line, type, deadlineMs);
  }

  async search(line: CatalogLine, type: CatalogType, query: string, categoryId?: string, limit = 60): Promise<{ items: CatalogItem[]; scope: string }> {
    const q = query.trim().toLowerCase();
    if (!q) return { items: [], scope: 'none' };
    if (categoryId) {
      const items = await this.items(line, type, categoryId);
      return { items: items.filter(i => i.name.toLowerCase().includes(q)).slice(0, limit), scope: 'category' };
    }
    try {
      const result = await this.searchIndex(line, type);
      if (result.items.length) {
        return { items: result.items.filter(i => i.name.toLowerCase().includes(q)).slice(0, limit), scope: 'global' };
      }
    } catch {
      // index build failed (slow provider) — fall through
    }
    return { items: [], scope: 'global-unavailable' };
  }

  // ==========================================================================
  // DETAILS
  // ==========================================================================

  async movieInfo(line: CatalogLine, numericId: number): Promise<any> {
    return this.cached(line.key, `vodinfo:${numericId}`, 6 * 3600_000, async () => {
      return this.playerApi(line, 'get_vod_info', `&vod_id=${numericId}`, 30000);
    });
  }

  async seriesInfo(line: CatalogLine, numericId: number): Promise<any> {
    return this.cached(line.key, `serinfo:${numericId}`, 2 * 3600_000, async () => {
      return this.playerApi(line, 'get_series_info', `&series_id=${numericId}`, 45000);
    });
  }

  // ==========================================================================
  // PLAYBACK RESOLUTION (the ONLY place credential-bearing URLs are built)
  // ==========================================================================
  // Provider URLs are credential-bearing and HTTP-only; browsers on our HTTPS
  // origin cannot play them directly. Every playback URL returned here is a
  // sealed relay reference served by server/streamProxy.ts (credentials stay
  // encrypted server-side, stream re-served over HTTPS with Range support).

  // HLS availability probe cache (provider .m3u8 variants), 10-minute TTL.
  private hlsProbeCache = new Map<string, { ok: boolean; ts: number }>();
  private static HLS_PROBE_TTL = 10 * 60 * 1000;

  private async probeHls(manifestUrl: string): Promise<boolean> {
    const cached = this.hlsProbeCache.get(manifestUrl);
    const now = Date.now();
    if (cached && now - cached.ts < IptvCatalogService.HLS_PROBE_TTL) return cached.ok;
    let ok = false;
    try {
      const res = await fetch(manifestUrl, {
        redirect: 'follow',
        headers: {
          // Provider gates manifests by User-Agent (non-players get 403).
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
          Range: 'bytes=0-255',
        },
        signal: AbortSignal.timeout(8000),
      });
      const ctype = res.headers.get('content-type') || '';
      if (/mpegurl|m3u8/i.test(ctype)) {
        ok = res.status < 400;
      } else if (res.status < 400) {
        const head = await res.text();
        ok = head.includes('#EXTM3U');
      }
    } catch {
      ok = false;
    }
    this.hlsProbeCache.set(manifestUrl, { ok, ts: now });
    return ok;
  }

  async resolvePlay(
    line: CatalogLine,
    type: CatalogType,
    numericId: number,
    episodeId?: number,
  ): Promise<{ kind: 'hls' | 'mp4'; url: string; title?: string; label: string } | null> {
    const base = line.serverUrl.replace(/\/+$/, '');
    const u = encodeURIComponent(line.username);
    const p = encodeURIComponent(line.password);
    if (type === 'live') {
      return {
        kind: 'hls',
        url: proxiedStreamUrl(`${base}/live/${u}/${p}/${numericId}.m3u8`, 'manifest'),
        label: line.label,
      };
    }
    if (type === 'vod') {
      const info = await this.movieInfo(line, numericId);
      const ext = String(info?.movie_data?.container_extension || 'mp4');
      const title = String(info?.info?.name || '');
      const hls = `${base}/movie/${u}/${p}/${numericId}.m3u8`;
      const direct = `${base}/movie/${u}/${p}/${numericId}.${ext}`;
      const useHls = await this.probeHls(hls);
      return {
        kind: useHls ? 'hls' : 'mp4',
        url: proxiedStreamUrl(useHls ? hls : direct, useHls ? 'manifest' : 'media'),
        title,
        label: line.label,
      };
    }
    // series episode
    if (!episodeId) return null;
    const info = await this.seriesInfo(line, numericId);
    const seasons = info?.episodes || {};
    let ext = 'mp4';
    let epMeta: any = null;
    for (const seasonKey of Object.keys(seasons)) {
      const eps = seasons[seasonKey];
      const found = Array.isArray(eps) ? eps.find((e: any) => Number(e.id) === Number(episodeId)) : null;
      if (found) { epMeta = found; ext = String(found.container_extension || 'mp4'); break; }
    }
    if (!epMeta) return null;
    const hls = `${base}/series/${u}/${p}/${episodeId}.m3u8`;
    const direct = `${base}/series/${u}/${p}/${episodeId}.${ext}`;
    const useHls = await this.probeHls(hls);
    return {
      kind: useHls ? 'hls' : 'mp4',
      url: proxiedStreamUrl(useHls ? hls : direct, useHls ? 'manifest' : 'media'),
      title: String(epMeta.title || ''),
      label: line.label,
    };
  }
}

export const iptvCatalog = new IptvCatalogService();
export function isAuthIdentity(v: unknown): v is AuthIdentity { return Boolean(v); }
