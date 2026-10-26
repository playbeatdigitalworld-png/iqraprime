import type { Env } from './env';

interface ChannelRow {
  stream_id: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === '/broadcast/health') {
      return withCors(Response.json({ status: 'ok', service: 'playbeat-broadcast' }));
    }

    if (request.method !== 'GET') {
      return withCors(new Response('Method not allowed', { status: 405 }));
    }

    if (url.pathname === '/broadcast/api/iptv/hls/stream.m3u8') {
      if (!env.CATALOG_DB) {
        return withCors(new Response('Channel catalog storage is not configured', { status: 503 }));
      }

      const channelId = url.searchParams.get('channelId') || '';
      if (!/^(?:geo_)?\d{1,18}$/.test(channelId)) {
        return withCors(new Response('Invalid channelId', { status: 400 }));
      }

      try {
        const channel = await env.CATALOG_DB
          .prepare('SELECT stream_id FROM catalog_channels WHERE channel_id = ?1 OR stream_id = ?2 LIMIT 1')
          .bind(channelId, channelId.replace(/^geo_/, ''))
          .first<ChannelRow>();

        if (!channel) {
          return withCors(new Response('Channel not found in catalog', { status: 404 }));
        }

        if (!env.CATALOG) {
          return withCors(new Response('Catalog Worker service binding is not configured', { status: 503 }));
        }
        const catalogRequest = new Request(
          `https://catalog.internal/api/iptv/hls/stream.m3u8?channelId=${encodeURIComponent(channel.stream_id)}`
        );
        return withCors(await env.CATALOG.fetch(catalogRequest));
      } catch (error) {
        console.error('[Broadcast HLS] stream request failed:', error instanceof Error ? error.name : 'Unknown error');
        return withCors(new Response('Stream is temporarily unavailable', { status: 502 }));
      }
    }

    if (url.pathname === '/broadcast/api/iptv/segment') {
      const segmentUrl = url.searchParams.get('url') || '';
      if (!segmentUrl) {
        return withCors(new Response('Missing segment URL', { status: 400 }));
      }
      if (!env.CATALOG) {
        return withCors(new Response('Catalog Worker service binding is not configured', { status: 503 }));
      }
      const segmentRequest = new Request(
        `https://catalog.internal/api/iptv/segment?url=${encodeURIComponent(segmentUrl)}`
      );
      return withCors(await env.CATALOG.fetch(segmentRequest));
    }

    return withCors(new Response('Not found', { status: 404 }));
  },
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
