// Creator Hub — ADMIN endpoints (moderation, strikes, earnings, withdrawals,
// settings, feature flags, fraud review, QA). Every route requires the
// platform admin middleware passed in via deps (from routes/api.ts).
import { Router, Request, Response, NextFunction } from 'express';
import { store, asCreator, asVideo, asWithdrawal } from './store.js';
import { HttpError, resolveViewer, hashIp, clientIp } from './auth.js';
import type { CreatorRow, CreatorVideoRow, CreatorFlags } from './types.js';
import { hit as rateHit } from './rateLimit.js';
import { recomputeCreatorEarnings, adminProcessWithdrawal, rollupLedger, getEarningsSummary } from './earnings.js';
import { markSessionReviewed } from './views.js';
import type { CreatorHubDeps } from './routes.js';

type H = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (h: H) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(h(req, res)).catch(next); };
const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: message, code });

const HANDLE_RE = /^[a-z0-9_]{3,32}$/;
const ADMIN_USER_AGENT = 'streamplay-admin';

async function notify(creatorId: string, type: 'info' | 'approval' | 'rejection' | 'strike' | 'payout' | 'system', title: string, body: string | null, data: Record<string, unknown> = {}) {
  await store.insert('creator_notifications', { creator_id: creatorId, type, title, body, data });
}

async function ensureProfile(creatorId: string): Promise<Record<string, unknown>> {
  const existing = await store.findOne('creator_profiles', { creator_id: creatorId });
  if (existing) return existing;
  return store.insert('creator_profiles', { creator_id: creatorId, total_followers: 0, total_likes: 0, total_views: 0 });
}

