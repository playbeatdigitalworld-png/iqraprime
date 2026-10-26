/**
 * diag-line-recovery.ts — after a 4-minute cool-down, make ONE baseline stream
 * attempt to confirm the provider line's single-connection slot is released
 * again (i.e., the earlier 403s were connection-limit enforcement, not a lock).
 * Then stop. No further requests to the provider.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000/api';

async function getSegment(streamUrl: string): Promise<string> {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(streamUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' }, signal: ctrl.signal });
    let head = '';
    if (r.body) { const rd = r.body.getReader(); const { value } = await rd.read(); if (value) head = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
    if (!head.includes('#EXTM3U')) return '';
    if (head.includes('#EXT-X-STREAM-INF')) {
      const rel = head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      if (!rel) return '';
      const v = await fetch(new URL(rel.trim(), r.url || streamUrl).toString(), { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' }, signal: ctrl.signal });
      let vh = ''; if (v.body) { const rd = v.body.getReader(); const { value } = await rd.read(); if (value) vh = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
      if (!vh.includes('#EXTM3U')) return '';
      const segL = vh.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      return segL ? new URL(segL.trim(), v.url || streamUrl).toString() : '';
    }
    const segL = head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
    return segL ? new URL(segL.trim(), r.url || streamUrl).toString() : '';
  } finally { clearTimeout(to); }
}

async function main() {
  const chans = await (await fetch(`${BASE}/content/channels`)).json();
  const vault = chans.channels.filter((c: any) => c.country === 'Star IPTV Authorized Line');
  let seg = '';
  for (const c of vault) {
    try { seg = await getSegment(c.streamUrl); if (seg) { console.log(`channel: "${String(c.channelName).slice(0, 30)}"`); break; } } catch { /* next */ }
  }
  if (!seg) { console.log('no segment resolved'); process.exit(0); }
  console.log('cool-down 240s...'); await new Promise((r) => setTimeout(r, 240000));
  const res = await fetch(seg, { headers: { 'User-Agent': 'StreamPlay-Test/1.0' } });
  const rd = res.body?.getReader();
  let bytes = 0;
  if (rd) { const t0 = Date.now(); while (Date.now() - t0 < 6000) { const { value, done } = await rd.read(); if (done) break; bytes += value.length; } try { await rd.cancel(); } catch {} }
  console.log(`recovery check: HTTP ${res.status}, ${bytes} B in 6s -> ${res.status === 200 && bytes > 50000 ? 'LINE RECOVERED (slot released, streams work again)' : 'still busy/limited'}`);
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
