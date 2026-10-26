/**
 * server/streamProxy.ts
 *
 * HTTPS stream relay for Star IPTV provider content.
 *
 * The provider serves everything over plain HTTP (TLS on its ports fails with
 * "wrong version number"; even its HLS redirect target is http://…:80). Browsers
 * block that mixed content on our HTTPS site, so direct provider URLs can never
 * play (symptom: "Failed to decode media source").
 *
 * This relay re-serves provider media from our own HTTPS origin:
 *  - Playback URLs are sealed: the provider URL is encrypted with AES-256-GCM
 *    (key derived from LINE_VAULT_KEY). The browser never sees provider
 *    credentials, and arbitrary URLs cannot be injected (only we can mint refs).
 *  - HLS manifests (.m3u8) are fetched server-side and every segment / child
 *    playlist URI (absolute, redirect-tokenized, or relative) is rewritten to
 *    a sealed relay URL — including URI="…" attributes (EXT-X-KEY etc.).
 *  - Media bodies are streamed pass-through with Range support. Unbounded
 *    ranges on progressive media are capped to 4 MB windows so every request
 *    stays well inside the serverless function time limit and seeking works.
 *  - The provider gates renditions, manifests and Range support by User-Agent
 *    and rate-limits bursts with 503 HTML pages — fetches use a player UA and
 *    retry 5xx responses.
 *
 * SSRF hardening: refs are opaque ciphertext; decoded targets must be http(s)
 * and are checked against private/loopback host patterns.
 */
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Crypto sealing
// ---------------------------------------------------------------------------

function relayKey(): Buffer {
  const material = process.env.LINE_VAULT_KEY || 'streamplay-stream-proxy-fallback-v1';
  return crypto.createHash('sha256').update(`stream-proxy-v1|${material}`).digest();
}

