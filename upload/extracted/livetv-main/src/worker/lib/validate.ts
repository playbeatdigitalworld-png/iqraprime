import { DomainError } from "./errors";

export function str(v: unknown, field: string, opts: { max: number; min?: number; optional?: boolean } = { max: 200 }): string | null {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return null;
    throw new DomainError("VALIDATION", `${field} is required`, 400);
  }
  if (typeof v !== "string") throw new DomainError("VALIDATION", `${field} must be a string`, 400);
  const t = v.trim();
  if (t.length < (opts.min ?? 1) || t.length > opts.max) {
    throw new DomainError("VALIDATION", `${field} must be ${opts.min ?? 1}-${opts.max} characters`, 400);
  }
  return t;
}

export function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) {
    throw new DomainError("VALIDATION", `${field} must be an integer between ${min} and ${max}`, 400);
  }
  return v;
}

export function idempotencyKey(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9._:-]{8,100}$/.test(v)) {
    throw new DomainError("VALIDATION", "Idempotency-Key must be 8-100 characters of A-Z a-z 0-9 . _ : -", 400);
  }
  return v;
}

// Provider rule: 6 to 23 chars, charset a-z . 0-9 _ -  (STAR-IPTV-API.md §3)
const XTREAM = /^[a-z0-9._-]{6,23}$/;
export function xtreamCredentials(user: string, pass: string): void {
  if (!XTREAM.test(user)) throw new DomainError("VALIDATION", "username must be 6-23 chars of a-z 0-9 . _ -", 400);
  if (!XTREAM.test(pass)) throw new DomainError("VALIDATION", "password must be 6-23 chars of a-z 0-9 . _ -", 400);
  if (user === pass) throw new DomainError("VALIDATION", "username and password must differ", 400);
}
