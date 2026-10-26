import { 
  ChannelMonitorProfile, 
  IncidentRecord, 
  MaintenanceSchedule, 
  ScheduledBroadcast, 
  FailoverConfig, 
  OpsRobotTelemetry,
  StreamHealthStatus
} from '../types/operations';
import { CHANNELS } from './catalogData';

const STORAGE_KEYS = {
  CHANNELS_MONITOR: 'pb_ops_monitored_channels',
  INCIDENTS: 'pb_ops_incidents',
  MAINTENANCE: 'pb_ops_maintenance',
  BROADCASTS: 'pb_ops_broadcasts',
  FAILOVER_CONFIG: 'pb_ops_failover_config',
  ROBOT_ENABLED: 'pb_ops_robot_enabled'
};

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  autoFailover: true,
  autoRestore: true,
  minimumHealthyTimeMinutes: 5,
  maxRetriesBeforeFailover: 3,
  notifyOpsOnFailover: true,
  notifyResellersOnOutage: false
};

// Seed initial monitored channels from catalog and common feeds
export function getInitialMonitoredChannels(): ChannelMonitorProfile[] {
  return [
    {
      channelId: 'ch_sky_sports_1',
      channelName: 'Sky Sports Premier League 4K',
      category: 'Sports',
      primarySource: 'https://stream.playbeat.live/live/origin/sky_sports_4k.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/sky_sports_4k.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 35000).toISOString(),
      responseTimeMs: 24,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 8400,
      resolution: '3840x2160',
      fps: 60,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_hbo_max_hd',
      channelName: 'HBO Max HD',
      category: 'Movies',
      primarySource: 'https://stream.playbeat.live/live/origin/hbo_max.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/hbo_max.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 42000).toISOString(),
      responseTimeMs: 18,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 5200,
      resolution: '1920x1080',
      fps: 60,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_bbc_world_news',
      channelName: 'BBC World News HD',
      category: 'News',
      primarySource: 'https://stream.playbeat.live/live/origin/bbc_news.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/bbc_news.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 15000).toISOString(),
      responseTimeMs: 15,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 4500,
      resolution: '1920x1080',
      fps: 50,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_star_sports_1',
      channelName: 'Star Sports 1 Cricket HD',
      category: 'Sports',
      primarySource: 'https://stream.playbeat.live/live/origin/star_sports_1.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/star_sports_1.m3u8',
      activeSource: 'BACKUP',
      status: 'FAILOVER',
      lastChecked: new Date(Date.now() - 20000).toISOString(),
      responseTimeMs: 38,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 5400,
      resolution: '1920x1080',
      fps: 50,
      lastFailure: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      failureCount: 3,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_sony_max_hd',
      channelName: 'Sony MAX HD',
      category: 'Movies',
      primarySource: 'https://stream.playbeat.live/live/origin/sony_max.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/sony_max.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 28000).toISOString(),
      responseTimeMs: 22,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 4800,
      resolution: '1920x1080',
      fps: 50,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_nat_geo_wild',
      channelName: 'National Geographic Wild HD',
      category: 'Documentary',
      primarySource: 'https://stream.playbeat.live/live/origin/nat_geo.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/nat_geo.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 50000).toISOString(),
      responseTimeMs: 26,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 6200,
      resolution: '1920x1080',
      fps: 60,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_geo_news_hd',
      channelName: 'Geo News Live HD',
      category: 'News',
      primarySource: 'https://stream.playbeat.live/live/origin/geo_news.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/geo_news.m3u8',
      activeSource: 'PRIMARY',
      status: 'DEGRADED',
      lastChecked: new Date(Date.now() - 10000).toISOString(),
      responseTimeMs: 142,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 3200,
      resolution: '1920x1080',
      fps: 30,
      failureCount: 1,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_ary_digital_hd',
      channelName: 'ARY Digital Live HD',
      category: 'Entertainment',
      primarySource: 'https://stream.playbeat.live/live/origin/ary_digital.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/ary_digital.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 18000).toISOString(),
      responseTimeMs: 19,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 4900,
      resolution: '1920x1080',
      fps: 50,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_cartoon_network',
      channelName: 'Cartoon Network Live',
      category: 'Kids',
      primarySource: 'https://stream.playbeat.live/live/origin/cartoon_net.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/cartoon_net.m3u8',
      activeSource: 'PRIMARY',
      status: 'HEALTHY',
      lastChecked: new Date(Date.now() - 25000).toISOString(),
      responseTimeMs: 16,
      videoAvailable: true,
      audioAvailable: true,
      streamProtocol: 'HLS',
      bitrateKbps: 4200,
      resolution: '1920x1080',
      fps: 60,
      failureCount: 0,
      autoFailoverEnabled: true,
      maintenanceMode: false,
      epgLinked: true
    },
    {
      channelId: 'ch_mtv_live',
      channelName: 'MTV Live Hits HD',
      category: 'Music',
      primarySource: 'https://stream.playbeat.live/live/origin/mtv_live.m3u8',
      backupSource: 'https://backup-stream.playbeat.live/live/backup/mtv_live.m3u8',
      activeSource: 'PRIMARY',
      status: 'MAINTENANCE',
      lastChecked: new Date(Date.now() - 60000).toISOString(),
      responseTimeMs: 0,
      videoAvailable: false,
      audioAvailable: false,
      streamProtocol: 'HLS',
      bitrateKbps: 0,
      resolution: '1920x1080',
      fps: 0,
      failureCount: 0,
      autoFailoverEnabled: false,
      maintenanceMode: true,
      epgLinked: true
    }
  ];
}

