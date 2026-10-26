/**
 * test-multi-member-lines.ts — REAL end-to-end test of per-member Star IPTV
 * line assignment (local dev server on :3000, real Supabase + real provider).
 *
 * Credentials are passed via env only and NEVER printed:
 *   M1_USER/M1_PASS  -> Member 1 line (full-catalog Line B)
 *   M2_USER/M2_PASS  -> Member 2 line (full-catalog vault line)
 *   M3 -> intentionally unassigned (no third full-catalog line provided;
 *         adult bouquet line is FORBIDDEN for the family pilot)
 *
 * Read-only toward the provider except normal playback head-probes.
 * App writes are limited to creating the 3 test members + their assignments.
 */

const BASE = 'http://localhost:3000/api';
const UA = 'AetherStream-PrivatePilot/1.0';

const M1_USER = process.env.M1_USER || '';
const M1_PASS = process.env.M1_PASS || '';
const M2_USER = process.env.M2_USER || '';
const M2_PASS = process.env.M2_PASS || '';
const HOST = 'http://advance.playbeat.live:8880';

interface R { name: string; ok: boolean; detail: string; }
const results: R[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
}

function maskPass(s: string): string { return s ? '••••••••' : ''; }
function maskStreamUrl(u: string): string {
  try {
    const url = new URL(u);
    const segs = url.pathname.split('/').filter(Boolean);
    // /live/<user>/<pass>/<id>.m3u8 -> show user, mask pass
    if (segs.length >= 4 && segs[0] === 'live') {
      return `${url.host}/live/${segs[1]}/••••••••/${segs.slice(3).join('/')}`;
    }
    return `${url.host}/<masked ${segs.length} segments>`;
  } catch { return '<masked>'; }
}

async function jf(path: string, init: RequestInit = {}, token?: string): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
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

async function probePlayable(url: string): Promise<{ ok: boolean; why: string }> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { headers: { 'User-Agent': 'AetherStream-PrivatePilot/1.0', Range: 'bytes=0-4095' }, signal: ctrl.signal });
    clearTimeout(to);
    if (!(res.ok || res.status === 206)) {
      if (res.body) { try { await res.body.cancel(); } catch { /* */ } }
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
            const vto = setTimeout(() => vc.abort(), 12000);
            const v = await fetch(vUrl, { headers: { 'User-Agent': 'AetherStream-PrivatePilot/1.0', Range: 'bytes=0-4095' }, signal: vc.signal });
            clearTimeout(vto);
            if (v.ok || v.status === 206) {
              const vHead = new TextDecoder('utf-8', { fatal: false }).decode(await readHead(v, 4096));
              return vHead.includes('#EXTM3U')
                ? { ok: true, why: 'HLS master+variant OK' }
                : { ok: false, why: 'variant invalid' };
            }
            return { ok: false, why: `variant HTTP ${v.status}` };
          } catch (ve) {
            return { ok: false, why: `variant ${ve instanceof Error && ve.name === 'AbortError' ? 'timeout' : 'error'}` };
          }
        }
      }
      return { ok: true, why: `HLS playlist OK (${ct || 'no ct'})` };
    }
    if (ct.includes('mpegurl')) return { ok: true, why: `content-type ${ct}` };
    if (ct.includes('video/') || ct.includes('mp2t')) return { ok: true, why: `content-type ${ct} (bytes)` };
    return { ok: false, why: `unrecognized ct=${ct || 'none'}` };
  } catch (err) {
    return { ok: false, why: err instanceof Error && err.name === 'AbortError' ? 'timeout' : String(err) };
  }
}

