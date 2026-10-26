// Valid-view / watch-session engine.
//
// A "valid view" is NOT a page refresh. It is minted server-side when a
// watch session ENDS having satisfied all of:
//   * the video is published
//   * watch_seconds >= settings.min_watch_seconds (heartbeat-driven)
//   * the session is not suspicious (score < settings.suspicion_threshold)
//   * no prior valid view from the same viewer_key+video inside the
//     dedupe window (repeated-refresh protection)
//   * the session was not already counted (unique per session, enforced
//     by the DB unique index and by session state here)
//
// Watch time is heartbeat-driven with server-side clamping (never trusts
// client deltas beyond settings.max_watch_heartbeat_seconds) and a wall-clock
// ceiling (watch_seconds cannot exceed real elapsed time + grace).
import { store, asSession, asVideo } from './store.js';
import type { WatchSessionRow, CreatorVideoRow, CreatorSettings, CreatorFlags, CreatorRow } from './types.js';
import { HttpError } from './auth.js';

export interface AccessDecision {
  tier: 'free' | 'paid';
  entitled: boolean;
  free_until: string | null;
  reason: string;
}

/** Resolve the effective access tier for a published video. */
export async function resolveAccess(video: CreatorVideoRow, creator: CreatorRow | null, settings: CreatorSettings, flags: CreatorFlags, viewerUserId: string | null): Promise<AccessDecision> {
  let tier: 'free' | 'paid' = 'free';
  let freeUntil: string | null = null;
  const override = creator?.access_tier_override ?? null;
  const tierSetting = (override && override !== 'auto') ? override : video.access_tier;

  if (tierSetting === 'free') {
    tier = 'free';
  } else if (tierSetting === 'paid') {
    tier = 'paid';
  } else {
    // 'auto' — free for free_access_duration_days from publish, then paid
    const published = video.published_at ? new Date(video.published_at).getTime() : Date.now();
    const freeMs = settings.free_access_duration_days * 86_400_000;
    const until = published + freeMs;
    freeUntil = new Date(until).toISOString();
    tier = Date.now() < until ? 'free' : 'paid';
  }
  if (!flags.PAID_CONTENT_ENABLED) tier = 'free'; // paywall architecture exists but stays off

  let entitled = tier === 'free';
  if (!entitled && viewerUserId) {
    const ent = await store.findOne('viewer_entitlements', { video_id: video.id, user_id: viewerUserId });
    if (ent && (!ent.valid_until || new Date(String(ent.valid_until)).getTime() > Date.now())) entitled = true;
  }
  return { tier, entitled, free_until: freeUntil, reason: tier === 'free' ? 'free' : (entitled ? 'entitlement' : 'paywall') };
}

function sha(s: string): string {
  // viewer/ip hashing happens in auth.ts; here we need small local digests
  return Buffer.from(s).toString('base64url').slice(0, 24);
}

export interface StartWatchArgs {
  video: CreatorVideoRow;
  creator: CreatorRow;
  viewerUserId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  settings: CreatorSettings;
  access: AccessDecision;
}

export async function startWatch(args: StartWatchArgs): Promise<{ session: WatchSessionRow; playbackUrl: string | null }> {
  const { video, creator, viewerUserId, ipHash, userAgent, settings, access } = args;
  if (!access.entitled) throw new HttpError(402, 'payment_required', 'This video is paid content. Access requires an entitlement.');

  // per-IP session flood guard
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const ipSessions = ipHash
    ? (await store.find('video_watch_sessions', { eq: { ip_hash: ipHash }, order: { field: 'started_at' }, limit: 200 }))
        .filter((s) => String(s.started_at) > hourAgo)
    : [];
  const notes: string[] = [];
  let score = 0;
  if (ipSessions.length >= settings.max_sessions_per_hour_per_ip) {
    score += 40; notes.push(`ip_session_flood:${ipSessions.length}`);
  }

  const viewerKeyInput = sha(`${viewerUserId ?? 'anon'}|${ipHash ?? 'noip'}`);
  const sameVideoRecent = (await store.find('video_watch_sessions', { eq: { video_id: video.id }, order: { field: 'started_at' }, limit: 200 }))
    .filter((s) => s.viewer_key === viewerKeyInput && String(s.started_at) > hourAgo);
  if (sameVideoRecent.length >= 5) { score += 30; notes.push(`same_video_repeat:${sameVideoRecent.length}`); }

  const session = await store.insert('video_watch_sessions', {
    video_id: video.id,
    creator_id: creator.id,
    viewer_user_id: viewerUserId,
    viewer_key: viewerKeyInput,
    ip_hash: ipHash,
    user_agent: userAgent?.slice(0, 200) ?? null,
    watch_seconds: 0,
    heartbeats: 0,
    started_at: new Date().toISOString(),
    is_suspicious: score >= settings.suspicion_threshold,
    suspicion_score: score,
    suspicion_notes: notes,
  }) as unknown as WatchSessionRow;

  let playbackUrl: string | null = null;
  if (video.storage_path) {
    try {
      playbackUrl = await store.createReadSignedUrl(video.storage_bucket || 'creator-media', video.storage_path, 2 * 3600);
    } catch { playbackUrl = null; }
  }
  return { session, playbackUrl };
}

