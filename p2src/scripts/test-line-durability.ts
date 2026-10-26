/**
 * Durable member-line vault E2E test (Task 11).
 * Phases (env-driven, works against local or production):
 *   assign          — login admin, find-or-create test member, assign vault
 *                     line (real provider probe), assert masked admin view +
 *                     ciphertext-only durable row via service-role REST read.
 *   verify-restored — login admin, assert the line is present WITHOUT any
 *                     assignment call in this process lifetime (proves
 *                     cold-start hydration). For production, run AFTER a
 *                     redeploy (fresh instance, empty memory).
 *   cleanup         — delete the test member, then assert the durable row is
 *                     purged (service-role REST read returns 0 rows for it).
 *
 * Env: BASE_URL, ADMIN_EMAIL, ADMIN_PASS, LINE_TEST_SERVER, LINE_TEST_USER,
 *      LINE_TEST_PASS, TEST_EMAIL, TEST_NAME, SB_SERVICE, phase
 * Secrets are never printed; row payloads are screened for plaintext leaks.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aetherstream.tv';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const LINE_SERVER = process.env.LINE_TEST_SERVER || '';
const LINE_USER = process.env.LINE_TEST_USER || '';
const LINE_PASS = process.env.LINE_TEST_PASS || '';
const TEST_EMAIL = process.env.TEST_EMAIL || 'durability.test@aetherstream.tv';
const TEST_NAME = process.env.TEST_NAME || 'Durability Test';
const SB_SERVICE = process.env.SB_SERVICE || '';
const SB_URL = process.env.SB_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
const PHASE = process.env.phase || 'assign';

let failures = 0;
function ok(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures += 1;
}

function mask(u: string): string {
  return u.length <= 4 ? `${u}••••` : `${u.slice(0, 4)}••••`;
}

async function api(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body };
}

async function serviceRows(): Promise<any[]> {
  if (!SB_SERVICE) throw new Error('SB_SERVICE required');
  const res = await fetch(`${SB_URL}/rest/v1/member_iptv_lines?select=*`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  if (!res.ok) throw new Error(`service read failed HTTP ${res.status}`);
  return res.json();
}

async function main(): Promise<void> {
  console.log(`=== phase=${PHASE} base=${BASE} ===`);
  // 1. admin login
  const login = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  ok('admin login', login.status === 200 && !!login.body?.token, login.status === 200 ? `uid=${login.body?.user?.id}` : `HTTP ${login.status}`);
  if (login.status !== 200) process.exit(1);
  const token: string = login.body.token;

  // 2. find-or-create test member (memory-scoped: may be gone after a restart —
  // the durable row is then the source of truth for its id)
  const membersRsp = await api('/admin/members', { token });
  const members: any[] = membersRsp.body?.members || [];
  ok('members list fetched', membersRsp.status === 200, `count=${members.length}`);
  let member = members.find((m) => String(m.email).toLowerCase() === TEST_EMAIL);
  if (PHASE === 'assign' && !member) {
    const created = await api('/admin/members/create', {
      method: 'POST', token,
      body: { name: TEST_NAME, email: TEST_EMAIL, password: `Dt-${Date.now()}-x` },
    });
    ok('member create', created.status === 201, created.status === 201 ? `id=${created.body?.member?.id}` : JSON.stringify(created.body).slice(0, 120));
    member = created.body?.member;
  }
  if (PHASE === 'assign') {
    ok('test member present', !!member?.id, `id=${member?.id || 'MISSING'}`);
    if (!member?.id) process.exit(1);
  }

  if (PHASE === 'verify-restored') {
    // After a restart the member account may be gone (memory-only store);
    // durability means the LINE survived. Locate it via the durable row id.
    const durableRows = await serviceRows();
    const durableRow = durableRows.find((r) =>
      member?.id ? r.pilot_member_id === member.id : String(r.provider_name || '').includes('Durability Test')
    );
    ok('durable row still exists', !!durableRow, durableRow ? `pilot_member_id=${durableRow.pilot_member_id}` : 'MISSING');
    if (!member && durableRow) member = { id: durableRow.pilot_member_id, email: durableRow.member_email };
  }

  if (PHASE === 'assign') {
    // 3. assign vault line (real provider probe)
    const assigned = await api(`/admin/members/${member.id}/iptv-line`, {
      method: 'POST', token,
      body: {
        serverUrl: LINE_SERVER, username: LINE_USER, password: LINE_PASS,
        providerName: 'Durability Test Line (vault creds)',
      },
    });
    ok('line assign (probe auth)', assigned.status === 200 && assigned.body?.success === true,
      assigned.status === 200 ? `probe: ${assigned.body?.probe?.message || 'n/a'}` : JSON.stringify(assigned.body).slice(0, 160));
    ok('masked username in response', assigned.body?.line?.usernameMasked === mask(LINE_USER), `${assigned.body?.line?.usernameMasked}`);
  }

  // 4. admin masked list view (skipped pre-delete in cleanup phase)
  if (PHASE !== 'cleanup') {
    const lines = (await api('/admin/iptv-lines', { token })).body?.lines || [];
    const mine = lines.find((l: any) => l.userId === member?.id);
    ok('admin list shows member line', !!mine?.assigned, mine ? `user=${mine.usernameMasked} status=${mine.status} exp=${(mine.expiresAt || '').slice(0, 10)}` : 'not found');
    ok('masked username correct', mine?.usernameMasked === mask(LINE_USER), `${mine?.usernameMasked}`);
    ok('no raw password in admin view', !JSON.stringify(lines).includes(LINE_PASS), 'leak-screened');
  }

  if (PHASE === 'assign') {
    // 5. durable row via service-role REST (poll: sync is fire-and-forget)
    let rows: any[] = [];
    let row: any = undefined;
    for (let i = 0; i < 10; i++) {
      rows = await serviceRows();
      row = rows.find((r) => r.pilot_member_id === member?.id);
      if (row) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (PHASE === 'assign') {
      ok('durable row exists', !!row, row ? `status=${row.status} maxconn=${row.max_connections}` : 'MISSING');
      ok('username ciphertext format', /^v1\./.test(String(row?.username_encrypted || '')), 'v1.iv.tag.ct');
      ok('password ciphertext format', /^v1\./.test(String(row?.password_encrypted || '')), 'v1.iv.tag.ct');
      const raw = JSON.stringify(rows);
      ok('no plaintext username in row', !raw.includes(LINE_USER), 'leak-screened');
      ok('no plaintext password in row', !raw.includes(LINE_PASS), 'leak-screened');
    }
  }

  if (PHASE === 'cleanup' && member?.id) {
    if (members.some((m) => m.id === member.id)) {
      const del = await api(`/admin/members/${member.id}`, { method: 'DELETE', token });
      ok('member deleted', del.status === 200, `HTTP ${del.status}`);
      // poll: durable purge is fire-and-forget
      let gone = false;
      for (let i = 0; i < 10; i++) {
        const rowsAfter = await serviceRows();
        if (!rowsAfter.some((r) => r.pilot_member_id === member.id)) { gone = true; break; }
        await new Promise((r) => setTimeout(r, 1000));
      }
      ok('durable row purged after member delete', gone, 'polled 10s');
      const linesAfter = (await api('/admin/iptv-lines', { token })).body?.lines || [];
      ok('admin list clean after delete', !linesAfter.some((l: any) => l.userId === member.id), `rows=${linesAfter.length}`);
    } else {
      // Member account already vanished (memory-only store post-restart):
      // purge the durable test row directly (service-role, test artifact only).
      const delRes = await fetch(`${SB_URL}/rest/v1/member_iptv_lines?pilot_member_id=eq.${member.id}`, {
        method: 'DELETE',
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
      });
      ok('orphaned durable row deleted (service-role)', delRes.status === 204 || delRes.status === 200, `HTTP ${delRes.status}`);
      const rowsAfter = await serviceRows();
      ok('durable store clean', rowsAfter.length === 0, `remaining=${rowsAfter.length}`);
    }
  }

  console.log(failures === 0 ? `=== ${PHASE}: ALL PASS ===` : `=== ${PHASE}: ${failures} FAILURE(S) ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SCRIPT ERROR', e instanceof Error ? e.message : e); process.exit(2); });
