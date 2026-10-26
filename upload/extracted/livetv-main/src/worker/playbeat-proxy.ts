import { 
  fetchGeoTvChannels, 
  fetchGeoTvImage, 
  fetchGeoTvHlsStream, 
  fetchGeoTvSegment, 
  resolveCloudflareDoh 
} from "./services/geotv-proxy";
import { persistChannelCatalog, readChannelCatalog } from "./services/catalog-store";
import { withGeoTvProvider } from "./services/provider-config";

// PlayBeat TV – secure Cloudflare Worker proxy for the Xtream-Masters v3 reseller API
// and GeoTV IPTV streaming & image caching.
// Secrets: IPTV_API_KEY, ADMIN_TOKEN, GEOTV_HOST, GEOTV_USER, GEOTV_PASS, CLOUDFLARE_API_TOKEN

const UPSTREAM = "https://iptv-api.xtream-masters.com/v3/";

// ---------- validators ----------
const CRED_RE = /^[a-z0-9._-]{6,23}$/;              // doc: 6–23 chars, a-z 0-9 . _ -
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
const CODE_RE = /^\d{12,18}$/;                       // ActiveCode: 12–18 digits
const BIDS = new Set(["[5,11]", "[4,7]", "[1232,1234]", "[1233,1235]"]);

export const cred = (v: string) => CRED_RE.test(v);
export const mac = (v: string) => MAC_RE.test(v);
export const code = (v: string) => CODE_RE.test(v);
export const plan = (v: string) => ["11", "1", "2", "3", "4"].includes(v);   // 11 = 24h trial
export const paidPlan = (v: string) => ["1", "2", "3", "4"].includes(v);
export const conx = (v: string) => /^[1-4]$/.test(v);
export const bid = (v: string) => BIDS.has(v.replace(/\s/g, ""));
export const flag = (v: string) => v === "" || v === "1";
export const text = (v: string) => v.length <= 200;
export const numId = (v: string) => /^\d{1,10}$/.test(v);

export const PACKAGE: Record<string, (v: string) => boolean> = {
  conx, bid, plan,
  addch: flag, addvods: flag, adults: flag,
  custom_id: numId, notice: text, ch: text,
};

export interface ActionDef {
  type: string;
  required?: string[];
  fields?: Record<string, (v: string) => boolean>;
  callback?: boolean;
  extra?: Record<string, string>;
}

// ---------- action map: /api/<name> -> upstream "type" ----------
export const ACTIONS: Record<string, ActionDef> = {
  info:        { type: "infoapi" },
  credit_logs: { type: "credit_logs" },

  // Xtream users
  add:    { type: "add",    required: ["user", "pass", "plan", "bid"], fields: { user: cred, pass: cred, ...PACKAGE } },
  edit:   { type: "edit",   required: ["user", "newuser", "pass"],     fields: { user: cred, newuser: cred, pass: cred, notice: text, ch: text } },
  extend: { type: "extend", required: ["user", "plan"],                fields: { user: cred, plan: paidPlan } },
  del:    { type: "del",    required: ["user"],                        fields: { user: cred, force: flag } },

  // ActiveCode
  activecode: { type: "activecode", required: ["plan", "bid"],  fields: { ...PACKAGE }, callback: true },
  extendac:   { type: "extendac",   required: ["user", "plan"], fields: { user: code, plan: paidPlan } },
  delac:      { type: "delac",      required: ["user"],         fields: { user: code, force: flag } },

  // MAC address
  addmac:    { type: "addmac",    required: ["address", "plan", "bid"], fields: { address: mac, ...PACKAGE }, extra: { mac: "1" } },
  editmac:   { type: "editmac",   required: ["user", "newuser"],        fields: { user: mac, newuser: mac, notice: text, ch: text } },
  extendmac: { type: "extendmac", required: ["user", "plan"],           fields: { user: mac, plan: paidPlan } },
  delmac:    { type: "delmac",    required: ["user"],                   fields: { user: mac, force: flag } },
};

