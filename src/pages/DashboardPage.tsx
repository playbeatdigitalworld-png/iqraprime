import React, { useState, useEffect } from 'react';
import {
  Tv,
  Smartphone,
  Laptop,
  CheckCircle2,
  Copy,
  Clock,
  RefreshCw,
  LogOut,
  Radio,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { PWAInstallButton } from '../components/common/PWAInstallButton.js';
import type { DeviceInfo, WatchProgress } from '../types/index.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, subscription, logout, refreshSubscription } = useAuth();
  const { showToast } = useToast();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const subData = await api.getMySubscription(user?.id);
        setDevices(subData.devices || []);
        const cw = await api.getContinueWatching(user?.id);
        setContinueWatching(cw || []);
      } catch {
        // demo fallback
      }
    }
    loadDashboard();
  }, [user?.id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`Copied ${label} to clipboard`, 'success');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'smart_tv':
        return <Tv className="w-5 h-5 text-cyan-400" />;
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      default:
        return <Laptop className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 min-h-screen">
      {/* User Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#192231] flex items-center justify-center font-bold text-white text-xl">
              {user?.name?.[0] || 'U'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white font-display">
                {user?.name || 'Valued Subscriber'}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E5093A]/20 text-[#E5093A] border border-[#E5093A]/30">
                {subscription?.tier === 'iptv_vip'
                  ? 'Star IPTV VIP'
                  : subscription?.tier === 'premium'
                  ? 'Cinephile VIP'
                  : 'Free Explorer'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshSubscription()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/5"
            title="Refresh Subscription Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 text-xs font-semibold border border-white/5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active Subscription Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl bg-[#111A27] border border-white/10 p-6 shadow-xl">
            <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-4 font-display">
              Subscription Status
            </h2>

            <div className="p-4 rounded-xl bg-[#080B12] border border-white/5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  {subscription?.packageName || 'Free Cinema Explorer'}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>ACTIVE</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tier: <strong className="text-slate-200 capitalize">{subscription?.tier || 'free'}</strong>
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Activated:</span>
                <span className="font-mono text-slate-200">
                  {subscription?.activationDate
                    ? new Date(subscription.activationDate).toLocaleDateString()
                    : '2026-03-01'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Valid Through:</span>
                <span className="font-mono text-slate-200">
                  {subscription?.expiryDate
                    ? new Date(subscription.expiryDate).toLocaleDateString()
                    : '2027-03-01'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Device Allowance:</span>
                <span className="font-mono text-slate-200">
                  {subscription?.maxDevices || 1} Screen{subscription?.maxDevices !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Auto Renewal:</span>
                <span className="text-emerald-400 font-medium">Enabled</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('pricing')}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white text-xs font-semibold transition-colors shadow-md crimson-glow-sm"
            >
              Upgrade / Renew Line
            </button>
          </div>

          {/* Quick Links */}
          <div className="rounded-2xl bg-[#111A27] border border-white/10 p-4 space-y-2 text-xs">
            <button
              onClick={() => onNavigate('my-list')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#E5093A]" />
                <span>My Saved Watchlist</span>
              </span>
              <span className="text-slate-500 font-mono">→</span>
            </button>
            <button
              onClick={() => onNavigate('live-tv')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Browse Live TV Channels</span>
              </span>
              <span className="text-slate-500 font-mono">→</span>
            </button>
          </div>
        </div>

        {/* Right Columns: IPTV Line Credentials & Household Devices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Star IPTV Credentials Box (If customer has IPTV tier) */}
          {subscription?.iptvCredentials ? (
            <div className="rounded-2xl bg-[#111A27] border border-[#E5093A]/30 p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E5093A] animate-pulse" />
                  <h2 className="text-sm font-bold text-white font-display">
                    Star IPTV Line Credentials
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Dedicated Line: {subscription.iptvCredentials.username}
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Configure your IPTV player (TiviMate, Smart IPTV, IPTV Smarters, VLC) using your dedicated reseller stream parameters:
              </p>

              <div className="space-y-3">
                {/* Server Host */}
                <div className="p-3 rounded-xl bg-[#080B12] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Server Portal Host</span>
                    <span className="text-xs font-mono text-white">{subscription.iptvCredentials.serverHost}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(subscription.iptvCredentials!.serverHost, 'Server Host')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    title="Copy Server Host"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* M3U Plus URL */}
                <div className="p-3 rounded-xl bg-[#080B12] border border-white/5 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Masked M3U Plus Playlist</span>
                    <span className="text-xs font-mono text-slate-300 truncate block">
                      {subscription.iptvCredentials.m3uUrlMasked}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(subscription.iptvCredentials!.m3uUrlMasked, 'M3U Playlist URL')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
                    title="Copy M3U URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* XMLTV EPG URL */}
                <div className="p-3 rounded-xl bg-[#080B12] border border-white/5 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">XMLTV Electronic Program Guide (EPG)</span>
                    <span className="text-xs font-mono text-slate-300 truncate block">
                      {subscription.iptvCredentials.epgUrl}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(subscription.iptvCredentials!.epgUrl, 'EPG XMLTV URL')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
                    title="Copy EPG URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Authorized stream credentials managed securely via server-side storage. Never share credentials publicly.
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#111A27] border border-white/10 p-6">
              <h2 className="text-sm font-bold text-white font-display mb-2">
                Private Pilot Household Member
              </h2>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Your account is active in the closed household beta. Stream authorization and channels are managed directly by your system administrator.
              </p>
              <button
                onClick={() => onNavigate('pricing')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              >
                Private Beta Information
              </button>
            </div>
          )}

          {/* Household Devices Management */}
          <div className="rounded-2xl bg-[#111A27] border border-white/10 p-6 shadow-xl">
            <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-4 font-display">
              Connected Household Devices ({devices.length} / {subscription?.maxDevices || 1})
            </h2>

            {/* Official app install CTA — same hook as the navbar button */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-[#E5093A]/15 via-[#E5093A]/5 to-transparent border border-[#E5093A]/25">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[#E5093A]/20 text-[#FF4D6F] shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white font-display">Take StreamPlay everywhere</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Install the official app on this device — full-screen playback, no extra device slot used.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PWAInstallButton compact />
                <button
                  onClick={() => onNavigate('devices')}
                  className="text-[11px] font-semibold text-slate-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  More options
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#080B12] border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{device.name}</span>
                        {device.isCurrent && (
                          <span className="text-[9px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            This Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {device.os} · {device.browser} · Active {device.lastActive}
                      </p>
                    </div>
                  </div>

                  {!device.isCurrent && (
                    <button
                      onClick={() => {
                        setDevices(devices.filter((d) => d.id !== device.id));
                        showToast(`Disconnected ${device.name}`, 'info');
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors p-1"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
