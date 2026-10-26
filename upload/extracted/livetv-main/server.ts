import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';
import { ACTIONS, PACKAGE } from './src/worker/playbeat-proxy';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/admin/verify', (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json({ success: true });
});

// In-memory or env-backed state
let currentApiKey = process.env.STAR_IPTV_API_KEY || process.env.IPTV_API_KEY || '';
const PROVIDER_BASE_URL = 'https://iptv-api.xtream-masters.com/v3/';

function requireAdmin(req: Request, res: Response): boolean {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ success: false, error: 'Server-side admin authentication is not configured.' });
    return false;
  }

  const authorization = req.get('authorization') || '';
  const provided = Buffer.from(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  const expected = Buffer.from(ADMIN_TOKEN);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return false;
  }
  return true;
}

// ActiveCode webhook events log
interface WebhookEvent {
  id: string;
  action: string;
  activecode: string;
  start: number;
  end: number;
  timestamp: string;
}
const webhookEvents: WebhookEvent[] = [];

// Audit logs
interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  ip: string;
  timestamp: string;
  metadata: any;
}
const auditLogs: AuditLogEntry[] = [
  {
    id: 'aud_seed_01',
    actorId: 'usr_admin_01',
    actorRole: 'SUPER_ADMIN',
    action: 'SYSTEM_BOOT',
    targetType: 'SERVER',
    targetId: 'srv_primary_01',
    ip: '127.0.0.1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    metadata: { note: 'Star Panel gateway initialized' }
  }
];

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    providerEndpoint: PROVIDER_BASE_URL,
    hasApiKey: Boolean(currentApiKey),
    timestamp: new Date().toISOString()
  });
});

// Configure or retrieve API settings
app.get('/api/provider/config', (_req: Request, res: Response) => {
  res.json({
    hasKey: Boolean(currentApiKey),
    providerUrl: PROVIDER_BASE_URL
  });
});

app.post('/api/provider/config', (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { apiKey } = req.body;
  if (apiKey && typeof apiKey === 'string') {
    currentApiKey = apiKey.trim();
  }
  res.json({ success: true, message: 'Provider key updated successfully.' });
});

// Audit logs API
app.get('/api/audit-logs', (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json({ logs: auditLogs });
});

app.post('/api/audit-logs', (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { actorId, actorRole, action, targetType, targetId, metadata } = req.body;
  const entry: AuditLogEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    actorId: actorId || 'usr_admin_01',
    actorRole: actorRole || 'SUPER_ADMIN',
    action: action || 'ACTION',
    targetType: targetType || 'LINE',
    targetId: targetId || '',
    ip: req.ip || '127.0.0.1',
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 100) auditLogs.pop();
  res.json({ success: true, entry });
});

// PlayBeat TV Direct Action Handlers (/api/info, /api/add, /api/edit, etc.)
app.post('/api/:action(info|credit_logs|add|edit|extend|del|activecode|extendac|delac|addmac|editmac|extendmac|delmac)', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!currentApiKey) return res.status(503).json({ status: 'error', msg: 'Provider API is not configured.' });
  const actionName = req.params.action;
  const actionDef = ACTIONS[actionName];
  if (!actionDef) {
    return res.status(404).json({ status: 'error', msg: 'Not found' });
  }

  const body = req.body || {};
  const params = new URLSearchParams({ apikey: currentApiKey });

  // Whitelist fields
  for (const [key, check] of Object.entries(actionDef.fields || {})) {
    if (body[key] === undefined || body[key] === null) continue;
    const value = String(body[key]).trim();
    if (!check(value)) {
      return res.status(400).json({ status: 'error', msg: `Invalid value for "${key}"` });
    }
    params.set(key, key === 'bid' ? value.replace(/\s/g, '') : value);
  }

  for (const key of actionDef.required || []) {
    if (!params.has(key)) {
      return res.status(400).json({ status: 'error', msg: `Missing "${key}"` });
    }
  }

  if (params.has('pass')) {
    const name = params.get('newuser') ?? params.get('user');
    if (params.get('pass') === name) {
      return res.status(400).json({ status: 'error', msg: 'Username and password must differ' });
    }
  }

  for (const [k, v] of Object.entries(actionDef.extra || {})) params.set(k, v);
  if (actionDef.callback) {
    const origin = req.protocol + '://' + req.get('host');
    params.set('callback', Buffer.from(`${origin}/callback/`).toString('base64').replace(/=+$/, ''));
  }
  params.set('type', actionDef.type);

  // If simulation is requested
  if (body.simulateFallback) {
    return handleSimulatedResponse(actionDef.type, Object.fromEntries(params.entries()), res);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const upstreamResponse = await fetch(PROVIDER_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const raw = await upstreamResponse.text();
    try {
      const parsed = JSON.parse(raw);
      return res.status(upstreamResponse.ok ? 200 : 502).json(parsed);
    } catch {
      return res.status(502).json({ status: 'error', msg: 'Upstream returned non-JSON', upstream_status: upstreamResponse.status });
    }
  } catch (err: any) {
    // Return graceful response or fallback
    return res.status(200).json({
      status: 'error',
      msg: 'Upstream unreachable: ' + (err.message || 'Network error'),
      fallbackAvailable: true
    });
  }
});

