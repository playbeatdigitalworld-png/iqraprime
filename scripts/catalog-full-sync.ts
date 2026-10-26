/**
 * Catalog FULL sync — LOCAL run (no Vercel limits).
 *
 * Builds the complete family-scoped catalog index for live / vod / series
 * from the provider's full lists (each row carries its own category_id) and
 * uploads gzip-chunked snapshots to Supabase Storage, replacing the partial
 * snapshots saved by the serverless warm path.
 *
 * Scope mirrors server/iptvCatalog.ts EXACTLY:
 *  - drop items where is_adult=1 or name matches ADULT
 *  - drop items whose category is adult-named (categories() filters these)
 *  - identical CatalogItem field mapping as mapItem()
 *
 * Env: SRK=<service role key>  (not persisted anywhere)
 * Output: scripts/catalog-sync-report.json
 */
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

// Provider line is env-driven: the original reseller line (advance.playbeat.live
// + 7bd69cb1) went dark on ~2026-10-10. Owner's current subscription line lives
// on stream.playbeat.live:8880 (GEOIPTV panel). Credentials are NEVER persisted.
const HOST = (process.env.P_HOST || 'http://stream.playbeat.live:8880').replace(/\/$/, '');
const USER = process.env.P_USER || '';
const PASS = process.env.P_PASS || '';
if (!USER || !PASS) {
  console.error('P_USER and P_PASS env vars required (owner IPTV line credentials)');
  process.exit(1);
}
const UA = 'AetherStream-PrivatePilot/1.0';
const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|red\s*light|for\s*grown|private\s*\(18/i;

const SUPABASE_URL = 'https://ujzvkwgrxtujpinkytbf.supabase.co';
const SRK = process.env.SRK || '';
if (!SRK) { console.error('SRK env var required'); process.exit(1); }

const BUCKET = 'catalog-cache';
const LINE_KEY = 'vault';
const CHUNK_ITEMS = 25_000; // MUST match server/catalogIndexCache.ts
const UPLOAD_PARALLELISM = 4;

const supabase = createClient(SUPABASE_URL, SRK, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function api(action: string, extra = '', timeoutMs = 300000): Promise<any> {
  const url = `${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=${action}${extra}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`);
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

// ---- EXACT clone of iptvCatalog.mapItem ----
function mapItem(s: any, type: 'live' | 'vod' | 'series', categoryId: string): any | null {
  if (!s) return null;
  if (type === 'live') {
    if (!s.stream_id || !s.name) return null;
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

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (!error) return;
  const msg = String((error as Error).message || '');
  if (/exist|duplicate|already/i.test(msg)) return;
  const { error: listErr } = await supabase.storage.from(BUCKET).list('', { limit: 1 });
  if (listErr) throw listErr;
}

/** Remove chunks beyond the new chunk count (prevents stale merges). */
async function cleanupStaleChunks(type: string, keepCount: number): Promise<number> {
  const prefix = `${LINE_KEY}/${type}`;
  const { data: listing, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 200 });
  if (error || !listing) return 0;
  const extras = listing
    .filter((o) => o.name.endsWith('.json.gz'))
    .map((o) => parseInt(o.name.replace('chunk-', ''), 10))
    .filter((n) => Number.isFinite(n) && n >= keepCount);
  for (const n of extras) {
    await supabase.storage.from(BUCKET).remove([`${prefix}/chunk-${String(n).padStart(4, '0')}.json.gz`]);
  }
  return extras.length;
}

async function uploadSnapshot(type: string, items: any[]): Promise<{ chunks: number; removed: number }> {
  const chunkCount = Math.ceil(items.length / CHUNK_ITEMS);
  const removed = await cleanupStaleChunks(type, chunkCount);
  for (let start = 0; start < chunkCount; start += UPLOAD_PARALLELISM) {
    const batch = Array.from({ length: Math.min(UPLOAD_PARALLELISM, chunkCount - start) }, (_, k) => start + k);
    await Promise.all(batch.map(async (chunkIndex) => {
      const slice = items.slice(chunkIndex * CHUNK_ITEMS, (chunkIndex + 1) * CHUNK_ITEMS);
      const gz = gzipSync(Buffer.from(JSON.stringify(slice), 'utf8'));
      const path = `${LINE_KEY}/${type}/chunk-${String(chunkIndex).padStart(4, '0')}.json.gz`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, gz, {
        upsert: true, contentType: 'application/gzip',
      });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      console.log(`[sync] uploaded ${path} (${(gz.length / 1e6).toFixed(2)} MB, ${slice.length} items)`);
    }));
  }
  return { chunks: chunkCount, removed };
}

async function main() {
  const t0 = Date.now();
  console.log('[sync] fetching categories + full lists...');
  const [liveCats, vodCats, seriesCats, liveAll, vodAll, seriesAll] = await Promise.all([
    api('get_live_categories'), api('get_vod_categories'), api('get_series_categories'),
    api('get_live_streams'), api('get_vod_streams'), api('get_series'),
  ]);
  console.log(`[sync] provider rows: live=${liveAll.length} vod=${vodAll.length} series=${seriesAll.length} (+${Date.now() - t0}ms)`);

  const safeCatIds = (cats: any[]) =>
    new Set(cats.filter((c: any) => !ADULT.test(String(c.category_name || ''))).map((c: any) => String(c.category_id)));

  function buildScoped(rows: any[], type: 'live' | 'vod' | 'series', validCats: Set<string>): any[] {
    const out: any[] = [];
    let nanId = 0;
    for (const s of rows) {
      if (!validCats.has(String(s.category_id || ''))) continue;
      const it = mapItem(s, type, String(s.category_id || ''));
      if (!it) continue;
      if (!Number.isFinite(it.numericId)) nanId++;
      out.push(it);
    }
    if (nanId) console.warn(`[sync] WARN ${type}: ${nanId} items with non-numeric numericId`);
    return out;
  }

  const liveItems = buildScoped(liveAll, 'live', safeCatIds(liveCats));
  const vodItems = buildScoped(vodAll, 'vod', safeCatIds(vodCats));
  const seriesItems = buildScoped(seriesAll, 'series', safeCatIds(seriesCats));
  console.log(`[sync] scoped: live=${liveItems.length} vod=${vodItems.length} series=${seriesItems.length}`);

  // Dedupe safety (same id appearing twice in provider rows)
  function dedupe(items: any[]): { items: any[]; dupes: number } {
    const seen = new Set<string>();
    const out: any[] = [];
    let dupes = 0;
    for (const it of items) {
      if (seen.has(it.id)) { dupes++; continue; }
      seen.add(it.id);
      out.push(it);
    }
    return { items: out, dupes };
  }
  const dLive = dedupe(liveItems);
  const dVod = dedupe(vodItems);
  const dSer = dedupe(seriesItems);

  await ensureBucket();
  const upLive = await uploadSnapshot('live', dLive.items);
  const upVod = await uploadSnapshot('vod', dVod.items);
  const upSer = await uploadSnapshot('series', dSer.items);

  // Probe items for later production E2E (top id per type + one sample name)
  const probe = (items: any[]) => {
    const sorted = [...items].sort((a, b) => b.numericId - a.numericId);
    return { maxId: sorted[0]?.id, maxName: sorted[0]?.name, sampleId: sorted[Math.floor(sorted.length / 2)]?.id, sampleName: sorted[Math.floor(sorted.length / 2)]?.name };
  };

  const report = {
    syncedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    live: { providerRows: liveAll.length, uploaded: dLive.items.length, dupes: dLive.dupes, ...upLive, probe: probe(dLive.items) },
    vod: { providerRows: vodAll.length, uploaded: dVod.items.length, dupes: dVod.dupes, ...upVod, probe: probe(dVod.items) },
    series: { providerRows: seriesAll.length, uploaded: dSer.items.length, dupes: dSer.dupes, ...upSer, probe: probe(dSer.items) },
  };
  fs.writeFileSync('scripts/catalog-sync-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`[sync] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => { console.error('[sync] FAILED', e); process.exit(1); });
