/**
 * test-stream-limit-focused.ts — patient provider one-stream limit test.
 * Holds ONE active multi-segment session on the member's line for 50s and
 * attempts a 2nd concurrent stream at t=10s / 25s / 40s. Uses the existing
 * pilot1 test member (admin resets its password first). Provider-side limit,
 * max_connections=1 per line.
 */
const BASE = 'http://localhost:3000/api';
const UA = 'AetherStream-PrivatePilot/1.0';

async function jf(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  return { status: res.status, body: await res.json().catch(() => null) };
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
  } finally { try { await reader.cancel(); } catch { /* */ } }
  const merged = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return merged;
}

function resolveVariant(mText: string, base: string): string | null {
  if (mText.includes('#EXT-X-STREAM-INF')) {
    const rel = mText.split(/\r?\n/).find(l => l && !l.startsWith('#'));
    return rel ? new URL(rel.trim(), base).toString() : null;
  }
  return base;
}

async function attemptOnce(streamUrl: string): Promise<string> {
  const dec = new TextDecoder('utf-8', { fatal: false });
  try {
    const m = await fetch(streamUrl, { headers: { 'User-Agent': UA } });
    if (!(m.ok || m.status === 206)) return `manifest HTTP ${m.status}`;
    const mText = dec.decode(await readHead(m, 16384));
    const variant = resolveVariant(mText, m.url || streamUrl);
    if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
    if (!variant) return 'manifest no-variant';
    const v = await fetch(variant, { headers: { 'User-Agent': UA } });
    if (!(v.ok || v.status === 206)) return `variant HTTP ${v.status}`;
    const vText = dec.decode(await readHead(v, 16384));
    const seg = vText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))[0];
    if (v.body) { try { await v.body.cancel(); } catch { /* */ } }
    if (!seg) return 'variant no-segment';
    const s = await fetch(new URL(seg, v.url || variant).toString(), { headers: { 'User-Agent': UA } });
    if (s.body) { try { await s.body.cancel(); } catch { /* */ } }
    return `segment HTTP ${s.status}`;
  } catch (e) {
    return e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error';
  }
}

async function main() {
  const admin = await jf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@aetherstream.tv', password: 'admin123' }) });
  const prefix = process.env.PILOT_PREFIX || 'pilot1';
  const members = (await jf('/admin/members', {}, admin.body.token)).body.members.filter((m: any) => m.email?.startsWith(prefix + '.'));
  const m1 = members[members.length - 1];
  await jf(`/admin/members/${m1.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: 'Limit-Test-1' }) }, admin.body.token);
  const login = await jf('/auth/login', { method: 'POST', body: JSON.stringify({ email: m1.email, password: 'Limit-Test-1' }) });
  const chans = (await jf('/content/channels', {}, login.body.token)).body.channels
    .filter((c: any) => c.sourceName?.startsWith('Family Full-Catalog'));
  console.log(`member=${m1.email}, line channels=${chans.length}`);

  const c1 = chans[chans.length - 3];
  const c2 = chans[chans.length - 2];
  const c3 = chans[chans.length - 1];
  console.log(`stream1="${c1.channelName}" | probe channels: "${c2.channelName}", "${c3.channelName}"`);

  // hold session
  let holding = true;
  let segs = 0;
  const hold = (async () => {
    const dec = new TextDecoder('utf-8', { fatal: false });
    const m = await fetch(c1.streamUrl, { headers: { 'User-Agent': UA } });
    if (!m.ok) { holding = false; return; }
    const mText = dec.decode(await readHead(m, 16384));
    const variant = resolveVariant(mText, m.url || c1.streamUrl);
    if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
    if (!variant) { holding = false; return; }
    const deadline = Date.now() + 55000;
    while (Date.now() < deadline && holding) {
      const v = await fetch(variant, { headers: { 'User-Agent': UA } });
      if (!v.ok) break;
      const vText = dec.decode(await readHead(v, 16384));
      if (v.body) { try { await v.body.cancel(); } catch { /* */ } }
      const segList = vText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (!segList.length) break;
      const s = await fetch(new URL(segList[segs % segList.length], v.url || variant).toString(), { headers: { 'User-Agent': UA } });
      if (!s.ok || !s.body) break;
      const reader = s.body.getReader();
      const sd = Date.now() + 1100;
      try { while (Date.now() < sd) { const { done } = await reader.read(); if (done) break; } } catch { /* */ }
      try { await reader.cancel(); } catch { /* */ }
      segs++;
    }
  })();

  const attempts: string[] = [];
  await new Promise(r => setTimeout(r, 10000));
  attempts.push(await attemptOnce(c2.streamUrl));
  await new Promise(r => setTimeout(r, 15000));
  attempts.push(await attemptOnce(c3.streamUrl));
  await new Promise(r => setTimeout(r, 15000));
  attempts.push(await attemptOnce(c2.streamUrl));
  await hold;

  console.log(`stream1 session: ${segs} segments downloaded (active ${holding ? 'until end' : 'interrupted'})`);
  attempts.forEach((a, i) => console.log(`stream2 attempt ${i + 1} (t=${10 + i * 15}s): ${a}`));
  const blocked = attempts.some(a => /HTTP 403|HTTP 429|timeout|HTTP -1/.test(a));
  console.log(`\nVERDICT: provider one-stream limit ${blocked ? 'ENFORCED (second stream refused)' : 'NOT refused at probe level (both streams served)'}`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
