/**
 * Task 13 — Verified provider catalog counts.
 * Counts the FULL Star IPTV catalog surface (live / vod / series) using the
 * provider's own Xtream player_api. Output: scripts/catalog-counts.json
 * Credentials come from provider built-in defaults (never printed).
 */
import fs from 'node:fs';

const HOST = 'http://advance.playbeat.live:8880';
const USER = process.env.P_USER || '7bd69cb1';
const PASS = process.env.P_PASS || '1df53ce4';
const UA = 'AetherStream-PrivatePilot/1.0';
const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|red\s*light|for\s*grown|private\s*\(18/i;

async function api(action: string, extra = '', timeoutMs = 180000): Promise<any> {
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

async function main() {
  const t0 = Date.now();
  console.log('[counts] fetching live streams...');
  const live: any[] = await api('get_live_streams');
  const liveSafe = live.filter((s) => !ADULT.test(String(s.name || '')) && Number(s.is_adult) !== 1).length;

  console.log('[counts] fetching vod streams...');
  const vod: any[] = await api('get_vod_streams');
  const vodSafe = vod.filter((s) => !ADULT.test(String(s.name || '')) && Number(s.is_adult) !== 1).length;

  console.log('[counts] fetching series...');
  const series: any[] = await api('get_series');
  const seriesSafe = series.filter((s) => !ADULT.test(String(s.name || ''))).length;

  const liveCats: any[] = await api('get_live_categories');
  const vodCats: any[] = await api('get_vod_categories');
  const seriesCats: any[] = await api('get_series_categories');

  const out = {
    measuredAt: new Date().toISOString(),
    host: HOST,
    live: { total: live.length, familySafe: liveSafe, categories: liveCats.length },
    vod: { total: vod.length, familySafe: vodSafe, categories: vodCats.length },
    series: { total: series.length, familySafe: seriesSafe, categories: seriesCats.length },
    elapsedMs: Date.now() - t0,
  };
  fs.writeFileSync('/home/z/my-project/scripts/catalog-counts.json', JSON.stringify(out, null, 2));
  console.log('[counts] RESULT', JSON.stringify(out));
}

main().catch((e) => {
  console.error('[counts] FATAL', e instanceof Error ? e.message : e);
  process.exit(1);
});
