// Creator Hub data layer.
//
// Two persistence modes, decided by ONE runtime probe:
//   * 'sql'    — Supabase Postgres via the SERVICE-ROLE client (server only).
//                Only active when BOTH the phase-1 migration AND the compat
//                migration are applied (probe checks a compat column).
//   * 'memory' — in-process fallback used until then. All Creator Hub flows
//                stay fully functional; rows reset on cold start. The admin
//                QA view shows the active mode; /admin/creator-hub/qa/recheck
//                re-probes.
//
// SCHEMA TRANSLATION: the live database (20261008000000_creator_hub_phase1.sql
// + 20261008000001_creator_hub_compat.sql) is the spec-correct source of
// truth (UPPERCASE state machine, spec column names). The server layer above
// this store speaks the historical row shape (lowercase states, a few
// different field names). All translation happens HERE, at the boundary —
// callers and the UI stay unchanged.
import { getServiceSupabase } from '../db/supabase.js';
import type {
  CreatorRow, CreatorProfileRow, CreatorVideoRow, WatchSessionRow, VideoViewRow,
  EngagementRow, CreatorEarningsRow, LedgerRow, WithdrawalRow, PayoutMethodRow,
  StrikeRow, CopyrightReportRow, NotificationRow, CreatorSettings, CreatorFlags,
} from './types.js';
import { DEFAULT_SETTINGS, DEFAULT_FLAGS } from './types.js';

export type PersistenceMode = 'sql' | 'memory';

export interface FindOpts {
  eq?: Record<string, unknown>;
  inEq?: Record<string, unknown[]>;
  neq?: Record<string, unknown>;
  ilike?: Record<string, string>;
  order?: { field: string; asc?: boolean } | null;
  limit?: number;
  offset?: number;
  fields?: string;
}

const TABLES = [
  'creators', 'creator_profiles', 'creator_videos', 'creator_followers',
  'video_watch_sessions', 'video_views', 'video_engagements', 'creator_earnings',
  'creator_earnings_ledger', 'creator_withdrawals', 'payout_methods',
  'creator_strikes', 'copyright_reports', 'creator_notifications',
  'viewer_entitlements', 'creator_categories',
] as const;
export type Table = typeof TABLES[number];

type AnyRow = Record<string, unknown>;

// ============================================================================
// SCHEMA TRANSLATION MAPS (old field/value -> live DB field/value)
// ============================================================================
const FIELD_MAPS: Record<string, Record<string, string>> = {
  creator_videos: {
    kind: 'content_type',
    valid_views: 'valid_view_count',
    likes_count: 'like_count',
    comments_count: 'comment_count',
    moderated_by: 'reviewed_by',
    moderated_at: 'reviewed_at',
    access_tier: 'access_type',
  },
  video_watch_sessions: {
    viewer_key: 'viewer_session_key',
    watch_seconds: 'watched_seconds',
    suspicion_notes: 'suspicious_reasons',
  },
  video_views: { session_id: 'watch_session_id' },
  video_engagements: { type: 'engagement_type', content: 'comment_text' },
  creator_notifications: { type: 'notif_type' },
  creator_withdrawals: { method_id: 'payout_method_id', payout_ref: 'transaction_ref' },
  payout_methods: { label: 'display_name', details: 'account_details' },
};

// NOTE: enum maps are keyed by the LIVE DB field name (post field-rename).
const ENUM_MAPS: Record<string, Record<string, Record<string, string>>> = {
  creators: {
    status: { pending: 'PENDING', active: 'ACTIVE', suspended: 'SUSPENDED', banned: 'BANNED' },
  },
  creator_videos: {
    content_type: { video: 'VIDEO', short: 'SHORTS', live: 'LIVE' },
    status: { draft: 'DRAFT', pending_review: 'PENDING_REVIEW', published: 'PUBLISHED', rejected: 'REJECTED', taken_down: 'TAKEN_DOWN' },
    access_type: { free: 'FREE', paid: 'PAID', auto: 'AUTO' },
  },
  video_engagements: {
    engagement_type: { like: 'LIKE', comment: 'COMMENT', report: 'REPORT' },
  },
  creator_notifications: {
    notif_type: { info: 'INFO', approval: 'APPROVAL', rejection: 'REJECTION', strike: 'STRIKE', payout: 'PAYOUT', system: 'SYSTEM' },
  },
  creator_earnings_ledger: {
    entry_type: { view_credit: 'VIEW_CREDIT', adjustment: 'ADJUSTMENT', withdrawal_hold: 'WITHDRAWAL_HOLD', withdrawal_paid: 'WITHDRAWAL_PAID', reversal: 'REVERSAL' },
  },
  creator_withdrawals: {
    status: { pending: 'REQUESTED', approved: 'APPROVED', paid: 'COMPLETED', rejected: 'REJECTED' },
  },
  copyright_reports: {
    status: { open: 'OPEN', reviewing: 'REVIEWING', resolved: 'UPHELD', dismissed: 'DISMISSED' },
  },
  payout_methods: {
    method_type: { bank: 'BANK', paypal: 'PAYPAL', wise: 'WISE', other: 'OTHER' },
  },
};