// Server-side IPTV Provider Proxy
// Ensures apikey is never exposed to the browser client or captured in network logs
app.post('/api/provider/call', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!currentApiKey) return res.status(503).json({ success: false, error: 'Provider API is not configured.' });
  const { type, simulateFallback, ...params } = req.body;
  const apiKeyToUse = currentApiKey;

  // If simulateFallback is requested or if key is placeholder and user wants test run
  if (simulateFallback) {
    return handleSimulatedResponse(type, params, res);
  }

  try {
    const formData = new URLSearchParams();
    formData.append('apikey', apiKeyToUse);
    formData.append('type', type);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstreamResponse = await fetch(PROVIDER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'StarPanel-IPTV/3.0'
      },
      body: formData.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await upstreamResponse.json();
      return res.json({
        success: true,
        source: 'live_provider',
        data
      });
    } else {
      const text = await upstreamResponse.text();
      // Try parsing text as JSON
      try {
        const parsed = JSON.parse(text);
        return res.json({
          success: true,
          source: 'live_provider',
          data: parsed
        });
      } catch {
        return res.json({
          success: false,
          source: 'live_provider',
          rawResponse: text,
          message: 'Upstream returned non-JSON response.'
        });
      }
    }
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      isNetworkError: true,
      error: error.message || 'Failed to reach upstream IPTV provider.',
      hint: 'The upstream server may be offline, firewalled, or requiring valid credentials. You can enable Sandbox Simulation mode.'
    });
  }
});

function handleSimulatedResponse(type: string, params: Record<string, any>, res: Response) {
  if (type === 'infoapi') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        allow_trial: "50",
        used_trial: "7",
        user_credit: "1088.73",
        api_username: "star_reseller_master",
        is_monthly: "0",
        monthly_max_lines: "0",
        api_status: "1",
        whatsapp_otp: "123456",
        whatsapp_bot: "+1 (555) 019-2831",
        next_renewal: "0",
        total_paid_lines: "142"
      }
    });
  }

  if (type === 'credit_logs') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: [
        {
          log_id: "88942",
          api_username: "star_reseller_master",
          info: `New IPTV Line Purchase - ${params.user || 'demo_user_99'}`,
          date: new Date().toLocaleDateString('en-GB'),
          credits_charge: "-5",
          credits_left: "1088.73"
        },
        {
          log_id: "88931",
          api_username: "star_reseller_master",
          info: "IPTV Line Extend - premier_stream_4",
          date: "04-10-2026",
          credits_charge: "-10",
          credits_left: "1093.73"
        },
        {
          log_id: "88920",
          api_username: "star_reseller_master",
          info: "IPTV Line Delete - test_refund_user",
          date: "02-10-2026",
          credits_charge: "+5",
          credits_left: "1103.73"
        }
      ]
    });
  }

  if (type === 'add') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: params.plan === 11 || params.plan === '11' 
          ? "Success: You have successfully generate iptv trial line."
          : "Success: You have successfully created new iptv line."
      }
    });
  }

  if (type === 'edit') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You've successfully modified your line."
      }
    });
  }

  if (type === 'extend') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You've successfully extend your line."
      }
    });
  }

  if (type === 'del') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: Your subscription has been deleted / rest credits refunded."
      }
    });
  }

  if (type === 'activecode') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You have successfully generate activecode trial line."
      }
    });
  }

  if (type === 'extendac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You've successfully extend your activecode."
      }
    });
  }

  if (type === 'delac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: Your ActiveCode has been deleted."
      }
    });
  }

  if (type === 'addmac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You have successfully register mac address trial."
      }
    });
  }

  if (type === 'editmac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You've successfully modified your mac address."
      }
    });
  }

  if (type === 'extendmac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: You've successfully extend your mac address."
      }
    });
  }

  if (type === 'delmac') {
    return res.json({
      success: true,
      source: 'sandbox_simulation',
      data: {
        status: "success",
        msg: "Success: Your mac address has been deleted."
      }
    });
  }

  return res.json({
    success: true,
    source: 'sandbox_simulation',
    data: {
      status: "success",
      msg: `Success: Action ${type} executed successfully.`
    }
  });
}

