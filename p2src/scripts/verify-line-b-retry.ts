/**
 * verify-line-b-retry.ts — GENTLE read-only retry for Line B playback sampling.
 * Prior probe hit 0/4 on spread samples (2x HTTP 503, 2x timeout). Same host previously
 * showed flaky international .ts entries for the vault line too, so this retry:
 *  - picks 3 "always-on style" channels (UK/EN/US entertainment & news groups)
 *  - probes their output=ts URLs
 *  - also probes the same channels' output=hls (.m3u8) URLs
 *  - retries ONE of the previously failing channels once
 * Total probes <= 7, sequential, 4KB head each. No writes anywhere.
 */
const HOST = 'http://advance.playbeat.live:8880';
const UA = 'AetherStream-PrivatePilot/1.0';
const USER = process.env.LINE2_USER || '';
const PASS = process.env.LINE2_PASS || '';

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

async function parseM3U(m3uUrl: string): Promise<{ name: string; group: string; url: string }[]> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 30000);
  const res = await fetch(m3uUrl, { headers: { 'User-Agent': UA, Accept: 'audio/x-mpegurl, */*' }, signal: ctrl.signal });
  clearTimeout(to);
  if (!(res.ok || res.status === 206)) throw new Error(`HTTP ${res.status}`);
  const buf = await readHead(res, 3 * 1024 * 1024);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/^\uFEFF/, '').trimStart();
  if (!text.startsWith('#EXTM3U')) throw new Error('no #EXTM3U header');
  const out: { name: string; group: string; url: string }[] = [];
  let pending: { name: string; group: string } | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#EXTINF')) {
      const nameM = line.match(/,(.*)$/);
      const groupM = line.match(/group-title="([^"]*)"/i);
      pending = { name: (nameM ? nameM[1] : '').trim() || 'Unnamed', group: groupM ? groupM[1].trim() : 'Uncategorized' };
    } else if (pending && line && !line.startsWith('#')) {
      const url = line.trim();
      if (/^https?:\/\//i.test(url)) out.push({ ...pending, url });
      pending = null;
    }
  }
  return out;
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const u = encodeURIComponent(USER);
  const p = encodeURIComponent(PASS);
  const tsList = await parseM3U(`${HOST}/get.php?username=${u}&password=${p}&type=m3u_plus&output=ts`);
  console.log(`TS parse: ${tsList.length} entries`);
  const hlsList = await parseM3U(`${HOST}/get.php?username=${u}&password=${p}&type=m3u_plus&output=hls`);
  console.log(`HLS parse: ${hlsList.length} entries`);

  // stable key: group-title + name present in both lists (same ids normally)
  const hlsByName = new Map<string, string>();
  for (const c of hlsList) hlsByName.set(`${c.group}||${c.name}`, c.url);

  const wantedGroups = [
    /UK - Entertainment - Live/i,
    /EN - 24x7 Channels - Exclusive/i,
    /(US|USA).*Live/i,
  ];
  const picks: { name: string; group: string; ts: string; hls?: string }[] = [];
  const seen = new Set<string>();
  for (const rg of wantedGroups) {
    const found = tsList.find(c => rg.test(c.group) && !seen.has(c.group));
    if (found) {
      seen.add(found.group);
      picks.push({ name: found.name, group: found.group, ts: found.url, hls: hlsByName.get(`${found.group}||${found.name}`) });
    }
  }

  let ok = 0, total = 0;
  for (const c of picks) {
    total++;
    const r = await probePlayable(c.ts);
    if (r.ok) ok++;
    console.log(`[TS ] [${r.ok ? 'OK' : 'FAIL'}] "${c.name.slice(0, 44)}" (${c.group}) @ ${maskStreamUrl(c.ts)} -> ${r.why}`);
    if (c.hls) {
      total++;
      const r2 = await probePlayable(c.hls);
      if (r2.ok) ok++;
      console.log(`[HLS] [${r2.ok ? 'OK' : 'FAIL'}] same channel @ ${maskStreamUrl(c.hls)} -> ${r2.why}`);
    }
    await sleep(1200);
  }

  // retry one previously failing channel once (Supersport PSL)
  const retry = tsList.find(c => /Supersport PSL/i.test(c.name));
  if (retry) {
    total++;
    const r = await probePlayable(retry.url);
    if (r.ok) ok++;
    console.log(`[TS-retry] [${r.ok ? 'OK' : 'FAIL'}] "${retry.name.slice(0, 44)}" (${retry.group}) @ ${maskStreamUrl(retry.url)} -> ${r.why}`);
  }

  console.log(`RETRY SAMPLE: ${ok}/${total} playable`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