// Initial incidents
export function getInitialIncidents(): IncidentRecord[] {
  return [
    {
      incidentId: 'INC-2026-8841',
      title: 'Star Sports 1 Primary Ingest Packet Drop (Auto-Switched to Backup)',
      severity: 'HIGH',
      type: 'SOURCE_FAILURE',
      service: 'Stream Ingest Node EU-1',
      channel: 'Star Sports 1 Cricket HD',
      server: 'edge-lon-02.playbeat.live',
      startedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      detectedBy: 'PLAYBEAT OPS ROBOT',
      status: 'MONITORING',
      assignedTo: 'Ops Team Lead (Automated)',
      description: 'Primary origin manifest failed 3 consecutive health checks due to upstream packet drop. Robot engaged auto-failover to backup origin with 0 downtime for viewers.',
      actionsTaken: [
        'Retry 1: HTTP 504 Gateway Timeout from primary origin',
        'Retry 2: Manifest stalled for 8 seconds',
        'Retry 3: Primary source marked OFFLINE',
        'Backup source verified HEALTHY (19ms latency)',
        'Switched channel playback to BACKUP origin',
        'Incident logged and ops alerted'
      ],
      affectedViewersEst: 2850
    },
    {
      incidentId: 'INC-2026-8839',
      title: 'Geo News High Latency Alert on Edge Singapore',
      severity: 'MEDIUM',
      type: 'HIGH_LATENCY',
      service: 'Cloudflare Edge CDN Node SIN',
      channel: 'Geo News Live HD',
      server: 'edge-sin-01.playbeat.live',
      startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      detectedBy: 'PLAYBEAT OPS ROBOT',
      status: 'INVESTIGATING',
      assignedTo: 'Network Operations Engineer',
      description: 'Response time exceeded 120ms warning threshold (measured 142ms). Transcoding profile degraded slightly.',
      actionsTaken: [
        'Checked 1.1.1.1 DoH route',
        'Re-routed segment proxy through secondary POP',
        'Monitoring latency graph'
      ],
      affectedViewersEst: 920
    },
    {
      incidentId: 'INC-2026-8832',
      title: 'Scheduled Audio Track Re-sync on MTV Live Hits',
      severity: 'LOW',
      type: 'MAINTENANCE',
      service: 'Transcoder Cluster TC-3',
      channel: 'MTV Live Hits HD',
      server: 'tc-fra-03.playbeat.live',
      startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      detectedBy: 'MANUAL',
      status: 'MONITORING',
      assignedTo: 'Media Broadcast Engineer',
      description: 'Channel put in authorized maintenance mode for Dolby Atmos profile calibration.',
      actionsTaken: [
        'Maintenance window initiated',
        'Customer message banner enabled',
        'Testing multi-track audio AAC & AC3'
      ],
      affectedViewersEst: 0
    }
  ];
}

