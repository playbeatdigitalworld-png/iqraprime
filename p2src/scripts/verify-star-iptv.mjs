/**
 * verify-star-iptv.mjs — READ-ONLY verification of Star IPTV integration.
 *
 * Scope (per user instruction):
 *  - Verify existing credentials authenticate against the provider's SUPPORTED,
 *    ALREADY-CONFIGURED backend flow (Xtream player_api.php — same flow the app's
 *    testConnection() has used since the original import; NOT an invented endpoint).
 *  - Verify the configured M3U (get.php) yields complete, directly playable URLs.
 *  - Verify EPG (xmltv.php) availability.
 *  - Web Player URL checked for REACHABILITY ONLY (HTTP status; no HTML scraping,
 *    no login attempts, no token extraction, no auth bypass).
 *
 * Security: credentials are loaded from .env into memory ONLY.
 * Every printed URL is host-stamped with query strings stripped and any embedded
 * credential path segments masked. Values are never echoed, logged, or written to disk.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- .env loader (values stay in memory) ----------
function loadEnv() {
  const env = {};
  const raw = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const USERNAME = env.STAR_IPTV_USERNAME || '';
const PASSWORD = env.STAR_IPTV_PASSWORD || '';
const SERVER_URL = (env.STAR_IPTV_SERVER_URL || '').replace(/\/+$/, '');
const M3U_URL = env.STAR_IPTV_M3U_URL || '';
const EPG_URL = env.STAR_IPTV_EPG_URL || '';
const API_URL = env.STAR_IPTV_API_URL || '';
const UA = 'AetherStream-PrivatePilot/1.0'; // same UA the app already uses

// ---------- masking helpers ----------
function hostOf(urlStr) {
  try { return new URL(urlStr).host; } catch { return '(unparseable)'; }
}
function describeUrl(urlStr, label) {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.replace(/\/+$/, '');
    const base = path.split('/').pop() || path;
    const nParams = [...u.searchParams.keys()].length;
    return `${label} -> ${u.protocol}//${u.host}${path === '' || base === path ? `/${base}` : '/…/' + base} [${nParams} query params, values hidden]`;
  } catch {
    return `${label} -> (unparseable URL, ${urlStr.length} chars)`;
  }
}
function maskStreamUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split('/').filter(Boolean);
    const ext = (segs[segs.length - 1] || '').split('.').pop();
    return `${u.protocol}//${u.host}/<masked ${segs.length} segments>.${ext}`;
  } catch {
    return '<masked stream url>';
  }
}

const results = {};
const lines = [];
function out(s) { lines.push(s); console.log(s); }

async function timedFetch(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      signal: ctrl.signal,
      ...opts,
    });
    return { res, ms: Date.now() - t0 };
  } finally {
    // keep controller alive until done; clear happens per-use below
  }
}

// Read at most maxBytes from a response body, then cancel (avoids huge downloads).
async function readHead(res, maxBytes) {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  try {
    while (got < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  const merged = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return merged;
}

// =====================================================================
// 1) Credentials available
// =====================================================================
const credsAvailable = Boolean(USERNAME && PASSWORD);
results.credentialsAvailable = credsAvailable ? 'YES' : 'NO';
results.m3uAvailable = Boolean(M3U_URL) ? 'YES' : 'NO';
out('== CONFIG (values hidden) ==');
out(`Credentials available: ${results.credentialsAvailable}`);
out(`M3U available:         ${results.m3uAvailable}`);
if (M3U_URL) out(describeUrl(M3U_URL, 'M3U URL'));
if (EPG_URL) out(describeUrl(EPG_URL, 'EPG URL'));
if (SERVER_URL) out(describeUrl(SERVER_URL, 'Server URL'));
if (API_URL) out(describeUrl(API_URL, 'API URL'));
out('');

// =====================================================================
// 2) Credential authentication via the app's CONFIGURED supported flow
//    (same player_api.php probe the adapter's testConnection() uses)
// =====================================================================
let authOk = false, authInfo = null, authDetail = 'skipped';
if (credsAvailable && SERVER_URL) {
  try {
    const u = new URL(`${SERVER_URL}/player_api.php`);
    u.searchParams.set('username', USERNAME);
    u.searchParams.set('password', PASSWORD);
    const { res, ms } = await timedFetch(u.toString(), {}, 12000);
    if (res.ok) {
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}
      const ui = data?.user_info;
      if (ui && Number(ui.auth) === 1) {
        authOk = true;
        const exp = ui.exp_date ? new Date(Number(ui.exp_date) * 1000).toISOString().slice(0, 10) : 'no expiry set';
        authInfo = {
          status: ui.status || 'Active',
          expiry: exp,
          isTrial: String(ui.is_trial) === '1',
          activeConnections: String(ui.active_cons ?? 'n/a'),
          maxConnections: String(ui.max_connections ?? 'n/a'),
        };
        authDetail = `auth=1, status=${authInfo.status}, expires=${exp}, trial=${authInfo.isTrial}, connections=${authInfo.activeConnections}/${authInfo.maxConnections}`;
      } else {
        authDetail = `HTTP ${res.status} but user_info.auth !== 1 (credentials rejected by backend flow)`;
      }
    } else {
      authDetail = `HTTP ${res.status} from backend flow`;
    }
  } catch (e) {
    authDetail = `error: ${e.name === 'AbortError' ? 'timeout' : e.message}`;
  }
} else {
  authDetail = 'missing config (credentials or server URL)';
}
results.authViaConfiguredFlow = authOk ? 'PASS' : 'FAIL';
out('== AUTH via already-configured supported backend flow ==');
out(`Authentication: ${authOk ? 'PASS' : 'FAIL'} (${authDetail}, host=${SERVER_URL ? hostOf(SERVER_URL) : 'n/a'})`);
out('');

// =====================================================================
// 3) M3U validity — full download (cap 3 MB), parse #EXTINF entries
// =====================================================================
let m3uValid = false, channels = [], groupCount = 0, m3uMs = 0, m3uNote = '';
if (M3U_URL) {
  try {
    const { res, ms } = await timedFetch(M3U_URL, { headers: { Accept: 'audio/x-mpegurl, */*' } }, 30000);
    m3uMs = ms;
    if (res.ok || res.status === 206) {
      const buf = await readHead(res, 3 * 1024 * 1024);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      const trimmed = text.replace(/^\uFEFF/, '').trimStart();
      if (trimmed.startsWith('#EXTM3U')) {
        m3uValid = true;
        const rows = trimmed.split(/\r?\n/);
        let pendingMeta = null;
        const groups = new Set();
        for (const line of rows) {
          if (line.startsWith('#EXTINF')) {
            const nameM = line.match(/,(.*)$/);
            const groupM = line.match(/group-title="([^"]*)"/i);
            pendingMeta = {
              name: (nameM ? nameM[1] : '').trim() || 'Unnamed',
              group: groupM ? groupM[1].trim() : 'Uncategorized',
            };
          } else if (pendingMeta && line && !line.startsWith('#')) {
            const url = line.trim();
            if (/^https?:\/\//i.test(url)) {
              channels.push({ ...pendingMeta, url });
              groups.add(pendingMeta.group);
            }
            pendingMeta = null;
          }
        }
        groupCount = groups.size;
        m3uNote = `header #EXTM3U present, ${channels.length} playable entries in ${groupCount} groups`;
      } else {
        m3uNote = `response ${res.status} but no #EXTM3U header (first bytes: ${JSON.stringify(trimmed.slice(0, 24))})`;
      }
    } else {
      m3uNote = `HTTP ${res.status}`;
    }
  } catch (e) {
    m3uNote = e.name === 'AbortError' ? 'timeout after 30s' : `error: ${e.message}`;
  }
} else {
  m3uNote = 'M3U URL not configured';
}
results.m3uValid = m3uValid ? 'PASS' : 'FAIL';
out('== M3U (configured get.php playlist) ==');
out(`M3U valid: ${results.m3uValid} (${m3uNote}; fetch ${m3uMs}ms)`);
if (channels.length) {
  const counts = {};
  for (const c of channels) counts[c.group] = (counts[c.group] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([g, n]) => `${g || 'Uncategorized'}(${n})`).join(', ');
  out(`Top groups: ${top}`);
}
out('');