// ---------- main handler ----------
export default {
  async scheduled(
    controller: { scheduledTime: number; cron: string },
    env: any,
    ctx: { waitUntil(promise: Promise<unknown>): void }
  ) {
    ctx.waitUntil(runCatalogSync(env, "scheduled"));
  },

  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    // Upstream appends "callback_activecode.php" to the base64 callback URL we send.
    if (url.pathname === "/callback/callback_activecode.php" || url.pathname === "/api/activecode/callback") {
      return handleCallback(request, env, url);
    }

    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), env);

    if (url.pathname === "/api/admin/verify") {
      if (request.method !== "POST") {
        return json({ success: false, error: "Use POST." }, 405, env);
      }
      if (!env.ADMIN_TOKEN) {
        return json({ success: false, error: "Admin authentication is not configured." }, 503, env);
      }
      if (!(await authorized(request, env))) {
        return json({ success: false, error: "Invalid admin token." }, 401, env);
      }
      return json({ success: true }, 200, env);
    }

    if (url.pathname === "/api/catalog/sync-status") {
      if (!env.BUCKET) {
        return json({ success: false, error: "Catalog sync status storage is not configured." }, 503, env);
      }
      const latestStatus = await env.BUCKET.get("catalog-sync/latest.json");
      const latestRun = latestStatus ? await latestStatus.json() : null;
      return json({ success: true, latestRun }, 200, env);
    }

    // 1. GeoTV Channels list with Cloudflare cache & secure authentication
    if (url.pathname === "/api/iptv/channels" || url.pathname === "/api/geotv/channels" || url.pathname === "/api/iptv/geotv/channels") {
      try {
        if (!env.CATALOG_DB) {
          return json({ success: false, error: "Channel catalog storage is not configured." }, 503, env);
        }
        const force = url.searchParams.get("refresh") === "1" || url.searchParams.get("force") === "1";
        let channels = force ? [] : await readChannelCatalog(env.CATALOG_DB, env.PLAYBACK_BASE_URL);
        let refreshed = false;
        if (force || channels.length === 0) {
          await runCatalogSync(env, "request");
          channels = await readChannelCatalog(env.CATALOG_DB, env.PLAYBACK_BASE_URL);
          refreshed = true;
        }
        return withCors(
          new Response(JSON.stringify({
            success: true,
            cached: !refreshed,
            count: channels.length,
            channels,
            catalogPersisted: true,
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=1800, s-maxage=3600",
              "X-Cloudflare-Worker": "PlayBeat-IPTV-Proxy",
            },
          }),
          env
        );
      } catch (err: any) {
        console.error("[GeoTV catalog] synchronization failed:", err instanceof Error ? err.name : "Unknown error");
        return json({ success: false, error: "Channel catalog synchronization failed. Check the secure provider and D1 configuration." }, 503, env);
      }
    }

    // 2. Cloudflare-cached Image Proxy with secure headers & SVG fallback
    if (url.pathname === "/api/iptv/image" || url.pathname === "/api/geotv/image" || url.pathname === "/api/proxy/image") {
      const targetUrl = url.searchParams.get("url") || "";
      const imgRes = await fetchGeoTvImage(env, targetUrl, request);
      return withCors(imgRes, env);
    }

    // 3. Cloudflare-accelerated HLS Stream Playlist Proxy
    if (url.pathname === "/api/iptv/hls/stream.m3u8" || url.pathname === "/api/proxy/hls/stream.m3u8") {
      const channelId = url.searchParams.get("channelId") || "";
      const targetUrl = url.searchParams.get("url") || undefined;
      try {
        const providerEnv = withGeoTvProvider(env);
        const segmentPath = `${env.PLAYBACK_BASE_URL}/broadcast/api/iptv/segment`;
        const hlsRes = await fetchGeoTvHlsStream(providerEnv, channelId, targetUrl, segmentPath);
        return withCors(hlsRes, env);
      } catch (err) {
        const providerError = err instanceof Error && err.message === "GeoTV provider is not configured";
        const insecureProvider = err instanceof Error && err.message === "GeoTV provider must be configured with HTTPS.";
        if (providerError || insecureProvider) {
          return json({
            success: false,
            error: insecureProvider ? "Provider playlist must use HTTPS." : "GeoTV provider is not configured.",
          }, 503, env);
        }
        console.error("[GeoTV HLS] stream request failed:", err instanceof Error ? err.name : "Unknown error");
        return json({ success: false, error: "Stream is temporarily unavailable." }, 502, env);
      }
    }

    // 4. Cloudflare-accelerated Video TS Segment Proxy
    if (url.pathname === "/api/iptv/segment" || url.pathname === "/api/proxy/segment") {
      const segmentUrl = url.searchParams.get("url") || "";
      try {
        const providerEnv = withGeoTvProvider(env);
        const segRes = await fetchGeoTvSegment(providerEnv, segmentUrl);
        return withCors(segRes, env);
      } catch (err) {
        const providerError = err instanceof Error
          && (err.message === "GeoTV provider is not configured"
            || err.message === "GeoTV provider must be configured with HTTPS.");
        if (providerError) {
          return json({ success: false, error: "Provider configuration is required." }, 503, env);
        }
        throw err;
      }
    }

    // 5. Cloudflare 1.1.1.1 DoH External DNS Resolver
    if (url.pathname === "/api/iptv/dns" || url.pathname === "/api/cloudflare/dns/resolve") {
      const domain = url.searchParams.get("domain") || "geotv.space";
      const dnsResult = await resolveCloudflareDoh(domain);
      return json({ success: true, domain, resolvedVia: "Cloudflare 1.1.1.1 DoH", ...dnsResult }, 200, env);
    }

    // DNS management is performed in the Cloudflare dashboard, not by this Worker.
    if (url.pathname === "/api/cloudflare/dns/setup-zone" || url.pathname === "/api/cloudflare/dns/records") {
      return json({ success: false, error: "DNS management is not implemented by this Worker." }, 503, env);
    }

    // Operational reports, account registration, and checkout are unavailable until
    // real telemetry, identity, and payment services are configured.
    if (
      url.pathname === "/api/cron/daily-report" ||
      url.pathname === "/api/report/daily" ||
      url.pathname === "/api/cron/maintenance" ||
      url.pathname === "/api/system/maintenance" ||
      url.pathname === "/api/user/register" ||
      url.pathname === "/api/checkout/create-order" ||
      url.pathname === "/api/checkout/verify-payment" ||
      url.pathname === "/api/provider/call"
    ) {
      return json({ success: false, error: "This service is not configured." }, 503, env);
    }

    const match = url.pathname.match(/^\/api\/([a-z_]+)$/);
    const action = match && ACTIONS[match[1]];
    if (!action) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return json({ status: "error", msg: "Not found" }, 404, env);
    }
    if (request.method !== "POST") return json({ status: "error", msg: "Use POST" }, 405, env);
    if (!(await authorized(request, env))) return json({ status: "error", msg: "Unauthorized" }, 401, env);
    const apiKey = env.IPTV_API_KEY || env.STAR_IPTV_API_KEY;
    if (!apiKey) return json({ status: "error", msg: "Server not configured" }, 500, env);

    let body: Record<string, any> = {};
    try { body = await request.json(); } catch { /* empty body is fine for info/credit_logs */ }

    const params = new URLSearchParams({ apikey: apiKey });

    // Only whitelisted fields are forwarded; anything else in the body is ignored.
    for (const [key, check] of Object.entries(action.fields || {})) {
      if (body[key] === undefined || body[key] === null) continue;
      const value = String(body[key]).trim();
      if (!check(value)) return json({ status: "error", msg: `Invalid value for "${key}"` }, 400, env);
      params.set(key, key === "bid" ? value.replace(/\s/g, "") : value);
    }
    for (const key of action.required || []) {
      if (!params.has(key)) return json({ status: "error", msg: `Missing "${key}"` }, 400, env);
    }

    // Doc: same username and password are prohibited.
    if (params.has("pass")) {
      const name = params.get("newuser") ?? params.get("user");
      if (params.get("pass") === name) {
        return json({ status: "error", msg: "Username and password must differ" }, 400, env);
      }
    }

    for (const [k, v] of Object.entries(action.extra || {})) params.set(k, v);
    if (action.callback) params.set("callback", b64(`${url.origin}/callback/`));
    params.set("type", action.type);

    // Always POST so the API key never appears in a URL or upstream access logs.
    let res: Response;
    try {
      res = await fetch(UPSTREAM, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    } catch {
      return json({ status: "error", msg: "Upstream unreachable" }, 502, env);
    }

    const raw = await res.text();
    try {
      return json(JSON.parse(raw), res.ok ? 200 : 502, env);
    } catch {
      return json({ status: "error", msg: "Upstream returned non-JSON", upstream_status: res.status }, 502, env);
    }
  },
};

