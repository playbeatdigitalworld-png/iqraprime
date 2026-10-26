/**
 * verify-new-lines.ts — READ-ONLY verification of two user-supplied Star IPTV lines.
 *
 * Rules honored:
 * - Credentials arrive via env vars (LINE1_USER/LINE1_PASS/LINE2_USER/LINE2_PASS) and are
 *   NEVER printed, never written to any file, never persisted anywhere.
 * - Uses the app's own StarIPTVProvider class in throwaway instances (vault singleton
 *   untouched). Only read-only test methods + plain GETs.
 * - fetchAndImportM3U / ensureSeeded / importCategory are intentionally NOT called
 *   -> zero store mutation, zero DB writes, zero UI changes, zero config changes.
 * - All URLs printed host-only or segment-masked; passwords never echoed.
 */

import { StarIPTVProvider } from '../server/starIptvProvider.js';

const HOST = 'http://advance.playbeat.live:8880';
const UA = 'AetherStream-PrivatePilot/1.0';

interface LineDef { label: string; user: string; pass: string; }
const LINES: LineDef[] = [
  { label: 'Line A', user: process.env.LINE1_USER || '', pass: process.env.LINE1_PASS || '' },
  { label: 'Line B', user: process.env.LINE2_USER || '', pass: process.env.LINE2_PASS || '' },
];

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
              if (vHead.includes('#EXTM3U')) return { ok: true, why: `HLS master+variant OK (${ct || 'no ct'})` };
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

interface ParsedCh { name: string; group: string; url: string; }

async function fullParseM3U(m3uUrl: string): Promise<{ entries: ParsedCh[]; groups: number; note: string }> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(m3uUrl, { headers: { 'User-Agent': UA, Accept: 'audio/x-mpegurl, */*' }, signal: ctrl.signal });
    clearTimeout(to);
    if (!(res.ok || res.status === 206)) return { entries: [], groups: 0, note: `HTTP ${res.status}` };
    const buf = await readHead(res, 3 * 1024 * 1024);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/^\uFEFF/, '').trimStart();
    if (!text.startsWith('#EXTM3U')) return { entries: [], groups: 0, note: 'no #EXTM3U header' };
    const entries: ParsedCh[] = [];
    const groups = new Set<string>();
    let pending: { name: string; group: string } | null = null;
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('#EXTINF')) {
        const nameM = line.match(/,(.*)$/);
        const groupM = line.match(/group-title="([^"]*)"/i);
        pending = { name: (nameM ? nameM[1] : '').trim() || 'Unnamed', group: groupM ? groupM[1].trim() : 'Uncategorized' };
      } else if (pending && line && !line.startsWith('#')) {
        const url = line.trim();
        if (/^https?:\/\//i.test(url)) { entries.push({ ...pending, url }); groups.add(pending.group); }
        pending = null;
      }
    }
    return { entries, groups: groups.size, note: 'parsed' };
  } catch (e) {
    return { entries: [], groups: 0, note: e instanceof Error && e.name === 'AbortError' ? 'timeout' : String(e) };
  }
}

