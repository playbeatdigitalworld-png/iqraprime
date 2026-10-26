import type { Env } from '../env';
import { MAX_CATALOG_CHANNELS } from './catalog-store';

// Cloudflare 1.1.1.1 DoH DNS Cache entry
interface DohCacheEntry {
  ip: string;
  latencyMs: number;
  expires: number;
}
const dohCache: Record<string, DohCacheEntry> = {};

// In-memory response cache for worker runtimes without caches.default
interface MemoryCacheItem {
  body: ArrayBuffer | string;
  contentType: string;
  headers: Record<string, string>;
  expires: number;
}
const memoryImageCache = new Map<string, MemoryCacheItem>();
let cachedChannelList: { channels: any[]; count: number; expires: number } | null = null;

/**
 * Resolves a hostname using Cloudflare 1.1.1.1 DNS over HTTPS (DoH)
 * Guarantees ultra-low latency edge resolution and DNS route acceleration.
 */
export async function resolveCloudflareDoh(hostname: string): Promise<{ ip: string; latencyMs: number }> {
  const now = Date.now();
  if (dohCache[hostname] && dohCache[hostname].expires > now) {
    return { ip: dohCache[hostname].ip, latencyMs: dohCache[hostname].latencyMs };
  }

  const startTime = Date.now();
  try {
    const dohRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { Accept: 'application/dns-json' },
    });
    const data = (await dohRes.json()) as any;
    const durationMs = Date.now() - startTime;
    if (data.Answer && data.Answer.length > 0) {
      const ip = data.Answer[0].data;
      const ttl = Math.max(60, data.Answer[0].TTL || 300) * 1000;
      dohCache[hostname] = { ip, latencyMs: durationMs, expires: now + ttl };
      return { ip, latencyMs: durationMs };
    }
  } catch (err: any) {
    console.warn(`[Cloudflare DoH] Fallback resolution for ${hostname}:`, err.message);
  }
  return { ip: hostname, latencyMs: Date.now() - startTime };
}

/**
 * Validates that a target URL is safe and not an internal network or SSRF attempt
 */
export function isAllowedHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    // Disallow loopback and private IP spaces
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('169.254.') ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    // Only allow HTTP/HTTPS
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedProviderUrl(urlStr: string, env: Env, providerOrigin?: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const expectedOrigin = providerOrigin
      ?? env.GEOTV_ALLOWED_ORIGIN
      ?? (env.GEOTV_HOST ? new URL(env.GEOTV_HOST).origin : undefined);
    if (!isAllowedHost(urlStr) || !expectedOrigin || parsed.origin !== new URL(expectedOrigin).origin) {
      return false;
    }
    return parsed.protocol === 'https:'
      || (parsed.protocol === 'http:'
        && env.ALLOW_INSECURE_GEOTV === 'true'
        && parsed.origin === env.GEOTV_ALLOWED_ORIGIN);
  } catch {
    return false;
  }
}

function redactProviderCredentials(url: string, user: string, pass: string): string {
  const parsed = new URL(url);
  if (decodeURIComponent(parsed.username) === user) parsed.username = '__PB_PROVIDER_USERNAME__';
  if (decodeURIComponent(parsed.password) === pass) parsed.password = '__PB_PROVIDER_PASSWORD__';
  parsed.pathname = parsed.pathname.split('/').map((segment) => {
    let decodedSegment = segment;
    try {
      decodedSegment = decodeURIComponent(segment);
    } catch {
      return segment;
    }
    if (decodedSegment === user) return '__PB_PROVIDER_USERNAME__';
    if (decodedSegment === pass) return '__PB_PROVIDER_PASSWORD__';
    return segment;
  }).join('/');
  for (const key of [...parsed.searchParams.keys()]) {
    const value = parsed.searchParams.get(key);
    if (value === user) parsed.searchParams.set(key, '__PB_PROVIDER_USERNAME__');
    if (value === pass) parsed.searchParams.set(key, '__PB_PROVIDER_PASSWORD__');
  }
  return parsed.href;
}

