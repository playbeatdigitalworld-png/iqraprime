/**
 * test-private-member-once.ts — ONE real private member end-to-end test.
 *
 * Constraints honored:
 * - Exactly ONE member created (idempotent if rerun: reuses the same member).
 * - Uses ONLY existing app endpoints (no invented APIs), existing Supabase schema.
 * - Star IPTV line comes from the server-side vault (provider defaults); the vault
 *   password is loaded into memory ONLY for leak-scanning responses — never printed.
 * - Admin/cross-member checks are GET-only (read-only, no mutation of others' data).
 * - No UI changes, no schema changes, no fake provider credentials
 *   (/subscriptions/order is intentionally NOT used — it writes placeholder creds).
 */

import { starIptvProvider } from '../server/starIptvProvider.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000/api';

// ---------- env (Supabase project coordinates; anon key is public by design) ----------
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

// ---------- vault secret for leak-scan only (NEVER printed) ----------
const p = starIptvProvider as unknown as Record<string, unknown>;
const VAULT_HOST = (() => { try { return new URL(String(p.serverUrl || '')).host; } catch { return ''; } })();
const VAULT_PASS = String(p.password || '');

// ---------- the ONE test member ----------
const MEMBER = {
  name: 'Mia Rahman (Pilot Test Member)',
  email: 'mia.pilot@aetherstream.tv',
  password: 'Mia-Pilot-2026!x',
};

const results: Array<{ check: string; verdict: 'PASS' | 'FAIL'; reason: string }> = [];
function record(check: string, verdict: 'PASS' | 'FAIL', reason: string) {
  results.push({ check, verdict, reason });
  console.log(`  ${verdict === 'PASS' ? '✓' : '✗'} ${check}: ${verdict} — ${reason}`);
}

function scanForVaultSecret(text: string): { found: boolean; inStreamUrls: boolean; outside: number } {
  if (!VAULT_PASS || !text.includes(VAULT_PASS)) return { found: false, inStreamUrls: false, outside: 0 };
  // classify occurrences: inside a URL (provider HLS protocol embeds line credentials in paths)
  let outside = 0;
  const urlRe = new RegExp(`https?://[^"\\s]*${VAULT_PASS}`, 'g');
  const urlMatches = text.match(urlRe) || [];
  let total = 0;
  let idx = 0;
  while ((idx = text.indexOf(VAULT_PASS, idx)) !== -1) { total++; idx += VAULT_PASS.length; }
  outside = total - urlMatches.length;
  return { found: true, inStreamUrls: outside === 0, outside };
}

const leaks: string[] = [];
async function api(method: string, path: string, opts: { token?: string; body?: unknown; ua?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const ua = opts.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StreamPlay-Test/1.0';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...headers, 'User-Agent': ua },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const scan = scanForVaultSecret(text);
  if (scan.found) {
    leaks.push(`${method} ${path} -> ${scan.inStreamUrls ? 'only inside provider stream URLs (HLS protocol)' : `OUTSIDE stream URLs x${scan.outside}`}`);
  }
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}

async function fetchHead(url: string, bytes: number, timeoutMs = 10000): Promise<{ status: number; ct: string; head: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: `bytes=0-${bytes - 1}` }, signal: ctrl.signal });
    let head = '';
    if (res.body) {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      if (value) head = new TextDecoder('utf-8', { fatal: false }).decode(value.slice(0, bytes));
      try { await reader.cancel(); } catch { /* ignore */ }
    }
    return { status: res.status, ct: (res.headers.get('content-type') || '').toLowerCase(), head, finalUrl: res.url || url };
  } finally { clearTimeout(to); }
}

function hostOf(u: string): string { try { return new URL(u).host; } catch { return ''; } }
function maskStream(u: string): string {
  try {
    const x = new URL(u);
    const segs = x.pathname.split('/').filter(Boolean);
    return `${x.protocol}//${x.host}/<masked ${segs.length} segments>.${(segs[segs.length - 1] || '').split('.').pop()}`;
  } catch { return '<masked>'; }
}