// Initial Maintenance Schedules
export function getInitialMaintenance(): MaintenanceSchedule[] {
  return [
    {
      maintenanceId: 'MNT-2026-041',
      title: 'Transcoder Cluster TC-3 Audio Profile Calibration',
      service: 'APPLICATION',
      affectedChannels: ['MTV Live Hits HD'],
      affectedServers: ['tc-fra-03.playbeat.live'],
      startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reason: 'Scheduled upgrade to support multi-channel Dolby Atmos audio synchronization.',
      customerMessage: 'This service is temporarily undergoing scheduled maintenance to upgrade audio quality.',
      resellerMessage: 'Transcoder cluster TC-3 scheduled maintenance active. Channel will return to active broadcast at 02:30 UTC.',
      status: 'IN_PROGRESS',
      autoFailoverSuppressed: true,
      executedBy: 'Lead Audio Specialist'
    },
    {
      maintenanceId: 'MNT-2026-042',
      title: 'Edge CDN Singapore POP Routine Kernel Upgrade',
      service: 'SERVER',
      affectedChannels: ['Geo News Live HD', 'ARY Digital Live HD'],
      affectedServers: ['edge-sin-01.playbeat.live'],
      startTime: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      reason: 'Zero-downtime rolling kernel patch and DoH cache tuning.',
      customerMessage: 'This service is temporarily undergoing scheduled maintenance.',
      resellerMessage: 'Scheduled server maintenance for SIN node. Traffic will gracefully route to HKG edge node with 0 interruption.',
      status: 'SCHEDULED',
      autoFailoverSuppressed: false,
      executedBy: 'Cloud Infrastructure Ops'
    }
  ];
}

// Initial Scheduled Broadcasts
export function getInitialBroadcasts(): ScheduledBroadcast[] {
  return [
    {
      broadcastId: 'BC-2026-101',
      title: 'Premier League Super Sunday: Manchester vs Arsenal Live',
      eventName: 'English Premier League Matchday 28',
      category: 'Sports',
      channelId: 'ch_sky_sports_1',
      channelName: 'Sky Sports Premier League 4K',
      startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
      sourceUrl: 'https://stream.playbeat.live/live/origin/sky_sports_4k.m3u8',
      backupSourceUrl: 'https://backup-stream.playbeat.live/live/backup/sky_sports_4k.m3u8',
      expectedConcurrency: 45000,
      drmAuthorized: true,
      operatorNotes: 'High viewer surge expected. Origin pre-warmed. 4K 60FPS dual-feed verified.',
      status: 'SCHEDULED',
      originReadinessScore: 98,
      preFlightCheckCompleted: true,
      audioChannels: 'Dolby Atmos',
      videoFormat: '4K UHD HDR'
    },
    {
      broadcastId: 'BC-2026-102',
      title: 'ICC T20 Cricket Championship Semi-Final Live Broadcast',
      eventName: 'ICC World Cup Semi-Final Arena',
      category: 'Sports',
      channelId: 'ch_star_sports_1',
      channelName: 'Star Sports 1 Cricket HD',
      startTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      sourceUrl: 'https://stream.playbeat.live/live/origin/star_sports_1.m3u8',
      backupSourceUrl: 'https://backup-stream.playbeat.live/live/backup/star_sports_1.m3u8',
      expectedConcurrency: 62000,
      drmAuthorized: true,
      operatorNotes: 'Pre-allocate 8 additional edge transcoders on Cloudflare. Hawk-eye graphic overlay enabled.',
      status: 'SCHEDULED',
      originReadinessScore: 95,
      preFlightCheckCompleted: true,
      audioChannels: '5.1 Surround',
      videoFormat: '1080p 60fps'
    },
    {
      broadcastId: 'BC-2026-103',
      title: 'Global Prime Movie Premiere: Cyber Vanguard 2049',
      eventName: 'HBO Max Authorized Worldwide Premiere',
      category: 'Movies',
      channelId: 'ch_hbo_max_hd',
      channelName: 'HBO Max HD',
      startTime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      sourceUrl: 'https://stream.playbeat.live/live/origin/hbo_max.m3u8',
      backupSourceUrl: 'https://backup-stream.playbeat.live/live/backup/hbo_max.m3u8',
      expectedConcurrency: 24000,
      drmAuthorized: true,
      operatorNotes: 'Simultaneous broadcast with multi-language subtitle track.',
      status: 'LIVE',
      originReadinessScore: 100,
      preFlightCheckCompleted: true,
      audioChannels: 'Dolby Atmos',
      videoFormat: '4K UHD HDR'
    }
  ];
}

