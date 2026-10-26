import type { Env } from "../env";
import { maskObject, maskText } from "../lib/mask";

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface CallMeta {
  requestId: string;
  resellerId?: string | null;
  customerId?: string | null;
}

/**
 * Outcome of a provider WRITE. The distinction matters for money:
 *  - ok       provider confirmed (valid JSON, status === "success")
 *  - rejected provider answered with valid JSON status "error": nothing happened, safe to refund
 *  - unknown  timeout / network / non-JSON / HTTP error: the call MAY have been applied. Never retry,
 *             never refund automatically; the order goes to reconciliation.
 */
export type WriteResult =
  | { kind: "ok"; msg: string }
  | { kind: "rejected"; msg: string }
  | { kind: "unknown"; reason: "TIMEOUT" | "NETWORK" | "HTTP_ERROR" | "BAD_RESPONSE" };

type RawResult =
  | { ok: true; json: unknown; httpStatus: number; durationMs: number }
  | { ok: false; reason: "TIMEOUT" | "NETWORK" | "HTTP_ERROR" | "BAD_RESPONSE"; httpStatus?: number; durationMs: number };

export interface ProviderInfo {
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  latencyMs: number;
  userCreditCenti: number | null;
  allowTrial: number | null;
  usedTrial: number | null;
  totalPaidLines: number | null;
  isMonthly: boolean | null;
  nextRenewal: string | null;
}

export interface AddLineParams {
  user: string;
  pass: string;
  connections: number;
  bid: string; // literal text, e.g. "[5,11]"
  plan: number;
  addChannels: boolean;
  addVods: boolean;
  adults: boolean;
  notice?: string | null;
  customId?: string | null;
}

/** "1088.73" -> 108873, without floats. Returns null for anything unexpected. */
export function parseCenti(s: unknown): number | null {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const m = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(s).trim());
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] === "-" ? -cents : cents;
}

function intOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isInteger(n) ? n : null;
}

const flag = (b: boolean) => (b ? "1" : "");

export class StarIptvClient {
  private env: Env;
  private fetchFn: FetchFn;

