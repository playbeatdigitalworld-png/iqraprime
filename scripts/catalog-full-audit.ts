/**
 * Catalog completeness audit — LOCAL run (no Vercel limits).
 *
 * Answers: is the deployed search index (vod 86,291 / series 13,633 / live
 * 14,119) actually COMPLETE for the platform's family-safe scope, or are
 * items really missing?
 *
 * Scope definition (must mirror server/iptvCatalog.ts exactly):
 *  - categories(): drops category names matching ADULT regex
 *  - items: dropped when is_adult=1 OR name matches ADULT regex
 *  - per-category assembly indexes ONLY items in surviving categories
 *
 * Outputs scripts/catalog-audit.json + console report.
 */
import fs from 'node:fs';

const HOST = (process.env.P_HOST || 'http://stream.playbeat.live:8880').replace(/\/$/, '');
const USER = process.env.P_USER || '';
const PASS = process.env.P_PASS || '';
if (!USER || !PASS) { console.error('P_USER and P_PASS env vars required'); process.exit(1); }
const UA = 'AetherStream-PrivatePilot/1.0';
const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|red\s*light|for\s*grown|private\s*\(18/i;

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

function isAdultItem(s: any): boolean {
  return Number(s?.is_adult) === 1 || ADULT.test(String(s?.name || ''));
}

async function main() {
  const t0 = Date.now();
  console.log('[audit] fetching categories...');
  const [liveCats, vodCats, seriesCats] = await Promise.all([
    api('get_live_categories'),
    api('get_vod_categories'),
    api('get_series_categories'),
  ]);
  console.log(`[audit] categories: live=${liveCats.length} vod=${vodCats.length} series=${seriesCats.length}`);

  console.log('[audit] fetching FULL lists (vod is ~77MB, be patient)...');
  const [liveAll, vodAll, seriesAll] = await Promise.all([
    api('get_live_streams'),
    api('get_vod_streams'),
    api('get_series'),
  ]);
  console.log(`[audit] full lists: live=${liveAll.length} vod=${vodAll.length} series=${seriesAll.length} (+${Date.now() - t0}ms)`);

  // Category-level adult classification
  const scopeCat = (cats: any[]) => {
    const adult = cats.filter((c) => ADULT.test(String(c.category_name || '')));
    const safe = cats.filter((c) => !ADULT.test(String(c.category_name || '')));
    return { adult, safe };
  };
  const liveScope = scopeCat(liveCats);
  const vodScope = scopeCat(vodCats);
  const seriesScope = scopeCat(seriesCats);

  // Map full list -> { categoryId -> items } using provider row's own category_id
  function bucketByCategory(rows: any[], validCatIds: Set<string>) {
    const map = new Map<string, any[]>();
    let droppedAdultItem = 0;
    let droppedOrphanCat = 0;
    for (const s of rows) {
      if (isAdultItem(s)) { droppedAdultItem++; continue; }
      const cid = String(s.category_id || '');
      if (!validCatIds.has(cid)) { droppedOrphanCat++; continue; }
      const arr = map.get(cid) || [];
      arr.push(s);
      map.set(cid, arr);
    }
    return { map, droppedAdultItem, droppedOrphanCat };
  }

  const liveValid = new Set(liveScope.safe.map((c) => String(c.category_id)));
  const vodValid = new Set(vodScope.safe.map((c) => String(c.category_id)));
  const seriesValid = new Set(seriesScope.safe.map((c) => String(c.category_id)));

  const liveB = bucketByCategory(liveAll, liveValid);
  const vodB = bucketByCategory(vodAll, vodValid);
  const serB = bucketByCategory(seriesAll, seriesValid);

  const sum = (m: Map<string, any[]>) => Array.from(m.values()).reduce((a, b) => a + b.length, 0);

  // Item counts inside ADULT-named categories (excluded from index by design)
  function countInAdultCats(rows: any[], adultCatIds: Set<string>): number {
    return rows.filter((s) => !isAdultItem(s) && adultCatIds.has(String(s.category_id || ''))).length;
  }
  const liveAdultCatIds = new Set(liveScope.adult.map((c) => String(c.category_id)));
  const vodAdultCatIds = new Set(vodScope.adult.map((c) => String(c.category_id)));
  const serAdultCatIds = new Set(seriesScope.adult.map((c) => String(c.category_id)));

  // Largest categories (assembly stall suspects)
  const topCats = (m: Map<string, any[]>, names: Map<string, string>) =>
    Array.from(m.entries())
      .map(([cid, arr]) => ({ categoryId: cid, name: names.get(cid) || '?', items: arr.length }))
      .sort((a, b) => b.items - a.items)
      .slice(0, 8);

  const liveNames = new Map<string, string>(liveCats.map((c: any) => [String(c.category_id), String(c.category_name)] as [string, string]));
  const vodNames = new Map<string, string>(vodCats.map((c: any) => [String(c.category_id), String(c.category_name)] as [string, string]));
  const serNames = new Map<string, string>(seriesCats.map((c: any) => [String(c.category_id), String(c.category_name)] as [string, string]));

  const report = {
    measuredAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    live: {
      totalRows: liveAll.length,
      familySafeNameOnly: liveAll.filter((s: any) => !isAdultItem(s)).length,
      adultNamedCategories: liveScope.adult.length,
      safeCategories: liveScope.safe.length,
      scopedIndexCount: sum(liveB.map),
      droppedAdultItem: liveB.droppedAdultItem,
      droppedOrphanCategoryItem: liveB.droppedOrphanCat,
      itemsInAdultCategories: countInAdultCats(liveAll, liveAdultCatIds),
      topCategories: topCats(liveB.map, liveNames),
      deployedCount: 14119,
    },
    vod: {
      totalRows: vodAll.length,
      familySafeNameOnly: vodAll.filter((s: any) => !isAdultItem(s)).length,
      adultNamedCategories: vodScope.adult.length,
      safeCategories: vodScope.safe.length,
      scopedIndexCount: sum(vodB.map),
      droppedAdultItem: vodB.droppedAdultItem,
      droppedOrphanCategoryItem: vodB.droppedOrphanCat,
      itemsInAdultCategories: countInAdultCats(vodAll, vodAdultCatIds),
      topCategories: topCats(vodB.map, vodNames),
      deployedCount: 86291,
    },
    series: {
      totalRows: seriesAll.length,
      familySafeNameOnly: seriesAll.filter((s: any) => !isAdultItem(s)).length,
      adultNamedCategories: seriesScope.adult.length,
      safeCategories: seriesScope.safe.length,
      scopedIndexCount: sum(serB.map),
      droppedAdultItem: serB.droppedAdultItem,
      droppedOrphanCategoryItem: serB.droppedOrphanCat,
      itemsInAdultCategories: countInAdultCats(seriesAll, serAdultCatIds),
      topCategories: topCats(serB.map, serNames),
      deployedCount: 13633,
    },
  };

  fs.writeFileSync('scripts/catalog-audit.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`[audit] done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> scripts/catalog-audit.json`);
}

main().catch((e) => { console.error('[audit] FAILED', e); process.exit(1); });
