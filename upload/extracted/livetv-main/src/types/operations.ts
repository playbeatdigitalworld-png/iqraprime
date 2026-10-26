export type StreamHealthStatus = 
  | 'HEALTHY'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'MAINTENANCE'
  | 'FAILOVER'
  | 'UNKNOWN';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus = 
  | 'OPEN'
  | 'INVESTIGATING'
  | 'MONITORING'
  | 'RESOLVED'
  | 'ESCALATED';

export type IncidentType = 
  | 'STREAM_OFFLINE'
  | 'HIGH_LATENCY'
  | 'SOURCE_FAILURE'
  | 'BACKUP_FAILURE'
  | 'EPG_FAILURE'
  | 'AUDIO_FAILURE'
  | 'VIDEO_FAILURE'
  | 'SERVER_OVERLOAD'
  | 'API_FAILURE'
  | 'AUTH_FAILURE'
  | 'PAYMENT_FAILURE'
  | 'DATABASE_FAILURE'
  | 'MAINTENANCE';

export interface ChannelMonitorProfile {
  channelId: string;
  channelName: string;
  category: string;
  primarySource: string;
  backupSource: string;
  activeSource: 'PRIMARY' | 'BACKUP';
  status: StreamHealthStatus;
  lastChecked: string;
  responseTimeMs: number;
  videoAvailable: boolean;
  audioAvailable: boolean;
  streamProtocol: 'HLS' | 'MPEG-TS' | 'DASH';
  bitrateKbps: number;
  resolution: string;
  fps: number;
  lastFailure?: string;
  failureCount: number;
  autoFailoverEnabled: boolean;
  maintenanceMode: boolean;
  epgLinked: boolean;
}

export interface IncidentRecord {
  incidentId: string;
  title: string;
  severity: IncidentSeverity;
  type: IncidentType;
  service: string;
  channel?: string;
  server?: string;
  startedAt: string;
  detectedBy: 'PLAYBEAT OPS ROBOT' | 'MANUAL' | 'ALERT_RULE';
  status: IncidentStatus;
  assignedTo: string;
  description: string;
  actionsTaken: string[];
  resolvedAt?: string;
  resolution?: string;
  affectedViewersEst: number;
}

export type MaintenanceServiceType = 
  | 'CHANNEL'
  | 'SERVER'
  | 'PROVIDER'
  | 'APPLICATION'
  | 'DATABASE'
  | 'API';

export type MaintenanceStatus = 
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface MaintenanceSchedule {
  maintenanceId: string;
  title: string;
  service: MaintenanceServiceType;
  affectedChannels: string[];
  affectedServers: string[];
  startTime: string;
  endTime: string;
  reason: string;
  customerMessage: string;
  resellerMessage: string;
  status: MaintenanceStatus;
  autoFailoverSuppressed: boolean;
  executedBy: string;
  completedAt?: string;
}

export type BroadcastStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface ScheduledBroadcast {
  broadcastId: string;
  title: string;
  eventName: string;
  category: string;
  channelId: string;
  channelName: string;
  startTime: string;
  endTime: string;
  sourceUrl: string;
  backupSourceUrl: string;
  expectedConcurrency: number;
  drmAuthorized: boolean;
  operatorNotes: string;
  status: BroadcastStatus;
  originReadinessScore: number; // 0-100%
  preFlightCheckCompleted: boolean;
  audioChannels: 'Stereo' | '5.1 Surround' | 'Dolby Atmos';
  videoFormat: '1080p 60fps' | '4K UHD HDR' | '720p HD';
}

export interface FailoverConfig {
  autoFailover: boolean;
  autoRestore: boolean;
  minimumHealthyTimeMinutes: number;
  maxRetriesBeforeFailover: number;
  notifyOpsOnFailover: boolean;
  notifyResellersOnOutage: boolean;
}

export interface OpsRobotTelemetry {
  isRobotOnline: boolean;
  lastHeartbeat: string;
  monitoringJobIntervalSeconds: number;
  activeJobsCount: number;
  totalChannelsMonitored: number;
  healthyChannelsCount: number;
  degradedChannelsCount: number;
  offlineChannelsCount: number;
  failoverChannelsCount: number;
  maintenanceChannelsCount: number;
  activeIncidentsCount: number;
  alertsTodayCount: number;
  failoversTodayCount: number;
  recoveredIncidentsTodayCount: number;
  expiringSubscriptionsCount: number;
  viewerConcurrency: number;
  systemLatencyMs: number;
  serverCpuUsagePercent: number;
  serverMemoryUsagePercent: number;
  edgeBandwidthGbps: number;
}