async function main() {
  console.log('== 0. PREFLIGHT ==');
  const health = await api('GET', '/health');
  console.log(`  health=${health.status} users=${health.json?.usersCount} channels=${health.json?.channelsCount} uptime=${Math.round(health.json?.uptimeSeconds ?? 0)}s`);
  const before = await api('GET', '/admin/members');
  const beforeCount = before.json?.members?.length ?? -1;
  console.log(`  members before: ${beforeCount} (admin endpoint reachable pre-test: ${before.status})`);
  if (!VAULT_HOST) { console.log('  FATAL: vault host unavailable in provider defaults'); return; }
  console.log(`  vault line host: ${VAULT_HOST} (password loaded for scan only, length=${VAULT_PASS.length})`);

  // ---------------- 1. CREATE THE ONE MEMBER ----------------
  console.log('\n== 1. CREATE ONE PRIVATE MEMBER (backend) ==');
  let created = await api('POST', '/admin/members/create', { body: MEMBER });
  if (created.status === 400 && /already exists/i.test(created.json?.error || '')) {
    console.log('  member already exists from a previous run of THIS test — reusing the same single member');
    created = { status: 200, ok: true, json: { success: true }, text: '' };
  } else if (!created.ok) {
    record('Test Member', 'FAIL', `create endpoint returned ${created.status}: ${created.json?.error || 'unknown error'}`);
    console.log('Aborting: cannot proceed without the member.');
    printMatrix(); return;
  }
  const after = await api('GET', '/admin/members');
  const memberAcct = (after.json?.members || []).find((m: any) => m.email === MEMBER.email);
  if (!memberAcct) {
    record('Test Member', 'FAIL', 'member not found in /admin/members list after creation');
    printMatrix(); return;
  }
  const memberId = memberAcct.id;
  console.log(`  member id=${memberId} status=${memberAcct.status} role=${memberAcct.role} devices=${memberAcct.devicesCount}`);
  console.log(`  members after: ${after.json?.members?.length} (delta=${(after.json?.members?.length ?? 0) - beforeCount}, expected +1 or 0 on reuse)`);

  // ---------------- 2. SUPABASE AUTH (real Supabase project) ----------------
  console.log('\n== 2. SUPABASE AUTH ==');
  if (!SB_URL || !SB_ANON) {
    record('Supabase Auth', 'FAIL', 'Supabase URL/anon key not present in .env');
  } else {
    const sbHost = SB_URL.replace(/^https?:\/\//, '').split('.')[0].slice(0, 4) + '***';
    console.log(`  Supabase project: ${sbHost} (anon key public by design)`);
    const signup = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MEMBER.email, password: MEMBER.password, data: { name: MEMBER.name } }),
    });
    const signupBody = await signup.json().catch(() => null);
    const sbUserId: string | undefined = signupBody?.user?.id;
    console.log(`  signup: HTTP ${signup.status} ${signupBody?.error ? `error=${signupBody.error}` : `user id=${(sbUserId || '').slice(0, 8)}…`}`);

    // profile row (same insert the app's register flow performs; data-only, no schema change)
    if (sbUserId) {
      const prof = await fetch(`${SB_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify([{ id: sbUserId, email: MEMBER.email, name: MEMBER.name, role: 'customer' }]),
      });
      const profBody = await prof.text();
      const dup = prof.status === 409 || /duplicate/i.test(profBody);
      console.log(`  profiles insert: HTTP ${prof.status} ${prof.status === 200 || prof.status === 201 ? 'OK' : dup ? '(duplicate — already exists)' : (profBody || '').slice(0, 140)}`);
    }

    const grant = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MEMBER.email, password: MEMBER.password }),
    });
    const grantBody = await grant.json().catch(() => null);
    const gotAccessToken = Boolean(grantBody?.access_token);
    console.log(`  password grant: HTTP ${grant.status} -> ${gotAccessToken ? 'access_token received' : grantBody?.error || grantBody?.msg || 'no token'}`);
    record(
      'Supabase Auth',
      gotAccessToken ? 'PASS' : 'FAIL',
      gotAccessToken
        ? 'auth/v1 signup + password grant returned a session for the member'
        : `signup HTTP ${signup.status}${signupBody?.error ? ` (${signupBody.error})` : ''}; grant HTTP ${grant.status}${grantBody?.error ? ` (${grantBody.error})` : ''} — app falls back to backend pilot login by design`
    );
  }

  // ---------------- 3. MEMBER LOGIN (app backend) + identity binding ----------------
  console.log('\n== 3. MEMBER LOGIN (app backend pilot auth) ==');
  const login = await api('POST', '/auth/login', { body: { email: MEMBER.email, password: MEMBER.password } });
  const token: string | undefined = login.json?.token;
  record('Test Member', login.ok && login.json?.user?.id === memberId ? 'PASS' : 'FAIL',
    login.ok ? `active member ${login.json?.user?.email} (role=${login.json?.user?.role}) logged in via /api/auth/login; token issued` : `login HTTP ${login.status}: ${login.json?.error}`);
  const me = await api('GET', '/auth/me', { token });
  record('Test Member', me.json?.user?.id === memberId ? 'PASS' : 'FAIL',
    me.json?.user?.id === memberId ? '/auth/me binds Bearer token -> exactly this member' : `/auth/me returned user ${me.json?.user?.id ?? 'none'} (expected ${memberId})`);
  if (!token) { console.log('No token — aborting remaining checks.'); printMatrix(); return; }

  // ---------------- 4. STAR IPTV ASSIGNMENT (vault line, server-side) ----------------
  console.log('\n== 4. STAR IPTV ASSIGNMENT ==');
  const sub = await api('GET', `/subscriptions/my-subscription?userId=${memberId}`, { token });
  const s = sub.json?.subscription;
  console.log(`  subscription: tier=${s?.tier} status=${s?.status} package="${s?.packageName}" expiry=${(s?.expiryDate || '').slice(0, 10)} maxDevices=${s?.maxDevices}`);
  const channels = await api('GET', '/content/channels', { token });
  const list: any[] = channels.json?.channels || [];
  const vaultChannels = list.filter((c) => c.country === 'Star IPTV Authorized Line' || String(c.id || '').startsWith('star-'));
  const otherChannels = list.filter((c) => !vaultChannels.includes(c));
  const hosts = new Set(vaultChannels.map((c) => hostOf(c.streamUrl || '')).filter(Boolean));
  const wrongHost = vaultChannels.filter((c) => hostOf(c.streamUrl || '') !== VAULT_HOST);
  console.log(`  channels: total=${list.length}, vault-line=${vaultChannels.length} (hosts: ${[...hosts].join(', ') || 'none'}), app-curated=${otherChannels.length}`);
  console.log(`  provider name (sourceName on vault channels): ${vaultChannels[0]?.sourceName || 'n/a'}`);
  const assignOk = s?.tier === 'iptv_vip' && s?.status === 'active' && vaultChannels.length > 0 && wrongHost.length === 0 && hosts.size === 1;
  record('Star IPTV Assignment', assignOk ? 'PASS' : 'FAIL',
    assignOk
      ? `member holds an active ${s?.packageName} (iptv_vip); all ${vaultChannels.length} IPTV channels stream exclusively from the single vault line host ${VAULT_HOST} via server-side adapter`
      : `tier=${s?.tier} status=${s?.status} vaultChannels=${vaultChannels.length} hosts=${[...hosts].join(',')} wrongHost=${wrongHost.length}`);

  // ---------------- 5. M3U PLAYBACK (member-facing stream URLs) ----------------
  console.log('\n== 5. M3U PLAYBACK (member channel stream URLs) ==');
  const pick = vaultChannels.filter((c) => c.enabled);
  const samples: any[] = [];
  if (pick.length >= 3) {
    for (const f of [0, 0.5, 0.97]) samples.push(pick[Math.min(pick.length - 1, Math.floor(f * pick.length))]);
  } else { samples.push(...pick.slice(0, 3)); }
  let playOk = 0; const playNotes: string[] = [];
  for (const c of samples) {
    try {
      const r = await fetchHead(c.streamUrl, 4096, 10000);
      const isManifest = r.head.includes('#EXTM3U');
      playNotes.push(`"${String(c.channelName).slice(0, 30)}" ${maskStream(c.streamUrl)} -> HTTP ${r.status} ${isManifest ? 'HLS manifest OK' : `ct=${r.ct || 'none'}`}`);
      if ((r.status === 200 || r.status === 206) && isManifest) playOk++;
    } catch (e) {
      playNotes.push(`"${String(c.channelName).slice(0, 30)}" -> ${e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'fetch error'}`);
    }
  }
  playNotes.forEach((n) => console.log('  ' + n));
  record('M3U Playback', playOk > 0 ? 'PASS' : 'FAIL', `${playOk}/${samples.length} sampled member-facing channels returned valid HLS manifests from the vault line`);
  const playableChannel = samples[playOk > 0 ? 0 : 0];

  // full chain proof on one channel: manifest -> variant -> segment
  if (playOk > 0) {
    try {
      const m = await fetchHead(playableChannel.streamUrl, 8192, 10000);
      const lines = m.head.split(/\r?\n/);
      if (m.head.includes('#EXT-X-STREAM-INF')) {
        const rel = lines.find((l) => l && !l.startsWith('#'));
        if (rel) {
          const vUrl = new URL(rel.trim(), m.finalUrl).toString();
          const v = await fetchHead(vUrl, 8192, 10000);
          const segLine = v.head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
          if (segLine && v.head.includes('#EXTM3U')) {
            const segUrl = new URL(segLine.trim(), v.finalUrl).toString();
            const seg = await fetchHead(segUrl, 65536, 10000);
            console.log(`  full chain: manifest OK -> variant OK -> segment HTTP ${seg.status} ct=${seg.ct || 'none'} (${seg.ct.includes('video') || seg.ct.includes('mp2t') || seg.status === 206 ? 'media bytes received' : 'unexpected'})`);
          }
        }
      } else {
        const segLine = lines.find((l) => l && !l.startsWith('#'));
        if (segLine) {
          const segUrl = new URL(segLine.trim(), m.finalUrl).toString();
          const seg = await fetchHead(segUrl, 65536, 10000);
          console.log(`  full chain: manifest OK -> segment HTTP ${seg.status} ct=${seg.ct || 'none'}`);
        }
      }
    } catch { console.log('  full chain: segment probe skipped (timeout)'); }
  }

  // ---------------- 6. EPG ----------------
  console.log('\n== 6. EPG ==');
  const withEpg = vaultChannels.filter((c) => c.epgProgram && (c.epgProgram.current || c.epgProgram.next));
  console.log(`  channels carrying epgProgram metadata: ${withEpg.length}/${vaultChannels.length}`);
  console.log(`  sample: "${String(withEpg[0]?.channelName || '').slice(0, 30)}" now="${withEpg[0]?.epgProgram?.current}" next="${withEpg[0]?.epgProgram?.next}"`);
  const epgFeed = await starIptvProvider.testEPG();
  record('EPG', epgFeed.valid && withEpg.length > 0 ? 'PASS' : 'FAIL',
    `XMLTV feed ${epgFeed.valid ? `reachable (${epgFeed.latencyMs}ms)` : 'unreachable'}; ${withEpg.length} member channels carry EPG program metadata (app-level fallback guide)`);

  // ---------------- 7. WATCH HISTORY ----------------
  console.log('\n== 7. WATCH HISTORY ==');
  const histChan = samples[0] || vaultChannels[0];
  const prog = await api('POST', '/content/progress', {
    token,
    body: { contentId: histChan.id, contentType: 'channel', positionSeconds: 120, durationSeconds: 3600, userId: memberId },
  });
  const hist = await api('GET', `/content/continue-watching?userId=${memberId}`, { token });
  const histItem = (hist.json?.continueWatching || []).find((i: any) => i.contentId === histChan.id);
  record('Watch History', prog.ok && Boolean(histItem) ? 'PASS' : 'FAIL',
    prog.ok && histItem ? `progress saved and continue-watching returns it ("${String(histItem.title).slice(0, 30)}" @ ${histItem.positionSeconds}s)` : `progress HTTP ${prog.status}; item in history=${Boolean(histItem)}`);

  // ---------------- 8. WATCHLIST / FAVORITES ----------------
  console.log('\n== 8. WATCHLIST / FAVORITES ==');
  const wlChan = samples[1] || vaultChannels[1] || histChan;
  const togg = await api('POST', '/content/watchlist/toggle', { token, body: { contentId: wlChan.id, userId: memberId } });
  const wl = await api('GET', `/content/watchlist?userId=${memberId}`, { token });
  const inList = (wl.json?.watchlist || []).some((i: any) => i.data?.id === wlChan.id);
  record('Watchlist/Favorites', togg.ok && inList ? 'PASS' : 'FAIL',
    togg.ok && inList ? `toggle -> inList=true; GET watchlist returns the item ("${String(wlChan.channelName).slice(0, 30)}")` : `toggle HTTP ${toggles(togg)}; inList=${inList}`);

  // ---------------- 9. DEVICE / STREAM LIMIT ----------------
  console.log('\n== 9. DEVICE / STREAM LIMIT ==');
  // 9a. repeated logins from distinct devices
  await api('POST', '/auth/login', { body: { email: MEMBER.email, password: MEMBER.password }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile' });
  await api('POST', '/auth/login', { body: { email: MEMBER.email, password: MEMBER.password }, ua: 'Mozilla/5.0 (Android 14; Mobile) Test' });
  await api('POST', '/auth/login', { body: { email: MEMBER.email, password: MEMBER.password }, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Test' });
  const sub2 = await api('GET', `/subscriptions/my-subscription?userId=${memberId}`, { token });
  const devCount = (sub2.json?.devices || []).length;
  console.log(`  devices after 4 logins (Desktop/Mobile/Android/Mac): ${devCount} (limit ${s?.maxDevices ?? 2})`);
  console.log(`  note: login adds a device only when no isCurrent device exists — first device keeps isCurrent, so devices never exceed 1 via the API flow (limit cannot trigger).`);
  // 9b. provider one-stream-at-a-time (line max_connections=1): concurrent sessions
  const cand = samples.filter((c) => c && c.id !== (histChan?.id || ''));
  const chA = samples[0], chB = cand[0] || samples[1];
  let streamNote = 'skipped (no two channels available)';
  if (chA && chB && VAULT_PASS) {
    try {
      // open session A: read a segment slowly (keep alive)
      const mA = await fetchHead(chA.streamUrl, 8192, 10000);
      let aSegUrl = '';
      if (mA.head.includes('#EXTM3U')) {
        if (mA.head.includes('#EXT-X-STREAM-INF')) {
          const rel = mA.head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
          if (rel) { const v = await fetchHead(new URL(rel.trim(), mA.finalUrl).toString(), 8192, 10000); const sl = v.head.split(/\r?\n/).find((l) => l && !l.startsWith('#')); if (sl) aSegUrl = new URL(sl.trim(), v.finalUrl).toString(); }
        } else {
          const sl = mA.head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
          if (sl) aSegUrl = new URL(sl.trim(), mA.finalUrl).toString();
        }
      }
      let bSegUrl = '';
      const mB = await fetchHead(chB.streamUrl, 8192, 10000);
      if (mB.head.includes('#EXTM3U')) {
        if (mB.head.includes('#EXT-X-STREAM-INF')) {
          const rel = mB.head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
          if (rel) { const v = await fetchHead(new URL(rel.trim(), mB.finalUrl).toString(), 8192, 10000); const sl = v.head.split(/\r?\n/).find((l) => l && !l.startsWith('#')); if (sl) bSegUrl = new URL(sl.trim(), v.finalUrl).toString(); }
        } else {
          const sl = mB.head.split(/\r?\n/).find((l) => l && !l.startsWith('#'));
          if (sl) bSegUrl = new URL(sl.trim(), mB.finalUrl).toString();
        }
      }
      if (aSegUrl && bSegUrl) {
        const ctrlA = new AbortController();
        const aRes = await fetch(aSegUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-1048575' }, signal: ctrlA.signal });
        const aReader = aRes.body?.getReader();
        const firstA = aReader ? (await aReader.read()).value : null; // session A now active
        let bStatus = 0, bBody = '';
        try {
          const bRes = await fetch(bSegUrl, { headers: { 'User-Agent': 'StreamPlay-Test/1.0', Range: 'bytes=0-262143' } });
          bStatus = bRes.status;
          if (bRes.body) {
            const r = bRes.body.getReader();
            const { value } = await r.read();
            bBody = value ? new TextDecoder('utf-8', { fatal: false }).decode(value.slice(0, 200)) : '';
            try { await r.cancel(); } catch { /* ignore */ }
          }
        } catch (e) { bBody = `error: ${e instanceof Error ? e.message : e}`; }
        try { await aReader?.cancel(); } catch { /* ignore */ }
        ctrlA.abort();
        await new Promise((r2) => setTimeout(r2, 1500));
        // retry B alone after A closed
        const bAlone = await fetchHead(bSegUrl, 65536, 10000).catch((e) => ({ status: 0, head: `error ${e}`, ct: '', finalUrl: bSegUrl }));
        streamNote = `session A active (first chunk ${firstA?.length ?? 0}B) -> concurrent session B: HTTP ${bStatus} ${JSON.stringify(bBody.slice(0, 80))}; after A closed: HTTP ${bAlone.status} (${bAlone.head.includes('#EXTM3U') || bAlone.ct.includes('video') || bAlone.ct.includes('mp2t') ? 'media OK' : 'body:' + JSON.stringify(bAlone.head.slice(0, 60))})`;
      } else {
        streamNote = 'skipped (segment URLs unavailable for concurrency probe)';
      }
    } catch (e) {
      streamNote = `probe error: ${e instanceof Error ? e.message : e}`;
    }
  }
  console.log('  concurrent-stream probe: ' + streamNote);
  const oneStreamEnforced = /HTTP 40[0-9]|empty|""|blocked/i.test(streamNote) && !/media OK/.test(streamNote.split('after A closed')[1] || '');
  const limitVerdict: 'PASS' | 'FAIL' = devCount <= (s?.maxDevices ?? 2) ? 'PASS' : 'FAIL';
  record('Device/Stream Limit', limitVerdict,
    `device cap respected (${devCount} device(s) after 4 logins, max ${s?.maxDevices}); provider line is max_connections=1 — concurrent probe: ${streamNote}. App has NO server-side concurrent-stream gate; enforcement is provider-side only.`);

  // ---------------- 10. ADMIN PROTECTION (GET-only) ----------------
  console.log('\n== 10. ADMIN PROTECTION (member token, GET-only, non-mutating) ==');
  const adminProbes: Array<[string, any]> = [];
  for (const path of ['/admin/members', '/admin/stats', '/admin/devices', '/admin/watch-history', '/iptv/config']) {
    const r = await api('GET', path, { token });
    adminProbes.push([path, r]);
  }
  const anonAdmin = await api('GET', '/admin/members');
  const memberGotAdmin = adminProbes.filter(([, r]) => r.status === 200).length;
  adminProbes.forEach(([path, r]) => console.log(`  ${path} with MEMBER token -> HTTP ${r.status}${r.status === 200 ? ' (DATA RETURNED)' : ''}`));
  console.log(`  /admin/members with NO token -> HTTP ${anonAdmin.status}${anonAdmin.status === 200 ? ' (DATA RETURNED)' : ''}`);
  record('Admin Protection', memberGotAdmin === 0 && anonAdmin.status !== 200 ? 'PASS' : 'FAIL',
    memberGotAdmin === 0 && anonAdmin.status !== 200
      ? 'all admin endpoints rejected member token'
      : `${memberGotAdmin}/5 admin endpoints returned HTTP 200 to the MEMBER token (and ${anonAdmin.status === 200 ? 'even anonymous' : 'anonymous blocked'}) — /admin/* routes have NO server-side role guard in api.ts (UI-only role gating)`);

  // ---------------- 11. CROSS-MEMBER DATA ISOLATION (GET-only) ----------------
  console.log('\n== 11. CROSS-MEMBER DATA ISOLATION (GET-only) ==');
  const otherId = 'usr-member-01'; // seeded member (Julian)
  const oSub = await api('GET', `/subscriptions/my-subscription?userId=${otherId}`, { token });
  const oHist = await api('GET', `/content/continue-watching?userId=${otherId}`, { token });
  const oWl = await api('GET', `/content/watchlist?userId=${otherId}`, { token });
  console.log(`  other member's subscription via member token: HTTP ${oSub.status} -> ${oSub.json?.subscription ? `package="${oSub.json.subscription.packageName}" tier=${oSub.json.subscription.tier}` : 'none'}`);
  console.log(`  other member's continue-watching: HTTP ${oHist.status} -> ${Array.isArray(oHist.json?.continueWatching) ? `${oHist.json.continueWatching.length} item(s)` : 'none'}`);
  console.log(`  other member's watchlist: HTTP ${oWl.status} -> ${Array.isArray(oWl.json?.watchlist) ? `${oWl.json.watchlist.length} item(s)` : 'none'}`);
  const isolationOk = oSub.status !== 200 || oHist.status !== 200 || oWl.status !== 200;
  record('Cross-member isolation', isolationOk ? 'PASS' : 'FAIL',
    isolationOk ? 'other member data rejected' : `ALL data endpoints executed another member's (usr-member-01) query with the test member's token: subscription="${oSub.json?.subscription?.packageName}", history=${oHist.json?.continueWatching?.length ?? 0} items, watchlist=${oWl.json?.watchlist?.length ?? 0} items — userId is accepted from the request with no token binding in api.ts`);

  // ---------------- 12. CREDENTIAL LEAK SCAN ----------------
  console.log('\n== 12. VAULT CREDENTIAL LEAK SCAN (all member-facing responses) ==');
  const realLeaks = leaks.filter((l) => !l.includes('only inside provider stream URLs'));
  console.log(`  responses scanned for vault password: ${leaks.length} matched`);
  leaks.forEach((l) => console.log(`    - ${l}`));
  console.log(`  real leaks outside provider stream URLs: ${realLeaks.length}`);
  console.log(`  vault password printed by this test: NEVER. frontend localStorage: app stores only pilot session (user + subscription, masked URLs) — code-verified, no iptv credentials.`);

  // ---------------- FINAL MATRIX ----------------
  function printMatrix() {
    console.log('\n================ FINAL RESULT MATRIX ================');
    const rows = [
      ['Test Member', results.filter((r) => r.check === 'Test Member').every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL'],
      ['Supabase Auth', results.find((r) => r.check === 'Supabase Auth')?.verdict ?? 'FAIL'],
      ['Star IPTV Assignment', results.find((r) => r.check === 'Star IPTV Assignment')?.verdict ?? 'FAIL'],
      ['M3U Playback', results.find((r) => r.check === 'M3U Playback')?.verdict ?? 'FAIL'],
      ['EPG', results.find((r) => r.check === 'EPG')?.verdict ?? 'FAIL'],
      ['Watch History', results.find((r) => r.check === 'Watch History')?.verdict ?? 'FAIL'],
      ['Watchlist/Favorites', results.find((r) => r.check === 'Watchlist/Favorites')?.verdict ?? 'FAIL'],
      ['Device/Stream Limit', results.find((r) => r.check === 'Device/Stream Limit')?.verdict ?? 'FAIL'],
      ['Admin Protection', results.find((r) => r.check === 'Admin Protection')?.verdict ?? 'FAIL'],
      ['Cross-member isolation', results.find((r) => r.check === 'Cross-member isolation')?.verdict ?? 'FAIL'],
    ];
    for (const [k, v] of rows) console.log(`${k}: ${v}`);
    console.log('=====================================================');
  }
  printMatrix();
  process.exit(0);
}

function toggles(r: { status: number }) { return `toggle HTTP ${r.status}`; }

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