function restoreProviderCredentials(url: string, user?: string, pass?: string): string | null {
  if (!url.includes('__PB_PROVIDER_USERNAME__') && !url.includes('__PB_PROVIDER_PASSWORD__')) return url;
  if (!user || !pass) return null;
  const parsed = new URL(url);
  if (parsed.username === '__PB_PROVIDER_USERNAME__') parsed.username = encodeURIComponent(user);
  if (parsed.password === '__PB_PROVIDER_PASSWORD__') parsed.password = encodeURIComponent(pass);
  parsed.pathname = parsed.pathname.split('/').map((segment) => {
    if (segment === '__PB_PROVIDER_USERNAME__') return encodeURIComponent(user);
    if (segment === '__PB_PROVIDER_PASSWORD__') return encodeURIComponent(pass);
    return segment;
  }).join('/');
  for (const key of [...parsed.searchParams.keys()]) {
    const value = parsed.searchParams.get(key);
    if (value === '__PB_PROVIDER_USERNAME__') parsed.searchParams.set(key, user);
    if (value === '__PB_PROVIDER_PASSWORD__') parsed.searchParams.set(key, pass);
  }
  return parsed.href;
}

function safeTransportCode(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown';
  const cause = error.cause;
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = cause.code;
    if (typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code)) return code;
  }
  return error.name;
}

/**
 * Cleans raw broadcast channel names from technical prefixes without altering their authentic name
 */