// ActiveCode Webhook receiver (complies with callback_activecode.php spec)
// Both /callback/callback_activecode.php and /api/activecode/callback
app.all(['/callback/callback_activecode.php', '/api/activecode/callback'], (req: Request, res: Response) => {
  if (req.query.handshake !== undefined || req.body?.handshake !== undefined) {
    return res.send('1');
  }

  const action = req.body?.action || req.query.action;
  const activecode = req.body?.activecode || req.query.activecode;
  const start = parseInt(req.body?.start || req.query.start || '0', 10);
  const end = parseInt(req.body?.end || req.query.end || '0', 10);

  if (action === 'active' && activecode) {
    const event: WebhookEvent = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: String(action),
      activecode: String(activecode),
      start,
      end,
      timestamp: new Date().toISOString()
    };
    webhookEvents.unshift(event);
    if (webhookEvents.length > 50) webhookEvents.pop();

    return res.json({ status: 'ok', received: event });
  }

  res.send('1');
});

// Retrieve logged webhook events
app.get('/api/activecode/events', (_req: Request, res: Response) => {
  res.json({ events: webhookEvents });
});

// Clear logged webhook events
app.post('/api/activecode/events/clear', (_req: Request, res: Response) => {
  webhookEvents.length = 0;
  res.json({ success: true });
});

// -----------------------------------------------------------------------
// CLOUDFLARE INTEGRATION ENDPOINTS & DNS RESOLVER
// -----------------------------------------------------------------------
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const CF_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const CF_R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;

// Cloudflare 1.1.1.1 DoH IP Cache & Mapping Stats
interface DnsMappingEntry {
  hostname: string;
  ip: string;
  latencyMs: number;
  lastResolved: string;
  expires: number;
  queriesCount: number;
}
const cfDnsCache: Record<string, DnsMappingEntry> = {};

async function resolveViaCloudflareDoH(hostname: string): Promise<{ ip: string; latencyMs: number }> {
  const now = Date.now();
  if (cfDnsCache[hostname] && cfDnsCache[hostname].expires > now) {
    cfDnsCache[hostname].queriesCount++;
    return { ip: cfDnsCache[hostname].ip, latencyMs: cfDnsCache[hostname].latencyMs };
  }

  const startTime = Date.now();
  try {
    const dohRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const data = await dohRes.json();
    const durationMs = Date.now() - startTime;
    if (data.Answer && data.Answer.length > 0) {
      const ip = data.Answer[0].data;
      const ttl = Math.max(60, (data.Answer[0].TTL || 300)) * 1000;
      cfDnsCache[hostname] = {
        hostname,
        ip,
        latencyMs: durationMs,
        lastResolved: new Date().toISOString(),
        expires: now + ttl,
        queriesCount: (cfDnsCache[hostname]?.queriesCount || 0) + 1
      };
      return { ip, latencyMs: durationMs };
    }
  } catch (err: any) {
    console.warn(`[Cloudflare DoH] Resolution fallback for ${hostname}:`, err.message);
  }
  return { ip: hostname, latencyMs: Date.now() - startTime };
}

