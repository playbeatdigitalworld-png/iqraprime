// Creator Hub auth: Supabase-token verification + creator resolution.
// Standalone from routes/api.ts to avoid a circular import; mirrors that
// file's verification strategy (round-trip to Supabase Auth /user endpoint)
// with its own 60s cache.
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { store } from './store.js';
import { asCreator, asProfile } from './store.js';
import type { CreatorRow, CreatorProfileRow, CreatorIdentity } from './types.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yxUeNftpgXnveqNoQdmiLQ_GbIRJ492';

interface CacheEntry { identity: CreatorIdentity; expiresAt: number }
const tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export function bearerToken(req: Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}

/** Verify a Supabase access token; returns the RAW auth uuid + email. */
export async function verifySupabaseIdentity(token: string): Promise<CreatorIdentity | null> {
  if (!token || !ANON_KEY) return null;
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const u = await res.json() as { id?: string; email?: string };
    if (!u?.id) return null;
    const identity: CreatorIdentity = { userId: u.id, email: (u.email || '').toLowerCase() };
    tokenCache.set(token, { identity, expiresAt: Date.now() + CACHE_TTL_MS });
    return identity;
  } catch {
    return null;
  }
}

/** Resolve the signed-in viewer (may be null for anonymous). */
export async function resolveViewer(req: Request): Promise<CreatorIdentity | null> {
  const token = bearerToken(req);
  if (!token) return null;
  // aether pilot tokens are not Supabase identities; Creator Hub uses Supabase auth only
  if (token.startsWith('aether_token_')) return null;
  return verifySupabaseIdentity(token);
}

/** Resolve the signed-in CREATOR (active membership required for writes). */
export async function resolveCreator(req: Request): Promise<{ creator: CreatorRow; profile: CreatorProfileRow | null; identity: CreatorIdentity } | null> {
  const identity = await resolveViewer(req);
  if (!identity) return null;
  const row = await store.findOne('creators', { user_id: identity.userId });
  if (!row) return null;
  const creator = asCreator(row);
  const profileRow = await store.findOne('creator_profiles', { creator_id: creator.id });
  return { creator, profile: profileRow ? asProfile(profileRow) : null, identity };
}

export class HttpError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export function assertCreatorUsable(creator: CreatorRow): void {
  if (creator.status === 'banned') throw new HttpError(403, 'creator_banned', 'This creator account is banned.');
  if (creator.status === 'suspended') {
    const until = creator.suspended_until ? new Date(creator.suspended_until).getTime() : Infinity;
    if (until > Date.now()) throw new HttpError(403, 'creator_suspended', 'This creator account is suspended.');
  }
}

// ---- hashing helpers (privacy-preserving viewer/ip identity) ---------------
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`ip|${ip}`).digest('hex').slice(0, 32);
}

export function hashViewerKey(parts: Array<string | null | undefined>): string {
  return createHash('sha256').update(parts.map((p) => p ?? '').join('|')).digest('hex').slice(0, 40);
}

export function clientIp(req: Request): string | null {
  const xf = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xf || req.ip || req.socket?.remoteAddress || null;
}
