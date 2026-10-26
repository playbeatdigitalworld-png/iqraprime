/**
 * Creator Hub — public browse/watch + creator studio (Phase 1: functional UI).
 * Sections:
 *  - Browse: published creator videos grid (real data, no placeholder cards)
 *  - Watch: HTML5 player wired to the valid-view session pipeline
 *  - Studio: dashboard / upload / my videos / analytics / earnings /
 *    withdrawals / payouts / followers / notifications / strikes
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  creatorHubApi, uploadToSignedUrl,
  type CreatorHubFlags, type CreatorVideoCard, type CreatorVideoFull, type EarningsSummary,
} from '../../services/creatorHubApi.js';

type StudioTab = 'dashboard' | 'upload' | 'videos' | 'analytics' | 'earnings' | 'withdrawals' | 'payouts' | 'followers' | 'notifications' | 'strikes';

const fmtViews = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtUsd = (n: number) => `$${Number(n).toFixed(2)}`;
const fmtDur = (s: number | null) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-[#0D1520]/80 border border-white/10 p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-wide uppercase text-[#C6CBD4]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// =============================================================================
// WATCH EXPERIENCE (valid-view pipeline client)
// =============================================================================
function WatchModal({ video, onClose, onNeedsAuth }: { video: CreatorVideoCard; onClose: () => void; onNeedsAuth: () => void }) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const lastTick = useRef<number>(Date.now());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hbTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await creatorHubApi.startWatch(video.id);
        if (cancelled) return;
        if (!r.access.entitled) { setPaywall(true); return; }
        setSessionId(r.sessionId);
        setPlaybackUrl(r.playbackUrl);
      } catch (e) {
        const err = e as Error & { code?: string; status?: number };
        if (err.status === 402) setPaywall(true);
        else if (err.status === 401) { /* anonymous watch allowed; playback requires no auth */ setError(err.message); }
        else setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [video.id]);

  const sendHeartbeat = useCallback(async (playing: boolean) => {
    if (!sessionId) return;
    const now = Date.now();
    const delta = Math.min(15, Math.max(0, Math.round((now - lastTick.current) / 1000)));
    lastTick.current = now;
    if (delta >= 1) { try { await creatorHubApi.heartbeat(sessionId, delta, playing); } catch { /* noop */ } }
  }, [sessionId]);

  useEffect(() => {
    hbTimer.current = setInterval(() => {
      const el = videoRef.current;
      if (el && !el.paused) void sendHeartbeat(true);
    }, 15000);
    const onUnload = () => { if (sessionId) { try { navigator.sendBeacon?.(`/api/creator-hub/watch/${sessionId}/end`); } catch { /* noop */ } } };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      if (hbTimer.current) clearInterval(hbTimer.current);
      window.removeEventListener('beforeunload', onUnload);
      if (sessionId) void creatorHubApi.endWatch(sessionId).catch(() => undefined);
    };
  }, [sessionId, sendHeartbeat]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden border border-white/10 bg-[#070B12]" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-black relative">
          {paywall ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
              <span className="text-3xl">🔒</span>
              <p className="text-lg font-bold">Paid content</p>
              <p className="text-sm text-[#8993A3] max-w-sm">This video is behind the paid tier. Access will require an entitlement once {video.access.tier === 'paid' && 'paid access'} is enabled by the platform.</p>
              <button onClick={onNeedsAuth} className="px-5 py-2 rounded-xl bg-[#E5093A] text-white text-sm font-semibold">Sign in for access</button>
            </div>
          ) : !playbackUrl ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8993A3]">{error ?? 'Preparing secure playback…'}</div>
          ) : (
            <video
              ref={videoRef} src={playbackUrl} controls autoPlay playsInline
              onPause={() => void sendHeartbeat(false)}
              className="w-full h-full"
            />
          )}
        </div>
        <div className="p-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">{video.title}</h3>
            <p className="text-xs text-[#8993A3] mt-1">{video.creator?.display_name ?? 'Unknown creator'} · {fmtViews(video.valid_views)} views · {fmtDur(video.duration_seconds)}</p>
            {video.description && <p className="text-sm text-[#C6CBD4] mt-2 line-clamp-3">{video.description}</p>}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold hover:bg-white/20">Close</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PUBLIC BROWSE
