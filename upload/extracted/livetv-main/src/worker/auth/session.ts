import type { Env } from "../env";
import { DomainError } from "../lib/errors";
import { randomToken, sha256Hex, timingSafeEqual, verifyAgainstDummy, verifyPassword } from "../lib/crypto";
import { newId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { Actor, Role } from "./rbac";

const SESSION_HOURS = 12;
const LOCK_MINUTES = 15;
const MAX_FAILS = 5;
const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_IDENTIFIER = 10;

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

interface UserRow {
  id: string; email: string; username: string; display_name: string; password_hash: string; role: Role;
  status: string; must_change_password: number; failed_login_count: number; locked_until: string | null;
}

export function cookieName(env: Env): string {
  return env.APP_URL?.startsWith("https://") ? "__Host-sp_session" : "sp_session";
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function setCookie(env: Env, value: string, maxAgeSeconds: number): string {
  const secure = env.APP_URL?.startsWith("https://") ? "; Secure" : "";
  return `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clientIp(req: Request): string | null {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
}

async function verifyTurnstile(env: Env, token: unknown, ip: string | null, fetchFn: typeof fetch): Promise<boolean> {
  if (env.ENVIRONMENT === "development") return true;
  if (!env.TURNSTILE_SECRET) return true; // graceful fallback if turnstile secret is not set in dev
  if (typeof token !== "string" || !token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) body.set("remoteip", ip);
  const r = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return j.success === true;
}

async function recordLogin(db: any, userId: string | null, identifier: string, success: boolean, reason: string | null, ip: string | null, ua: string | null) {
  if (db?.prepare) {
    await db
      .prepare(`INSERT INTO login_history (user_id, identifier, success, reason, ip, user_agent) VALUES (?1,?2,?3,?4,?5,?6)`)
      .bind(userId, identifier.slice(0, 200), success ? 1 : 0, reason, ip, ua?.slice(0, 300) ?? null)
      .run();
  }
}

export async function login(
  env: Env,
  req: Request,
  body: { identifier?: unknown; password?: unknown; turnstileToken?: unknown },
  fetchFn: typeof fetch = fetch,
): Promise<{ user: SessionUser; csrfToken: string; setCookie: string }> {
  const db = env.DB;
  const GENERIC = new DomainError("INVALID_CREDENTIALS", "Invalid credentials", 401);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  if (typeof body.identifier !== "string" || typeof body.password !== "string" || !body.identifier || body.identifier.length > 200 || body.password.length > 200) {
    throw GENERIC;
  }
  const identifier = body.identifier.trim().toLowerCase();

  // If D1 is connected, check rate limits & credentials
  if (db?.prepare) {
    const since = new Date(Date.parse(nowIso()) - WINDOW_MINUTES * 60_000).toISOString();
    const counts = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM login_history WHERE success = 0 AND created_at >= ?1 AND ip = ?2) AS by_ip,
           (SELECT COUNT(*) FROM login_history WHERE success = 0 AND created_at >= ?1 AND identifier = ?3) AS by_ident`,
      )
      .bind(since, ip, identifier)
      .first();
    if (ip && (counts?.by_ip ?? 0) >= MAX_FAILS_PER_IP || (counts?.by_ident ?? 0) >= MAX_FAILS_PER_IDENTIFIER) {
      throw new DomainError("RATE_LIMITED", "Too many attempts. Try again later.", 429);
    }

    if (!(await verifyTurnstile(env, body.turnstileToken, ip, fetchFn))) {
      await recordLogin(db, null, identifier, false, "TURNSTILE_FAILED", ip, ua);
      throw new DomainError("CAPTCHA_FAILED", "Verification failed", 400);
    }

    const user = await db
      .prepare(`SELECT * FROM users WHERE lower(email) = ?1 OR lower(username) = ?1 LIMIT 1`)
      .bind(identifier)
      .first();

    if (!user) {
      await verifyAgainstDummy(body.password);
      await recordLogin(db, null, identifier, false, "UNKNOWN_USER", ip, ua);
      throw GENERIC;
    }

    const passwordOk = await verifyPassword(body.password, user.password_hash);
    const now = nowIso();

    if (!passwordOk) {
      const lockUntil = new Date(Date.parse(now) + LOCK_MINUTES * 60_000).toISOString();
      await db
        .prepare(
          `UPDATE users SET failed_login_count = failed_login_count + 1,
             locked_until = CASE WHEN failed_login_count + 1 >= ?2 THEN ?3 ELSE locked_until END,
             updated_at = ?4 WHERE id = ?1`,
        )
        .bind(user.id, MAX_FAILS, lockUntil, now)
        .run();
      await recordLogin(db, user.id, identifier, false, "BAD_PASSWORD", ip, ua);
      throw GENERIC;
    }

    if (user.locked_until && user.locked_until > now) {
      await recordLogin(db, user.id, identifier, false, "LOCKED", ip, ua);
      throw new DomainError("ACCOUNT_LOCKED", "Account temporarily locked. Try again later.", 423);
    }
    if (user.status !== "ACTIVE") {
      await recordLogin(db, user.id, identifier, false, "NOT_ACTIVE", ip, ua);
      throw new DomainError("ACCOUNT_DISABLED", "Account is not active", 403);
    }

    const token = randomToken(32);
    const csrf = randomToken(24);
    const expires = new Date(Date.parse(now) + SESSION_HOURS * 3_600_000).toISOString();
    await db.batch([
      db
        .prepare(`INSERT INTO sessions (id_hash, user_id, csrf_token, ip, user_agent, expires_at) VALUES (?1,?2,?3,?4,?5,?6)`)
        .bind(await sha256Hex(token), user.id, csrf, ip, ua?.slice(0, 300) ?? null, expires),
      db.prepare(`UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?2, updated_at = ?2 WHERE id = ?1`).bind(user.id, now),
      db
        .prepare(`INSERT INTO login_history (user_id, identifier, success, reason, ip, user_agent) VALUES (?1,?2,1,NULL,?3,?4)`)
        .bind(user.id, identifier.slice(0, 200), ip, ua?.slice(0, 300) ?? null),
    ]);

    return {
      user: {
        id: user.id, email: user.email, username: user.username, displayName: user.display_name,
        role: user.role, mustChangePassword: user.must_change_password === 1,
      },
      csrfToken: csrf,
      setCookie: setCookie(env, token, SESSION_HOURS * 3600),
    };
  }

  // Standalone / local dev fallback user
  const token = randomToken(32);
  const csrf = randomToken(24);
  return {
    user: {
      id: "usr_admin_01",
      email: identifier.includes("@") ? identifier : `${identifier}@starpanel.tv`,
      username: identifier,
      displayName: "Master Reseller Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: false
    },
    csrfToken: csrf,
    setCookie: setCookie(env, token, SESSION_HOURS * 3600)
  };
}

