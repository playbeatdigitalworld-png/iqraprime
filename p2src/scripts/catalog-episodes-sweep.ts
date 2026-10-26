/**
 * Task 13 — FULL episodes count sweep (v2, resumable, per-id results).
 * Gentle concurrency + retry rounds to survive provider rate-limiting.
 * Checkpoint: scripts/catalog-episodes.json (results map id -> episode count)
 */
import fs from 'node:fs';

const HOST = 'http://advance.playbeat.live:8880';
const USER = process.env.P_USER || '7bd69cb1';
const PASS = process.env.P_PASS || '1df53ce4';
const UA = 'AetherStream-PrivatePilot/1.0';
const OUT = '/home/z/my-project/scripts/catalog-episodes.json';
const CONCURRENCY = 4;
const TIMEOUT_MS = 45000;
const CKPT_EVERY = 200;
const RETRY_ROUNDS = 3;

interface State {
  measuredAt?: string;
  totalSeries: number;
  done: boolean;
  results: Record<string, number>;
}

function loadState(): State {
  try {
    const raw = JSON.parse(fs.readFileSync(OUT, 'utf8')) as Partial<State>;
    if (raw && raw.results) {
      return { totalSeries: raw.totalSeries || 0, done: Boolean(raw.done), results: raw.results };
    }
  } catch { /* fresh start */ }
  return { totalSeries: 0, done: false, results: {} };
}

function saveState(s: State) {
  const episodes = Object.values(s.results).reduce((a, b) => a + b, 0);
  fs.writeFileSync(OUT, JSON.stringify({ ...s, processed: Object.keys(s.results).length, episodes }, null, 1));
}

async function seriesEpisodes(id: number): Promise<number | null> {
  const url = `${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=get_series_info&series_id=${id}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const eps = data?.episodes || {};
      let n = 0;
      for (const k of Object.keys(eps)) {
        if (Array.isArray(eps[k])) n += eps[k].length;
      }
      return n;
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      clearTimeout(to);
    }
  }
  return null;
}

async function runPool(ids: number[], concurrency: number, state: State, rate: { ok: number; fail: number }) {
  let sinceCkpt = 0;
  const queue = [...ids];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      if (id === undefined) break;
      const n = await seriesEpisodes(id);
      if (n === null) rate.fail += 1; else { state.results[String(id)] = n; rate.ok += 1; }
      sinceCkpt += 1;
      if (sinceCkpt >= CKPT_EVERY) {
        sinceCkpt = 0;
        saveState(state);
        const total = Object.keys(state.results).length;
        console.log(`[sweep] ok=${rate.ok} fail=${rate.fail} | covered ${total}/${state.totalSeries}, episodes so far=${Object.values(state.results).reduce((a, b) => a + b, 0)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function main() {
  const state = loadState();
  const res = await fetch(`${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=get_series`, { headers: { 'User-Agent': UA } });
  const all: any[] = await res.json();
  const ids: number[] = all.map((s) => Number(s.series_id)).filter(Boolean);
  state.totalSeries = ids.length;
  saveState(state);

  const pending = ids.filter((id) => state.results[String(id)] === undefined);
  console.log(`[sweep] total=${ids.length} already-done=${ids.length - pending.length} pending=${pending.length}`);
  const t0 = Date.now();

  const rate = { ok: 0, fail: 0 };
  await runPool(pending, CONCURRENCY, state, rate);

  // Retry rounds for failures, progressively gentler
  for (let round = 1; round <= RETRY_ROUNDS; round++) {
    const missing = ids.filter((id) => state.results[String(id)] === undefined);
    if (!missing.length) break;
    console.log(`[sweep] retry round ${round}: ${missing.length} ids, concurrency=${Math.max(1, 2 - round)}`);
    await runPool(missing, Math.max(1, 2 - round), state, rate);
  }

  state.done = true;
  state.measuredAt = new Date().toISOString();
  saveState(state);
  const episodes = Object.values(state.results).reduce((a, b) => a + b, 0);
  console.log(`[sweep] DONE covered=${Object.keys(state.results).length}/${ids.length} episodes=${episodes} elapsedMin=${((Date.now() - t0) / 60000).toFixed(1)}`);
}

main().catch((e) => {
  console.error('[sweep] FATAL', e instanceof Error ? e.message : e);
  process.exit(1);
});