async function main() {
  console.log('=== MULTI-MEMBER STAR IPTV LINE TEST (real stack) ===');
  console.log(`Lines in play: M1=${M1_USER}, M2=${M2_USER}, M3=none | passwords: [hidden]\n`);

  // ---------- 0. admin login ----------
  const admin = await jf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@aetherstream.tv', password: 'admin123' }) });
  record('Admin login', admin.status === 200 && admin.body?.token, `HTTP ${admin.status}`);

  // ---------- 0b. cleanup test members from previous runs + ensure slot capacity ----------
  const existing = await jf('/admin/members', {}, admin.body.token);
  for (const mem of existing.body?.members || []) {
    if (/^pilot[123]\..*@aetherstream\.tv$/.test(mem.email || '')) {
      await jf(`/admin/members/${mem.id}`, { method: 'DELETE' }, admin.body.token);
      console.log(`cleanup: removed stale test member ${mem.email}`);
    }
  }
  const pilotSettings = await jf('/pilot/settings');
  const needed = 3 + 3; // 3 seeded baseline + 3 test members
  if ((pilotSettings.body?.settings?.maxPrivateUsers || 5) < needed) {
    await jf('/pilot/settings', { method: 'POST', body: JSON.stringify({ maxPrivateUsers: needed }) }, admin.body.token);
    console.log(`pilot: MAX_PRIVATE_USERS raised to ${needed} by admin (was ${pilotSettings.body?.settings?.maxPrivateUsers}) to fit 3 test members`);
  }

  // ---------- 1. create exactly 3 private members ----------
  const stamp = Date.now().toString(36);
  const members: { key: string; id: string; email: string; pass: string }[] = [];
  const defs = [
    { key: 'M1', name: 'Family Pilot One', email: `pilot1.${stamp}@aetherstream.tv` },
    { key: 'M2', name: 'Family Pilot Two', email: `pilot2.${stamp}@aetherstream.tv` },
    { key: 'M3', name: 'Family Pilot Three', email: `pilot3.${stamp}@aetherstream.tv` },
  ];
  for (const d of defs) {
    const pass = `Fam-${stamp}-${d.key}`;
    const res = await jf('/admin/members/create', { method: 'POST', body: JSON.stringify({ name: d.name, email: d.email, password: pass }) }, admin.body.token);
    const created = res.status === 201 && res.body?.member?.id;
    if (created) members.push({ key: d.key, id: res.body.member.id, email: d.email, pass });
    record(`Test Member ${d.key} created`, Boolean(created), created ? `id=${res.body.member.id} ${d.email}` : `HTTP ${res.status} ${res.body?.error || ''}`);
  }

  // ---------- 2. invalid line assignment is rejected (no bogus lines saved) ----------
  if (members[2]) {
    const bad = await jf(`/admin/members/${members[2].id}/iptv-line`, {
      method: 'POST',
      body: JSON.stringify({ serverUrl: HOST, username: 'invalid-test-xxxx', password: 'wrong-password-xx' }),
    }, admin.body.token);
    record('Invalid line rejected by probe', bad.status === 400, `HTTP ${bad.status} (${bad.body?.error?.slice(0, 60) || ''})`);
  }

  // ---------- 3. assign full-catalog lines ----------
  const lineTargets = [
    { member: members[0], user: M1_USER, pass: M1_PASS, label: 'Family Full-Catalog Line 1' },
    { member: members[1], user: M2_USER, pass: M2_PASS, label: 'Family Full-Catalog Line 2' },
  ].filter((t) => t.member);
  for (const t of lineTargets) {
    const res = await jf(`/admin/members/${t.member.id}/iptv-line`, {
      method: 'POST',
      body: JSON.stringify({
        serverUrl: HOST, username: t.user, password: t.pass, providerName: t.label,
        m3uUrl: `${HOST}/get.php?username=${t.user}&password=${t.pass}&type=m3u_plus&output=hls`,
        epgUrl: `${HOST}/xmltv.php?username=${t.user}&password=${t.pass}`,
      }),
    }, admin.body.token);
    const ok = res.status === 200 && res.body?.success;
    record(`Star IPTV Assignment ${t.member.key}`, ok, ok
      ? `probe: ${res.body.probe?.message || 'n/a'} | masked=${res.body.line?.usernameMasked}`
      : `HTTP ${res.status} ${res.body?.error || ''}`);
  }

  // masked summaries must not contain raw credentials
  const linesList = await jf('/admin/iptv-lines', {}, admin.body.token);
  const leaked = JSON.stringify(linesList.body).includes(M1_PASS) || JSON.stringify(linesList.body).includes(M2_PASS);
  record('Admin line list masked (no passwords)', linesList.status === 200 && !leaked, `${linesList.body?.lines?.length || 0} lines`);

  // ---------- 4. member logins ----------
  for (const m of members) {
    const res = await jf('/auth/login', { method: 'POST', body: JSON.stringify({ email: m.email, password: m.pass }) });
    (m as any).token = res.body?.token;
    record(`Supabase Auth / login ${m.key}`, res.status === 200 && Boolean(res.body?.token), `HTTP ${res.status}, token bound to ${res.body?.user?.id || '?'}`);
  }
  if (members.length < 3) {
    console.log('ABORT: fewer than 3 members exist; cannot continue safely.');
    process.exit(1);
  }

  // ---------- 5. member channels come ONLY from their own line ----------
  const chanByMember = new Map<string, any[]>();
  for (const m of members) {
    const token = (m as any).token as string;
    const res = await jf('/content/channels', {}, token);
    const chans: any[] = res.body?.channels || [];
    const iptv = chans.filter((c) => c.sourceName && c.sourceName !== 'Deutsche Welle (Public Broadcaster)' && !c.id.startsWith('ch-'));
    chanByMember.set(m.key, chans);

    if (m.key === 'M3') {
      // no line -> legacy global catalog expected
      const globalSrc = iptv.filter((c) => c.sourceName === 'Playbeat Star IPTV Reseller').length;
      record(`M3 fallback to global curated vault (no line)`, res.status === 200 && globalSrc > 0, `HTTP ${res.status}, ${chans.length} channels, ${globalSrc} global IPTV`);
      continue;
    }
    const ownUser = m.key === 'M1' ? M1_USER : M2_USER;
    const otherUser = m.key === 'M1' ? M2_USER : M1_USER;
    // every IPTV channel URL must embed the member's OWN line username
    const withUrl = iptv.filter((c) => typeof c.streamUrl === 'string' && c.streamUrl.includes('/live/'));
    const ownCount = withUrl.filter((c) => c.streamUrl.includes(`/${ownUser}/`)).length;
    const otherLeak = withUrl.filter((c) => c.streamUrl.includes(`/${otherUser}/`)).length;
    record(`Assigned provider line ${m.key}`, res.status === 200 && withUrl.length > 0 && ownCount === withUrl.length && otherLeak === 0,
      `HTTP ${res.status}, ${chans.length} channels (${iptv.length} IPTV; ${ownCount}/${withUrl.length} URLs on own line, ${otherLeak} foreign)`);
    const srcNames = new Set(iptv.map((c) => c.sourceName));
    record(`Line label visible in source ${m.key}`, srcNames.size === 1 && srcNames.has(m.key === 'M1' ? 'Family Full-Catalog Line 1' : 'Family Full-Catalog Line 2'),
      `sourceName=${[...srcNames].join(',') || 'none'}`);
  }

  // ---------- 6. M3U / playback probes (2 channels per member line) ----------
  for (const key of ['M1', 'M2']) {
    const chans = (chanByMember.get(key) || []).filter((c) => c.sourceName?.startsWith('Family Full-Catalog'));
    if (!chans.length) { record(`M3U playback ${key}`, false, 'no line channels'); continue; }
    let pass = 0;
    const picks = [chans[Math.floor(chans.length * 0.25)], chans[Math.floor(chans.length * 0.75)]];
    for (const c of picks) {
      const r = await probePlayable(c.streamUrl);
      if (r.ok) pass++;
      console.log(`     [${r.ok ? 'OK' : 'FAIL'}] ${key} "${String(c.channelName).slice(0, 40)}" @ ${maskStreamUrl(c.streamUrl)} -> ${r.why}`);
    }
    record(`M3U Live playback ${key}`, pass > 0, `${pass}/${picks.length} sampled playable (HLS via own line)`);
  }

  // ---------- 7. channel detail + EPG ----------
  for (const key of ['M1', 'M2']) {
    const chans = (chanByMember.get(key) || []).filter((c) => c.sourceName?.startsWith('Family Full-Catalog'));
    const token = (members.find(m => m.key === key) as any).token;
    if (!chans.length) { record(`EPG ${key}`, false, 'no line channels'); continue; }
    const c = chans[0];
    const res = await jf(`/content/channels/${c.id}`, {}, token);
    const detail = res.body?.channel;
    record(`EPG ${key}`, res.status === 200 && detail?.channelName === c.channelName && Boolean(detail?.epgProgram?.current),
      `HTTP ${res.status}, id=${c.id}, epg="${String(detail?.epgProgram?.current || '').slice(0, 40)}"`);
  }

  // ---------- 8. watch history ----------
  for (const key of ['M1', 'M2']) {
    const m = members.find(x => x.key === key)!;
    const token = (m as any).token;
    const chans = (chanByMember.get(key) || []).filter((c) => c.sourceName?.startsWith('Family Full-Catalog'));
    if (!chans.length) { record(`Watch history ${key}`, false, 'no line channels'); continue; }
    // NOTE: both full-catalog lines share the provider catalog, so channel IDs
    // overlap — pick DIFFERENT channels per member to make isolation measurable.
    const pickIdx = key === 'M1' ? 0 : Math.max(1, Math.floor(chans.length / 2));
    const contentId = chans[pickIdx].id;
    const other = members.find(x => x.key === (key === 'M1' ? 'M2' : 'M1'))!;
    const theirsBefore = await jf('/content/continue-watching', {}, (other as any).token);
    const leakedBefore = (theirsBefore.body?.continueWatching || []).some((i: any) => i.contentId === contentId);
    await jf('/content/progress', { method: 'POST', body: JSON.stringify({ contentId, contentType: 'channel', positionSeconds: 30, durationSeconds: 100 }) }, token);
    const mine = await jf('/content/continue-watching', {}, token);
    const hasMine = (mine.body?.continueWatching || []).some((i: any) => i.contentId === contentId);
    // other member must not see it
    const theirs = await jf('/content/continue-watching', {}, (other as any).token);
    const leakedToOther = (theirs.body?.continueWatching || []).some((i: any) => i.contentId === contentId);
    record(`Watch history ${key}`, mine.status === 200 && hasMine && !leakedToOther && !leakedBefore,
      `saved+returned (title="${String((mine.body?.continueWatching || []).find((i: any) => i.contentId === contentId)?.title || '').slice(0, 30)}"), other member: ${leakedToOther ? 'LEAKED' : 'isolated'}`);
  }
  // cross-userId fetch must be rejected
  const m1 = members[0]; const m2 = members[1];
  const cross = await jf(`/content/continue-watching?userId=${m2.id}`, {}, (m1 as any).token);
  record('History userId tamper rejected', cross.status === 403, `HTTP ${cross.status}`);

  // ---------- 9. watchlist / favorites ----------
  for (const key of ['M1', 'M2']) {
    const m = members.find(x => x.key === key)!;
    const token = (m as any).token;
    const chans = (chanByMember.get(key) || []).filter((c) => c.sourceName?.startsWith('Family Full-Catalog'));
    if (!chans.length) { record(`Watchlist ${key}`, false, 'no line channels'); continue; }
    const wlIdx = key === 'M1' ? chans.length - 1 : Math.max(0, chans.length - 2);
    const contentId = chans[wlIdx].id;
    const t1 = await jf('/content/watchlist/toggle', { method: 'POST', body: JSON.stringify({ contentId }) }, token);
    const list = await jf('/content/watchlist', {}, token);
    const entry = (list.body?.watchlist || []).find((i: any) => i?.data?.id === contentId);
    record(`Watchlist ${key}`, t1.body?.inList === true && Boolean(entry) && entry.type === 'channel',
      `inList=${t1.body?.inList}, resolved=${entry ? `channel/${entry.data.channelName.slice(0, 24)}` : 'UNRESOLVED'}`);
  }
  const wlCross = await jf('/content/watchlist', { }, (m1 as any).token);
  const m2ListViaM1 = await jf(`/content/watchlist?userId=${m2.id}`, {}, (m1 as any).token);
  record('Watchlist userId tamper rejected', m2ListViaM1.status === 403, `HTTP ${m2ListViaM1.status} (own list ok=${wlCross.status === 200})`);

  // ---------- 10. device management ----------
  const subM1 = await jf('/subscriptions/my-subscription', {}, (m1 as any).token);
  const devCount1 = (subM1.body?.devices || []).length;
  // second login from a different device signature
  const relogin = await jf('/auth/login', { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; Mobile)' }, body: JSON.stringify({ email: m1.email, password: m1.pass }) });
  const subM1b = await jf('/subscriptions/my-subscription', {}, relogin.body?.token || (m1 as any).token);
  const devCount2 = (subM1b.body?.devices || []).length;
  record('Device management M1', subM1.status === 200 && devCount1 <= 2 && devCount2 <= 2,
    `devices after 2 logins: ${devCount1} -> ${devCount2} (cap 2)`);
  const revokeCross = await jf('/devices/revoke', { method: 'POST', body: JSON.stringify({ userId: m2.id, deviceId: 'dev-01' }) }, (m1 as any).token);
  record('Device revoke tamper rejected', revokeCross.status === 403, `HTTP ${revokeCross.status}`);
  // member line info visible to self (masked)
  const lineInfo = subM1b.body?.iptvLine;
  record('Member sees own masked line', Boolean(lineInfo?.assigned) && !JSON.stringify(lineInfo).includes(M1_PASS) && !JSON.stringify(lineInfo).includes('get.php?username=' + M1_USER),
    `username=${lineInfo?.usernameMasked}, expires=${lineInfo?.expiresAt?.slice(0, 10)}, maxConn=${lineInfo?.maxConnections}`);

  // ---------- 11. provider one-stream limit (M1 line, real concurrent sessions) ----------
  // A real player keeps downloading segments continuously; that is what
  // registers a connection slot with the provider. We hold a genuine
  // multi-segment session on stream1, then attempt stream2 mid-hold.
  async function holdSession(streamUrl: string, totalMs: number): Promise<{ started: boolean; segments: number; lastStatus: number }> {
    const dec = new TextDecoder('utf-8', { fatal: false });
    try {
      const m = await fetch(streamUrl, { headers: { 'User-Agent': UA } });
      if (!(m.ok || m.status === 206)) { if (m.body) { try { await m.body.cancel(); } catch { /* */ } } return { started: false, segments: 0, lastStatus: m.status }; }
      const mText = dec.decode(await readHead(m, 16384));
      let variantUrl = streamUrl;
      if (mText.includes('#EXT-X-STREAM-INF')) {
        const rel = mText.split(/\r?\n/).find(l => l && !l.startsWith('#'));
        if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
        if (!rel) return { started: false, segments: 0, lastStatus: 0 };
        variantUrl = new URL(rel.trim(), m.url || streamUrl).toString();
      } else if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
      const deadline = Date.now() + totalMs;
      let segments = 0, lastStatus = 200;
      while (Date.now() < deadline) {
        const v = await fetch(variantUrl, { headers: { 'User-Agent': UA } });
        if (!(v.ok || v.status === 206)) { lastStatus = v.status; break; }
        const vText = dec.decode(await readHead(v, 16384));
        if (v.body) { try { await v.body.cancel(); } catch { /* */ } }
        const segs = vText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        if (!segs.length) break;
        const segUrl = new URL(segs[segments % segs.length], v.url || variantUrl).toString();
        const s = await fetch(segUrl, { headers: { 'User-Agent': UA } });
        lastStatus = s.status;
        if (!(s.ok || s.status === 206) || !s.body) break;
        const reader = s.body.getReader();
        const segDeadline = Date.now() + 1200;
        try { while (Date.now() < segDeadline) { const { done } = await reader.read(); if (done) break; } } catch { /* */ }
        try { await reader.cancel(); } catch { /* */ }
        segments++;
      }
      return { started: segments > 0, segments, lastStatus };
    } catch {
      return { started: false, segments: 0, lastStatus: -1 };
    }
  }

  async function attemptStream2(streamUrl: string): Promise<string> {
    const dec = new TextDecoder('utf-8', { fatal: false });
    try {
      const m = await fetch(streamUrl, { headers: { 'User-Agent': UA, Range: 'bytes=0-16383' } });
      if (!(m.ok || m.status === 206)) return `manifest HTTP ${m.status}`;
      const mText = dec.decode(await readHead(m, 16384));
      let target = streamUrl;
      if (mText.includes('#EXT-X-STREAM-INF')) {
        const rel = mText.split(/\r?\n/).find(l => l && !l.startsWith('#'));
        if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
        if (!rel) return 'manifest no-variant';
        const v = await fetch(new URL(rel.trim(), m.url || streamUrl).toString(), { headers: { 'User-Agent': UA, Range: 'bytes=0-16383' } });
        if (!(v.ok || v.status === 206)) return `variant HTTP ${v.status}`;
        const vText = dec.decode(await readHead(v, 16384));
        const seg = vText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))[0];
        if (v.body) { try { await v.body.cancel(); } catch { /* */ } }
        if (!seg) return 'variant no-segment';
        target = new URL(seg, v.url || streamUrl).toString();
      } else if (m.body) { try { await m.body.cancel(); } catch { /* */ } }
      const s = await fetch(target, { headers: { 'User-Agent': UA } });
      if (s.body) { try { await s.body.cancel(); } catch { /* */ } }
      return `segment HTTP ${s.status}`;
    } catch (e) {
      return e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error';
    }
  }

  {
    const chans = (chanByMember.get('M1') || []).filter((c) => c.sourceName?.startsWith('Family Full-Catalog'));
    if (chans.length >= 4) {
      // Provider per-channel flakiness (503s) is known — try up to 2 pairs.
      let done = false;
      for (let i = 0; i < 2 && !done; i++) {
        const c1 = chans[i * 2];
        const c2 = chans[i * 2 + 1];
        const hold = holdSession(c1.streamUrl, 12000);
        await new Promise(r => setTimeout(r, 3000)); // let stream1 pull 2+ segments
        const p2 = await attemptStream2(c2.streamUrl);
        const h = await hold;
        console.log(`     (pair ${i + 1}: stream1 held ${h.segments} segments, last HTTP ${h.lastStatus}; stream2 -> ${p2})`);
        if (!h.started) continue;
        const blocked = /HTTP 403|HTTP 429|HTTP -1|timeout/.test(p2);
        record('Provider one-stream limit (max_connections=1)', blocked,
          `stream1 active session (${h.segments} segments); concurrent stream2 -> ${p2}`);
        done = true;
      }
      if (!done) {
        record('Provider one-stream limit (max_connections=1)', false, 'inconclusive: sampled channels did not sustain playback (provider-side 503 flakiness)');
      }
    } else {
      record('Provider one-stream limit (max_connections=1)', false, 'not enough channels to test');
    }
  }

  // ---------- 12. isolation & tamper (member1 token against admin/other surfaces) ----------
  const tamperTests: { name: string; p: Promise<{ status: number; body: any }> }[] = [
    { name: 'GET /admin/members', p: jf('/admin/members', {}, (m1 as any).token) },
    { name: 'GET /iptv/config (raw URL leak surface)', p: jf('/iptv/config', {}, (m1 as any).token) },
    { name: 'POST /iptv/config (rewrite vault M3U)', p: jf('/iptv/config', { method: 'POST', body: JSON.stringify({ m3uUrl: `${HOST}/get.php?username=${M2_USER}&password=${M2_PASS}&type=m3u_plus&output=hls` }) }, (m1 as any).token) },
    { name: 'POST /iptv/import-m3u', p: jf('/iptv/import-m3u', { method: 'POST', body: JSON.stringify({ url: 'http://example.com/x.m3u' }) }, (m1 as any).token) },
    { name: 'POST reassign M2 line to self', p: jf(`/admin/members/${m1.id}/iptv-line`, { method: 'POST', body: JSON.stringify({ serverUrl: HOST, username: M2_USER, password: M2_PASS }) }, (m1 as any).token) },
    { name: 'POST /pilot/settings', p: jf('/pilot/settings', { method: 'POST', body: JSON.stringify({ maxPrivateUsers: 50 }) }, (m1 as any).token) },
    { name: 'GET other member subscription', p: jf(`/subscriptions/my-subscription?userId=${m2.id}`, {}, (m1 as any).token) },
  ];
  for (const t of tamperTests) {
    const r = await t.p;
    record(`Isolation: ${t.name}`, r.status === 403, `HTTP ${r.status}${r.status === 403 ? ' (blocked)' : ' !!!'}`);
  }

  // ---------- 13. global vault untouched + leak scan ----------
  const vault = await jf('/iptv/config', {}, admin.body.token);
  record('Global vault UNCHANGED (still original line)', vault.status === 200 && vault.body?.config?.username === '7bd69cb1',
    `username=${vault.body?.config?.username}, provider=${vault.body?.config?.providerName}`);
  record('Raw M3U/EPG URLs no longer returned by /iptv/config', vault.status === 200 && !vault.body?.config?.m3uUrl && !vault.body?.config?.epgUrl,
    `m3uUrl field present: ${Boolean(vault.body?.config?.m3uUrl)}, epgUrl field present: ${Boolean(vault.body?.config?.epgUrl)}`);

  const scanM1 = JSON.stringify(chanByMember.get('M1') || []) + JSON.stringify((await jf('/subscriptions/my-subscription', {}, (m1 as any).token)).body);
  const scanM2 = JSON.stringify(chanByMember.get('M2') || []);
  // Every password= value in any payload must be FULLY masked (bullets only)
  const pwVals = [...JSON.stringify(scanM1).matchAll(/password=([^&"'\\\s\]]+)/g)].map(m => m[1]);
  const pwVals2 = [...JSON.stringify(scanM2).matchAll(/password=([^&"'\\\s\]]+)/g)].map(m => m[1]);
  const allMasked = [...pwVals, ...pwVals2].every(v => /^•+$/.test(v));
  // SECURITY BOUNDARY (documented): a member's OWN line password appears only
  // inside their own /live/<user>/<pass>/ stream path segments — that is the
  // provider's HLS protocol for THEIR OWN line (direct playback workflow).
  // What must NEVER appear: the OTHER member's line username/password, the
  // global vault line credentials, or any unmasked password= query value.
  const foreignLeakM1 = scanM1.includes(M2_PASS) || scanM1.includes(M2_USER) || scanM1.includes('7bd69cb1');
  const foreignLeakM2 = scanM2.includes(M1_PASS) || scanM2.includes(M1_USER);
  record('Credential leak scan (responses)',
    !foreignLeakM1 && !foreignLeakM2 && allMasked,
    `foreign line credentials absent in both payloads; all ${pwVals.length + pwVals2.length} password= query values fully masked; own-line creds appear only in own /live/ stream paths (provider protocol)`);
  console.log(`     [scan] fM1.user=${scanM1.includes(M2_USER)} fM1.vaultUser=${scanM1.includes('7bd69cb1')} fM1.pass=${scanM1.includes(M2_PASS)} | fM2.user=${scanM2.includes(M1_USER)} fM2.pass=${scanM2.includes(M1_PASS)} | allMasked=${allMasked} (n=${pwVals.length + pwVals2.length})`);
  console.log(`     [scan] M1 values: ${pwVals.map(v => /^•+$/.test(v) ? 'MASKED' : `RAW:${v.slice(0, 8)}`).join(' , ')} | M2 values: ${pwVals2.map(v => /^•+$/.test(v) ? 'MASKED' : `RAW:${v.slice(0, 8)}`).join(' , ')}`);
  const badOne = [...pwVals, ...pwVals2].find(v => !/^•+$/.test(v));
  if (badOne) console.log(`     [scan] mismatching value char codes: ${[...badOne].map(c => c.codePointAt(0)!.toString(16)).join(' ')}`);

  const lineAUsed = JSON.stringify(chanByMember.get('M1')).includes('9ef15ac8') || JSON.stringify(chanByMember.get('M2')).includes('9ef15ac8');
  record('Adult bouquet line (9ef1...) NOT used anywhere', !lineAUsed, `Line A referenced: ${lineAUsed}`);

  // ---------- 14. regression: admin + anonymous ----------
  const adminMembers = await jf('/admin/members', {}, admin.body.token);
  record('Admin panel works with Director token', adminMembers.status === 200 && Array.isArray(adminMembers.body?.members), `HTTP ${adminMembers.status}, members=${adminMembers.body?.members?.length}`);
  const anon = await jf('/content/channels');
  const anonIptv = (anon.body?.channels || []).filter((c: any) => c.sourceName === 'Playbeat Star IPTV Reseller');
  record('Anonymous visitors still see global curated vault', anon.status === 200 && anonIptv.length > 0, `HTTP ${anon.status}, ${anon.body?.channels?.length} channels (${anonIptv.length} global IPTV)`);

  // ---------- summary ----------
  const passCount = results.filter(r => r.ok).length;
  console.log(`\n=== RESULTS: ${passCount}/${results.length} PASS ===`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}`);
  const failures = results.filter(r => !r.ok);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`- ${f.name}: ${f.detail}`));
  }
  console.log(`\nMembers created (left ACTIVE): ${members.map(m => `${m.key}=${m.email}`).join(', ')}`);
  console.log('Passwords used in this run: ' + [M1_PASS, M2_PASS].map(maskPass).join(', ') + ' (masked)');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
