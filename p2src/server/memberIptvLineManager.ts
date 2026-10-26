/**
 * MemberIptvLineManager — per-member Star IPTV line runtime.
 *
 * Design rules:
 * - Each member gets their OWN StarIPTVProvider instance built from their
 *   assigned line (zero shared state between members — no line mixing).
 * - The existing secure M3U workflow is reused as-is: server-side M3U fetch,
 *   parse, and the same curated family-safe category seed the global vault
 *   uses (categories 1392 / 917 / 890 via the provider's own seed routine).
 * - Credentials never leave the server: only masked summaries are produced.
 * - Assignment probing uses the provider's own Xtream player_api.php
 *   authentication endpoint (the adapter's existing configured backend flow).
 * - Best-effort durable sync to Supabase `member_iptv_lines` (RLS deny-all
 *   table; requires a service key when the owner provisions one). The
 *   authoritative runtime store is the server-side DataStore.
 */

import { StarIPTVProvider } from './starIptvProvider.js';
import { db } from './db/store.js';
import { getServiceSupabase } from './db/supabase.js';
import crypto from 'node:crypto';
import type { Channel, MemberIptvLine, MemberIptvLineMasked } from '../src/types/index.js';

const UA = 'AetherStream-PrivatePilot/1.0';

export interface LineProbeResult {
  ok: boolean;
  status?: string;          // provider account status (Active/Banned/…)
  expiresAt?: string;       // ISO date
  maxConnections?: number;
  activeConnections?: number;
  latencyMs?: number;
  message: string;          // safe to show admin (no secrets)
}

export interface LineProbeInput {
  serverUrl: string;
  username: string;
  password: string;
  m3uUrl?: string;
  epgUrl?: string;
}

function hostOf(urlStr: string): string {
  try { return new URL(urlStr).host; } catch { return (urlStr || '').slice(0, 40); }
}

function maskUsername(username: string): string {
  const u = (username || '').trim();
  if (!u) return '••••';
  return u.length <= 4 ? `${u}••••` : `${u.slice(0, 4)}••••`;
}

function maskUrl(urlStr: string | undefined, username: string): string | undefined {
  if (!urlStr) return undefined;
  try {
    const u = new URL(urlStr);
    return `${u.protocol}//${u.host}/••••••?username=${maskUsername(username)}&password=••••••••`;
  } catch {
    return '•••••• masked url ••••••';
  }
}

class MemberIptvLineManager {
  // userId -> provider instance (per member; NEVER shared between members)
  private providers = new Map<string, StarIPTVProvider>();
  private supabaseSyncUnavailable = false;
  // Single-flight durable restore (serverless cold-start hydration)
  private restorePromise: Promise<void> | null = null;
  private restoreRetryNotBefore = 0;

  constructor() {
    // Fire-and-forget warm-up: when the service key + LINE_VAULT_KEY are
    // configured, hydrate assigned lines from Supabase on boot. HTTP paths
    // additionally await ensureRestored() so a fresh serverless instance
    // serves member lines deterministically (see routes/api.ts middleware).
    void this.ensureRestored();
  }

  /**
   * AES-256-GCM secret encryption for the durable Supabase copy.
   * Key source: LINE_VAULT_KEY env (any string, hashed to 32 bytes).
   * When the key is NOT configured, secrets are NOT persisted to Supabase at
   * all (metadata-only sync) — the runtime store stays the sole secret holder.
   */
  private static vaultKey(): Buffer | null {
    const raw = process.env.LINE_VAULT_KEY;
    if (!raw) return null;
    return crypto.createHash('sha256').update(String(raw)).digest();
  }

