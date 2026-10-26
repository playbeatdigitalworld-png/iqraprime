/**
 * QA cleanup for the Creator Hub production E2E runs.
 *
 * Identifies QA data by unambiguous markers created by scripts/test-creator-hub-prod.mjs:
 *   - creators.handle LIKE 'qa\_%'
 *   - creator_videos.title LIKE 'E2E%'
 *   - auth users email LIKE 'qa-%@creator-hub.streamplay.%'
 *   - storage objects under creator-media/users/<auth_user_id>/
 *
 * Never touches: pilot director, owner-created rows, catalog/IPTV data,
 * creator_categories defaults, app_settings, feature_flags.
 *
 * Usage:
 *   node scripts/qa-cleanup.mjs            # dry run (lists what WOULD be deleted)
 *   node scripts/qa-cleanup.mjs --apply    # actually deletes
 */
const fs = await import('node:fs');

// Resolve Supabase constants from the server source (single source of truth),
// service role key from the environment (SUPABASE_SERVICE_ROLE_KEY).
const apiSrc = fs.readFileSync(new URL('../server/routes/api.ts', import.meta.url), 'utf8');
const SB_URL = process.env.SUPABASE_URL || apiSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SB_URL || !SVC) { console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };

async function rest(method, table, query, body) {
  const url = `${SB_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const headers = { ...H };
  if (method === 'DELETE') headers.Prefer = 'return=representation';
  const res = await fetch(url, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* empty */ }
  if (!res.ok) throw new Error(`${method} ${table} ${res.status}: ${String(text).slice(0, 300)}`);
  return json ?? [];
}

async function authDelete(userId) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: H });
  if (!res.ok && res.status !== 404) throw new Error(`auth delete ${userId}: ${res.status} ${await res.text()}`);
  return true;
}

async function storageList(prefix) {
  const res = await fetch(`${SB_URL}/storage/v1/object/list/creator-media`, {
    method: 'POST', headers: H, body: JSON.stringify({ prefix, limit: 100, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) return [];
  return res.json();
}
async function storageDelete(path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/creator-media/${encodeURI(path)}`, { method: 'DELETE', headers: H });
  return res.ok || res.status === 404;
}

const tally = {};
const del = async (label, table, col, ids) => {
  if (!ids.length) return;
  const q = `${col}=in.(${ids.join(',')})`;
  if (!APPLY) {
    const rows = await rest('GET', table, `${q}&select=id`);
    tally[label] = (tally[label] ?? 0) + rows.length;
    return;
  }
  const rows = await rest('DELETE', table, `${q}&select=id`);
  tally[label] = (tally[label] ?? 0) + rows.length;
};

console.log(`== Creator Hub QA cleanup (${APPLY ? 'APPLY — deleting' : 'DRY RUN'}) ==\n`);

// ---- 1. identify QA creators ---------------------------------------------------
const allCreators = await rest('GET', 'creators', 'select=id,user_id,handle,display_name,created_at&order=created_at.asc');
const qaCreators = allCreators.filter((c) => /^qa_/i.test(String(c.handle)));
const keep = allCreators.filter((c) => !/^qa_/i.test(String(c.handle)));
console.log(`creators total=${allCreators.length}  qa=${qaCreators.length}  keep=${keep.length}`);
for (const c of allCreators) console.log(`  ${/^qa_/i.test(c.handle) ? 'QA ' : 'KEEP'}  ${c.id}  ${c.handle}  uid=${c.user_id}  ${c.created_at}`);
const qaCreatorIds = qaCreators.map((c) => c.id);
const qaUserIds = qaCreators.map((c) => c.user_id).filter(Boolean);
if (!qaCreatorIds.length) { console.log('\nNothing to clean.'); process.exit(0); }

// ---- 2. identify QA videos --------------------------------------------------------
const allVideos = await rest('GET', 'creator_videos', 'select=id,creator_id,title,status,storage_path,created_at&order=created_at.asc');
const qaVideos = allVideos.filter((v) => qaCreatorIds.includes(v.creator_id) || /^E2E/i.test(String(v.title)));
console.log(`\ncreator_videos total=${allVideos.length}  qa=${qaVideos.length}`);
for (const v of allVideos) console.log(`  ${qaVideos.includes(v) ? 'QA ' : 'KEEP'}  ${v.id}  "${String(v.title).slice(0, 40)}"  ${v.status}  ${v.created_at}`);
const qaVideoIds = qaVideos.map((v) => v.id);

// ---- 3. show reports / withdrawals before -------------------------------------------
const reports = await rest('GET', 'copyright_reports', `select=id,video_id,status&video_id=in.(${qaVideoIds.join(',')})`);
console.log(`\ncopyright_reports targeting qa videos: ${reports.length}`);
const wd = await rest('GET', 'creator_withdrawals', `select=id,amount_usd,status&creator_id=in.(${qaCreatorIds.join(',')})`);
console.log(`creator_withdrawals for qa creators: ${wd.length}`);

// ---- 4. delete children → parents ------------------------------------------------------
await del('video_engagements', 'video_engagements', 'video_id', qaVideoIds);
await del('video_views', 'video_views', 'video_id', qaVideoIds);
await del('video_watch_sessions', 'video_watch_sessions', 'video_id', qaVideoIds);
await del('copyright_reports', 'copyright_reports', 'video_id', qaVideoIds);
await del('creator_earnings_ledger', 'creator_earnings_ledger', 'video_id', qaVideoIds);
await del('creator_strikes', 'creator_strikes', 'video_id', qaVideoIds);
await del('creator_notifications', 'creator_notifications', 'creator_id', qaCreatorIds);
await del('payout_methods', 'payout_methods', 'creator_id', qaCreatorIds);
await del('creator_withdrawals', 'creator_withdrawals', 'creator_id', qaCreatorIds);
await del('creator_earnings', 'creator_earnings', 'creator_id', qaCreatorIds);
await del('creator_followers', 'creator_followers', 'creator_id', qaCreatorIds);
await del('creator_videos', 'creator_videos', 'creator_id', qaCreatorIds);
await del('creator_profiles', 'creator_profiles', 'creator_id', qaCreatorIds);
await del('creators', 'creators', 'id', qaCreatorIds);
if (qaUserIds.length) {
  try { await del('viewer_entitlements', 'viewer_entitlements', 'user_id', qaUserIds); }
  catch { console.log('  (viewer_entitlements skipped — table/column mismatch)'); }
}

// ---- 5. auth users ---------------------------------------------------------------
if (APPLY) for (const uid of qaUserIds) { await authDelete(uid); tally['auth_users'] = (tally['auth_users'] ?? 0) + 1; }

// ---- 6. storage objects ------------------------------------------------------------
if (APPLY) {
  for (const uid of qaUserIds) {
    const objs = await storageList(`users/${uid}/`);
    for (const o of objs) {
      if (await storageDelete(`users/${uid}/${o.name}`)) tally['storage_objects'] = (tally['storage_objects'] ?? 0) + 1;
    }
  }
}

console.log(`\n== ${APPLY ? 'DELETED' : 'WOULD DELETE'} ==`);
for (const [k, n] of Object.entries(tally)) console.log(`  ${k}: ${n}`);
if (!APPLY) console.log('\nDry run only — re-run with --apply to delete.');
else console.log('\nDone. Verify with: GET /api/creator-hub/admin/qa');
