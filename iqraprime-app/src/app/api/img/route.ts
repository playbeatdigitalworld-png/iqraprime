import { NextRequest } from "next/server";

/**
 * IQRAPRIME image proxy — serves provider artwork (TMDB posters, panel images)
 * over same-origin HTTPS so posters render on every network.
 *
 * Why: many ISPs (notably across PK/IN/BD) cannot reach image.tmdb.org, and the
 * panel's own image nodes are plain HTTP (mixed content on HTTPS pages). Both
 * cases surface as "posters not showing". Routing artwork through this route
 * means the viewer's browser only ever talks to our origin.
 *
 * Security: strict host allowlist (SSRF-safe). Only TMDB artwork and the
 * provider panel's own image paths are proxied.
 *
 * Caching: immutable artwork — long edge cache (s-maxage) so Vercel's CDN
 * serves repeat views without invoking the function.
 *
 * Fallback: upstream failures return a branded SVG placeholder (HTTP 200,
 * image/svg+xml) so <img> tags never render broken.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set(["image.tmdb.org"]);

function panelHost(): string {
  let host = (process.env.P_HOST || "").trim();
  host = host
    .replace(/^https?:\/\//i, "")
    .replace(/:.*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return host;
}

/** Branded placeholder shown when artwork is unreachable — gold film frame. */
function fallbackSvg(title: string): string {
  const safe = title
    .slice(0, 42)
    .replace(/[<>&"]/g, " ")
    .trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0F17"/>
      <stop offset="1" stop-color="#05070B"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD966"/>
      <stop offset="1" stop-color="#FFBD24"/>
    </linearGradient>
  </defs>
  <rect width="600" height="900" fill="url(#bg)"/>
  <rect x="14" y="14" width="572" height="872" fill="none" stroke="#FFBD24" stroke-opacity="0.35" stroke-width="3" rx="18"/>
  <g transform="translate(300,395)">
    <rect x="-70" y="-88" width="140" height="176" rx="12" fill="none" stroke="url(#gold)" stroke-width="7"/>
    <g fill="#FFBD24">
      <rect x="-52" y="-70" width="14" height="10" rx="2"/>
      <rect x="38" y="-70" width="14" height="10" rx="2"/>
      <rect x="-52" y="-28" width="14" height="10" rx="2"/>
      <rect x="38" y="-28" width="14" height="10" rx="2"/>
      <rect x="-52" y="14" width="14" height="10" rx="2"/>
      <rect x="38" y="14" width="14" height="10" rx="2"/>
      <rect x="-52" y="56" width="14" height="10" rx="2"/>
      <rect x="38" y="56" width="14" height="10" rx="2"/>
    </g>
    <path d="M -18 -30 L 34 0 L -18 30 Z" fill="url(#gold)"/>
  </g>
  ${safe ? `<text x="300" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#FFBD24" fill-opacity="0.9">${safe}</text>` : ""}
  <text x="300" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" letter-spacing="6" fill="#9AA3B2">IQRAPRIME</text>
</svg>`;
}

function svgResponse(svg: string, cacheSeconds = 3600): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`,
    },
  });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") || "";
  const label = req.nextUrl.searchParams.get("t") || "";
  if (!raw) return svgResponse(fallbackSvg(label));

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return svgResponse(fallbackSvg(label));
  }

  const allowed =
    ALLOWED_HOSTS.has(target.hostname.toLowerCase()) ||
    (panelHost() && target.hostname.toLowerCase() === panelHost());
  if (!allowed || !/^https?:$/.test(target.protocol)) {
    return svgResponse(fallbackSvg(label));
  }

  const upstream = new URL(target.toString());
  // Always prefer TLS upstreams (TMDB + panel both terminate TLS).
  if (upstream.protocol === "http:") upstream.protocol = "https:";
  // Panel images live behind the same origin as the API (no :8880 needed via CF).

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return svgResponse(fallbackSvg(label));
  }

  if (!res.ok || !res.body) return svgResponse(fallbackSvg(label));

  const headers = new Headers();
  headers.set(
    "Content-Type",
    res.headers.get("content-type") || "image/jpeg"
  );
  const len = res.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set(
    "Cache-Control",
    "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800"
  );
  return new Response(res.body, { status: 200, headers });
}