  private static encryptSecret(plain: string): string | null {
    const key = MemberIptvLineManager.vaultKey();
    if (!key) return null;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** Inverse of encryptSecret — used ONLY by the durable restore path. */
  private static decryptSecret(payload: string | null | undefined): string | null {
    if (!payload) return null;
    const key = MemberIptvLineManager.vaultKey();
    if (!key) return null;
    try {
      const parts = String(payload).split('.');
      if (parts.length !== 4 || parts[0] !== 'v1') return null;
      const iv = Buffer.from(parts[1], 'base64');
      const tag = Buffer.from(parts[2], 'base64');
      const data = Buffer.from(parts[3], 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  /** Drop cached provider state for a member (after re-assignment / clear). */
  public invalidate(userId: string): void {
    this.providers.delete(userId);
  }

  /** Build the default M3U/EPG URLs for a line when the admin did not override them. */
  private withDerivedUrls(input: LineProbeInput): Required<Pick<LineProbeInput, 'serverUrl' | 'username' | 'password'>> & LineProbeInput {
    const base = input.serverUrl.replace(/\/+$/, '');
    return {
      ...input,
      m3uUrl: input.m3uUrl || `${base}/get.php?username=${encodeURIComponent(input.username)}&password=${encodeURIComponent(input.password)}&type=m3u_plus&output=hls`,
      epgUrl: input.epgUrl || `${base}/xmltv.php?username=${encodeURIComponent(input.username)}&password=${encodeURIComponent(input.password)}`,
    };
  }

  /**
   * Probe a candidate line against the provider's own Xtream player_api.php
   * (the adapter's existing configured authentication flow — no new APIs).
   * Returns structured account metadata for the admin (Expiry, Connection
   * Limit, Status) without ever echoing credentials.
   */
  public async probeLine(input: LineProbeInput): Promise<LineProbeResult> {
    const started = Date.now();
    const base = (input.serverUrl || '').replace(/\/+$/, '');
    if (!base || !input.username || !input.password) {
      return { ok: false, message: 'serverUrl, username, and password are required.' };
    }
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const url = `${base}/player_api.php?username=${encodeURIComponent(input.username)}&password=${encodeURIComponent(input.password)}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(to);
      const latencyMs = Date.now() - started;
      const data = await res.json().catch(() => null);
      const ui = data?.user_info;
      if (!res.ok || !ui || ui.auth !== 1) {
        return {
          ok: false,
          latencyMs,
          message: `Provider rejected the credentials (HTTP ${res.status}${ui ? `, auth=${ui.auth}` : ''}). Line NOT saved.`,
        };
      }
      const expiresAt = ui.exp_date ? new Date(Number(ui.exp_date) * 1000).toISOString() : undefined;
      return {
        ok: true,
        status: String(ui.status || 'Active'),
        expiresAt,
        maxConnections: Number(ui.max_connections) || 1,
        activeConnections: Number(ui.active_cons) || 0,
        latencyMs,
        message: `Authenticated (${latencyMs}ms). Status: ${ui.status || 'Active'}${expiresAt ? `, expires ${expiresAt.slice(0, 10)}` : ''}, max connections ${Number(ui.max_connections) || 1}.`,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error && e.name === 'AbortError' ? 'timeout' : String(e);
      return { ok: false, latencyMs: Date.now() - started, message: `Probe failed: ${msg}` };
    }
  }

  /** Persist a probed line for a member (admin-only caller paths). */
  public async assignLine(
    userId: string,
    input: LineProbeInput,
    opts: { providerName?: string; status?: 'active' | 'disabled'; assignedBy?: string; skipProbe?: boolean } = {},
  ): Promise<{ success: boolean; error?: string; probe?: LineProbeResult; masked?: MemberIptvLineMasked }> {
    const user = db.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };

    let probe: LineProbeResult | undefined;
    if (!opts.skipProbe) {
      probe = await this.probeLine(input);
      if (!probe.ok) return { success: false, error: probe.message, probe };
    }

    const derived = this.withDerivedUrls(input);
    const line: MemberIptvLine = {
      userId,
      providerName: opts.providerName || `Star IPTV Line ${maskUsername(input.username)}`,
      serverUrl: derived.serverUrl.replace(/\/+$/, ''),
      username: derived.username,
      password: derived.password,
      m3uUrl: derived.m3uUrl,
      epgUrl: derived.epgUrl,
      expiresAt: probe?.expiresAt,
      maxConnections: probe?.maxConnections,
      activeConnections: probe?.activeConnections,
      lastProbeStatus: probe?.status,
      lastProbeAt: probe ? new Date().toISOString() : undefined,
      status: opts.status || 'active',
      assignedBy: opts.assignedBy,
      assignedAt: new Date().toISOString(),
    };

    const assigned = db.assignIptvLine(userId, line);
    if (!assigned.success) return { success: false, error: assigned.error, probe };

    // Keep the member's subscription line metadata (masked) in sync so the
    // existing Dashboard UI shows their own line without any frontend changes.
    const sub = db.subscriptions.get(userId);
    if (sub) {
      const host = hostOf(line.serverUrl);
      sub.iptvCredentials = {
        username: maskUsername(line.username),
        serverHost: host,
        m3uUrlMasked: `http://${host}/get.php?username=${maskUsername(line.username)}&password=••••••••&type=m3u_plus`,
        epgUrl: `http://${host}/xmltv.php?username=${maskUsername(line.username)}&password=••••••••`,
      };
      db.subscriptions.set(userId, sub);
    }

    this.invalidate(userId);
    this.syncLineToSupabase(line, user.email);

    return { success: true, probe, masked: this.toMasked(line) };
  }

  public clearLine(userId: string): { success: boolean; error?: string } {
    const cleared = db.clearIptvLine(userId);
    if (cleared.success) {
      const sub = db.subscriptions.get(userId);
      if (sub?.iptvCredentials) {
        delete sub.iptvCredentials;
        db.subscriptions.set(userId, sub);
      }
      this.invalidate(userId);
      this.purgeDurable(userId);
    }
    return cleared;
  }

  /**
   * Best-effort durable delete: removes the member's row from the
   * Supabase mirror (service-role). Fire-and-forget; silent on absence.
   * Called on unassign and on member deletion so no stale ciphertext rows linger.
   */
  public purgeDurable(userId: string): void {
    const client = getServiceSupabase();
    if (!client) return;
    void (async () => {
      try {
        await client.from('member_iptv_lines').delete().eq('pilot_member_id', userId);
      } catch {
        // best-effort; the runtime store remains authoritative
      }
    })();
  }

  /**
   * Single-flight cold-start hydration: read all durable line rows
   * (service-role), decrypt secrets with LINE_VAULT_KEY, and seed the
   * runtime vault for members that no longer exist in this instance's
   * memory (serverless restart / redeploy). Rows whose secrets cannot be
   * decrypted (e.g. LINE_VAULT_KEY rotated) are skipped with one warning.
   * When keys are absent this resolves immediately (no-op) — identical to
   * the previous memory-only behavior.
   */
  public async ensureRestored(): Promise<void> {
    if (!getServiceSupabase() || !MemberIptvLineManager.vaultKey()) return;
    if (this.restorePromise) return this.restorePromise;
    if (Date.now() < this.restoreRetryNotBefore) return;
    this.restorePromise = (async () => {
      try {
        const client = getServiceSupabase();
        if (!client) return;
        const { data, error } = await client
          .from('member_iptv_lines')
          .select('*');
        if (error || !Array.isArray(data)) {
          // Table missing / transient error — allow a later retry.
          this.restorePromise = null;
          this.restoreRetryNotBefore = Date.now() + 30_000;
          return;
        }
        let restored = 0;
        let skipped = 0;
        for (const row of data as Array<Record<string, unknown>>) {
          const userId = String(row.pilot_member_id || '');
          const serverUrl = String(row.server_url || '');
          const username = MemberIptvLineManager.decryptSecret(row.username_encrypted as string);
          const password = MemberIptvLineManager.decryptSecret(row.password_encrypted as string);
          if (!userId || !serverUrl || !username || !password) {
            skipped += 1;
            continue;
          }
          if (db.memberIptvLines.has(userId)) continue; // runtime store authoritative
          const m3u = MemberIptvLineManager.decryptSecret(row.m3u_url_encrypted as string) || undefined;
          const epg = MemberIptvLineManager.decryptSecret(row.epg_url_encrypted as string) || undefined;
          const derived = this.withDerivedUrls({ serverUrl, username, password, m3uUrl: m3u, epgUrl: epg });
          db.memberIptvLines.set(userId, {
            userId,
            providerName: (row.provider_name as string) || `Star IPTV Line ${maskUsername(username)}`,
            serverUrl: serverUrl.replace(/\/+$/, ''),
            username,
            password,
            m3uUrl: derived.m3uUrl,
            epgUrl: derived.epgUrl,
            expiresAt: (row.expires_at as string) || undefined,
            maxConnections: Number(row.max_connections) || 1,
            status: row.status === 'disabled' ? 'disabled' : 'active',
            assignedBy: (row.assigned_by as string) || undefined,
            assignedAt: (row.updated_at as string) || (row.created_at as string) || new Date().toISOString(),
          });
          restored += 1;
        }
        if (restored > 0 || skipped > 0) {
          console.log(`member_iptv_lines: durable restore complete (restored=${restored}, skipped=${skipped})`);
        }
      } catch {
        // Durable mirror is best-effort only; never break request handling.
        this.restorePromise = null;
        this.restoreRetryNotBefore = Date.now() + 30_000;
      }
    })();
    return this.restorePromise;
  }

  /** Masked summary — the ONLY line shape that ever reaches a client. */
  public toMasked(line: MemberIptvLine | undefined | null): MemberIptvLineMasked {
    if (!line) return { userId: '', assigned: false };
    return {
      userId: line.userId,
      assigned: true,
      providerName: line.providerName,
      usernameMasked: maskUsername(line.username),
      serverHost: hostOf(line.serverUrl),
      m3uUrlMasked: maskUrl(line.m3uUrl, line.username),
      epgUrlMasked: maskUrl(line.epgUrl, line.username),
      expiresAt: line.expiresAt,
      maxConnections: line.maxConnections,
      activeConnections: line.activeConnections,
      status: line.status,
      assignedAt: line.assignedAt,
      lastProbeStatus: line.lastProbeStatus,
      lastProbeAt: line.lastProbeAt,
    };
  }

  /** The member's own provider entry, or null when unassigned/disabled. */
  public getEntry(userId: string): { line: MemberIptvLine; provider: StarIPTVProvider } | null {
    const line = db.getIptvLine(userId);
    if (!line || line.status !== 'active') return null;
    let provider = this.providers.get(userId);
    if (!provider) {
      provider = new StarIPTVProvider({
        providerName: line.providerName || `Star IPTV Line ${maskUsername(line.username)}`,
        serverUrl: line.serverUrl,
        username: line.username,
        password: line.password,
        m3uUrl: line.m3uUrl,
        epgUrl: line.epgUrl,
      });
      this.providers.set(userId, provider);
    }
    return { line, provider };
  }

  /**
   * Lazily seed the member's line channels using the provider adapter's own
   * curated category seed (same family-safe categories as the global vault).
   * Capped so a slow provider can never hang an API request.
   */
  public async ensureLineReady(userId: string, capMs = 22000): Promise<boolean> {
    const entry = this.getEntry(userId);
    if (!entry) return false;
    try {
      await Promise.race([
        entry.provider.ensureSeeded(),
        new Promise((resolve) => setTimeout(resolve, capMs)),
      ]);
    } catch {
      // best-effort; channel availability re-checked below
    }
    return entry.provider.getParsedChannels().some((c: { enabled: boolean }) => c.enabled);
  }

  /**
   * The member's Live TV channels, sourced EXCLUSIVELY from their assigned
   * line. Returns null when the member has no active line (caller falls back
   * to the global curated catalog, preserving existing behavior).
   */
  public getMemberChannels(userId: string): Channel[] | null {
    const entry = this.getEntry(userId);
    if (!entry) return null;
    return entry.provider.getEnabledChannelsAsContent();
  }

  /** Resolve a content id against the member's own line first, then app catalog. */
  public findMemberChannel(userId: string, contentId: string): Channel | undefined {
    const channels = this.getMemberChannels(userId);
    return channels ? channels.find((c) => c.id === contentId) : undefined;
  }

  /**
   * Best-effort durability: upsert the line (secrets as AES-256-GCM
   * ciphertext via the service-role client when SUPABASE_SERVICE_ROLE_KEY +
   * LINE_VAULT_KEY are configured; without them secrets are withheld).
   * Failure is logged once, non-fatal — runtime store remains authoritative.
   */
  private syncLineToSupabase(line: MemberIptvLine, memberEmail?: string): void {
    if (this.supabaseSyncUnavailable) return;
    const client = getServiceSupabase();
    if (!client) return;
    void (async () => {
      try {
        const { error } = await client.from('member_iptv_lines').upsert({
          pilot_member_id: line.userId,
          member_email: memberEmail || null,
          provider_name: line.providerName || null,
          server_url: line.serverUrl,
          username_encrypted: MemberIptvLineManager.encryptSecret(line.username),
          password_encrypted: MemberIptvLineManager.encryptSecret(line.password),
          m3u_url_encrypted: line.m3uUrl ? MemberIptvLineManager.encryptSecret(line.m3uUrl) : null,
          epg_url_encrypted: line.epgUrl ? MemberIptvLineManager.encryptSecret(line.epgUrl) : null,
          expires_at: line.expiresAt || null,
          max_connections: line.maxConnections || 1,
          status: line.status,
          assigned_by: line.assignedBy || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'pilot_member_id' });
        if (error) {
          this.supabaseSyncUnavailable = true;
          console.warn('member_iptv_lines sync unavailable (service key missing/invalid) — runtime store remains authoritative.');
        }
      } catch {
        this.supabaseSyncUnavailable = true;
      }
    })();
  }
}

export const memberIptvLineManager = new MemberIptvLineManager();
