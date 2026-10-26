import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Globe, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Play, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Server, 
  Radio, 
  Tv, 
  Search,
  KeyRound,
  Database,
  Sliders,
  FileText,
  Clock,
  Film,
  Music,
  Users,
  CreditCard,
  HeartPulse,
  Send,
  Layers,
  ArrowRight,
  GitBranch,
  Terminal,
  FolderGit2
} from 'lucide-react';
import { Channel } from '../../types/playbeat';
import { adminFetch } from '../../services/adminAuth';
import { PlayBeatLogo } from '../common/PlayBeatLogo';

interface CloudflareStreamHubProps {
  onPlayChannel: (channel: Channel) => void;
  onRefreshAllChannels?: () => void;
}

export const CloudflareStreamHub: React.FC<CloudflareStreamHubProps> = ({
  onPlayChannel,
  onRefreshAllChannels
}) => {
  const [activeTab, setActiveTab] = useState<'DEPLOYMENT' | 'GITHUB_DEPLOY' | 'WORKERS_JOBS' | 'DNS_DOH' | 'CHANNELS'>('DEPLOYMENT');

  // Cloudflare live verify & DNS state
  const [isVerifyingCf, setIsVerifyingCf] = useState(false);
  const [cfVerifyResult, setCfVerifyResult] = useState<any>(null);
  const [isSyncingDns, setIsSyncingDns] = useState(false);
  const [dnsSyncData, setDnsSyncData] = useState<any>(null);

  // DNS Tester state
  const [testDomain, setTestDomain] = useState('playbeat.live');
  const [isTestingDns, setIsTestingDns] = useState(false);
  const [dnsTestResult, setDnsTestResult] = useState<{ ip: string; latency: number; provider: string } | null>(null);

  // Channels state
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Workers Jobs States
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [maintenanceResult, setMaintenanceResult] = useState<any>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [checkoutTestStatus, setCheckoutTestStatus] = useState<any>(null);
  const [userRegTestStatus, setUserRegTestStatus] = useState<any>(null);

  const cfCredentials = { domain: 'playbeat.live' };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const verifyCloudflare = async () => {
    setIsVerifyingCf(true);
    try {
      const res = await adminFetch('/api/cloudflare/verify');
      const data = await res.json();
      setCfVerifyResult(data);
    } catch (err: any) {
      setCfVerifyResult({ success: false, errors: [{ message: err.message }] });
    } finally {
      setIsVerifyingCf(false);
    }
  };

  const syncDnsZone = async () => {
    setIsSyncingDns(true);
    try {
      const res = await adminFetch('/api/cloudflare/dns/setup-zone', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'DNS setup is not configured.');
      }
      setDnsSyncData(data);
      setActionNotice(`Synchronized DNS Name Servers & Edge Routing for ${cfCredentials.domain}!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`DNS sync error: ${err.message}`);
    } finally {
      setIsSyncingDns(false);
    }
  };

  const runDailyReport = async () => {
    setIsLoadingReport(true);
    try {
      const res = await adminFetch('/api/cron/daily-report');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Daily report is not configured.');
      }
      setDailyReport(data.report);
      setActionNotice('Daily operational report generated successfully.');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      setActionNotice(`Report error: ${err.message}`);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const runMaintenance = async () => {
    setIsRunningMaintenance(true);
    try {
      const res = await adminFetch('/api/cron/maintenance');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Maintenance is not configured.');
      }
      setMaintenanceResult(data);
      setActionNotice('Maintenance completed successfully.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Maintenance error: ${err.message}`);
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  const testUserRegistration = async () => {
    try {
      const res = await adminFetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `vip_${Date.now()}@playbeat.live`,
          password: 'playbeat_user_2026',
          name: 'VIP Stream Subscriber'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration is not configured.');
      }
      setUserRegTestStatus(data);
    } catch (err: any) {
      setUserRegTestStatus({ success: false, message: err.message });
    }
  };

  const testCheckoutVerification = async () => {
    try {
      // 1. Create order
      const orderRes = await adminFetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'vip_family_4k',
          planName: 'World Package, Channels + Vods (Family)',
          amount: 14.99,
          email: 'subscriber@playbeat.live'
        })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success || !orderData.orderId) {
        throw new Error(orderData.error || 'Order creation is not configured.');
      }

      // 2. Verify payment & provision
      const verifyRes = await adminFetch('/api/checkout/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          transactionRef: `tx_stripe_cf_${Date.now()}`
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification is not configured.');
      }
      setCheckoutTestStatus(verifyData);
    } catch (err: any) {
      setCheckoutTestStatus({ success: false, message: err.message });
    }
  };

  const testCloudflareDns = async () => {
    setIsTestingDns(true);
    const start = performance.now();
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(testDomain)}&type=A`, {
        headers: { 'Accept': 'application/dns-json' }
      });
      if (!res.ok) {
        throw new Error(`DNS lookup failed with HTTP ${res.status}.`);
      }
      const data = await res.json();
      const latency = Math.round(performance.now() - start);
      const ip = data.Answer?.[0]?.data;
      if (typeof ip !== 'string') {
        throw new Error(`No A record was returned for ${testDomain}.`);
      }
      setDnsTestResult({
        ip,
        latency,
        provider: 'Cloudflare 1.1.1.1 DoH'
      });
    } catch (err: any) {
      setDnsTestResult(null);
      setActionNotice(`DNS lookup error: ${err.message}`);
    } finally {
      setIsTestingDns(false);
    }
  };

  const loadChannels = async (forceRefresh = false) => {
    setIsLoadingChannels(true);
    try {
      const res = await adminFetch(`/api/iptv/geotv/channels${forceRefresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.channels)) {
        setChannels([]);
        throw new Error(data.error || 'Provider catalog is not configured.');
      }
      setChannels(data.channels);
      setActionNotice(
        forceRefresh
          ? `Refreshed provider catalog: ${data.channels.length} configured feeds.`
          : `Loaded ${data.channels.length} configured feeds.`
      );
      setTimeout(() => setActionNotice(null), 4000);
      if (onRefreshAllChannels) onRefreshAllChannels();
    } catch (err: any) {
      setActionNotice(`Failed to load channels: ${err.message}`);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  useEffect(() => {
    loadChannels();
    testCloudflareDns();
    runDailyReport();
    runMaintenance();
    adminFetch('/api/cloudflare/dns/setup-zone')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'DNS status is not configured.');
        }
        setDnsSyncData(data);
      })
      .catch((err: Error) => setActionNotice(`DNS status unavailable: ${err.message}`));
  }, []);

  // Filter channels
  const groups = ['ALL', ...Array.from(new Set(channels.map((c) => c.group || 'Live Feed')))].slice(0, 15);
  const filteredChannels = channels.filter((c) => {
    const matchesSearch = channelSearch === '' || 
      c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      (c.group && c.group.toLowerCase().includes(channelSearch.toLowerCase()));
    const matchesGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });
  const actionNoticeIsError = Boolean(
    actionNotice && /error|failed|unavailable|not configured/i.test(actionNotice)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
          actionNoticeIsError
            ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
            : 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-200'
        }`}>
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${actionNoticeIsError ? 'text-rose-400' : 'text-cyan-400'}`} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Hub Header Card with New 3D Brand Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl">
        <div className="flex items-center gap-4">
          <PlayBeatLogo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white font-display">
                Cloudflare Streaming &amp; Operations Hub
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DOMAIN: playbeat.live
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cloudflare Worker deployment, DNS configuration, provider-fed catalog, and operational status.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncDnsZone}
            disabled={isSyncingDns}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <Globe className={`w-3.5 h-3.5 ${isSyncingDns ? 'animate-spin' : ''}`} />
            <span>Check DNS setup</span>
          </button>

          <button
            onClick={() => loadChannels(true)}
            disabled={isLoadingChannels}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-lg border border-white/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingChannels ? 'animate-spin' : ''}`} />
            <span>Refresh provider catalog</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'DEPLOYMENT', label: 'Cloudflare DNS & playbeat.live Go-Live', icon: Globe },
          { id: 'GITHUB_DEPLOY', label: 'Connect GitHub & CI/CD', icon: GitBranch },
          { id: 'WORKERS_JOBS', label: 'Workers Jobs & Operations Console', icon: Zap },
          { id: 'DNS_DOH', label: '1.1.1.1 DoH External DNS & Nodes', icon: Activity },
          { id: 'CHANNELS', label: `Live Channels Index (${channels.length})`, icon: Radio }
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

      {/* TAB 1: CLOUDFLARE DNS & NAMESERVER DEPLOYMENT FOR playbeat.live */}
      {activeTab === 'DEPLOYMENT' && (
        <div className="space-y-6">
          {/* Nameserver information is not fetched from the Cloudflare zone. */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Cloudflare Nameservers</h3>
                  <p className="text-xs text-slate-400">
                    Verify the assigned nameservers in Cloudflare and at your registrar for <strong>playbeat.live</strong>.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                UNVERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[11px] text-slate-400 font-sans">Primary Nameserver</div>
                <div className="flex items-center justify-between text-cyan-300 text-sm font-bold">
                  <span>Not available</span>
                  <button
                    disabled
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'ns1' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Confirm this value in the Cloudflare dashboard.</div>
              </div>

              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[11px] text-slate-400 font-sans">Secondary Nameserver</div>
                <div className="flex items-center justify-between text-cyan-300 text-sm font-bold">
                  <span>Not available</span>
                  <button
                    disabled
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'ns2' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Confirm this value in the Cloudflare dashboard.</div>
              </div>
            </div>
          </div>

          {/* DNS Records & Edge Proxy Table */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Example DNS Records (not verified)</h3>
              </div>
              <span className="text-xs font-mono text-cyan-300">
                Zone: <strong>playbeat.live</strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-black/50 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-3">Type</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Content / Target</th>
                    <th className="p-3">Proxy Status</th>
                    <th className="p-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-black/20">
                  {dnsSyncData?.records ? (
                    dnsSyncData.records.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-cyan-400">{r.type}</td>
                        <td className="p-3 text-white">{r.name}</td>
                        <td className="p-3 text-slate-300">{r.content}</td>
                        <td className="p-3">
                          {r.proxied ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Proxied (Orange Cloud)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-white/5 border border-white/10">
                              DNS Only
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 font-sans text-[11px]">{r.purpose}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Loading DNS zone records...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edge Caching Rules & SSL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    SSL / TLS Encryption
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">Unverified</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Check SSL/TLS mode and certificate status in Cloudflare; this page does not read those settings.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Edge Video Cache Rules
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">Unverified</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cache behavior is not verified here. Provider streams require a configured HTTPS upstream.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GITHUB TO CLOUDFLARE CI/CD AUTOMATION */}
      {activeTab === 'GITHUB_DEPLOY' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">GitHub to Cloudflare CI/CD &amp; Go-Live Pipeline</h3>
                  <p className="text-xs text-slate-400">
                    Continuous automated deployments on every commit pushed to GitHub <strong>main</strong> branch
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  WORKFLOW STATUS UNKNOWN
                </span>
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                  DEPLOYMENT UNVERIFIED
                </span>
              </div>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">1</span>
                  <span>Push to Your GitHub</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Connect your local git repository to your GitHub repo and push to the <code className="text-white">main</code> branch.
                </p>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-cyan-300 space-y-1">
                  <div>git remote add origin https://github.com/&lt;user&gt;/playbeat-live.git</div>
                  <div>git branch -M main</div>
                  <div>git push -u origin main</div>
                </div>
                <button
                  onClick={() => handleCopy("git remote add origin https://github.com/<YOUR-USERNAME>/playbeat-live.git\ngit branch -M main\ngit push -u origin main", "git_cmd")}
                  className="w-full py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  {copiedKey === 'git_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'git_cmd' ? 'Commands Copied!' : 'Copy Git Commands'}</span>
                </button>
              </div>

              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">2</span>
                  <span>Set GitHub Action Secrets</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Configure Cloudflare deployment secrets in GitHub Actions. Secret values are never rendered in this application.
                </p>
              </div>


              <div className="p-4 bg-black/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Automated Go-Live</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Every commit triggers <code className="text-white">.github/workflows/deploy.yml</code> which builds and publishes automatically to Cloudflare edge.
                </p>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Configured URLs (unverified)</span>
                  </div>
                  <div className="text-[10px] text-slate-300 space-y-0.5 font-mono">
                    <div>Domain: https://playbeat.live</div>
                    <div>Worker: https://playbeat-live.playbeatdigital.workers.dev</div>
                  </div>
                </div>
                <a
                  href="https://playbeat.live"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open playbeat.live</span>
                </a>
              </div>
            </div>
          </div>

          {/* GitHub Actions Workflow Preview & Direct Cloudflare Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Workflow File Details */}
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>GitHub Actions Workflow File</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">.github/workflows/deploy.yml</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto">
                <div className="text-slate-500"># Triggered on git push</div>
                <div><span className="text-cyan-400">on</span>: [push, workflow_dispatch]</div>
                <div><span className="text-cyan-400">branches</span>: [main, master]</div>
                <div className="mt-2 text-slate-500"># Steps executed in GitHub runner</div>
                <div>1. Checkout code (actions/checkout@v4)</div>
                <div>2. Setup Node.js 20 &amp; npm cache</div>
                <div>3. npm run build (Vite production build)</div>
                <div>4. cloudflare/wrangler-action@v3 deploy</div>
                <div className="mt-2 text-emerald-400 font-semibold">✓ Zero manual server configuration needed</div>
              </div>
            </div>

            {/* Cloudflare Dashboard Alternative */}
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Cloud className="w-4 h-4 text-amber-400" />
                  <span>Option B: Cloudflare Dashboard Native Git Connect</span>
                </div>
                <span className="text-[10px] font-mono text-amber-300">Zero-Config UI</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="text-[11px] text-slate-400">
                  You can also link your GitHub repository directly from the Cloudflare Dashboard web interface:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 bg-black/30 p-3 rounded-xl border border-slate-800">
                  <li>Log in to <strong className="text-white">dash.cloudflare.com</strong> (Account: <em>Playbeatdigital</em>)</li>
                  <li>Click <strong className="text-white">Workers &amp; Pages</strong> &gt; <strong className="text-white">Create application</strong></li>
                  <li>Select <strong className="text-cyan-400">Connect to Git</strong> and authorize your GitHub</li>
                  <li>Select your repo: <strong className="text-indigo-400">playbeat-live</strong></li>
                  <li>Build command: <code className="text-white font-mono bg-white/10 px-1 py-0.5 rounded">npm run build</code>, Directory: <code className="text-white font-mono bg-white/10 px-1 py-0.5 rounded">dist</code></li>
                  <li>Click <strong className="text-emerald-400">Save and Deploy</strong></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKERS JOBS & OPERATIONS CONSOLE */}
      {activeTab === 'WORKERS_JOBS' && (
        <div className="space-y-6">
          {/* Operations Trigger Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Content Producer</span>
                <Film className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-black text-white font-mono">{channels.length} Configured Feeds</div>
              <div className="text-[11px] text-slate-400">TV, Movies, Series &amp; Songs</div>
              <button
                onClick={() => loadChannels(true)}
                className="w-full mt-2 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Fetch &amp; Produce</span>
              </button>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">User Registration</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-black text-white font-mono">Active Gateway</div>
              <div className="text-[11px] text-slate-400">Auto signup &amp; token issuer</div>
              <button
                onClick={testUserRegistration}
                className="w-full mt-2 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Test Registration</span>
              </button>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Checkout &amp; Provision</span>
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white font-mono">Auto-Verify</div>
              <div className="text-[11px] text-slate-400">Instant Xtream line generation</div>
              <button
                onClick={testCheckoutVerification}
                className="w-full mt-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>Test Payment Verify</span>
              </button>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Continuous Maintenance</span>
                <HeartPulse className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-black text-white font-mono">Zero Lag</div>
              <div className="text-[11px] text-slate-400">Every 5m ping &amp; auto-failover</div>
              <button
                onClick={runMaintenance}
                disabled={isRunningMaintenance}
                className="w-full mt-2 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Activity className={`w-3 h-3 ${isRunningMaintenance ? 'animate-spin' : ''}`} />
                <span>Run Maintenance</span>
              </button>
            </div>
          </div>

          {/* Test Status Logs (If triggered) */}
          {checkoutTestStatus?.success && (
            <div className="p-4 bg-black/50 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Subscription Auto-Provisioned Successfully!</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                <div>Order: <strong>{checkoutTestStatus.orderId}</strong></div>
                <div>Username: <strong className="text-cyan-300">{checkoutTestStatus.subscription?.username}</strong></div>
                <div>Expiry: <strong className="text-emerald-400">{checkoutTestStatus.subscription?.expiryDate}</strong></div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate">
                M3U URL: {checkoutTestStatus.subscription?.m3uUrl}
              </div>
            </div>
          )}
          {checkoutTestStatus && !checkoutTestStatus.success && (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              Checkout test unavailable: {checkoutTestStatus.message}
            </div>
          )}

          {userRegTestStatus?.success && (
            <div className="p-4 bg-black/50 border border-indigo-500/30 rounded-xl space-y-1 text-xs font-mono">
              <div className="text-indigo-400 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>User Registered: {userRegTestStatus.user?.email}</span>
              </div>
              <div className="text-slate-300">Bearer Token: {userRegTestStatus.token}</div>
            </div>
          )}
          {userRegTestStatus && !userRegTestStatus.success && (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              Registration test unavailable: {userRegTestStatus.message}
            </div>
          )}

          {/* Daily Operational Report Display */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Daily Operational Report (Automated Cron Job)</h3>
              </div>
              <button
                onClick={runDailyReport}
                disabled={isLoadingReport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin' : ''}`} />
                <span>Refresh Daily Report</span>
              </button>
            </div>

            {dailyReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400">Total Requests</div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {dailyReport.telemetry.totalRequestsToday.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400">Cache Hit Ratio</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      {dailyReport.telemetry.cacheHitRatio}
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400">Bandwidth Saved</div>
                    <div className="text-lg font-bold text-cyan-400 mt-0.5">
                      {dailyReport.telemetry.bandwidthCloudflareSavedGb} GB
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400">Today Revenue</div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      ${dailyReport.businessMetrics.revenueTodayUsd}
                    </div>
                  </div>
                </div>

                {/* Top Streams List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Top Streamed Content Today
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {dailyReport.topStreams?.map((item: any, i: number) => (
                      <div key={i} className="p-2.5 bg-black/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="font-semibold text-white">{item.channel}</span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-cyan-400">{item.viewers} live viewers</span>
                          <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold">{item.resolution}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                Loading daily report telemetry...
              </div>
            )}
          </div>

          {/* Continuous Maintenance Log Display */}
          {maintenanceResult && (
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Continuous Maintenance Health Status</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {maintenanceResult.message}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
                {maintenanceResult.edgeNodes?.map((node: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-black/40 border border-slate-800 rounded-lg space-y-1">
                    <div className="text-white font-bold truncate">{node.host}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{node.latencyMs}ms latency</span>
                      <span className="text-emerald-400 font-bold">{node.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 1.1.1.1 DoH & NODE RESOLUTION */}
      {activeTab === 'DNS_DOH' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Cloudflare External DNS (1.1.1.1 DoH)</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                <Activity className="w-3 h-3 animate-pulse" />
                DNS CHECK
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Cloudflare DoH resolves public hostnames; it does not verify stream health, bypass ISP restrictions, or guarantee playback.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block">Query Hostname via Cloudflare DoH</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={testDomain}
                    onChange={(e) => setTestDomain(e.target.value)}
                    className="flex-1 bg-black/40 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white text-xs focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. streams.example.com"
                  />
                  <button
                    onClick={testCloudflareDns}
                    disabled={isTestingDns}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1 text-xs shrink-0"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTestingDns ? 'animate-spin' : ''}`} />
                    <span>Query DoH</span>
                  </button>
                </div>
              </div>

              {dnsTestResult && (
                <div className="p-3 bg-black/40 border border-emerald-500/30 rounded-xl space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Host: <strong className="text-white">{testDomain}</strong></span>
                    <span className="text-emerald-400 font-bold">{dnsTestResult.latency}ms latency</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Resolved IP: <strong className="text-cyan-300">{dnsTestResult.ip}</strong></span>
                    <span className="text-slate-400">{dnsTestResult.provider}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Streaming Upstream Edge Nodes</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                STATUS UNVERIFIED
              </span>
            </div>

            <p className="text-xs text-slate-400">
              No upstream endpoints or health checks are configured. Add an authorized HTTPS provider before testing playback.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE CHANNELS INDEXER */}
      {activeTab === 'CHANNELS' && (
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">
                Configured Provider Feeds ({channels.length})
              </h3>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter channels or groups..."
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Group Filter Tags */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {groups.map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedGroup === grp
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-black/40 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>

          {/* Channel Table / List */}
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60 bg-black/30">
            {filteredChannels.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {isLoadingChannels ? 'Loading provider feeds...' : 'No configured feeds match the filter.'}
              </div>
            ) : (
              filteredChannels.slice(0, 50).map((ch, idx) => (
                <div
                  key={ch.streamId || idx}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {ch.logo ? (
                        <img src={ch.logo} alt={ch.name} className="w-full h-full object-cover" />
                      ) : (
                        <Tv className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{ch.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span className="font-mono text-cyan-400">ID: {ch.streamId}</span>
                        <span>·</span>
                        <span className="truncate">{ch.group || 'Live Feed'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const channelObj: Channel = {
                          id: `geo_${ch.streamId || idx}`,
                          name: ch.name,
                          number: idx + 1,
                          logo: ch.logo || '',
                          category: ch.category || 'All',
                          country: ch.country || 'Unknown',
                          language: ch.language || 'Unknown',
                          streamUrl: ch.hlsUrl || `/broadcast/api/iptv/hls/stream.m3u8?channelId=${ch.streamId}`,
                          hlsUrl: ch.hlsUrl || `/broadcast/api/iptv/hls/stream.m3u8?channelId=${ch.streamId}`,
                          tsUrl: ch.tsUrl || `/api/proxy/stream?url=${encodeURIComponent(ch.streamUrl || '')}`,
                          streamId: ch.streamId,
                          epgId: ch.epgId || '',
                          isPremium: true,
                          isLive: true,
                          resolution:
                            ch.resolution === '4K' || ch.resolution === '1080p' || ch.resolution === '720p'
                              ? ch.resolution
                              : 'Unknown',
                          currentProgram: {
                            title: 'Program guide unavailable',
                            startTime: '',
                            endTime: '',
                            progressPercentage: 0,
                            synopsis: 'EPG data has not been configured for this feed.'
                          },
                          nextProgram: {
                            title: 'Program guide unavailable',
                            startTime: '',
                            endTime: ''
                          }
                        };
                        onPlayChannel(channelObj);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors"
                    >
                      <Play className="w-3 h-3 fill-slate-950" />
                      <span>Play stream</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {filteredChannels.length > 50 && (
            <div className="text-center text-[11px] text-slate-500">
              Showing first 50 of {filteredChannels.length} channels matching filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