// creator_strikes.severity: old code uses 1|2|3, live DB uses text enum
const STRIKE_SEVERITY_WRITE: Record<string, string> = { '1': 'STRIKE_1', '2': 'STRIKE_2', '3': 'STRIKE_3' };
const STRIKE_SEVERITY_READ: Record<string, number> = { WARNING: 0, STRIKE_1: 1, STRIKE_2: 2, STRIKE_3: 3 };

function invertMap(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) out[v] = k;
  return out;
}

/** old-shape row -> live DB row (exported for unit tests) */
export function rowToDb(table: Table, row: AnyRow): AnyRow {
  const fMap = FIELD_MAPS[table] ?? {};
  const eMap = ENUM_MAPS[table] ?? {};
  const out: AnyRow = {};
  for (const [k, v] of Object.entries(row)) {
    const dbField = fMap[k] ?? k;
    // strikes.severity special-case
    if (table === 'creator_strikes' && k === 'severity' && v != null) {
      out.severity = STRIKE_SEVERITY_WRITE[String(v)] ?? String(v);
      continue;
    }
    const valueMap = eMap[dbField];
    out[dbField] = (valueMap && typeof v === 'string' && v in valueMap) ? valueMap[v] : v;
  }

  // DB-compat special-cases against the APPLIED phase-1 schema:
  // * creators.channel_name is NOT NULL (phase-1) while the server layer only
  //   knows display_name — derive it so inserts never violate the constraint.
  if (table === 'creators' && (out.channel_name == null || out.channel_name === '')) {
    out.channel_name = String(out.display_name ?? out.handle ?? 'creator');
  }
  // * phase-1 triggers require media_url before a video may enter
  //   PENDING_REVIEW; the server layer tracks media via storage_path. Derive
  //   media_url from storage_path so submit-for-review never trips the guard.
  if (table === 'creator_videos' && !out.media_url && out.storage_path) {
    out.media_url = `creator-media/${String(out.storage_path)}`;
  }
  return out;
}

/** live DB row -> old-shape row */
function rowFromDb(table: Table, row: AnyRow): AnyRow {
  const fMap = FIELD_MAPS[table] ?? {};
  const rField: Record<string, string> = {};
  for (const [o, d] of Object.entries(fMap)) rField[d] = o;
  const eMap = ENUM_MAPS[table] ?? {};
  const rEnum: Record<string, Record<string, string>> = {};
  for (const [dbField, vm] of Object.entries(eMap)) rEnum[dbField] = invertMap(vm);
  const out: AnyRow = {};
  for (const [k, v] of Object.entries(row)) {
    const oldField = rField[k] ?? k;
    if (table === 'creator_strikes' && k === 'severity' && v != null) {
      out[oldField] = STRIKE_SEVERITY_READ[String(v)] ?? String(v);
      continue;
    }
    const valueMap = rEnum[k];
    out[oldField] = (valueMap && typeof v === 'string' && v in valueMap) ? valueMap[v] : v;
  }
  return out;
}