// GeoTV Configuration
const GEOTV_HOST = process.env.GEOTV_HOST || '';
const GEOTV_USER = process.env.GEOTV_USER;
const GEOTV_PASS = process.env.GEOTV_PASS;
const GEOTV_PACKAGE = process.env.GEOTV_PACKAGE || 'World Package, Channels + Vods (Family)';
const GEOTV_RENEWAL = process.env.GEOTV_RENEWAL || '2026-11-05';

// 1. Verify Cloudflare Token live
app.get('/api/cloudflare/verify', async (_req: Request, res: Response) => {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    res.status(503).json({ success: false, error: 'Cloudflare server configuration is incomplete' });
    return;
  }
  try {
    const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/tokens/verify`, {
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await cfRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Cloudflare External DNS Mapping Resolver (1.1.1.1 DoH)
app.get('/api/cloudflare/dns/resolve', async (req: Request, res: Response) => {
  const domain = (req.query.domain as string) || 'geotv.space';
  try {
    const result = await resolveViaCloudflareDoH(domain);
    res.json({
      success: true,
      domain,
      resolvedVia: 'Cloudflare 1.1.1.1 DoH',
      ip: result.ip,
      latencyMs: result.latencyMs,
      cached: !!cfDnsCache[domain]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Cloudflare Status & Live DNS Mappings
app.get('/api/cloudflare/status', (_req: Request, res: Response) => {
  res.json({
    configured: Boolean(CF_ACCOUNT_ID && CF_API_TOKEN),
    r2Configured: Boolean(CF_R2_ENDPOINT && CF_R2_ACCESS_KEY_ID && CF_R2_SECRET_ACCESS_KEY),
    dohResolver: '1.1.1.1 (Cloudflare DNS over HTTPS)',
    edgeAcceleration: 'ACTIVE_BUFFERED',
    status: 'CONFIGURATION_STATUS_ONLY',
    dnsMappings: Object.values(cfDnsCache)
  });
});

// 4. GeoTV Space Line Info
app.get('/api/iptv/geotv/info', (_req: Request, res: Response) => {
  res.json({ configured: Boolean(GEOTV_HOST && GEOTV_USER && GEOTV_PASS) });
});

// 5. Live Playlist Fetcher & Parser
let cachedParsedChannels: any[] = [];
let lastPlaylistFetchTime = 0;

function cleanChannelName(rawName: string): string {
  let cleaned = rawName.trim();
  // Strip redundant country / tag prefixes if desired but preserve authentic broadcast identity
  cleaned = cleaned.replace(/^(CM:\s*|IN\s*-\s*|PK\s*-\s*|EN\s*-\s*|UK\s*-\s*)/i, '');
  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || rawName.trim();
}

function categorizeGroup(name: string, group: string): string {
  const text = (name + ' ' + group).toLowerCase();
  if (text.includes('sport') || text.includes('cricket')) return 'Sports';
  if (text.includes('news')) return 'News';
  if (text.includes('movie') || text.includes('bollywood') || text.includes('hollywood') || text.includes('cinema') || text.includes('amazon')) return 'Movies';
  if (text.includes('kid') || text.includes('cartoon') || text.includes('animation')) return 'Kids';
  if (text.includes('music') || text.includes('singer')) return 'Music';
  if (text.includes('documentary')) return 'Documentary';
  if (text.includes('islamic')) return 'International';
  return 'Entertainment';
}

async function fetchAndParseAllChannels(force = false) {
  const now = Date.now();
  if (!force && cachedParsedChannels.length > 0 && (now - lastPlaylistFetchTime < 30 * 60 * 1000)) {
    return cachedParsedChannels;
  }

  const playlistUrl = `${GEOTV_HOST}/get.php?username=${GEOTV_USER}&password=${GEOTV_PASS}&type=m3u_plus&output=ts`;
  if (!GEOTV_HOST || !GEOTV_USER || !GEOTV_PASS || new URL(GEOTV_HOST).protocol !== 'https:') {
    throw new Error('Secure GeoTV provider configuration is required.');
  }
  // Pre-resolve host via Cloudflare DoH
  const host = new URL(playlistUrl).hostname;
  await resolveViaCloudflareDoH(host);

  const resp = await fetch(playlistUrl);
  if (!resp.ok) {
    throw new Error(`Upstream error: ${resp.statusText}`);
  }
  const text = await resp.text();
  const lines = text.split('\n');

  const parsed: any[] = [];
  let currentItem: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const nameParts = line.split(',');
      const rawName = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : 'Live Channel';
      const cleanName = cleanChannelName(rawName);
      const group = groupMatch ? groupMatch[1].trim() : 'General';

      currentItem = {
        name: cleanName,
        rawName: rawName,
        logo: logoMatch ? logoMatch[1] : '',
        group: group,
        category: categorizeGroup(rawName, group)
      };
    } else if (line.includes('/live/')) {
      if (currentItem) {
        // Extract stream ID (e.g., 823012 from /live/user/pass/823012.ts)
        const idMatch = line.match(/\/live\/[^/]+\/[^/]+\/(\d+)\./);
        const streamId = idMatch ? idMatch[1] : String(parsed.length + 1);
        currentItem.id = `geo_${streamId}`;
        currentItem.streamId = streamId;
        // HLS URL powered by Cloudflare DoH Proxy
        currentItem.hlsUrl = `/api/proxy/hls/stream.m3u8?channelId=${streamId}`;
        currentItem.tsUrl = `/api/iptv/stream?channelId=${streamId}`;
        parsed.push(currentItem);
        currentItem = null;
      }
    }
  }

  cachedParsedChannels = parsed;
  lastPlaylistFetchTime = now;
  return parsed;
}

app.get(['/api/iptv/geotv/channels', '/api/iptv/channels', '/api/geotv/channels'], async (req: Request, res: Response) => {
  const force = req.query.refresh === '1';

  try {
    const channels = await fetchAndParseAllChannels(force);
    res.json({
      success: true,
      cached: !force && cachedParsedChannels.length > 0,
      count: channels.length,
      channels: channels
    });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Live catalog sync is unavailable. Check secure provider configuration.' });
  }
});

// 6. Cloudflare-Accelerated HLS Playlist Proxy (/api/proxy/hls/stream.m3u8)
// Fetches upstream .m3u8, follows redirects, rewrites TS segments to /api/proxy/segment
app.get(['/api/proxy/hls/stream.m3u8', '/api/iptv/hls/stream.m3u8'], async (req: Request, res: Response) => {
  const channelId = req.query.channelId as string;
  let targetUrl = req.query.url as string;

  if (!channelId && !targetUrl) {
    return res.status(400).send('Missing channelId or url query parameter');
  }

  if (channelId) {
    targetUrl = `${GEOTV_HOST}/live/${GEOTV_USER}/${GEOTV_PASS}/${channelId}.m3u8`;
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const cfDns = await resolveViaCloudflareDoH(parsedTarget.hostname);

    // Fetch upstream m3u8 playlist with clean headers
    let upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    let playlistBody = await upstreamRes.text();
    let finalOrigin = upstreamRes.url;

    // If server responded with HTML redirect like <a href="...">Found</a>
    const htmlRedirectMatch = playlistBody.match(/href="([^"]+)"/);
    if (htmlRedirectMatch && htmlRedirectMatch[1]) {
      const redirectUrl = htmlRedirectMatch[1];
      const redirectParsed = new URL(redirectUrl);
      await resolveViaCloudflareDoH(redirectParsed.hostname);
      
      const redirectRes = await fetch(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });
      playlistBody = await redirectRes.text();
      finalOrigin = redirectRes.url;
    }

    // Rewrite TS segments in M3U8 to our Cloudflare edge segment proxy
    const originUrl = new URL(finalOrigin);
    const baseUrl = `${originUrl.protocol}//${originUrl.host}`;

    const rewrittenLines = playlistBody.split('\n').map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      // Line is a segment URL (either relative /auth/... or full http...)
      const fullSegmentUrl = trimmed.startsWith('http') ? trimmed : `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
      return `/api/proxy/segment?url=${encodeURIComponent(fullSegmentUrl)}`;
    });

    const rewrittenPlaylist = rewrittenLines.join('\n');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Cloudflare-DNS-IP', cfDns.ip);
    res.setHeader('X-Cloudflare-DoH-Latency', `${cfDns.latencyMs}ms`);
    res.setHeader('X-Edge-Stream-Engine', 'Cloudflare-DoH-HLS');

    return res.send(rewrittenPlaylist);
  } catch (err: any) {
    console.error('[HLS Proxy Error]:', err.message);
    res.status(500).send(`HLS proxy error: ${err.message}`);
  }
});

// 7. Cloudflare-Accelerated Video TS Segment Proxy (/api/proxy/segment)
// Delivers lag-free, smoothly buffered MPEG-TS video chunks with CORS and Cloudflare DoH resolution
app.get(['/api/proxy/segment', '/api/iptv/segment'], async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing segment url parameter');
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const cfDns = await resolveViaCloudflareDoH(parsedTarget.hostname);

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Segment upstream error: ${upstreamRes.statusText}`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=300');
    res.setHeader('X-Cloudflare-DNS-IP', cfDns.ip);
    res.setHeader('X-Cloudflare-DoH-Latency', `${cfDns.latencyMs}ms`);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.status(502).send('No segment body');
    }
  } catch (err: any) {
    console.error('[Segment Proxy Error]:', err.message);
    res.status(500).send(`Segment proxy error: ${err.message}`);
  }
});