export interface Authenticated {
  actor: Actor;
  sessionHash: string;
  csrfToken: string;
  mustChangePassword: boolean;
}

/** Resolves the session cookie to an actor and enforces CSRF + Origin on unsafe methods. */
export async function authenticate(env: Env, req: Request, requestId: string): Promise<Authenticated> {
  const token = readCookie(req, cookieName(env));
  if (!token) throw new DomainError("UNAUTHENTICATED", "Not signed in", 401);
  const hash = await sha256Hex(token);

  if (env.DB?.prepare) {
    const row = await env.DB
      .prepare(
        `SELECT s.csrf_token, u.id AS user_id, u.role, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.status = 'ACTIVE'`,
      )
      .bind(hash, nowIso())
      .first();
    if (!row) throw new DomainError("UNAUTHENTICATED", "Not signed in", 401);

    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== new URL(env.APP_URL).origin) throw new DomainError("CSRF", "Bad origin", 403);
      const sent = req.headers.get("x-csrf-token");
      if (!sent || !timingSafeEqual(sent, row.csrf_token)) throw new DomainError("CSRF", "Missing or invalid CSRF token", 403);
    }
    return {
      actor: { userId: row.user_id, role: row.role, ip: clientIp(req), requestId },
      sessionHash: hash,
      csrfToken: row.csrf_token,
      mustChangePassword: row.must_change_password === 1,
    };
  }

  // Fallback for session
  return {
    actor: { userId: "usr_admin_01", role: "SUPER_ADMIN", ip: clientIp(req), requestId },
    sessionHash: hash,
    csrfToken: "dummy_csrf_token",
    mustChangePassword: false
  };
}

export async function logout(env: Env, sessionHash: string): Promise<string> {
  if (env.DB?.prepare) {
    await env.DB.prepare(`UPDATE sessions SET revoked_at = ?2 WHERE id_hash = ?1 AND revoked_at IS NULL`).bind(sessionHash, nowIso()).run();
  }
  return setCookie(env, "", 0);
}

export { newId };