// =====================================================================
// 4) EPG availability (xmltv.php) — first 32 KB only, then cancel
// =====================================================================
let epgState = 'NO', epgNote = 'not configured';
if (EPG_URL) {
  try {
    const { res } = await timedFetch(EPG_URL, { headers: { Range: 'bytes=0-32767', Accept: '*/*' } }, 20000);
    if (res.ok || res.status === 206) {
      const head = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(res, 32768));
      const looksXmltv = /<\?xml|<tv[\s>]|<!DOCTYPE tv/i.test(head);
      epgState = looksXmltv ? 'YES' : 'NO';
      epgNote = `HTTP ${res.status}${res.status === 206 ? ' (range)' : ''}, xmltv content=${looksXmltv}, first ${head.length} bytes sampled`;
    } else {
      epgNote = `HTTP ${res.status}`;
      epgState = res.status === 401 || res.status === 403 ? 'NO' : 'NO';
    }
  } catch (e) {
    epgNote = e.name === 'AbortError' ? 'timeout' : `error: ${e.message}`;
  }
}
results.epgAvailable = epgState;
out('== EPG (configured xmltv.php) ==');
out(`EPG available: ${epgState} (${epgNote})`);
out('');

// =====================================================================
// 5) Web Player reachability — status code ONLY, body discarded
// =====================================================================
const WEB_PLAYER = 'http://advance.playbeat.live:8880/player/';
let wpState = 'NO', wpNote = '';
try {
  const { res, ms } = await timedFetch(WEB_PLAYER, { headers: { Accept: 'text/html' } }, 12000);
  wpState = res.ok ? 'YES' : 'NO';
  wpNote = `HTTP ${res.status} in ${ms}ms (body discarded — no scraping)`;
} catch (e) {
  wpNote = e.name === 'AbortError' ? 'timeout' : `error: ${e.message}`;
}
results.webPlayerReachable = wpState;
out('== Web Player (reference only) ==');
out(`Web Player reachable: ${wpState} (${wpNote}) at ${WEB_PLAYER}`);
out('');

