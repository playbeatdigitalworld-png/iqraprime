/**
 * Admin → Creator Hub console (Phase 1).
 * Tabs: Overview · Creators · Videos (moderation) · Reports · Copyright ·
 * Strikes · Earnings · Withdrawals · Settings & Flags · Fraud review · QA.
 * Every action hits the admin Creator Hub API; the QA tab provisions a real
 * test creator (Supabase Auth user) and shows persistence status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  creatorHubAdminApi,
  type CreatorHubFlags, type CreatorSettings, type EarningsSummary,
} from '../../services/creatorHubApi.js';

type Tab = 'overview' | 'creators' | 'videos' | 'reports' | 'copyright' | 'strikes' | 'earnings' | 'withdrawals' | 'settings' | 'fraud' | 'qa';

const fmtUsd = (n: number) => `$${Number(n).toFixed(2)}`;
const fmtViews = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

function Card({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-[#04070B] border border-white/10 p-3">
      <p className={`text-lg font-bold ${tone ?? ''}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#8993A3]">{label}</p>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#0D1520]/80 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h4 className="text-xs font-bold tracking-wide uppercase text-[#C6CBD4]">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

export const AdminCreatorHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [flags, setFlags] = useState<CreatorHubFlags | null>(null);

  useEffect(() => { creatorHubAdminApi.getSettings().then((r) => { setFlags(r.flags); }).catch(() => undefined); }, []);

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Overview'], ['creators', 'Creators'], ['videos', 'Videos'],
    ['reports', 'Reports'], ['copyright', 'Copyright reports'], ['strikes', 'Strikes'],
    ['earnings', 'Earnings'], ['withdrawals', 'Withdrawals'], ['settings', 'Settings & Flags'],
    ['fraud', 'Fraud review'], ['qa', 'QA / Testing'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-[#E5093A] text-white' : 'bg-white/5 text-[#8993A3] hover:text-white border border-white/10'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview onGo={setTab} />}
      {tab === 'creators' && <Creators />}
      {tab === 'videos' && <Videos />}
      {tab === 'reports' && <Reports />}
      {tab === 'copyright' && <Copyright />}
      {tab === 'strikes' && <Strikes />}
      {tab === 'earnings' && <Earnings />}
      {tab === 'withdrawals' && <Withdrawals />}
      {tab === 'settings' && <SettingsPanel flags={flags} setFlags={setFlags} />}
      {tab === 'fraud' && <Fraud />}
      {tab === 'qa' && <Qa />}
    </div>
  );
};

// ---- Overview ---------------------------------------------------------------
function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const [o, setO] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.overview>> | null>(null);
  useEffect(() => { creatorHubAdminApi.overview().then(setO).catch(() => undefined); }, []);
  if (!o) return <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Creators" value={o.totals.creators} />
        <Card label="Active creators" value={o.totals.creators_active} />
        <Card label="Videos" value={o.totals.videos} />
        <Card label="Published" value={o.totals.videos_published} />
        <Card label="Pending review" value={o.totals.videos_pending} tone="text-amber-300" />
        <Card label="Watch sessions" value={o.totals.watch_sessions} />
        <Card label="Valid views" value={o.totals.valid_views} />
        <Card label="Suspicious sessions" value={o.totals.suspicious_sessions} tone="text-red-400" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Withdrawals pending" value={o.totals.withdrawals_pending} tone="text-amber-300" />
        <Card label="Persistence" value={o.persistence === 'sql' ? 'Supabase (durable)' : 'Memory (migration pending)'} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {(['videos', 'creators', 'withdrawals', 'fraud', 'qa'] as Tab[]).map((t) => (
          <button key={t} onClick={() => onGo(t)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 capitalize">{t} →</button>
        ))}
      </div>
    </div>
  );
}

// ---- Creators ----------------------------------------------------------------
function Creators() {
  const [creators, setCreators] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listCreators>>['creators']>([]);
  const [form, setForm] = useState({ handle: '', email: '', display_name: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => { creatorHubAdminApi.listCreators({ q: q || undefined }).then((r) => setCreators(r.creators)).catch(() => undefined); }, [q]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setMsg(null);
    try {
      const r = await creatorHubAdminApi.createCreator(form);
      setMsg(`Created @${r.creator.handle}${r.generated_password ? ` — temp password (shown ONCE): ${r.generated_password}` : ' — linked to existing account'}.`);
      setForm({ handle: '', email: '', display_name: '' });
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Section title="Create creator">
        <div className="space-y-2 text-sm">
          <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} placeholder="handle (a-z, 0-9, _)" className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10 text-xs" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email" className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10 text-xs" />
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="display name" className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10 text-xs" />
          <button onClick={create} disabled={!form.handle || !form.email} className="px-4 py-2 rounded-lg bg-[#E5093A] text-white text-xs font-bold disabled:opacity-40">Create / link creator</button>
          {msg && <p className="text-[11px] text-emerald-300 break-words">{msg}</p>}
        </div>
      </Section>
      <Section title={`Creators (${creators.length})`} action={
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter handle" className="px-2 py-1 rounded bg-[#04070B] border border-white/10 text-xs" />
      }>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {creators.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-[#04070B] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <b className="text-sm">@{c.handle}</b> <span className="text-[#8993A3]">· {c.display_name} · {c.email}</span>
                  <p className="text-[10px] text-[#8993A3] mt-0.5">{c.status} · monetization {c.monetization_enabled ? 'ON' : 'off'} · access override: {c.access_tier_override ?? 'none'} · {fmtViews(c.total_views)} views · {fmtViews(c.total_followers)} followers</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <select defaultValue="" onChange={async (e) => { if (!e.target.value) return; try { await creatorHubAdminApi.updateCreator(c.id, { status: e.target.value }); load(); } catch (err) { alert((err as Error).message); } }} className="px-2 py-1 rounded bg-white/10 border border-white/10">
                    <option value="">status…</option>
                    {['active', 'pending', 'suspended', 'banned'].map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button onClick={async () => { try { await creatorHubAdminApi.updateCreator(c.id, { monetization_enabled: !c.monetization_enabled }); load(); } catch (err) { alert((err as Error).message); } }}
                    className={`px-2 py-1 rounded font-semibold ${c.monetization_enabled ? 'bg-emerald-600/30 text-emerald-300' : 'bg-white/10'}`}>
                    {c.monetization_enabled ? 'monetization ON' : 'monetization off'}
                  </button>
                  <select defaultValue="" onChange={async (e) => { if (!e.target.value) return; try { await creatorHubAdminApi.setCreatorAccess(c.id, e.target.value === 'none' ? null : e.target.value); load(); } catch (err) { alert((err as Error).message); } }} className="px-2 py-1 rounded bg-white/10 border border-white/10">
                    <option value="">access override…</option>
                    <option value="free">force FREE</option>
                    <option value="paid">force PAID</option>
                    <option value="auto">auto (2-day rule)</option>
                    <option value="none">clear override</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          {creators.length === 0 && <p className="text-xs text-[#8993A3]">No creators yet — create one on the left, or use the QA tab for a one-click test creator.</p>}
        </div>
      </Section>
    </div>
  );
}

// ---- Videos (moderation) -------------------------------------------------------
function Videos() {
  const [videos, setVideos] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listVideos>>['videos']>([]);
  const [status, setStatus] = useState('pending_review');
  const [q, setQ] = useState('');
  const load = useCallback(() => {
    creatorHubAdminApi.listVideos({ status: status || undefined, q: q || undefined }).then((r) => setVideos(r.videos)).catch(() => undefined);
  }, [status, q]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); load(); } catch (e) { alert((e as Error).message); } };

  return (
    <Section title="Video moderation" action={
      <div className="flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1 rounded bg-[#04070B] border border-white/10 text-xs">
          {['', 'pending_review', 'published', 'draft', 'rejected', 'taken_down'].map((st) => <option key={st} value={st}>{st || 'all'}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="title contains" className="px-2 py-1 rounded bg-[#04070B] border border-white/10 text-xs" />
      </div>
    }>
      <div className="space-y-2 max-h-[560px] overflow-y-auto">
        {videos.map((v) => (
          <div key={v.id} className="rounded-xl border border-white/10 bg-[#04070B] p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="text-sm">{v.title}</b>
                <p className="text-[10px] text-[#8993A3] mt-0.5">
                  @{v.creator?.handle ?? '?'} · {v.kind} · {v.status} · tier {v.access_tier} · {fmtViews(v.valid_views)} valid views · {fmtViews(v.likes_count)} likes
                  {v.rejection_reason ? ` · note: ${v.rejection_reason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.status !== 'published' && (
                  <button onClick={() => act(() => creatorHubAdminApi.approveVideo(v.id))} className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 font-semibold hover:bg-emerald-600/50">Approve</button>
                )}
                {v.status !== 'rejected' && (
                  <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason && reason.trim().length >= 3) void act(() => creatorHubAdminApi.rejectVideo(v.id, reason)); }} className="px-2 py-1 rounded bg-amber-600/20 text-amber-300 font-semibold hover:bg-amber-600/40">Reject</button>
                )}
                {v.status !== 'taken_down' && (
                  <button onClick={() => { const reason = prompt('Takedown reason:'); if (reason) void act(() => creatorHubAdminApi.takedownVideo(v.id, reason, true)); }} className="px-2 py-1 rounded bg-red-600/20 text-red-300 font-semibold hover:bg-red-600/40">Takedown</button>
                )}
                <select defaultValue="" onChange={(e) => { if (!e.target.value) return; void act(() => creatorHubAdminApi.setVideoAccess(v.id, e.target.value)); }} className="px-2 py-1 rounded bg-white/10 border border-white/10">
                  <option value="">access…</option>
                  <option value="free">free</option>
                  <option value="paid">paid</option>
                  <option value="auto">auto (2-day rule)</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        {videos.length === 0 && <p className="text-xs text-[#8993A3]">Nothing here.</p>}
      </div>
    </Section>
  );
}

// ---- Reports -------------------------------------------------------------------
function Reports() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listReports>>['reports']>([]);
  const load = useCallback(() => { creatorHubAdminApi.listReports().then((r) => setReports(r.reports)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <Section title={`Viewer reports (${reports.length})`}>
      <div className="space-y-2 max-h-[520px] overflow-y-auto">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#04070B] p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <b>{r.video?.title ?? r.video_id}</b> <span className="text-[#8993A3]">· {r.status}</span>
                <p className="text-[11px] mt-1">{r.content}</p>
                <p className="text-[10px] text-[#8993A3] mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1.5">
                {(['reviewing', 'resolved', 'dismissed'] as const).map((st) => (
                  <button key={st} onClick={async () => { try { await creatorHubAdminApi.resolveReport(r.id, st); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">{st}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && <p className="text-xs text-[#8993A3]">No reports.</p>}
      </div>
    </Section>
  );
}

// ---- Copyright ------------------------------------------------------------------
function Copyright() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listCopyrightReports>>['reports']>([]);
  const load = useCallback(() => { creatorHubAdminApi.listCopyrightReports().then((r) => setReports(r.reports)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <Section title={`Copyright reports (${reports.length})`}>
      <div className="space-y-2 max-h-[520px] overflow-y-auto">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#04070B] p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b>{r.reporter_name}</b> <span className="text-[#8993A3]">&lt;{r.reporter_email}&gt; · {r.status}</span>
                <p className="text-[11px] mt-1">{r.details.slice(0, 300)}</p>
                {r.video_id && <p className="text-[10px] text-[#8993A3] mt-0.5">video: {r.video_id}</p>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={async () => { try { await creatorHubAdminApi.copyrightAction(r.id, 'resolve', 'Reviewed — no violation.'); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">Resolve</button>
                <button onClick={async () => { try { await creatorHubAdminApi.copyrightAction(r.id, 'dismiss'); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">Dismiss</button>
                <button onClick={async () => { if (confirm('Take down the video AND issue a severity-3 strike?')) { try { await creatorHubAdminApi.copyrightAction(r.id, 'takedown_and_strike'); load(); } catch (e) { alert((e as Error).message); } } }} className="px-2 py-1 rounded bg-red-600/20 text-red-300 font-semibold hover:bg-red-600/40">Takedown + strike</button>
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && <p className="text-xs text-[#8993A3]">No copyright reports.</p>}
      </div>
    </Section>
  );
}

// ---- Strikes -----------------------------------------------------------------------
function Strikes() {
  const [strikes, setStrikes] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listStrikes>>['strikes']>([]);
  const [form, setForm] = useState({ creator_id: '', reason: '', severity: 1 });
  const load = useCallback(() => { creatorHubAdminApi.listStrikes().then((r) => setStrikes(r.strikes)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Section title="Issue strike">
        <div className="space-y-2 text-xs">
          <input value={form.creator_id} onChange={(e) => setForm({ ...form, creator_id: e.target.value })} placeholder="creator id (uuid)" className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="reason" className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10">
            {[1, 2, 3].map((sv) => <option key={sv} value={sv}>severity {sv}</option>)}
          </select>
          <button onClick={async () => { try { const r = await creatorHubAdminApi.issueStrike(form.creator_id, form.reason, form.severity); alert(`Strikes active: ${r.strike_count}${r.auto_suspended ? ' — creator auto-suspended 30d' : ''}`); setForm({ creator_id: '', reason: '', severity: 1 }); load(); } catch (e) { alert((e as Error).message); } }} className="px-4 py-2 rounded-lg bg-red-600/80 text-white font-bold w-full">Issue strike</button>
        </div>
      </Section>
      <Section title={`Strikes (${strikes.length})`}>
        <div className="space-y-1.5 text-xs max-h-[460px] overflow-y-auto">
          {strikes.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-1.5">
              <span>{s.creator_id.slice(0, 8)}… · sev {s.severity} · <b className={s.status === 'active' ? 'text-red-400' : 'text-[#8993A3]'}>{s.status}</b> · {s.reason.slice(0, 80)}</span>
              {s.status === 'active' && <button onClick={async () => { try { await creatorHubAdminApi.reverseStrike(s.id); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">Reverse</button>}
            </div>
          ))}
          {strikes.length === 0 && <p className="text-[#8993A3]">No strikes.</p>}
        </div>
      </Section>
    </div>
  );
}

// ---- Earnings ---------------------------------------------------------------------
function Earnings() {
  const [rows, setRows] = useState<EarningsSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.ledger>>['ledger']>([]);
  const [adj, setAdj] = useState({ amount: '0', description: 'Manual adjustment' });
  const load = useCallback(() => { creatorHubAdminApi.earningsAll().then((r) => setRows(r.earnings)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected) creatorHubAdminApi.ledger(selected).then((r) => setLedger(r.ledger)).catch(() => undefined); }, [selected]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Creator earnings (ESTIMATES — not guaranteed income)">
        <div className="space-y-1.5 text-xs max-h-[420px] overflow-y-auto">
          {rows.map((e) => (
            <button key={e.creator_id} onClick={() => setSelected(e.creator_id)} className={`w-full text-left flex items-center justify-between rounded-lg border px-3 py-2 ${selected === e.creator_id ? 'border-[#E5093A]/60 bg-[#E5093A]/10' : 'border-white/10 bg-[#04070B]'}`}>
              <span className="truncate">{e.creator_id.slice(0, 8)}… · {fmtViews(e.eligible_views)} views</span>
              <span className="font-bold text-[#E5093A]">{fmtUsd(e.estimated_earnings_usd)}</span>
            </button>
          ))}
          {rows.length === 0 && <p className="text-[#8993A3]">No creators yet.</p>}
        </div>
      </Section>
      <div className="space-y-4">
        <Section title="Adjust creator balance">
          <div className="flex gap-2 text-xs">
            <input value={selected ?? ''} readOnly placeholder="select a creator" className="flex-1 px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
            <input value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} type="number" step="0.01" className="w-24 px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
          </div>
          <div className="flex gap-2 mt-2 text-xs">
            <input value={adj.description} onChange={(e) => setAdj({ ...adj, description: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
            <button disabled={!selected} onClick={async () => { try { await creatorHubAdminApi.adjustEarnings(selected!, Number(adj.amount), adj.description); load(); if (selected) creatorHubAdminApi.ledger(selected).then((r) => setLedger(r.ledger)); } catch (e) { alert((e as Error).message); } }} className="px-3 py-2 rounded-lg bg-[#E5093A] text-white font-bold disabled:opacity-40">Apply</button>
          </div>
        </Section>
        <Section title="Ledger">
          <div className="space-y-1 text-[11px] max-h-56 overflow-y-auto">
            {ledger.map((l) => (
              <div key={l.id} className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-[#8993A3]">{new Date(l.created_at).toLocaleDateString()} · {l.entry_type} · {l.description ?? ''}</span>
                <span className={l.amount_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtUsd(l.amount_usd)}</span>
              </div>
            ))}
            {ledger.length === 0 && <p className="text-[#8993A3]">No entries.</p>}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---- Withdrawals ---------------------------------------------------------------------
function Withdrawals() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.listWithdrawals>>['withdrawals']>([]);
  const [status, setStatus] = useState('');
  const [payoutsOn, setPayoutsOn] = useState(false);
  const load = useCallback(() => {
    creatorHubAdminApi.listWithdrawals(status || undefined).then((r) => setRows(r.withdrawals)).catch(() => undefined);
    creatorHubAdminApi.getSettings().then((r) => setPayoutsOn(r.flags.PAYOUTS_ENABLED)).catch(() => undefined);
  }, [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <Section title={`Withdrawals ${payoutsOn ? '' : '(PAYOUTS_ENABLED=false — approve/reject only; mark-paid is locked)'}`} action={
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1 rounded bg-[#04070B] border border-white/10 text-xs">
        {['', 'pending', 'approved', 'paid', 'rejected'].map((st) => <option key={st} value={st}>{st || 'all'}</option>)}
      </select>
    }>
      <div className="space-y-1.5 text-xs max-h-[520px] overflow-y-auto">
        {rows.map((w) => (
          <div key={w.id} className="rounded-xl border border-white/10 bg-[#04070B] p-3 flex flex-wrap items-center justify-between gap-2">
            <span>{w.creator_id.slice(0, 8)}… · <b>{fmtUsd(w.amount_usd)}</b> · {new Date(w.created_at).toLocaleDateString()}</span>
            <span className={`px-2 py-0.5 rounded-md font-semibold ${w.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : w.status === 'rejected' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{w.status}</span>
            <div className="flex gap-1.5">
              {w.status === 'pending' && <button onClick={async () => { try { await creatorHubAdminApi.processWithdrawal(w.id, 'approve'); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 font-semibold">Approve</button>}
              {w.status === 'pending' && <button onClick={async () => { try { await creatorHubAdminApi.processWithdrawal(w.id, 'reject', { admin_note: 'Rejected by admin' }); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-1 rounded bg-red-600/20 text-red-300 font-semibold">Reject</button>}
              {w.status === 'approved' && (
                <button disabled={!payoutsOn} onClick={async () => { const ref = prompt('Payout reference:'); if (ref) { try { await creatorHubAdminApi.processWithdrawal(w.id, 'mark_paid', { payout_ref: ref }); load(); } catch (e) { alert((e as Error).message); } } }} className="px-2 py-1 rounded bg-emerald-600/60 text-white font-semibold disabled:opacity-30" title={payoutsOn ? '' : 'Enable PAYOUTS_ENABLED first'}>Mark paid</button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[#8993A3]">No withdrawal requests.</p>}
      </div>
    </Section>
  );
}

// ---- Settings & Flags ------------------------------------------------------------------
function SettingsPanel({ flags, setFlags }: { flags: CreatorHubFlags | null; setFlags: (f: CreatorHubFlags | null) => void }) {
  const [s, setS] = useState<CreatorSettings | null>(null);
  useEffect(() => { creatorHubAdminApi.getSettings().then((r) => { setS(r.settings); setFlags(r.flags); }).catch(() => undefined); }, [setFlags]);
  if (!s || !flags) return <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />;
  const num = (label: string, key: keyof CreatorSettings, hint?: string) => (
    <label className="block text-xs">
      <span className="text-[#8993A3]">{label}</span>
      <input type="number" value={String(s[key])} onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-[#04070B] border border-white/10" />
      {hint && <span className="text-[10px] text-[#5F6978]">{hint}</span>}
    </label>
  );
  const toggle = (label: string, key: keyof CreatorSettings) => (
    <button onClick={() => setS({ ...s, [key]: !s[key] })} className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border ${s[key] ? 'bg-emerald-600/30 border-emerald-600/40 text-emerald-200' : 'bg-[#04070B] border-white/10 text-[#8993A3]'}`}>
      {label}: {s[key] ? 'ON' : 'OFF'}
    </button>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Monetization (admin-configurable — not hard-coded)">
        <div className="grid grid-cols-2 gap-3">
          {num('Min eligible views', 'min_eligible_views')}
          {num('USD per 10,000 valid views', 'payout_per_10000_valid_views_usd')}
          {num('Minimum withdrawal (USD)', 'minimum_withdrawal_usd')}
        </div>
      </Section>
      <Section title="2-day access model (50/50)">
        <div className="grid grid-cols-2 gap-3">
          {num('Free access %', 'free_access_percentage')}
          {num('Paid access %', 'paid_access_percentage')}
          {num('Free window (days)', 'free_access_duration_days', 'auto-tier videos are free this long after publish')}
        </div>
      </Section>
      <Section title="Moderation & fraud controls">
        <div className="grid grid-cols-2 gap-3">
          {toggle('Moderation', 'moderation_enabled')}
          {toggle('Auto-publish shorts (only when moderation off)', 'auto_publish_shorts')}
          {num('Min watch seconds (valid view)', 'min_watch_seconds')}
          {num('Dedupe window (min)', 'dedupe_window_minutes')}
          {num('Max sessions/hour/IP', 'max_sessions_per_hour_per_ip')}
          {num('Max heartbeat seconds', 'max_watch_heartbeat_seconds')}
          {num('Suspicion threshold', 'suspicion_threshold')}
        </div>
        <button onClick={async () => { try { const r = await creatorHubAdminApi.saveSettings(s); setS(r.settings); alert('Settings saved.'); } catch (e) { alert((e as Error).message); } }} className="mt-3 px-3 py-1.5 rounded-lg bg-[#E5093A] text-white text-xs font-bold">Save settings</button>
      </Section>
      <Section title="Feature flags">
        <div className="space-y-2">
          {(Object.keys(flags) as Array<keyof CreatorHubFlags>).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-[#04070B] border border-white/10 px-3 py-2">
              <span className="text-xs font-mono">{k}</span>
              <button onClick={async () => { try { const r = await creatorHubAdminApi.setFlag(k, !flags[k]); setFlags(r.flags); } catch (e) { alert((e as Error).message); } }}
                className={`px-3 py-1 rounded text-xs font-bold ${flags[k] ? 'bg-emerald-600/40 text-emerald-200' : 'bg-white/10 text-[#8993A3]'}`}>{flags[k] ? 'ON' : 'OFF'}</button>
            </div>
          ))}
          <p className="text-[10px] text-amber-300/80">PAYOUTS_ENABLED and PAID_CONTENT_ENABLED stay OFF by design. Real payouts and paywalls unlock only when you flip them here.</p>
        </div>
      </Section>
    </div>
  );
}

// ---- Fraud review -------------------------------------------------------------------------
function Fraud() {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.fraudSessions>>['sessions']>([]);
  const [only, setOnly] = useState(false);
  const load = useCallback(() => { creatorHubAdminApi.fraudSessions(only).then((r) => setSessions(r.sessions)).catch(() => undefined); }, [only]);
  useEffect(() => { load(); }, [load]);
  return (
    <Section title="Watch sessions (fraud review)" action={
      <label className="text-xs flex items-center gap-2">
        <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> suspicious only
      </label>
    }>
      <div className="space-y-1.5 text-[11px] max-h-[520px] overflow-y-auto">
        {sessions.map((s) => (
          <div key={s.id} className={`rounded-lg border p-2.5 ${s.is_suspicious ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-[#04070B]'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate max-w-[45%]">{s.video_title ?? s.id.slice(0, 8)} · {s.watch_seconds}s · {s.heartbeats} beats · {s.is_valid ? <b className="text-emerald-400">valid</b> : <span className="text-[#8993A3]">{s.invalid_reason ?? 'open'}</span>}</span>
              <span className="text-[#8993A3]">score {s.suspicion_score}{s.suspicion_notes.length ? ` · ${s.suspicion_notes.slice(-2).join(', ')}` : ''}</span>
              <div className="flex gap-1.5">
                <button onClick={async () => { try { await creatorHubAdminApi.reviewSession(s.id, 'validate'); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 font-semibold">Count valid</button>
                <button onClick={async () => { try { await creatorHubAdminApi.reviewSession(s.id, 'invalidate'); load(); } catch (e) { alert((e as Error).message); } }} className="px-2 py-0.5 rounded bg-red-600/20 text-red-300 font-semibold">Invalidate</button>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-[#8993A3]">No watch sessions recorded yet.</p>}
      </div>
    </Section>
  );
}

// ---- QA ---------------------------------------------------------------------------------------
function Qa() {
  const [qa, setQa] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.qa>> | null>(null);
  const [seed, setSeed] = useState<Awaited<ReturnType<typeof creatorHubAdminApi.qaSeedCreator>> | null>(null);
  const load = useCallback(() => { creatorHubAdminApi.qa().then(setQa).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="System status" action={<button onClick={async () => { try { await creatorHubAdminApi.qaRecheck(); load(); } catch (e) { alert((e as Error).message); } }} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold">Re-check DB</button>}>
        {qa ? (
          <div className="text-xs space-y-2">
            <p>Persistence: <b className={qa.persistence_mode === 'sql' ? 'text-emerald-300' : 'text-amber-300'}>{qa.persistence_mode}</b></p>
            <p className="text-[#8993A3]">{qa.hint}</p>
            <p className="text-[#8993A3]">Storage: {qa.storage_bucket}</p>
            <pre className="text-[10px] text-[#8993A3] bg-[#04070B] rounded-lg p-2 overflow-x-auto">{JSON.stringify(qa.table_counts, null, 2)}</pre>
          </div>
        ) : <div className="h-20 rounded-lg bg-white/5 animate-pulse" />}
      </Section>
      <Section title="Provision a real test creator">
        <button onClick={async () => { try { setSeed(await creatorHubAdminApi.qaSeedCreator()); } catch (e) { alert((e as Error).message); } }} className="px-4 py-2 rounded-lg bg-[#E5093A] text-white text-xs font-bold">Create test creator</button>
        {seed && (
          <div className="mt-3 rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-3 text-xs space-y-1">
            <p>Creator <b>@{seed.creator.handle}</b> created ({seed.creator.email}).</p>
            <p>Sign-in email: <code className="bg-black/40 px-1 rounded">{seed.login_hint.email}</code></p>
            <p>One-time password: <code className="bg-black/40 px-1 rounded">{seed.login_hint.password}</code></p>
            <p className="text-[10px] text-[#8993A3]">{seed.login_hint.note} Then open the Creator Hub page as this user to run the full flow: upload → submit → approve here → watch → views → analytics → earnings → withdrawal.</p>
          </div>
        )}
      </Section>
    </div>
  );
}