export interface HeartbeatArgs { deltaSeconds: number; playing: boolean }

export async function heartbeat(sessionId: string, args: HeartbeatArgs, settings: CreatorSettings): Promise<WatchSessionRow> {
  const raw = await store.get('video_watch_sessions', sessionId);
  if (!raw) throw new HttpError(404, 'session_not_found', 'Watch session not found.');
  const s = asSession(raw);
  if (s.ended_at) throw new HttpError(409, 'session_ended', 'This watch session already ended.');

  const notes = [...(s.suspicion_notes ?? [])];
  let score = s.suspicion_score;

  const maxDelta = settings.max_watch_heartbeat_seconds;
  const delta = Math.max(0, Math.min(maxDelta, Math.floor(args.deltaSeconds || 0)));

  // wall-clock guard: cannot credit more watch time than real elapsed time
  const startedAt = new Date(s.started_at).getTime();
  const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
  const newWatch = s.watch_seconds + delta;
  if (newWatch > elapsed + 5) {
    score += 30; notes.push(`watch_exceeds_wallclock:${newWatch}>${Math.floor(elapsed)}`);
  }
  // heartbeat cadence guard: intervals suspiciously short relative to claimed delta
  if (s.last_heartbeat_at) {
    const gap = (Date.now() - new Date(s.last_heartbeat_at).getTime()) / 1000;
    if (args.deltaSeconds > gap + 5) { score += 25; notes.push(`heartbeat_faster_than_realtime:${args.deltaSeconds}>${Math.floor(gap)}`); }
  }
  if (args.playing === false && delta > 2) { score += 15; notes.push('credited_while_paused'); }

  const updated = await store.update<WatchSessionRow>('video_watch_sessions', sessionId, {
    watch_seconds: Math.min(newWatch, Math.floor(elapsed) + 5),
    heartbeats: s.heartbeats + 1,
    last_heartbeat_at: new Date().toISOString(),
    suspicion_score: score,
    suspicion_notes: notes.slice(-20),
    is_suspicious: score >= settings.suspicion_threshold,
  });
  return asSession(updated as unknown as Record<string, unknown>);
}

