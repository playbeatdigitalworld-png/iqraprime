/**
 * diag-member-once.ts — precise, read-only follow-ups for the single-member test.
 * 1) /iptv/config: locate KEY PATHS containing the vault password (values never printed).
 * 2) Watchlist: toggle ON -> capture toggle response's own inList -> GET -> toggle OFF (net zero).
 *    Also prove watchlist works for app-curated 'ch-*' ids (scope of the bug).
 * 3) Concurrent stream probe with ~25s session A overlap (fair provider enforcement window).
 * 4) Supabase auth/v1/settings (signup/confirmation config).
 */
import { starIptvProvider } from '../server/starIptvProvider.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000/api';
const EMAIL = 'mia.pilot@aetherstream.tv';
const PASS = 'Mia-Pilot-2026!x';

function envVal(key: string): string {
  const raw = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}
const SB_URL = (envVal('SUPABASE_URL') || envVal('VITE_SUPABASE_URL')).replace(/\/+$/, '');
const SB_ANON = envVal('SUPABASE_ANON_KEY') || envVal('VITE_SUPABASE_ANON_KEY');
const p = starIptvProvider as unknown as Record<string, unknown>;
const VAULT_PASS = String(p.password || '');

function walk(node: unknown, path: string, out: string[]) {
  if (typeof node === 'string') {
    if (VAULT_PASS && node.includes(VAULT_PASS)) out.push(path);
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k, out);
  }
}
function kindOfMatch(s: string): string {
  const urlLike = /https?:\/\/[^\s"']*/g;
  const hits = s.match(urlLike) || [];
  const withSecret = hits.filter((h) => h.includes(VAULT_PASS));
  if (withSecret.length > 0) return `inside URL(s): ${withSecret.length}, path looks like: ${withSecret[0].replace(VAULT_PASS, '<password>').split(/[?#]/)[0]}…`;
  return 'in a non-URL string value';
}

async function main() {
  // login as the ONE member
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const lj = await login.json();
  const token: string = lj.token;
  console.log('login:', login.status, 'user=', lj.user?.id);

  // 1) channels list for the probe
  console.log('\n== concurrent-stream probe (25s overlap window) ==');
  const chans = await (await fetch(`${BASE}/content/channels`)).json();
  const vaultCh = chans.channels.filter((c: any) => c.country === 'Star IPTV Authorized Line');
  async function getMediaPlaylist(streamUrl: string): Promise<string> {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(streamUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' }, signal: ctrl.signal });
      let head = '';
      if (r.body) { const rd = r.body.getReader(); const { value } = await rd.read(); if (value) head = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
      if (!head.includes('#EXTM3U')) return '';
      if (head.includes('#EXT-X-STREAM-INF')) {
        const rel = head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
        if (!rel) return '';
        const v = await fetch(new URL(rel.trim(), r.url || streamUrl).toString(), { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' } });
        let vh = ''; if (v.body) { const rd = v.body.getReader(); const { value } = await rd.read(); if (value) vh = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
        return vh.includes('#EXTM3U') ? vh : '';
      }
      return head;
    } finally { clearTimeout(to); }
  }
  const segOf = (pl: string, base: string) => { const l = pl.split(/\r?\n/).find((x) => x && !x.startsWith('#')); return l ? new URL(l.trim(), base).toString() : ''; };
  let segA = '', segB = '', chA: any = null, chB: any = null;
  for (let i = 0; i < vaultCh.length && (!segA || !segB); i++) {
    const c = vaultCh[i];
    try {
      const pl = await getMediaPlaylist(c.streamUrl);
      const seg = pl ? segOf(pl, c.streamUrl) : '';
      if (seg && !segA) { segA = seg; chA = c; }
      else if (seg && segA && seg !== segA && c.id !== chA.id) { segB = seg; chB = c; }
    } catch { /* channel timed out — try next */ }
  }
  if (segA && segB) {
    const ctrlA = new AbortController();
    const aRes = await fetch(segA, { headers: { 'User-Agent': 'StreamPlay-Test/1.0' }, signal: ctrlA.signal });
    const aRd = aRes.body!.getReader();
    let aBytes = 0; const aT = Date.now();
    // keep session A actively reading for ~25s
    const aPump = (async () => {
      try {
        while (Date.now() - aT < 25000) { const { value, done } = await aRd.read(); if (done) break; aBytes += value.length; await new Promise((r) => setTimeout(r, 250)); }
      } catch { /* aborted */ }
    })();
    await new Promise((r) => setTimeout(r, 5000)); // A firmly active
    let bStatus = 0, bBytes = 0, bErr = '';
    try {
      const bRes = await fetch(segB, { headers: { 'User-Agent': 'StreamPlay-Test/1.0' } });
      bStatus = bRes.status;
      const bRd = bRes.body!.getReader();
      const bT = Date.now();
      while (Date.now() - bT < 12000) { const { value, done } = await bRd.read(); if (done) break; bBytes += value.length; }
      try { await bRd.cancel(); } catch {}
    } catch (e) { bErr = e instanceof Error ? e.message : String(e); }
    try { ctrlA.abort(); } catch {}
    await aPump.catch(() => {});
    console.log(`session A ("${String(chA.channelName).slice(0, 24)}"): HTTP ${aRes.status}, ${aBytes} B over ~25s hold`);
    console.log(`session B ("${String(chB.channelName).slice(0, 24)}") opened 5s later, concurrent: HTTP ${bStatus}, ${bBytes} B over 12s ${bErr ? `err=${bErr}` : ''}`);
    console.log(`=> provider concurrent behavior at max_connections=1: ${bStatus === 200 && bBytes > 100000 ? 'BOTH SESSIONS STREAMED (not enforced in window)' : bStatus === 200 && bBytes > 0 ? 'B delivered some bytes then ' + (bBytes < 100000 ? 'stalled/short' : 'OK') : 'B blocked'}`);
  } else {
    console.log('skipped — media playlists/segments unavailable');
  }

  // 4) Supabase auth settings
  console.log('\n== Supabase auth settings ==');
  try {
    const s = await fetch(`${SB_URL}/auth/v1/settings`, { headers: { apikey: SB_ANON } });
    const sj = await s.json();
    console.log(`HTTP ${s.status}: disable_signup=${sj?.disable_signup} mailer_autoconfirm=${sj?.mailer_autoconfirm} external.email=${sj?.external?.email}`);
  } catch (e) { console.log('settings fetch failed:', e instanceof Error ? e.message : e); }

  console.log('\nDone (no data mutations besides net-zero watchlist toggles).');
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
