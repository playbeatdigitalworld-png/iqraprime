import React, { useState } from 'react';
import { 
  Tv, 
  Smartphone, 
  Monitor, 
  Layers, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  Wifi, 
  PlaySquare, 
  Terminal,
  Zap,
  HelpCircle
} from 'lucide-react';

interface DevicesViewProps {
  onOpenPlans: () => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({ onOpenPlans }) => {
  const [selectedDevice, setSelectedDevice] = useState<string>('smart_tv');
  const deviceGuides = [
    {
      id: 'smart_tv',
      title: 'Samsung & LG Smart TVs',
      icon: Tv,
      badge: 'Most Popular',
      recommendedApps: ['IPTV Smarters Pro', 'IBO Player', 'Smart IPTV (SIPTV)', 'Nanomid Player'],
      steps: [
        'Open the Samsung Smart Hub or LG Content Store on your TV.',
        'Search for "IPTV Smarters Pro" or "IBO Player" and install the application.',
        'Open the app and choose "Login with Xtream Codes API".',
        'Enter Any Name (e.g., PlayBeat), then your Server URL, Username, and Password.',
        'Click "Add User" — all Live Channels, VOD Movies, and EPG schedules will load automatically in 4K.'
      ]
    },
    {
      id: 'firestick',
      title: 'Amazon Fire TV & Firestick',
      icon: PlaySquare,
      badge: '4K Recommended',
      recommendedApps: ['TiviMate IPTV Player', 'IPTV Smarters Pro', 'XCIPTV Player'],
      steps: [
        'On Firestick, download the free "Downloader" app from Amazon Appstore.',
        'Enable "Install unknown apps" for Downloader in Firestick Settings > My Fire TV > Developer Options.',
        'In Downloader, enter code 272483 (or direct link) to install TiviMate or IPTV Smarters Pro.',
        'Launch TiviMate, select "Add Playlist" > "Xtream Codes".',
        'Enter credentials issued by your authorized streaming provider and select "Include TV Guide (EPG)".'
      ]
    },
    {
      id: 'android_tv',
      title: 'Android TV & Google TV / Nvidia Shield',
      icon: Monitor,
      badge: 'Best Performance',
      recommendedApps: ['TiviMate Premium', 'Televizo', 'Sparkle TV', 'OTT Navigator'],
      steps: [
        'Open Google Play Store directly on your Android TV or Chromecast with Google TV.',
        'Install "TiviMate IPTV Player" or "Televizo IPTV".',
        'Select "Xtream Codes API" login method.',
        'Enter the server URL, username, and password supplied by your authorized streaming provider.',
        'Enjoy catch-up TV, audio track selection, and hardware-accelerated 60FPS streaming.'
      ]
    },
    {
      id: 'apple_tv',
      title: 'Apple TV & iOS (iPhone / iPad)',
      icon: Smartphone,
      badge: 'AirPlay Ready',
      recommendedApps: ['GSE Smart IPTV', 'IPTVX', 'Smarters Player Lite', 'Snappier IPTV'],
      steps: [
        'Open the Apple App Store on your Apple TV, iPhone, or iPad.',
        'Download "Smarters Player Lite" or the cinematic "IPTVX" player.',
        'Select "Login with Xtream Codes API".',
        'Fill in your credentials from your PlayBeat dashboard.',
        'Sync playlists via iCloud across all your Apple devices effortlessly.'
      ]
    },
    {
      id: 'mag_stb',
      title: 'MAG Set-Top Box & STB Emu',
      icon: Layers,
      badge: 'Dedicated STB',
      recommendedApps: ['MAG 254 / 322 / 424 / 524 / 540', 'STB Emu Pro'],
      steps: [
        'Navigate to MAG Settings > System Settings > Servers > Portals.',
        'Set Portal 1 Name: "PlayBeat VIP".',
        'Set Portal 1 URL: "http://stream.playbeat.live:8080/c/".',
        'Send your MAG device MAC Address (00:1A:79:XX:XX:XX) via your Account portal to authorize portal access.',
        'Reboot the device and load portal to enjoy STB remote navigation.'
      ]
    },
    {
      id: 'windows_pc',
      title: 'Windows 10 & 11 PC',
      icon: Terminal,
      badge: 'Desktop',
      recommendedApps: ['Xtream-Masters OTT Player', 'VLC Media Player'],
      steps: [
        'Install Xtream-Masters OTT Player from the Microsoft Store on a 64-bit Windows 10 or Windows 11 PC.',
        'Open the player and choose an Xtream Codes login or M3U/M3U8 playlist, according to the details supplied by your provider.',
        'Enter your provider’s server address and account details directly into the player. Do not share them with PlayBeat or paste them into public links.',
        'Load the playlist and select a channel. The player does not include channels or a subscription; playback depends on your provider and plan.'
      ]
    }
  ];

  const currentGuide = deviceGuides.find((d) => d.id === selectedDevice) || deviceGuides[0];

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>Multi-Device Universal Compatibility</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight">
          Stream PlayBeat On Any Screen
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          From living room 4K OLED displays to smartphones on the move, PlayBeat Entertainment supports all major IPTV applications, streaming boxes, and media protocols.
        </p>
      </div>

      {/* Device Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {deviceGuides.map((d) => {
          const Icon = d.icon;
          const isSelected = selectedDevice === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDevice(d.id)}
              className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2.5 transition-all ${
                isSelected
                  ? 'bg-gradient-to-b from-cyan-950/40 to-[#0c1326] border-cyan-500 text-white shadow-lg shadow-cyan-500/10 scale-[1.02]'
                  : 'bg-[#0c1326]/60 border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-white/[0.05] text-slate-300'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">{d.title.split('&')[0]}</span>
                <span className="text-[10px] text-cyan-400 font-medium block mt-0.5">{d.badge}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Guide Details Box */}
      <div className="bg-[#0c1326] border border-white/[0.08] rounded-2xl p-6 lg:p-8 space-y-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <currentGuide.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
                <span>{currentGuide.title}</span>
                <span className="text-xs font-sans font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                  {currentGuide.badge}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Easy 5-minute setup with standard Xtream Codes or M3U playlist
              </p>
            </div>
          </div>

          <p className="max-w-sm text-xs leading-relaxed text-slate-400">
            Use connection details supplied through your secure provider account. This page does not prefill or expose stream credentials.
          </p>
        </div>

        {/* Recommended Applications */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recommended Player Applications:
          </h3>
          <div className="flex flex-wrap gap-2">
            {currentGuide.recommendedApps.map((app) => (
              <span
                key={app}
                className="px-3 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <PlaySquare className="w-3.5 h-3.5 text-cyan-400" />
                {app}
              </span>
            ))}
          </div>
        </div>

        {selectedDevice === 'windows_pc' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-950/20 p-4">
            <div>
              <h3 className="text-sm font-bold text-white">Xtream-Masters OTT Player for Windows</h3>
              <p className="mt-1 text-xs text-slate-400">
                Official Microsoft Store download for Windows 10 and 11 (64-bit). Player app only; channels are not included.
              </p>
            </div>
            <a
              href="https://apps.microsoft.com/detail/9P22P7SZTM11"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              <Download className="h-4 w-4" />
              Download for Windows
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Step-by-Step Instructions */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Step-by-Step Installation:
          </h3>
          <div className="space-y-3">
            {currentGuide.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Need Help CTA */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-blue-400 shrink-0" />
            <span className="text-xs text-slate-300">
              Need assistance setting up your specific box or TV model? Our VIP technical team provides remote setup guidance.
            </span>
          </div>
          <button
            onClick={onOpenPlans}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg whitespace-nowrap transition-colors"
          >
            Activate Subscription
          </button>
        </div>
      </div>
    </div>
  );
};