export async function endWatch(sessionId: string, settings: CreatorSettings, flags: CreatorFlags): Promise<{ session: WatchSessionRow; validView: boolean }> {
  const raw = await store.get('video_watch_sessions', sessionId);
  if (!raw) throw new HttpError(404, 'session_not_found', 'Watch session not found.');
  const s = asSession(raw);
  if (s.ended_at) {
    const view = await store.findOne('video_views', { session_id: sessionId });
    return { session: s, validView: !!view };
  }

  const notes = [...(s.suspicion_notes ?? [])];
  let score = s.suspicion_score;
  const videoRaw = await store.get('creator_videos', s.video_id);
  const video = videoRaw ? asVideo(videoRaw) : null;

  // final wall-clock ceiling
  const startedAt = new Date(s.started_at).getTime();
  const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
  let watchSeconds = s.watch_seconds;
  if (watchSeconds > elapsed + 5) {
    score += 50; notes.push(`final_watch_exceeds_wallclock:${watchSeconds}>${Math.floor(elapsed)}`);
    watchSeconds = Math.floor(elapsed);
  }

  let valid = false;
  let invalidReason: string | null = null;
  if (!video || video.status !== 'published') { invalidReason = 'video_not_published'; }
  else if (watchSeconds < settings.min_watch_seconds) { invalidReason = `watch_too_short:${watchSeconds}s<${settings.min_watch_seconds}s`; }
  else if (score >= settings.suspicion_threshold) { invalidReason = `suspicious:${score}`; }
  else {
    // repeated-refresh dedupe window
    const windowStart = new Date(Date.now() - settings.dedupe_window_minutes * 60_000).toISOString();
    const recentViews = await store.find('video_views', { eq: { video_id: s.video_id, viewer_key: s.viewer_key }, order: { field: 'created_at' }, limit: 5 });
    if (recentViews.some((v) => String(v.created_at) > windowStart)) {
      invalidReason = `duplicate_within_window:${settings.dedupe_window_minutes}m`;
    } else {
      valid = true;
    }
  }

  const session = asSession((await store.update('video_watch_sessions', sessionId, {
    watch_seconds: watchSeconds,
    ended_at: new Date().toISOString(),
    is_valid: valid,
    invalid_reason: invalidReason,
    is_suspicious: score >= settings.suspicion_threshold,
    suspicion_score: score,
    suspicion_notes: notes.slice(-20),
  }) as Record<string, unknown>));

  let validView = false;
  if (valid && video) {
    // insert the valid view (unique per session both in DB and memory)
    const existing = await store.findOne('video_views', { session_id: sessionId });
    if (!existing) {
      // DB also enforces one counted view per viewer per video per UTC day —
      // a duplicate insert comes back flagged instead of throwing
      const inserted = await store.insert('video_views', {
        video_id: video.id,
        creator_id: video.creator_id,
        session_id: sessionId,
        viewer_user_id: s.viewer_user_id,
        viewer_key: s.viewer_key,
        watched_seconds: watchSeconds,
        source: 'web',
        ip_hash: s.ip_hash,
      }) as unknown as Record<string, unknown>;
      const duplicate = Boolean((inserted as { __duplicate?: boolean })?.__duplicate);
      if (!duplicate) {
        // server-maintained counters (creator has no write path to these)
        await store.update('creator_videos', video.id, {
          valid_views: Number(video.valid_views ?? 0) + 1,
          watch_seconds: Number(video.watch_seconds ?? 0) + watchSeconds,
        });
        const prof = await store.findOne('creator_profiles', { creator_id: video.creator_id });
        if (prof) await store.update('creator_profiles', String(prof.id), { total_views: Number(prof.total_views ?? 0) + 1 });
        validView = true;
        if (flags.CREATOR_MONETIZATION_ENABLED && video.creator_id) {
          const { recomputeCreatorEarnings } = await import('./earnings.js');
          void recomputeCreatorEarnings(video.creator_id, settings).catch(() => undefined);
        }
      }
    }
  }
  return { session, validView };
}

export async function markSessionReviewed(sessionId: string, reviewedBy: string, action: 'validate' | 'invalidate'): Promise<WatchSessionRow> {
  const raw = await store.get('video_watch_sessions', sessionId);
  if (!raw) throw new HttpError(404, 'session_not_found', 'Watch session not found.');
  const s = asSession(raw);
  const videoViews = await store.findOne('video_views', { session_id: sessionId });
  const videoRaw = s.video_id ? await store.get('creator_videos', s.video_id) : null;
  const video = videoRaw ? asVideo(videoRaw) : null;

  if (action === 'validate' && !videoViews && video) {
    const inserted = await store.insert('video_views', {
      video_id: video.id, creator_id: video.creator_id, session_id: sessionId,
      viewer_user_id: s.viewer_user_id, viewer_key: s.viewer_key,
      watched_seconds: s.watch_seconds, source: 'admin_review', ip_hash: s.ip_hash,
    }) as unknown as Record<string, unknown>;
    if (!(inserted as { __duplicate?: boolean })?.__duplicate) {
      await store.update('creator_videos', video.id, { valid_views: Number(video.valid_views ?? 0) + 1, watch_seconds: Number(video.watch_seconds ?? 0) + s.watch_seconds });
    }
  }
  if (action === 'invalidate' && videoViews) {
    await store.delete('video_views', { session_id: sessionId });
    if (video) await store.update('creator_videos', video.id, {
      valid_views: Math.max(0, video.valid_views - 1),
      watch_seconds: Math.max(0, video.watch_seconds - s.watch_seconds),
    });
  }
  return asSession((await store.update('video_watch_sessions', sessionId, {
    reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
  }) as Record<string, unknown>));
}
