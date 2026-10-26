export type PlayerState = 
  | 'STARTING'
  | 'BUFFERING'
  | 'PLAYING'
  | 'RECOVERING'
  | 'FAILED'
  | 'ENDED';

export type QualityMode = 'AUTO' | 'DATA_SAVER' | 'STANDARD' | 'HIGH' | 'BEST';

export type LatencyMode = 'NORMAL' | 'LOW_LATENCY' | 'ULTRA_LOW_LATENCY';

export interface PlaybackAuthorizationToken {
  token: string;
  customerId: string;
  sessionId: string;
  channelId: string;
  planId: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  region: string;
  cdnPop: string;
  authorizedManifestUrl: string;
  streamDomain: string; // e.g. stream.playbeat.live
  expiresAt: number;
  permissions: {
    maxBitrateKbps: number;
    allow4K: boolean;
    concurrencyLimit: number;
    drmAuthorized: boolean;
  };
}

export interface ActiveDeviceSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'Smart TV' | 'Apple TV' | 'Android TV' | 'Web' | 'Mobile iOS' | 'Mobile Android' | 'Fire TV';
  channelId: string;
  channelName: string;
  ip: string;
  region: string;
  startedAt: string;
  lastHeartbeat: string;
  quality: string;
  bitrateKbps: number;
  status: 'ACTIVE' | 'STALLED' | 'TERMINATED';
  clientVersion: string;
}

export interface StreamRendition {
  id: string;
  label: string;
  resolution: string;
  bitrateKbps: number;
  fps: number;
  codecs: string;
  isDefault?: boolean;
}

export interface RecoveryStepLog {
  step: number;
  title: string;
  status: 'IDLE' | 'ATTEMPTING' | 'SUCCESS' | 'FAILED';
  timestamp: string;
  details?: string;
}

export interface PlaybackQoEMetrics {
  sessionId: string;
  channelId: string;
  channelName: string;
  deviceType: string;
  region: string;
  cdnPop: string;
  connectionType: 'Wi-Fi' | '4G/5G' | 'Ethernet' | 'Broadband';
  timeToFirstFrameMs: number;
  startupSuccess: boolean;
  totalPlaybackSeconds: number;
  totalBufferSeconds: number;
  rebufferRatioPercent: number;
  bufferEventsCount: number;
  avgBitrateKbps: number;
  qualitySwitchesCount: number;
  droppedFramesCount: number;
  streamErrorsCount: number;
  streamScore: number; // 0-100
  recoveredCount: number;
}

export interface QoEPlatformSummary {
  playbackStartsToday: number;
  playbackSuccessRatePercent: number;
  avgStartupTimeMs: number;
  rebufferRatioPercent: number;
  totalBufferEvents: number;
  avgWatchDurationMinutes: number;
  avgBitrateKbps: number;
  streamErrorRatePercent: number;
  overallStreamScore: number; // 0-100
  cdnCacheHitRatioPercent: number;
  originShieldOffloadPercent: number;
  mostProblematicChannels: { channel: string; errorRate: string; score: number }[];
  mostProblematicRegions: { region: string; latencyMs: number; stalls: string }[];
  mostProblematicDevices: { device: string; failureRate: string }[];
  cdnPerformance: { pop: string; latencyMs: number; hitRatio: string; status: 'OPTIMAL' | 'DEGRADED' }[];
  originShieldPerformance: { shieldNode: string; requestsPerSec: number; cpuUsage: string; status: 'HEALTHY' | 'STRESSED' }[];
}

export interface StreamPrewarmConfig {
  channelId: string;
  channelName: string;
  targetEvent: string;
  expectedConcurrency: number;
  prewarmEdgePops: string[];
  manifestPrewarmed: boolean;
  segmentsPrewarmed: boolean;
  originShieldReady: boolean;
  backupRouteTested: boolean;
  status: 'READY' | 'WARMING' | 'IDLE';
  lastWarmedAt?: string;
}