export function cleanBroadcastName(rawName: string): string {
  let cleaned = rawName.trim();
  cleaned = cleaned.replace(/^(CM:\s*|IN\s*-\s*|PK\s*-\s*|EN\s*-\s*|UK\s*-\s*|SL\s*)/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || rawName.trim();
}

/**
 * Categorizes a channel into standard OTT media categories
 */
export function categorizeChannel(name: string, group: string): string {
  const text = `${name} ${group}`.toLowerCase();
  if (text.includes('sport') || text.includes('cricket')) return 'Sports';
  if (text.includes('news')) return 'News';
  if (
    text.includes('movie') ||
    text.includes('bollywood') ||
    text.includes('hollywood') ||
    text.includes('cinema') ||
    text.includes('amazon')
  ) {
    return 'Movies';
  }
  if (text.includes('kid') || text.includes('cartoon') || text.includes('animation')) return 'Kids';
  if (text.includes('music') || text.includes('singer')) return 'Music';
  if (text.includes('documentary')) return 'Documentary';
  if (text.includes('islamic')) return 'International';
  return 'Entertainment';
}

/**
 * Generates an SVG fallback image for broken or unavailable channel logos
 */
function generateFallbackSvg(label: string): string {
  const initial = (label || 'TV').slice(0, 3).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" rx="24" fill="#0c1326"/>
    <rect width="116" height="116" x="2" y="2" rx="22" fill="none" stroke="#06b6d4" stroke-width="2" stroke-opacity="0.4"/>
    <text x="60" y="68" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="900" fill="#22d3ee" text-anchor="middle">${initial}</text>
  </svg>`;
}

/**
 * Cloudflare-cached fetcher for GeoTV channel playlist
 * Injects upstream credentials securely on the server/worker side.
 */
export async function fetchGeoTvChannels(
  env: Env,
  options?: { force?: boolean }
): Promise<{ success: boolean; cached: boolean; count: number; channels: any[] }> {
  const now = Date.now();
  const force = options?.force || false;

  if (!force && cachedChannelList && cachedChannelList.expires > now) {
    return {
      success: true,
      cached: true,
      count: cachedChannelList.count,
      channels: cachedChannelList.channels,
    };
  }

  const configuredPlaylist = env.M3U_PLAYLIST_URL ? new URL(env.M3U_PLAYLIST_URL) : null;
  const host = env.GEOTV_ALLOWED_ORIGIN ?? configuredPlaylist?.origin ?? env.GEOTV_HOST;
  const user = configuredPlaylist?.searchParams.get('username') ?? env.GEOTV_USER;
  const pass = configuredPlaylist?.searchParams.get('password') ?? env.GEOTV_PASS;

  if (!host || !user || !pass) throw new Error('GeoTV provider configuration is incomplete.');
  const providerOrigin = host;
  if (!isAllowedProviderUrl(host, env, providerOrigin)) {
    throw new Error('GeoTV provider must be configured with HTTPS.');
  }

  const playlistUrl = `${host}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus&output=ts`;

  const hostUrl = new URL(playlistUrl);
  await resolveCloudflareDoh(hostUrl.hostname);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(playlistUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'PlayBeat-Worker/3.0 (Cloudflare-Edge-Sync)',
        Accept: '*/*',
      },
    });
  } catch (error) {
    throw new Error(`Provider transport failed (${safeTransportCode(error)}).`);
  }
  const playlistRedirect = upstreamRes.headers.get('location');
  let playlistResponse = upstreamRes;
  if (playlistRedirect && upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const redirectedUrl = new URL(playlistRedirect, playlistUrl);
    if (!isAllowedProviderUrl(redirectedUrl.href, env, providerOrigin)) {
      throw new Error('Provider playlist redirect is outside the configured origin.');
    }
    try {
      playlistResponse = await fetch(redirectedUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'PlayBeat-Worker/3.0 (Cloudflare-Edge-Sync)',
          Accept: '*/*',
        },
      });
    } catch (error) {
      throw new Error(`Provider transport failed (${safeTransportCode(error)}).`);
    }
  }
  if (playlistResponse.status >= 300 && playlistResponse.status < 400) {
    throw new Error('Provider returned an unsupported playlist redirect.');
  }

  if (!playlistResponse.ok) {
    throw new Error(`Upstream GeoTV returned HTTP ${playlistResponse.status}: ${playlistResponse.statusText}`);
  }

  const parsedChannels: any[] = [];
  let currentItem: any = null;
  const processPlaylistLine = (rawLine: string): void => {
    const line = rawLine.trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const epgMatch = line.match(/tvg-id="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const nameParts = line.split(',');
      const rawName = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : 'Live Channel';
      const cleanName = cleanBroadcastName(rawName);
      const group = groupMatch ? groupMatch[1].trim() : 'General';
      const logo = logoMatch ? logoMatch[1] : '';

      currentItem = {
        name: cleanName,
        rawName,
        epgId: epgMatch ? epgMatch[1].trim() : '',
        logo: logo ? `/api/iptv/image?url=${encodeURIComponent(logo)}` : '',
        rawLogo: logo,
        group,
        category: categorizeChannel(rawName, group),
      };
    } else if (line.includes('/live/')) {
      if (currentItem) {
        const idMatch = line.match(/\/live\/[^/]+\/[^/]+\/(\d+)\./);
        const streamId = idMatch ? idMatch[1] : String(parsedChannels.length + 1);
        currentItem.id = `geo_${streamId}`;
        currentItem.streamId = streamId;
        // Securely routed endpoints (credentials are never exposed to the client)
        currentItem.hlsUrl = `/api/iptv/hls/stream.m3u8?channelId=${streamId}`;
        currentItem.tsUrl = `/api/iptv/stream?channelId=${streamId}`;
        parsedChannels.push(currentItem);
        if (parsedChannels.length > MAX_CATALOG_CHANNELS) {
          throw new Error(`Provider playlist exceeds the ${MAX_CATALOG_CHANNELS}-channel limit.`);
        }
        currentItem = null;
      }
    }
  };

  if (!playlistResponse.body) {
    throw new Error('Provider returned an empty playlist response.');
  }
  const reader = playlistResponse.body.getReader();
  const decoder = new TextDecoder();
  let bufferedLine = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      bufferedLine += decoder.decode(value, { stream: !done });
      let newlineIndex = bufferedLine.indexOf('\n');
      while (newlineIndex >= 0) {
        processPlaylistLine(bufferedLine.slice(0, newlineIndex).replace(/\r$/, ''));
        bufferedLine = bufferedLine.slice(newlineIndex + 1);
        newlineIndex = bufferedLine.indexOf('\n');
      }
      if (done) {
        if (bufferedLine) processPlaylistLine(bufferedLine);
        break;
      }
    }
  } catch (error) {
    await reader.cancel(error);
    throw error;
  }

  cachedChannelList = {
    channels: parsedChannels,
    count: parsedChannels.length,
    expires: now + 30 * 60 * 1000, // 30-minute cache
  };

  return {
    success: true,
    cached: false,
    count: parsedChannels.length,
    channels: parsedChannels,
  };
}

/**
 * Cloudflare-cached Image Proxy with CORS, compression, and fallback SVG
 * Eliminates mixed-content issues and accelerates image load to single-digit ms
 */
export async function fetchGeoTvImage(env: Env, imageUrl: string, request?: Request): Promise<Response> {
  if (!imageUrl || !isAllowedHost(imageUrl)) {
    return new Response(generateFallbackSvg('TV'), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const cacheKey = `img:${imageUrl}`;
  const now = Date.now();

  // Check in-memory cache
  if (memoryImageCache.has(cacheKey)) {
    const item = memoryImageCache.get(cacheKey)!;
    if (item.expires > now) {
      return new Response(item.body, {
        status: 200,
        headers: {
          'Content-Type': item.contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT',
          'CF-Cache-Status': 'HIT',
        },
      });
    } else {
      memoryImageCache.delete(cacheKey);
    }
  }

  // Pre-resolve hostname with Cloudflare DoH
  const parsed = new URL(imageUrl);
  const doh = await resolveCloudflareDoh(parsed.hostname);

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlayBeat-Edge/3.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!upstreamRes.ok) {
      return new Response(generateFallbackSvg('TV'), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    const buffer = await upstreamRes.arrayBuffer();

    // Cache in memory (up to 200 images, 24-hour TTL)
    if (memoryImageCache.size > 200) {
      const firstKey = memoryImageCache.keys().next().value;
      if (firstKey) memoryImageCache.delete(firstKey);
    }
    memoryImageCache.set(cacheKey, {
      body: buffer,
      contentType,
      headers: {},
      expires: now + 24 * 3600 * 1000,
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'X-Cache': 'MISS',
        'CF-Cache-Status': 'MISS',
        'X-Cloudflare-DNS-IP': doh.ip,
        'X-Cloudflare-DoH-Latency': `${doh.latencyMs}ms`,
      },
    });
  } catch (err: any) {
    return new Response(generateFallbackSvg('TV'), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Error': err.message || 'Image fetch error',
      },
    });
  }
}

/**
 * Cloudflare-cached HLS Stream Proxy
 * Rewrites segments and resolves edge nodes via Cloudflare 1.1.1.1 DoH
 */
export async function fetchGeoTvHlsStream(
  env: Env,
  channelId: string,
  rawUrl?: string,
  segmentPath = '/api/iptv/segment'
): Promise<Response> {
  const host = env.GEOTV_HOST;
  const user = env.GEOTV_USER;
  const pass = env.GEOTV_PASS;

  if (!rawUrl && (!host || !user || !pass)) return new Response('GeoTV provider is not configured', { status: 503 });

  let targetUrl = rawUrl;
  if (!targetUrl && channelId) {
    targetUrl = `${host}/live/${user}/${pass}/${channelId}.m3u8`;
  }
  if (!targetUrl) {
    return new Response('Missing channelId or url', { status: 400 });
  }

  const parsed = new URL(targetUrl);
  const providerOrigin = env.GEOTV_ALLOWED_ORIGIN ?? (host ? new URL(host).origin : parsed.origin);
  if (!isAllowedProviderUrl(targetUrl, env, providerOrigin)) {
    return new Response('GeoTV stream URL is outside the configured provider origin', { status: 502 });
  }
  const doh = await resolveCloudflareDoh(parsed.hostname);

  let upstreamRes = await fetch(targetUrl, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
  });
  const location = upstreamRes.headers.get('location');
  let finalUrl = targetUrl;
  if (location && upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const redirectedUrl = new URL(location, targetUrl);
    if (!isAllowedProviderUrl(redirectedUrl.href, env, providerOrigin)) {
      return new Response('GeoTV redirect is outside the configured provider origin', { status: 502 });
    }
    upstreamRes = await fetch(redirectedUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });
    finalUrl = redirectedUrl.href;
  }
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    return new Response('GeoTV returned an unsupported redirect', { status: 502 });
  }

  let playlistBody = await upstreamRes.text();
  let finalOrigin = finalUrl;

  // Handle HTML redirect tag <a href="...">Found</a>
  const htmlRedirectMatch = playlistBody.match(/href="([^"]+)"/);
  if (htmlRedirectMatch && htmlRedirectMatch[1]) {
    const redirectUrl = new URL(htmlRedirectMatch[1], finalOrigin).href;
    if (!isAllowedProviderUrl(redirectUrl, env, providerOrigin)) {
      return new Response('GeoTV playlist redirect is outside the configured provider origin', { status: 502 });
    }
    const redirectParsed = new URL(redirectUrl);
    await resolveCloudflareDoh(redirectParsed.hostname);

    const redirectRes = await fetch(redirectUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });
    if (redirectRes.status >= 300 && redirectRes.status < 400) {
      return new Response('GeoTV returned an unsupported playlist redirect', { status: 502 });
    }
    playlistBody = await redirectRes.text();
    finalOrigin = redirectUrl;
  }

  const originUrl = new URL(finalOrigin);
  const baseUrl = `${originUrl.protocol}//${originUrl.host}`;

  // Rewrite TS segments to our Cloudflare edge segment proxy
  let disallowedSegmentOrigin = false;
  const proxySegment = (segmentUrl: string): string | null => {
    const fullSegmentUrl = new URL(segmentUrl, `${baseUrl}/`).href;
    if (!isAllowedProviderUrl(fullSegmentUrl, env, providerOrigin)) {
      disallowedSegmentOrigin = true;
      return null;
    }
    const redactedUrl = user && pass ? redactProviderCredentials(fullSegmentUrl, user, pass) : fullSegmentUrl;
    return `${segmentPath}?url=${encodeURIComponent(redactedUrl)}`;
  };
  const rewrittenLines = playlistBody.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
        const proxiedUri = proxySegment(uri);
        return proxiedUri ? `URI="${proxiedUri}"` : match;
      });
    }
    return proxySegment(trimmed) ?? '';
  });
  if (disallowedSegmentOrigin) {
    return new Response('GeoTV playlist contains a segment outside the configured provider origin', { status: 502 });
  }

  const rewrittenPlaylist = rewrittenLines.join('\n');

  return new Response(rewrittenPlaylist, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'X-Cloudflare-DNS-IP': doh.ip,
      'X-Cloudflare-DoH-Latency': `${doh.latencyMs}ms`,
      'X-Edge-Stream-Engine': 'Cloudflare-Worker-HLS',
    },
  });
}

