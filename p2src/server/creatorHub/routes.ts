// Creator Hub API — public browse/watch + creator self-service endpoints.
// Admin endpoints live in adminRoutes.ts and are merged by createCreatorHubRouter.
import { Router, Request, Response, NextFunction } from 'express';
import { store, asCreator, asVideo, asEngagement } from './store.js';
import {
  resolveViewer, resolveCreator, assertCreatorUsable, HttpError, hashIp, clientIp,
} from './auth.js';
import type { CreatorRow, CreatorProfileRow, CreatorVideoRow, CreatorIdentity } from './types.js';
import { hit as rateHit } from './rateLimit.js';
import { startWatch, heartbeat, endWatch, resolveAccess } from './views.js';
import { recomputeCreatorEarnings, requestWithdrawal, getEarningsSummary } from './earnings.js';
import { rollupLedger } from './earnings.js';

export interface CreatorHubDeps {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
}

const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET = 'creator-media';
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

type H = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (h: H) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(h(req, res)).catch(next); };

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: message, code });
}

// attach declared-but-unknown express fields
interface Ctx { creator?: CreatorRow; identity?: CreatorIdentity }
const ctx = (req: Request): Ctx => req as unknown as Ctx;

// ---- shared shaping helpers -------------------------------------------------
async function decorateVideos(rows: Record<string, unknown>[], viewerId: string | null) {
  if (!rows.length) return [];
  const creatorIds = Array.from(new Set(rows.map((r) => String(r.creator_id))));
  const settings = await store.getSettings();
  const flags = await store.getFlags();
  const creators = await store.find('creators', { inEq: { id: creatorIds }, limit: creatorIds.length });
  const profiles = await store.find('creator_profiles', { inEq: { creator_id: creatorIds }, limit: creatorIds.length });
  const cMap = new Map(creators.map((c) => [String(c.id), c]));
  const pMap = new Map(profiles.map((p) => [String(p.creator_id), p]));
  return Promise.all(rows.map(async (v) => {
    const c = cMap.get(String(v.creator_id)) as CreatorRow | undefined;
    const p = pMap.get(String(v.creator_id));
    const access = await resolveAccess(asVideo(v), c ?? null, settings, flags, viewerId);
    let thumbUrl: string | null = null;
    if (v.thumb_path) {
      try { thumbUrl = await store.createReadSignedUrl(String(v.storage_bucket || BUCKET), String(v.thumb_path), 6 * 3600); } catch { /* noop */ }
    }
    return {
      id: v.id, title: v.title, description: v.description, kind: v.kind,
      category_id: v.category_id ?? null,
      status: v.status, published_at: v.published_at, duration_seconds: v.duration_seconds,
      valid_views: v.valid_views, likes_count: v.likes_count, comments_count: v.comments_count,
      access, thumb_url: thumbUrl, created_at: v.created_at,
      creator: c ? {
        id: c.id, handle: c.handle, display_name: c.display_name,
        is_verified: !!p?.is_verified, total_followers: p?.total_followers ?? 0,
      } : null,
    };
  }));
}

function sanitizeOwnVideo(v: Record<string, unknown>) {
  return { ...v };
}

async function notify(creatorId: string, type: 'info' | 'approval' | 'rejection' | 'strike' | 'payout' | 'system', title: string, body: string | null, data: Record<string, unknown> = {}) {
  await store.insert('creator_notifications', { creator_id: creatorId, type, title, body, data });
}

async function bumpLikeCounters(video: CreatorVideoRow, delta: 1 | -1) {
  if (store.mode === 'sql') return; // DB triggers maintain likes counters in sql mode
  await store.update('creator_videos', video.id, { likes_count: Math.max(0, Number(video.likes_count ?? 0) + delta) });
  const prof = await store.findOne('creator_profiles', { creator_id: video.creator_id });
  if (prof) await store.update('creator_profiles', String(prof.id), { total_likes: Math.max(0, Number(prof.total_likes ?? 0) + delta) });
}

async function followerCountDelta(creatorId: string, delta: 1 | -1) {
  // no DB trigger maintains follower totals — always update explicitly
  const prof = await store.findOne('creator_profiles', { creator_id: creatorId });
  if (prof) await store.update('creator_profiles', String(prof.id), { total_followers: Math.max(0, Number(prof.total_followers ?? 0) + delta) });
}

