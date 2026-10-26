/**
 * Repro probe: full watch→end cycle against production with FULL response
 * visibility. Prints status + body of every end call, plus per-session
 * ip_hash/viewer_key from the fraud endpoint to confirm IP rotation.
 */
const BASE = process.env.E2E_BASE || 'https://stream.playbeatdigital.store';
const fs = await import('node:fs');

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}
async function supabaseLogin(email, password) {
  const apiSrc = fs.readFileSync(new URL('../server/routes/api.ts', import.meta.url), 'utf8');
  const sbUrl = process.env.SUPABASE_URL || apiSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  const anon = process.env.SUPABASE_ANON_KEY || apiSrc.match(/sb_publishable_[A-Za-z0-9_]+/)?.[0];
  const res = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`supabase login failed: ${JSON.stringify(j).slice(0, 150)}`);
  return j.access_token;
}

const admin = (await req('POST', '/api/auth/login', { body: { email: 'admin@aetherstream.tv', password: 'admin123' } })).json?.token;
const seed = await req('POST', '/api/creator-hub/admin/qa/seed-creator', { token: admin });
console.log('seed', seed.status, seed.json?.creator?.handle);
const ct = await supabaseLogin(seed.json.login_hint.email, seed.json.login_hint.password);

const draft = await req('POST', '/api/creator-hub/me/videos', { token: ct, body: { title: 'Probe Video', description: 'x', kind: 'video' } });
const vid = draft.json?.video?.id;
const up = await req('POST', `/api/creator-hub/me/videos/${vid}/upload-url`, { token: ct, body: { mime: 'video/mp4', sizeBytes: 2048 } });
await fetch(up.json.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' }, body: Buffer.alloc(2048, 1) });
await req('POST', `/api/creator-hub/me/videos/${vid}/upload-complete`, { token: ct, body: { durationSeconds: 8 } });
const ap = await req('POST', `/api/creator-hub/admin/videos/${vid}/approve`, { token: admin });
console.log('approved', ap.status, ap.json?.video?.status);

async function fullWatch(n) {
  const w = await req('POST', `/api/creator-hub/videos/${vid}/watch/start`, { token: ct, body: {} });
  const sid = w.json?.sessionId;
  console.log(`watch${n} start`, w.status, 'sid=', sid);
  await new Promise((r) => setTimeout(r, 16_000));
  const hbA = await req('POST', `/api/creator-hub/watch/${sid}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
  await new Promise((r) => setTimeout(r, 16_000));
  const hbB = await req('POST', `/api/creator-hub/watch/${sid}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
  console.log(`watch${n} heartbeats`, hbA.status, hbA.json?.watch_seconds, '|', hbB.status, hbB.json?.watch_seconds);
  const end = await req('POST', `/api/creator-hub/watch/${sid}/end`, { body: {} });
  console.log(`watch${n} END  status=${end.status} body=${end.text.slice(0, 400)}`);
  return { sid, end };
}
const w1 = await fullWatch(1);
const w2 = await fullWatch(2);

const fraud = await req('GET', '/api/creator-hub/admin/fraud/sessions', { token: admin });
const mine = (fraud.json?.sessions ?? []).filter((s) => [w1.sid, w2.sid].includes(s.id));
for (const s of mine) console.log('session', s.id.slice(0, 8), 'ip_hash=', s.ip_hash, 'viewer_key=', s.viewer_key, 'valid=', s.is_valid, 'reason=', s.invalid_reason);
const detail = await req('GET', `/api/creator-hub/videos/${vid}`);
console.log('final views=', detail.json?.video?.valid_views ?? detail.json?.video?.valid_view_count);
