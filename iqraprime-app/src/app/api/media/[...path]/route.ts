import { NextRequest } from "next/server";

/**
 * IQRAPRIME media proxy — serves provider VOD over same-origin HTTPS.
 *
 * The panel's media edge nodes are plain HTTP (redirect chain:
 * panel 302 → bwrc token → http://<edge>/auth/<token>), which browsers
 * block as mixed content on an HTTPS site. This route fetches the stream
 * server-side (credentials injected from env, never exposed) and pipes the
 * bytes back with HTTP Range support so seeking works naturally.
 *
 *   /api/media/movie/<streamId>.<ext>
 *   /api/media/series/<episodeId>.<ext>
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Per-request chunk cap when the client sends no Range header — keeps each
 *  invocation well inside the function time limit; players issue more ranges
 *  as needed. */
const DEFAULT_WINDOW = 4 * 1024 * 1024;

function panelHttpsBase(): string {
  let host = (process.env.P_HOST || "").replace(/\/+$/, "");
  if (!host) host = "http://stream.playbeat.live:8880";
  // The panel serves TLS via Cloudflare on 443 — normalize the default line.
  host = host.replace(/^http:\/\//i, "https://").replace(/:8880$/, "");
  return host;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const [kind, file] = path;
  const id = String(file || "").replace(/\.[a-z0-9]+$/i, "");
  if (!id || !Number.isFinite(Number(id)) || !["movie", "series"].includes(kind)) {
    return new Response("Bad media path", { status: 400 });
  }

  const user = process.env.P_USER || "";
  const pass = process.env.P_PASS || "";
  if (!user || !pass) return new Response("Provider not configured", { status: 503 });

  const base = panelHttpsBase();
  const upstream = `${base}/${kind}/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${id}`;

  // Pass the player's Range through; when absent, request a bounded window.
  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
    Accept: "*/*",
  };
  headers["Range"] = range && /^bytes=/.test(range) ? range : `bytes=0-${DEFAULT_WINDOW - 1}`;

  let res: Response;
  try {
    res = await fetch(upstream, { headers, redirect: "follow", cache: "no-store" });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }
  if (!res.ok && res.status !== 206) {
    return new Response(`Upstream ${res.status}`, { status: 502 });
  }

  const out = new Headers();
  const copy = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];
  for (const h of copy) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
  if (!out.has("content-type")) out.set("content-type", "video/mp4");
  // Same-origin — browser-only caching of byte ranges.
  out.set("Cache-Control", "private, max-age=0, must-revalidate");

  return new Response(res.body, { status: res.status, headers: out });
}