/** translate find/filter options into DB terms */
function optsToDb(table: Table, opts: FindOpts): FindOpts {
  const fMap = FIELD_MAPS[table] ?? {};
  const eMap = ENUM_MAPS[table] ?? {};
  const tKey = (k: string) => fMap[k] ?? k;
  const tVal = (dbKey: string, oldKey: string, v: unknown) => {
    const vm = eMap[dbKey] ?? eMap[oldKey];
    return (vm && typeof v === 'string' && v in vm) ? vm[v] : v;
  };
  const out: FindOpts = { ...opts };
  if (opts.eq) out.eq = Object.fromEntries(Object.entries(opts.eq).map(([k, v]) => [tKey(k), tVal(tKey(k), k, v)]));
  if (opts.neq) out.neq = Object.fromEntries(Object.entries(opts.neq).map(([k, v]) => [tKey(k), tVal(tKey(k), k, v)]));
  if (opts.inEq) out.inEq = Object.fromEntries(Object.entries(opts.inEq).map(([k, arr]) => [tKey(k), arr.map((v) => tVal(tKey(k), k, v))]));
  if (opts.ilike) out.ilike = Object.fromEntries(Object.entries(opts.ilike).map(([k, v]) => [tKey(k), v]));
  if (opts.order) out.order = { ...opts.order, field: tKey(opts.order.field) };
  return out;
}

// settings field <-> app_settings key
const SETTINGS_KEYS: Record<string, string> = {
  min_eligible_views: 'MIN_ELIGIBLE_VIEWS',
  payout_per_10000_valid_views_usd: 'PAYOUT_PER_10000_VALID_VIEWS',
  minimum_withdrawal_usd: 'MINIMUM_WITHDRAWAL_USD',
  free_access_percentage: 'FREE_ACCESS_PERCENTAGE',
  paid_access_percentage: 'PAID_ACCESS_PERCENTAGE',
  free_access_duration_days: 'FREE_ACCESS_DURATION_DAYS',
  moderation_enabled: 'MODERATION_ENABLED',
  auto_publish_shorts: 'AUTO_PUBLISH_SHORTS',
  min_watch_seconds: 'VIEW_MIN_WATCH_SECONDS',
  dedupe_window_minutes: 'DEDUPE_WINDOW_MINUTES',
  max_sessions_per_hour_per_ip: 'MAX_SESSIONS_PER_HOUR_PER_IP',
  max_watch_heartbeat_seconds: 'MAX_WATCH_HEARTBEAT_SECONDS',
  suspicion_threshold: 'SUSPICION_THRESHOLD',
};

class MemoryBackend {
  data = new Map<Table, Map<string, AnyRow>>();
  private ensure(table: Table) {
    if (!this.data.has(table)) this.data.set(table, new Map());
    return this.data.get(table)!;
  }
  list(table: Table, opts: FindOpts = {}): AnyRow[] {
    let rows = Array.from(this.ensure(table).values());
    if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) rows = rows.filter((r) => String(r[k]) === String(v));
    if (opts.neq) for (const [k, v] of Object.entries(opts.neq)) rows = rows.filter((r) => String(r[k]) !== String(v));
    if (opts.inEq) for (const [k, arr] of Object.entries(opts.inEq)) {
      const set = new Set(arr.map((x) => String(x)));
      rows = rows.filter((r) => set.has(String(r[k])));
    }
    if (opts.ilike) for (const [k, needle] of Object.entries(opts.ilike)) {
      const n = needle.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => String(r[k] ?? '').toLowerCase().includes(n));
    }
    if (opts.order) {
      const { field, asc = false } = opts.order;
      rows.sort((a, b) => {
        const av = a[field] as string | number | null;
        const bv = b[field] as string | number | null;
        const cmp = av === bv ? 0 : ((av ?? '') > (bv ?? '') ? 1 : -1);
        return asc ? cmp : -cmp;
      });
    }
    if (opts.offset) rows = rows.slice(opts.offset);
    if (opts.limit != null) rows = rows.slice(0, opts.limit);
    return rows;
  }
  get(table: Table, id: string): AnyRow | null { return this.ensure(table).get(id) ?? null; }
  insert(table: Table, row: AnyRow): AnyRow {
    const map = this.ensure(table);
    const id = String(row.id ?? crypto.randomUUID());
    const full = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row } as AnyRow;
    full.id = id;
    map.set(id, full);
    return full;
  }
  update(table: Table, id: string, patch: AnyRow): AnyRow | null {
    const map = this.ensure(table);
    const cur = map.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id, updated_at: new Date().toISOString() };
    map.set(id, next);
    return next;
  }
  delete(table: Table, id: string): boolean { return this.ensure(table).delete(id); }
  count(table: Table, eq?: Record<string, unknown>): number {
    return eq ? this.list(table, { eq }).length : this.ensure(table).size;
  }
  upsert(table: Table, row: AnyRow, pk: string): AnyRow {
    const existing = this.ensure(table).get(String(row[pk]));
    if (existing) return this.update(table, String(row[pk]), row)!;
    return this.insert(table, row);
  }
}

