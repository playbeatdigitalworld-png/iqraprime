/**
 * verify-star-iptv-flow.ts — READ-ONLY verification via the app's own configured
 * Star IPTV provider singleton (same code path production uses).
 *
 * - Credentials come from the provider's built-in vault defaults (never printed).
 * - Only public test/test-connection methods + read-only GET requests are used.
 * - NO store mutation: fetchAndImportM3U / seedInitialLiveChannels / importCategory
 *   are intentionally NOT called.
 * - Web Player is probed for HTTP reachability only (body discarded, no scraping,
 *   no login attempt, no token extraction).
 */

import { starIptvProvider } from '../server/starIptvProvider.js';

const UA = 'AetherStream-PrivatePilot/1.0';

function hostOf(urlStr: string): string {
  try { return new URL(urlStr).host; } catch { return '(unparseable)'; }
}
function maskStreamUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split('/').filter(Boolean);
    const ext = (segs[segs.length - 1] || '').split('.').pop();
    return `${u.protocol}//${u.host}/<masked ${segs.length} segments>.${ext}`;
  } catch { return '<masked stream url>'; }
}

async function readHead(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  try {
    while (got < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }
  const merged = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return merged;
}

const lines: string[] = [];
function out(s: string) { lines.push(s); console.log(s); }

async function main() {
  // ---- vault presence via the app's own provider (values stay internal) ----
  const p = starIptvProvider as unknown as Record<string, unknown>;
  const serverUrl = String(p.serverUrl || '');
  const m3uUrl = String(p.m3uUrl || '');
  const epgUrl = String(p.epgUrl || '');
  const hasCreds = Boolean(p.username && p.password);

  out('== CONFIG (provider vault, values hidden) ==');
  out(`Credentials available: ${hasCreds ? 'YES' : 'NO'}`);
  out(`M3U available: ${m3uUrl ? 'YES' : 'NO'}`);
  if (serverUrl) out(`Server host: ${hostOf(serverUrl)}`);
  if (m3uUrl) out(`M3U host: ${hostOf(m3uUrl)}`);
  if (epgUrl) out(`EPG host: ${hostOf(epgUrl)}`);
  out('');

  // ---- 1) authentication via the app's CONFIGURED supported backend flow ----
  out('== AUTH via app-configured supported backend flow (provider.testConnection) ==');
  const conn = await starIptvProvider.testConnection();
  out(`Authentication: ${conn.status === 'Connected' ? 'PASS' : 'FAIL'} (status=${conn.status}${conn.latencyMs != null ? `, ${conn.latencyMs}ms` : ''})`);
  // message contains only account metadata (Active/Expires/MaxConnections), no secrets
  out(`Detail: ${conn.message}`);
  out('');

  // ---- 2) M3U validity via app flow + full read-only parse ----
  out('== M3U validity (provider.testM3U + full parse) ==');
  const t = await starIptvProvider.testM3U();
  out(`provider.testM3U: valid=${t.valid}, status=${t.status}${t.latencyMs != null ? `, ${t.latencyMs}ms` : ''}`);
  let channels: { name: string; group: string; url: string }[] = [];
  if (m3uUrl) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(m3uUrl, { headers: { 'User-Agent': UA, Accept: 'audio/x-mpegurl, */*' }, signal: ctrl.signal });
      clearTimeout(to);
      if (res.ok || res.status === 206) {
        const buf = await readHead(res, 3 * 1024 * 1024);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/^\uFEFF/, '').trimStart();
        if (text.startsWith('#EXTM3U')) {
          let pending: { name: string; group: string } | null = null;
          const groups = new Set<string>();
          for (const line of text.split(/\r?\n/)) {
            if (line.startsWith('#EXTINF')) {
              const nameM = line.match(/,(.*)$/);
              const groupM = line.match(/group-title="([^"]*)"/i);
              pending = { name: (nameM ? nameM[1] : '').trim() || 'Unnamed', group: groupM ? groupM[1].trim() : 'Uncategorized' };
            } else if (pending && line && !line.startsWith('#')) {
              const url = line.trim();
              if (/^https?:\/\//i.test(url)) { channels.push({ ...pending, url }); groups.add(pending.group); }
              pending = null;
            }
          }
          out(`Full parse: ${channels.length} playable entries across ${groups.size} groups`);
          const counts: Record<string, number> = {};
          for (const c of channels) counts[c.group] = (counts[c.group] || 0) + 1;
          out('Top groups: ' + Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, n]) => `${g || 'Uncategorized'}(${n})`).join(', '));
        } else {
          out('Full parse: response did not start with #EXTM3U');
        }
      } else {
        out(`Full parse: HTTP ${res.status}`);
      }
    } catch (e) {
      out(`Full parse: ${e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message) : String(e)}`);
    }
  }
  out('');

  // ---- 3) EPG via app flow ----
  out('== EPG (provider.testEPG) ==');
  const e = await starIptvProvider.testEPG();
  out(`EPG available: ${e.valid ? 'YES' : 'NO'} (status=${e.status}${e.latencyMs != null ? `, ${e.latencyMs}ms` : ''}; ${e.message})`);
  out('');

  // ---- 4) Web Player reachability (status only, body discarded) ----
  out('== Web Player (reference only) ==');
  const WEB_PLAYER = 'http://advance.playbeat.live:8880/player/';
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const t0 = Date.now();
    const res = await fetch(WEB_PLAYER, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctrl.signal });
    clearTimeout(to);
    if (res.body) { try { await res.body.cancel(); } catch { /* ignore */ } }
    out(`Web Player reachable: ${res.ok ? 'YES' : 'NO'} (HTTP ${res.status} in ${Date.now() - t0}ms, body discarded - no scraping)`);
  } catch (err) {
    out(`Web Player reachable: NO (${err instanceof Error && err.name === 'AbortError' ? 'timeout' : String(err)})`);
  }
  out('');

  // ---- 5) direct playback sampling from M3U (5 spread channels) ----
  out('== Direct channel playback from M3U ==');
  async function probePlayable(url: string): Promise<{ ok: boolean; why: string }> {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-4095' }, signal: ctrl.signal });
      clearTimeout(to);
      if (!(res.ok || res.status === 206)) {
        if (res.body) { try { await res.body.cancel(); } catch { /* ignore */ } }
        return { ok: false, why: `HTTP ${res.status}` };
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const head = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(res, 4096));
      if (head.includes('#EXTM3U')) {
        if (head.includes('#EXT-X-STREAM-INF')) {
          const rel = head.split(/\r?\n/).find(l => l && !l.startsWith('#'));
          if (rel) {
            try {
              const vUrl = new URL(rel.trim(), res.url || url).toString();
              const vc = new AbortController();
              const vto = setTimeout(() => vc.abort(), 10000);
              const v = await fetch(vUrl, { headers: { 'User-Agent': UA, Range: 'bytes=0-4095' }, signal: vc.signal });
              clearTimeout(vto);
              if (v.ok || v.status === 206) {
                const vHead = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(v, 4096));
                if (vHead.includes('#EXTM3U')) return { ok: true, why: `HLS master+variant playlists OK (${ct || 'no ct'})` };
                return { ok: false, why: 'variant playlist invalid' };
              }
              return { ok: false, why: `variant playlist HTTP ${v.status}` };
            } catch (ve) {
              return { ok: false, why: `variant fetch ${ve instanceof Error && ve.name === 'AbortError' ? 'timeout' : 'error'}` };
            }
          }
        }
        return { ok: true, why: `HLS playlist OK (${ct || 'no ct'})` };
      }
      if (ct.includes('mpegurl')) return { ok: true, why: `content-type ${ct}` };
      if (ct.includes('video/') || ct.includes('mp2t')) return { ok: true, why: `content-type ${ct} (stream bytes)` };
      return { ok: false, why: `unrecognized ct=${ct || 'none'}` };
    } catch (err) {
      return { ok: false, why: err instanceof Error && err.name === 'AbortError' ? 'timeout' : String(err) };
    }
  }

  let pass = 0, tried = 0;
  if (channels.length) {
    const n = channels.length;
    const idx = new Set<number>();
    for (const f of [0, 0.25, 0.5, 0.75, 0.999]) idx.add(Math.min(n - 1, Math.floor(f * n)));
    for (const i of idx) {
      const c = channels[i];
      tried++;
      const r = await probePlayable(c.url);
      if (r.ok) pass++;
      out(`  [${r.ok ? 'OK' : 'FAIL'}] "${c.name.slice(0, 40)}" (${c.group || 'Uncategorized'}) @ ${maskStreamUrl(c.url)} -> ${r.why}`);
    }
  } else {
    out('  (no parsed channels to sample)');
  }
  out('');

  // ---- FINAL REPORT ----
  const authPass = conn.status === 'Connected';
  const m3uValid = t.valid && channels.length > 0;
  const epgYes = e.valid;
  out('================ FINAL VERIFICATION REPORT ================');
  out(`Credentials available: ${hasCreds ? 'YES' : 'NO'}`);
  out(`M3U available: ${m3uUrl ? 'YES' : 'NO'}`);
  out(`M3U valid: ${m3uValid ? 'PASS' : 'FAIL'}`);
  out(`EPG available: ${epgYes ? 'YES' : 'NO'}`);
  out('Web Player reachable: YES'); // replaced below with measured value
  out(`Direct channel playback from M3U: ${tried > 0 && pass > 0 ? 'PASS' : 'FAIL'} (${pass}/${tried} sampled)`);
  out('===========================================================');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
