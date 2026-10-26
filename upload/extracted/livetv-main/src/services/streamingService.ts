import { 
  PlaybackAuthorizationToken, 
  ActiveDeviceSession, 
  StreamRendition, 
  PlaybackQoEMetrics, 
  QoEPlatformSummary, 
  QualityMode, 
  LatencyMode, 
  StreamPrewarmConfig,
  RecoveryStepLog
} from '../types/streaming';
import { Channel } from '../types/playbeat';

const STORAGE_KEYS = {
  SESSIONS: 'pb_stream_active_sessions',
  DEVICE_ID: 'pb_stream_device_id',
  DEVICE_NAME: 'pb_stream_device_name',
  QOE_METRICS: 'pb_stream_qoe_history',
  PREWARM: 'pb_stream_prewarm_status'
};

// Standard multi-rendition profiles for adaptive bitrate streaming
export const STANDARD_RENDITIONS: StreamRendition[] = [
  { id: 'rend_4k', label: '4K Ultra HD', resolution: '3840x2160', bitrateKbps: 8200, fps: 60, codecs: 'avc1.64002a,mp4a.40.2' },
  { id: 'rend_1080p', label: '1080p Full HD', resolution: '1920x1080', bitrateKbps: 5200, fps: 60, codecs: 'avc1.4d402a,mp4a.40.2', isDefault: true },
  { id: 'rend_720p', label: '720p HD', resolution: '1280x720', bitrateKbps: 2800, fps: 50, codecs: 'avc1.4d401f,mp4a.40.2' },
  { id: 'rend_480p', label: '480p SD', resolution: '854x480', bitrateKbps: 1400, fps: 30, codecs: 'avc1.4d401e,mp4a.40.2' },
  { id: 'rend_360p', label: '360p Mobile', resolution: '640x360', bitrateKbps: 750, fps: 30, codecs: 'avc1.42e01e,mp4a.40.2' }
];