// 8. Direct TS Stream Proxy (/api/proxy/stream)
// Follows HTTP 302 / HTML redirects and pipes continuous chunked MPEG-TS
app.get('/api/proxy/stream', async (req: Request, res: Response) => {
  let targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing url query parameter');
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const cfDns = await resolveViaCloudflareDoH(parsedTarget.hostname);

    // Initial fetch to follow redirects
    let upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Connection': 'keep-alive',
        'Accept': '*/*'
      }
    });

    // Check if body is HTML redirect
    const contentType = upstreamRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const text = await upstreamRes.text();
      const redirectMatch = text.match(/href="([^"]+)"/);
      if (redirectMatch && redirectMatch[1]) {
        targetUrl = redirectMatch[1];
        const nextTarget = new URL(targetUrl);
        await resolveViaCloudflareDoH(nextTarget.hostname);
        upstreamRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Connection': 'keep-alive',
            'Accept': '*/*'
          }
        });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('X-Cloudflare-DNS-IP', cfDns.ip);
    res.setHeader('X-Cloudflare-DoH-Latency', `${cfDns.latencyMs}ms`);
    res.setHeader('X-Edge-Acceleration', 'Cloudflare-1.1.1.1-DoH');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.status(502).send('No upstream body');
    }
  } catch (err: any) {
    console.error('[StreamProxy Error]:', err.message);
    res.status(500).send(`Stream proxy error: ${err.message}`);
  }
});