  constructor(env: Env, fetchFn?: FetchFn) {
    this.env = env;
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  // ── typed operations ──

  async info(meta: CallMeta): Promise<{ kind: "ok"; info: ProviderInfo } | { kind: "unreachable"; reason: string }> {
    const raw = await this.raw("infoapi", {}, false, meta);
    if (!raw.ok || !raw.json || typeof raw.json !== "object" || Array.isArray(raw.json)) {
      return { kind: "unreachable", reason: raw.ok ? "BAD_RESPONSE" : raw.reason };
    }
    const j = raw.json as Record<string, unknown>; // whatsapp_otp is in here: deliberately never copied out
    const online = String(j.api_status) === "1";
    return {
      kind: "ok",
      info: {
        status: !online ? "OFFLINE" : raw.durationMs > 5000 ? "DEGRADED" : "ONLINE",
        latencyMs: raw.durationMs,
        userCreditCenti: parseCenti(j.user_credit),
        allowTrial: intOrNull(j.allow_trial),
        usedTrial: intOrNull(j.used_trial),
        totalPaidLines: intOrNull(j.total_paid_lines),
        isMonthly: j.is_monthly === undefined ? null : String(j.is_monthly) === "1",
        nextRenewal: typeof j.next_renewal === "string" && j.next_renewal !== "0" ? j.next_renewal : null,
      },
    };
  }

  async creditLogs(meta: CallMeta) {
    const raw = await this.raw("credit_logs", {}, false, meta);
    if (!raw.ok || !Array.isArray(raw.json)) return { kind: "unreachable" as const, reason: raw.ok ? "BAD_RESPONSE" : raw.reason };
    return { kind: "ok" as const, logs: raw.json as Array<Record<string, unknown>> };
  }

  addLine(p: AddLineParams, meta: CallMeta): Promise<WriteResult> {
    return this.write(
      "add",
      {
        user: p.user, pass: p.pass, conx: p.connections, bid: p.bid, plan: p.plan,
        addch: flag(p.addChannels), addvods: flag(p.addVods), adults: flag(p.adults),
        notice: p.notice ?? "", ch: "", custom_id: p.customId ?? undefined,
      },
      meta,
    );
  }

  extendLine(user: string, plan: number, meta: CallMeta): Promise<WriteResult> {
    return this.write("extend", { user, plan }, meta);
  }

  editLine(user: string, fields: { newUser?: string; pass?: string; notice?: string }, meta: CallMeta): Promise<WriteResult> {
    return this.write("edit", { user, newuser: fields.newUser, pass: fields.pass, notice: fields.notice, ch: "" }, meta);
  }

  deleteLine(user: string, force: boolean, meta: CallMeta): Promise<WriteResult> {
    return this.write("del", { user, force: force ? "1" : undefined }, meta);
  }

  // ── internals ──

  private async write(type: string, params: Record<string, unknown>, meta: CallMeta): Promise<WriteResult> {
    const raw = await this.raw(type, params, true, meta);
    if (!raw.ok) return { kind: "unknown", reason: raw.reason };
    const j = raw.json;
    if (j && typeof j === "object" && !Array.isArray(j)) {
      const { status, msg } = j as { status?: unknown; msg?: unknown };
      const text = typeof msg === "string" ? msg : "";
      if (status === "success") return { kind: "ok", msg: text };
      if (status === "error") return { kind: "rejected", msg: text };
    }
    return { kind: "unknown", reason: "BAD_RESPONSE" };
  }

  /** One attempt, always POST (the key never appears in a URL), never retried. Logged with masked fields only. */
  private async raw(type: string, params: Record<string, unknown>, isWrite: boolean, meta: CallMeta): Promise<RawResult> {
    const started = Date.now();
    const body = new URLSearchParams();
    body.set("apikey", this.env.STAR_IPTV_API_KEY);
    body.set("type", type);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, String(v));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), isWrite ? 20_000 : 10_000);
    let result: RawResult;
    let note = "";
    try {
      const res = await this.fetchFn(this.env.STAR_IPTV_API_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: body.toString(),
        signal: ctrl.signal,
      });
      const text = await res.text();
      const durationMs = Date.now() - started;
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = undefined; }
      if (json === undefined) {
        result = { ok: false, reason: res.ok ? "BAD_RESPONSE" : "HTTP_ERROR", httpStatus: res.status, durationMs };
      } else if (!res.ok && !(json && typeof json === "object" && "status" in (json as object))) {
        result = { ok: false, reason: "HTTP_ERROR", httpStatus: res.status, durationMs };
      } else {
        result = { ok: true, json, httpStatus: res.status, durationMs };
        // Write replies are {status,msg}: log the masked msg. Read replies can contain whatsapp_otp: log nothing from them.
        if (isWrite && json && typeof json === "object" && typeof (json as { msg?: unknown }).msg === "string") {
          note = maskText((json as { msg: string }).msg);
        }
      }
    } catch (e) {
      const durationMs = Date.now() - started;
      result = { ok: false, reason: ctrl.signal.aborted ? "TIMEOUT" : "NETWORK", durationMs };
      note = e instanceof Error ? maskText(e.name) : "";
    } finally {
      clearTimeout(timer);
    }

    await this.log(type, params, result, note, meta);
    return result;
  }

  private async log(type: string, params: Record<string, unknown>, r: RawResult, note: string, meta: CallMeta): Promise<void> {
    try {
      if (this.env.DB?.prepare) {
        const writeOk = r.ok && !(r.json && typeof r.json === "object" && (r.json as { status?: unknown }).status === "error");
        await this.env.DB.prepare(
          `INSERT INTO api_logs (request_id, operation, http_status, duration_ms, success, reseller_id, customer_id, error_code, summary)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
          .bind(
            meta.requestId, type, r.ok ? r.httpStatus : (r.httpStatus ?? null), r.durationMs, writeOk ? 1 : 0,
            meta.resellerId ?? null, meta.customerId ?? null, r.ok ? null : r.reason,
            JSON.stringify({ params: maskObject(params), note }),
          )
          .run();
      }
    } catch {
      // Logging must never break or alter a provider operation.
    }
  }
}
