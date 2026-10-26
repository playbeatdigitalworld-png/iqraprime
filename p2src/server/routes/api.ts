/**
 * Aether Stream Master API Router
 * Secure backend API handling authentication, streaming content delivery,
 * Star IPTV reseller operations, subscription management, and takedown procedures.
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db/store.js';
import { starIptvProvider } from '../starIptvProvider.js';
import { memberIptvLineManager, type LineProbeInput } from '../memberIptvLineManager.js';
import { iptvCatalog, type CatalogType } from '../iptvCatalog.js';
import { getCatalogStats, getCatalogHighlights } from '../catalogStats.js';
import { handleStreamRelay, proxiedStreamUrl } from '../streamProxy.js';
import { createCreatorHubRouter } from '../creatorHub/index.js';
import type { Channel, Movie, User } from '../../src/types/index.js';

export const apiRouter = Router();

/**
 * Browser-safe channel serialization: provider stream URLs are HTTP-only and
 * credential-bearing, so they are re-issued as sealed HTTPS relay references
 * (credentials never reach the client). Third-party HTTPS URLs pass through.
 */
function clientSafeChannel(c: Channel): Channel {
  if (c.streamUrl && /^http:\/\//i.test(c.streamUrl)) {
    const hls = c.streamUrl.replace(/\.ts($|\?)/i, '.m3u8$1');
    return { ...c, streamUrl: proxiedStreamUrl(hls, 'manifest') };
  }
  return c;
}

// ==========================================
// 0. IDENTITY & ACCESS HELPERS (server-side binding)
// ==========================================

/**
 * Server-side identity resolution. The ONLY trusted identity sources are:
 *  - the backend pilot session token (`aether_token_<uid>_<ts>`), or
 *  - a Supabase access token verified against the Supabase Auth server.
 * Member data endpoints bind userId to this identity; clients cannot
 * impersonate another member by passing a different userId.
 */
export type AuthIdentity =
  | { kind: 'aether'; userId: string; role: 'admin' | 'customer' }
  | { kind: 'supabase'; userId: string; email: string; role: 'admin' | 'customer' };

const supabaseAuthCache = new Map<string, { identity: AuthIdentity | null; expiresAt: number }>();

/**
 * Platform-admin allowlist check against the Supabase `admin_users` table
 * (provisioned by the Creator Hub migration; service-role read, 60s cached).
 * This makes `requireAdmin` work for owners registered via
 * `insert into public.admin_users ...` even without a legacy Director row.
 */
const platformAdminCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
async function isPlatformAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  const cached = platformAdminCache.get(email);
  if (cached && cached.expiresAt > Date.now()) return cached.isAdmin;
  let isAdmin = false;
  try {
    const { getServiceSupabase } = await import('../db/supabase.js');
    const svc = getServiceSupabase();
    if (svc) {
      const { data } = await svc.from('admin_users').select('user_id').eq('email', email).maybeSingle();
      isAdmin = !!data;
    }
  } catch { /* table missing or transient — fall back to legacy role only */ }
  platformAdminCache.set(email, { isAdmin, expiresAt: Date.now() + 60_000 });
  return isAdmin;
}

async function verifySupabaseToken(token: string): Promise<AuthIdentity | null> {
  const cached = supabaseAuthCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  let identity: AuthIdentity | null = null;
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yxUeNftpgXnveqNoQdmiLQ_GbIRJ492';
    if (supabaseUrl && anonKey) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (res.ok) {
        const u = await res.json().catch(() => null);
        if (u?.id) {
          const email = String(u.email || '').toLowerCase();
          const inDb = Array.from(db.users.values()).find((x) => x.email.toLowerCase() === email);
          const platformAdmin = await isPlatformAdmin(email);
          const role: 'admin' | 'customer' = (inDb?.role === 'admin' || platformAdmin) ? 'admin' : 'customer';
          identity = { kind: 'supabase', userId: inDb ? inDb.id : `sb-${String(u.id).slice(0, 18)}`, email, role };
        }
      }
    }
  } catch {
    identity = null;
  }
  supabaseAuthCache.set(token, { identity, expiresAt: Date.now() + 60_000 });
  return identity;
}

async function resolveAuth(req: Request): Promise<AuthIdentity | null> {
  const header = req.headers.authorization;
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  if (token.startsWith('aether_token_')) {
    const parts = token.split('_');
    const userId = parts[2];
    const user = userId ? db.users.get(userId) : undefined;
    if (!user) return null;
    const status = db.userStatus.get(user.id) || 'active';
    if (status === 'disabled') return null;
    return { kind: 'aether', userId: user.id, role: user.role === 'admin' ? 'admin' : 'customer' };
  }
  return verifySupabaseToken(token);
}

/** Server-side admin gate for /admin/* and IPTV management routes. */
const requireAdmin = async (req: Request, res: Response, next: () => void) => {
  const auth = await resolveAuth(req);
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required. Sign in with a Director account.' });
  }
  (req as unknown as { auth?: AuthIdentity }).auth = auth;
  next();
};

/**
 * Bind member-data operations to the authenticated identity. With a bearer
 * token present, a requested userId that differs from the token user is
 * rejected (403) unless the caller is admin. Anonymous callers keep the
 * legacy default behavior for public pages.
 */
function bindUserId(
  req: Request,
  res: Response,
  requested: string | undefined,
  auth: Awaited<ReturnType<typeof resolveAuth>>,
): string | null {
  if (auth) {
    if (auth.role === 'admin') return requested || auth.userId;
    if (requested && requested !== auth.userId) {
      res.status(403).json({ error: 'Forbidden: member data is bound to your session.' });
      return null;
    }
    return auth.userId;
  }
  return requested || 'usr-customer-01';
}

// Lazy-seed Star IPTV live channels on first API use. Serverless-safe:
// awaited IN-REQUEST (capped) instead of relying on fire-and-forget
// background tasks, which get frozen after the first response.
apiRouter.use(async (req, _res, next) => {
  if (req.path === '/health') return next();
  if (req.path === '/catalog/warm') return next(); // warm path skips provider seeding
  try {
    // Durable line hydration (single-flight; no-op without service key + LINE_VAULT_KEY)
    await memberIptvLineManager.ensureRestored();
    await Promise.race([
      starIptvProvider.ensureSeeded(),
      new Promise((resolve) => setTimeout(resolve, 25000)),
    ]);
  } catch {
    // seeding is best-effort; never block the API
  }
  next();
});

