import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Server, 
  Database, 
  Cloud, 
  Radio, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Terminal,
  Zap,
  Globe
} from 'lucide-react';
import { Channel } from '../../types/playbeat';

interface CloudflareGeoTvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadLiveChannels?: (channels: Channel[]) => void;
  onPlayChannel?: (channel: Channel) => void;
}

export const CloudflareGeoTvModal: React.FC<CloudflareGeoTvModalProps> = ({
  isOpen,
  onClose,
  onLoadLiveChannels,
  onPlayChannel
}) => {
  const [activeTab, setActiveTab] = useState<'CLOUDFLARE' | 'GEOTV' | 'CHANNELS'>('CLOUDFLARE');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cloudflare live verify state
  const [isVerifyingCf, setIsVerifyingCf] = useState(false);
  const [cfVerifyResult, setCfVerifyResult] = useState<any>(null);

  // GeoTV channels sync state
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [geoChannels, setGeoChannels] = useState<any[]>([]);
  const [channelCount, setChannelCount] = useState<number>(0);
  const [channelSyncMsg, setChannelSyncMsg] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const verifyCloudflareToken = async () => {
    setIsVerifyingCf(true);
    try {
      const res = await fetch('/api/cloudflare/verify');
      const data = await res.json();
      setCfVerifyResult(data);
    } catch (err: any) {
      setCfVerifyResult({ success: false, errors: [{ message: err.message }] });
    } finally {
      setIsVerifyingCf(false);
    }
  };

  const syncGeoTvChannels = async (force = false) => {
    setIsLoadingChannels(true);
    setChannelSyncMsg(null);
    try {
      const res = await fetch(`/api/iptv/geotv/channels${force ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.channels)) {
        setGeoChannels(data.channels);
        setChannelCount(data.channels.length);
        setChannelSyncMsg(`Successfully parsed ${data.channels.length} live stream channels!`);

        // Convert to PlayBeat channel format if callback passed
        if (onLoadLiveChannels) {
          const converted: Channel[] = data.channels.map((c: any, idx: number) => {
            const streamId = c.streamId || String(idx + 1);
            const hlsUrl = c.hlsUrl || `/broadcast/api/iptv/hls/stream.m3u8?channelId=${streamId}`;
            const tsUrl = c.tsUrl || `/api/proxy/stream?url=${encodeURIComponent(c.streamUrl || '')}`;
            const logoUrl = c.logo && c.logo.startsWith('http://')
              ? `/api/proxy/image?url=${encodeURIComponent(c.logo)}`
              : (c.logo || '');

            return {
              id: `geo_ch_${idx + 1}`,
              name: c.name,
              number: 200 + idx,
              logo: logoUrl,
              category: (c.category || (c.group.includes('Movie') || c.group.includes('Bollywood') ? 'Movies' : 'Entertainment')) as any,
              country: c.country || 'Unknown',
              language: c.language || 'Unknown',
              streamUrl: hlsUrl,
              hlsUrl: hlsUrl,
              tsUrl: tsUrl,
              streamId: streamId,
              groupTitle: c.group,
              epgId: c.epgId || '',
              isPremium: true,
              isLive: true,
              resolution:
                c.resolution === '4K' || c.resolution === '1080p' || c.resolution === '720p'
                  ? c.resolution
                  : 'Unknown',
              currentProgram: {
                title: 'Program guide unavailable',
                startTime: '',
                endTime: '',
                progressPercentage: 0,
                synopsis: 'No programme guide data is available for this channel.'
              },
              nextProgram: {
                title: 'Program guide unavailable',
                startTime: '',
                endTime: ''
              }
            };
          });
          onLoadLiveChannels(converted);
        }
      } else {
        setChannelSyncMsg(data.error || 'Failed to fetch playlist channels');
      }
    } catch (err: any) {
      setChannelSyncMsg(`Sync error: ${err.message}`);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Auto verify token on open
      verifyCloudflareToken();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-[#0c1326] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-display">
                  Cloudflare &amp; GeoTV Integration Center
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                  CONFIGURATION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cloudflare and provider secrets are managed server-side.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-white/[0.08] px-5 bg-black/30">
          <button
            onClick={() => setActiveTab('CLOUDFLARE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'CLOUDFLARE'
                ? 'border-orange-500 text-orange-400 bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Cloudflare Token &amp; R2</span>
          </button>

          <button
            onClick={() => setActiveTab('GEOTV')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'GEOTV'
                ? 'border-cyan-500 text-cyan-400 bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>GeoTV Space Line Details</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('CHANNELS');
              if (geoChannels.length === 0) syncGeoTvChannels();
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'CHANNELS'
                ? 'border-blue-500 text-blue-400 bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Live Channels Parser ({channelCount > 0 ? channelCount : 'Sync'})</span>
          </button>
        </div>

        {/* Tab 1: Cloudflare Token & R2 */}
        {activeTab === 'CLOUDFLARE' && (
          <div className="p-6 space-y-4 overflow-y-auto no-scrollbar flex-1">
            <h3 className="text-sm font-bold text-white">Cloudflare configuration</h3>
            <p className="text-xs leading-relaxed text-slate-300">API tokens and R2 keys are not displayed in this client. Manage or rotate them in Cloudflare and store runtime secrets in Worker Secrets.</p>
            <button onClick={verifyCloudflareToken} disabled={isVerifyingCf} className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs">{isVerifyingCf ? 'Verifying?' : 'Verify server configuration'}</button>
            {cfVerifyResult && <p role="status" className="text-xs text-slate-300">{cfVerifyResult.success ? 'Server configuration verified.' : 'Server configuration could not be verified.'}</p>}
          </div>
        )}

        {/* Tab 2: GeoTV Space Line Details */}
        {activeTab === 'GEOTV' && (
          <div className="p-6 space-y-4 overflow-y-auto no-scrollbar flex-1">
            <h3 className="text-sm font-bold text-white">Provider connection configuration</h3>
            <p className="text-xs leading-relaxed text-slate-300">Provider usernames, passwords, and playlist URLs are intentionally not exposed in this page or application bundle. Configure authorized provider details as Cloudflare Worker Secrets.</p>
          </div>
        )}

        {/* Tab 3: Live Channels Parser */}
        {activeTab === 'CHANNELS' && (
          <div className="p-6 space-y-4 overflow-y-auto no-scrollbar flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  GeoTV Space Live Broadcast Feeds
                </h3>
                <p className="text-xs text-slate-400">
                  {channelSyncMsg || 'Stream direct from GeoTV World Package via secure HTTPS server relay.'}
                </p>
              </div>

              <button
                onClick={() => syncGeoTvChannels(true)}
                disabled={isLoadingChannels}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingChannels ? 'animate-spin' : ''}`} />
                <span>Sync Playlist Channels</span>
              </button>
            </div>

            {isLoadingChannels ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">
                  The catalog will load after secure provider configuration is added.
                </p>
              </div>
            ) : geoChannels.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Radio className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">Channels not synced yet</p>
                <button
                  onClick={() => syncGeoTvChannels(false)}
                  className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg"
                >
                  Load Channels Now
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Loaded Channels ({geoChannels.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                  {geoChannels.slice(0, 80).map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-2.5 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {ch.logo ? (
                          <img src={ch.logo} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-black/60" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0">
                            TV
                          </div>
                        )}
                        <div className="truncate">
                          <span className="text-xs font-bold text-white block truncate">{ch.name}</span>
                          <span className="text-[10px] text-cyan-400 block truncate">{ch.group}</span>
                        </div>
                      </div>

                      {onPlayChannel && (
                        <button
                          onClick={() => {
                            const cObj: Channel = {
                              id: `geo_${idx}`,
                              name: ch.name,
                              number: 100 + idx,
                              logo: ch.logo || '',
                              category: 'Entertainment',
                              country: 'Global',
                              language: 'Hindi/English',
                              streamUrl: `/api/proxy/stream?url=${encodeURIComponent(ch.streamUrl)}`,
                              epgId: `EPG_GEO_${idx}`,
                              isPremium: true,
                              isLive: true,
                              resolution: '1080p',
                              currentProgram: {
                                title: ch.name,
                                startTime: '00:00',
                                endTime: '23:59',
                                progressPercentage: 40,
                                synopsis: `Streaming live from GeoTV Space (${ch.group}).`
                              },
                              nextProgram: {
                                title: '24/7 Broadcast',
                                startTime: '00:00',
                                endTime: '00:00'
                              }
                            };
                            onPlayChannel(cObj);
                            onClose();
                          }}
                          className="p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 shrink-0 transition-colors"
                          title="Watch Stream"
                        >
                          <Play className="w-3.5 h-3.5 fill-slate-950" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Secure Cloudflare Token Relay &amp; HTTPS Video Proxy Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