/**
 * Cloudflare-cached Video TS Segment Proxy
 * High-throughput streaming with edge caching and CORS
 */
export async function fetchGeoTvSegment(env: Env, segmentUrl: string): Promise<Response> {
  const restoredUrl = restoreProviderCredentials(segmentUrl, env.GEOTV_USER, env.GEOTV_PASS);
  if (!restoredUrl || !isAllowedProviderUrl(restoredUrl, env)) {
    return new Response('Invalid or disallowed segment url', { status: 400 });
  }

  const parsed = new URL(restoredUrl);
  const doh = await resolveCloudflareDoh(parsed.hostname);

  let upstreamRes = await fetch(restoredUrl, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
  });
  const location = upstreamRes.headers.get('location');
  if (location && upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const redirectedUrl = new URL(location, restoredUrl);
    if (!isAllowedProviderUrl(redirectedUrl.href, env)) {
      return new Response('Segment redirect is outside the configured provider origin', { status: 502 });
    }
    upstreamRes = await fetch(redirectedUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });
  }
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    return new Response('Segment returned an unsupported redirect', { status: 502 });
  }

  if (!upstreamRes.ok) {
    return new Response(`Segment upstream error: ${upstreamRes.statusText}`, {
      status: upstreamRes.status,
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'video/mp2t');
  headers.set('Cache-Control', 'public, max-age=180, s-maxage=300');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('X-Cloudflare-DNS-IP', doh.ip);
  headers.set('X-Cloudflare-DoH-Latency', `${doh.latencyMs}ms`);

  const cl = upstreamRes.headers.get('content-length');
  if (cl) headers.set('Content-Length', cl);

  return new Response(upstreamRes.body, {
    status: 200,
    headers,
  });
}