// All /admin/* routes require a server-verified Director identity.
apiRouter.use('/admin', requireAdmin);

// ==========================================
// 1. AUTHENTICATION & PILOT ACCESS GATE
// ==========================================

apiRouter.get('/pilot/settings', (_req: Request, res: Response) => {
  db.recalculatePilotSlots();
  res.json({ settings: db.pilotSettings });
});

apiRouter.post('/pilot/settings', requireAdmin, (req: Request, res: Response) => {
  const { maxPrivateUsers, maxDevicesPerUser, privateMode } = req.body;
  if (maxPrivateUsers !== undefined) {
    db.pilotSettings.maxPrivateUsers = Math.max(1, Number(maxPrivateUsers));
  }
  if (maxDevicesPerUser !== undefined) {
    db.pilotSettings.maxDevicesPerUser = Math.max(1, Number(maxDevicesPerUser));
  }
  if (privateMode !== undefined) {
    db.pilotSettings.privateMode = Boolean(privateMode);
  }
  db.recalculatePilotSlots();
  db.logAdminAction('PILOT_SETTINGS_UPDATE', `Pilot settings updated: maxUsers=${db.pilotSettings.maxPrivateUsers}, maxDevices=${db.pilotSettings.maxDevicesPerUser}`);
  res.json({ success: true, settings: db.pilotSettings });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const storedPassword = db.userPasswords.get(email.toLowerCase().trim());
  const user = Array.from(db.users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user || storedPassword !== password) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Check if member is disabled
  const status = db.userStatus.get(user.id) || 'active';
  if (status === 'disabled') {
    return res.status(403).json({
      error: 'Your private pilot member account has been suspended or disabled by the administrator.',
    });
  }

  // Retrieve user subscription
  const subscription = db.subscriptions.get(user.id);

  // Manage device session limit (maxDevicesPerUser)
  let userDevices = db.devices.get(user.id) || [];
  const maxDev = db.pilotSettings.maxDevicesPerUser || 2;
  const currentBrowser = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser';

  // Check if current device exists, else add
  const hasCurrent = userDevices.some((d) => d.isCurrent);
  if (!hasCurrent) {
    const newDev = {
      id: `dev-${Date.now().toString(36)}`,
      name: `${user.name.split(' ')[0]}'s ${currentBrowser}`,
      deviceType: req.headers['user-agent']?.includes('Mobile') ? ('mobile' as const) : ('desktop' as const),
      browser: currentBrowser,
      os: 'Online Client',
      lastActive: 'Just now',
      isCurrent: true,
    };
    if (userDevices.length >= maxDev) {
      // Prune oldest non-current device to respect device limit
      userDevices = userDevices.slice(0, maxDev - 1);
    }
    userDevices.unshift(newDev);
    db.devices.set(user.id, userDevices);
  }

  res.json({
    success: true,
    user,
    subscription,
    token: `aether_token_${user.id}_${Date.now()}`,
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  // Check if public registration is disabled for Private Pilot mode
  if (!db.pilotSettings.publicRegistration) {
    return res.status(403).json({
      error: 'Public registration is disabled. This is a private closed-beta platform for approved household members only. Please contact the administrator to be invited.',
    });
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const result = db.createMember(name, email, password);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const user = db.users.get(result.member!.id)!;
  const subscription = db.subscriptions.get(user.id);

  res.status(201).json({
    success: true,
    user,
    subscription,
    token: `aether_token_${user.id}_${Date.now()}`,
  });
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const user = db.users.get(auth.userId);
  if (!user) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const subscription = db.subscriptions.get(user.id);
  const lineMasked = memberIptvLineManager.toMasked(db.getIptvLine(user.id));
  res.json({ user, subscription, iptvLine: lineMasked.assigned ? lineMasked : null });
});

// ==========================================
// 2. CONTENT STREAMS & MEDIA (FREE & VERIFIED)
// ==========================================

apiRouter.get('/content/channels', async (req: Request, res: Response) => {
  const verifiedChannels = Array.from(db.channels.values()).filter((c) => c.enabled);
  const auth = await resolveAuth(req);

  // Per-member Star IPTV line: an active member assignment replaces the
  // global IPTV list with the member's OWN line (Live TV uses ONLY that line).
  if (auth && auth.role === 'customer') {
    const lineReady = await memberIptvLineManager.ensureLineReady(auth.userId);
    if (lineReady) {
      const memberChannels = memberIptvLineManager.getMemberChannels(auth.userId);
      if (memberChannels && memberChannels.length) {
        return res.json({ channels: [...verifiedChannels, ...memberChannels].map(clientSafeChannel) });
      }
    }
  }

  const m3uChannels = starIptvProvider.getEnabledChannelsAsContent();
  res.json({ channels: [...verifiedChannels, ...m3uChannels].map(clientSafeChannel) });
});

apiRouter.get('/content/channels/:id', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  let channel: Channel | undefined = db.channels.get(req.params.id);
  if (!channel || !channel.enabled) {
    if (auth && auth.role === 'customer') {
      // Members with a line resolve channel ids EXCLUSIVELY against their own
      // line — another member's / the global vault-only ids are out of scope.
      channel = memberIptvLineManager.findMemberChannel(auth.userId, req.params.id);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found on your assigned line.' });
      }
    } else {
      const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : '';
      channel = memberId
        ? memberIptvLineManager.findMemberChannel(memberId, req.params.id)
        : starIptvProvider.getEnabledChannelsAsContent().find((c) => c.id === req.params.id);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found or currently unavailable.' });
      }
    }
  }
  res.json({ channel: clientSafeChannel(channel) });
});

apiRouter.get('/content/movies', (_req: Request, res: Response) => {
  const movies = Array.from(db.movies.values()).filter((m) => m.enabled);
  res.json({ movies });
});

