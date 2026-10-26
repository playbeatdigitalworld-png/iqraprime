/**
 * Creator Hub PRODUCTION E2E — runs the full admin→creator→viewer→moderation→
 * monetization flow against the LIVE deployment (Vercel + Supabase).
 *
 * Preconditions:
 *  - Phase-1 migration + compat migration applied in Supabase (owner confirmed).
 *  - Pilot director is auto-seeded on every serverless instance
 *    (requireAdmin accepts aether_token_*).
 *
 * Flow (same checks as scripts/test-creator-hub.mjs):
 *  flags → forced persistence recheck (expect sql) → pilot admin login →
 *  seed QA creator (real Supabase Auth user) → creator login → create draft →
 *  signed upload → upload-complete (validation) → submit → admin approve →
 *  public browse → watch session (valid view) → duplicate refresh rejected →
 *  dashboard/analytics (real numbers) → earnings estimate → withdrawal
 *  below-minimum rejected → admin adjustment → withdrawal approved →
 *  mark-paid locked behind PAYOUTS flag → report flow → settings restore.
 *
 * Writes a cleanup manifest (scripts/prod-e2e-artifacts.json) with every DB id
 * touched, so the test data can be removed afterwards.
 */
const BASE = process.env.E2E_BASE || 'https://stream.playbeatdigital.store';
const fs = await import('node:fs');

const results = [];
const artifacts = { base: BASE, creator: null, video_id: null, video_ids: [], withdrawal_id: null, report_id: null, session_ids: [], original_settings: null, started_at: new Date().toISOString() };

function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: raw ?? (body != null ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// ---- 0. reachability + persistence flip ---------------------------------------
const flags = await req('GET', '/api/creator-hub/flags');
check('public flags endpoint reachable', flags.status === 200 && flags.json?.flags?.CREATOR_HUB_ENABLED === true, `persistence=${flags.json?.persistence}`);

const adminLogin = await req('POST', '/api/auth/login', { body: { email: 'admin@aetherstream.tv', password: 'admin123' } });
const adminToken = adminLogin.json?.token;
check('pilot admin login', adminLogin.status === 200 && !!adminToken, `code=${adminLogin.json?.error ?? ''}`);
if (!adminToken) { fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2)); process.exit(1); }

const recheck = await req('POST', '/api/creator-hub/admin/qa/recheck', { token: adminToken });
check('forced persistence recheck → sql', recheck.status === 200 && recheck.json?.persistence_mode === 'sql', `mode=${recheck.json?.persistence_mode}`);
if (recheck.json?.persistence_mode !== 'sql') {
  console.log('\nABORT: production still in memory mode — compat migration not detected.');
  fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2));
  process.exit(1);
}

// ---- 1. seed a REAL test creator ----------------------------------------------
const seed = await req('POST', '/api/creator-hub/admin/qa/seed-creator', { token: adminToken });
check('admin QA seed creator (real Supabase Auth user)', seed.status === 200 && !!seed.json?.login_hint?.email, `handle=@${seed.json?.creator?.handle}`);
if (seed.status !== 200) { fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2)); process.exit(1); }
artifacts.creator = seed.json.creator;