// =============================================================================
function Browse({ onWatch, onNeedsAuth, flags }: { onWatch: (v: CreatorVideoCard) => void; onNeedsAuth: () => void; flags: CreatorHubFlags | null }) {
  const [videos, setVideos] = useState<CreatorVideoCard[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      creatorHubApi.listVideos({ q: q || undefined, kind: kind || undefined, limit: 30 })
        .then((r) => setVideos(r.videos))
        .catch(() => setVideos([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creator videos…"
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-[#0D1520] border border-white/10 text-sm outline-none focus:border-[#E5093A]/60"
        />
        {(['', 'video', 'short', 'live'] as const).map((k) => (
          <button key={k || 'all'} onClick={() => setKind(k)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border ${kind === k ? 'bg-[#E5093A] border-[#E5093A] text-white' : 'bg-[#0D1520] border-white/10 text-[#8993A3] hover:text-white'}`}>
            {k || 'All'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-video rounded-xl bg-[#0D1520] animate-pulse" />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-[#8993A3]">
          No published creator videos yet. Everything you see here is real creator content — none of it is demo data.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <button key={v.id} onClick={() => onWatch(v)} className="group text-left rounded-xl overflow-hidden border border-white/10 bg-[#0D1520] hover:border-[#E5093A]/50 transition-colors">
              <div className="aspect-video bg-black/40 relative flex items-center justify-center">
                {v.thumb_url ? <img src={v.thumb_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl opacity-40">▶</span>}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-black/60 border border-white/10">{v.kind}</span>
                {v.access.tier === 'paid' && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E5093A]">PAID</span>}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold line-clamp-1">{v.title}</p>
                <p className="text-[11px] text-[#8993A3] mt-1">{v.creator?.display_name ?? '—'} · {fmtViews(v.valid_views)} views · {fmtDur(v.duration_seconds)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {flags && !flags.CREATOR_UPLOAD_ENABLED && (
        <p className="text-[11px] text-[#8993A3]">Creator uploads are temporarily disabled by the platform.</p>
      )}
      <div className="flex gap-2">
        <button onClick={onNeedsAuth} className="text-xs text-[#8993A3] underline hover:text-white">Sign in to like, comment and follow</button>
      </div>
    </div>
  );
}

// =============================================================================
// CREATOR STUDIO
// =============================================================================
function Studio({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<StudioTab>('dashboard');
  const [me, setMe] = useState<Awaited<ReturnType<typeof creatorHubApi.me>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    creatorHubApi.me()
      .then(setMe)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Panel title="Creator Studio">
        <div className="text-sm text-[#8993A3] space-y-2">
          <p>{error}</p>
          <p className="text-xs">Creator access is provisioned by the platform. If you were added as a creator, make sure you are signed in with the correct account, then reload.</p>
        </div>
      </Panel>
    );
  }
  if (!me) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;

  const tabs: Array<[StudioTab, string]> = [
    ['dashboard', 'Dashboard'], ['upload', 'Upload'], ['videos', 'My Videos'],
    ['analytics', 'Analytics'], ['earnings', 'Earnings'], ['withdrawals', 'Withdrawals'],
    ['payouts', 'Payout method'], ['followers', 'Followers'], ['notifications', 'Notifications'], ['strikes', 'Copyright status'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E5093A] to-[#B90732] flex items-center justify-center font-black">{me.creator.display_name.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="font-bold text-sm">{me.creator.display_name}</p>
            <p className="text-[11px] text-[#8993A3]">@{me.creator.handle} · {me.creator.status} · persistence: {me.persistence}</p>
          </div>
        </div>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold hover:bg-white/20">← Browse content</button>
      </div>

      {me.creator.status !== 'active' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Your creator account is <b>{me.creator.status}</b>. Some actions may be limited.
        </div>
      )}
      {me.copyright_status.active_strikes > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          Active copyright strikes: <b>{me.copyright_status.active_strikes}</b> / {me.copyright_status.max_strikes}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${tab === k ? 'bg-[#E5093A] text-white' : 'bg-[#0D1520] text-[#8993A3] hover:text-white border border-white/10'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <StudioDashboard />}
      {tab === 'upload' && <StudioUpload />}
      {tab === 'videos' && <StudioVideos />}
      {tab === 'analytics' && <StudioAnalytics />}
      {tab === 'earnings' && <StudioEarnings />}
      {tab === 'withdrawals' && <StudioWithdrawals />}
      {tab === 'payouts' && <StudioPayouts />}
      {tab === 'followers' && <StudioFollowers />}
      {tab === 'notifications' && <StudioNotifications />}
      {tab === 'strikes' && <StudioStrikes />}
    </div>
  );
}

function StudioDashboard() {
  const [d, setD] = useState<Awaited<ReturnType<typeof creatorHubApi.dashboard>> | null>(null);
  useEffect(() => { creatorHubApi.dashboard().then(setD).catch(() => undefined); }, []);
  if (!d) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  const maxDay = Math.max(1, ...Object.values(d.views_last_7_days));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Totals">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Valid views" value={fmtViews(d.totals.valid_views)} />
          <Metric label="Watch hours" value={String(d.totals.watch_hours)} />
          <Metric label="Followers" value={fmtViews(d.totals.followers)} />
          <Metric label="Likes" value={fmtViews(d.totals.likes)} />
        </div>
        <div className="mt-3 text-[11px] text-[#8993A3]">Videos: {d.videos.total} ({Object.entries(d.videos.by_status).map(([k, v]) => `${k}:${v}`).join(' · ') || 'none'})</div>
      </Panel>
      <Panel title="Estimated Earnings">
        <p className="text-3xl font-black text-[#E5093A]">{fmtUsd(d.earnings.estimated_earnings_usd)}</p>
        <p className="text-[11px] text-[#8993A3] mt-1">{d.earnings.disclaimer}</p>
        <p className="text-xs mt-2 text-[#C6CBD4]">{fmtViews(d.earnings.eligible_views)} eligible views · available {fmtUsd(d.earnings.available_for_withdrawal_usd)}</p>
      </Panel>
      <Panel title="Valid views — last 7 days" >
        <div className="flex items-end gap-2 h-28">
          {Object.entries(d.views_last_7_days).map(([day, n]) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-gradient-to-t from-[#E5093A] to-[#B90732]" style={{ height: `${(n / maxDay) * 100}%`, minHeight: 2 }} />
              <span className="text-[9px] text-[#8993A3]">{day.slice(5)}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Data source">
        <p className="text-xs text-[#8993A3]">All numbers come from real watch sessions processed by the valid-view engine. No demo or fake statistics are generated anywhere in Creator Hub.</p>
        <p className="text-xs mt-2">Persistence mode: <b>{d.persistence}</b>{d.persistence === 'memory' ? ' (migration pending — data resets on cold start)' : ' (durable Supabase)'}</p>
      </Panel>
    </div>
  );
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-[#04070B] border border-white/5 p-3">
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[10px] uppercase tracking-wide text-[#8993A3]">{label}</p>
  </div>
);

function StudioUpload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'video' | 'short' | 'live'>('video');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await creatorHubApi.createVideo({ title, description, kind });
      setMsg(`Draft created: “${r.video.title}”. Open My Videos to upload media and submit for review.`);
      setTitle(''); setDescription('');
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Create a video">
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (1–200 chars)" maxLength={200}
            className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm outline-none focus:border-[#E5093A]/60" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={4} maxLength={5000}
            className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm outline-none focus:border-[#E5093A]/60" />
          <div className="flex gap-2">
            {(['video', 'short', 'live'] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`px-4 py-2 rounded-xl text-xs font-semibold border ${kind === k ? 'bg-[#E5093A] border-[#E5093A] text-white' : 'bg-[#04070B] border-white/10 text-[#8993A3]'}`}>{k}</button>
            ))}
          </div>
          {kind === 'live' && (
            <p className="text-[11px] text-amber-300/90">Live entries are created as planned streams in this phase — the broadcast pipeline (RTMP → HLS) is architected in the data model but ingestion is not enabled yet.</p>
          )}
          <button disabled={busy || title.trim().length < 1} onClick={create} className="px-5 py-2.5 rounded-xl bg-[#E5093A] text-white text-sm font-bold disabled:opacity-40">
            {busy ? 'Creating…' : 'Create draft'}
          </button>
          {msg && <p className="text-xs text-[#C6CBD4]">{msg}</p>}
        </div>
      </Panel>
      <Panel title="How publishing works">
        <ol className="text-xs text-[#8993A3] space-y-2 list-decimal list-inside">
          <li>Create a draft with title and metadata.</li>
          <li>Upload media (mp4/webm/mov, ≤ 2 GiB) — streamed straight to private storage with a signed URL; the server never proxies the bytes.</li>
          <li>Server validates the stored object (existence, size, type) before the upload counts.</li>
          <li>Submit for review → status <b>PENDING_REVIEW</b>. With moderation enabled, nothing publishes automatically.</li>
          <li>An admin approves (→ PUBLISHED), rejects with a reason (→ REJECTED), or takes it down (→ TAKEN_DOWN).</li>
        </ol>
      </Panel>
    </div>
  );
}

function StudioVideos() {
  const [videos, setVideos] = useState<CreatorVideoFull[]>([]);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    creatorHubApi.myVideos({ status: status || undefined }).then((r) => setVideos(r.videos)).catch(() => undefined);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try { await fn(); load(); } catch (e) { alert((e as Error).message); } finally { setBusyId(null); }
  };

  const uploadFile = (v: CreatorVideoFull, file: File) => withBusy(v.id, async () => {
    const url = await creatorHubApi.getUploadUrl(v.id, file.type || 'video/mp4', file.size);
    await uploadToSignedUrl(url.signedUrl, url.token, file);
    await creatorHubApi.uploadComplete(v.id);
  });

  return (
    <Panel title="My Videos" action={
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-lg bg-[#04070B] border border-white/10 text-xs">
        <option value="">All statuses</option>
        {['draft', 'pending_review', 'published', 'rejected', 'taken_down'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    }>
      {videos.length === 0 ? <p className="text-xs text-[#8993A3]">No videos here yet.</p> : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id} className="rounded-xl border border-white/10 bg-[#04070B] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{v.title}</p>
                  <p className="text-[11px] text-[#8993A3] mt-0.5">
                    {v.kind} · {v.status} · {fmtViews(v.valid_views)} valid views · {fmtViews(v.likes_count)} likes · {fmtDur(v.duration_seconds)}
                    {v.access_tier !== 'auto' ? ` · tier: ${v.access_tier}` : ' · tier: auto (2-day rule)'}
                  </p>
                  {v.rejection_reason && <p className="text-[11px] text-red-400 mt-1">Rejection: {v.rejection_reason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['draft', 'rejected'].includes(v.status) && (
                    <>
                      <label className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${v.storage_path ? 'bg-white/10' : 'bg-[#E5093A] text-white'} cursor-pointer`}>
                        {v.storage_path ? 'Re-upload media' : 'Upload media'}
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={busyId === v.id}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(v, f); }} />
                      </label>
                      {v.storage_path && (
                        <button disabled={busyId === v.id} onClick={() => withBusy(v.id, () => creatorHubApi.submitForReview(v.id))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600">Submit for review</button>
                      )}
                      <button disabled={busyId === v.id} onClick={() => withBusy(v.id, () => creatorHubApi.deleteVideo(v.id))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-red-600/40">Delete</button>
                    </>
                  )}
                  {v.status === 'pending_review' && <span className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300">Awaiting moderation</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StudioAnalytics() {
  const [days, setDays] = useState(30);
  const [a, setA] = useState<Awaited<ReturnType<typeof creatorHubApi.analytics>> | null>(null);
  useEffect(() => { creatorHubApi.analytics(days).then(setA).catch(() => undefined); }, [days]);
  if (!a) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  const entries = Object.entries(a.per_day);
  const maxViews = Math.max(1, ...entries.map(([, v]) => v.views));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={`Valid views — last ${a.range_days} days`} action={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-2 py-1 rounded bg-[#04070B] border border-white/10 text-xs">
          {[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d}d</option>)}
        </select>
      }>
        <p className="text-2xl font-black">{a.total_valid_views}</p>
        <div className="flex items-end gap-0.5 h-24 mt-3">
          {entries.map(([day, v]) => (
            <div key={day} title={`${day}: ${v.views} views`} className="flex-1 rounded-t bg-gradient-to-t from-[#E5093A] to-[#B90732]" style={{ height: `${(v.views / maxViews) * 100}%`, minHeight: 1 }} />
          ))}
        </div>
      </Panel>
      <Panel title="Top videos (all-time valid views)">
        {a.top_videos.length === 0 ? <p className="text-xs text-[#8993A3]">No published videos yet.</p> : (
          <div className="space-y-2 text-sm">
            {a.top_videos.map((v) => (
              <div key={v.id} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                <span className="truncate">{v.title}</span>
                <span className="text-[#8993A3] text-xs whitespace-nowrap">{fmtViews(v.valid_views)} views · {fmtViews(v.likes)} likes</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StudioEarnings() {
  const [e, setE] = useState<Awaited<ReturnType<typeof creatorHubApi.myEarnings>> | null>(null);
  useEffect(() => { creatorHubApi.myEarnings().then(setE).catch(() => undefined); }, []);
  if (!e) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Estimated Earnings">
        <p className="text-3xl font-black text-[#E5093A]">{fmtUsd(e.summary.estimated_earnings_usd)}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <Metric label="Eligible views" value={fmtViews(e.summary.eligible_views)} />
          <Metric label="Available" value={fmtUsd(e.summary.available_for_withdrawal_usd)} />
          <Metric label="Paid out" value={fmtUsd(e.summary.paid_out_usd)} />
          <Metric label="Pending" value={fmtUsd(e.summary.pending_withdrawal_usd)} />
        </div>
        <p className="text-[11px] text-amber-300/90 mt-3">{e.disclaimer}</p>
        <p className="text-[11px] text-[#8993A3] mt-2">Rate: {fmtUsd(e.summary.rate_usd_per_10000_valid_views)} per 10,000 valid views · eligibility threshold: {fmtViews(e.summary.min_eligible_views)} views</p>
      </Panel>
      <Panel title="Earnings ledger">
        {e.ledger.length === 0 ? <p className="text-xs text-[#8993A3]">No ledger entries yet. View credits are appended by the daily rollup and admin actions.</p> : (
          <div className="space-y-1.5 text-xs max-h-72 overflow-y-auto">
            {e.ledger.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 border-b border-white/5 pb-1">
                <span className="text-[#8993A3]">{new Date(l.created_at).toLocaleDateString()} · {l.entry_type}{l.description ? ` — ${l.description}` : ''}</span>
                <span className={l.amount_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}>{l.amount_usd >= 0 ? '+' : ''}{fmtUsd(l.amount_usd)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StudioWithdrawals() {
  const [w, setW] = useState<Awaited<ReturnType<typeof creatorHubApi.myWithdrawals>> | null>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState<Array<{ id: string; label: string; method_type: string }>>([]);
  const [methodId, setMethodId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    creatorHubApi.myWithdrawals().then(setW).catch(() => undefined);
    creatorHubApi.myEarnings().then((r) => setSummary(r.summary)).catch(() => undefined);
    creatorHubApi.payoutMethods().then((r) => setMethods(r.methods)).catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setMsg(null);
    try {
      await creatorHubApi.requestWithdrawal(Number(amount), methodId || null);
      setMsg('Withdrawal request submitted — pending admin review.');
      setAmount('');
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Request a withdrawal">
        <p className="text-xs text-[#8993A3] mb-3">
          Available: <b className="text-white">{fmtUsd(summary?.available_for_withdrawal_usd ?? 0)}</b> · minimum withdrawal: <b className="text-white">{fmtUsd(summary?.minimum_withdrawal_usd ?? 0)}</b>
        </p>
        <div className="flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount (USD)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm" />
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className="px-3 rounded-xl bg-[#04070B] border border-white/10 text-xs">
            <option value="">No method selected</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <button disabled={!Number(amount) || Number(amount) <= 0} onClick={submit} className="mt-3 px-5 py-2.5 rounded-xl bg-[#E5093A] text-white text-sm font-bold disabled:opacity-40">Request withdrawal</button>
        {msg && <p className="text-xs text-[#C6CBD4] mt-2">{msg}</p>}
        <p className="text-[10px] text-[#8993A3] mt-3">Requests create a ledger hold. Admin approval releases funds; rejection releases the hold back to your balance. Real payouts are gated by the PAYOUTS_ENABLED flag.</p>
      </Panel>
      <Panel title="My withdrawals">
        {!w || w.withdrawals.length === 0 ? <p className="text-xs text-[#8993A3]">No withdrawal requests yet.</p> : (
          <div className="space-y-2 text-xs">
            {w.withdrawals.map((x) => (
              <div key={x.id} className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span>{fmtUsd(x.amount_usd)} · {new Date(x.created_at).toLocaleDateString()}</span>
                <span className={`px-2 py-0.5 rounded-md font-semibold ${x.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : x.status === 'rejected' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{x.status}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StudioPayouts() {
  const [methods, setMethods] = useState<Awaited<ReturnType<typeof creatorHubApi.payoutMethods>> | null>(null);
  const [type, setType] = useState('bank');
  const [label, setLabel] = useState('');
  const [d1, setD1] = useState(''); const [d2, setD2] = useState('');
  const load = useCallback(() => { creatorHubApi.payoutMethods().then(setMethods).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    try {
      const details: Record<string, string> = type === 'bank' ? { bank_name: d1, account_ref: d2 } : { handle: d1, note: d2 };
      await creatorHubApi.addPayoutMethod({ method_type: type, label, details });
      setLabel(''); setD1(''); setD2('');
      load();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Add payout method">
        <div className="space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm">
            {['bank', 'paypal', 'wise', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Main bank)" className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm" />
          <input value={d1} onChange={(e) => setD1(e.target.value)} placeholder={type === 'bank' ? 'Bank name' : 'Account handle'} className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm" />
          <input value={d2} onChange={(e) => setD2(e.target.value)} placeholder={type === 'bank' ? 'Account reference (masked)' : 'Note (optional)'} className="w-full px-4 py-2.5 rounded-xl bg-[#04070B] border border-white/10 text-sm" />
          <button disabled={label.trim().length < 1} onClick={add} className="px-5 py-2.5 rounded-xl bg-[#E5093A] text-white text-sm font-bold disabled:opacity-40">Save method</button>
          <p className="text-[10px] text-[#8993A3]">Never store full card numbers here. Payout details are visible only to you and payout admins.</p>
        </div>
      </Panel>
      <Panel title="Saved methods">
        {!methods || methods.methods.length === 0 ? <p className="text-xs text-[#8993A3]">No payout methods saved.</p> : (
          <div className="space-y-2 text-xs">
            {methods.methods.map((m) => (
              <div key={m.id} className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span>{m.label} <span className="text-[#8993A3]">({m.method_type})</span></span>
                <button onClick={async () => { await creatorHubApi.deletePayoutMethod(m.id); load(); }} className="text-red-400 hover:text-red-300">Remove</button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StudioFollowers() {
  const [f, setF] = useState<Awaited<ReturnType<typeof creatorHubApi.myFollowers>> | null>(null);
  useEffect(() => { creatorHubApi.myFollowers().then(setF).catch(() => undefined); }, []);
  if (!f) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  return (
    <Panel title={`Followers (${f.total})`}>
      {f.followers.length === 0 ? <p className="text-xs text-[#8993A3]">No followers yet.</p> : (
        <div className="text-xs text-[#8993A3] space-y-1 max-h-72 overflow-y-auto">
          {f.followers.map((x) => <div key={x.user_id} className="flex justify-between border-b border-white/5 pb-1"><span>{x.user_id.slice(0, 8)}…</span><span>{new Date(x.followed_at).toLocaleDateString()}</span></div>)}
        </div>
      )}
    </Panel>
  );
}

function StudioNotifications() {
  const [n, setN] = useState<Awaited<ReturnType<typeof creatorHubApi.myNotifications>> | null>(null);
  const load = useCallback(() => { creatorHubApi.myNotifications().then(setN).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  if (!n) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  return (
    <Panel title="Notifications" action={<button onClick={async () => { await creatorHubApi.markNotificationsRead(); load(); }} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Mark all read</button>}>
      {n.notifications.length === 0 ? <p className="text-xs text-[#8993A3]">Nothing yet.</p> : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {n.notifications.map((x) => (
            <div key={x.id} className={`rounded-xl border p-3 text-sm ${x.read_at ? 'border-white/5 bg-[#04070B]' : 'border-[#E5093A]/40 bg-[#E5093A]/5'}`}>
              <div className="flex justify-between gap-2">
                <p className="font-semibold text-sm">{x.title}</p>
                <span className="text-[10px] text-[#8993A3] whitespace-nowrap">{new Date(x.created_at).toLocaleString()}</span>
              </div>
              {x.body && <p className="text-xs text-[#8993A3] mt-1">{x.body}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StudioStrikes() {
  const [s, setS] = useState<Awaited<ReturnType<typeof creatorHubApi.myStrikes>> | null>(null);
  useEffect(() => { creatorHubApi.myStrikes().then(setS).catch(() => undefined); }, []);
  if (!s) return <div className="h-40 rounded-2xl bg-[#0D1520] animate-pulse" />;
  return (
    <Panel title={`Copyright / strike status — ${s.active_count} active`}>
      {s.strikes.length === 0 ? <p className="text-xs text-[#8993A3]">Clean record. No strikes.</p> : (
        <div className="space-y-2 text-xs">
          {s.strikes.map((x) => (
            <div key={x.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex justify-between"><b>Severity {x.severity} · {x.status}</b><span className="text-[#8993A3]">{new Date(x.created_at).toLocaleDateString()}</span></div>
              <p className="text-[#8993A3] mt-1">{x.reason}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-[#8993A3] mt-3">3 active strikes auto-suspend the creator account for 30 days. Reversed strikes do not count.</p>
    </Panel>
  );
}

// =============================================================================
// PAGE
// =============================================================================
export function CreatorHubPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth() as { user: unknown };
  const [flags, setFlags] = useState<CreatorHubFlags | null>(null);
  const [view, setView] = useState<'browse' | 'studio'>('browse');
  const [watching, setWatching] = useState<CreatorVideoCard | null>(null);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);

  useEffect(() => {
    creatorHubApi.getFlags().then((r) => setFlags(r.flags)).catch(() => setFlags({
      CREATOR_HUB_ENABLED: true, CREATOR_UPLOAD_ENABLED: true, CREATOR_MONETIZATION_ENABLED: false, PAYOUTS_ENABLED: false, PAID_CONTENT_ENABLED: false,
    }));
  }, []);

  useEffect(() => {
    if (!user) { setIsCreator(false); return; }
    creatorHubApi.me().then(() => setIsCreator(true)).catch(() => setIsCreator(false));
  }, [user]);

  if (flags && !flags.CREATOR_HUB_ENABLED) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-20 text-center">
        <h1 className="text-2xl font-black">Creator Hub</h1>
        <p className="text-sm text-[#8993A3] mt-2">Creator Hub is temporarily disabled by the platform. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="sp2-rail-eyebrow">StreamPlay Creators</div>
          <h1 className="sp2-rail-title">Creator Hub</h1>
          <p className="text-sm text-[#8993A3] mt-1.5 max-w-2xl">Real creators. Real analytics. Valid views only — no inflated counters.</p>
        </div>
        <div className="flex gap-2">
          {isCreator && view === 'browse' && (
            <button onClick={() => setView('studio')} className="px-4 py-2.5 rounded-xl bg-[#E5093A] text-white text-sm font-bold">Creator Studio</button>
          )}
          {view === 'studio' && <button onClick={() => setView('browse')} className="px-4 py-2.5 rounded-xl bg-white/10 text-sm font-semibold">Browse</button>}
        </div>
      </div>

      {view === 'browse' ? (
        <Browse flags={flags} onWatch={setWatching} onNeedsAuth={() => { if (!user) onNavigate('watch'); }} />
      ) : isCreator ? (
        <Studio onExit={() => setView('browse')} />
      ) : (
        <Panel title="Creator access required">
          <p className="text-sm text-[#8993A3]">
            This account is not provisioned as a creator yet. Creators are added by the platform admin
            (Admin Console → Creator Hub → Creators). Sign in with your creator account or come back after onboarding.
          </p>
          {!user && <button onClick={() => onNavigate('watch')} className="mt-3 px-5 py-2.5 rounded-xl bg-[#E5093A] text-white text-sm font-bold">Sign in</button>}
        </Panel>
      )}

      {watching && (
        <WatchModal
          video={watching}
          onClose={() => setWatching(null)}
          onNeedsAuth={() => { setWatching(null); if (!user) onNavigate('watch'); }}
        />
      )}
    </div>
  );
}

export type { CreatorVideoCard, CreatorVideoFull, EarningsSummary };
