// Creator monetization engine — earnings ESTIMATION, ledger, withdrawals.
//
// Values (payout rate, minimums, thresholds) come from creator_settings —
// never hard-coded at call sites. Earnings are always labeled ESTIMATED;
// nothing here moves real money unless PAYOUTS_ENABLED is flipped by the owner.
import { store, asEarnings, asLedger, asWithdrawal } from './store.js';
import type { CreatorSettings, CreatorFlags, CreatorRow, WithdrawalRow } from './types.js';
import { HttpError } from './auth.js';

export interface EarningsSummary {
  creator_id: string;
  eligible_views: number;
  rate_usd_per_10000_valid_views: number;
  estimated_earnings_usd: number;
  paid_out_usd: number;
  pending_withdrawal_usd: number;
  available_for_withdrawal_usd: number;
  min_eligible_views: number;
  monetization_eligible: boolean;
  minimum_withdrawal_usd: number;
  label: 'Estimated Earnings';
  disclaimer: string;
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

export async function recomputeCreatorEarnings(creatorId: string, settings: CreatorSettings, flags?: CreatorFlags): Promise<EarningsSummary> {
  const effective = flags ?? await store.getFlags();
  const videos = await store.find('creator_videos', { eq: { creator_id: creatorId, status: 'published' }, limit: 5000 });
  const creatorRaw = await store.get('creators', creatorId);
  const creator = creatorRaw as unknown as CreatorRow | null;

  const monetizationActive = effective.CREATOR_MONETIZATION_ENABLED && !!creator?.monetization_enabled;
  const eligibleViews = monetizationActive
    ? videos.reduce((sum, v) => sum + Number(v.valid_views ?? 0), 0)
    : 0;
  // view-derived estimate + explicit admin adjustments from the ledger
  const ledgerRows = await store.find('creator_earnings_ledger', { eq: { creator_id: creatorId }, limit: 1000 });
  const adjustments = ledgerRows
    .filter((l) => l.entry_type === 'adjustment')
    .reduce((s, l) => s + Number(l.amount_usd ?? 0), 0);
  // live DB enforces CHECK (estimated_earnings_usd >= 0) — negative admin
  // adjustments must never push the estimate below zero
  const estimated = Math.max(0, round4((eligibleViews / 10000) * Number(settings.payout_per_10000_valid_views_usd) + adjustments));

  const withdrawals = await store.find('creator_withdrawals', { eq: { creator_id: creatorId }, limit: 500 });
  const paidOut = round2(withdrawals.filter((w) => w.status === 'paid').reduce((s, w) => s + Number(w.amount_usd ?? 0), 0));
  const pending = round2(withdrawals.filter((w) => w.status === 'pending' || w.status === 'approved').reduce((s, w) => s + Number(w.amount_usd ?? 0), 0));

  const row = {
    creator_id: creatorId,
    eligible_views: eligibleViews,
    estimated_earnings_usd: estimated,
    paid_out_usd: paidOut,
    pending_withdrawal_usd: pending,
    last_computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await store.upsert('creator_earnings', row, 'creator_id');

  return {
    creator_id: creatorId,
    eligible_views: eligibleViews,
    rate_usd_per_10000_valid_views: Number(settings.payout_per_10000_valid_views_usd),
    estimated_earnings_usd: estimated,
    paid_out_usd: paidOut,
    pending_withdrawal_usd: pending,
    available_for_withdrawal_usd: round2(Math.max(0, estimated - paidOut - pending)),
    min_eligible_views: settings.min_eligible_views,
    monetization_eligible: monetizationActive && eligibleViews >= settings.min_eligible_views,
    minimum_withdrawal_usd: Number(settings.minimum_withdrawal_usd),
    label: 'Estimated Earnings',
    disclaimer: 'Estimated earnings are indicative only and are NOT guaranteed income. Payouts require admin approval and platform payout availability.',
  };
}

export async function getEarningsSummary(creatorId: string): Promise<EarningsSummary> {
  const [settings, flags] = await Promise.all([store.getSettings(), store.getFlags()]);
  return recomputeCreatorEarnings(creatorId, settings, flags);
}

async function appendLedger(entry: {
  creator_id: string; video_id?: string | null; entry_type: 'view_credit' | 'adjustment' | 'withdrawal_hold' | 'withdrawal_paid' | 'reversal';
  views?: number; amount_usd?: number; description?: string | null; period_start?: string | null; period_end?: string | null; created_by?: string | null;
}) {
  const row = await store.insert('creator_earnings_ledger', {
    views: 0, amount_usd: 0, description: null, period_start: null, period_end: null, created_by: null, ...entry,
  });
  return asLedger(row as Record<string, unknown>);
}

// ---- withdrawals ------------------------------------------------------------
export async function requestWithdrawal(creator: CreatorRow, amountUsd: number, methodId: string | null, settings: CreatorSettings): Promise<WithdrawalRow> {
  const summary = await recomputeCreatorEarnings(creator.id, settings);
  const amount = round2(Number(amountUsd));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'bad_amount', 'Withdrawal amount must be a positive number.');
  if (amount < Number(settings.minimum_withdrawal_usd)) {
    throw new HttpError(400, 'below_minimum', `Minimum withdrawal is $${Number(settings.minimum_withdrawal_usd).toFixed(2)}.`);
  }
  if (amount > summary.available_for_withdrawal_usd) {
    throw new HttpError(400, 'insufficient_balance', `Available estimated balance is $${summary.available_for_withdrawal_usd.toFixed(2)}.`);
  }
  if (methodId) {
    const method = await store.get('payout_methods', methodId);
    if (!method || method.creator_id !== creator.id) throw new HttpError(400, 'bad_payout_method', 'Payout method not found for this creator.');
  }
  const pendingCount = (await store.find('creator_withdrawals', { eq: { creator_id: creator.id, status: 'pending' }, limit: 10 })).length;
  if (pendingCount >= 3) throw new HttpError(429, 'too_many_pending', 'You already have 3 pending withdrawal requests. Wait for review.');

  const row = await store.insert('creator_withdrawals', {
    creator_id: creator.id,
    method_id: methodId,
    amount_usd: amount,
    status: 'pending',
  });
  const withdrawal = asWithdrawal(row as Record<string, unknown>);
  await appendLedger({
    creator_id: creator.id, entry_type: 'withdrawal_hold', amount_usd: -amount,
    description: `Withdrawal request ${withdrawal.id} (hold)`,
  });
  return withdrawal;
}

export async function adminProcessWithdrawal(withdrawalId: string, action: 'approve' | 'reject' | 'mark_paid', adminId: string, settings: CreatorSettings, flags: CreatorFlags, opts: { adminNote?: string; payoutRef?: string } = {}): Promise<WithdrawalRow> {
  const raw = await store.get('creator_withdrawals', withdrawalId);
  if (!raw) throw new HttpError(404, 'not_found', 'Withdrawal not found.');
  const w = asWithdrawal(raw);
  const now = new Date().toISOString();
  const base = { admin_note: opts.adminNote ?? w.admin_note, processed_by: adminId, processed_at: now };

  if (action === 'approve') {
    if (w.status !== 'pending') throw new HttpError(409, 'bad_state', `Cannot approve a withdrawal in state ${w.status}.`);
    return asWithdrawal((await store.update('creator_withdrawals', withdrawalId, { ...base, status: 'approved' }) as Record<string, unknown>));
  }
  if (action === 'reject') {
    if (w.status === 'paid') throw new HttpError(409, 'bad_state', 'Cannot reject a paid withdrawal.');
    const updated = await store.update('creator_withdrawals', withdrawalId, { ...base, status: 'rejected' });
    await appendLedger({
      creator_id: w.creator_id, entry_type: 'reversal', amount_usd: Number(w.amount_usd),
      description: `Withdrawal ${withdrawalId} rejected — funds released`,
    });
    return asWithdrawal(updated as Record<string, unknown>);
  }
  // mark_paid
  if (!flags.PAYOUTS_ENABLED) throw new HttpError(403, 'payouts_disabled', 'PAYOUTS_ENABLED is false. Real payouts are locked by feature flag.');
  if (w.status !== 'approved') throw new HttpError(409, 'bad_state', 'Withdrawal must be approved before marking as paid.');
  const updated = await store.update('creator_withdrawals', withdrawalId, { ...base, status: 'paid', payout_ref: opts.payoutRef ?? `manual-${Date.now()}` });
  await appendLedger({
    creator_id: w.creator_id, entry_type: 'withdrawal_paid', amount_usd: -Number(w.amount_usd),
    description: `Withdrawal ${withdrawalId} paid out`,
  });
  await notify(w.creator_id, 'payout', 'Payout sent', `Your withdrawal of $${Number(w.amount_usd).toFixed(2)} has been marked as paid.`, { withdrawal_id: withdrawalId });
  await recomputeCreatorEarnings(w.creator_id, settings, flags);
  return asWithdrawal(updated as Record<string, unknown>);
}

// ---- daily rollup (cron): append view_credit ledger entries -----------------
export async function rollupLedger(settings: CreatorSettings, flags: CreatorFlags): Promise<{ creators: number; entries: number }> {
  if (!flags.CREATOR_MONETIZATION_ENABLED) return { creators: 0, entries: 0 };
  const creators = await store.find('creators', { eq: { monetization_enabled: true }, limit: 1000 });
  let entries = 0;
  for (const cRaw of creators) {
    const creatorId = String(cRaw.id);
    const last = (await store.find('creator_earnings_ledger', { eq: { creator_id: creatorId, entry_type: 'view_credit' }, order: { field: 'period_end' }, limit: 1 }))[0];
    const since = last && last.period_end ? String(last.period_end) : new Date(Date.now() - 7 * 86_400_000).toISOString();
    const videos = await store.find('creator_videos', { eq: { creator_id: creatorId, status: 'published' }, limit: 5000 });
    for (const v of videos) {
      // attribute views created since last rollup
      const views = await store.find('video_views', { eq: { video_id: String(v.id) }, order: { field: 'created_at' }, limit: 10000 });
      const delta = views.filter((x) => String(x.created_at) > since).length;
      if (delta <= 0) continue;
      const amount = round4((delta / 10000) * Number(settings.payout_per_10000_valid_views_usd));
      await appendLedger({
        creator_id: creatorId, video_id: String(v.id), entry_type: 'view_credit', views: delta, amount_usd: amount,
        description: `Valid views credited (${delta} × $${settings.payout_per_10000_valid_views_usd}/10k)`,
        period_start: since, period_end: new Date().toISOString(),
      });
      entries += 1;
    }
  }
  return { creators: creators.length, entries };
}

// ---- notifications -----------------------------------------------------------
export async function notify(creatorId: string, type: 'info' | 'approval' | 'rejection' | 'strike' | 'payout' | 'system', title: string, body: string | null, data: Record<string, unknown> = {}): Promise<void> {
  await store.insert('creator_notifications', { creator_id: creatorId, type, title, body, data });
}

export async function earningsOf(creatorId: string) {
  const rows = await store.find('creator_earnings', { eq: { creator_id: creatorId }, limit: 1 });
  return rows[0] ? asEarnings(rows[0]) : null;
}