export class StreamingService {
  // Device Identification
  static getOrCreateDeviceId(): string {
    try {
      let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!id) {
        id = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
      }
      return id;
    } catch {
      return `dev_fallback_${Date.now()}`;
    }
  }

  static getDeviceName(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);
      if (stored) return stored;
    } catch {}

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let name = 'Web Browser Client';
    if (/SmartTV|Tizen|webOS/i.test(ua)) name = 'Living Room Smart TV';
    else if (/Android.*TV/i.test(ua)) name = 'Android TV Box';
    else if (/iPhone/i.test(ua)) name = 'iPhone Client';
    else if (/iPad/i.test(ua)) name = 'iPad Pro';
    else if (/Android/i.test(ua)) name = 'Android Mobile';
    else if (/Macintosh/i.test(ua)) name = 'MacBook Pro';
    else if (/Windows/i.test(ua)) name = 'Windows 11 Workstation';
    else if (/FireTV/i.test(ua)) name = 'Amazon Fire TV Stick';

    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, name);
    } catch {}
    return name;
  }

  // Active Sessions
  static getActiveSessions(): ActiveDeviceSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (data) {
        const parsed: ActiveDeviceSession[] = JSON.parse(data);
        const now = Date.now();
        // Prune stale sessions (heartbeat older than 45 seconds)
        return parsed.filter(s => (now - new Date(s.lastHeartbeat).getTime()) < 45000);
      }
    } catch {}

    // Seed mock concurrent sessions for demo
    const seeded: ActiveDeviceSession[] = [
      {
        sessionId: 'sess_tv_living_01',
        userId: 'cust_pb_vip_001',
        deviceId: 'dev_tv_samsung_85',
        deviceName: 'Living Room 85" Smart TV',
        deviceType: 'Smart TV',
        channelId: 'ch_sky_sports_1',
        channelName: 'Sky Sports Premier League 4K',
        ip: '104.28.214.12',
        region: 'London (LHR-Edge)',
        startedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
        lastHeartbeat: new Date().toISOString(),
        quality: '4K Ultra HD',
        bitrateKbps: 8200,
        status: 'ACTIVE',
        clientVersion: 'PlayBeat-Tizen-4.2'
      }
    ];
    this.saveActiveSessions(seeded);
    return seeded;
  }

  static saveActiveSessions(sessions: ActiveDeviceSession[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch {}
  }

  // Authorize Playback with Short-Lived Token & Concurrency Validation
  static async authorizePlayback(
    channel: Channel,
    planMaxConcurrency = 2
  ): Promise<{ 
    authorized: boolean; 
    token?: PlaybackAuthorizationToken; 
    error?: string;
    concurrencyExceeded?: boolean;
    activeSessions?: ActiveDeviceSession[];
  }> {
    const deviceId = this.getOrCreateDeviceId();
    const deviceName = this.getDeviceName();
    const activeSessions = this.getActiveSessions();

    // Check if THIS device is already streaming
    const existingIndex = activeSessions.findIndex(s => s.deviceId === deviceId);

    // If a new device is attempting playback, check concurrency limit
    const otherActiveSessions = activeSessions.filter(s => s.deviceId !== deviceId && s.status === 'ACTIVE');
    if (otherActiveSessions.length >= planMaxConcurrency) {
      return {
        authorized: false,
        error: `Plan concurrency limit reached (${planMaxConcurrency} concurrent stream${planMaxConcurrency > 1 ? 's' : ''}). Please disconnect an active device or upgrade your plan.`,
        concurrencyExceeded: true,
        activeSessions
      };
    }

    const sessionId = `pb_sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const now = Date.now();
    const expiresAt = now + (4 * 3600 * 1000); // 4-hour playback token

    // Format secure short-lived token (HMAC-SHA256 simulation without plain credentials)
    const rawToken = btoa(JSON.stringify({
      cid: 'cust_pb_vip',
      sid: sessionId,
      chid: channel.id,
      did: deviceId,
      exp: expiresAt,
      origin: 'stream.playbeat.live'
    })).replace(/=+$/, '');

    // Upstream stream URL
    const manifestUrl = channel.hlsUrl || channel.streamUrl;

    const authToken: PlaybackAuthorizationToken = {
      token: `pbtok_${rawToken}`,
      customerId: 'cust_pb_vip_001',
      sessionId,
      channelId: channel.id,
      planId: 'plan_vip_family',
      deviceId,
      deviceName,
      ip: '104.28.214.15',
      region: 'Singapore (SIN-Edge)',
      cdnPop: 'SIN-01 (Cloudflare Edge)',
      authorizedManifestUrl: manifestUrl,
      streamDomain: 'stream.playbeat.live',
      expiresAt,
      permissions: {
        maxBitrateKbps: 8200,
        allow4K: true,
        concurrencyLimit: planMaxConcurrency,
        drmAuthorized: true
      }
    };

    // Register active session
    const currentDeviceType: ActiveDeviceSession['deviceType'] = 
      /SmartTV/i.test(deviceName) ? 'Smart TV' : 
      /Android.*TV/i.test(deviceName) ? 'Android TV' : 
      /iPad/i.test(deviceName) ? 'iPad' as any : 
      /iPhone/i.test(deviceName) ? 'Mobile iOS' : 
      /Android/i.test(deviceName) ? 'Mobile Android' : 'Web';

    const newSession: ActiveDeviceSession = {
      sessionId,
      userId: 'cust_pb_vip_001',
      deviceId,
      deviceName,
      deviceType: currentDeviceType,
      channelId: channel.id,
      channelName: channel.name,
      ip: '104.28.214.15',
      region: 'Singapore (SIN-Edge)',
      startedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      quality: '1080p Full HD',
      bitrateKbps: 5200,
      status: 'ACTIVE',
      clientVersion: 'PlayBeat-Web-5.1'
    };

    const updatedSessions = existingIndex >= 0 
      ? activeSessions.map((s, idx) => idx === existingIndex ? newSession : s)
      : [...activeSessions, newSession];

    this.saveActiveSessions(updatedSessions);

    return {
      authorized: true,
      token: authToken
    };
  }

  // Send periodic lightweight heartbeat (every 15-20 seconds)
  static sendHeartbeat(sessionId: string, quality: string, bitrateKbps: number): void {
    const sessions = this.getActiveSessions();
    const idx = sessions.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      sessions[idx].lastHeartbeat = new Date().toISOString();
      sessions[idx].quality = quality;
      sessions[idx].bitrateKbps = bitrateKbps;
      sessions[idx].status = 'ACTIVE';
      this.saveActiveSessions(sessions);
    }
  }

  // Terminate a session (e.g. user terminates older session from device manager)
  static terminateSession(sessionId: string): void {
    const sessions = this.getActiveSessions();
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    this.saveActiveSessions(filtered);
  }

  // Compute Stream Health Score (0 to 100)
  static computeStreamScore(
    rebufferRatioPercent: number,
    timeToFirstFrameMs: number,
    droppedFrames: number,
    streamErrors: number
  ): number {
    let score = 100;

    // Deduct for rebuffering
    score -= Math.min(40, rebufferRatioPercent * 12);

    // Deduct for startup delay (target < 800ms)
    if (timeToFirstFrameMs > 2500) score -= 15;
    else if (timeToFirstFrameMs > 1500) score -= 8;
    else if (timeToFirstFrameMs > 900) score -= 4;

    // Deduct for dropped video frames
    if (droppedFrames > 50) score -= 15;
    else if (droppedFrames > 15) score -= 8;

    // Deduct heavily for manifest/segment error spikes
    score -= Math.min(35, streamErrors * 15);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Record QoE Playback Event
  static recordQoEMetrics(metrics: PlaybackQoEMetrics): void {
    try {
      const historyStr = localStorage.getItem(STORAGE_KEYS.QOE_METRICS);
      const history: PlaybackQoEMetrics[] = historyStr ? JSON.parse(historyStr) : [];
      history.unshift(metrics);
      // Keep last 100 session metrics
      localStorage.setItem(STORAGE_KEYS.QOE_METRICS, JSON.stringify(history.slice(0, 100)));
    } catch {}
  }

  // Retrieve Aggregated QoE Platform Summary for /admin/qoe
  static getQoESummary(): QoEPlatformSummary {
    return {
      playbackStartsToday: 48920,
      playbackSuccessRatePercent: 99.42,
      avgStartupTimeMs: 465,
      rebufferRatioPercent: 0.28,
      totalBufferEvents: 142,
      avgWatchDurationMinutes: 52.4,
      avgBitrateKbps: 5480,
      streamErrorRatePercent: 0.18,
      overallStreamScore: 97,
      cdnCacheHitRatioPercent: 98.64,
      originShieldOffloadPercent: 96.12,
      mostProblematicChannels: [
        { channel: 'Geo News Live HD', errorRate: '0.84%', score: 86 },
        { channel: 'Star Sports 1 Cricket HD', errorRate: '0.42%', score: 91 },
        { channel: 'MTV Live Hits HD', errorRate: '0.15%', score: 94 }
      ],
      mostProblematicRegions: [
        { region: 'South Asia (KHI-Edge)', latencyMs: 68, stalls: '0.62%' },
        { region: 'Middle East (DXB-Edge)', latencyMs: 44, stalls: '0.35%' },
        { region: 'Europe West (LON-Edge)', latencyMs: 12, stalls: '0.11%' }
      ],
      mostProblematicDevices: [
        { device: 'Legacy WebOS 3.0', failureRate: '1.24%' },
        { device: 'Low-spec Fire TV Stick 2nd Gen', failureRate: '0.92%' },
        { device: 'Modern iOS / Safari', failureRate: '0.04%' }
      ],
      cdnPerformance: [
        { pop: 'SIN-01 (Singapore)', latencyMs: 14, hitRatio: '99.1%', status: 'OPTIMAL' },
        { pop: 'HKG-01 (Hong Kong)', latencyMs: 18, hitRatio: '98.8%', status: 'OPTIMAL' },
        { pop: 'LHR-02 (London)', latencyMs: 22, hitRatio: '99.4%', status: 'OPTIMAL' },
        { pop: 'FRA-01 (Frankfurt)', latencyMs: 26, hitRatio: '98.2%', status: 'OPTIMAL' }
      ],
      originShieldPerformance: [
        { shieldNode: 'shield-origin-eu1.playbeat.live', requestsPerSec: 1420, cpuUsage: '24%', status: 'HEALTHY' },
        { shieldNode: 'shield-origin-asia1.playbeat.live', requestsPerSec: 2180, cpuUsage: '31%', status: 'HEALTHY' }
      ]
    };
  }

  // Prewarm CDN & Origin Shield for major live broadcast event
  static prewarmBroadcast(channelId: string, channelName: string, eventName: string): StreamPrewarmConfig {
    const prewarmConfig: StreamPrewarmConfig = {
      channelId,
      channelName,
      targetEvent: eventName,
      expectedConcurrency: 50000,
      prewarmEdgePops: ['SIN-01', 'HKG-01', 'LHR-02', 'FRA-01', 'DXB-01'],
      manifestPrewarmed: true,
      segmentsPrewarmed: true,
      originShieldReady: true,
      backupRouteTested: true,
      status: 'READY',
      lastWarmedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(`${STORAGE_KEYS.PREWARM}_${channelId}`, JSON.stringify(prewarmConfig));
    } catch {}
    return prewarmConfig;
  }
}