apiRouter.get('/content/movies/:id', (req: Request, res: Response) => {
  const movie = db.movies.get(req.params.id);
  if (!movie || !movie.enabled) {
    return res.status(404).json({ error: 'Movie not found or currently unavailable.' });
  }
  res.json({ movie });
});

// Watchlist & Progress (member data is bound to the authenticated identity)
apiRouter.get('/content/watchlist', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const userId = bindUserId(req, res, (req.query.userId as string) || undefined, auth);
  if (userId === null) return; // 403 already sent
  const itemIds = db.watchlist.get(userId) || new Set<string>();

  // Resolution order: app catalog -> member's OWN line -> global IPTV (only
  // for members without their own line, preserving legacy behavior).
  const memberChannels = auth && auth.role === 'customer'
    ? memberIptvLineManager.getMemberChannels(auth.userId)
    : null;
  const globalIptv = starIptvProvider.getEnabledChannelsAsContent();

  const items = Array.from(itemIds).map((id) => {
    if (db.channels.has(id)) return { type: 'channel', data: db.channels.get(id) };
    if (db.movies.has(id)) return { type: 'movie', data: db.movies.get(id) };
    const mc = memberChannels?.find((c) => c.id === id);
    if (mc) return { type: 'channel', data: mc };
    if (!memberChannels) {
      const gc = globalIptv.find((c) => c.id === id);
      if (gc) return { type: 'channel', data: gc };
    }
    return { type: id.startsWith('ch-') ? 'channel' : 'movie', data: undefined };
  }).filter((i) => i.data && i.data.enabled);

  res.json({ watchlist: items });
});

apiRouter.post('/content/watchlist/toggle', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const { contentId } = req.body;
  const userId = bindUserId(req, res, req.body?.userId, auth);
  if (userId === null) return; // 403 already sent
  if (!contentId) return res.status(400).json({ error: 'contentId is required.' });

  let list = db.watchlist.get(userId);
  if (!list) {
    list = new Set<string>();
    db.watchlist.set(userId, list);
  }

  let inList = false;
  if (list.has(contentId)) {
    list.delete(contentId);
    inList = false;
  } else {
    list.add(contentId);
    inList = true;
  }

  res.json({ success: true, inList, contentId });
});

apiRouter.get('/content/continue-watching', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const userId = bindUserId(req, res, (req.query.userId as string) || undefined, auth);
  if (userId === null) return; // 403 already sent
  const historyMap = db.watchHistory.get(userId);
  const items = historyMap ? Array.from(historyMap.values()).sort(
    (a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
  ) : [];

  res.json({ continueWatching: items });
});

apiRouter.post('/content/progress', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const { contentId, contentType, positionSeconds, durationSeconds } = req.body;
  const userId = bindUserId(req, res, req.body?.userId, auth);
  if (userId === null) return; // 403 already sent
  if (!contentId) return res.status(400).json({ error: 'Missing contentId' });

  let userHist = db.watchHistory.get(userId);
  if (!userHist) {
    userHist = new Map();
    db.watchHistory.set(userId, userHist);
  }

  // Resolve title/poster across the app catalog, the member's own line, and
  // the global IPTV catalog (legacy ids) so history items stay meaningful.
  const memberChannels = auth && auth.role === 'customer'
    ? memberIptvLineManager.getMemberChannels(auth.userId)
    : null;
  const iptvChannel =
    db.channels.get(contentId) ||
    memberChannels?.find((c) => c.id === contentId) ||
    (!memberChannels ? starIptvProvider.getEnabledChannelsAsContent().find((c) => c.id === contentId) : undefined);

  const title = iptvChannel?.channelName || db.movies.get(contentId)?.title || 'Movie';
  const poster = iptvChannel?.logo || db.movies.get(contentId)?.poster || '';

  const completed = positionSeconds > 0 && durationSeconds > 0 && positionSeconds / durationSeconds > 0.92;

  userHist.set(contentId, {
    contentId,
    contentType: contentType || (contentId.startsWith('ch-') ? 'channel' : 'movie'),
    positionSeconds: Math.floor(positionSeconds || 0),
    durationSeconds: Math.floor(durationSeconds || 0),
    completed,
    lastWatchedAt: new Date().toISOString(),
    title,
    poster,
  });

  res.json({ success: true });
});

// ==========================================
// 3. SUBSCRIPTIONS & PLANS
// ==========================================

apiRouter.get('/subscriptions/plans', async (_req: Request, res: Response) => {
  const starPackagesResult = await starIptvProvider.getPackages();

  const plans = [
    {
      id: 'plan-free',
      tier: 'free',
      name: 'Cinema Explorer',
      price: '$0',
      period: 'Forever Free',
      description: 'Full access to verified public-domain cinema, open-source animated films, and free-to-air international news broadcasts.',
      features: [
        'Curated Public Domain Cinema',
        'Open-Source Film Projects',
        'Official Free-to-Air Public Broadcasters',
        'Standard Definition & HD Streaming',
        'Universal Watchlist & History',
        'Installable PWA for Mobile & TV',
      ],
      isPopular: false,
      ctaText: 'Stream Free Now',
      iptvIncluded: false,
    },
    {
      id: 'plan-cinema-vip',
      tier: 'premium',
      name: 'Aether Cinephile VIP',
      price: '$8.99',
      period: 'per month',
      description: 'Enhanced cinematic experience with 4K UHD restoration streaming, zero ads, priority CDN routing, and multiple device profiles.',
      features: [
        'Everything in Free Explorer',
        'Full 4K UHD Restored Master Feeds',
        'Multi-Screen Household Streaming (3 Devices)',
        'Enhanced 7-Day Catchup EPG Guide',
        'Personalized Recommendation Rail',
        'Zero Ad Banners or Pre-rolls',
      ],
      isPopular: true,
      ctaText: 'Activate Cinephile VIP',
      iptvIncluded: false,
    },
    {
      id: 'plan-star-iptv',
      tier: 'iptv_vip',
      name: 'Star IPTV Reseller Pass',
      price: '$14.99',
      period: 'per month',
      description: 'Authorized Star IPTV reseller line integration with worldwide premium channels, live sporting feeds, and personal M3U/EPG line credentials.',
      features: [
        'Authorized Star IPTV Reseller Line Provisioning',
        'Personal Masked M3U Plus & XMLTV Credentials',
        'Full High-Bitrate FHD/4K Live Sports Feeds',
        'Dedicated Connection Allocation',
        'Device Management & MAC Sync',
        'Direct Reseller Concierge Support',
      ],
      isPopular: false,
      ctaText: 'Subscribe via Star IPTV',
      iptvIncluded: true,
      availablePackages: starPackagesResult.packages,
    },
  ];

  res.json({ plans });
});

