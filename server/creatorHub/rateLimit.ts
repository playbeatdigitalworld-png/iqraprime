// Minimal sliding-window rate limiter (per instance). Serverless instances
// are ephemeral, so this is defense-in-depth alongside DB-level dedupe,
// session validity rules and admin fraud review — not the only line.
type Bucket = number[];

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, arr] of buckets) {
    if (!arr.length || now - arr[arr.length - 1] > 3_600_000) buckets.delete(key);
  }
}

/** Returns true when the action is ALLOWED under limit/windowMs. */
export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}
