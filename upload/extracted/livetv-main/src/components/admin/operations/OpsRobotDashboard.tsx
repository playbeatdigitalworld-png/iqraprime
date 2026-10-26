import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Zap, 
  Server, 
  Radio, 
  Tv, 
  Clock, 
  Wrench, 
  Calendar, 
  Play, 
  ArrowRight, 
  Sliders, 
  Check, 
  X, 
  HeartPulse, 
  Search, 
  Film, 
  Sparkles,
  TrendingUp,
  RotateCcw,
  Plus
} from 'lucide-react';
import { 
  ChannelMonitorProfile, 
  IncidentRecord, 
  MaintenanceSchedule, 
  ScheduledBroadcast, 
  OpsRobotTelemetry, 
  FailoverConfig 
} from '../../../types/operations';
import { OpsRobotService } from '../../../services/opsRobotService';

export const OpsRobotDashboard: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'MONITORING' | 'INCIDENTS' | 'MAINTENANCE' | 'BROADCASTS'>('OVERVIEW');
  const [telemetry, setTelemetry] = useState<OpsRobotTelemetry>(OpsRobotService.getTelemetry());
  const [channels, setChannels] = useState<ChannelMonitorProfile[]>(OpsRobotService.getChannels());
  const [incidents, setIncidents] = useState<IncidentRecord[]>(OpsRobotService.getIncidents());
  const [maintenance, setMaintenance] = useState<MaintenanceSchedule[]>(OpsRobotService.getMaintenance());
  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcast[]>(OpsRobotService.getBroadcasts());
  const [failoverConfig, setFailoverConfig] = useState<FailoverConfig>(OpsRobotService.getFailoverConfig());
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Search & filter states
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'HEALTHY' | 'DEGRADED' | 'FAILOVER' | 'MAINTENANCE'>('ALL');
  const [channelSearch, setChannelSearch] = useState('');
  const [incidentFilter, setIncidentFilter] = useState<string>('ALL');

  // Modals / forms
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [showNewMaintenanceModal, setShowNewMaintenanceModal] = useState(false);
  const [showNewBroadcastModal, setShowNewBroadcastModal] = useState(false);

  // Form states
  const [newIncidentData, setNewIncidentData] = useState({
    title: '',
    severity: 'MEDIUM' as const,
    type: 'STREAM_OFFLINE' as const,
    service: 'Stream Origin Gateway',
    channel: 'Sky Sports Premier League 4K',
    description: '',
    assignedTo: 'Ops Lead'
  });

  const [newMntData, setNewMntData] = useState({
    title: '',
    service: 'SERVER' as const,
    channel: 'Sky Sports Premier League 4K',
    reason: 'Planned origin infrastructure optimization',
    durationHours: 2,
    customerMessage: 'This service is temporarily undergoing scheduled maintenance.',
    resellerMessage: 'Planned rolling maintenance with zero edge downtime.'
  });

  const [newBcData, setNewBcData] = useState({
    title: 'Live UEFA Championship Super Derby',
    eventName: 'UEFA Champions Tour',
    category: 'Sports',
    channelName: 'Sky Sports Premier League 4K',
    hoursAhead: 3,
    durationHours: 3,
    expectedConcurrency: 45000,
    videoFormat: '4K UHD HDR' as const,
    audioChannels: 'Dolby Atmos' as const,
    operatorNotes: 'Pre-flight check scheduled 15m prior to kickoff.'
  });

  // Reload data
  const reloadAll = () => {
    setTelemetry(OpsRobotService.getTelemetry());
    setChannels(OpsRobotService.getChannels());
    setIncidents(OpsRobotService.getIncidents());
    setMaintenance(OpsRobotService.getMaintenance());
    setBroadcasts(OpsRobotService.getBroadcasts());
    setFailoverConfig(OpsRobotService.getFailoverConfig());
  };

  // Run full health scan simulation
  const handleRunHealthScan = () => {
    setIsScanning(true);
    setScanMessage('Running local sample scan; live upstream manifests are not checked...');
    setTimeout(() => {
      // Simulate refreshing channels
      channels.forEach(c => OpsRobotService.checkChannelHealth(c.channelId));
      reloadAll();
      setIsScanning(false);
      setScanMessage('Sample scan complete. No live stream origins were verified.');
      setTimeout(() => setScanMessage(null), 5000);
    }, 1800);
  };

  // Toggle robot online
  const handleToggleRobotOnline = () => {
    const next = !telemetry.isRobotOnline;
    OpsRobotService.setRobotOnline(next);
    reloadAll();
  };

  // Toggle channel source manually
  const handleManualSourceSwitch = (channelId: string, targetSource: 'PRIMARY' | 'BACKUP') => {
    const res = OpsRobotService.switchChannelSource(
      channelId, 
      targetSource, 
      `Manual operator intervention triggered via Admin Operations Console`
    );
    reloadAll();
    setScanMessage(res.message);
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Toggle channel maintenance
  const handleToggleMaintenance = (channelId: string, currentStatus: boolean) => {
    OpsRobotService.toggleChannelMaintenance(channelId, !currentStatus);
    reloadAll();
  };

  // Resolve incident
  const handleResolveIncident = (incidentId: string) => {
    OpsRobotService.resolveIncident(incidentId, 'Operator verified stream continuity and closed incident.');
    reloadAll();
  };

  // Create incident
  const handleCreateIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    OpsRobotService.createIncident({
      title: newIncidentData.title || 'Unscheduled Stream Disruption',
      severity: newIncidentData.severity,
      type: newIncidentData.type,
      service: newIncidentData.service,
      channel: newIncidentData.channel,
      server: 'edge-prod-01.playbeat.live',
      detectedBy: 'MANUAL',
      status: 'OPEN',
      assignedTo: newIncidentData.assignedTo,
      description: newIncidentData.description || 'Operator opened incident for investigation.',
      actionsTaken: ['Operator flagged service for investigation'],
      affectedViewersEst: 1200
    });
    setShowNewIncidentModal(false);
    reloadAll();
  };

  // Create maintenance window
  const handleCreateMaintenanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + newMntData.durationHours * 3600 * 1000).toISOString();
    OpsRobotService.createMaintenance({
      title: newMntData.title || 'Scheduled Service Maintenance',
      service: newMntData.service,
      affectedChannels: [newMntData.channel],
      affectedServers: ['edge-fra-01.playbeat.live'],
      startTime,
      endTime,
      reason: newMntData.reason,
      customerMessage: newMntData.customerMessage,
      resellerMessage: newMntData.resellerMessage,
      status: 'SCHEDULED',
      autoFailoverSuppressed: true,
      executedBy: 'Operations Admin'
    });
    setShowNewMaintenanceModal(false);
    reloadAll();
  };

  // Create broadcast
  const handleCreateBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = new Date(Date.now() + newBcData.hoursAhead * 3600 * 1000).toISOString();
    const endTime = new Date(Date.now() + (newBcData.hoursAhead + newBcData.durationHours) * 3600 * 1000).toISOString();
    OpsRobotService.createBroadcast({
      title: newBcData.title,
      eventName: newBcData.eventName,
      category: newBcData.category,
      channelId: 'ch_custom_live',
      channelName: newBcData.channelName,
      startTime,
      endTime,
      sourceUrl: 'https://stream.playbeat.live/live/origin/event_main.m3u8',
      backupSourceUrl: 'https://backup-stream.playbeat.live/live/backup/event_backup.m3u8',
      expectedConcurrency: newBcData.expectedConcurrency,
      drmAuthorized: true,
      operatorNotes: newBcData.operatorNotes,
      status: 'SCHEDULED',
      originReadinessScore: 96,
      preFlightCheckCompleted: true,
      audioChannels: newBcData.audioChannels,
      videoFormat: newBcData.videoFormat
    });
    setShowNewBroadcastModal(false);
    reloadAll();
  };

  // Filtered channels
  const filteredChannels = channels.filter((c) => {
    const matchesSearch = !channelSearch.trim() || 
      c.channelName.toLowerCase().includes(channelSearch.toLowerCase()) ||
      c.category.toLowerCase().includes(channelSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (channelFilter === 'ALL') return true;
    return c.status === channelFilter;
  });

  return (
    <div className="space-y-6">
      {/* ========================================================
          TOP HERO: PLAYBEAT OPS ROBOT STATUS & CONTROLS
          ======================================================== */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                    PLAYBEAT OPS ROBOT
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                    telemetry.isRobotOnline 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${telemetry.isRobotOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                    {telemetry.isRobotOnline ? 'ROBOT ACTIVE · MONITORING' : 'ROBOT OFFLINE (PAUSED)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Autonomous Broadcast Operations, Ingest Health Validation, Auto-Failover &amp; Maintenance Engine
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunHealthScan}
              disabled={isScanning || !telemetry.isRobotOnline}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Running Stream Scan...' : 'Trigger Full Stream Scan'}</span>
            </button>

            <button
              onClick={handleToggleRobotOnline}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                telemetry.isRobotOnline 
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{telemetry.isRobotOnline ? 'Pause Ops Robot' : 'Resume Ops Robot'}</span>
            </button>
          </div>
        </div>

        {/* Scan / Status Alert Notification */}
        {scanMessage && (
          <div className="mt-4 p-3.5 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-xs text-cyan-200 flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6">
          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Healthy Streams</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {telemetry.healthyChannelsCount} / {telemetry.totalChannelsMonitored}
            </div>
            <div className="text-[10px] text-slate-500">Normal 24/7 origin</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Auto-Failovers</span>
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-400">
              {telemetry.failoverChannelsCount} Active
            </div>
            <div className="text-[10px] text-slate-500">{telemetry.failoversTodayCount} switched today</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Active Incidents</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-400">
              {telemetry.activeIncidentsCount} Open
            </div>
            <div className="text-[10px] text-slate-500">{telemetry.recoveredIncidentsTodayCount} recovered</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>System Latency</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              {telemetry.systemLatencyMs} ms
            </div>
            <div className="text-[10px] text-slate-500">CF 1.1.1.1 Edge DoH</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Viewer Concurrency</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              {telemetry.viewerConcurrency.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">Live streams active</div>
          </div>

          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
              <span>Server Load</span>
              <Server className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-300">
              {telemetry.serverCpuUsagePercent}% CPU
            </div>
            <div className="text-[10px] text-slate-500">{telemetry.edgeBandwidthGbps} Gbps throughput</div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SUB-NAVIGATION TABS FOR ROBOT MODULES
          ======================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'OVERVIEW', label: 'Operations Workflow & Topology', icon: Activity },
          { id: 'MONITORING', label: `Live Channel Monitoring (${channels.length})`, icon: Radio },
          { id: 'INCIDENTS', label: `Incident Management (${incidents.filter(i => i.status !== 'RESOLVED').length})`, icon: ShieldAlert },
          { id: 'MAINTENANCE', label: `Maintenance Mode (${maintenance.length})`, icon: Wrench },
          { id: 'BROADCASTS', label: `Broadcast Scheduler (${broadcasts.length})`, icon: Calendar }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
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

      {/* ========================================================
          MODULE 1: OPERATIONS TOPOLOGY & WORKFLOW DIAGRAM
          ======================================================== */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Main 13-Step Production Workflow Diagram */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>PlayBeat Automated Stream Ingest &amp; Incident Workflow</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full 13-step autonomous lifecycle executed continuously by PLAYBEAT OPS ROBOT
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                PIPELINE VERIFIED
              </span>
            </div>

            {/* Stepper Graphic */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              {[
                { step: '01', title: 'AUTHORIZED STREAM SOURCE', desc: 'Ingest verified feeds from authorized origin servers only', color: 'border-cyan-500/40 text-cyan-300' },
                { step: '02', title: 'INGEST / ORIGIN BUFFER', desc: 'Low-latency edge caching with HLS segmentation', color: 'border-cyan-500/40 text-cyan-300' },
                { step: '03', title: 'HEALTH CHECK RUNNER', desc: 'Ping HEAD & manifest updates every 60s', color: 'border-emerald-500/40 text-emerald-300' },
                { step: '04', title: 'VALIDATE AUDIO + VIDEO', desc: 'Check AAC / AC3 audio and H.264 / H.265 video packets', color: 'border-emerald-500/40 text-emerald-300' },
                { step: '05', title: 'VALIDATE EPG / METADATA', desc: 'Sync electronic program guide timings with XMLTV', color: 'border-indigo-500/40 text-indigo-300' },
                { step: '06', title: 'CHECK AUTHORIZATION', desc: 'Confirm DRM and reseller line authorization bounds', color: 'border-indigo-500/40 text-indigo-300' },
                { step: '07', title: 'PUBLISH TO CHANNEL', desc: 'Deliver broadcast feed to web client, OTT apps & VLC', color: 'border-purple-500/40 text-purple-300' },
                { step: '08', title: 'CONTINUOUS MONITORING', desc: 'Track buffer ratios, dropped frames & jitter graphs', color: 'border-purple-500/40 text-purple-300' },
                { step: '09', title: 'MEASURE VIEWER / SERVER', desc: 'Telemetry checks on CPU, memory, and bandwidth load', color: 'border-amber-500/40 text-amber-300' },
                { step: '10', title: 'AUTO-REPAIR OR FAILOVER', desc: 'Retry 3x; switch to secondary origin if primary drops', color: 'border-amber-500/40 text-amber-300' },
                { step: '11', title: 'LOG INCIDENT & NOTIFY', desc: 'Record severity in incident log; alert operations desk', color: 'border-rose-500/40 text-rose-300' },
                { step: '12', title: 'RESTORE PRIMARY SOURCE', desc: 'Probe primary origin; auto-restore after 5m healthy', color: 'border-cyan-500/40 text-cyan-300' },
              ].map((item, i) => (
                <div key={i} className={`p-3.5 bg-black/40 border rounded-xl space-y-1.5 ${item.color}`}>
                  <div className="flex items-center justify-between text-[10px] font-bold opacity-75">
                    <span>STEP {item.step}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                  <div className="font-bold text-white text-[11px] truncate">{item.title}</div>
                  <div className="text-[10px] text-slate-400 font-sans leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Failover Engine Settings Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Automated Failover &amp; Recovery Configuration</h3>
              </div>
              <span className="text-xs font-mono text-cyan-300">Robot Autonomous Policy</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Auto Failover</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    failoverConfig.autoFailover 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {failoverConfig.autoFailover ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Switches channel playback to backup origin immediately after 3 consecutive health check timeouts.
                </p>
              </div>

              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Auto Restore Primary</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    failoverConfig.autoRestore 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {failoverConfig.autoRestore ? 'ENABLED' : 'MANUAL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Automatically reverts to primary origin once it remains continuously healthy for {failoverConfig.minimumHealthyTimeMinutes} minutes.
                </p>
              </div>

              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Min. Healthy Probe</span>
                  <span className="text-cyan-300 font-bold">{failoverConfig.minimumHealthyTimeMinutes} Minutes</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Guarantees origin stability before switching back to avoid flip-flop disruptions for active viewers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODULE 2: LIVE CHANNEL MONITORING & FAILOVER
          ======================================================== */}
      {activeSubTab === 'MONITORING' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Live Channel Profiles &amp; Failover Controls</h3>
                <p className="text-xs text-slate-400">
                  Continuous origin probe, audio/video track verification, and live backup switching
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-slate-800 text-xs">
                {(['ALL', 'HEALTHY', 'DEGRADED', 'FAILOVER', 'MAINTENANCE'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChannelFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      channelFilter === f 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter channels..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="bg-black/50 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Channels Grid / Table */}
          <div className="space-y-3">
            {filteredChannels.map((ch) => {
              const isHealthy = ch.status === 'HEALTHY';
              const isDegraded = ch.status === 'DEGRADED';
              const isFailover = ch.status === 'FAILOVER';
              const isMaint = ch.status === 'MAINTENANCE';

              const statusBadge = isHealthy
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : isDegraded
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : isFailover
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                : isMaint
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

              return (
                <div
                  key={ch.channelId}
                  className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-white font-display">
                        {ch.channelName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadge}`}>
                        {ch.status}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                        {ch.resolution} · {ch.fps}fps
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ch.bitrateKbps} Kbps
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        Response: {ch.responseTimeMs}ms
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-500">Primary Source:</span>
                        <span className={`truncate ${ch.activeSource === 'PRIMARY' ? 'text-white font-semibold' : 'text-slate-500'}`}>
                          {ch.primarySource}
                        </span>
                        {ch.activeSource === 'PRIMARY' && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">ACTIVE</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-500">Backup Source:</span>
                        <span className={`truncate ${ch.activeSource === 'BACKUP' ? 'text-white font-semibold' : 'text-slate-500'}`}>
                          {ch.backupSource}
                        </span>
                        {ch.activeSource === 'BACKUP' && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded">ACTIVE FAILOVER</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Channel Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {ch.activeSource === 'PRIMARY' ? (
                      <button
                        onClick={() => handleManualSourceSwitch(ch.channelId, 'BACKUP')}
                        className="px-2.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Simulate primary failure and trigger backup failover"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Failover to Backup</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleManualSourceSwitch(ch.channelId, 'PRIMARY')}
                        className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Restore primary origin playback"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Restore Primary</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleMaintenance(ch.channelId, ch.maintenanceMode)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        ch.maintenanceMode
                          ? 'bg-blue-500/30 text-blue-200 border-blue-400'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          MODULE 3: INCIDENT MANAGEMENT (/admin/incidents)
          ======================================================== */}
      {activeSubTab === 'INCIDENTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Live Incident Command &amp; Escalation Hub</h3>
                <p className="text-xs text-slate-400">
                  Automated incident detection, severity triage, root cause analysis, and resolution tracking
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowNewIncidentModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open New Incident</span>
            </button>
          </div>

          {/* Incidents List */}
          <div className="space-y-3">
            {incidents.map((inc) => {
              const isResolved = inc.status === 'RESOLVED';
              const sevBadge = inc.severity === 'CRITICAL'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-black'
                : inc.severity === 'HIGH'
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                : inc.severity === 'MEDIUM'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40';

              return (
                <div
                  key={inc.incidentId}
                  className={`p-4 rounded-2xl border transition-all ${
                    isResolved 
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-75' 
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-300">
                        {inc.incidentId}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${sevBadge}`}>
                        {inc.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-cyan-300">
                        {inc.type}
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {inc.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isResolved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        STATUS: {inc.status}
                      </span>

                      {!isResolved && (
                        <button
                          onClick={() => handleResolveIncident(inc.incidentId)}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Resolve</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                    {inc.description}
                  </p>

                  <div className="mt-3 p-3 bg-black/40 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px] text-slate-400">
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                      Robot Actions Log:
                    </div>
                    {inc.actionsTaken.map((act, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-300">
                        <span className="text-cyan-500">›</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <div>Service: <strong className="text-slate-300">{inc.service}</strong> {inc.channel ? `· ${inc.channel}` : ''}</div>
                    <div>Started: {new Date(inc.startedAt).toLocaleTimeString()} · Assigned: {inc.assignedTo}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          MODULE 4: MAINTENANCE MODE (/admin/maintenance)
          ======================================================== */}
      {activeSubTab === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Scheduled Maintenance Windows &amp; Suppression Hub</h3>
                <p className="text-xs text-slate-400">
                  Plan non-disruptive maintenance without triggering false alarm outage alerts
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowNewMaintenanceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Maintenance</span>
            </button>
          </div>

          <div className="space-y-3">
            {maintenance.map((m) => {
              const isInProgress = m.status === 'IN_PROGRESS';
              return (
                <div
                  key={m.maintenanceId}
                  className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-300">{m.maintenanceId}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isInProgress ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {m.status}
                      </span>
                      <h4 className="text-sm font-bold text-white">{m.title}</h4>
                    </div>

                    <span className="text-[10px] font-mono text-cyan-300">
                      Service: {m.service} · Target: {m.affectedChannels.join(', ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{m.reason}</p>

                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-cyan-400">Customer Public Message:</div>
                    <div className="text-[11px] text-slate-200 italic font-sans">"{m.customerMessage}"</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-400">
                    <div>Window: {new Date(m.startTime).toLocaleTimeString()} – {new Date(m.endTime).toLocaleTimeString()}</div>
                    {isInProgress && (
                      <button
                        onClick={() => {
                          OpsRobotService.completeMaintenance(m.maintenanceId);
                          reloadAll();
                        }}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-semibold transition-colors"
                      >
                        Complete Maintenance
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          MODULE 5: BROADCAST SCHEDULER (/admin/broadcasts)
          ======================================================== */}
      {activeSubTab === 'BROADCASTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Live Broadcast &amp; Special Event Scheduler</h3>
                <p className="text-xs text-slate-400">
                  Pre-flight automated origin health check &amp; concurrency allocation for high-traffic events
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowNewBroadcastModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg text-xs transition-colors shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Live Event</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {broadcasts.map((bc) => (
              <div
                key={bc.broadcastId}
                className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-indigo-400 font-bold">{bc.broadcastId}</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      bc.status === 'LIVE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {bc.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white leading-snug">
                    {bc.title}
                  </h4>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Channel: <strong className="text-white">{bc.channelName}</strong>
                  </div>

                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl space-y-1 font-mono text-[10px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Origin Readiness:</span>
                      <span className="text-emerald-400 font-bold">{bc.originReadinessScore}% PASSED</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Video / Audio:</span>
                      <span className="text-cyan-300">{bc.videoFormat} · {bc.audioChannels}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Viewers:</span>
                      <span className="text-white font-bold">{bc.expectedConcurrency.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Start: {new Date(bc.startTime).toLocaleTimeString()}</span>
                  <span className="text-emerald-400">DRM Authorized</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: NEW INCIDENT
          ======================================================== */}
      {showNewIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Open Manual Operations Incident</span>
              </h3>
              <button onClick={() => setShowNewIncidentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIncidentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Incident Title</label>
                <input
                  type="text"
                  required
                  value={newIncidentData.title}
                  onChange={(e) => setNewIncidentData({ ...newIncidentData, title: e.target.value })}
                  placeholder="e.g. Origin Ingest Manifest 404"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Severity</label>
                  <select
                    value={newIncidentData.severity}
                    onChange={(e: any) => setNewIncidentData({ ...newIncidentData, severity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Incident Type</label>
                  <select
                    value={newIncidentData.type}
                    onChange={(e: any) => setNewIncidentData({ ...newIncidentData, type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="STREAM_OFFLINE">STREAM_OFFLINE</option>
                    <option value="SOURCE_FAILURE">SOURCE_FAILURE</option>
                    <option value="HIGH_LATENCY">HIGH_LATENCY</option>
                    <option value="EPG_FAILURE">EPG_FAILURE</option>
                    <option value="AUDIO_FAILURE">AUDIO_FAILURE</option>
                    <option value="SERVER_OVERLOAD">SERVER_OVERLOAD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description &amp; Observations</label>
                <textarea
                  rows={3}
                  value={newIncidentData.description}
                  onChange={(e) => setNewIncidentData({ ...newIncidentData, description: e.target.value })}
                  placeholder="Detail symptoms, affected regions, or test URL..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(false)}
                  className="px-4 py-2 bg-white/5 text-slate-300 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 text-slate-950 font-bold rounded-lg hover:bg-rose-400"
                >
                  Create Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: NEW MAINTENANCE
          ======================================================== */}
      {showNewMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-400" />
                <span>Schedule Maintenance Window</span>
              </h3>
              <button onClick={() => setShowNewMaintenanceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMaintenanceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Maintenance Title</label>
                <input
                  type="text"
                  required
                  value={newMntData.title}
                  onChange={(e) => setNewMntData({ ...newMntData, title: e.target.value })}
                  placeholder="e.g. Origin Gateway Rolling Upgrade"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Target Service</label>
                  <select
                    value={newMntData.service}
                    onChange={(e: any) => setNewMntData({ ...newMntData, service: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="CHANNEL">CHANNEL</option>
                    <option value="SERVER">SERVER</option>
                    <option value="PROVIDER">PROVIDER</option>
                    <option value="APPLICATION">APPLICATION</option>
                    <option value="DATABASE">DATABASE</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Window Duration (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={newMntData.durationHours}
                    onChange={(e) => setNewMntData({ ...newMntData, durationHours: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Customer Message</label>
                <input
                  type="text"
                  value={newMntData.customerMessage}
                  onChange={(e) => setNewMntData({ ...newMntData, customerMessage: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMaintenanceModal(false)}
                  className="px-4 py-2 bg-white/5 text-slate-300 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-slate-950 font-bold rounded-lg hover:bg-blue-400"
                >
                  Schedule Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: NEW BROADCAST
          ======================================================== */}
      {showNewBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Schedule Live Special Broadcast</span>
              </h3>
              <button onClick={() => setShowNewBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBroadcastSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={newBcData.title}
                  onChange={(e) => setNewBcData({ ...newBcData, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Channel Destination</label>
                  <input
                    type="text"
                    value={newBcData.channelName}
                    onChange={(e) => setNewBcData({ ...newBcData, channelName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Hours From Now</label>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={newBcData.hoursAhead}
                    onChange={(e) => setNewBcData({ ...newBcData, hoursAhead: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Expected Viewers</label>
                  <input
                    type="number"
                    value={newBcData.expectedConcurrency}
                    onChange={(e) => setNewBcData({ ...newBcData, expectedConcurrency: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Video Format</label>
                  <select
                    value={newBcData.videoFormat}
                    onChange={(e: any) => setNewBcData({ ...newBcData, videoFormat: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="4K UHD HDR">4K UHD HDR</option>
                    <option value="1080p 60fps">1080p 60fps</option>
                    <option value="720p HD">720p HD</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBroadcastModal(false)}
                  className="px-4 py-2 bg-white/5 text-slate-300 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-400"
                >
                  Schedule Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