apiRouter.get('/subscriptions/my-subscription', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const userId = bindUserId(req, res, (req.query.userId as string) || undefined, auth);
  if (userId === null) return; // 403 already sent
  const sub = db.subscriptions.get(userId) || {
    id: 'sub-none',
    userId,
    tier: 'free',
    status: 'active',
    packageName: 'Free Explorer',
    activationDate: new Date().toISOString(),
    expiryDate: '2099-12-31T23:59:59.000Z',
    maxDevices: 1,
    activeDevices: 1,
    autoRenew: false,
  };
  const devices = db.devices.get(userId) || [];
  const lineMasked = memberIptvLineManager.toMasked(db.getIptvLine(userId));

  res.json({ subscription: sub, devices, iptvLine: lineMasked.assigned ? lineMasked : null });
});

apiRouter.post('/subscriptions/order', async (req: Request, res: Response) => {
  const { planId, packageId, paymentMethod, email, name, userId = 'usr-customer-01' } = req.body;

  if (planId === 'plan-star-iptv') {
    // Invoke Star IPTV adapter
    const iptvOrder = await starIptvProvider.createCustomer({
      name: name || 'Valued Subscriber',
      email: email || 'subscriber@aetherstream.tv',
      note: `Package: ${packageId || 'star-pkg-1m'} via ${paymentMethod || 'Manual Bank / Gateway'}`,
    });

    // Update customer subscription to Star IPTV line
    const updatedSub = {
      id: `sub-star-${Date.now().toString(36)}`,
      userId,
      tier: 'iptv_vip' as const,
      status: 'active' as const,
      packageName: 'Star IPTV VIP Executive Line',
      activationDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxDevices: 2,
      activeDevices: 1,
      autoRenew: true,
      iptvCredentials: {
        username: `star_${userId.slice(-6)}`,
        serverHost: 'vip.stariptv.pk',
        m3uUrlMasked: 'http://vip.stariptv.pk:8080/get.php?username=star_••••••&password=••••••••&type=m3u_plus',
        epgUrl: 'http://vip.stariptv.pk:8080/xmltv.php?username=star_••••••&password=••••••••',
      },
    };
    db.subscriptions.set(userId, updatedSub);

    return res.json({
      success: true,
      subscription: updatedSub,
      starIptvResult: iptvOrder,
      message: 'Subscription created. Reseller panel notification queued for line issuance.',
    });
  }

  // Cinephile pass upgrade
  const vipSub = {
    id: `sub-prem-${Date.now().toString(36)}`,
    userId,
    tier: 'premium' as const,
    status: 'active' as const,
    packageName: 'Aether Cinephile VIP',
    activationDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: 3,
    activeDevices: 1,
    autoRenew: true,
  };
  db.subscriptions.set(userId, vipSub);

  res.json({ success: true, subscription: vipSub, message: 'VIP Subscription activated successfully!' });
});

// ==========================================
// 4. PRIVATE MEMBER MANAGEMENT (3–5 MEMBERS)
// ==========================================

apiRouter.get('/admin/members', (_req: Request, res: Response) => {
  const members = db.getMembers();
  res.json({
    members,
    slots: {
      total: db.pilotSettings.maxPrivateUsers,
      current: db.users.size,
      active: db.pilotSettings.activeMembers,
      remaining: db.pilotSettings.remainingSlots,
      maxDevicesPerUser: db.pilotSettings.maxDevicesPerUser,
    },
  });
});

apiRouter.post('/admin/members/create', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const result = db.createMember(name, email, password);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json(result);
});

apiRouter.post('/admin/members/:id/toggle', (req: Request, res: Response) => {
  const result = db.toggleMemberStatus(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

apiRouter.delete('/admin/members/:id', (req: Request, res: Response) => {
  const result = db.deleteMember(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  // Drop the durable line mirror too (deleteMember only clears the memory map).
  memberIptvLineManager.purgeDurable(req.params.id);
  res.json({ success: true, message: 'Member deleted from private pilot.' });
});

apiRouter.post('/admin/members/:id/reset-password', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'New password is required.' });
  const result = db.resetMemberPassword(req.params.id, password);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Password reset successfully.' });
});

apiRouter.post('/devices/revoke', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  const { deviceId } = req.body;
  const userId = bindUserId(req, res, req.body?.userId, auth);
  if (userId === null) return; // 403 already sent
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required.' });
  }
  db.revokeDevice(userId, deviceId);
  const updated = db.devices.get(userId) || [];
  res.json({ success: true, devices: updated, message: 'Device revoked successfully.' });
});

apiRouter.get('/admin/devices', (_req: Request, res: Response) => {
  const devices = db.getAllDevices();
  res.json({ devices, total: devices.length });
});

apiRouter.get('/admin/watch-history', (_req: Request, res: Response) => {
  const history = db.getAllWatchHistory();
  res.json({ history, total: history.length });
});

// ==========================================
// 5. STAR IPTV RESELLER VAULT & M3U IMPORTER (admin-gated management)
// ==========================================

// ---- Per-member Star IPTV line assignment (admin only) ----

apiRouter.get('/admin/iptv-lines', (req: Request, res: Response) => {
  const lines = db.getIptvLines().map((l) => memberIptvLineManager.toMasked(l));
  res.json({ lines });
});

apiRouter.get('/admin/members/:id/iptv-line', (req: Request, res: Response) => {
  const line = db.getIptvLine(req.params.id);
  res.json({ line: line ? memberIptvLineManager.toMasked(line) : { userId: req.params.id, assigned: false } });
});