export class OpsRobotService {
  // Monitored channels
  static getChannels(): ChannelMonitorProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHANNELS_MONITOR);
      if (data) return JSON.parse(data);
    } catch {}
    const initial = getInitialMonitoredChannels();
    this.saveChannels(initial);
    return initial;
  }

  static saveChannels(channels: ChannelMonitorProfile[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CHANNELS_MONITOR, JSON.stringify(channels));
    } catch {}
  }

  // Incidents
  static getIncidents(): IncidentRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
      if (data) return JSON.parse(data);
    } catch {}
    const initial = getInitialIncidents();
    this.saveIncidents(initial);
    return initial;
  }

  static saveIncidents(incidents: IncidentRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    } catch {}
  }

  // Maintenance
  static getMaintenance(): MaintenanceSchedule[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
      if (data) return JSON.parse(data);
    } catch {}
    const initial = getInitialMaintenance();
    this.saveMaintenance(initial);
    return initial;
  }

  static saveMaintenance(m: MaintenanceSchedule[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(m));
    } catch {}
  }

  // Broadcasts
  static getBroadcasts(): ScheduledBroadcast[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BROADCASTS);
      if (data) return JSON.parse(data);
    } catch {}
    const initial = getInitialBroadcasts();
    this.saveBroadcasts(initial);
    return initial;
  }

  static saveBroadcasts(b: ScheduledBroadcast[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(b));
    } catch {}
  }

  // Failover config
  static getFailoverConfig(): FailoverConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAILOVER_CONFIG);
      if (data) return JSON.parse(data);
    } catch {}
    return DEFAULT_FAILOVER_CONFIG;
  }

  static saveFailoverConfig(c: FailoverConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FAILOVER_CONFIG, JSON.stringify(c));
    } catch {}
  }

  // Robot Enabled Status
  static isRobotOnline(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.ROBOT_ENABLED);
    return val !== 'false'; // default true
  }

  static setRobotOnline(online: boolean): void {
    localStorage.setItem(STORAGE_KEYS.ROBOT_ENABLED, String(online));
  }

  // Telemetry computation
  static getTelemetry(): OpsRobotTelemetry {
    const channels = this.getChannels();
    const incidents = this.getIncidents();
    const isOnline = this.isRobotOnline();

    const healthy = channels.filter(c => c.status === 'HEALTHY').length;
    const degraded = channels.filter(c => c.status === 'DEGRADED').length;
    const offline = channels.filter(c => c.status === 'OFFLINE').length;
    const failover = channels.filter(c => c.status === 'FAILOVER').length;
    const maintenance = channels.filter(c => c.status === 'MAINTENANCE').length;
    const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED').length;

    return {
      isRobotOnline: isOnline,
      lastHeartbeat: new Date().toISOString(),
      monitoringJobIntervalSeconds: 60,
      activeJobsCount: 14,
      totalChannelsMonitored: channels.length,
      healthyChannelsCount: healthy,
      degradedChannelsCount: degraded,
      offlineChannelsCount: offline,
      failoverChannelsCount: failover,
      maintenanceChannelsCount: maintenance,
      activeIncidentsCount: activeIncidents,
      alertsTodayCount: 12,
      failoversTodayCount: 3,
      recoveredIncidentsTodayCount: 9,
      expiringSubscriptionsCount: 4,
      viewerConcurrency: 14250,
      systemLatencyMs: 14.8,
      serverCpuUsagePercent: 28.4,
      serverMemoryUsagePercent: 44.2,
      edgeBandwidthGbps: 34.6
    };
  }

  // Trigger manual or automated stream health check for single channel
  static checkChannelHealth(channelId: string): ChannelMonitorProfile | null {
    const channels = this.getChannels();
    const idx = channels.findIndex(c => c.channelId === channelId);
    if (idx === -1) return null;

    const ch = { ...channels[idx] };
    const now = new Date().toISOString();
    ch.lastChecked = now;

    // Simulate jitter & latency measurement
    const randomLatency = Math.floor(Math.random() * 25) + 12;
    ch.responseTimeMs = randomLatency;

    if (ch.status === 'MAINTENANCE') {
      // Don't modify channels in maintenance
      return ch;
    }

    if (ch.activeSource === 'BACKUP') {
      ch.status = 'FAILOVER';
    } else if (randomLatency > 120) {
      ch.status = 'DEGRADED';
    } else {
      ch.status = 'HEALTHY';
      ch.failureCount = 0;
    }

    channels[idx] = ch;
    this.saveChannels(channels);
    return ch;
  }

  // Switch channel source (Failover or Restore)
  static switchChannelSource(channelId: string, targetSource: 'PRIMARY' | 'BACKUP', reason: string): { success: boolean; message: string } {
    const channels = this.getChannels();
    const idx = channels.findIndex(c => c.channelId === channelId);
    if (idx === -1) return { success: false, message: 'Channel not found' };

    const ch = { ...channels[idx] };
    const prev = ch.activeSource;
    ch.activeSource = targetSource;
    ch.lastChecked = new Date().toISOString();

    if (targetSource === 'BACKUP') {
      ch.status = 'FAILOVER';
      // Log incident
      const newInc: IncidentRecord = {
        incidentId: `INC-${Date.now().toString().slice(-4)}`,
        title: `${ch.channelName} Switched to Backup Source`,
        severity: 'HIGH',
        type: 'SOURCE_FAILURE',
        service: 'Stream Origin Gateway',
        channel: ch.channelName,
        server: 'origin-edge-01.playbeat.live',
        startedAt: new Date().toISOString(),
        detectedBy: 'PLAYBEAT OPS ROBOT',
        status: 'MONITORING',
        assignedTo: 'Ops Automated Failover Engine',
        description: `Source failover executed: ${reason}`,
        actionsTaken: [
          `Primary source flagged: ${ch.primarySource}`,
          `Activated backup source: ${ch.backupSource}`,
          `Stream verified healthy on backup`,
          `Auto-restore watcher initialized`
        ],
        affectedViewersEst: 1500
      };
      const incidents = this.getIncidents();
      this.saveIncidents([newInc, ...incidents]);
    } else {
      ch.status = 'HEALTHY';
      ch.failureCount = 0;
    }

    channels[idx] = ch;
    this.saveChannels(channels);
    return { 
      success: true, 
      message: `Successfully switched ${ch.channelName} from ${prev} to ${targetSource}.` 
    };
  }

  // Toggle maintenance mode for channel
  static toggleChannelMaintenance(channelId: string, enable: boolean): void {
    const channels = this.getChannels();
    const idx = channels.findIndex(c => c.channelId === channelId);
    if (idx === -1) return;

    channels[idx].maintenanceMode = enable;
    channels[idx].status = enable ? 'MAINTENANCE' : 'HEALTHY';
    channels[idx].lastChecked = new Date().toISOString();
    this.saveChannels(channels);
  }

  // Resolve an incident
  static resolveIncident(incidentId: string, resolution: string): void {
    const incidents = this.getIncidents();
    const idx = incidents.findIndex(i => i.incidentId === incidentId);
    if (idx === -1) return;

    incidents[idx].status = 'RESOLVED';
    incidents[idx].resolvedAt = new Date().toISOString();
    incidents[idx].resolution = resolution;
    incidents[idx].actionsTaken.push(`Resolved: ${resolution}`);
    this.saveIncidents(incidents);
  }

  // Create new incident
  static createIncident(incident: Omit<IncidentRecord, 'incidentId' | 'startedAt'>): IncidentRecord {
    const newInc: IncidentRecord = {
      ...incident,
      incidentId: `INC-${Date.now().toString().slice(-4)}`,
      startedAt: new Date().toISOString()
    };
    const incidents = this.getIncidents();
    this.saveIncidents([newInc, ...incidents]);
    return newInc;
  }

  // Create new maintenance window
  static createMaintenance(m: Omit<MaintenanceSchedule, 'maintenanceId'>): MaintenanceSchedule {
    const newMnt: MaintenanceSchedule = {
      ...m,
      maintenanceId: `MNT-${Date.now().toString().slice(-4)}`
    };
    const current = this.getMaintenance();
    this.saveMaintenance([newMnt, ...current]);
    return newMnt;
  }

  // Complete maintenance window
  static completeMaintenance(maintenanceId: string): void {
    const list = this.getMaintenance();
    const idx = list.findIndex(m => m.maintenanceId === maintenanceId);
    if (idx === -1) return;

    list[idx].status = 'COMPLETED';
    list[idx].completedAt = new Date().toISOString();
    this.saveMaintenance(list);

    // Restore affected channels
    const channels = this.getChannels();
    const affected = new Set(list[idx].affectedChannels);
    channels.forEach(ch => {
      if (affected.has(ch.channelName) || affected.has(ch.channelId)) {
        ch.maintenanceMode = false;
        ch.status = 'HEALTHY';
      }
    });
    this.saveChannels(channels);
  }

  // Create new scheduled broadcast
  static createBroadcast(b: Omit<ScheduledBroadcast, 'broadcastId'>): ScheduledBroadcast {
    const newBc: ScheduledBroadcast = {
      ...b,
      broadcastId: `BC-${Date.now().toString().slice(-4)}`
    };
    const current = this.getBroadcasts();
    this.saveBroadcasts([newBc, ...current]);
    return newBc;
  }
}
