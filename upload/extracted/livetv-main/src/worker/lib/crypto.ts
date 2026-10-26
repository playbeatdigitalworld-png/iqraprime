const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export function toB64Url(bytes: Uint8Array): string {
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export function randomToken(bytes = 32): string {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const x = typeof a === "string" ? enc.encode(a) : a;
  const y = typeof b === "string" ? enc.encode(b) : b;
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ── Passwords: PBKDF2-SHA256. Workers' WebCrypto rejects iteration counts above 100,000. ──
const PBKDF2_ITER = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2-sha256$${PBKDF2_ITER}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterStr || !saltB64 || !hashB64) return false;
  const iter = Number(iterStr);
  if (!Number.isInteger(iter) || iter < 1 || iter > 100_000) return false;
  const actual = await pbkdf2(password, fromB64(saltB64), iter);
  return timingSafeEqual(actual, fromB64(hashB64));
}

let dummyHash: Promise<string> | null = null;
/** Burn the same CPU for unknown users so response time doesn't reveal which identifiers exist. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password, await dummyHash);
}

// ── Field encryption for stored line passwords: AES-256-GCM, key = ENCRYPTION_KEY secret. ──
const keyCache = new Map<string, CryptoKey>();

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const cached = keyCache.get(keyB64);
  if (cached) return cached;
  const raw = fromB64(keyB64);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  keyCache.set(keyB64, key);
  return key;
}

/** `aad` (the customer id) binds the ciphertext to its row so it can't be copied to another customer. */
export async function encryptSecret(plain: string, keyB64: string, aad: string): Promise<string> {
  const key = await aesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(plain),
  );
  return `v1.${toB64Url(iv)}.${toB64Url(new Uint8Array(ct))}`;
}

export async function decryptSecret(blob: string, keyB64: string, aad: string): Promise<string> {
  const [v, ivB64, ctB64] = blob.split(".");
  if (v !== "v1" || !ivB64 || !ctB64) throw new Error("Unsupported ciphertext format");
  const key = await aesKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64Url(ivB64) as BufferSource, additionalData: enc.encode(aad) },
    key,
    fromB64Url(ctB64) as BufferSource,
  );
  return dec.decode(pt);
}