export class CreatorHubStore {
  mode: PersistenceMode = 'memory';
  private mem = new MemoryBackend();
  private lastProbeAt = 0;
  // memory-mode settings/flags keep working when flows mutate them
  private memSettings: CreatorSettings = { ...DEFAULT_SETTINGS };
  private memFlags: CreatorFlags = { ...DEFAULT_FLAGS };

  /** Probe whether the creator-hub tables AND compat columns exist live. */
  async probe(force = false): Promise<PersistenceMode> {
    const now = Date.now();
    if (!force && now - this.lastProbeAt < 60_000) return this.mode;
    this.lastProbeAt = now;
    const svc = getServiceSupabase();
    if (svc) {
      try {
        // display_name is a compat-migration column: its presence proves the
        // full compatible schema (phase 1 + compat) is applied.
        const { error } = await svc.from('creators').select('id, display_name').limit(1);
        const missing = error && (
          error.code === 'PGRST205' || error.code === 'PGRST204' || error.code === '42P01' ||
          /does not exist|Could not find the table|Could not find the.*column/i.test(error.message)
        );
        this.mode = missing ? 'memory' : 'sql';
        if (!missing && error) throw error;
      } catch {
        this.mode = 'memory';
      }
    } else {
      this.mode = 'memory';
    }
    return this.mode;
  }

  private svc() {
    const svc = getServiceSupabase();
    if (!svc) throw new Error('creator_hub_service_role_missing');
    return svc;
  }

  // ---- generic primitives -------------------------------------------------
  async find(table: Table, opts: FindOpts = {}): Promise<AnyRow[]> {
    if (this.mode === 'memory') return this.mem.list(table, opts);
    const dbOpts = optsToDb(table, opts);
    let q = this.svc().from(table).select(dbOpts.fields ?? '*');
    if (dbOpts.eq) for (const [k, v] of Object.entries(dbOpts.eq)) q = q.eq(k, v);
    if (dbOpts.neq) for (const [k, v] of Object.entries(dbOpts.neq)) q = q.neq(k, v);
    if (dbOpts.inEq) for (const [k, arr] of Object.entries(dbOpts.inEq)) q = q.in(k, arr);
    if (dbOpts.ilike) for (const [k, pat] of Object.entries(dbOpts.ilike)) q = q.ilike(k, pat);
    if (dbOpts.order) q = q.order(dbOpts.order.field, { ascending: !!dbOpts.order.asc });
    if (dbOpts.offset) q = q.range(dbOpts.offset, (dbOpts.offset + (dbOpts.limit ?? 50)) - 1);
    else if (dbOpts.limit != null) q = q.limit(dbOpts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`creator_hub_db: ${error.message}`);
    return ((data ?? []) as unknown as AnyRow[]).map((r) => rowFromDb(table, r));
  }

  async findOne(table: Table, eq: Record<string, unknown>): Promise<AnyRow | null> {
    const rows = await this.find(table, { eq, limit: 1 });
    return rows[0] ?? null;
  }