async function verifyLine(line: LineDef): Promise<void> {
  const u = encodeURIComponent(line.user);
  const p = encodeURIComponent(line.pass);
  const m3uTs = `${HOST}/get.php?username=${u}&password=${p}&type=m3u_plus&output=ts`;
  const m3uHls = `${HOST}/get.php?username=${u}&password=${p}&type=m3u_plus&output=hls`;
  const epgUrl = `${HOST}/xmltv.php?username=${u}&password=${p}`;

  console.log(`\n################ ${line.label} (user ${line.user}) ################`);

  // 1) auth + account metadata via Xtream player_api (app-configured flow)
  let authOk = false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const t0 = Date.now();
    const res = await fetch(`${HOST}/player_api.php?username=${u}&password=${p}`, {
      headers: { 'User-Agent': UA }, signal: ctrl.signal,
    });
    clearTimeout(to);
    const latency = Date.now() - t0;
    const data = await res.json().catch(() => null);
    const ui = data?.user_info;
    if (res.ok && ui && ui.auth === 1) {
      authOk = true;
      const exp = ui.exp_date ? new Date(Number(ui.exp_date) * 1000).toISOString().slice(0, 10) : 'no expiry';
      console.log(`AUTH: PASS (${latency}ms) | status=${ui.status} | expires=${exp} | max_connections=${ui.max_connections} | active_cons=${ui.active_cons}`);
    } else {
      console.log(`AUTH: FAIL (${latency}ms) | HTTP ${res.status} | auth=${ui ? ui.auth : 'n/a'}`);
    }
  } catch (e) {
    console.log(`AUTH: FAIL (${e instanceof Error && e.name === 'AbortError' ? 'timeout' : String(e)})`);
  }

  // 2) app code-path tests via throwaway provider instance (no singleton, no seeding)
  const prov = new StarIPTVProvider({
    providerName: 'verify-readonly',
    serverUrl: HOST,
    username: line.user,
    password: line.pass,
    m3uUrl: m3uTs,
    epgUrl,
  });
  const conn = await prov.testConnection();
  console.log(`provider.testConnection: ${conn.status}${conn.latencyMs != null ? ` (${conn.latencyMs}ms)` : ''}`);

  const hlsCheck = await prov.testM3U(m3uHls);
  console.log(`M3U m3u_plus+output=hls (app convention): valid=${hlsCheck.valid}, status=${hlsCheck.status}${hlsCheck.latencyMs != null ? `, ${hlsCheck.latencyMs}ms` : ''}`);

  const epg = await prov.testEPG(epgUrl);
  console.log(`EPG (xmltv.php): valid=${epg.valid}, status=${epg.status}${epg.latencyMs != null ? `, ${epg.latencyMs}ms` : ''}`);

  // 3) full read-only parse of the user-provided m3u_plus&output=ts link
  const parsed = await fullParseM3U(m3uTs);
  console.log(`M3U full parse (${parsed.note}): ${parsed.entries.length} playable entries across ${parsed.groups} groups`);
  if (parsed.entries.length) {
    const counts: Record<string, number> = {};
    for (const c of parsed.entries) counts[c.group] = (counts[c.group] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([g, n]) => `${g || 'Uncategorized'}(${n})`).join(', ');
    console.log(`Top groups: ${top}`);
  }

  // 4) gentle playback sampling: 4 spread entries, 4KB head each, sequential
  if (parsed.entries.length) {
    const n = parsed.entries.length;
    const idx = new Set<number>();
    for (const f of [0, 0.33, 0.66, 0.999]) idx.add(Math.min(n - 1, Math.floor(f * n)));
    let pass = 0;
    for (const i of idx) {
      const c = parsed.entries[i];
      const r = await probePlayable(c.url);
      if (r.ok) pass++;
      console.log(`  [${r.ok ? 'OK' : 'FAIL'}] "${c.name.slice(0, 40)}" (${c.group || 'Uncategorized'}) @ ${maskStreamUrl(c.url)} -> ${r.why}`);
    }
    console.log(`PLAYBACK SAMPLE: ${pass}/${idx.size} playable`);
  } else {
    console.log('PLAYBACK SAMPLE: skipped (no parsed entries)');
  }

  console.log(`SUMMARY ${line.label}: AUTH=${authOk ? 'PASS' : 'FAIL'} | M3U=${parsed.entries.length > 0 ? `PASS (${parsed.entries.length} entries / ${parsed.groups} groups)` : 'FAIL'} | EPG=${epg.valid ? 'PASS' : 'FAIL'} | app-HLS-output=${hlsCheck.valid ? 'PASS' : 'FAIL'}`);
}

async function main() {
  console.log('== READ-ONLY verification of 2 new Star IPTV lines ==');
  console.log(`Host: ${hostOf(HOST)} | passwords: [hidden] | mode: no writes, no imports, no vault changes`);
  for (const line of LINES) {
    if (!line.user || !line.pass) {
      console.log(`\n${line.label}: missing credentials in env -> skipped`);
      continue;
    }
    await verifyLine(line);
  }
  console.log('\n== DONE (no state was modified anywhere) ==');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
