// Single clock so tests can freeze time.
let clock: () => Date = () => new Date();
export function setClock(fn: () => Date): void { clock = fn; }
export function resetClock(): void { clock = () => new Date(); }

/** Same shape as the schema default strftime('%Y-%m-%dT%H:%M:%fZ','now'). */
export function nowIso(): string { return clock().toISOString(); }
export function todayUtc(): string { return nowIso().slice(0, 10); }
export function startOfTodayIso(): string { return todayUtc() + "T00:00:00.000Z"; }

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Calendar-month addition, clamping to month end (Jan 31 + 1 month = Feb 28/29). The provider's own rule is undocumented. */
export function addMonthsClamped(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmt(ny, nm + 1, Math.min(d, last));
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