// =====================================================================
// 6) Direct channel playback from M3U — sample 5 spread channels
//    Each: fetch manifest/stream first 4 KB. HLS manifest may be followed
//    one level into its variant playlist to prove the full playback chain.
// =====================================================================
async function probePlayable(url) {
  try {
    const { res } = await timedFetch(url, { headers: { Range: 'bytes=0-4095' } }, 10000);
    if (!(res.ok || res.status === 206)) return { ok: false, why: `HTTP ${res.status}` };
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const head = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(res, 4096));
    if (head.includes('#EXTM3U')) {
      if (head.includes('#EXT-X-STREAM-INF')) {
        // master playlist -> verify first variant also serves a playlist
        const rel = head.split(/\r?\n/).find(l => l && !l.startsWith('#'));
        if (rel) {
          try {
            const vUrl = new URL(rel.trim(), res.url || url).toString();
            const v = await timedFetch(vUrl, { headers: { Range: 'bytes=0-4095' } }, 10000);
            if (v.res.ok || v.res.status === 206) {
              const vHead = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(v.res, 4096));
              if (vHead.includes('#EXTM3U')) return { ok: true, why: `HLS master+variant playlists OK (${ct || 'no ct'})` };
              return { ok: false, why: `variant playlist invalid (${v.res.status})` };
            }
            return { ok: false, why: `variant playlist HTTP ${v.res.status}` };
          } catch (e) {
            return { ok: false, why: `variant fetch error: ${e.name === 'AbortError' ? 'timeout' : e.message}` };
          }
        }
      }
      return { ok: true, why: `HLS media playlist OK (${ct || 'no ct'})` };
    }
    if (ct.includes('mpegurl')) return { ok: true, why: `content-type ${ct} (playlist)` };
    if (ct.includes('video/') || ct.includes('mp2t')) return { ok: true, why: `content-type ${ct} (stream bytes)` };
    return { ok: false, why: `unrecognized response: ct=${ct || 'none'}, head=${JSON.stringify(head.slice(0, 20))}` };
  } catch (e) {
    return { ok: false, why: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

let playPass = 0, playTried = 0;
const playDetails = [];
if (channels.length) {
  const idx = new Set();
  const n = channels.length;
  for (const f of [0, 0.25, 0.5, 0.75, 0.999]) idx.add(Math.min(n - 1, Math.floor(f * n)));
  for (const i of idx) {
    const c = channels[i];
    playTried++;
    const r = await probePlayable(c.url);
    if (r.ok) playPass++;
    playDetails.push(`  [${r.ok ? 'OK' : 'FAIL'}] "${c.name.slice(0, 40)}" (${c.group || 'Uncategorized'}) @ ${maskStreamUrl(c.url)} -> ${r.why}`);
  }
}
results.directPlayback = playTried > 0 && playPass > 0 ? 'PASS' : 'FAIL';
out('== Direct channel playback from M3U ==');
out(`Direct channel playback from M3U: ${results.directPlayback} (${playPass}/${playTried} sampled channels returned playable streams)`);
for (const d of playDetails) out(d);
out('');

// =====================================================================
// FINAL REPORT (exact requested format)
// =====================================================================
out('================ FINAL VERIFICATION REPORT ================');
out(`Credentials available: ${results.credentialsAvailable}`);
out(`M3U available: ${results.m3uAvailable}`);
out(`M3U valid: ${results.m3uValid}`);
out(`EPG available: ${results.epgAvailable}`);
out(`Web Player reachable: ${results.webPlayerReachable}`);
out(`Direct channel playback from M3U: ${results.directPlayback}`);
out('===========================================================');