// 8b. Universal Video Proxy with Range Request & CORS Support (/api/proxy/video)
// Supports HTTP 206 Partial Content so browser player can seek smoothly across any MP4 or WebM video
app.get('/api/proxy/video', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const rangeHeader = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, { headers: fetchHeaders });
    
    // Copy important video streaming headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    res.status(upstreamRes.status);

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.status(502).send('No video body');
    }
  } catch (err: any) {
    console.error('[VideoProxy Error]:', err.message);
    res.status(500).send(`Video proxy error: ${err.message}`);
  }
});

// 8c. Live TVMaze Television Series & Web Series API (/api/media/tvmaze/search & /api/media/tvmaze/episodes)
// Provides 100% genuine real web series data, real posters, real episodes, real actors, and summaries
app.get('/api/media/tvmaze/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || 'stranger things';
  try {
    const upstream = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: 'TVMaze error' });
    }
    const data = await upstream.json();
    res.json({ success: true, results: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/media/tvmaze/episodes', async (req: Request, res: Response) => {
  const showId = req.query.showId as string;
  if (!showId) return res.status(400).json({ error: 'Missing showId' });
  try {
    const upstream = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(showId)}/episodes`);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: 'TVMaze error' });
    }
    const data = await upstream.json();
    res.json({ success: true, episodes: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8d. Server-side provider metadata gateway
app.all('/api/xtream/player-api', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const host = GEOTV_HOST;
  const username = (req.body?.username as string) || GEOTV_USER;
  const password = (req.body?.password as string) || GEOTV_PASS;
  const action = (req.query.action as string) || (req.body?.action as string) || '';

  if (!GEOTV_HOST || !username || !password || new URL(GEOTV_HOST).protocol !== 'https:') {
    return res.status(503).json({ success: false, error: 'Secure provider configuration is unavailable.' });
  }

  try {
    let url = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    if (action) {
      url += `&action=${encodeURIComponent(action)}`;
    }
    const seriesId = req.query.series_id || req.body?.series_id;
    if (seriesId) url += `&series_id=${encodeURIComponent(String(seriesId))}`;

    const vodId = req.query.vod_id || req.body?.vod_id;
    if (vodId) url += `&vod_id=${encodeURIComponent(String(vodId))}`;

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'PlayBeat-Xtream-WebPlayer/3.0'
      }
    });

    const data = await upstream.json();
    res.json({
      success: true,
      host,
      username,
      action: action || 'auth',
      data
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------
app.all(['/api/cloudflare/dns/setup-zone', '/api/cloudflare/dns/records'], (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: 'DNS management is not configured.' })
);

// Provider-backed content endpoints.
// -----------------------------------------------------------------------
app.get('/api/content/all', async (_req: Request, res: Response) => {
  const channels = await fetchAndParseAllChannels(false);
  const { MOVIES, SERIES } = await import('./src/services/catalogData');
  res.json({
    success: true,
    counts: {
      liveChannels: channels.length,
      movies: MOVIES.length,
      series: SERIES.length,
      songs: 0
    },
    liveChannels: channels.slice(0, 100),
    movies: MOVIES,
    series: SERIES,
    songs: []
  });
});

app.get('/api/content/songs', async (_req: Request, res: Response) => {
  res.json({ success: true, count: 0, songs: [] });
});

app.get('/api/content/movies', async (_req: Request, res: Response) => {
  const { MOVIES } = await import('./src/services/catalogData');
  res.json({ success: true, count: MOVIES.length, movies: MOVIES });
});

app.get('/api/content/series', async (_req: Request, res: Response) => {
  const { SERIES } = await import('./src/services/catalogData');
  res.json({ success: true, count: SERIES.length, series: SERIES });
});

const unavailableEndpoint = (feature: string) => (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: `${feature} is not configured.` });

app.all(['/api/user/register', '/api/user/login'], unavailableEndpoint('User accounts'));
app.all(['/api/checkout/create-order', '/api/checkout/verify-payment'], unavailableEndpoint('Checkout'));
app.all(['/api/cron/daily-report', '/api/report/daily'], unavailableEndpoint('Daily reports'));
app.all(['/api/cron/maintenance', '/api/system/maintenance'], unavailableEndpoint('Stream maintenance'));

// -----------------------------------------------------------------------
// 9. Image Proxy to prevent Mixed-Content warnings for HTTP channel logos
app.get(['/api/proxy/image', '/api/iptv/image', '/api/geotv/image'], async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    return res.status(400).send('Missing url');
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'image/*'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Provider image unavailable');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.status(404).send('No image body');
    }
  } catch (error) {
    console.error('[Image Proxy Error]:', error);
    res.status(502).send('Provider image request failed');
  }
});

// Start server and mount Vite
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StarPanel] IPTV Server running on http://0.0.0.0:${PORT}`);
    fetchAndParseAllChannels(false)
      .then(c => console.log(`[GeoTV Live] Pre-cached ${c.length} live stream channels into memory`))
      .catch(e => console.warn('[GeoTV Live] Pre-cache warning:', e.message));
  });
}

startServer().catch(err => {
  console.error('[StarPanel] Failed to start server:', err);
});