async function runCatalogSync(env: any, source: "scheduled" | "request"): Promise<void> {
  const startedAt = new Date().toISOString();
  let stage: "provider" | "catalog" | "status" = "provider";
  try {
    if (!env.CATALOG_DB) throw new Error("Channel catalog storage is not configured.");

    const result = await fetchGeoTvChannels(env, { force: true });
    if (result.channels.length === 0) {
      throw new Error("The provider returned an empty channel catalog.");
    }

    stage = "catalog";
    await persistChannelCatalog(env.CATALOG_DB, result.channels);
    stage = "status";
    await recordCatalogSync(env.BUCKET, {
      source,
      status: "success",
      channelCount: result.channels.length,
      startedAt,
      finishedAt: new Date().toISOString(),
      errorSummary: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorType = error instanceof Error ? error.name : "Unknown";
    const upstreamStatus = message.match(/returned HTTP (\d{3})/);
    let errorSummary: string;
    if (upstreamStatus) {
      errorSummary = `Provider returned HTTP ${upstreamStatus[1]}.`;
    } else if (message.includes("empty channel catalog")) {
      errorSummary = "Provider returned no channels.";
    } else if (message.includes("HTTPS")) {
      errorSummary = "Provider HTTPS configuration is required.";
    } else if (message.includes("not configured") || message.includes("incomplete")) {
      errorSummary = "Provider configuration is incomplete.";
    } else if (message.startsWith("Provider transport failed (")) {
      errorSummary = message;
    } else if (stage === "provider" && errorType === "TypeError") {
      errorSummary = `Provider request failed (${errorType}: ${safeProviderErrorMessage(message, env)}).`;
    } else if (stage === "provider") {
      errorSummary = "Provider request failed.";
    } else if (stage === "catalog" && /7500|write quota/i.test(message)) {
      errorSummary = "D1 daily row-write quota exceeded.";
    } else if (stage === "catalog") {
      errorSummary = "Catalog database write failed.";
    } else {
      errorSummary = "Catalog sync status storage failed.";
    }

    if (env.BUCKET) {
      await recordCatalogSync(env.BUCKET, {
        source,
        status: "failed",
        channelCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorSummary,
      });
    }
    console.error("[GeoTV catalog] synchronization failed:", error instanceof Error ? error.name : "Unknown error");
    throw error;
  }
}

function safeProviderErrorMessage(message: string, env: any): string {
  let safeMessage = message
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')
    .replace(/((?:username|password)=)[^&\s]+/gi, '$1[redacted]');
  for (const secret of [env.GEOTV_USER, env.GEOTV_PASS]) {
    if (typeof secret === "string" && secret.length > 0) {
      safeMessage = safeMessage.replaceAll(secret, "[redacted]");
      safeMessage = safeMessage.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  if (typeof env.M3U_PLAYLIST_URL === "string") {
    safeMessage = safeMessage.replaceAll(env.M3U_PLAYLIST_URL, "[provider URL redacted]");
  }
  return safeMessage.slice(0, 140) || "unknown provider error";
}

async function recordCatalogSync(
  bucket: any,
  run: {
    source: "scheduled" | "request";
    status: "success" | "failed";
    channelCount: number;
    startedAt: string;
    finishedAt: string;
    errorSummary: string | null;
  }
): Promise<void> {
  await bucket.put("catalog-sync/latest.json", JSON.stringify({
    source: run.source,
    status: run.status,
    channelCount: run.channelCount,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    error: run.errorSummary,
  }), {
    httpMetadata: { contentType: "application/json" },
  });
}

// ---------- ActiveCode activation callback ----------
export async function handleCallback(request: Request, env: any, url: URL): Promise<Response> {
  const p: Record<string, any> = Object.fromEntries(url.searchParams);
  if (request.method === "POST") {
    const ct = request.headers.get("Content-Type") || "";
    try {
      if (ct.includes("application/json")) Object.assign(p, await request.json());
      else Object.assign(p, Object.fromEntries(await request.formData()));
    } catch { /* ignore malformed bodies */ }
  }

  if ("handshake" in p) return new Response("1");

  const ts = /^\d{9,11}$/;
  if (
    p.action !== "active" ||
    !CODE_RE.test(String(p.activecode ?? "")) ||
    !ts.test(String(p.start ?? "")) ||
    !ts.test(String(p.end ?? ""))
  ) {
    return new Response("", { status: 400 });
  }

  const record = {
    activecode: String(p.activecode),
    start: Number(p.start),
    end: Number(p.end),
    received_at: Date.now(),
  };

  if (env.ACTIVATIONS?.put) {
    await env.ACTIVATIONS.put(`ac:${record.activecode}`, JSON.stringify(record));
  }
  return new Response("1");
}

// ---------- helpers ----------
async function authorized(request: Request, env: any): Promise<boolean> {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.ADMIN_TOKEN) return false;
  if (!token) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(token)),
    crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_TOKEN)),
  ]);
  const aBuf = new Uint8Array(a);
  const bBuf = new Uint8Array(b);
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) diff |= aBuf[i] ^ bBuf[i];
  return diff === 0;
}

function b64(str: string): string {
  return btoa(str).replace(/=+$/, "");
}

function withCors(res: Response, env: any): Response {
  if (env?.ALLOWED_ORIGIN) {
    res.headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  } else {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}

function json(data: any, status: number, env: any): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
    env
  );
}