apiRouter.post('/admin/members/:id/iptv-line', async (req: Request, res: Response) => {
  const { serverUrl, username, password, m3uUrl, epgUrl, providerName, status, skipProbe } = req.body || {};
  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'serverUrl, username, and password are required.' });
  }
  const auth = (req as unknown as { auth?: { userId: string } }).auth;
  const input: LineProbeInput = { serverUrl: String(serverUrl), username: String(username), password: String(password), m3uUrl: m3uUrl ? String(m3uUrl) : undefined, epgUrl: epgUrl ? String(epgUrl) : undefined };
  const result = await memberIptvLineManager.assignLine(req.params.id, input, {
    providerName: providerName ? String(providerName) : undefined,
    status: status === 'disabled' ? 'disabled' : 'active',
    assignedBy: auth?.userId || 'admin',
    skipProbe: Boolean(skipProbe),
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Line assignment failed.', probe: result.probe });
  }
  if (result.probe) {
    db.logAdminAction('IPTV_LINE_PROBE', `Member line probe: ${result.probe.message}`);
  }
  res.json({
    success: true,
    message: 'Star IPTV line securely assigned to this member (server-side vault, credentials never sent to browsers).',
    line: result.masked,
    probe: result.probe,
  });
});

apiRouter.delete('/admin/members/:id/iptv-line', (req: Request, res: Response) => {
  const result = memberIptvLineManager.clearLine(req.params.id);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Star IPTV line unassigned from member.' });
});

apiRouter.get('/iptv/config', requireAdmin, (_req: Request, res: Response) => {
  const summary = starIptvProvider.getConfigSummary();
  const logs = starIptvProvider.getLogs();
  res.json({
    config: summary,
    logs,
  });
});

apiRouter.post('/iptv/config', requireAdmin, (req: Request, res: Response) => {
  const { providerName, serverUrl, username, password, m3uUrl, epgUrl, apiUrl, apiKey, resellerId } = req.body;
  starIptvProvider.updateConfig({
    providerName,
    serverUrl,
    username,
    password,
    m3uUrl,
    epgUrl,
    apiUrl,
    apiKey,
    resellerId,
  });

  db.logAdminAction('IPTV_VAULT_UPDATE', `Star IPTV credentials vault updated by admin.`);
  res.json({
    success: true,
    message: 'Star IPTV vault credentials secured in server-side storage.',
    config: starIptvProvider.getConfigSummary(),
  });
});

apiRouter.post('/iptv/test-connection', requireAdmin, async (_req: Request, res: Response) => {
  const result = await starIptvProvider.testConnection();
  db.logAdminAction('IPTV_TEST_SERVER', `Star IPTV connection test: ${result.status} (${result.message})`);
  res.json(result);
});

apiRouter.post('/iptv/test-m3u', requireAdmin, async (req: Request, res: Response) => {
  const { url } = req.body;
  const result = await starIptvProvider.testM3U(url);
  db.logAdminAction('IPTV_TEST_M3U', `M3U URL test: ${result.status} (${result.message})`);
  res.json(result);
});

apiRouter.post('/iptv/test-epg', requireAdmin, async (req: Request, res: Response) => {
  const { url } = req.body;
  const result = await starIptvProvider.testEPG(url);
  db.logAdminAction('IPTV_TEST_EPG', `EPG URL test: ${result.status} (${result.message})`);
  res.json(result);
});

apiRouter.post('/iptv/import-m3u', requireAdmin, async (req: Request, res: Response) => {
  const { url } = req.body;
  const result = await starIptvProvider.fetchAndImportM3U(url);
  if (result.success) {
    db.logAdminAction('IPTV_IMPORT_M3U', `Imported ${result.count} channels from M3U playlist.`);
  }
  res.json(result);
});

apiRouter.get('/iptv/categories', requireAdmin, async (_req: Request, res: Response) => {
  const categories = await starIptvProvider.getCategories();
  res.json({ categories, total: categories.length });
});

apiRouter.post('/iptv/import-category', requireAdmin, async (req: Request, res: Response) => {
  const { categoryId } = req.body;
  if (!categoryId) {
    return res.status(400).json({ error: 'categoryId is required' });
  }
  const result = await starIptvProvider.importCategory(String(categoryId));
  if (result.success) {
    db.logAdminAction('IPTV_IMPORT_CATEGORY', `Imported ${result.count} HLS channels from category "${result.categoryName}".`);
  }
  res.json(result);
});

apiRouter.get('/iptv/m3u-channels', requireAdmin, (_req: Request, res: Response) => {
  const channels = starIptvProvider.getParsedChannels();
  res.json({ channels, total: channels.length });
});

apiRouter.post('/iptv/m3u-channels/:id/toggle', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;
  const ok = starIptvProvider.toggleChannelEnabled(id, enabled);
  if (!ok) return res.status(404).json({ error: 'M3U Channel not found' });
  res.json({ success: true, channelId: id, enabled });
});

apiRouter.post('/iptv/m3u-channels/bulk', requireAdmin, (req: Request, res: Response) => {
  const { enabled, group } = req.body;
  const result = starIptvProvider.bulkToggleChannels(Boolean(enabled), group);
  db.logAdminAction('IPTV_BULK_TOGGLE', `Bulk updated ${result.count} channels (enabled=${enabled})`);
  res.json({ success: true, ...result });
});

apiRouter.get('/iptv/packages', async (_req: Request, res: Response) => {
  const result = await starIptvProvider.getPackages();
  res.json(result);
});

apiRouter.get('/iptv/logs', requireAdmin, (_req: Request, res: Response) => {
  res.json({ logs: starIptvProvider.getLogs() });
});

// ==========================================
// 5b. FULL PROVIDER CATALOG (authenticated pilot users; live/VOD/series)
// Browsing payloads contain NO credentials — playback URLs are resolved
// per-caller at /catalog/play against the caller's own line.
// ==========================================

const CATALOG_TYPES: Set<string> = new Set(['live', 'vod', 'series']);

/**
 * Open-access catalog context (playbeat.live model): EVERYONE can browse and
 * watch. Anonymous callers resolve against the platform vault line; signed-in
 * members with their own active Star IPTV line still resolve against their
 * own line (resolveLine handles the member/vault precedence internally).
 */