// =============================================================================
export function createPublicCreatorRouter() {
  const r = Router();

  // flags + public settings snapshot
  r.get('/flags', wrap(async (_req, res) => {
    const [flags, settings] = await Promise.all([store.getFlags(true), store.getSettings(true)]);
    res.json({
      flags,
      settings: {
        free_access_percentage: settings.free_access_percentage,
        paid_access_percentage: settings.paid_access_percentage,
        free_access_duration_days: settings.free_access_duration_days,
        minimum_withdrawal_usd: settings.minimum_withdrawal_usd,
        min_eligible_views: settings.min_eligible_views,
        payout_per_10000_valid_views_usd: settings.payout_per_10000_valid_views_usd,
        moderation_enabled: settings.moderation_enabled,
      },
      persistence: store.mode,
    });
  }));

  r.get('/categories', wrap(async (_req, res) => {
    const rows = await store.find('creator_categories', { eq: { is_active: true }, order: { field: 'sort_order', asc: true } });
    res.json({ categories: rows });
  }));

  // public browse (published only)
  r.get('/videos', wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(60, Math.max(1, Number(q.limit ?? 24)));
    const offset = Math.max(0, Number(q.offset ?? 0));
    const eq: Record<string, unknown> = { status: 'published' };
    if (q.kind && ['video', 'short', 'live'].includes(q.kind)) eq.kind = q.kind;
    if (q.category_id) eq.category_id = q.category_id;
    const opts: Parameters<typeof store.find>[1] = {
      eq, limit, offset,
      order: { field: q.sort === 'views' ? 'valid_views' : 'published_at' },
      ...(q.q ? { ilike: { title: `%${q.q}%` } } : {}),
    };
    const rows = await store.find('creator_videos', opts);
    const viewer = await resolveViewer(req);
    res.json({ videos: await decorateVideos(rows, viewer?.userId ?? null), limit, offset });
  }));

  r.get('/videos/:id', wrap(async (req, res) => {
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    const isOwner = (await resolveViewer(req))?.userId;
    if (video.status !== 'published') {
      const own = video.creator_id && isOwner
        ? await store.findOne('creators', { id: video.creator_id, user_id: isOwner })
        : null;
      if (!own) return fail(res, 404, 'not_found', 'Video not found.');
    }
    const [decorated] = await decorateVideos([raw], isOwner ?? null);
    res.json({ video: decorated });
  }));

  r.get('/videos/:id/access', wrap(async (req, res) => {
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (video.status !== 'published') return fail(res, 404, 'not_found', 'Video not found.');
    const [flags, settings, viewer] = await Promise.all([store.getFlags(), store.getSettings(), resolveViewer(req)]);
    const creatorRaw = await store.get('creators', video.creator_id);
    const access = await resolveAccess(video, creatorRaw ? asCreator(creatorRaw) : null, settings, flags, viewer?.userId ?? null);
    res.json({ access });
  }));

  // ---- watch sessions (valid-view pipeline) ---------------------------------
  r.post('/videos/:id/watch/start', wrap(async (req, res) => {
    const ip = clientIp(req);
    if (!rateHit(`watch-start:${ip ?? 'noip'}`, 30, 3_600_000)) {
      return fail(res, 429, 'rate_limited', 'Too many watch sessions from this network. Slow down.');
    }
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (video.status !== 'published') return fail(res, 404, 'not_found', 'Video not found.');
    const creatorRaw = await store.get('creators', video.creator_id);
    if (!creatorRaw) return fail(res, 404, 'not_found', 'Creator not found.');
    const [settings, flags, viewer] = await Promise.all([store.getSettings(), store.getFlags(), resolveViewer(req)]);
    const access = await resolveAccess(video, asCreator(creatorRaw), settings, flags, viewer?.userId ?? null);
    try {
      const { session, playbackUrl } = await startWatch({
        video, creator: asCreator(creatorRaw), viewerUserId: viewer?.userId ?? null,
        ipHash: hashIp(ip), userAgent: req.headers['user-agent'] ?? null, settings, access,
      });
      res.json({ sessionId: session.id, playbackUrl, access, minWatchSeconds: settings.min_watch_seconds, heartbeatSeconds: 15 });
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }));

  r.post('/watch/:sessionId/heartbeat', wrap(async (req, res) => {
    const ip = clientIp(req);
    if (!rateHit(`hb:${ip ?? 'noip'}`, 600, 600_000)) return fail(res, 429, 'rate_limited', 'Too many heartbeats.');
    const { deltaSeconds = 0, playing = true } = (req.body ?? {}) as { deltaSeconds?: number; playing?: boolean };
    const settings = await store.getSettings();
    try {
      const session = await heartbeat(req.params.sessionId, { deltaSeconds: Number(deltaSeconds), playing: Boolean(playing) }, settings);
      res.json({ ok: true, watch_seconds: session.watch_seconds, is_suspicious: session.is_suspicious });
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }));

  r.post('/watch/:sessionId/end', wrap(async (req, res) => {
    const ip = clientIp(req);
    if (!rateHit(`watch-end:${ip ?? 'noip'}`, 60, 3_600_000)) return fail(res, 429, 'rate_limited', 'Too many calls.');
    const [settings, flags] = await Promise.all([store.getSettings(), store.getFlags()]);
    try {
      const { session, validView } = await endWatch(req.params.sessionId, settings, flags);
      res.json({ ok: true, validView, is_valid: session.is_valid, invalid_reason: session.invalid_reason });
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }));

  // ---- engagements ------------------------------------------------------------
  r.post('/videos/:id/like', wrap(async (req, res) => {
    const viewer = await resolveViewer(req);
    if (!viewer) return fail(res, 401, 'auth_required', 'Sign in to like videos.');
    if (!rateHit(`like:${viewer.userId}`, 60, 600_000)) return fail(res, 429, 'rate_limited', 'Too many actions.');
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (video.status !== 'published') return fail(res, 404, 'not_found', 'Video not found.');
    const existing = await store.findOne('video_engagements', { video_id: video.id, user_id: viewer.userId, type: 'like' });
    if (existing) {
      await store.delete('video_engagements', { id: String(existing.id) });
      await bumpLikeCounters(video, -1);
      return res.json({ liked: false });
    }
    await store.insert('video_engagements', { video_id: video.id, creator_id: video.creator_id, user_id: viewer.userId, type: 'like' });
    await bumpLikeCounters(video, 1);
    res.json({ liked: true });
  }));

  r.get('/videos/:id/comments', wrap(async (req, res) => {
    const rows = await store.find('video_engagements', {
      eq: { video_id: req.params.id, type: 'comment' }, order: { field: 'created_at' }, limit: 100,
    });
    res.json({ comments: rows.map((c) => ({ id: c.id, user_id: c.user_id, content: c.content, created_at: c.created_at })) });
  }));

  r.post('/videos/:id/comments', wrap(async (req, res) => {
    const viewer = await resolveViewer(req);
    if (!viewer) return fail(res, 401, 'auth_required', 'Sign in to comment.');
    if (!rateHit(`comment:${viewer.userId}`, 20, 600_000)) return fail(res, 429, 'rate_limited', 'You are commenting too fast.');
    const content = String((req.body as { content?: string })?.content ?? '').trim();
    if (content.length < 1 || content.length > 2000) return fail(res, 400, 'bad_content', 'Comment must be 1–2000 characters.');
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (video.status !== 'published') return fail(res, 404, 'not_found', 'Video not found.');
    if (store.mode === 'memory') await store.update('creator_videos', video.id, { comments_count: Number(video.comments_count ?? 0) + 1 });
    const row = await store.insert('video_engagements', {
      video_id: video.id, creator_id: video.creator_id, user_id: viewer.userId,
      type: 'comment', content, ip_hash: hashIp(clientIp(req)),
    });
    res.json({ comment: { id: row.id, content: row.content, created_at: row.created_at } });
  }));

  // ---- reports (video + copyright) -------------------------------------------
  r.post('/reports', wrap(async (req, res) => {
    const ip = clientIp(req);
    if (!rateHit(`report:${ip ?? 'noip'}`, 10, 3_600_000)) return fail(res, 429, 'rate_limited', 'Too many reports from this network.');
    const { video_id, content } = (req.body ?? {}) as { video_id?: string; content?: string };
    if (!video_id || !content?.trim()) return fail(res, 400, 'bad_request', 'video_id and content are required.');
    const video = await store.get('creator_videos', video_id);
    if (!video) return fail(res, 404, 'not_found', 'Video not found.');
    const viewer = await resolveViewer(req);
    const row = await store.insert('video_engagements', {
      video_id, creator_id: String(video.creator_id), user_id: viewer?.userId ?? null,
      type: 'report', content: content.trim().slice(0, 2000), ip_hash: hashIp(ip),
    });
    res.json({ ok: true, report_id: row.id });
  }));

  r.post('/copyright-reports', wrap(async (req, res) => {
    const ip = clientIp(req);
    if (!rateHit(`dmca:${ip ?? 'noip'}`, 5, 3_600_000)) return fail(res, 429, 'rate_limited', 'Too many submissions.');
    const b = (req.body ?? {}) as Record<string, string>;
    if (!b.reporter_name || !b.reporter_email || !b.details) return fail(res, 400, 'bad_request', 'reporter_name, reporter_email and details are required.');
    const row = await store.insert('copyright_reports', {
      video_id: b.video_id || null,
      reporter_name: String(b.reporter_name).slice(0, 120),
      reporter_email: String(b.reporter_email).slice(0, 160),
      reporter_user_id: (await resolveViewer(req))?.userId ?? null,
      original_work_url: b.original_work_url?.slice(0, 500) ?? null,
      details: String(b.details).slice(0, 5000),
    });
    res.json({ ok: true, report_id: row.id });
  }));

  // ---- creators directory ------------------------------------------------------
  r.get('/creators/:handle', wrap(async (req, res) => {
    const creatorRaw = await store.findOne('creators', { handle: String(req.params.handle).toLowerCase() });
    if (!creatorRaw) return fail(res, 404, 'not_found', 'Creator not found.');
    const creator = asCreator(creatorRaw);
    const profile = await store.findOne('creator_profiles', { creator_id: creator.id });
    const videos = await store.find('creator_videos', { eq: { creator_id: creator.id, status: 'published' }, order: { field: 'published_at' }, limit: 24 });
    res.json({
      creator: { id: creator.id, handle: creator.handle, display_name: creator.display_name, created_at: creator.created_at },
      profile: profile ? { bio: profile.bio, avatar_url: profile.avatar_url, total_followers: profile.total_followers, total_likes: profile.total_likes, total_views: profile.total_views, is_verified: profile.is_verified } : null,
      videos: await decorateVideos(videos, (await resolveViewer(req))?.userId ?? null),
    });
  }));

  r.post('/creators/:id/follow', wrap(async (req, res) => {
    const viewer = await resolveViewer(req);
    if (!viewer) return fail(res, 401, 'auth_required', 'Sign in to follow creators.');
    if (!rateHit(`follow:${viewer.userId}`, 40, 3_600_000)) return fail(res, 429, 'rate_limited', 'Too many actions.');
    const creatorRaw = await store.get('creators', req.params.id);
    if (!creatorRaw) return fail(res, 404, 'not_found', 'Creator not found.');
    const creator = asCreator(creatorRaw);
    if (creator.user_id === viewer.userId) return fail(res, 400, 'self_follow', 'Creators cannot follow themselves.');
    const existing = await store.findOne('creator_followers', { creator_id: creator.id, follower_user_id: viewer.userId });
    if (existing) {
      await store.delete('creator_followers', { id: String(existing.id) });
      await followerCountDelta(creator.id, -1);
      return res.json({ following: false });
    }
    await store.insert('creator_followers', { creator_id: creator.id, follower_user_id: viewer.userId });
    await followerCountDelta(creator.id, 1);
    res.json({ following: true });
  }));

  // ---- earnings rollup cron (idempotent, period-tracked) ------------------------
  r.all('/cron/rollup', wrap(async (_req, res) => {
    const [settings, flags] = await Promise.all([store.getSettings(), store.getFlags()]);
    const result = await rollupLedger(settings, flags);
    res.json({ ok: true, ...result, persistence: store.mode });
  }));

  return r;
}

// =============================================================================
export function createCreatorSelfRouter() {
  const r = Router();

  // creator auth middleware
  const requireCreator = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const resolved = await resolveCreator(req);
      if (!resolved) return next(new HttpError(401, 'creator_auth_required', 'Sign in with your creator account.'));
      assertCreatorUsable(resolved.creator);
      ctx(req).creator = resolved.creator;
      ctx(req).identity = resolved.identity;
      next();
    } catch (e) { next(e); }
  };
  r.use(requireCreator);

  const me = (req: Request): CreatorRow => ctx(req).creator!;
  const identity = (req: Request): CreatorIdentity => ctx(req).identity!;

  r.get('/me', wrap(async (req, res) => {
    const creator = me(req);
    const profile = await store.findOne('creator_profiles', { creator_id: creator.id });
    const [earnings, flags, settings] = await Promise.all([getEarningsSummary(creator.id), store.getFlags(), store.getSettings()]);
    const activeStrikes = (await store.find('creator_strikes', { eq: { creator_id: creator.id, status: 'active' }, limit: 50 })).length;
    res.json({
      creator: { id: creator.id, handle: creator.handle, display_name: creator.display_name, email: creator.email, status: creator.status, monetization_enabled: creator.monetization_enabled, created_at: creator.created_at },
      profile: profile ?? null,
      earnings, flags, settings,
      copyright_status: { active_strikes: activeStrikes, max_strikes: 3, note: '3 active strikes can suspend your creator account.' },
      persistence: store.mode,
    });
  }));

  r.put('/me', wrap(async (req, res) => {
    const creator = me(req);
    const patch: Record<string, unknown> = {};
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.display_name === 'string' && b.display_name.trim().length >= 2 && b.display_name.trim().length <= 60) patch.display_name = b.display_name.trim();
    if (!Object.keys(patch).length) return fail(res, 400, 'bad_request', 'Nothing to update.');
    const updated = await store.update('creators', creator.id, patch);
    res.json({ creator: updated });
  }));

  r.put('/me/profile', wrap(async (req, res) => {
    const creator = me(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (b.bio != null) { const bio = String(b.bio); if (bio.length > 1000) return fail(res, 400, 'bad_request', 'Bio must be ≤ 1000 characters.'); patch.bio = bio; }
    if (b.avatar_url != null) patch.avatar_url = String(b.avatar_url).slice(0, 500) || null;
    if (b.links != null) patch.links = b.links;
    const profile = await store.findOne('creator_profiles', { creator_id: creator.id });
    if (!profile) {
      const created = await store.insert('creator_profiles', { creator_id: creator.id, ...patch });
      return res.json({ profile: created });
    }
    const updated = await store.update('creator_profiles', String(profile.id), patch);
    res.json({ profile: updated });
  }));

  r.post('/me/profile/avatar-url', wrap(async (req, res) => {
    const creator = me(req);
    if (!rateHit(`upload:${creator.id}`, 40, 86_400_000)) return fail(res, 429, 'rate_limited', 'Upload limit reached for today.');
    const { filename = 'avatar.jpg', mime = 'image/jpeg' } = (req.body ?? {}) as Record<string, string>;
    if (!IMAGE_MIME.has(mime)) return fail(res, 400, 'bad_mime', 'Avatar must be jpeg/png/webp.');
    const ext = mime.split('/')[1].replace('quicktime', 'mov');
    const path = `users/${creator.id}/avatar-${Date.now()}.${ext}`;
    const signed = await store.createUploadSignedUrl(BUCKET, path);
    res.json({ ...signed, path, bucket: BUCKET });
  }));

  // ---- my videos ---------------------------------------------------------------
  r.get('/me/videos', wrap(async (req, res) => {
    const creator = me(req);
    const q = req.query as Record<string, string>;
    const eq: Record<string, unknown> = { creator_id: creator.id };
    if (q.status && ['draft', 'pending_review', 'published', 'rejected', 'taken_down'].includes(q.status)) eq.status = q.status;
    if (q.kind && ['video', 'short', 'live'].includes(q.kind)) eq.kind = q.kind;
    const rows = await store.find('creator_videos', {
      eq, order: { field: 'created_at' }, limit: Math.min(100, Number(q.limit ?? 50)),
      ...(q.q ? { ilike: { title: `%${q.q}%` } } : {}),
    });
    res.json({ videos: rows.map(sanitizeOwnVideo) });
  }));

  r.post('/me/videos', wrap(async (req, res) => {
    const creator = me(req);
    const flags = await store.getFlags();
    if (!flags.CREATOR_HUB_ENABLED) return fail(res, 503, 'creator_hub_disabled', 'Creator Hub is disabled.');
    if (!flags.CREATOR_UPLOAD_ENABLED) return fail(res, 403, 'upload_disabled', 'Uploads are currently disabled.');
    if (!rateHit(`video-create:${creator.id}`, 30, 86_400_000)) return fail(res, 429, 'rate_limited', 'Too many videos created today.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const title = String(b.title ?? '').trim();
    if (title.length < 1 || title.length > 200) return fail(res, 400, 'bad_title', 'Title must be 1–200 characters.');
    const description = b.description == null ? null : String(b.description).slice(0, 5000);
    const kind = ['video', 'short', 'live'].includes(String(b.kind)) ? String(b.kind) : 'video';
    let category_id: string | null = null;
    if (b.category_id) {
      const cat = await store.get('creator_categories', String(b.category_id));
      if (!cat) return fail(res, 400, 'bad_category', 'Category not found.');
      category_id = String(cat.id);
    }
    if (description && description.length > 5000) return fail(res, 400, 'bad_description', 'Description must be ≤ 5000 characters.');
    const video = await store.insert('creator_videos', {
      creator_id: creator.id, title, description, kind, category_id,
      status: 'draft', access_tier: 'auto', storage_bucket: BUCKET,
      valid_views: 0, watch_seconds: 0, likes_count: 0, comments_count: 0,
    }) as unknown as CreatorVideoRow;
    res.json({ video: sanitizeOwnVideo(video as unknown as Record<string, unknown>) });
  }));

  r.put('/me/videos/:id', wrap(async (req, res) => {
    const creator = me(req);
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (!['draft', 'rejected'].includes(video.status)) return fail(res, 409, 'bad_state', `Cannot edit a video in state ${video.status}.`);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (b.title != null) {
      const title = String(b.title).trim();
      if (title.length < 1 || title.length > 200) return fail(res, 400, 'bad_title', 'Title must be 1–200 characters.');
      patch.title = title;
    }
    if (b.description != null) {
      const d = String(b.description);
      if (d.length > 5000) return fail(res, 400, 'bad_description', 'Description must be ≤ 5000 characters.');
      patch.description = d;
    }
    if (b.kind && ['video', 'short', 'live'].includes(String(b.kind))) patch.kind = b.kind;
    if (b.category_id !== undefined) {
      if (b.category_id === null) patch.category_id = null;
      else {
        const cat = await store.get('creator_categories', String(b.category_id));
        if (!cat) return fail(res, 400, 'bad_category', 'Category not found.');
        patch.category_id = cat.id;
      }
    }
    // status/valid_views/counters are intentionally NOT patchable by creators
    // (phase-1 DB triggers guard them server-side). An empty patch — e.g. a
    // self-publish attempt carrying only `status` — is a legal no-op: return
    // the current row instead of issuing a zero-column SQL UPDATE, which
    // PostgREST rejects.
    if (Object.keys(patch).length === 0) return res.json({ video: sanitizeOwnVideo(video as unknown as Record<string, unknown>) });
    const updated = await store.update('creator_videos', video.id, patch);
    res.json({ video: sanitizeOwnVideo(updated as Record<string, unknown>) });
  }));

  r.delete('/me/videos/:id', wrap(async (req, res) => {
    const creator = me(req);
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (!['draft', 'rejected'].includes(video.status)) return fail(res, 409, 'bad_state', 'Only drafts or rejected videos can be deleted. Published videos require a takedown request.');
    await store.delete('creator_videos', { id: video.id });
    res.json({ ok: true });
  }));

  // signed direct-to-storage upload URL
  r.post('/me/videos/:id/upload-url', wrap(async (req, res) => {
    const creator = me(req);
    const flags = await store.getFlags();
    if (!flags.CREATOR_UPLOAD_ENABLED) return fail(res, 403, 'upload_disabled', 'Uploads are currently disabled.');
    if (!rateHit(`upload:${creator.id}`, 40, 86_400_000)) return fail(res, 429, 'rate_limited', 'Upload limit reached for today.');
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (!['draft', 'rejected'].includes(video.status)) return fail(res, 409, 'bad_state', 'Media can only be uploaded for drafts.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const mime = String(b.mime ?? '');
    if (!VIDEO_MIME.has(mime)) return fail(res, 400, 'bad_mime', 'Media must be mp4/webm/mov.');
    const sizeBytes = Number(b.sizeBytes ?? 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) return fail(res, 400, 'bad_size', 'Media must be > 0 and ≤ 2 GiB.');
    const ext = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
    const path = `users/${creator.id}/${video.id}/${Date.now()}.${ext}`;
    await store.update('creator_videos', video.id, { storage_path: path, mime_type: mime, size_bytes: sizeBytes });
    const signed = await store.createUploadSignedUrl(BUCKET, path);
    res.json({ ...signed, path, bucket: BUCKET, max_bytes: MAX_UPLOAD_BYTES });
  }));

  // confirm upload; validates the stored object server-side
  r.post('/me/videos/:id/upload-complete', wrap(async (req, res) => {
    const creator = me(req);
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (!video.storage_path) return fail(res, 409, 'bad_state', 'No pending upload for this video.');
    const [settings, flags] = await Promise.all([store.getSettings(), store.getFlags()]);
    const stat = await store.statObject(video.storage_bucket || BUCKET, video.storage_path);
    if (!stat.exists) return fail(res, 400, 'upload_missing', 'Uploaded media was not found in storage. Upload first, then confirm.');
    if (stat.size != null && Number(stat.size) > MAX_UPLOAD_BYTES) return fail(res, 400, 'too_large', 'Media exceeds the 2 GiB limit.');
    const patch: Record<string, unknown> = { size_bytes: stat.size ?? video.size_bytes, mime_type: stat.mimeType ?? video.mime_type };
    if (typeof (req.body as { durationSeconds?: number })?.durationSeconds === 'number') {
      patch.duration_seconds = Math.max(0, Math.floor(Number((req.body as { durationSeconds?: number }).durationSeconds)));
    }
    // moderation policy: restricted content never auto-publishes when moderation is on
    let status: CreatorVideoRow['status'] = video.status;
    if (settings.moderation_enabled) {
      status = 'pending_review';
    } else if (video.kind === 'short' && settings.auto_publish_shorts) {
      status = 'published';
    } else {
      status = 'pending_review';
    }
    patch.status = status;
    if (status === 'published') patch.published_at = new Date().toISOString();
    const updated = await store.update('creator_videos', video.id, patch);
    res.json({ video: sanitizeOwnVideo(updated as Record<string, unknown>), moderation: settings.moderation_enabled ? 'queued_for_review' : 'auto_approved' });
  }));

  r.post('/me/videos/:id/submit', wrap(async (req, res) => {
    const creator = me(req);
    const raw = await store.get('creator_videos', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Video not found.');
    const video = asVideo(raw);
    if (!['draft', 'rejected'].includes(video.status)) return fail(res, 409, 'bad_state', `Cannot submit a video in state ${video.status}.`);
    if (!video.storage_path) return fail(res, 409, 'no_media', 'Upload media before submitting for review.');
    const updated = await store.update('creator_videos', video.id, { status: 'pending_review' });
    res.json({ video: sanitizeOwnVideo(updated as Record<string, unknown>) });
  }));

  // ---- analytics (real data only — no synthetic numbers) -------------------------
  r.get('/me/dashboard', wrap(async (req, res) => {
    const creator = me(req);
    const videos = await store.find('creator_videos', { eq: { creator_id: creator.id }, limit: 1000, order: { field: 'created_at' } });
    const profile = await store.findOne('creator_profiles', { creator_id: creator.id });
    const byStatus = { draft: 0, pending_review: 0, published: 0, rejected: 0, taken_down: 0 } as Record<string, number>;
    let totalValidViews = 0, totalWatchSeconds = 0, totalLikes = 0, totalComments = 0;
    for (const v of videos) {
      byStatus[String(v.status)] = (byStatus[String(v.status)] ?? 0) + 1;
      if (v.status === 'published') {
        totalValidViews += Number(v.valid_views ?? 0);
        totalWatchSeconds += Number(v.watch_seconds ?? 0);
        totalLikes += Number(v.likes_count ?? 0);
        totalComments += Number(v.comments_count ?? 0);
      }
    }
    const followers = profile ? Number(profile.total_followers ?? 0) : 0;
    const earnings = await getEarningsSummary(creator.id);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const weekViews = await store.find('video_views', { eq: { creator_id: creator.id }, order: { field: 'created_at' }, limit: 5000 });
    const perDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) perDay[new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)] = 0;
    for (const v of weekViews) if (String(v.created_at) > since) {
      const d = String(v.created_at).slice(0, 10);
      if (d in perDay) perDay[d] += 1;
    }
    res.json({
      videos: { total: videos.length, by_status: byStatus },
      totals: { valid_views: totalValidViews, watch_hours: Math.round(totalWatchSeconds / 360) / 10, likes: totalLikes, comments: totalComments, followers },
      views_last_7_days: perDay,
      earnings,
      persistence: store.mode,
    });
  }));

  r.get('/me/analytics', wrap(async (req, res) => {
    const creator = me(req);
    const days = Math.min(90, Math.max(1, Number((req.query as Record<string, string>).days ?? 30)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const views = await store.find('video_views', { eq: { creator_id: creator.id }, order: { field: 'created_at' }, limit: 10000 });
    const inRange = views.filter((v) => String(v.created_at) > since);
    const perDay: Record<string, { views: number; watch_seconds: number }> = {};
    for (const v of inRange) {
      const d = String(v.created_at).slice(0, 10);
      perDay[d] = perDay[d] ?? { views: 0, watch_seconds: 0 };
      perDay[d].views += 1;
      perDay[d].watch_seconds += Number(v.watched_seconds ?? 0);
    }
    const videos = await store.find('creator_videos', { eq: { creator_id: creator.id, status: 'published' }, order: { field: 'valid_views' }, limit: 1000 });
    res.json({
      range_days: days,
      total_valid_views: inRange.length,
      per_day: perDay,
      top_videos: videos.slice(0, 10).map((v) => ({ id: v.id, title: v.title, valid_views: v.valid_views, watch_seconds: v.watch_seconds, likes: v.likes_count })),
    });
  }));

  // ---- earnings & withdrawals -----------------------------------------------------
  r.get('/me/earnings', wrap(async (req, res) => {
    const creator = me(req);
    const [summary, ledger] = await Promise.all([
      getEarningsSummary(creator.id),
      store.find('creator_earnings_ledger', { eq: { creator_id: creator.id }, order: { field: 'created_at' }, limit: 50 }),
    ]);
    res.json({ summary, ledger, label: 'Estimated Earnings', disclaimer: summary.disclaimer });
  }));

  r.get('/me/withdrawals', wrap(async (req, res) => {
    const creator = me(req);
    const rows = await store.find('creator_withdrawals', { eq: { creator_id: creator.id }, order: { field: 'created_at' }, limit: 50 });
    res.json({ withdrawals: rows });
  }));

  r.post('/me/withdrawals', wrap(async (req, res) => {
    const creator = me(req);
    if (!rateHit(`withdraw:${creator.id}`, 5, 86_400_000)) return fail(res, 429, 'rate_limited', 'Too many withdrawal requests today.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const settings = await store.getSettings();
    try {
      const w = await requestWithdrawal(creator, Number(b.amount_usd), b.method_id ? String(b.method_id) : null, settings);
      res.json({ withdrawal: w });
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }));

  // ---- payout methods --------------------------------------------------------------
  r.get('/me/payout-methods', wrap(async (req, res) => {
    const rows = await store.find('payout_methods', { eq: { creator_id: me(req).id }, order: { field: 'created_at' }, limit: 20 });
    res.json({ methods: rows });
  }));

  r.post('/me/payout-methods', wrap(async (req, res) => {
    const creator = me(req);
    if (!rateHit(`payout-method:${creator.id}`, 10, 86_400_000)) return fail(res, 429, 'rate_limited', 'Too many changes today.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const type = ['bank', 'paypal', 'wise', 'other'].includes(String(b.method_type)) ? String(b.method_type) : 'bank';
    const label = String(b.label ?? '').trim();
    if (label.length < 1 || label.length > 80) return fail(res, 400, 'bad_label', 'Label must be 1–80 characters.');
    const details = (b.details && typeof b.details === 'object') ? b.details as Record<string, unknown> : {};
    for (const v of Object.values(details)) if (typeof v === 'string' && v.length > 200) return fail(res, 400, 'bad_details', 'Detail fields must be ≤ 200 characters.');
    const row = await store.insert('payout_methods', { creator_id: creator.id, method_type: type, label, details, is_default: Boolean(b.is_default) });
    res.json({ method: row });
  }));

  r.delete('/me/payout-methods/:id', wrap(async (req, res) => {
    const creator = me(req);
    const raw = await store.get('payout_methods', req.params.id);
    if (!raw || raw.creator_id !== creator.id) return fail(res, 404, 'not_found', 'Payout method not found.');
    await store.delete('payout_methods', { id: String(raw.id) });
    res.json({ ok: true });
  }));

  // ---- followers / notifications / strikes ---------------------------------------
  r.get('/me/followers', wrap(async (req, res) => {
    const rows = await store.find('creator_followers', { eq: { creator_id: me(req).id }, order: { field: 'created_at' }, limit: 100 });
    res.json({ total: rows.length, followers: rows.map((f) => ({ user_id: f.follower_user_id, followed_at: f.created_at })) });
  }));

  r.get('/me/notifications', wrap(async (req, res) => {
    const rows = await store.find('creator_notifications', { eq: { creator_id: me(req).id }, order: { field: 'created_at' }, limit: 50 });
    res.json({ notifications: rows });
  }));

  r.post('/me/notifications/read', wrap(async (req, res) => {
    const creator = me(req);
    const b = (req.body ?? {}) as { ids?: string[] };
    const rows = await store.find('creator_notifications', { eq: { creator_id: creator.id, read_at: null }, limit: 100 });
    const ids = b.ids ? new Set(b.ids) : null;
    for (const n of rows) {
      if (ids && !ids.has(String(n.id))) continue;
      await store.update('creator_notifications', String(n.id), { read_at: new Date().toISOString() });
    }
    res.json({ ok: true });
  }));

  r.get('/me/strikes', wrap(async (req, res) => {
    const rows = await store.find('creator_strikes', { eq: { creator_id: me(req).id }, order: { field: 'created_at' }, limit: 50 });
    res.json({ strikes: rows, active_count: rows.filter((s) => s.status === 'active').length });
  }));

  return r;
}