// Issue a strike; auto-suspends at 3 active strikes. Returns updated strike list.
async function issueStrike(creatorId: string, videoId: string | null, reason: string, severity: number, issuedBy: string) {
  await store.insert('creator_strikes', { creator_id: creatorId, video_id: videoId, reason: reason.slice(0, 500), severity, status: 'active', issued_by: issuedBy });
  const active = await store.find('creator_strikes', { eq: { creator_id: creatorId, status: 'active' }, limit: 100 });
  let suspended = false;
  if (active.length >= 3) {
    await store.update('creators', creatorId, { status: 'suspended', suspended_until: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    suspended = true;
  }
  await notify(creatorId, 'strike', `Strike issued (${active.length} active)`, reason.slice(0, 300), { video_id: videoId, severity, suspended });
  return { strike_count: active.length, auto_suspended: suspended };
}

export function createAdminCreatorRouter(deps: CreatorHubDeps) {
  const r = Router();
  r.use(deps.requireAdmin);

  // ---- QA / observability ---------------------------------------------------
  r.get('/qa', wrap(async (_req, res) => {
    const mode = await store.probe();
    const counts: Record<string, number> = {};
    if (mode === 'sql') {
      for (const t of ['creators', 'creator_videos', 'video_views', 'creator_withdrawals'] as const) {
        try { counts[t] = (await store.find(t, { limit: 1000 })).length; } catch { counts[t] = -1; }
      }
    }
    const [flags, settings] = await Promise.all([store.getFlags(), store.getSettings()]);
    res.json({
      persistence_mode: mode,
      hint: mode === 'memory'
        ? 'Apply supabase/migrations/20261009_creator_hub.sql in the Supabase SQL Editor to make Creator Hub durable. All flows work in memory meanwhile (data resets on cold start).'
        : 'Durable Supabase persistence active.',
      table_counts: counts,
      flags, settings,
      storage_bucket: 'creator-media (private; signed-URL access only)',
    });
  }));

  r.post('/qa/recheck', wrap(async (_req, res) => {
    const mode = await store.probe(true);
    res.json({ persistence_mode: mode });
  }));

  // one-click QA creator for admin testing (real Supabase Auth user + creator row)
  r.post('/qa/seed-creator', wrap(async (_req, res) => {
    if (!rateHit('qa-seed', 10, 3_600_000)) return fail(res, 429, 'rate_limited', 'Too many QA seeds; wait a while.');
    const svc = (await import('../db/supabase.js')).getServiceSupabase();
    if (!svc) return fail(res, 503, 'service_role_missing', 'SUPABASE_SERVICE_ROLE_KEY is not configured.');
    const stamp = Date.now().toString(36);
    const email = `qa-${stamp}@creator-hub.streamplay.test`;
    const password = `Qa-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}!7`;
    const handle = `qa_${stamp.slice(-8)}`;
    try {
      const { data, error } = await svc.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role: 'creator', qa: true },
      });
      if (error || !data.user) return fail(res, 502, 'auth_create_failed', error?.message ?? 'Could not create auth user.');
      const creator = await store.insert('creators', {
        user_id: data.user.id, handle, display_name: `QA Creator ${stamp}`, email,
        status: 'active', monetization_enabled: false,
      });
      await ensureProfile(String(creator.id));
      res.json({
        creator: { id: creator.id, handle, email },
        login_hint: { email, password, note: 'Log in via the normal sign-in form to test the creator portal. Password is shown ONCE.' },
      });
    } catch (e) {
      return fail(res, 500, 'seed_failed', e instanceof Error ? e.message : 'seed failed');
    }
  }));

  // ---- creators management ----------------------------------------------------
  r.get('/creators', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const eq: Record<string, unknown> = {};
    if (q.status && ['pending', 'active', 'suspended', 'banned'].includes(q.status)) eq.status = q.status;
    const rows = await store.find('creators', {
      limit: Math.min(200, Number(q.limit ?? 100)), order: { field: 'created_at' },
      ...(q.q ? { ilike: { handle: `%${q.q.toLowerCase()}%` } } : {}),
      ...(Object.keys(eq).length ? { eq } : {}),
    });
    const ids = rows.map((c) => String(c.id));
    const profiles = ids.length ? await store.find('creator_profiles', { inEq: { creator_id: ids }, limit: ids.length }) : [];
    const pMap = new Map(profiles.map((p) => [String(p.creator_id), p]));
    res.json({
      creators: rows.map((c) => ({
        ...c,
        total_views: pMap.get(String(c.id))?.total_views ?? 0,
        total_followers: pMap.get(String(c.id))?.total_followers ?? 0,
      })),
    });
  }));

  r.post('/creators', wrap(async (req, res) => {
    if (!rateHit(`admin-create-creator:${req.ip}`, 20, 3_600_000)) return fail(res, 429, 'rate_limited', 'Slow down.');
    const admin = res.locals.adminEmail as string | undefined;
    const b = (req.body ?? {}) as Record<string, string>;
    const handle = String(b.handle ?? '').toLowerCase().trim();
    const email = String(b.email ?? '').toLowerCase().trim();
    const displayName = String(b.display_name ?? '').trim() || handle;
    if (!HANDLE_RE.test(handle)) return fail(res, 400, 'bad_handle', 'Handle must be 3–32 chars: a-z, 0-9, underscore.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'bad_email', 'Valid email required.');
    if (await store.findOne('creators', { handle })) return fail(res, 409, 'handle_taken', 'Handle already exists.');

    const svc = (await import('../db/supabase.js')).getServiceSupabase();
    if (!svc) return fail(res, 503, 'service_role_missing', 'SUPABASE_SERVICE_ROLE_KEY is not configured.');
    // find existing auth user by email, else create one (password returned once)
    let userId: string | null = null; let generatedPassword: string | null = null;
    const { data: list } = await svc.auth.admin.listUsers({ perPage: 500, page: 1 });
    const existingUser = (list?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
    if (existingUser) userId = existingUser.id;
    else {
      const password = `Sp-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}!7`;
      const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'creator' } });
      if (error || !data.user) return fail(res, 502, 'auth_create_failed', error?.message ?? 'Could not create auth user.');
      userId = data.user.id; generatedPassword = password;
    }
    const existingCreator = await store.findOne('creators', { user_id: userId });
    if (existingCreator) return fail(res, 409, 'already_creator', 'This user already has a creator account.');
    const creator = asCreator(await store.insert('creators', {
      user_id: userId, handle, display_name: displayName, email,
      status: b.status === 'pending' ? 'pending' : 'active',
      monetization_enabled: false, created_by: admin ?? null,
    }) as Record<string, unknown>);
    await ensureProfile(creator.id);
    res.json({
      creator,
      generated_password: generatedPassword,
      note: generatedPassword ? 'Share the generated password securely; it is shown once.' : 'Linked to existing account.',
    });
  }));

  r.put('/creators/:id', wrap(async (req, res) => {
    const raw = await store.get('creators', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Creator not found.');
    const creator = asCreator(raw);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (b.status && ['pending', 'active', 'suspended', 'banned'].includes(String(b.status))) {
      patch.status = b.status;
      if (b.status === 'suspended' && b.suspend_days) patch.suspended_until = new Date(Date.now() + Number(b.suspend_days) * 86_400_000).toISOString();
      if (b.status === 'active') patch.suspended_until = null;
    }
    if (b.monetization_enabled !== undefined) patch.monetization_enabled = Boolean(b.monetization_enabled);
    if (b.access_tier_override !== undefined) patch.access_tier_override = b.access_tier_override === null ? null : String(b.access_tier_override);
    if (b.display_name) patch.display_name = String(b.display_name).slice(0, 60);
    const updated = await store.update('creators', creator.id, patch);
    res.json({ creator: updated });
  }));

  // ---- video moderation ---------------------------------------------------------
  r.get('/videos', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const eq: Record<string, unknown> = {};
    if (q.status && ['draft', 'pending_review', 'published', 'rejected', 'taken_down'].includes(q.status)) eq.status = q.status;
    if (q.creator_id) eq.creator_id = q.creator_id;
    const rows = await store.find('creator_videos', {
      limit: Math.min(200, Number(q.limit ?? 100)), order: { field: 'created_at' },
      ...(q.q ? { ilike: { title: `%${q.q}%` } } : {}),
      ...(Object.keys(eq).length ? { eq } : {}),
    });
    const creatorIds = Array.from(new Set(rows.map((v) => String(v.creator_id))));
    const creators = creatorIds.length ? await store.find('creators', { inEq: { id: creatorIds }, limit: creatorIds.length }) : [];
    const cMap = new Map(creators.map((c) => [String(c.id), c]));
    res.json({
      videos: rows.map((v) => ({
        ...v,
        creator: cMap.get(String(v.creator_id)) ? { id: v.creator_id, handle: cMap.get(String(v.creator_id))!.handle, display_name: cMap.get(String(v.creator_id))!.display_name } : null,
      })),
    });
  }));

  r.post('/videos/:id/approve', wrap(async (req, res) => {
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (video.status === 'published') return fail(res, 409, 'bad_state', 'Already published.');
    const updated = await store.update('creator_videos', video.id, {
      status: 'published', published_at: new Date().toISOString(),
      rejection_reason: null, moderated_at: new Date().toISOString(),
    });
    await notify(video.creator_id, 'approval', 'Video approved', `“${video.title}” is now live on StreamPlay.`, { video_id: video.id });
    res.json({ video: updated });
  }));

  r.post('/videos/:id/reject', wrap(async (req, res) => {
    const reason = String((req.body as { reason?: string })?.reason ?? '').trim();
    if (reason.length < 3) return fail(res, 400, 'bad_request', 'A rejection reason (≥3 chars) is required.');
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    const updated = await store.update('creator_videos', video.id, {
      status: 'rejected', rejection_reason: reason.slice(0, 500), moderated_at: new Date().toISOString(),
    });
    await notify(video.creator_id, 'rejection', 'Video rejected', `“${video.title}”: ${reason}`, { video_id: video.id });
    res.json({ video: updated });
  }));

  r.post('/videos/:id/takedown', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const reason = String(b.reason ?? 'Policy violation').slice(0, 500);
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    const updated = await store.update('creator_videos', video.id, {
      status: 'taken_down', rejection_reason: reason, moderated_at: new Date().toISOString(),
    });
    let strikeResult = null;
    if (b.issue_strike !== false) {
      strikeResult = await issueStrike(video.creator_id, video.id, `Takedown: ${reason}`, Number(b.severity ?? 2), ADMIN_USER_AGENT);
    }
    await notify(video.creator_id, 'system', 'Video taken down', `“${video.title}”: ${reason}`, { video_id: video.id });
    res.json({ video: updated, strike: strikeResult });
  }));

  // per-video free/paid control (the exact admin override mechanism)
  r.post('/videos/:id/access', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const tier = String(b.access_tier ?? '');
    if (!['free', 'paid', 'auto'].includes(tier)) return fail(res, 400, 'bad_tier', 'access_tier must be free, paid, or auto.');
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    const patch: Record<string, unknown> = { access_tier: tier };
    if (b.free_until !== undefined) patch.free_until = b.free_until === null ? null : String(b.free_until);
    const updated = await store.update('creator_videos', video.id, patch);
    res.json({ video: updated });
  }));

  // per-creator global access override
  r.post('/creators/:id/access', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const tier = String(b.access_tier_override ?? '');
    if (!['free', 'paid', 'auto', ''].includes(tier)) return fail(res, 400, 'bad_tier', 'access_tier_override must be free, paid, auto, or empty.');
    const raw = await store.get('creators', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Creator not found.');
    const updated = await store.update('creators', req.params.id, { access_tier_override: tier === '' ? null : tier });
    res.json({ creator: updated });
  }));

  // ---- reports --------------------------------------------------------------------
  r.get('/reports', wrap(async (_req, res) => {
    const rows = await store.find('video_engagements', { eq: { type: 'report' }, order: { field: 'created_at' }, limit: 200 });
    const videoIds = Array.from(new Set(rows.map((x) => String(x.video_id))));
    const videos = videoIds.length ? await store.find('creator_videos', { inEq: { id: videoIds }, limit: videoIds.length }) : [];
    const vMap = new Map(videos.map((v) => [String(v.id), v]));
    res.json({
      reports: rows.map((x) => ({
        ...x,
        video: vMap.get(String(x.video_id)) ? { id: x.video_id, title: vMap.get(String(x.video_id))!.title, status: vMap.get(String(x.video_id))!.status } : null,
      })),
    });
  }));

  r.post('/reports/:id/resolve', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const status = String(b.status ?? '');
    if (!['resolved', 'dismissed', 'reviewing', 'open'].includes(status)) return fail(res, 400, 'bad_status', 'Invalid status.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) {
      return fail(res, 404, 'not_found', 'Report not found.');
    }
    const raw = await store.get('video_engagements', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Report not found.');
    const updated = await store.update('video_engagements', req.params.id, {
      status, resolved_by: ADMIN_USER_AGENT, resolved_at: new Date().toISOString(),
    });
    res.json({ report: updated });
  }));

  r.get('/copyright-reports', wrap(async (_req, res) => {
    const rows = await store.find('copyright_reports', { order: { field: 'created_at' }, limit: 200 });
    res.json({ reports: rows });
  }));

  r.post('/copyright-reports/:id/action', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const action = String(b.action ?? '');
    if (!['resolve', 'dismiss', 'takedown_and_strike'].includes(action)) return fail(res, 400, 'bad_action', 'action must be resolve | dismiss | takedown_and_strike.');
    const raw = await store.get('copyright_reports', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Copyright report not found.');
    const report = raw as Record<string, unknown>;
    let strikeResult = null;
    if (action === 'takedown_and_strike' && report.video_id) {
      const videoRaw = await store.get('creator_videos', String(report.video_id));
      if (videoRaw) {
        const video = asVideo(videoRaw);
        await store.update('creator_videos', video.id, {
          status: 'taken_down', rejection_reason: 'Copyright claim', moderated_at: new Date().toISOString(),
        });
        strikeResult = await issueStrike(video.creator_id, video.id, `Copyright claim: ${String(report.details).slice(0, 200)}`, 3, ADMIN_USER_AGENT);
      }
    }
    const updated = await store.update('copyright_reports', req.params.id, {
      status: action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : 'resolved',
      resolution_note: String(b.note ?? '').slice(0, 1000) || null,
      reviewed_by: ADMIN_USER_AGENT, reviewed_at: new Date().toISOString(),
    });
    res.json({ report: updated, strike: strikeResult });
  }));

  // ---- strikes ---------------------------------------------------------------------
  r.get('/strikes', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const rows = await store.find('creator_strikes', {
      limit: 200, order: { field: 'created_at' },
      ...(q.creator_id ? { eq: { creator_id: q.creator_id } } : {}),
    });
    res.json({ strikes: rows });
  }));

  r.post('/strikes', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!b.creator_id || !b.reason) return fail(res, 400, 'bad_request', 'creator_id and reason are required.');
    const severity = Math.min(3, Math.max(1, Number(b.severity ?? 1)));
    const result = await issueStrike(String(b.creator_id), b.video_id ? String(b.video_id) : null, String(b.reason), severity, ADMIN_USER_AGENT);
    res.json(result);
  }));

  r.post('/strikes/:id/reverse', wrap(async (req, res) => {
    const raw = await store.get('creator_strikes', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Strike not found.');
    const updated = await store.update('creator_strikes', req.params.id, { status: 'reversed' });
    res.json({ strike: updated });
  }));

  // ---- earnings & withdrawals -------------------------------------------------------
  r.get('/earnings', wrap(async (_req, res) => {
    const creators = await store.find('creators', { limit: 500 });
    const out = [];
    for (const cRaw of creators) {
      const c = asCreator(cRaw);
      out.push(await getEarningsSummary(c.id));
    }
    res.json({ earnings: out, label: 'Estimated Earnings' });
  }));

  r.get('/earnings/:creatorId/ledger', wrap(async (req, res) => {
    const rows = await store.find('creator_earnings_ledger', { eq: { creator_id: req.params.creatorId }, order: { field: 'created_at' }, limit: 200 });
    res.json({ ledger: rows });
  }));

  r.post('/earnings/:creatorId/adjust', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const amount = Number(b.amount_usd);
    if (!Number.isFinite(amount)) return fail(res, 400, 'bad_amount', 'amount_usd must be a number.');
    const raw = await store.get('creators', req.params.creatorId);
    if (!raw) return fail(res, 404, 'not_found', 'Creator not found.');
    await store.insert('creator_earnings_ledger', {
      creator_id: req.params.creatorId, entry_type: 'adjustment',
      views: 0, amount_usd: amount, description: String(b.description ?? 'Admin adjustment').slice(0, 300),
      created_by: ADMIN_USER_AGENT,
    });
    const settings = await store.getSettings();
    const flags = await store.getFlags();
    res.json({ summary: await recomputeCreatorEarnings(req.params.creatorId, settings, flags) });
  }));

  r.get('/withdrawals', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const rows = await store.find('creator_withdrawals', {
      limit: 200, order: { field: 'created_at' },
      ...(q.status && ['pending', 'approved', 'paid', 'rejected'].includes(q.status) ? { eq: { status: q.status } } : {}),
    });
    res.json({ withdrawals: rows });
  }));

  r.post('/withdrawals/:id/process', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const action = String(b.action ?? '');
    if (!['approve', 'reject', 'mark_paid'].includes(action)) return fail(res, 400, 'bad_action', 'action must be approve | reject | mark_paid.');
    const [settings, flags] = await Promise.all([store.getSettings(), store.getFlags()]);
    try {
      const w = await adminProcessWithdrawal(req.params.id, action as 'approve' | 'reject' | 'mark_paid', ADMIN_USER_AGENT, settings, flags, {
        adminNote: b.admin_note ? String(b.admin_note) : undefined,
        payoutRef: b.payout_ref ? String(b.payout_ref) : undefined,
      });
      res.json({ withdrawal: w });
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }));

  r.get('/payout-methods', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const rows = await store.find('payout_methods', {
      limit: 200,
      ...(q.creator_id ? { eq: { creator_id: q.creator_id } } : {}),
    });
    res.json({ methods: rows });
  }));

  // ---- fraud review -----------------------------------------------------------------
  r.get('/fraud/sessions', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const rows = await store.find('video_watch_sessions', {
      limit: Math.min(200, Number(q.limit ?? 50)), order: { field: 'started_at' },
      ...(q.only_suspicious === '1' ? { eq: { is_suspicious: true } } : {}),
    });
    const videoIds = Array.from(new Set(rows.map((s) => String(s.video_id))));
    const videos = videoIds.length ? await store.find('creator_videos', { inEq: { id: videoIds }, limit: videoIds.length }) : [];
    const vMap = new Map(videos.map((v) => [String(v.id), v]));
    res.json({
      sessions: rows.map((s) => ({
        id: s.id, video_id: s.video_id, video_title: vMap.get(String(s.video_id))?.title ?? null,
        viewer_user_id: s.viewer_user_id, viewer_key: s.viewer_key,
        watch_seconds: s.watch_seconds, heartbeats: s.heartbeats,
        started_at: s.started_at, ended_at: s.ended_at,
        is_valid: s.is_valid, invalid_reason: s.invalid_reason,
        is_suspicious: s.is_suspicious, suspicion_score: s.suspicion_score, suspicion_notes: s.suspicion_notes,
      })),
    });
  }));

  r.post('/fraud/sessions/:id/:action', wrap(async (req, res) => {
    const action = req.params.action;
    if (!['validate', 'invalidate'].includes(action)) return fail(res, 400, 'bad_action', 'action must be validate or invalidate.');
    const session = await markSessionReviewed(req.params.id, ADMIN_USER_AGENT, action as 'validate' | 'invalidate');
    res.json({ session });
  }));

  // ---- settings & flags --------------------------------------------------------------
  r.get('/settings', wrap(async (_req, res) => {
    const [settings, flags] = await Promise.all([store.getSettings(true), store.getFlags()]);
    res.json({ settings, flags });
  }));

  r.put('/settings', wrap(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const settings = await store.saveSettings(b as Parameters<typeof store.saveSettings>[0], ADMIN_USER_AGENT);
    res.json({ settings });
  }));

  r.put('/flags/:key', wrap(async (req, res) => {
    const key = req.params.key as keyof CreatorFlags;
    const validKeys: Array<keyof CreatorFlags> = ['CREATOR_HUB_ENABLED', 'CREATOR_UPLOAD_ENABLED', 'CREATOR_MONETIZATION_ENABLED', 'PAYOUTS_ENABLED', 'PAID_CONTENT_ENABLED'];
    if (!validKeys.includes(key)) return fail(res, 400, 'bad_key', 'Unknown feature flag.');
    const enabled = Boolean((req.body as { enabled?: boolean })?.enabled);
    await store.setFlag(key, enabled, ADMIN_USER_AGENT);
    res.json({ flags: await store.getFlags(true) });
  }));

  r.get('/overview', wrap(async (_req, res) => {
    const [creators, videos, sessions, views, withdrawals, flags, settings] = await Promise.all([
      store.find('creators', { limit: 1000 }),
      store.find('creator_videos', { limit: 1000 }),
      store.find('video_watch_sessions', { limit: 1000 }),
      store.find('video_views', { limit: 1000 }),
      store.find('creator_withdrawals', { limit: 1000 }),
      store.getFlags(), store.getSettings(),
    ]);
    res.json({
      totals: {
        creators: creators.length,
        creators_active: creators.filter((c) => c.status === 'active').length,
        videos: videos.length,
        videos_published: videos.filter((v) => v.status === 'published').length,
        videos_pending: videos.filter((v) => v.status === 'pending_review').length,
        watch_sessions: sessions.length,
        valid_views: views.length,
        suspicious_sessions: sessions.filter((s) => s.is_suspicious).length,
        withdrawals_pending: withdrawals.filter((w) => w.status === 'pending').length,
      },
      flags, settings, persistence: store.mode,
    });
  }));

  return r;
}

// keep imports referenced (some helpers used indirectly by future admin flows)
void asWithdrawal; void resolveViewer; void hashIp; void clientIp; void rollupLedger;
