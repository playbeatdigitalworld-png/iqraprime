/**
 * Creator Hub E2E — boots the REAL serverless bundle (api/index.js) locally
 * and runs the complete admin→creator→viewer→moderation→monetization flow:
 *
 *  flags → admin login → seed test creator → creator login → create draft →
 *  signed upload → upload-complete (validation) → submit → approve (admin) →
 *  public browse → watch session (valid view) → duplicate-refresh rejected →
 *  dashboard/analytics (real numbers) → earnings estimate → withdrawal
 *  below-minimum rejected → admin adjustment → withdrawal approved →
 *  mark-paid locked behind PAYOUTS flag → copyright report flow → settings restore
 *
 * Requires env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * (the same values configured on Vercel).
 */
import http from 'http';
import handler from '../api/index.js';

const SB = process.env.SUPABASE_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_FALLBACK || '';
if (!ANON) { console.error('SUPABASE_ANON_KEY required'); process.exit(1); }

const server = http.createServer((req, res) => handler(req, res));
await new Promise((r) => server.listen(3999, '127.0.0.1', r));
const B = 'http://127.0.0.1:3999';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
}
async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: raw ?? (body != null ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
}
async function supabaseLogin(email, password) {
  const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`supabase login failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

// ---- 0. flags -----------------------------------------------------------------
const flags = await req('GET', '/api/creator-hub/flags');
check('public flags endpoint', flags.status === 200 && flags.json?.flags?.CREATOR_HUB_ENABLED === true, `persistence=${flags.json?.persistence}`);
const persistence = flags.json?.persistence;

// ---- 1. admin login (seeded pilot director) ------------------------------------
const adminLogin = await req('POST', '/api/auth/login', { body: { email: 'admin@aetherstream.tv', password: 'admin123' } });
const adminToken = adminLogin.json?.token;
check('admin pilot login', adminLogin.status === 200 && !!adminToken);

// ---- 2. seed a REAL test creator ------------------------------------------------
const seed = await req('POST', '/api/creator-hub/admin/qa/seed-creator', { token: adminToken });
check('admin QA seed creator (real Supabase Auth user)', seed.status === 200 && !!seed.json?.login_hint?.email, `handle=@${seed.json?.creator?.handle} persistence=${persistence}`);
if (seed.status !== 200) { server.close(); process.exit(1); }
const creatorEmail = seed.json.login_hint.email;
const creatorPassword = seed.json.login_hint.password;
const creatorToken = await supabaseLogin(creatorEmail, creatorPassword);
check('creator login via Supabase Auth', !!creatorToken);

const me = await req('GET', '/api/creator-hub/me', { token: creatorToken });
check('creator /me resolves profile + strikes', me.status === 200 && me.json?.creator?.handle === seed.json.creator.handle, `strikes=${me.json?.copyright_status?.active_strikes}`);

// ---- 3. create draft --------------------------------------------------------------
const draft = await req('POST', '/api/creator-hub/me/videos', {
  token: creatorToken,
  body: { title: 'E2E Test Video — Creator Hub', description: 'Uploaded by the automated E2E flow.', kind: 'video' },
});
check('create draft', draft.status === 200 && draft.json?.video?.status === 'draft');
const videoId = draft.json?.video?.id;
if (!videoId) { server.close(); process.exit(1); }

// creator can NEVER publish themselves — status is not an editable field
const selfPublish = await req('PUT', `/api/creator-hub/me/videos/${videoId}`, { token: creatorToken, body: { status: 'published' } });
check('creator cannot self-publish via metadata edit', selfPublish.status === 200 && selfPublish.json?.video?.status === 'draft', `status=${selfPublish.json?.video?.status}`);

// ---- 4. signed upload + confirm -----------------------------------------------------
const up = await req('POST', `/api/creator-hub/me/videos/${videoId}/upload-url`, { token: creatorToken, body: { mime: 'video/mp4', sizeBytes: 2048 } });
check('signed upload URL issued', up.status === 200 && !!up.json?.signedUrl, `path=${up.json?.path}`);
const putRes = await fetch(up.json.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' }, body: Buffer.alloc(2048, 1) });
check('direct-to-storage upload', putRes.ok, `http ${putRes.status}`);
const done = await req('POST', `/api/creator-hub/me/videos/${videoId}/upload-complete`, { token: creatorToken, body: { durationSeconds: 8 } });
check('upload-complete validates object + moderation queue', done.status === 200 && done.json?.video?.status === 'pending_review', `moderation=${done.json?.moderation}`);

// editing while under review is blocked entirely
const editLocked = await req('PUT', `/api/creator-hub/me/videos/${videoId}`, { token: creatorToken, body: { title: 'x' } });
check('pending_review videos are locked for editing (409)', editLocked.status === 409, `code=${editLocked.json?.code}`);

// submit path (idempotent re-submit from pending_review is rejected)
const submit = await req('POST', `/api/creator-hub/me/videos/${videoId}/submit`, { token: creatorToken });
check('submit for review', submit.status === 409, 'already pending_review (expected conflict)');

// ---- 5. moderation -----------------------------------------------------------------
const approve = await req('POST', `/api/creator-hub/admin/videos/${videoId}/approve`, { token: adminToken });
check('admin approve → published', approve.status === 200 && approve.json?.video?.status === 'published');

// creator cannot use admin endpoints
const creatorAsAdmin = await req('POST', `/api/creator-hub/admin/videos/${videoId}/approve`, { token: creatorToken });
check('creator blocked from admin moderation (403)', creatorAsAdmin.status === 403);

// ---- 6. public browse + watch (valid view) -----------------------------------------
const anonList = await req('GET', '/api/creator-hub/videos?limit=10');
check('anonymous browse lists published video', anonList.status === 200 && anonList.json?.videos?.some((v) => v.id === videoId));

const watch = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { body: {} });
check('watch session start (anonymous viewer)', watch.status === 200 && !!watch.json?.sessionId, `playback=${!!watch.json?.playbackUrl}`);
const sid = watch.json?.sessionId;
if (!sid) { server.close(); process.exit(1); }

// speed up the test: temporarily lower min_watch_seconds
const st0 = await req('GET', '/api/creator-hub/admin/settings', { token: adminToken });
const originalSettings = st0.json?.settings;
await req('PUT', '/api/creator-hub/admin/settings', { token: adminToken, body: { ...originalSettings, min_watch_seconds: 3, dedupe_window_minutes: 1 } });

await new Promise((r) => setTimeout(r, 4000)); // real wall-clock watch time
const hb1 = await req('POST', `/api/creator-hub/watch/${sid}/heartbeat`, { body: { deltaSeconds: 3, playing: true } });
check('heartbeat accepted', hb1.status === 200 && hb1.json?.watch_seconds >= 3, `watch=${hb1.json?.watch_seconds}s`);

const end1 = await req('POST', `/api/creator-hub/watch/${sid}/end`, { body: {} });
check('session end → VALID view minted', end1.json?.validView === true, `reason=${end1.json?.invalid_reason}`);

// refresh-burst: a second session within the dedupe window must NOT count
const watch2 = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { body: {} });
await new Promise((r) => setTimeout(r, 3500));
await req('POST', `/api/creator-hub/watch/${watch2.json.sessionId}/heartbeat`, { body: { deltaSeconds: 3, playing: true } });
const end2 = await req('POST', `/api/creator-hub/watch/${watch2.json.sessionId}/end`, { body: {} });
check('duplicate refresh within window REJECTED', end2.json?.validView === false, `reason=${end2.json?.invalid_reason}`);

// duration below threshold rejected
const watch3 = await req('POST', `/api/creator-hub/videos/${videoId}/watch/start`, { body: {} });
const end3 = await req('POST', `/api/creator-hub/watch/${watch3.json.sessionId}/end`, { body: {} });
check('too-short session rejected (no view counted)', end3.json?.validView === false && String(end3.json?.invalid_reason ?? '').includes('too_short'));

const detail = await req('GET', `/api/creator-hub/videos/${videoId}`);
check('video detail shows exactly 1 valid view', detail.status === 200 && detail.json?.video?.valid_views === 1, `http=${detail.status} views=${detail.json?.video?.valid_views} :: ${JSON.stringify(detail.json).slice(0, 200)}`);

// ---- 7. analytics (real numbers only) ----------------------------------------------
const dash = await req('GET', '/api/creator-hub/me/dashboard', { token: creatorToken });
check('creator dashboard totals (1 valid view)', dash.json?.totals?.valid_views === 1, `views=${dash.json?.totals?.valid_views} :: ${JSON.stringify(dash.json).slice(0, 200)}`);
const analytics = await req('GET', '/api/creator-hub/me/analytics?days=7', { token: creatorToken });
check('creator analytics exposes per-day + top videos', analytics.status === 200 && analytics.json?.top_videos?.[0]?.id === videoId);

// ---- 8. monetization + withdrawal ---------------------------------------------------
const earnings0 = await req('GET', '/api/creator-hub/me/earnings', { token: creatorToken });
check('earnings labeled ESTIMATED with disclaimer', earnings0.json?.label === 'Estimated Earnings' && !!earnings0.json?.disclaimer, `est=$${earnings0.json?.summary?.estimated_earnings_usd}`);

// below-minimum withdrawal rejected
const wlow = await req('POST', '/api/creator-hub/me/withdrawals', { token: creatorToken, body: { amount_usd: 0.01 } });
check('withdrawal below minimum rejected (400)', wlow.status === 400 && wlow.json?.code === 'below_minimum');

// admin adjustment + full withdrawal cycle
await req('POST', `/api/creator-hub/admin/earnings/${me.json.creator.id}/adjust`, { token: adminToken, body: { amount_usd: 25, description: 'E2E adjustment' } });
const wok = await req('POST', '/api/creator-hub/me/withdrawals', { token: creatorToken, body: { amount_usd: 15 } });
check('withdrawal request accepted (≥ minimum)', wok.status === 200 && wok.json?.withdrawal?.status === 'pending', `$${wok.json?.withdrawal?.amount_usd}`);
const wid = wok.json?.withdrawal?.id;

const wapprove = await req('POST', `/api/creator-hub/admin/withdrawals/${wid}/process`, { token: adminToken, body: { action: 'approve' } });
check('admin approves withdrawal', wapprove.status === 200 && wapprove.json?.withdrawal?.status === 'approved');
const wpay = await req('POST', `/api/creator-hub/admin/withdrawals/${wid}/process`, { token: adminToken, body: { action: 'mark_paid', payout_ref: 'e2e-test' } });
check('mark-paid LOCKED behind PAYOUTS_ENABLED=false', wpay.status === 403 && wpay.json?.code === 'payouts_disabled');

// ---- 9. like / comment / follow (auth) ----------------------------------------------
const likeAnon = await req('POST', `/api/creator-hub/videos/${videoId}/like`, { body: {} });
check('anonymous like rejected (401)', likeAnon.status === 401);
const likeCreator = await req('POST', `/api/creator-hub/videos/${videoId}/like`, { token: creatorToken });
check('creator likes own video (allowed by API)', likeCreator.status === 200);

// ---- 10. reports + copyright ---------------------------------------------------------
const rep = await req('POST', '/api/creator-hub/reports', { body: { video_id: videoId, content: 'E2E test report — please review.' } });
check('public video report accepted', rep.status === 200);
const adminReports = await req('GET', '/api/creator-hub/admin/reports', { token: adminToken });
check('admin sees the report', adminReports.json?.reports?.some((r) => r.video_id === videoId));
const resolved = await req('POST', `/api/creator-hub/admin/reports/${adminReports.json.reports[0].id}/resolve`, { token: adminToken, body: { status: 'dismissed' } });
check('admin resolves report', resolved.status === 200);

// ---- 11. fraud review visibility -------------------------------------------------------
const fraud = await req('GET', '/api/creator-hub/admin/fraud/sessions', { token: adminToken });
check('fraud review lists real sessions', fraud.status === 200 && (fraud.json?.sessions?.length ?? 0) >= 3, `sessions=${fraud.json?.sessions?.length}`);

// ---- 12. settings restore + QA status ---------------------------------------------------
const restore = await req('PUT', '/api/creator-hub/admin/settings', { token: adminToken, body: originalSettings });
check('admin settings restored (min_watch_seconds=30)', restore.json?.settings?.min_watch_seconds === 30);
const qa = await req('GET', '/api/creator-hub/admin/qa', { token: adminToken });
check('admin QA view reports persistence', qa.status === 200 && !!qa.json?.persistence_mode, `mode=${qa.json?.persistence_mode}`);

// ---- summary -------------------------------------------------------------------------------
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed. persistence=${persistence}`);
server.close();
process.exit(passed === results.length ? 0 : 1);
