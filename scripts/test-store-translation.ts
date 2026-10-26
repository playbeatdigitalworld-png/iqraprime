/**
 * Creator Hub store translation unit tests.
 * Validates the old-shape <-> live-DB translation against the APPLIED
 * 20261008000000_creator_hub_phase1.sql schema (+ compat columns) without
 * needing live Supabase credentials. Every case here mirrors a real DB
 * constraint/column that previously had no mapping (would have failed in
 * sql mode with PGRST204 / 23502 / trigger exceptions).
 */
import { rowToDb } from '../server/creatorHub/store.js';

let failures = 0;
function expect(name: string, cond: boolean, extra = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !extra ? '' : `  (${extra})`}`);
}
function eq(name: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want);
  expect(name, ok, ok ? '' : `got ${JSON.stringify(actual)}, want ${JSON.stringify(want)}`);
}

// ---------------------------------------------------------------------------
// 1. creators insert: channel_name is NOT NULL in the live schema; the server
//    layer only knows display_name -> derived automatically.
// ---------------------------------------------------------------------------
const c = rowToDb('creators', {
  user_id: 'u1', handle: 'qa_creator', display_name: 'QA Creator', email: 'qa@test.dev',
  status: 'active', monetization_enabled: false,
} as Record<string, unknown>);
eq('creators: status enum pending->PENDING', c.status, 'ACTIVE');
eq('creators: channel_name derived from display_name', c.channel_name, 'QA Creator');
eq('creators: handle untouched', c.handle, 'qa_creator');
expect('creators: monetization_enabled passthrough', c.monetization_enabled === false);

const c2 = rowToDb('creators', { handle: 'h_only', status: 'pending' } as Record<string, unknown>);
eq('creators: channel_name falls back to handle', c2.channel_name, 'h_only');
eq('creators: status pending->PENDING', c2.status, 'PENDING');

// ---------------------------------------------------------------------------
// 2. creator_videos: access_tier -> access_type (+ enum), and media_url is
//    derived from storage_path so the phase-1 trigger
//    (media_url required at PENDING_REVIEW) never fires on submit.
// ---------------------------------------------------------------------------
const v = rowToDb('creator_videos', {
  kind: 'short', status: 'pending_review', access_tier: 'auto',
  storage_path: 'creator01/abc.mp4', valid_views: 5, likes_count: 2,
  comments_count: 1, watch_seconds: 120,
} as Record<string, unknown>);
eq('videos: kind short->SHORTS', v.content_type, 'SHORTS');
eq('videos: status pending_review->PENDING_REVIEW', v.status, 'PENDING_REVIEW');
eq('videos: access_tier auto->AUTO (access_type)', v.access_type, 'AUTO');
eq('videos: valid_views->valid_view_count', v.valid_view_count, 5);
eq('videos: media_url derived', v.media_url, 'creator-media/creator01/abc.mp4');

const vDraft = rowToDb('creator_videos', { status: 'draft' } as Record<string, unknown>);
eq('videos: draft insert has NO media_url (guard allows DRAFT)', vDraft.media_url, undefined);
eq('videos: status draft->DRAFT', vDraft.status, 'DRAFT');

const vRej = rowToDb('creator_videos', { status: 'rejected', access_tier: 'free' } as Record<string, unknown>);
eq('videos: rejected->REJECTED', vRej.status, 'REJECTED');
eq('videos: access_tier free->FREE', vRej.access_type, 'FREE');

// ---------------------------------------------------------------------------
// 3. payout_methods: details -> account_details, label -> display_name,
//    method_type enum widened by compat ('BANK','WISE').
// ---------------------------------------------------------------------------
const p = rowToDb('payout_methods', {
  method_type: 'bank', label: 'My bank', details: { iban: 'X1', holder: 'A' }, is_default: true,
} as Record<string, unknown>);
eq('payout: label->display_name', p.display_name, 'My bank');
eq('payout: details->account_details', p.account_details, { iban: 'X1', holder: 'A' });
eq('payout: method_type bank->BANK', p.method_type, 'BANK');
expect('payout: no stray details key left', !('details' in p));

// ---------------------------------------------------------------------------
// 4. video_views / sessions / withdrawals / notifications maps intact.
// ---------------------------------------------------------------------------
const s = rowToDb('video_watch_sessions', {
  viewer_key: 'k1', watch_seconds: 45, suspicion_notes: ['x'], suspicion_score: 10,
} as Record<string, unknown>);
eq('sessions: viewer_key->viewer_session_key', s.viewer_session_key, 'k1');
eq('sessions: watch_seconds->watched_seconds', s.watched_seconds, 45);
eq('sessions: suspicion_notes->suspicious_reasons', s.suspicious_reasons, ['x']);

const view = rowToDb('video_views', { session_id: 's1', source: 'web' } as Record<string, unknown>);
eq('views: session_id->watch_session_id', view.watch_session_id, 's1');

const e = rowToDb('video_engagements', { type: 'report', content: 'bad content' } as Record<string, unknown>);
eq('engagements: type report->REPORT', e.engagement_type, 'REPORT');
eq('engagements: content->comment_text', e.comment_text, 'bad content');

const n = rowToDb('creator_notifications', { type: 'approval' } as Record<string, unknown>);
eq('notifications: approval->APPROVAL', n.notif_type, 'APPROVAL');

const w = rowToDb('creator_withdrawals', { method_id: 'm1', payout_ref: 'TR-1', status: 'paid' } as Record<string, unknown>);
eq('withdrawals: method_id->payout_method_id', w.payout_method_id, 'm1');
eq('withdrawals: payout_ref->transaction_ref', w.transaction_ref, 'TR-1');
eq('withdrawals: status paid->COMPLETED', w.status, 'COMPLETED');

const l = rowToDb('creator_earnings_ledger', { entry_type: 'view_credit' } as Record<string, unknown>);
eq('ledger: view_credit->VIEW_CREDIT', l.entry_type, 'VIEW_CREDIT');

const st = rowToDb('creator_strikes', { severity: 3 } as Record<string, unknown>);
eq('strikes: severity 3->STRIKE_3', st.severity, 'STRIKE_3');

const cr = rowToDb('copyright_reports', { status: 'resolved', reviewed_by: 'admin@x' } as Record<string, unknown>);
eq('copyright: resolved->UPHELD', cr.status, 'UPHELD');
eq('copyright: reviewed_by passthrough (compat column)', cr.reviewed_by, 'admin@x');

console.log(failures === 0 ? '\nALL TRANSLATION TESTS PASS' : `\n${failures} TRANSLATION TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
