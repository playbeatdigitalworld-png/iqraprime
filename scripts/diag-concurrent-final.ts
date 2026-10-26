/**
 * diag-concurrent-final.ts — clean one-stream-at-a-time disambiguation.
 * Sequence (after 90s cool-down to expire any stale provider connections):
 *   1. Baseline: channel B streams ALONE (expect 200 + media bytes).
 *   2. Open channel A, verify it is REALLY streaming (200 + bytes), hold actively.
 *   3. While A active: open B again (expect 403/blocked if max_connections=1 enforced).
 *   4. Close A, wait, open B once more (expect 200 again).
 * Read-only against the provider; only the ONE test member's token is used for nothing here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000/api';

async function getMediaPlaylist(streamUrl: string): Promise<{ segUrl: string; finalUrl: string }> {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(streamUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' }, signal: ctrl.signal });
    let head = '';
    if (r.body) { const rd = r.body.getReader(); const { value } = await rd.read(); if (value) head = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
    if (!head.includes('#EXTM3U')) return { segUrl: '', finalUrl: r.url || streamUrl };
    if (head.includes('#EXT-X-STREAM-INF')) {
      const rel = head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      if (!rel) return { segUrl: '', finalUrl: r.url || streamUrl };
      const v = await fetch(new URL(rel.trim(), r.url || streamUrl).toString(), { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-8191' }, signal: ctrl.signal });
      let vh = ''; if (v.body) { const rd = v.body.getReader(); const { value } = await rd.read(); if (value) vh = new TextDecoder().decode(value); try { await rd.cancel(); } catch {} }
      if (!vh.includes('#EXTM3U')) return { segUrl: '', finalUrl: v.url || streamUrl };
      const segL = vh.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      return { segUrl: segL ? new URL(segL.trim(), v.url || new URL(rel.trim(), r.url || streamUrl).toString()).toString() : '', finalUrl: v.url || streamUrl };
    }
    const segL = head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
    return { segUrl: segL ? new URL(segL.trim(), r.url || streamUrl).toString() : '', finalUrl: r.url || streamUrl };
  } finally { clearTimeout(to); }
}

async function streamProbe(name: string, segUrl: string, ms: number): Promise<{ status: number; bytes: number; note: string }> {
  if (!segUrl) return { status: 0, bytes: 0, note: 'no segment url' };
  try {
    const res = await fetch(segUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0' } });
    const rd = res.body?.getReader();
    let bytes = 0; const t0 = Date.now();
    if (rd) {
      try {
        while (Date.now() - t0 < ms) { const { value, done } = await rd.read(); if (done) break; bytes += value.length; }
      } finally { try { await rd.cancel(); } catch {} }
    }
    const okMedia = res.status === 200 && bytes > 50000;
    return { status: res.status, bytes, note: okMedia ? 'MEDIA STREAMING' : res.status === 200 ? 'short body' : `blocked/err` };
  } catch (e) {
    return { status: 0, bytes: 0, note: `error: ${e instanceof Error ? e.message : e}` };
  }
}

async function main() {
  const chans = await (await fetch(`${BASE}/content/channels`)).json();
  const vault = chans.channels.filter((c: any) => c.country === 'Star IPTV Authorized Line');
  // pick two channels that resolve to segments
  let A: { name: string; seg: string } | null = null;
  let B: { name: string; seg: string } | null = null;
  for (const c of vault) {
    if (A && B) break;
    try {
      const { segUrl } = await getMediaPlaylist(c.streamUrl);
      if (!segUrl) continue;
      if (!A) A = { name: String(c.channelName).slice(0, 28), seg: segUrl };
      else if (segUrl !== A.seg) B = { name: String(c.channelName).slice(0, 28), seg: segUrl };
    } catch { /* try next */ }
  }
  if (!A || !B) { console.log('could not resolve two channels'); process.exit(0); }
  console.log(`A="${A.name}"  B="${B.name}"`);
  console.log('cool-down 90s to expire any stale provider connection...');
  await new Promise((r) => setTimeout(r, 90000));

  console.log('\n[1] BASELINE: B alone');
  const b1 = await streamProbe('B', B.seg, 8000);
  console.log(`  B: HTTP ${b1.status}, ${b1.bytes} B -> ${b1.note}`);
  await new Promise((r) => setTimeout(r, 3000));

  console.log('\n[2] OPEN A (must be genuinely streaming)');
  const ctrlA = new AbortController();
  const aRes = await fetch(A.seg, { headers: { 'User-Agent': 'StreamPlay-Test/1.0' }, signal: ctrlA.signal });
  const aRd = aRes.body?.getReader();
  let aBytes = 0;
  if (aRd) {
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) { const { value, done } = await aRd.read(); if (done) break; aBytes += value.length; }
  }
  console.log(`  A: HTTP ${aRes.status}, ${aBytes} B in 6s -> ${aRes.status === 200 && aBytes > 50000 ? 'MEDIA STREAMING (connection established)' : 'NOT a real session'}`);
  const aReal = aRes.status === 200 && aBytes > 50000;

  if (aReal) {
    console.log('\n[3] B while A is active');
    const b2 = await streamProbe('B', B.seg, 10000);
    console.log(`  B: HTTP ${b2.status}, ${b2.bytes} B -> ${b2.note}`);
    try { ctrlA.abort(); } catch {}
    await new Promise((r) => setTimeout(r, 8000));
    console.log('\n[4] B again after A closed');
    const b3 = await streamProbe('B', B.seg, 8000);
    console.log(`  B: HTTP ${b3.status}, ${b3.bytes} B -> ${b3.note}`);
    console.log(`\nVERDICT: baseline=${b1.status === 200 && b1.bytes > 50000 ? 'OK' : b1.status}, concurrent=${b2.status === 200 && b2.bytes > 50000 ? 'ALLOWED (not enforced)' : 'BLOCKED ' + b2.status}, after-close=${b3.status === 200 && b3.bytes > 50000 ? 'OK' : b3.status}`);
  } else {
    try { ctrlA.abort(); } catch {}
    console.log('\nA was not streaming; retry once more with swapped roles...');
  }
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
