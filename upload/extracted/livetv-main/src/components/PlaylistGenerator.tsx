import React, { useState } from 'react';
import { CustomerLine, ServerConfig } from '../types/iptv';
import { generatePlaylistLinks } from '../services/playlist';
import { 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Tv, 
  Radio, 
  ExternalLink, 
  FileText, 
  Smartphone,
  Layers
} from 'lucide-react';

interface PlaylistGeneratorProps {
  lines: CustomerLine[];
  servers: ServerConfig[];
}

export const PlaylistGenerator: React.FC<PlaylistGeneratorProps> = ({ lines, servers }) => {
  const xtreamLines = lines.filter((l) => l.lineType === 'XTREAM');
  const [selectedLineId, setSelectedLineId] = useState<string>(
    xtreamLines[0]?.id || lines[0]?.id || ''
  );
  const [selectedServerId, setSelectedServerId] = useState<string>(
    servers[0]?.id || ''
  );
  const [formatType, setFormatType] = useState<
    'm3u_plus' | 'm3u_hls' | 'm3u_standard' | 'epg' | 'enigma2' | 'vlc' | 'mag'
  >('m3u_plus');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedLine = lines.find((l) => l.id === selectedLineId) || lines[0];
  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  if (!selectedLine || !selectedServer) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-lg">
        No lines available to generate playlist scripts. Create a line first.
      </div>
    );
  }

  const links = generatePlaylistLinks(selectedLine, selectedServer);
  const host = selectedServer.hostUrl.replace(/\/+$/, '');
  const u = encodeURIComponent(selectedLine.providerUsername);
  const p = encodeURIComponent(selectedLine.providerPassword || '');

  // Generate scripts for different hardware players
  const enigma2Script = `wget -O /etc/enigma2/iptv.sh "${host}/get.php?username=${u}&password=${p}&type=enigma22_script&output=ts" && chmod 777 /etc/enigma2/iptv.sh && /etc/enigma2/iptv.sh`;
  const vlcCommand = `vlc "${links.m3uPlusTs}"`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const getFormatOutput = () => {
    switch (formatType) {
      case 'm3u_plus':
        return {
          title: 'M3U Plus (TS Format with Channel Groups & EPG Tags)',
          desc: 'Recommended for IPTV Smarters, TiviMate, OTT Navigator, XCIPTV, and Smart TVs.',
          url: links.m3uPlusTs,
          isScript: false
        };
      case 'm3u_hls':
        return {
          title: 'M3U Plus (HLS / m3u8 Adaptive Streaming)',
          desc: 'Optimal for iOS, Apple TV, Safari browsers, and mobile networks with fluctuating bandwidth.',
          url: links.m3uPlusHls,
          isScript: false
        };
      case 'm3u_standard':
        return {
          title: 'Standard M3U (Simple Playlist)',
          desc: 'Lightweight format for classic media players and older Smart TV apps.',
          url: links.m3uStandard,
          isScript: false
        };
      case 'epg':
        return {
          title: 'Electronic Program Guide (XMLTV Format)',
          desc: 'Syncs full 7-day TV channel schedule and program metadata.',
          url: links.epgXmltv,
          isScript: false
        };
      case 'enigma2':
        return {
          title: 'Enigma2 OE 2.0 / OE 2.2 Auto-Installer Script',
          desc: 'Telnet/SSH command for Dreambox, VU+, Octagon, Zgemma satellite receivers.',
          url: enigma2Script,
          isScript: true
        };
      case 'vlc':
        return {
          title: 'VLC Media Player CLI Direct Stream',
          desc: 'Quick command to launch local playback in VLC terminal.',
          url: vlcCommand,
          isScript: true
        };
      case 'mag':
        return {
          title: 'MAG / Stalker Portal Configuration',
          desc: 'Portal URL for Infomir MAG 250/254/322/422/524 and Formuler STB devices.',
          url: host,
          isScript: false
        };
    }
  };

  const currentFormat = getFormatOutput();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Playlist &amp; Player Link Generator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Generates customized streaming endpoints, M3U playlists, XMLTV EPG guides, and hardware scripts
            </p>
          </div>

          {/* Quick Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Target Subscriber Line</label>
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.providerUsername} · {l.lineType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Streaming Server Node</label>
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Format Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { id: 'm3u_plus', label: 'M3U Plus (TS)', icon: FileText },
          { id: 'm3u_hls', label: 'M3U8 (HLS)', icon: Layers },
          { id: 'm3u_standard', label: 'Standard M3U', icon: FileText },
          { id: 'epg', label: 'XMLTV EPG', icon: Tv },
          { id: 'enigma2', label: 'Enigma2 Script', icon: Terminal },
          { id: 'vlc', label: 'VLC CLI', icon: PlayIcon },
          { id: 'mag', label: 'MAG Portal', icon: Radio }
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = formatType === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setFormatType(item.id as any)}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 mb-2 text-indigo-400" />
              <span className="text-xs font-semibold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Format Display Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-semibold text-white">{currentFormat.title}</h3>
            <p className="text-xs text-slate-400">{currentFormat.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            {!currentFormat.isScript && (
              <a
                href={currentFormat.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Link</span>
              </a>
            )}
            <button
              onClick={() => handleCopy(currentFormat.url, 'main_url')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
            >
              {copiedKey === 'main_url' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
          <pre className="font-mono text-xs text-indigo-300 break-all whitespace-pre-wrap select-all">
            {currentFormat.url}
          </pre>
        </div>
      </div>

      {/* Hardware Player Setup Guides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TiviMate & Smarters */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>IPTV Smarters &amp; TiviMate Setup</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Choose &quot;Login with Xtream Codes API&quot;. Fill Host with{' '}
            <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">{host}</code>,
            Username with{' '}
            <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">
              {selectedLine.providerUsername}
            </code>
            , and your line password.
          </p>
        </div>

        {/* VLC Player */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <PlayIcon className="w-4 h-4 text-amber-400" />
            <span>VLC Media Player Setup</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Open VLC, navigate to <strong>Media &rarr; Open Network Stream (Ctrl+N)</strong>, paste the
            M3U Plus TS link above, and press Play. Channel groups and EPG will load directly.
          </p>
        </div>

        {/* MAG 250 / 322 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>MAG &amp; Formuler STB Setup</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Register your device&apos;s physical MAC in Star Panel, then set <strong>Portal 1 URL</strong>{' '}
            in System Settings to{' '}
            <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">{host}</code>. Reboot the
            device.
          </p>
        </div>
      </div>
    </div>
  );
};

function PlayIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