async function catalogContext(req: Request) {
  const auth = await resolveAuth(req);
  const line = iptvCatalog.resolveLine(auth);
  return { auth, line };
}

apiRouter.get('/catalog/categories', async (req: Request, res: Response) => {
  const { line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const type = String(req.query.type || '');
  if (!CATALOG_TYPES.has(type)) return res.status(400).json({ error: 'type must be live, vod, or series' });
  try {
    const categories = await iptvCatalog.categories(line, type as CatalogType);
    res.json({ categories, line: line.label });
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider catalog unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

apiRouter.get('/catalog/items', async (req: Request, res: Response) => {
  const { line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const type = String(req.query.type || '');
  const categoryId = String(req.query.categoryId || '');
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(120, Math.max(12, Number(req.query.limit) || 60));
  if (!CATALOG_TYPES.has(type) || !categoryId) return res.status(400).json({ error: 'type and categoryId are required' });
  try {
    const all = await iptvCatalog.items(line, type as CatalogType, categoryId);
    const start = (page - 1) * limit;
    res.json({ items: all.slice(start, start + limit), page, limit, totalInCategory: all.length, line: line.label });
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider catalog unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

apiRouter.get('/catalog/search', async (req: Request, res: Response) => {
  const { line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const type = String(req.query.type || '');
  const q = String(req.query.q || '');
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  if (!CATALOG_TYPES.has(type) || !q.trim()) return res.status(400).json({ error: 'type and q are required' });
  try {
    const result = await iptvCatalog.search(line, type as CatalogType, q, categoryId);
    res.json({ items: result.items, scope: result.scope, line: line.label });
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider catalog unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

apiRouter.get('/catalog/movie/:id', async (req: Request, res: Response) => {
  const { line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const numericId = Number(req.params.id);
  if (!numericId) return res.status(400).json({ error: 'Invalid movie id' });
  try {
    const info = await iptvCatalog.movieInfo(line, numericId);
    const i = info?.info || {};
    const md = info?.movie_data || {};
    res.json({
      movie: {
        id: `vod-${numericId}`,
        numericId,
        name: String(md.name || i.name || i.o_name || ''),
        plot: String(i.plot || i.description || i.background_plot || ''),
        poster: String(i.movie_image || i.cover_big || ''),
        backdrop: String(i.backdrop_path?.[0] || ''),
        genre: String(i.genre || ''),
        duration: String(i.duration || ''),
        releasedate: String(i.releasedate || ''),
        rating: String(i.rating || ''),
        youtubeTrailer: String(i.youtube_trailer || ''),
        containerExt: String(md.container_extension || 'mp4'),
        line: line.label,
      },
    });
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider info unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

apiRouter.get('/catalog/series/:id', async (req: Request, res: Response) => {
  const { line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const numericId = Number(req.params.id);
  if (!numericId) return res.status(400).json({ error: 'Invalid series id' });
  try {
    const info = await iptvCatalog.seriesInfo(line, numericId);
    const i = info?.info || {};
    const seasonsRaw = info?.episodes || {};
    const seasons = Object.keys(seasonsRaw)
      .map((sk) => ({
        season: Number(sk) || 0,
        episodes: (Array.isArray(seasonsRaw[sk]) ? seasonsRaw[sk] : []).map((e: any) => ({
          id: String(e.id),
          episodeNum: Number(e.episode_num) || 0,
          season: Number(e.season) || Number(sk) || 0,
          title: String(e.title || `Episode ${e.episode_num}`),
          containerExt: String(e.container_extension || 'mp4'),
          info: e?.info ? { duration: String(e.info.duration_secs || e.info.duration || '') } : undefined,
        })),
      }))
      .sort((a, b) => a.season - b.season);
    res.json({
      series: {
        id: `ser-${numericId}`,
        numericId,
        name: String(i.name || ''),
        plot: String(i.plot || ''),
        poster: String(i.cover || ''),
        backdrop: String(i.backdrop_path?.[0] || ''),
        genre: String(i.genre || ''),
        cast: String(i.cast || '').slice(0, 400),
        releaseDate: String(i.releaseDate || i.releasedate || ''),
        rating: String(i.rating || ''),
        episodeRunTime: Number(i.episode_run_time) || undefined,
        seasons,
        line: line.label,
      },
    });
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider info unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

/**
 * Public catalog metrics — REAL provider totals only (never invented).
 * Serves verified measured values; opportunistically refreshed from the
 * provider. No credentials, no member data.
 */
apiRouter.get('/catalog/stats', (_req: Request, res: Response) => {
  res.json({ stats: getCatalogStats() });
});

/**
 * Public home-page rails sample from the provider catalog (credential-free).
 * Live channels with artwork + latest movies + latest series. When a member
 * session is present their own line context is reflected in the label.
 */
apiRouter.get('/catalog/highlights', async (req: Request, res: Response) => {
  try {
    const highlights = await getCatalogHighlights();
    res.json(highlights);
  } catch (e: unknown) {
    res.status(502).json({ error: `Provider catalog unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
});

// ==========================================
// 5c. MEMBER SELF-SERVICE LINE ("Simple Player")
// A signed-in member can connect their OWN Star IPTV credentials (Xtream
// username/password or a pasted m3u_plus link) so playback and the full
// catalog run on their own line. Credentials are probed, stored server-side
// (encrypted durable mirror), and NEVER returned to the browser.
// ==========================================

apiRouter.get('/me/line', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  if (!auth) return res.status(401).json({ error: 'Sign in required.' });
  const line = db.getIptvLine(auth.userId);
  const masked = memberIptvLineManager.toMasked(line);
  res.json({ line: masked.assigned ? masked : null, selfManaged: Boolean(line?.assignedBy && String(line.assignedBy).startsWith('self:')) });
});

apiRouter.post('/me/line', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  if (!auth) return res.status(401).json({ error: 'Sign in required.' });
  if (auth.role === 'admin') {
    return res.status(400).json({ error: 'Administrators browse through the secure vault line — no personal line needed.' });
  }
  const existing = db.getIptvLine(auth.userId);
  if (existing && existing.status === 'active') {
    return res.status(409).json({ error: 'A Star IPTV line is already connected to your account. Contact the administrator to change it.' });
  }

  const { serverUrl, username, password, m3uUrl } = req.body || {};
  let input: LineProbeInput | null = null;

  if (serverUrl && username && password) {
    input = { serverUrl: String(serverUrl).trim(), username: String(username).trim(), password: String(password) };
  } else if (m3uUrl && !serverUrl && !username && !password) {
    // Accept a full m3u_plus link: http://host:port/get.php?username=U&password=P&type=m3u_plus
    try {
      const parsed = new URL(String(m3uUrl).trim());
      const u = parsed.searchParams.get('username');
      const p = parsed.searchParams.get('password');
      if (!u || !p) return res.status(400).json({ error: 'The M3U link must contain username and password parameters (standard m3u_plus format).' });
      input = { serverUrl: `${parsed.protocol}//${parsed.host}`, username: u, password: p, m3uUrl: String(m3uUrl).trim() };
    } catch {
      return res.status(400).json({ error: 'That M3U link could not be parsed. Paste the full get.php?username=…&password=… URL.' });
    }
  }

  if (!input) {
    return res.status(400).json({ error: 'Provide your server URL, username and password — or just paste your M3U link.' });
  }

  const result = await memberIptvLineManager.assignLine(auth.userId, input, {
    providerName: 'My Star IPTV Line',
    status: 'active',
    assignedBy: `self:${auth.userId}`,
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Line verification failed.', probe: result.probe });
  }
  db.logAdminAction('MEMBER_SELF_LINE', `Member ${auth.userId} connected their own IPTV line (${result.probe?.message || 'probe skipped'}).`);
  res.json({
    success: true,
    message: 'Your IPTV line is connected. The full catalog is now unlocked.',
    line: result.masked,
    probe: result.probe,
  });
});

apiRouter.delete('/me/line', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req);
  if (!auth) return res.status(401).json({ error: 'Sign in required.' });
  const existing = db.getIptvLine(auth.userId);
  if (!existing) return res.status(404).json({ error: 'No line connected.' });
  const selfManaged = Boolean(existing.assignedBy && String(existing.assignedBy).startsWith('self:'));
  if (!selfManaged) {
    return res.status(403).json({ error: 'This line was assigned by the administrator — ask the admin to remove it.' });
  }
  const result = memberIptvLineManager.clearLine(auth.userId);
  if (!result.success) return res.status(400).json({ error: result.error });
  db.logAdminAction('MEMBER_SELF_LINE', `Member ${auth.userId} disconnected their self-connected IPTV line.`);
  res.json({ success: true, message: 'Line disconnected.' });
});

apiRouter.get('/catalog/play', async (req: Request, res: Response) => {
  const { auth, line } = await catalogContext(req);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet. Please check back soon.' });
  const type = String(req.query.type || '');
  const itemId = String(req.query.itemId || '');
  const episodeId = req.query.episodeId ? String(req.query.episodeId) : undefined;
  const m = itemId.match(/^(?:live|vod|ser)-(\d+)$/);
  if (!CATALOG_TYPES.has(type) || !m) return res.status(400).json({ error: 'type and itemId are required' });
  try {
    const result = await iptvCatalog.resolvePlay(line, type as CatalogType, Number(m[1]), episodeId ? Number(episodeId) : undefined);
    if (!result) return res.status(404).json({ error: 'Episode not found on your assigned line.' });
    // Log member/admin plays only — the open catalog serves anonymous traffic
    // too, which would flood the admin action log.
    if (auth) db.logAdminAction('CATALOG_PLAY', `${auth.role} playback resolved on ${line.label}`);
    res.json({ kind: result.kind, url: result.url, title: result.title, line: result.label });
  } catch (e: unknown) {
    res.status(502).json({ error: `Playback resolution failed: ${e instanceof Error ? e.message : 'error'}` });
  }
});

// ==========================================
// HTTPS STREAM RELAY (sealed refs — see server/streamProxy.ts)
// Auth = possession of an unforgeable sealed reference minted by resolvePlay /
// channel serialization; provider credentials stay encrypted server-side.
// ==========================================
apiRouter.get('/stream/hls', handleStreamRelay);

// ==========================================
// CATALOG WARM (Vercel cron + manual trigger)
// Default: snapshot-first hydration (cheap no-op when the durable snapshot
// is fresh). ?force=1 rebuilds from the provider and persists a snapshot
// ONLY when the build is complete (all categories fetched) — a partial
// rebuild never clobbers a good snapshot. One TYPE per call keeps every
// invocation well inside the function time limit. Safe to expose: the
// in-memory 6h cache + snapshot freshness window rate-limit provider load.
// ==========================================
apiRouter.get('/catalog/warm', async (req: Request, res: Response) => {
  const line = iptvCatalog.resolveLine(null);
  if (!line) return res.status(503).json({ error: 'Catalog source is not configured yet.' });
  const type = String(req.query.type || 'vod');
  if (!CATALOG_TYPES.has(type)) return res.status(400).json({ error: 'type must be live, vod, or series' });
  const force = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
  const startedAt = Date.now();
  try {
    const result = await iptvCatalog.searchIndex(line, type as CatalogType, { force });
    res.json({
      ok: true, type, force,
      items: result.items.length,
      complete: result.complete,
      categories: result.categoryCount,
      failedCategories: result.failedCategories.length,
      savedSnapshot: result.savedSnapshot,
      ms: Date.now() - startedAt,
      line: line.label,
    });
  } catch (e: unknown) {
    res.status(502).json({ ok: false, type, error: e instanceof Error ? e.message : 'error', ms: Date.now() - startedAt });
  }
});

// ==========================================
// 5. ADMIN CONTROL & CONTENT MANAGEMENT
// ==========================================

apiRouter.get('/admin/stats', (_req: Request, res: Response) => {
  const stats = db.getAdminStats();
  const logs = db.adminLogs.slice(0, 30);
  res.json({ stats, logs });
});

apiRouter.get('/admin/channels', (_req: Request, res: Response) => {
  const channels = Array.from(db.channels.values());
  res.json({ channels });
});

apiRouter.post('/admin/channels/toggle', (req: Request, res: Response) => {
  const { channelId, enabled } = req.body;
  const channel = db.channels.get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  channel.enabled = enabled !== undefined ? enabled : !channel.enabled;
  db.channels.set(channelId, channel);

  db.logAdminAction('CHANNEL_TOGGLE', `Channel ${channel.channelName} (${channelId}) enabled state set to ${channel.enabled}`);
  res.json({ success: true, channel });
});

apiRouter.post('/admin/channels/add', (req: Request, res: Response) => {
  const newChan: Channel = req.body;
  if (!newChan.id || !newChan.channelName || !newChan.streamUrl) {
    return res.status(400).json({ error: 'id, channelName, and streamUrl are required.' });
  }

  db.channels.set(newChan.id, {
    ...newChan,
    lastVerified: new Date().toISOString(),
    enabled: true,
  });

  db.logAdminAction('CHANNEL_ADD', `Added new channel: ${newChan.channelName} (${newChan.rightsStatus})`);
  res.json({ success: true, channel: db.channels.get(newChan.id) });
});

apiRouter.get('/admin/movies', (_req: Request, res: Response) => {
  const movies = Array.from(db.movies.values());
  res.json({ movies });
});

apiRouter.post('/admin/movies/toggle', (req: Request, res: Response) => {
  const { movieId, enabled } = req.body;
  const movie = db.movies.get(movieId);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  movie.enabled = enabled !== undefined ? enabled : !movie.enabled;
  db.movies.set(movieId, movie);

  db.logAdminAction('MOVIE_TOGGLE', `Movie ${movie.title} (${movieId}) enabled state set to ${movie.enabled}`);
  res.json({ success: true, movie });
});

apiRouter.post('/admin/movies/add', (req: Request, res: Response) => {
  const newMovie: Movie = req.body;
  if (!newMovie.id || !newMovie.title || !newMovie.source) {
    return res.status(400).json({ error: 'id, title, and source are required.' });
  }

  db.movies.set(newMovie.id, {
    ...newMovie,
    enabled: true,
  });

  db.logAdminAction('MOVIE_ADD', `Added new movie: ${newMovie.title} (${newMovie.rightsStatus})`);
  res.json({ success: true, movie: db.movies.get(newMovie.id) });
});

// ==========================================
// 6. COPYRIGHT, TAKEDOWN & DMCA PROCEDURES
// ==========================================

apiRouter.post('/takedown/submit', (req: Request, res: Response) => {
  const {
    contentId,
    contentTitle,
    claimantName,
    claimantEmail,
    copyrightOwner,
    allegedInfringementUrl,
    statement,
  } = req.body;

  if (!claimantName || !claimantEmail || !statement || (!contentId && !allegedInfringementUrl)) {
    return res.status(400).json({ error: 'Please provide claimant details, infringement URL/content, and sworn statement.' });
  }

  const requestId = `tk-${Date.now().toString(36)}`;
  const takedown: typeof db.takedownRequests[0] = {
    id: requestId,
    contentId: contentId || 'URL_REFERENCE',
    contentTitle: contentTitle || allegedInfringementUrl,
    claimantName,
    claimantEmail,
    copyrightOwner: copyrightOwner || claimantName,
    allegedInfringementUrl: allegedInfringementUrl || `https://aetherstream.tv/content/${contentId}`,
    statement,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    notes: 'Submitted via public copyright notice portal. Queued for immediate officer triage.',
  };

  db.takedownRequests.unshift(takedown);
  db.logAdminAction('TAKEDOWN_SUBMITTED', `Copyright report logged [${requestId}] for ${takedown.contentTitle} by ${claimantName}`);

  res.status(201).json({
    success: true,
    ticketNumber: requestId,
    message: 'Your report has been logged with the Aether Stream compliance office. Our automated system has notified the admin team for immediate audit.',
  });
});

apiRouter.get('/admin/takedowns', (_req: Request, res: Response) => {
  res.json({ takedowns: db.takedownRequests });
});

apiRouter.post('/admin/takedowns/:id/action', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, notes } = req.body; // action: 'DISABLE_AND_ACCEPT' | 'REJECT' | 'UNDER_REVIEW'

  const request = db.takedownRequests.find((t) => t.id === id);
  if (!request) return res.status(404).json({ error: 'Takedown record not found' });

  if (action === 'DISABLE_AND_ACCEPT') {
    request.status = 'ACCEPTED_REMOVED';
    request.reviewedAt = new Date().toISOString();
    request.notes = notes || 'Content disabled and confirmed removed pursuant to takedown claim.';

    // Automatically disable if contentId matches
    if (db.channels.has(request.contentId)) {
      const ch = db.channels.get(request.contentId)!;
      ch.enabled = false;
      db.channels.set(request.contentId, ch);
    }
    if (db.movies.has(request.contentId)) {
      const m = db.movies.get(request.contentId)!;
      m.enabled = false;
      db.movies.set(request.contentId, m);
    }
    db.logAdminAction('TAKEDOWN_ACCEPTED', `Content removed and takedown ${id} marked accepted.`);
  } else if (action === 'REJECT') {
    request.status = 'REJECTED';
    request.reviewedAt = new Date().toISOString();
    request.notes = notes || 'Claim reviewed; content verified as public domain or authorized open broadcast.';
    db.logAdminAction('TAKEDOWN_REJECTED', `Takedown ${id} rejected following rights audit.`);
  } else {
    request.status = 'UNDER_REVIEW';
    request.notes = notes || 'Under ongoing legal review.';
  }

  res.json({ success: true, takedown: request });
});

// ==========================================
// CREATOR HUB (public browse/watch, creator portal, admin console)
// Admin routes reuse the platform requireAdmin gate; creator routes bind to
// Supabase identities; IPTV/catalog internals are NOT exposed here.
// ==========================================
apiRouter.use('/creator-hub', createCreatorHubRouter({ requireAdmin }));

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    channelsCount: db.channels.size,
    moviesCount: db.movies.size,
    usersCount: db.users.size,
  });
});
