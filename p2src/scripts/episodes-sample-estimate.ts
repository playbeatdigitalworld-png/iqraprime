/**
 * Episodes sample estimator — statistically honest provider measurement.
 * Pulls the FULL get_series index, measures episodes for a uniform random
 * sample (default 700 series), and extrapolates to the whole library.
 * Output: scripts/episodes-estimate.json  { sampled, avg, estimate, ci95 }
 * Read-only GETs; credentials from env or provider source defaults.
 */
import fs from 'node:fs';

const HOST = 'http://advance.playbeat.live:8880';
const USER = process.env.P_USER || '7bd69cb1';
const PASS = process.env.P_PASS || '1df53ce4';
const UA = 'AetherStream-PrivatePilot/1.0';
const OUT = '/home/z/my-project/scripts/episodes-estimate.json';
const SAMPLE = Number(process.env.SAMPLE_N || 700);
const CONCURRENCY = Number(process.env.CONC || 3);
const TIMEOUT_MS = 45000;

async function j(url: string, attempt = 0): Promise<any> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 + attempt * 3000));
      return j(url, attempt + 1);
    }
    throw e;
  } finally { clearTimeout(to); }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as unknown as R[];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const my = idx++;
      out[my] = await fn(items[my]).catch(() => null as unknown as R);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

(async () => {
  const list = await j(`${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=get_series`);
  if (!Array.isArray(list)) throw new Error('get_series failed');
  const ids: number[] = list.map((s: any) => Number(s.series_id)).filter(Boolean);
  const totalSeries = ids.length;
  const sample = shuffle(ids).slice(0, Math.min(SAMPLE, ids.length));

  const counts = await pool(sample, CONCURRENCY, async (id) => {
    try {
      const info = await j(`${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=get_series_info&series_id=${id}`);
      const eps = info?.episodes || {};
      let n = 0;
      for (const k of Object.keys(eps)) if (Array.isArray(eps[k])) n += eps[k].length;
      return n;
    } catch { return null; }
  });

  const ok = counts.filter((c): c is number => typeof c === 'number');
  const avg = ok.reduce((a, b) => a + b, 0) / Math.max(1, ok.length);
  const sd = Math.sqrt(ok.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, ok.length - 1));
  const se = sd / Math.sqrt(ok.length);
  const estimate = Math.round(avg * totalSeries);
  const ci95 = Math.round(1.96 * se * totalSeries);

  const payload = {
    measuredAt: new Date().toISOString(),
    totalSeries,
    sampled: ok.length,
    failed: counts.length - ok.length,
    avgEpisodesPerSeries: Number(avg.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    estimate,
    ci95,
    zeroCount: ok.filter((c) => c === 0).length,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
})();