  async get(table: Table, id: string): Promise<AnyRow | null> {
    if (this.mode === 'memory') return this.mem.get(table, id);
    const { data, error } = await this.svc().from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`creator_hub_db: ${error.message}`);
    return data ? rowFromDb(table, data as AnyRow) : null;
  }

  async insert<T = AnyRow>(table: Table, row: AnyRow): Promise<T> {
    if (this.mode === 'memory') return this.mem.insert(table, row) as T;
    const { data, error } = await this.svc().from(table).insert(rowToDb(table, row)).select().single();
    if (error) {
      // daily dedupe: one counted view per viewer per video per UTC day —
      // treat a unique violation as "already counted", not a server error
      if (table === 'video_views' && (error.code === '23505' || /duplicate key|unique constraint/i.test(error.message))) {
        return { __duplicate: true, ...row } as unknown as T;
      }
      throw new Error(`creator_hub_db: ${error.message}`);
    }
    return rowFromDb(table, data as AnyRow) as T;
  }

  async update<T = AnyRow>(table: Table, id: string, patch: AnyRow): Promise<T | null> {
    if (this.mode === 'memory') return (this.mem.update(table, id, patch) as T) ?? null;
    const { data, error } = await this.svc().from(table).update(rowToDb(table, patch)).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`creator_hub_db: ${error.message}`);
    return data ? (rowFromDb(table, data as AnyRow) as T) : null;
  }

  async upsert<T = AnyRow>(table: Table, row: AnyRow, onConflict: string): Promise<T> {
    if (this.mode === 'memory') {
      const pk = onConflict.split(',').map((s) => s.trim())[0];
      return this.mem.upsert(table, row, pk) as T;
    }
    const { data, error } = await this.svc().from(table).upsert(rowToDb(table, row), { onConflict }).select().single();
    if (error) throw new Error(`creator_hub_db: ${error.message}`);
    return rowFromDb(table, data as AnyRow) as T;
  }

  async delete(table: Table, eq: Record<string, unknown>): Promise<void> {
    if (this.mode === 'memory') {
      for (const r of this.mem.list(table, { eq })) this.mem.delete(table, String(r.id));
      return;
    }
    let q = this.svc().from(table).delete();
    for (const [k, v] of Object.entries(rowToDb(table, eq))) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw new Error(`creator_hub_db: ${error.message}`);
  }

  // ---- settings (synthesized from app_settings; 60s cache) ----------------
  private settingsCache: { value: CreatorSettings; at: number } | null = null;
  private flagsCache: { value: CreatorFlags; at: number } | null = null;
  private SETTINGS_TTL = 60_000;

  async getSettings(force = false): Promise<CreatorSettings> {
    const now = Date.now();
    if (!force && this.settingsCache && now - this.settingsCache.at < this.SETTINGS_TTL) return this.settingsCache.value;
    let value: CreatorSettings = { ...DEFAULT_SETTINGS };
    if (this.mode === 'sql') {
      try {
        const { data, error } = await this.svc().from('app_settings').select('key,value');
        if (!error && data) {
          const byKey = new Map((data as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]));
          for (const [field, key] of Object.entries(SETTINGS_KEYS)) {
            const v = byKey.get(key);
            if (v === undefined || v === null) continue;
            if (typeof v === 'boolean') (value as unknown as AnyRow)[field] = v;
            else {
              const n = Number(typeof v === 'string' ? (v as string) : (v as { toString(): string }).toString());
              if (Number.isFinite(n)) (value as unknown as AnyRow)[field] = n;
            }
          }
        }
      } catch { /* fall back to defaults */ }
    } else {
      value = { ...this.memSettings };
    }
    value.id = 1;
    this.settingsCache = { value, at: now };
    return value;
  }

  async saveSettings(patch: Partial<CreatorSettings>, updatedBy: string | null): Promise<CreatorSettings> {
    const clean: AnyRow = {};
    const numericKeys = ['min_eligible_views','payout_per_10000_valid_views_usd','minimum_withdrawal_usd','free_access_percentage','paid_access_percentage','free_access_duration_days','min_watch_seconds','dedupe_window_minutes','max_sessions_per_hour_per_ip','max_watch_heartbeat_seconds','suspicion_threshold'];
    for (const k of numericKeys) if (patch[k as keyof CreatorSettings] != null) clean[k] = Number(patch[k as keyof CreatorSettings]);
    for (const k of ['moderation_enabled','auto_publish_shorts']) if (patch[k as keyof CreatorSettings] != null) clean[k] = Boolean(patch[k as keyof CreatorSettings]);

    if (this.mode === 'sql') {
      const svc = this.svc();
      const nowIso = new Date().toISOString();
      for (const [field, v] of Object.entries(clean)) {
        const key = SETTINGS_KEYS[field];
        if (!key) continue;
        const { error } = await svc.from('app_settings').upsert(
          { key, value: v, updated_by: updatedBy ?? null, updated_at: nowIso },
          { onConflict: 'key' },
        );
        if (error) throw new Error(`creator_hub_db: ${error.message}`);
      }
    } else {
      Object.assign(this.memSettings, clean);
    }
    this.settingsCache = null;
    return this.getSettings(true);
  }

  async getFlags(force = false): Promise<CreatorFlags> {
    const now = Date.now();
    if (!force && this.flagsCache && now - this.flagsCache.at < this.SETTINGS_TTL) return this.flagsCache.value;
    const value: CreatorFlags = { ...DEFAULT_FLAGS };
    if (this.mode === 'sql') {
      try {
        const { data, error } = await this.svc().from('feature_flags').select('key,enabled');
        if (!error && data) {
          for (const r of data as Array<{ key: string; enabled: boolean }>) {
            const key = String(r.key) as keyof CreatorFlags;
            if (key in value) value[key] = Boolean(r.enabled);
          }
        }
      } catch { /* defaults */ }
    } else {
      Object.assign(value, this.memFlags);
    }
    this.flagsCache = { value, at: now };
    return value;
  }

  async setFlag(key: keyof CreatorFlags, enabled: boolean, _updatedBy: string | null): Promise<void> {
    if (this.mode === 'sql') {
      const { error } = await this.svc().from('feature_flags').upsert(
        { key, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
      if (error) throw new Error(`creator_hub_db: ${error.message}`);
    } else {
      this.memFlags[key] = enabled;
    }
    this.flagsCache = null;
  }

  // ---- storage ------------------------------------------------------------
  private bucketsEnsured = new Set<string>();

  /** Idempotently ensure a private bucket exists (service role — no DDL needed). */
  private async ensureBucketOnce(bucket: string): Promise<void> {
    if (this.bucketsEnsured.has(bucket)) return;
    try {
      const client = this.svc();
      const { data } = await client.storage.getBucket(bucket);
      if (!data) {
        // NOTE: fileSizeLimit / allowedMimeTypes are intentionally omitted —
        // Supabase free-tier rejects createBucket calls carrying a size limit.
        // Plan defaults apply; the API still validates MIME + 2 GiB cap.
        await client.storage.createBucket(bucket, { public: false });
      }
      this.bucketsEnsured.add(bucket);
    } catch { /* raced creation or transient error — signed-URL call surfaces real errors */ }
  }

  async createUploadSignedUrl(bucket: string, path: string): Promise<{ signedUrl: string; token: string; url: string }> {
    await this.ensureBucketOnce(bucket);
    const { data, error } = await this.svc().storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw new Error(`creator_hub_storage: ${error.message}`);
    return { signedUrl: data.signedUrl, token: data.token, url: data.signedUrl };
  }

  async createReadSignedUrl(bucket: string, path: string, ttlSeconds: number): Promise<string> {
    await this.ensureBucketOnce(bucket);
    const { data, error } = await this.svc().storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error) throw new Error(`creator_hub_storage: ${error.message}`);
    return data.signedUrl;
  }

  async statObject(bucket: string, path: string): Promise<{ exists: boolean; size: number | null; mimeType: string | null }> {
    await this.ensureBucketOnce(bucket);
    const dir = path.split('/').slice(0, -1).join('/');
    const name = path.split('/').pop() ?? '';
    const { data, error } = await this.svc().storage.from(bucket).list(dir || '', { search: name, limit: 5 });
    if (error) throw new Error(`creator_hub_storage: ${error.message}`);
    const hit = (data ?? []).find((o) => o.name === name);
    if (!hit) return { exists: false, size: null, mimeType: null };
    return { exists: true, size: hit.metadata?.size ?? null, mimeType: hit.metadata?.mimetype ?? null };
  }

  // ---- typed convenience accessors ---------------------------------------
  creators() { return { table: 'creators' as Table }; }
}

// ---- narrow typed helpers used across modules ------------------------------
export const asCreator = (r: AnyRow) => r as unknown as CreatorRow;
export const asProfile = (r: AnyRow) => r as unknown as CreatorProfileRow;
export const asVideo = (r: AnyRow) => r as unknown as CreatorVideoRow;
export const asSession = (r: AnyRow) => r as unknown as WatchSessionRow;
export const asEngagement = (r: AnyRow) => r as unknown as EngagementRow;
export const asLedger = (r: AnyRow) => r as unknown as LedgerRow;
export const asWithdrawal = (r: AnyRow) => r as unknown as WithdrawalRow;
export const asStrike = (r: AnyRow) => r as unknown as StrikeRow;
export const asCopyright = (r: AnyRow) => r as unknown as CopyrightReportRow;
export const asNotification = (r: AnyRow) => r as unknown as NotificationRow;
export const asPayoutMethod = (r: AnyRow) => r as unknown as PayoutMethodRow;
export const asEarnings = (r: AnyRow) => r as unknown as CreatorEarningsRow;

export const store = new CreatorHubStore();