/** Encrypt a provider URL into an opaque, tamper-proof relay reference. */
export function sealStreamRef(providerUrl: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', relayKey(), iv);
  const ct = Buffer.concat([cipher.update(providerUrl, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64url');
}

/** Decrypt a relay reference back into the provider URL; null if invalid. */
export function openStreamRef(ref: string): string | null {
  try {
    const raw = Buffer.from(ref, 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', relayKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Build a same-origin relay URL for a provider URL. The cosmetic `f=` filename
 * keeps the frontend's `.m3u8` / native-video source sniffing working unchanged:
 *  - 'manifest' → f=manifest.m3u8 (hls.js path)
 *  - 'media'    → f=segment.ts   (native video / hls.js segment fetch)
 * The relay trusts this hint (only we can mint refs) plus the sealed extension.
 */
export function proxiedStreamUrl(providerUrl: string, kind: 'manifest' | 'media'): string {
  const ref = sealStreamRef(providerUrl);
  const f = kind === 'manifest' ? 'manifest.m3u8' : 'segment.ts';
  return `/api/stream/hls?ref=${ref}&f=${f}`;
}

// ---------------------------------------------------------------------------
// Playlist rewriting
// ---------------------------------------------------------------------------

function resolveUri(uri: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(uri)) return uri;
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

/** Tags whose URI="…" attribute points at a playlist (not media). */
const PLAYLIST_URI_TAGS = ['#EXT-X-I-FRAME-STREAM-INF', '#EXT-X-MEDIA', '#EXT-X-SESSION-DATA'];

function rewritePlaylist(text: string, baseUrl: string): string {
  const lines = text.split(/\r?\n/);
  let expectVariant = false; // previous line was #EXT-X-STREAM-INF
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith('#')) {
      const upper = t.toUpperCase();
      if (upper.startsWith('#EXT-X-STREAM-INF')) {
        expectVariant = true;
        continue;
      }
      if (PLAYLIST_URI_TAGS.some((tag) => upper.startsWith(tag))) {
        lines[i] = lines[i].replace(
          /URI="([^"]+)"/g,
          (_m, uri: string) => `URI="${proxiedStreamUrl(resolveUri(uri, baseUrl), 'manifest')}"`,
        );
        continue;
      }
      // #EXT-X-KEY / #EXT-X-MAP / anything else with URI="…" → media bytes
      lines[i] = lines[i].replace(
        /URI="([^"]+)"/g,
        (_m, uri: string) => `URI="${proxiedStreamUrl(resolveUri(uri, baseUrl), 'media')}"`,
      );
      continue;
    }
    const kind = expectVariant ? 'manifest' : 'media';
    expectVariant = false;
    lines[i] = proxiedStreamUrl(resolveUri(t, baseUrl), kind);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

function isBlockedTarget(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local')) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Relay handler (GET /api/stream/hls?ref=…&f=…)
// ---------------------------------------------------------------------------

const RANGE_WINDOW = 4 * 1024 * 1024; // cap unbounded progressive-media ranges

/**
 * The provider gates both renditions and Range support by User-Agent: default
 * HTTP clients get "this client is not a video player" 403s on manifests and
 * non-seekable MPEG-TS on media. A media-player UA yields real HLS playlists
 * and seekable (206, Accept-Ranges) video/mp4.
 */
const UPSTREAM_UA = 'VLC/3.0.20 LibVLC/3.0.20';

/** Fetch upstream with the player UA; retries 5xx AND network-level throws
 *  (the panel alternates 503 HTML bursts with straight connection resets). */
async function fetchUpstream(
  providerUrl: string,
  range: string | undefined,
  signal: AbortSignal,
): Promise<{ res: globalThis.Response | null; lastError: unknown }> {
  let last: globalThis.Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal.aborted) break;
    try {
      const up = await fetch(providerUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': UPSTREAM_UA,
          Accept: '*/*',
          ...(range ? { Range: range } : {}),
        },
        signal,
      });
      if (up.status < 500) return { res: up, lastError: null };
      try {
        await up.text();
      } catch {}
      last = up;
    } catch (err) {
      if (signal.aborted) break;
      lastError = err;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 900 * attempt));
  }
  return { res: last, lastError };
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function handleStreamRelay(req: Request, res: Response): Promise<void> {
  const ref = String(req.query.ref || req.query.src || '');
  const providerUrl = ref ? openStreamRef(ref) : null;
  type FetchResponse = globalThis.Response;

  if (!providerUrl || !/^https?:\/\//i.test(providerUrl)) {
    res.status(403).json({ error: 'Invalid stream reference.' });
    return;
  }

  let target: URL;
  try {
    target = new URL(providerUrl);
  } catch {
    res.status(403).json({ error: 'Invalid stream reference.' });
    return;
  }
  if (isBlockedTarget(target.hostname)) {
    res.status(403).json({ error: 'Blocked stream target.' });
    return;
  }

  const fHint = String(req.query.f || '');
  const rangeHeader = firstHeader(req.headers.range);

  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.on('close', onClose);

  try {
    // Cap unbounded ranges on progressive media so one request never runs
    // into the serverless time limit and the player re-requests as needed.
    let upstreamRange = rangeHeader;
    if (rangeHeader && /bytes=\d+-\s*$/i.test(rangeHeader)) {
      const start = Number(rangeHeader.replace(/^bytes=/, '').replace(/-\s*$/, ''));
      if (Number.isFinite(start)) upstreamRange = `bytes=${start}-${start + RANGE_WINDOW - 1}`;
    }

    const { res: upstream, lastError: fetchError } = await fetchUpstream(
      providerUrl,
      upstreamRange,
      controller.signal,
    );
    if (!upstream) throw fetchError ?? new Error('no upstream response');

    const finalUrl = upstream.url || providerUrl;
    const ctype = upstream.headers.get('content-type') || '';
    const wantsManifest =
      /manifest/i.test(fHint) || /\.m3u8($|\?)/i.test(providerUrl) || /mpegurl/i.test(ctype);

    if (wantsManifest) {
      const text = await upstream.text();
      if (!text.includes('#EXTM3U')) {
        res.status(502).json({ error: 'Upstream manifest unavailable.', upstreamStatus: upstream.status });
        return;
      }
      res.status(200);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      res.send(rewritePlaylist(text, finalUrl));
      return;
    }

    // Media pass-through (HLS segments, MP4 byte ranges, keys)
    res.status(upstream.status);
    for (const hname of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = upstream.headers.get(hname);
      if (v) res.setHeader(hname, v);
    }
    // Edge-cache full (non-Range) media fetches: every viewer re-requests the
    // same live-segment URL in the same wall-clock window, so letting the CDN
    // serve repeats offloads the provider and defuses its 503 burst limiting.
    // Range requests (VOD seeking) stay uncached to keep byte-range semantics.
    if (!rangeHeader && upstream.status === 200 && /mpeg|mp2t|video|audio/i.test(ctype)) {
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
    }
    if (!upstream.body) {
      res.end();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      nodeStream.on('error', reject);
      res.on('close', () => resolve());
      nodeStream.pipe(res);
      nodeStream.on('end', () => resolve());
    });
  } catch (e: unknown) {
    if (res.headersSent) {
      res.end();
    } else {
      // Safe diagnostic hint only (never leaks credentials/URLs).
      const cause = (e as { cause?: { code?: string } } | null)?.cause?.code || undefined;
      res.status(502).json({ error: 'Stream relay failed.', reason: cause || (e instanceof Error ? e.message : 'unknown') });
    }
  }
}
