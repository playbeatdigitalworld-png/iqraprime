import React, { useState } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Zap, 
  Server, 
  Globe, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Tv, 
  Smartphone, 
  Laptop, 
  Flame, 
  Sliders, 
  Check, 
  Layers, 
  Clock, 
  Eye, 
  Gauge, 
  Wifi, 
  Shield, 
  Radio, 
  Play, 
  Trash2 
} from 'lucide-react';
import { StreamingService } from '../../../services/streamingService';
import { QoEPlatformSummary, ActiveDeviceSession, StreamPrewarmConfig } from '../../../types/streaming';

export const QoEDashboard: React.FC = () => {
  const [summary, setSummary] = useState<QoEPlatformSummary>(StreamingService.getQoESummary());
  const [sessions, setSessions] = useState<ActiveDeviceSession[]>(StreamingService.getActiveSessions());
  const [isPrewarming, setIsPrewarming] = useState(false);
  const [prewarmResult, setPrewarmResult] = useState<StreamPrewarmConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'ORIGIN_SHIELD' | 'DEVICES' | 'PREWARM'>('METRICS');

  const handleRefresh = () => {
    setSummary(StreamingService.getQoESummary());
    setSessions(StreamingService.getActiveSessions());
  };

  const handleTerminateSession = (sessionId: string) => {
    StreamingService.terminateSession(sessionId);
    setSessions(StreamingService.getActiveSessions());
  };

  const handleTriggerPrewarm = () => {
    setIsPrewarming(true);
    setTimeout(() => {
      const res = StreamingService.prewarmBroadcast(
        'ch_sky_sports_1',
        'Sky Sports Premier League 4K',
        'Premier League Super Sunday Live Derby'
      );
      setPrewarmResult(res);
      setIsPrewarming(false);
    }, 1500);
  };

  // Score color styling
  const getScoreTheme = (score: number) => {
    if (score >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'EXCELLENT' };
    if (score >= 75) return { text: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', label: 'HEALTHY' };
    if (score >= 50) return { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'DEGRADED' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', label: 'CRITICAL' };
  };

  const scoreTheme = getScoreTheme(summary.overallStreamScore);

  return (
    <div className="space-y-6">
      {/* Top Banner: QoE & Stream Score */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Gauge className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                    QUALITY OF EXPERIENCE (QoE)
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${scoreTheme.bg} ${scoreTheme.text}`}>
                    STREAM SCORE {summary.overallStreamScore} · {scoreTheme.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Buffer-Resistant Streaming Architecture, Time-to-First-Frame Optimization &amp; Edge Delivery Metrics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Metrics</span>
            </button>

            <button
              onClick={handleTriggerPrewarm}
              disabled={isPrewarming}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Flame className={`w-4 h-4 ${isPrewarming ? 'animate-spin' : ''}`} />
              <span>{isPrewarming ? 'Pre-Warming CDN...' : 'Pre-Warm Origin &amp; CDN'}</span>
            </button>
          </div>
        </div>

        {/* Pre-warm confirmation notification */}
        {prewarmResult && (
          <div className="mt-4 p-4 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Origin &amp; Edge CDN pre-warmed for <strong>{prewarmResult.targetEvent}</strong> across PoPs: {prewarmResult.prewarmEdgePops.join(', ')}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              ORIGIN SHIELD VERIFIED
            </span>
          </div>
        )}

        {/* Top 6 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6">
          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Startup Time</span>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              {summary.avgStartupTimeMs} ms
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">Fast First Frame</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Rebuffer Ratio</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {summary.rebufferRatioPercent}%
            </div>
            <div className="text-[10px] text-slate-500">{summary.totalBufferEvents} stalls today</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Success Rate</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300">
              {summary.playbackSuccessRatePercent}%
            </div>
            <div className="text-[10px] text-slate-500">{summary.playbackStartsToday.toLocaleString()} starts</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Avg. Bitrate</span>
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              {(summary.avgBitrateKbps / 1000).toFixed(1)} Mbps
            </div>
            <div className="text-[10px] text-slate-500">Adaptive HLS ABR</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>CDN Cache Hit</span>
              <Globe className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {summary.cdnCacheHitRatioPercent}%
            </div>
            <div className="text-[10px] text-slate-500">Edge Segment Cache</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Origin Shield</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-300">
              {summary.originShieldOffloadPercent}%
            </div>
            <div className="text-[10px] text-slate-500">Origin Offload Ratio</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'METRICS', label: 'QoE & Problematic Triage', icon: Activity },
          { id: 'ORIGIN_SHIELD', label: 'Origin Shielding & Multi-Region CDN', icon: Shield },
          { id: 'DEVICES', label: `Active Device Sessions (${sessions.length})`, icon: Smartphone },
          { id: 'PREWARM', label: 'Event Traffic Surge Pre-Warming', icon: Flame }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: QOE & PROBLEMATIC TRIAGE */}
      {activeTab === 'METRICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Problematic Channels */}
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Tv className="w-4 h-4 text-cyan-400" />
                  <span>Problematic Channels Watchlist</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Stream Score</span>
              </div>
              <div className="space-y-2">
                {summary.mostProblematicChannels.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-[11px]">{item.channel}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Error Rate: {item.errorRate}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.score >= 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      Score: {item.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Problematic Regions */}
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>Regional Latency &amp; Stalls</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Latency / Stall</span>
              </div>
              <div className="space-y-2">
                {summary.mostProblematicRegions.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-[11px]">{item.region}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Stalls: {item.stalls}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {item.latencyMs} ms
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Problematic Devices */}
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>Device Failure Rate Tracking</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Crash Rate</span>
              </div>
              <div className="space-y-2">
                {summary.mostProblematicDevices.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-[11px]">{item.device}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Compatibility Checked</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {item.failureRate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORIGIN SHIELDING & MULTI-REGION CDN */}
      {activeTab === 'ORIGIN_SHIELD' && (
        <div className="space-y-6">
          {/* Architecture Visualizer Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Multi-Tier Origin Shield &amp; Edge Cache Topology</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Separates application database from high-volume HLS video segment delivery
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                96.12% ORIGIN OFFLOAD
              </span>
            </div>

            <div className="p-4 bg-black/50 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg flex-1">
                  <div className="text-cyan-400 font-bold">1. Viewers (Thousands)</div>
                  <div className="text-[10px] text-slate-400">Smart TVs, Web, Mobile, OTT</div>
                </div>
                <div className="text-cyan-500 font-bold">➔</div>
                <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg flex-1">
                  <div className="text-blue-400 font-bold">2. Nearest CDN Edge</div>
                  <div className="text-[10px] text-slate-400">SIN, HKG, LHR, FRA, DXB</div>
                </div>
                <div className="text-blue-500 font-bold">➔</div>
                <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-lg flex-1">
                  <div className="text-purple-400 font-bold">3. Origin Shield Tier</div>
                  <div className="text-[10px] text-slate-400">Single segment deduplication</div>
                </div>
                <div className="text-purple-500 font-bold">➔</div>
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex-1">
                  <div className="text-emerald-400 font-bold">4. Streaming Origin</div>
                  <div className="text-[10px] text-slate-400">Safe from traffic spikes</div>
                </div>
              </div>
            </div>
          </div>

          {/* CDN PoP & Origin Shield Status Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Edge PoP Delivery Nodes</span>
              </h4>
              <div className="space-y-2">
                {summary.cdnPerformance.map((p, idx) => (
                  <div key={idx} className="p-3 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">{p.pop}</div>
                      <div className="text-[10px] text-slate-400">Latency: {p.latencyMs}ms · Hit Ratio: {p.hitRatio}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Origin Shield Concentrators</span>
              </h4>
              <div className="space-y-2">
                {summary.originShieldPerformance.map((s, idx) => (
                  <div key={idx} className="p-3 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">{s.shieldNode}</div>
                      <div className="text-[10px] text-slate-400">{s.requestsPerSec} req/sec · CPU: {s.cpuUsage}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE DEVICE SESSIONS & CONCURRENCY MANAGEMENT */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Active Device Sessions &amp; Concurrency Limiter</span>
              </h3>
              <p className="text-xs text-slate-400">
                Plan-based concurrent stream limits (1, 2, or 4 streams). Disconnect inactive devices with 1 click.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-300">
              Active Streams: <strong>{sessions.length}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.sessionId}
                className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-white">{sess.deviceName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {sess.deviceType}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      STREAMING
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-semibold truncate">
                    Channel: {sess.channelName}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Quality: {sess.quality} ({sess.bitrateKbps} Kbps) · Region: {sess.region} · IP: {sess.ip}
                  </div>
                </div>

                <button
                  onClick={() => handleTerminateSession(sess.sessionId)}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Terminate Session</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: EVENT TRAFFIC SURGE PRE-WARMING */}
      {activeTab === 'PREWARM' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Stream Pre-Warming Engine for Major Live Events</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pre-populates edge CDN caches, origin shields, and manifests before millions of viewers arrive
                </p>
              </div>
              <button
                onClick={handleTriggerPrewarm}
                disabled={isPrewarming}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isPrewarming ? 'Executing Pre-Warm...' : 'Run Pre-Warm Check'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-cyan-400 font-bold">Event: Premier League Super Sunday 4K</div>
                <div className="text-slate-300">Target Channel: Sky Sports Premier League 4K</div>
                <div className="text-slate-400">Expected Viewers: 50,000+ Concurrent</div>
                <div className="text-emerald-400 pt-1">✓ 5 Global Edge PoPs Pre-Loaded</div>
              </div>

              <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-cyan-400 font-bold">Event: ICC World Cup Semi-Final Live</div>
                <div className="text-slate-300">Target Channel: Star Sports 1 Cricket HD</div>
                <div className="text-slate-400">Expected Viewers: 65,000+ Concurrent</div>
                <div className="text-emerald-400 pt-1">✓ Multi-bitrate manifests cached (1080p / 720p / 480p)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