async function supabaseLogin(email, password) {
  // extract the same constants the server bundles (single source of truth)
  const apiSrc = fs.readFileSync(new URL('../server/routes/api.ts', import.meta.url), 'utf8');
  const sbUrl = process.env.SUPABASE_URL || apiSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  const anon = process.env.SUPABASE_ANON_KEY || apiSrc.match(/sb_publishable_[A-Za-z0-9_]+/)?.[0];
  if (!sbUrl || !anon) throw new Error('could not resolve supabase url/anon key from server source');
  const res = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`supabase login failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}
const creatorToken = await supabaseLogin(seed.json.login_hint.email, seed.json.login_hint.password);
check('creator login via Supabase Auth', !!creatorToken);

const me = await req('GET', '/api/creator-hub/me', { token: creatorToken });
check('creator /me resolves profile + strikes', me.status === 200 && me.json?.creator?.handle === seed.json.creator.handle, `strikes=${me.json?.copyright_status?.active_strikes}`);

// ---- 2. create draft ------------------------------------------------------------
const draft = await req('POST', '/api/creator-hub/me/videos', {
  token: creatorToken,
  body: { title: 'E2E Test Video — Creator Hub', description: 'Uploaded by the automated production E2E flow.', kind: 'video' },
});
check('create draft', draft.status === 200 && ['draft', 'DRAFT'].includes(String(draft.json?.video?.status)), `status=${draft.json?.video?.status}`);
const videoId = draft.json?.video?.id;
artifacts.video_id = videoId; artifacts.video_ids.push(videoId);
if (!videoId) { fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2)); process.exit(1); }

// creator can NEVER publish themselves — status is not an editable field
const selfPublish = await req('PUT', `/api/creator-hub/me/videos/${videoId}`, { token: creatorToken, body: { status: 'published' } });
check('creator cannot self-publish via metadata edit', selfPublish.status === 200 && ['draft', 'DRAFT'].includes(String(selfPublish.json?.video?.status)), `status=${selfPublish.json?.video?.status}`);

// ---- 3. signed upload + confirm ---------------------------------------------------
const up = await req('POST', `/api/creator-hub/me/videos/${videoId}/upload-url`, { token: creatorToken, body: { mime: 'video/mp4', sizeBytes: 2048 } });
check('signed upload URL issued', up.status === 200 && !!up.json?.signedUrl, `path=${up.json?.path}`);
const putRes = await fetch(up.json.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' }, body: Buffer.alloc(2048, 1) });
check('direct-to-storage upload', putRes.ok, `http ${putRes.status}`);
const done = await req('POST', `/api/creator-hub/me/videos/${videoId}/upload-complete`, { token: creatorToken, body: { durationSeconds: 8 } });
check('upload-complete validates object + moderation queue', done.status === 200 && ['pending_review', 'PENDING_REVIEW'].includes(String(done.json?.video?.status)), `moderation=${done.json?.moderation}`);

// editing while under review is blocked entirely
const editLocked = await req('PUT', `/api/creator-hub/me/videos/${videoId}`, { token: creatorToken, body: { title: 'x' } });
check('pending_review videos are locked for editing (409)', editLocked.status === 409, `code=${editLocked.json?.code}`);

// submit path (idempotent re-submit from pending_review is rejected)
const submit = await req('POST', `/api/creator-hub/me/videos/${videoId}/submit`, { token: creatorToken });
check('submit for review (already pending → 409)', submit.status === 409, 'already pending_review (expected conflict)');

// ---- 4. moderation ------------------------------------------------------------------
const approve = await req('POST', `/api/creator-hub/admin/videos/${videoId}/approve`, { token: adminToken });
check('admin approve → published', approve.status === 200 && ['published', 'PUBLISHED'].includes(String(approve.json?.video?.status)), `status=${approve.json?.video?.status}`);

// creator cannot use admin endpoints
const creatorAsAdmin = await req('POST', `/api/creator-hub/admin/videos/${videoId}/approve`, { token: creatorToken });
check('creator blocked from admin moderation (403)', creatorAsAdmin.status === 403);

// ---- 5. public browse + watch (valid view) -------------------------------------------
const anonList = await req('GET', '/api/creator-hub/videos?limit=20');
check('anonymous browse lists published video', anonList.status === 200 && anonList.json?.videos?.some((v) => v.id === videoId));

// Sessions 1 & 2 run AUTHENTICATED (creator token): logged-in viewers key the
// view dedupe on their stable user identity, so the refresh-burst rejection is
// deterministic even in environments with rotating egress IPs. Session 3 stays
// anonymous and too short (no view either way).
const watch = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { token: creatorToken, body: {} });
check('watch session start (authenticated viewer)', watch.status === 200 && !!watch.json?.sessionId, `playback=${!!watch.json?.playbackUrl}`);
const sid = watch.json?.sessionId;
artifacts.session_ids.push(sid);
if (!sid) { fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2)); process.exit(1); }

// The API contract is heartbeatSeconds=15 with a server-side clamp of
// MAX_WATCH_HEARTBEAT_SECONDS (20) per heartbeat — mimic a REAL client:
// two 15s heartbeats, 16s apart → watch_seconds=30 ≥ threshold. Windows are
// also long enough to pass even if a stale instance still cached old settings.
const st0 = await req('GET', '/api/creator-hub/admin/settings', { token: adminToken });
artifacts.original_settings = st0.json?.settings ?? null;

await new Promise((r) => setTimeout(r, 16_000));
const hb1 = await req('POST', `/api/creator-hub/watch/${sid}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
await new Promise((r) => setTimeout(r, 16_000));
const hb2 = await req('POST', `/api/creator-hub/watch/${sid}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
check('heartbeats accepted (30s credited)', hb1.status === 200 && hb2.status === 200 && (hb2.json?.watch_seconds ?? 0) >= 30, `watch=${hb2.json?.watch_seconds}s`);

const end1 = await req('POST', `/api/creator-hub/watch/${sid}/end`, { body: {} });
check('session end → VALID view minted', end1.json?.validView === true, `reason=${end1.json?.invalid_reason}`);

// refresh-burst: the SAME authenticated viewer watching again must NOT count
const watch2 = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { token: creatorToken, body: {} });
artifacts.session_ids.push(watch2.json?.sessionId);
await new Promise((r) => setTimeout(r, 16_000));
await req('POST', `/api/creator-hub/watch/${watch2.json.sessionId}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
await new Promise((r) => setTimeout(r, 16_000));
await req('POST', `/api/creator-hub/watch/${watch2.json.sessionId}/heartbeat`, { body: { deltaSeconds: 15, playing: true } });
const end2 = await req('POST', `/api/creator-hub/watch/${watch2.json.sessionId}/end`, { body: {} });
check('duplicate refresh within window REJECTED', end2.json?.validView === false, `reason=${end2.json?.invalid_reason}`);

// duration below threshold rejected
const watch3 = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { body: {} });
artifacts.session_ids.push(watch3.json?.sessionId);
const end3 = await req('POST', `/api/creator-hub/watch/${watch3.json.sessionId}/end`, { body: {} });
check('too-short session rejected (no view counted)', end3.json?.validView === false && String(end3.json?.invalid_reason ?? '').includes('too_short'), `reason=${end3.json?.invalid_reason}`);

const detail = await req('GET', `/api/creator-hub/videos/${videoId}`);
check('video detail shows exactly 1 valid view', detail.status === 200 && Number(detail.json?.video?.valid_views ?? detail.json?.video?.valid_view_count) === 1, `views=${detail.json?.video?.valid_views ?? detail.json?.video?.valid_view_count}`);

// ---- 6. analytics (real numbers only) -------------------------------------------------
const dash = await req('GET', '/api/creator-hub/me/dashboard', { token: creatorToken });
check('creator dashboard totals (1 valid view)', Number(dash.json?.totals?.valid_views) === 1, `views=${dash.json?.totals?.valid_views}`);
const analytics = await req('GET', '/api/creator-hub/me/analytics?days=7', { token: creatorToken });
check('creator analytics exposes per-day + top videos', analytics.status === 200 && analytics.json?.top_videos?.[0]?.id === videoId);

// ---- 7. monetization + withdrawal ------------------------------------------------------
const earnings0 = await req('GET', '/api/creator-hub/me/earnings', { token: creatorToken });
check('earnings labeled ESTIMATED with disclaimer', earnings0.json?.label === 'Estimated Earnings' && !!earnings0.json?.disclaimer, `est=$${earnings0.json?.summary?.estimated_earnings_usd}`);

// below-minimum withdrawal rejected
const wlow = await req('POST', '/api/creator-hub/me/withdrawals', { token: creatorToken, body: { amount_usd: 0.01 } });
check('withdrawal below minimum rejected (400)', wlow.status === 400 && wlow.json?.code === 'below_minimum', `code=${wlow.json?.code}`);

// admin adjustment + full withdrawal cycle
await req('POST', `/api/creator-hub/admin/earnings/${me.json.creator.id}/adjust`, { token: adminToken, body: { amount_usd: 25, description: 'E2E adjustment' } });
const wok = await req('POST', '/api/creator-hub/me/withdrawals', { token: creatorToken, body: { amount_usd: 15 } });
check('withdrawal request accepted (≥ minimum)', wok.status === 200 && String(wok.json?.withdrawal?.status).toLowerCase() === 'pending', `$${wok.json?.withdrawal?.amount_usd}`);
const wid = wok.json?.withdrawal?.id;
artifacts.withdrawal_id = wid;

const wapprove = await req('POST', `/api/creator-hub/admin/withdrawals/${wid}/process`, { token: adminToken, body: { action: 'approve' } });
check('admin approves withdrawal', wapprove.status === 200 && String(wapprove.json?.withdrawal?.status).toLowerCase() === 'approved', `status=${wapprove.json?.withdrawal?.status}`);
const wpay = await req('POST', `/api/creator-hub/admin/withdrawals/${wid}/process`, { token: adminToken, body: { action: 'mark_paid', payout_ref: 'e2e-test' } });
check('mark-paid LOCKED behind PAYOUTS_ENABLED=false', wpay.status === 403 && wpay.json?.code === 'payouts_disabled', `code=${wpay.json?.code}`);

// ---- 8. like / comment / follow (auth) ---------------------------------------------------
const likeAnon = await req('POST', `/api/creator-hub/videos/${videoId}/like`, { body: {} });
check('anonymous like rejected (401)', likeAnon.status === 401, `http=${likeAnon.status}`);
const likeCreator = await req('POST', `/api/creator-hub/videos/${videoId}/like`, { token: creatorToken });
check('creator likes own video (allowed by API)', likeCreator.status === 200, `http=${likeCreator.status}`);

// ---- 9. reports + copyright ----------------------------------------------------------------
const rep = await req('POST', '/api/creator-hub/reports', { body: { video_id: videoId, content: 'E2E test report — please review.' } });
check('public video report accepted', rep.status === 200, `http=${rep.status} ${JSON.stringify(rep.json).slice(0, 120)}`);
artifacts.report_id = rep.json?.report?.id ?? null;
const adminReports = await req('GET', '/api/creator-hub/admin/reports', { token: adminToken });
check('admin sees the report', adminReports.json?.reports?.some((r) => r.video_id === videoId), `count=${adminReports.json?.reports?.length}`);
const repId = adminReports.json?.reports?.find((r) => r.video_id === videoId)?.id ?? artifacts.report_id;
const resolved = await req('POST', `/api/creator-hub/admin/reports/${repId}/resolve`, { token: adminToken, body: { status: 'dismissed' } });
check('admin resolves report', resolved.status === 200, `http=${resolved.status}`);

// ---- 10. fraud review visibility --------------------------------------------------------------
const fraud = await req('GET', '/api/creator-hub/admin/fraud/sessions', { token: adminToken });
check('fraud review lists real sessions', fraud.status === 200 && (fraud.json?.sessions?.length ?? 0) >= 3, `sessions=${fraud.json?.sessions?.length}`);

// ---- 11. QA status (settings were never mutated in this run) ------------------------
const qa = await req('GET', '/api/creator-hub/admin/qa', { token: adminToken });
check('admin QA view reports persistence', qa.status === 200 && !!qa.json?.persistence_mode, `mode=${qa.json?.persistence_mode} counts=${JSON.stringify(qa.json?.table_counts)}`);

// ---- summary --------------------------------------------------------------------------------------
artifacts.finished_at = new Date().toISOString();
artifacts.passed = results.filter((r) => r.pass).length;
artifacts.total = results.length;
fs.writeFileSync('scripts/prod-e2e-artifacts.json', JSON.stringify(artifacts, null, 2));
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
